This is a clean-slate [Next.js](https://nextjs.org) + TypeScript project intended for deployment on [Vercel](https://vercel.com).
It is pre-wired with Panda CSS, Zod, Neon (DB + Auth), Cloudflare R2, and Prisma.

## Getting Started

1) Copy env vars:

```bash
cp .env.example .env
```

2) Update `.env` with your Neon database URL, Neon Auth (**Auth URL** + **cookie secret**), and Cloudflare R2 values.

3) Generate Prisma client and run dev server:

```bash
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Included stack

- Next.js App Router + TypeScript
- Panda CSS (`panda codegen` runs automatically in `npm run dev` and `npm run build`)
- Zod env validation (`src/lib/env.ts`)
- Neon Auth (`@neondatabase/auth`): `src/lib/auth/server.ts`, `src/app/api/auth/[...path]/route.ts`, `GET /auth/sign-in`
- Cloudflare R2 signed upload helper (`src/lib/storage/r2.ts`)
- Prisma schema/client (`prisma/schema.prisma`)

## Admin login trigger (no visible button)

Authentication is intentionally console-triggered.

```js
window.adminLogin()
```

This immediately redirects to the GitHub OAuth handshake via Neon Auth.

## GitHub OAuth via Neon Auth

In Neon Auth settings:
- Enable GitHub as a connection/provider and add your **GitHub OAuth App** credentials there
- In the Neon Auth / app settings, allow your site URL and the Better Auth API routes (follow Neon’s prompts; callbacks are handled under `/api/auth/*`, not `/auth/callback`)

The app exposes:
- `GET /auth/sign-in` — starts GitHub sign-in via Neon Auth (`window.adminLogin()` navigates here)
- `GET`/`POST` `/api/auth/[...path]` — Neon Auth proxy (sessions, OAuth callbacks, etc.)

## Continuous integration

Opening a pull request against `main` — or pushing another commit to one —
runs `.github/workflows/ci.yml`:

| Job | What it does |
| --- | --- |
| **Lint & types** | `eslint` + `tsc --noEmit`, after generating the Prisma client and Panda's `styled-system` |
| **Unit tests** | `vitest run` (jsdom) |
| **Integration tests** | Waits for Vercel's preview deployment of the head commit, then runs Playwright against that live URL |

The integration suite deliberately targets the **deployed preview**, not a
runner-local build, so it exercises the real environment, database and proxy.
On failure the workflow posts (and thereafter updates) a single summary comment
on the pull request, and uploads a `playwright-report` artifact with traces.

`.github/workflows/auto-merge.yml` then arms GitHub's native auto-merge, so a
pull request squash-merges itself once every required check is green — and the
push to `main` is what triggers Vercel's production deploy. The workflow refuses
to arm unless the base branch actually requires status checks, since auto-merge
on an unguarded branch merges immediately.

### One-time setup

1. **Vercel → Project → Settings → Deployment Protection → Protection Bypass for
   Automation.** Generate a secret and add it to the repository as the
   `VERCEL_AUTOMATION_BYPASS_SECRET` Actions secret. Without it every request to
   a preview is redirected to `vercel.com/login` and the suite cannot run.
2. **A ruleset on `main`** requiring `Lint & types`, `Unit tests`,
   `Integration tests`, and `Vercel`. This is the gate auto-merge waits on.

Run the same suite locally against a production build — Playwright starts the
server itself:

```bash
npm run test:e2e
```

Or point it at any deployment:

```bash
E2E_BASE_URL=https://kartik.to npm run test:e2e
```

## Prisma commands

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

## Deploy on Vercel

Import this repo in Vercel and set the same environment variables from `.env.example` in the Vercel project settings.
