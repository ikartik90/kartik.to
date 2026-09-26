# Project Overview and Structure

This is a _Design Engineering Portfolio and Blog_ built with **Next.js (App Router)**, **TypeScript**, **Panda CSS**, and **Zustand**. Persistence is managed via **Neon (Database/Auth)**, **Prisma (ORM)**, and **Cloudflare R2 (Object Storage)**. Security is managed via **Console-Triggered Auth (Neon Auth + GitHub OAuth)** and **Prisma (Neon/Vercel)**. The project is deployed on **Vercel**. The architecture enforces a strict "Global vs. Local" component boundary to prevent redundancy and ensure an object-oriented, modular codebase.

## CRITICAL: Always consult official docs before implementing

Every library in this stack ships breaking changes frequently. Training data is stale by definition. Before writing any code that touches the following, fetch and read the current official documentation first — no exceptions:

| Library           | Docs Source                               |
| ----------------- | ----------------------------------------- |
| **Next.js**       | `node_modules/next/dist/docs/`            |
| **Prisma**        | `https://www.prisma.io/docs/`             |
| **Neon (DB)**     | `https://neon.tech/docs/guides/prisma`    |
| **Neon Auth**     | `https://neon.tech/docs/guides/neon-auth` |
| **Panda CSS**     | `https://panda-css.com/docs/`             |
| **Cloudflare R2** | `https://developers.cloudflare.com/r2/`   |
| **Zustand**       | `https://zustand.docs.pmnd.rs/`           |
| **Zod**           | `https://zod.dev/`                        |

If a pattern from memory conflicts with fetched docs, **the docs win**.

## CRITICAL: You're not allowed to read or write into `.env`. If you want to offer examples of the environment variables to add use `.env.example`

---

# Directory Map

Project Root
├── `src/`
│ ├── `app/`: Next.js App Router (Public, Hidden Admin, API)
│ │ ├── `api/`: API Route Handlers (Auth callbacks, webhooks)
│ │ ├── `actions/`: Server Actions. Every non-public one opens with `requireAdmin()`
│ │ └── `edit/`: The hidden admin surface. Every page opens with `isAdmin()` + `notFound()`
│ ├── `assets/`: Global static assets (Images, Fonts, SVGs)
│ ├── `components/`: Global Shared Library (Flat structure; grouped by rationale only) with `__tests__/`
│ │ └── `ui/`: Primitives with `__tests__/`; `ui/recipes/` holds every shared recipe and the index that registers all recipes
│ ├── `domain/`: The Core: Zod schemas, Prisma models, and types with `__tests__/`
│ ├── `hooks/`: Shared React hooks with `__tests__/`
│ ├── `lib/`: Server-side singletons (e.g., `prisma.ts`, `neon.ts`, `storage/r2.ts`)
│ ├── `store/`: Zustand global state management with `__tests__/`
│ ├── `utils/`: Pure utility functions with `__tests__/`
│ ├── `data/`: Static content, constants, and theme tokens (`theme/`: tokens, semantic tokens, text styles, keyframes)
│ └── `proxy.ts`: Optimistic pre-filter for `/admin/*`. Reads the session cookie and `404`s (not `401`) anyone who is not the admin. It is NOT the security boundary — see Stealth Auth Strategy.
├── `prisma/`: Prisma schema and migrations
├── `panda.config.ts`: Conditions, breakpoints and global CSS. Imports the theme from `src/data/theme/` and recipes from `src/components/ui/recipes/`; defines no recipes
└── `AGENTS.md`: This file (The architectural contract)

---

# Build and Test Commands

- **Install**: `npm install`
- **Panda Codegen**: `npx panda codegen`
- **Dev**: `npm run dev`
- **Prisma Generate**: `npx prisma generate` (Run after schema changes)
- **Database Migrate**: `npm run db:migrate` (Author a migration from schema changes and apply it locally)
- **Database Deploy**: `npm run db:deploy` (Apply pending migrations; run by `npm run build`)
- **Database Status**: `npm run db:status` (Check which migrations the database has)
- **Vercel Build**: `npm run build` (Migrates, then ensures Panda and Prisma generate before build)
- **Lint**: `npm run lint`
- **Type Check**: `npx tsc --noEmit`
- **Test**: `npm test`

---

# Architecture and Design Patterns

## Logic & Data Integrity

- **Zod Domain Entities**: Define all core data models (e.g., `PostSchema`, `ProjectSchema`) in `src/domain/`. Use `z.infer` to extract types; avoid manual interface duplication.
- **Service Layer**: House complex business logic (e.g., reading time, filtering) in `src/domain/services/` or Server Actions. `page.tsx` should only compose UI and fetch data.
- **Client Hooks**: Use custom hooks in `src/hooks/` strictly for UI state and interactivity. Do not put business logic in component bodies.

## State Management Policy

- **Server-First Data**: Fetch data in Server Components. Do not lift server-side data into Zustand unless it requires complex client-side manipulation.
- **Prefer Local State**: Use `useState` for component-level UI logic.
- **Judicious Zustand**: Use global state only for cross-cutting concerns (e.g., Theme, Auth status, Toast notifications, or Admin Draft persistence).
- **Client Boundaries**: Keep `'use client'` components at the leaves of the component tree to maximize the use of Server Components.

## Component Hierarchy

- **The "Two-Page" Rule**: Components stay local to their `src/app/[route]` folder. Refactor to `src/components/` only when reused across different routes.
- **Deduplication**: Before creating any component, the agent must search the global library to see if an existing component or Panda Pattern can be repurposed.
- **Rationalized Subfolders**: Keep `src/components/` flat. Subfolders are only allowed if a group of components shares a strict functional utility.

## Stealth Auth Strategy

- **Console-Triggered Login**: Authentication is triggered via a global helper (e.g., `window.adminLogin()`) defined in a client-side utility and Neon Auth OAuth routes. There are no visible login buttons.
- **The Boundary is the Data Layer**: `isAdmin()` / `requireAdmin()` in `src/lib/auth/server.ts` is the one server-side answer to "is the caller the author", and the only place `ADMIN_GITHUB_ID` may be compared (ESLint enforces this). Every admin page under `src/app/edit/` must open with `if (!(await isAdmin())) notFound()`, and every Server Action must open with `await requireAdmin()` unless it is deliberately public — in which case say so in the module's header, as `submitTestimonial` and the published-content reads do. Next recommends authorizing "as close as possible to your data source" precisely because a route's guard does not cover the actions reachable from it.
- **Never a Layout**: Do not make `src/app/edit/layout.tsx` the gate. Next calls that pattern "not recommended" — "Next.js applications have multiple entry points, which will not prevent nested route segments and Server Actions from being accessed."
- **The Proxy is a Pre-Filter, Not the Gate**: `proxy.ts` runs on every route including prefetches, so it may only read the session cookie — an "optimistic" check in Next's terms, and explicitly "optional". It masks `/admin/*` with a `404` and nothing else may depend on it; removing it must not expose anything.
- **404 Masking**: A refusal is always a `404`, never a `401` — at the page, in the proxy, and in any read that would otherwise confirm an unpublished row exists.

## Styling (Panda CSS)

- **Token First**: All styling must give preference to theme tokens via the `css()` function or `stack`, `flex`, and `box` patterns.
- **Zero Arbitrary Values**: Use design tokens from `DESIGN.md`. Avoid `css({ color: '#123456' })`. Prefer `css({ color: 'primary.500' })`.
- **One definition per look.** A style block that repeats most of another block's declarations is a **near-copy**. Write the difference as a variant of the existing block, the way `action` carries `emphasis` and `size`.
- **Before writing any style block**, search the recipes and other components' `css()` calls for its two or three most distinctive declarations. The search is done when you can name the closest existing block, or have confirmed there isn't one. Then:
  - **It's a recipe:** add a variant (or compound variant) holding only what differs.
  - **It's a `css()` block in another component:** it now has two users, so turn it into a recipe in `src/components/ui/recipes/`, then add your variant.
  - **Nothing close:** `css()` in your component, or a recipe beside it if it needs variants.
- **Where recipes live** follows who uses them, as with components. A recipe is a `defineRecipe` / `defineSlotRecipe` in its own file:
  - **One component:** `<component>.recipe.ts` beside it.
  - **Two or more:** `src/components/ui/recipes/<name>.ts`, moved in the same change that adds the second user.
  - A shared recipe is named for the part it styles (`toolbar`, `menuIcon`). A bundle of properties is a `css()` call or a pattern.
  - Every recipe is registered in `src/components/ui/recipes/index.ts`; `panda.config.ts` imports that index and defines none.
- **Restyling a component from outside:** a look the component offers is a variant its caller picks (`MediaTransport`'s `corner`). A caller's one-off goes in a `css` prop the component merges with `css(base, props.css)`, passed as a `css.raw()` (`Notice`). A caller's `className` only adds properties the component doesn't set: two `css()` classes setting one property have no dependable winner.

## Node.js Runtime & Prisma

- **Runtime Policy**: Use the standard Node.js Runtime. Avoid the Edge Runtime to ensure full compatibility with Prisma and Node.js built-ins.
- **Server-First Logic**: Fetch data directly in Server Components using Prisma. Use Server Actions for all data mutations.

---

# Coding Conventions and Style Guidelines

- **Server-First**: Default to Server Components. Use `'use client'` only for interactive state (Zustand) or `adminLogin()` console utility.
- **Flat Discovery**: Keep `src/components/` flat. Avoid deep nesting unless functionally justified.
- **Test-First**: Write tests before implementing logic (TDD); every functional directory MUST contain a co-located `__tests__` subfolder.
- **Comments**: Describe the code as it is now, and only what the code can't say itself: a constraint that would break something if changed, in a line or two. No history, rationale essays, design references or restated code; those belong in the commit message.

---

# Testing Guidelines

## Test-Driven Development (TDD)

**TDD is the default workflow for any code with logic.** Write the test before the implementation, not after.

- **Red → Green → Refactor**: Write a failing test that specifies the intended behavior; run `npm test` and confirm it fails for the right reason; write the minimum code to make it pass; then refactor with the test as your safety net.
- **Spec, not snapshot**: Assert against the _specification_ (inputs → expected outputs, valid/invalid cases), never against whatever the current implementation happens to emit. A test that cannot fail proves nothing.
- **Incremental, not backfilled**: Add tests one behavior at a time as the design emerges. Do not batch-write tests after the code is "done" merely to satisfy the coverage rule.
- **Bugs start red**: Reproduce every bug with a failing test first, then fix it. This locks the regression out for good.
- **Pragmatic scope**: Pure presentational work (Panda recipes, layout, tokens) has no meaningful failing state — verify it in the browser preview and reserve tests for behavior (interaction, state, output), which is still written test-first.

## Coverage & Isolation

- **Ubiquitous Coverage**: If it contains logic, it requires a `__tests__` folder.
- **Isolation**: `__tests__` must reside in the same directory as the code its constituents are testing.

## Relevant Testing

- **Domain**: Test schema validation (pass/fail cases).
- **Components/Pages**: Test rendering, variants, and user interaction.
- **Hooks/Utils**: Test logic with various input scenarios.

---

# Security and Compliance

- **Vercel Hygiene**: Use Vercel environment variables for sensitive keys (`DATABASE_URL`, `NEON_AUTH_CLIENT_SECRET`, `R2_SECRET_ACCESS_KEY`).
- **404 Obfuscation**: Always return a `404` for unauthorized admin access to hide the route’s existence.
- **Sanitization**: All external content must be sanitized before rendering.
- **Dependency Safety**: Do not add new NPM packages without verifying they are actively maintained and lightweight.
- **NPM Vulnerability Callouts**: Do not ignore moderate or higher security vulnerabilities identified in the dependency tree by `npm audit` for non-dev dependencies.

---

# General Instructions (Dos and Don'ts)

## Dos

- **DO** follow YAGNI principles, and one-liner solutions.
- **DO** write a failing test before implementing logic (TDD); make it pass, then refactor.
- **DO** verify current Next.js documentation in `node_modules/next/dist/docs/` before implementing new patterns.
- **DO** promote local components to the global library upon second use.
- **DO** use Server Actions for all content mutations.

## Don'ts

- **DON'T** expose the admin route in navigation, sitemaps, metadata or to any crawlers/robots.
- **DON'T** write "local" components that duplicate global ui/primitives.
- **DON'T** bypass the Zod domain layer for any database or API operation.
- **DON'T** duplicate logic across different pages; abstract shared logic into src/hooks/

---

# Self-Improvement

After every bug fix or non-obvious implementation decision, add a concise learning to `.cursor/rules/self-improvement.md`. One or two sentences per entry — just the directive, no narrative. Read the file before starting any new task.
