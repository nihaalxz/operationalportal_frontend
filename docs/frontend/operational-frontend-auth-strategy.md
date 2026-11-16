# Operational Frontend Authentication Strategy

This document outlines the authentication and session management architecture implemented in the Texas Operational Portal.

## Token Management Strategy

To ensure high security against Cross-Site Scripting (XSS) and Cross-Site Request Forgery (CSRF) attacks:
1. **Short-Lived Access Token (In-Memory)**:
   - The JWT Access Token returned by the `/api/auth/login` and `/api/auth/refresh` endpoints is stored strictly **in memory** (within a Svelte/session store).
   - It is **never** written to `localStorage` or `sessionStorage` to mitigate token theft via XSS.
   - It is sent as a standard HTTP header on all subsequent API requests:
     `Authorization: Bearer <token>`
2. **Long-Lived Refresh Token (HttpOnly Cookie)**:
   - The backend sets a `refresh_token` cookie in the HTTP header on successful login/refresh.
   - The cookie is marked `HttpOnly` (preventing reading via Javascript), `Secure` (only sent over HTTPS), and `SameSite=Strict` (mitigating CSRF).
   - The refresh token is rotated on every refresh request.

## Authentication Flows

### 1. Initial Session Bootstrap
On application startup:
```mermaid
sequenceDiagram
    participant FE as Frontend (SPA)
    participant BE as Backend API
    FE->>BE: POST /api/auth/refresh
    Note over BE: Reads refresh_token cookie
    alt Cookie valid
        BE->>FE: 200 OK (AccessToken + User Info)
        Note over FE: Save AccessToken in memory;<br/>Set status to Authenticated
    else Cookie missing/invalid
        BE->>FE: 401 Unauthorized
        Note over FE: Redirect to /login
    end
```

### 2. Standard API Requests and 401 Recovery
When a request fails with a `401 Unauthorized` status (due to token expiration):
```mermaid
sequenceDiagram
    participant FE as Frontend (SPA)
    participant BE as Backend API
    FE->>BE: GET /api/visas (with expired token)
    BE->>FE: 401 Unauthorized
    Note over FE: Intercept 401;<br/>Queue concurrent requests
    FE->>BE: POST /api/auth/refresh
    alt Refresh successful
        BE->>FE: 200 OK (New AccessToken)
        Note over FE: Retry original request(s) with new token
        FE->>BE: GET /api/visas (with new token)
        BE->>FE: 200 OK (Data)
    else Refresh fails
        BE->>FE: 401 Unauthorized
        Note over FE: Clear session;<br/>Redirect to /login
    end
```

### 3. Logout
- The frontend sends `POST /api/auth/logout` with the current `Authorization: Bearer <AccessToken>` header.
- The backend revokes the refresh token in the database and clears the `refresh_token` cookie.
- The frontend clears the in-memory access token, user metadata, and redirects the user to `/login`.

## Security Measures
- **No Local Storage**: Sensitive session tokens are never saved to persistent browser storage.
- **Strict SameSite Cookie**: Mitigates Cross-Site Request Forgery (CSRF).
- **Concurrency Locking**: When multiple API requests fail with 401 simultaneously, the frontend API client locks and performs exactly **one** refresh token request. Once completed, it retries all queued requests. This prevents refresh storms and token invalidation loops.
