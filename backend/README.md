# Hulu Code backend (reference service)

This is an optional reference service. It is not required to run Hulu Code.

The Next.js web app already exposes `POST /api/v1/auth/validate`. This Go service
implements the same API-key validation over a different runtime, using the same
SHA-256 hashing as `lib/api-keys.ts` in the web app. If you never start it, the
product works exactly the same.

## What it does

- `POST /auth/validate` reads the API key from the `Authorization: Bearer <key>`
  header, hashes it with SHA-256 (lowercase hex), looks the hash up in the
  `api_keys` table joined with `users`, and returns the user id and plan tier.
- It refuses missing, unknown, and revoked keys with HTTP 401.
- Configuration comes only from environment variables. No secret is compiled in.

## Environment variables

- `DATABASE_URL` (required): PostgreSQL connection string.
- `PORT` (optional, default `8080`): port to listen on.

Copy `.env.example` to `.env` and fill in the values.

## Run locally

```
go run .
```

## Test

```
go vet ./...
go test ./...
```

## Run with Docker

```
docker build -t hulu-backend .
docker run --rm -e DATABASE_URL=postgres://... -p 8080:8080 hulu-backend
```
