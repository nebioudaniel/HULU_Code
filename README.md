# huluCode

huluCode is a local-first AI codebase navigator: it scans your code on your own machine, maps how everything connects, and answers questions about it. Your source code never leaves your laptop.

<!-- add screenshots in docs/ -->

## What it does today

The web app is the product hub around the (not yet released) local CLI.

- **Landing page** — product overview, features, pricing, FAQ.
- **Sign in with GitHub** — OAuth via Auth.js. Users are stored in Neon Postgres.
- **Dashboard** — overview with usage stats and a get-started checklist, plus pages for projects, queries, API keys, usage, billing and account settings.
- **Chapa payments** — Pro upgrades in ETB. Supports Chapa's hosted checkout (card and bank) and v1 Direct Charge for Ethiopian mobile money (Telebirr, M-Pesa, CBE Birr, Awash Birr, Yaya Wallet). Webhook signature verification is included.
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
| `AUTH_SECRET` | Signs Auth.js session cookies. Generate with `openssl rand -base64 32`. |
| `AUTH_GITHUB_ID` | GitHub OAuth App client ID. |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App client secret. |
| `CHAPA_SECRET_KEY` | Chapa secret key for hosted checkout initialize/verify. |
| `CHAPA_V1_SECRET_KEY` | Chapa v1 secret key for mobile money Direct Charge. |
| `CHAPA_WEBHOOK_SECRET` | Verifies `x-chapa-signature` on payment webhooks. |
| `NEXT_PUBLIC_CHAPA_PUBLIC_KEY` | Chapa publishable key. Currently unused by the code. |
| `NEXT_PUBLIC_APP_URL` | Base URL used for payment redirect links, e.g. `http://localhost:3000`. |

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

## License

MIT. See [LICENSE](LICENSE).
