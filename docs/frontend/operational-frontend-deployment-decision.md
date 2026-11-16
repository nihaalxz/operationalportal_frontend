# Operational Frontend Deployment Decision

## Context
We need to select a deployment adapter for the Texas Operational Portal frontend. The options provided by the SvelteKit ecosystem are:
1. `@sveltejs/adapter-auto`: Automatically detects target hosting environment but can yield unpredictable builds.
2. `@sveltejs/adapter-node`: Compiles to a Node.js server.
3. `@sveltejs/adapter-static`: Compiles to a static site/Single Page Application (SPA).

## Decision
We select **`@sveltejs/adapter-static`** to build the application as a **Single Page Application (SPA)**.

## Rationale
1. **API-Driven Architecture**: The Operational Frontend does not contain its own server-side database connection or secrets. It interacts strictly with the ASP.NET Core Web API backend via AJAX/fetch requests.
2. **Simplified Hosting**: The compiled output consists of static files (HTML, CSS, and JS), which can be served by IIS (often co-located with ASP.NET APIs), Nginx, AWS S3/CloudFront, Azure Static Web Apps, or Cloudflare Pages.
3. **Consistency**: The Sales Portal frontend is already standardized on `@sveltejs/adapter-static` with a fallback to `index.html`. Using the same adapter ensures configuration parity and builds on verified devops pipelines.
4. **Performance & Security**: Serving static assets directly from a CDN or lightweight static web server eliminates the runtime overhead and attack surface of a Node.js server container.

## Configuration Details
In `vite.config.ts`, we configure the `adapter` as follows:
```typescript
import adapter from '@sveltejs/adapter-static';

// ... inside sveltekit options ...
adapter: adapter({
    pages: 'build',
    assets: 'build',
    fallback: 'index.html', // SPA fallback routing
    precompress: false,
    strict: true
})
```
This forces SvelteKit to run in SPA mode.
