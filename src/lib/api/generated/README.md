# Generated OpenAPI Types

This directory contains typescript definitions generated automatically from the ASP.NET Core backend OpenAPI (Swagger) document.

## Generation Command

```bash
npm run api:types
```

This runs:
```bash
openapi-typescript http://localhost:5232/swagger/v1/swagger.json --output src/lib/api/generated/api-types.ts
```

## Regeneration Workflow

1. Ensure the local backend is running (using the `"http"` launch profile, listening on `http://localhost:5232`).
2. Run `npm run api:types` in the frontend directory.
3. Review git changes in `api-types.ts` to confirm no breaking backend contract updates.

## CI/CD Expectations
The generated types are committed to version control. The CI pipeline runs `npm run check` to verify that there are no TypeScript compilation or type mismatches against the current committed schema.
