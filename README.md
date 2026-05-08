This is a clean-slate [Next.js](https://nextjs.org) + TypeScript project intended for deployment on [Vercel](https://vercel.com).
It is pre-wired with Panda CSS, Zod, Supabase auth/client helpers, and Prisma.

## Getting Started

1) Copy env vars:

```bash
cp .env.example .env
```

2) Update `.env` with your Supabase project values and database URL.

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
- Supabase SSR helpers and GitHub OAuth route scaffolding (`src/app/auth/*`)
- Prisma schema/client (`prisma/schema.prisma`)

## GitHub OAuth via Supabase

In Supabase Auth settings:
- Enable GitHub provider
- Set callback URL to:
  - `http://localhost:3000/auth/callback` (local)
  - `https://your-domain.com/auth/callback` (production)

The app exposes:
- `GET /auth/sign-in` to start OAuth
- `GET /auth/callback` to exchange the auth code for a session

## Prisma commands

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

## Deploy on Vercel

Import this repo in Vercel and set the same environment variables from `.env.example` in the Vercel project settings.
