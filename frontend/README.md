# MaiaFlow web

Next.js (App Router, TypeScript strict) + Tailwind CSS + shadcn/ui. The browser only talks to this
app; the app talks to the API (backend-for-frontend), and the API's JWT lives in an `httpOnly` cookie.

Read [`AGENTS.md`](AGENTS.md) first: this Next.js version differs from older ones, and its docs ship in
`node_modules/next/dist/docs/`.

## Run

```bash
cp .env.example .env.local   # API_URL, default http://localhost:5011
npm install
npm run dev                  # http://localhost:3000 (the API must be running)
```

## Scripts

| Script                            | What it does                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `npm run check`                   | lint + typecheck + format check + tests (run before committing)               |
| `npm test` / `npm run test:watch` | Vitest                                                                        |
| `npm run api:types`               | Regenerates `src/lib/api/schema.d.ts` from the running API's OpenAPI document |
| `npm run format`                  | Prettier                                                                      |
| `npm run build`                   | Production build                                                              |

## Structure

- `src/app/(auth)` login and sign-up (Server Actions in `actions.ts`).
- `src/app/(app)` the signed-in area: shell with sidebar and header; placeholder pages until phase 3.
- `src/app/api/[...path]` the BFF: forwards same-origin `/api/*` calls to the API with the JWT from the cookie.
- `src/app/auth/session-expired` clears a dead session and sends the user to login.
- `src/proxy.ts` optimistic redirect (cookie present and not expired); the API is the real authority.
- `src/lib/api` typed client (`openapi-fetch`), generated types, error parsing, BFF rules.
- `src/lib/auth` cookie/session helpers. `src/lib/validation` Zod schemas (Portuguese messages).
- `src/components/ui` shadcn/ui components.

UI text is Brazilian Portuguese; code, comments and docs are English.
