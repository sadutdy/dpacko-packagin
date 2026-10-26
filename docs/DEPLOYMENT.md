# Deploying to Vercel

One Vercel project serves everything from a single domain:

| Path | App | How |
|---|---|---|
| `/` | `apps/website` | static Astro build |
| `/backoffice` | `apps/admin-web` | static Vite SPA built with base `/backoffice/` |
| `/api/*` | `apps/api` | Express app bundled into one serverless function (`api/index.js`) |

`vercel.json` + `scripts/vercel-build.mjs` do the wiring. The build runs both front-end
builds and writes a Vercel Build Output (`.vercel/output`): static files, a `config.json` with
the routes, and one function (`functions/api/index.func`) containing the esbuild bundle of
`apps/api/src/serverless.ts` plus the native `argon2` module copied beside it.

## Set up

1. Import the GitHub repo in Vercel. Leave **Root Directory** empty (repo root); settings come
   from `vercel.json`. Node 22.
2. Add environment variables (Project → Settings → Environment Variables, Production):

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `MONGO_URI` | MongoDB Atlas connection string (a local/Docker Mongo will not work) |
| `MONGO_DB_NAME` | `ameen` |
| `REDIS_URL` | `rediss://…` from Upstash/Redis Cloud (optional for requests; needed for queues) |
| `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` | RSA PEM pair (required in production). Replace newlines with `\n` if the UI strips them |
| `COOKIE_SECRET`, `BCRYPT_PEPPER` | long random strings |
| `WEB_ORIGIN` | your production origin, e.g. `https://dpacko.in` |
| `S3_*`, `RAZORPAY_*`, `WHATSAPP_*`, `SMS_*` | only if those features are used (see `.env.example`) |

   The admin console needs no `VITE_API_URL`: the build sets it empty so it calls `/api/v1/...`
   on the same origin (refresh cookie path `/api/v1/auth` works unchanged).
3. Seed the Atlas database once from your machine:
   `MONGO_URI=<atlas uri> pnpm seed`.
4. After the domain is known, set `site` in `apps/website/astro.config.mjs` and the `Sitemap:`
   line in `apps/website/public/robots.txt`.

## What does not run on Vercel

- **Socket.IO** live updates (`realtime/`) — serverless functions cannot hold connections.
  The console works without them (REST only).
- **BullMQ workers / reminders** (`src/worker.ts`) — run it as a separate long-lived process
  (Railway, Render, Fly) with the same `MONGO_URI` and `REDIS_URL`.
- Function limits: 30 s max duration (`vercel.json`), ~4.5 MB request body.

## Check a deployment

```bash
curl https://<domain>/api/health          # status ok when Mongo and Redis are reachable
open https://<domain>/backoffice          # admin login
```

Local test of the same build: `node scripts/vercel-build.mjs`.
