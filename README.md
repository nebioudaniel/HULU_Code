# huluCode

huluCode is a local-first AI codebase navigator: it scans your code on your own machine, maps how everything connects, and answers questions about it. Your source code never leaves your laptop.

<!-- add screenshots in docs/ -->

## What it does today

The web app is the product hub around the (not yet released) local CLI.

- **Landing page** — product overview, features, pricing, FAQ.
- **Sign in with GitHub** — OAuth via Auth.js. Users are stored in Neon Postgres.
- **Dashboard** — overview with usage stats and a get-started checklist, plus pages for projects, queries, API keys, usage, billing and account settings.
- **Chapa payments** — Pro upgrades in ETB via Chapa's hosted checkout (card and bank). Webhook signature verification is included.
- **Free and Pro plans** — plan limits are defined in `lib/plans.ts` and drive the dashboard copy and meters.

## Roadmap

In rough order:

- **API keys** — UI exists at `/dashboard/keys`, but creation and storage are not wired up yet.
- **Go backend** — a small service that validates API keys. Only the key-validation endpoint exists so far.
- **CLI** — `hulucode auth login`, `hulucode scan --local`. Not written yet.
- **Tree-sitter parsing** — real source indexing instead of placeholder counts.
- **Dependency map** — the file graph and impact analysis tabs on the project page.

## Tech stack

- Next.js 16 (App Router) and React 19
- TypeScript
- Tailwind CSS 4 with shadcn/ui and Radix primitives
- Auth.js (next-auth v5) with the GitHub provider
- Neon serverless Postgres (`@neondatabase/serverless`)
- Chapa payment API
- Sonner for toasts, Lucide for icons

## Getting started

Requires Node.js 20+ and a Neon Postgres database.

```bash
git clone https://github.com/nebioudaniel/HULU_Code.git
cd HULU_Code/frontend
npm install
cp .env.example .env
```

Fill in `.env` (see the table below), then create the tables:

```bash
psql "$DATABASE_URL" -f migrations/001_init.sql
```

Start the dev server:

```bash
npm run dev
```

Open http://localhost:3000.

## Environment variables

`.env.example` lists every variable the app reads. Copy it to `.env` and fill in the values.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string (pooled). |
| `DB_DRIVER` | Set to `pg` for local/Docker Postgres. Unset for Neon and Cloudflare. |
| `AUTH_SECRET` | Signs Auth.js session cookies. Generate with `openssl rand -base64 32`. |
| `AUTH_GITHUB_ID` | GitHub OAuth App client ID. |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App client secret. |
| `CHAPA_SECRET_KEY` | Chapa secret key for hosted checkout initialize/verify. |
| `CHAPA_WEBHOOK_SECRET` | Verifies `x-chapa-signature` on payment webhooks. |
| `NEXT_PUBLIC_APP_URL` | Base URL used for payment redirect links, e.g. `http://localhost:3000`. |
| `ENABLE_DEMO_UPGRADE` | Set to `true` only for local demo testing. MUST stay off in any real deployment. |

Set the GitHub OAuth callback URL to `http://localhost:3000/api/auth/callback/github` while developing locally.

## Project structure

```
app/
  page.tsx              landing page
  dashboard/            authenticated app (overview, projects, queries, keys, ...)
  api/                  route handlers: auth, payments, user plan
  docs/ privacy/ terms/ select-plan/
components/
  ui/                   shadcn/ui primitives
  dashboard/            dashboard-only pieces (sidebar, stat cards, ...)
  *.tsx                 landing page sections and shared widgets
lib/
  db.ts                 Neon connection pool
  auth helpers live in auth.ts
  payments.ts           payment table bootstrap
  chapa.ts              Chapa v1/v2 clients and verification
  plans.ts              plan limits and display price
migrations/             SQL schema
types/                  TypeScript module augmentations
```

Payments are settled by Chapa and reconciled by `app/api/payments/webhook`. Upgrades set `users.plan_tier` to `pro` with a 30-day `plan_ends_at`.



## Architecture

huluCode is composed of these pieces:

1. **CLI** (`cli/`) — a local Go tool (Cobra + Tree-sitter). It scans your codebase on your machine and uploads only structure: relative file paths, symbol names and kinds, line numbers, import edges, and external package names.
2. **Web app** — Next.js 16 (App Router), the product hub.
3. **API** — the web app exposes `POST /api/v1/auth/validate` and `POST /api/v1/projects/sync`.
4. **Database** — Postgres with the `vector` extension. Production uses Neon; local development uses `pgvector/pgvector:pg16`.
5. **Go reference service** (`backend/`) — optional. It exposes the same `POST /auth/validate`; the web app already serves the same endpoint, so this service is not required.

Text diagram:

```text
hulucode CLI (local) ── POST /api/v1/auth/validate, projects/sync ──>  huluCode web app (Next.js :3000)
                                                                                        │
                                                                                        ▼
                                                                                   Postgres (pgvector)
```

## Run with Docker

1. (Optional) copy `.env.docker.example` to `.env`, or reuse the existing `.env` (see warnings below).
2. Start the stack: `docker compose up --build -d`
3. Open http://localhost:3000.

`docker compose` also runs the migrations in order (`000_extensions`, `001_init`, `002_api_keys`, `003_projects`) automatically on a fresh database.

> **Important:** `migrations/` is only for a fresh local database. Do not run it against an existing Neon database.

## Run without Docker

1. Create a fresh local Postgres database with the `vector` extension.
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, and `CHAPA_*`.
3. Run `npm install` then `npm run dev`.

## CLI build requirements

- **macOS:** Xcode Command Line Tools (`xcode-select --install`).
- **Linux:** `gcc` (any modern distribution) and Go 1.22+.
- Confirm with `go version` and `gcc --version`.

## Privacy

`hulucode scan --local --sync` sends only this structure:

- The project name, and a content hash of the repository (never the full path).
- Relative file paths, language, line counts, and whether a file was parsed as partial.
- Chunk keys, file paths, kinds, names, parents, start/end lines, and content hashes.
- Import edges between files.
- External dependency names and counts.

It never sends:

- Any source code or file contents.
- Absolute paths (only relative paths).
- Files whose names look like secrets or credentials.
- API keys, tokens, or database connection strings.

## Project status

huluCode is in early development (v0.1.0). The web app, CLI, and a Go reference backend service are available. API keys, Chapa payments, and project sync are implemented and being finished.

## Live demo

The deployed instance is a placeholder. Set it up yourself with Cloudflare Workers Builds (see docs/DEPLOY_CLOUDFLARE.md). Payments run in Chapa test mode; no real money is collected.

## Screenshots

(TODO: add screenshots in `docs/` for the landing page, dashboard, and sync flow.)
## License

MIT. See [LICENSE](LICENSE).
