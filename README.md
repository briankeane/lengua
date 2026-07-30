# lengua

A production-ready full-stack TypeScript starter with authentication, protected routes, and AI-assisted development built in.

## What's Included

### Authentication (ready to use)

- **Server**: `POST /v1/auth/signup`, `/login`, `/google` endpoints returning `{ user, token }`
- **Client**: Login/signup pages, protected routes, AuthContext, JWT token management
- **Security**: Password hashing (bcrypt), JWT authentication, role-based access control

### Server

- Express 5 with TypeScript
- PostgreSQL with Sequelize ORM and migrations
- OpenAPI 3.0 documentation (ReDoc + Swagger)
- BullMQ background worker with cron scheduling (optional Redis)
- Mocha + Chai + Supertest integration tests

### Client

- React 18 with Vite and TypeScript
- React Router with protected routes
- Axios API service layer with JWT interceptor
- Vitest + React Testing Library

### Infrastructure

- Docker Compose for local development
- Automatic port management (multiple instances supported)
- Render for production hosting (single environment, deploy on push to `main`)
- GitHub Actions CI/CD pipeline (lint, test, build image, deploy to Render)
- Claude Code skills for AI-assisted development

## Quick Start

```bash
git clone <repository-url>
cd node-react-scaffold

# Optional: rename the project
./scripts/init-project.sh

# Install and launch
make install
make launch
```

`make install` copies env files, finds open ports, and builds Docker images.

Once running:

- Frontend: http://localhost:3000
- Backend API: http://localhost:10020
- API docs: http://localhost:10020/docs

## Optional Features

### Redis & BullMQ Job Queues

Background job processing is included but Redis is disabled by default.

1. Uncomment the `redis` service in `docker-compose.yaml`
2. Uncomment `REDIS_URL=redis://redis:6379` in `server/.env`
3. `make restart`

### Google OAuth

The `/v1/auth/google` endpoint is wired up. To enable it:

1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Add `GOOGLE_CLIENT_ID` to `server/.env`
3. Add the Google sign-in button to your login page

### Metrics & Monitoring

The worker service supports cron-based jobs out of the box. Add monitoring by:

1. Adding a health check endpoint for your monitoring service
2. Configuring alerts on the `/v1/health-check` endpoint

## Prerequisites

- Docker and Docker Compose
- Node.js 22.15.0 and npm 10.9.2 (matches Docker images; consider using nvm)

## Port Management

The project uses `PORT_OFFSET` (in `.env`) to avoid port conflicts when running multiple instances. Each instance offsets all ports by this value (in increments of 100). Run `make find-open-ports` to auto-detect an available offset.

| Service      | Base Port | With PORT_OFFSET=100 |
| ------------ | --------- | -------------------- |
| Client       | 3000      | 3100                 |
| Client HMR   | 3010      | 3110                 |
| Server       | 10020     | 10120                |
| Server Debug | 9229      | 9329                 |
| PostgreSQL   | 5432      | 5532                 |
| Worker       | 10030     | 10130                |

## Environment Files

| File               | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| `.env`             | Root config (COMPOSE_PROJECT_NAME, PORT_OFFSET)  |
| `server/.env`      | Server runtime config (JWT_SECRET, DATABASE_URL) |
| `server/.env-test` | Test database config (auto-created)              |
| `client/.env`      | Client config (API base URL)                     |

## Claude Code Skills

This project includes [Claude Code](https://claude.ai/claude-code) skills for AI-assisted development:

| Command            | Description                                                               |
| ------------------ | ------------------------------------------------------------------------- |
| `/create-model`    | Create a Sequelize model with migration, types, and tests (TDD)           |
| `/create-endpoint` | Create a REST API endpoint with integration tests and OpenAPI docs        |
| `/create-lib`      | Create library functions with TDD, one function at a time                 |
| `/create-feature`  | Create a client feature (service + context + page + route)                |
| `/diagnose-flaky`  | Step-by-step flaky test diagnosis                                         |
| `/deploy`          | Interactive deployment setup (Render, Cloudflare, CircleCI, Google OAuth) |

Skills live in `.claude/skills/` and teach Claude the project's conventions so it generates code that matches existing patterns.

## Make Targets

### Core

| Target                 | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `make install`         | Set up env files, find ports, build Docker images |
| `make launch`          | Start all services (foreground)                   |
| `make launch-detached` | Start all services (background)                   |
| `make terminate`       | Stop all services                                 |
| `make restart`         | Stop and restart all services                     |

### Testing

| Target                                 | Description                       |
| -------------------------------------- | --------------------------------- |
| `make test-server`                     | Run all server tests              |
| `make test-server-file GREP="pattern"` | Run tests matching a grep pattern |
| `make test-client`                     | Run client tests                  |

### Code Quality

| Target              | Description                           |
| ------------------- | ------------------------------------- |
| `make lint-server`  | Lint server (ESLint + Prettier check) |
| `make lint-client`  | Lint client                           |
| `make prettier-all` | Auto-format everything                |

### Build & Database

| Target                                   | Description                               |
| ---------------------------------------- | ----------------------------------------- |
| `make build-server`                      | Compile TypeScript                        |
| `make build-client`                      | Build production client bundle            |
| `make migrate`                           | Run database migrations                   |
| `make migrate-all`                       | Run migrations for dev and test databases |
| `make generate-migration NAME=add-table` | Generate a new migration file             |

### Logs

| Target             | Description               |
| ------------------ | ------------------------- |
| `make logs`        | Follow all container logs |
| `make logs-server` | Follow server logs        |
| `make logs-client` | Follow client logs        |

## Project Structure

```
├── .claude/
│   └── skills/              # Claude Code skills
├── .circleci/
│   └── config.yml           # CI/CD pipeline
├── client/
│   └── src/
│       ├── Components/      # Reusable React components
│       ├── Contexts/        # React context providers (AuthContext)
│       ├── Pages/           # Page components (Login, Signup, Dashboard)
│       ├── Routes/          # React Router config, ProtectedRoute
│       ├── Services/        # API client services (authService, apiClient)
│       └── test/            # Test setup and helpers
├── scripts/
│   ├── init-project.sh      # Project renaming script
│   └── set-ports.sh         # Port auto-detection
├── server/
│   └── src/
│       ├── api/             # REST endpoints (auth, healthCheck)
│       ├── config/          # Environment and app configuration
│       ├── db/              # Sequelize models, migrations
│       ├── docs/            # OpenAPI/Swagger setup
│       ├── lib/             # Business logic libraries
│       ├── middleware/       # Express middleware (error handler)
│       ├── queue/           # BullMQ queue infrastructure (optional Redis)
│       └── test/            # Test setup, helpers, data generators
├── docker-compose.yaml
├── Makefile
└── README.md
```

## API Documentation

Available at:

- `/docs` — Interactive ReDoc UI
- `/swagger.json` — Raw OpenAPI spec

Each endpoint module has a co-located `.api.docs.yaml` file. See `server/src/api/auth/` for the reference pattern.

## Deploying to Render

### Overview

Hosting is on [Render](https://render.com). There is **one environment (production)
and one branch (`main`)** — every push to `main` builds a Docker image, pushes it to
GitHub Container Registry (GHCR), and deploys it straight to production. There is no
staging environment yet.

The deploy is driven by GitHub Actions (`.github/workflows/deploy-production.yml`),
not by Render building from git — the Render services are `runtime: image` and only
*pull* the tag.

**Pipeline flow (push to `main`):**

1. Lint + test (server and client)
2. Build `server/Dockerfile.production`, push `ghcr.io/briankeane/lengua:production`
   and an immutable `:<git-sha>` tag
3. Call the Render API to deploy `production-server` **pinned to the `:<git-sha>`
   image** (deterministic — can't race another push), poll until it's `live`
4. Same for `production-worker` (also polled to `live`)

If `RENDER_API_KEY` is not configured as a GitHub secret, the deploy jobs are skipped
automatically (lint/test still run), so the pipeline is safe before Render exists.

### Initial Render Setup (order matters)

The Blueprint references the `:production` image tag, and Render verifies image access
when it creates image-backed services — so the image and its pull access must exist
**before** the first Blueprint sync.

1. **Push `main` once** so the workflow builds and pushes the first
   `ghcr.io/briankeane/lengua:production` image. The build authenticates to GHCR with
   the built-in `GITHUB_TOKEN` (no personal PAT required), and always runs on `main`;
   the Render deploy step skips itself until `RENDER_API_KEY` exists.
2. **Give Render pull access to the image** — either:
   - make the GHCR package **public** (GitHub → your profile → Packages → `lengua` →
     Package settings → Change visibility → Public), **or**
   - create a Render **registry credential** for GHCR (Render → Account Settings →
     Registry Credentials) and attach it to the image services when creating them.
3. **Create the `lengua-production` env var group** in the Render dashboard with:
   - `JWT_SECRET` — a strong secret
   - (add `REDIS_URL` later if/when you enable the BullMQ queue)

   `DATABASE_URL`, `NODE_ENV`, and `PORT` are **not** set here — the Blueprint wires
   `DATABASE_URL` from the managed database and sets `NODE_ENV`/`PORT` inline.
4. **Create the Blueprint** — Render Dashboard → **Blueprints** → **New Blueprint
   Instance** → connect this repo and select `render.yaml`. Render provisions the
   `lengua-db` Postgres, `production-server`, and `production-worker`. (If the image
   is private, select the registry credential when prompted.)
5. **Note the two service IDs** (the `srv-xxxxx` value in each service's Settings URL).
6. **Add the Render deploy secrets** to GitHub (Settings → Secrets → Actions):
   - `RENDER_API_KEY` — from Render Account Settings → API Keys
   - `RENDER_PRODUCTION_SERVICE_ID` — the `production-server` service ID
   - `RENDER_PRODUCTION_WORKER_SERVICE_ID` — the `production-worker` service ID

### Deploying to Production

Merge a PR into `main` (or push to `main`). The workflow builds, pushes, and triggers
the Render deploy end to end. On each deploy Render runs the `preDeployCommand`
(`predeployMigrate.js` on the web service — validate env, then run migrations) before
cutting traffic to the new container, and the `/v1/healthCheck` health check gates the
rollout. A failed migration fails the deploy closed, so traffic never moves to an
un-migrated schema.

### Rollback

Each deploy also pushed a `:<git-sha>` image tag. To roll back, redeploy a previous
image from the Render dashboard (Deploys → pick an earlier deploy → Redeploy), or
re-point the service at an older `:<git-sha>` tag.

### Custom Domain Setup

The API is served at **`api.lengua-app.com`** (the client is deployed separately on
Netlify at `www.lengua-app.com`). `api.lengua-app.com` is declared in `render.yaml`
(`domains:` on `production-server`), so Render provisions the TLS certificate on
Blueprint sync and shows the DNS target it wants.

1. **Confirm the domain in Render** — `production-server` → **Settings → Custom
   Domains** lists `api.lengua-app.com` (from the Blueprint) with its verification/DNS
   target.

2. **Create a CNAME record** with your DNS provider:

   | Subdomain | Type  | Target                             |
   | --------- | ----- | ---------------------------------- |
   | `api`     | CNAME | `production-server.onrender.com` (use the exact target Render shows) |

3. **Wait for DNS propagation** and verify the domain is active in Render's Custom
   Domains panel.

4. **CORS** — the API must allow the client origin `https://www.lengua-app.com`. The
   scaffold currently sends `Access-Control-Allow-Origin: *`; lock it to the client
   origin before going live (see `server/src/server.ts`).

> **Cloudflare users:** CNAME records **must** be set to **DNS only** (grey cloud icon), not Proxied (orange cloud). Proxied mode causes **Cloudflare Error 1000** ("DNS points to prohibited IP") because Render's origin IPs are on Cloudflare's network. Render handles TLS automatically, so Cloudflare's proxy is not needed.

### Production Docker Image

To build the production image locally for testing:

```bash
cd server
docker build -f Dockerfile.production -t myapp:local .
docker run -p 10020:10020 --env-file .env myapp:local
```

## Client Deployment (Netlify)

### netlify.toml

The scaffold includes a `netlify.toml` in the repo root that configures the build: base directory `client/`, build command `npm run build`, publish directory `dist`, and a SPA catch-all redirect. This is picked up automatically by Netlify.

### Create Netlify Sites

Two sites are needed — staging and production. Run these commands from the project root after logging in with `npx netlify login`:

```bash
npx netlify sites:create --name <project>-staging --account-slug <your-account-slug>
npx netlify sites:create --name <project>-production --account-slug <your-account-slug>
```

> **Note:** To find your account slug, run `npx netlify api listAccountsForUser` and look for the `slug` field (it may differ from the team display name).

### Create a Netlify Personal Access Token

Go to https://app.netlify.com/user/applications#personal-access-tokens and create a token for CI use.

### GitHub Secrets

Add these three secrets to the GitHub repo (Settings → Secrets → Actions):

| Secret                       | Value                                              |
| ---------------------------- | -------------------------------------------------- |
| `NETLIFY_AUTH_TOKEN`         | The personal access token from the previous step   |
| `NETLIFY_STAGING_SITE_ID`   | The Project ID printed when creating the staging site    |
| `NETLIFY_PRODUCTION_SITE_ID`| The Project ID printed when creating the production site |

### Custom Domains (Optional)

To add custom domains, update the site via the Netlify dashboard (Domain Management → Add custom domain) or via API:

```bash
curl -X PUT "https://api.netlify.com/api/v1/sites/<site-id>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"custom_domain": "staging.example.com"}'
```

Then add a CNAME record with your DNS provider pointing to `<site-name>.netlify.app`.

> **Cloudflare users:** Set the CNAME record to **DNS only** (grey cloud, not proxied) — proxied mode causes **Cloudflare Error 1000**.

### How It Works

The `deploy-staging.yml` and `deploy-production.yml` GitHub Actions workflows include a `deploy-client-to-netlify` job that builds the client and deploys via `npx netlify deploy --dir=dist --prod`. Staging deploys on push to `develop`, production deploys on push to `main`.

## Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Run `make prettier-all && make lint-server && make test-server` before pushing
4. Submit a pull request to `develop`

## License

ISC License
