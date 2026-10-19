# Deploy to Cloudflare Workers

This guide walks through deploying huluCode to Cloudflare Workers using the OpenNext adapter and Cloudflare Workers Builds (GitHub integration). Cloudflare runs the build for you; you do not need to build locally.

This project is on the Cloudflare Free plan. No paid services are used.

## Before you start

- A Cloudflare account.
- The huluCode repository pushed to GitHub.
- A Neon Postgres database (or any Postgres with the `vector` extension) reachable from Cloudflare Workers. Do not run `migrations/` against your production Neon database; those SQL files are for fresh local databases only.
- A GitHub OAuth App (see "GitHub OAuth" below).
- A Chapa account in test mode (see "Chapa payments" below).

## Step 1: Create the Cloudflare account

1. Sign up at https://dash.cloudflare.com/sign-up.
2. Create a Workers subdomain (`*.workers.dev`) if you do not already have one.
3. Go to Workers & Pages in the dashboard.

## Step 2: Connect the GitHub repo in Workers Builds

1. In the Cloudflare dashboard, go to Workers & Pages > Create > Connect GitHub repo.
2. Select the `nebioudaniel/HULU_Code` repository.
3. Set the project root to `frontend` (the Next.js app lives there).
4. Use these build settings:

   - Build command: `npm run cf:build`
   - Build output directory: `.open-next`
   - Deploy command: `npm run cf:deploy`
   - Node version: 22

   Workers Builds runs `npm ci`, then `npm run cf:build`, then deploys the generated worker.

5. Add the environment variables below. Mark runtime secrets as "secret" (encrypted) variables; build-time variables are plain text.

### Build-time variables (plain text)

- `NEXT_PUBLIC_APP_URL` — the public URL of your deployed worker, e.g. `https://hulucode.your-subdomain.workers.dev` (or your custom domain). This is baked into the build.

### Runtime secrets (encrypt these)

- `DATABASE_URL` — Neon Postgres connection string (pooled).
- `AUTH_SECRET` — signs Auth.js session cookies. Generate one with `openssl rand -base64 32`.
- `AUTH_GITHUB_ID` — GitHub OAuth App client ID.
- `AUTH_GITHUB_SECRET` — GitHub OAuth App client secret.
- `CHAPA_SECRET_KEY` — Chapa secret key for hosted checkout.
- `CHAPA_WEBHOOK_SECRET` — verifies `x-chapa-signature` on payment webhooks.

Variable names only are listed here; never paste real values into this document.

## Step 3: GitHub OAuth app

1. Go to your GitHub account Settings > Developer settings > OAuth Apps > New OAuth App.
2. Application name: `huluCode` (or your choice).
3. Authorization callback URL: `https://hulucode.your-subdomain.workers.dev/api/auth/callback/github`
   Replace `hulucode.your-subdomain.workers.dev` with your actual worker URL or custom domain.
4. Copy the Client ID and Client Secret into `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` in the Cloudflare dashboard.

## Step 4: Chapa payments

1. Create a Chapa account and keep it in **test mode**.
2. Copy the test secret keys into `CHAPA_SECRET_KEY` and `CHAPA_V1_SECRET_KEY`, and the test public key into `NEXT_PUBLIC_CHAPA_PUBLIC_KEY`.
3. Set the webhook URL to `https://hulucode.your-subdomain.workers.dev/api/payments/webhook` and copy the webhook secret into `CHAPA_WEBHOOK_SECRET`.
4. Leave `ENABLE_MOCK_PAYMENTS` unset. The code does not read it; payments go through Chapa in test mode.

## Step 5: Deploy

1. Push any change to `main` on GitHub.
2. Workers Builds triggers a build and deploy automatically.
3. In the Cloudflare dashboard, go to Workers & Pages > your project > Deployments to confirm the latest deploy succeeded.

## Post-deploy checklist

1. `curl https://<your-worker>/api/health` — expect `200 {"status":"ok"}`.
2. Open the worker URL in a browser and sign in with GitHub.
3. Create an API key at `/dashboard/keys`.
4. Validate it with curl:

   ```sh
   curl -X POST https://<your-worker>/api/v1/auth/validate \
     -H "Authorization: Bearer hulu_sk_..."
   ```

   Expect `200 {"valid":true,...}` with a real key, and `401` with a bad key.
5. From the CLI, run `hulucode scan --local --sync --yes` against the worker URL with your key. Confirm the database row counts match the CLI summary, and that a second sync creates no duplicates.

## Reading the Workers logs

1. In the Cloudflare dashboard, go to Workers & Pages > your project.
2. Open the latest deployment and click "Logs" to view live console output and errors.
3. Use `wrangler tail` locally if you have the Workers CLI installed and authenticated:

   ```sh
   wrangler tail
   ```

## Free plan limits to keep in mind

- Worker script size limit: 3 MiB (compressed). wrangler reports the compressed size after `cf:build`.
- 50 subrequests per request and 10 ms CPU time per request on the Free plan. The sync route writes files, chunks, and edges with one `INSERT ... SELECT FROM unnest(...)` per table inside a single transaction, so it uses very few database round trips regardless of project size.
- Sync payloads over 8 MB are rejected with `413`.
