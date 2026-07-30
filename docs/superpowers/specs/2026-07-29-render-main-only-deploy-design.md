# Deploy to Render (main-only) — Design

**Date:** 2026-07-29
**Status:** Approved — ready for implementation plan
**Repo:** `briankeane/lengua` (workspace: lengua/antananarivo)

## Goal

Deploy the server (web + worker) to Render. **One branch, one environment:** every
push to `main` builds a Docker image, pushes it to GHCR, and deploys it immediately
to **production**. No staging environment (may be added later).

## Background

The scaffold already ships a playola-style deploy pipeline wired for **two**
environments (`develop`→staging, `main`→production): `render.yaml` with four
services, `deploy-staging.yml`, `deploy-production.yml`, `create-release-pr.yml`,
plus `Dockerfile.production`, `docker-entrypoint.sh`, `checkEnv.ts`, a
`/v1/healthCheck` endpoint, and a `worker.ts`. The production workflow *promotes an
existing staging image* rather than building one — which cannot work in a main-only
flow (nothing builds the staging image first).

## Deploy topology

```
push main
  → CI: lint (server, client) + test (server, client)
  → build server/Dockerfile.production
  → push ghcr.io/briankeane/lengua:production  (+ :<git-sha> for rollback record)
  → POST Render API deploy production-server, poll until "live"
  → POST Render API deploy production-worker
```

Render services are `runtime: image` — they only *pull* the tag, never build.
`autoDeployTrigger: off` so deploys happen only when CI calls the Render API after a
verified image push. A GitHub Actions `concurrency` group serializes pushes to
`main` so two rapid merges can't race the mutable `:production` tag.

## Components

### 1. `render.yaml` (rewritten, production-only, flat top-level)

- **`databases:`** one managed Postgres. `plan: basic-256mb` (the legacy `starter`
  DB plan is no longer valid for new databases), `region: ohio`.
- **`production-server`** (`type: web`, `runtime: image`):
  - `image.url: ghcr.io/briankeane/lengua:production`
  - `dockerCommand: node dist/server.js` (image services use `dockerCommand`, **not**
    `startCommand`; the scaffold's `startCommand` was silently ignored, so the worker
    was booting as a web server)
  - `preDeployCommand: node dist/scripts/predeployMigrate.js`
  - `healthCheckPath: /v1/healthCheck`
  - `autoDeployTrigger: off`
  - `envVars:` `NODE_ENV=production`, `PORT=10020`, `DATABASE_URL` via `fromDatabase`
    (`property: connectionString`), `- fromGroup: lengua-production`
- **`production-worker`** (`type: worker`, `runtime: image`):
  - same image
  - `dockerCommand: node dist/worker.js`
  - `preDeployCommand: node dist/scripts/checkEnv.js` (env-validate only — the web
    service owns migrations so the two deploys don't run migrations concurrently)
  - `autoDeployTrigger: off`
  - same `envVars` (incl. `PORT=10020` — `checkEnv` requires `PORT`, and the worker
    runs `checkEnv`)

**Registry auth is NOT in `render.yaml`.** The exact private-registry Blueprint syntax
is error-prone and a wrong value fails the sync. Instead the runbook makes the GHCR
package public (simplest) or attaches a dashboard **registry credential** to the image
services. This keeps the Blueprint clean and sync-safe.

### 2. New file: `server/src/scripts/predeployMigrate.ts`

One Node process (Render runs `preDeployCommand` with **no shell**, so a
`checkEnv && migrate` chain silently skips the migrate):

1. `ensureRequiredEnvVars()` (reuse existing `checkEnv.ts`).
2. Run migrations via `execFileSync('./node_modules/.bin/sequelize', ['--options-path=.sequelizerc', 'db:migrate'], { stdio: 'inherit', cwd: <app root> })`.
   - Call the binary directly, **not** `npx` (avoids PATH/network surprises; `sequelize-cli`
     is in `dependencies`, so the binary exists in the `--omit=dev` production image).
   - Anchor `cwd` to the app root via `path.join(__dirname, '../..')` (compiled layout:
     `dist/scripts` → `/app`) so `.sequelizerc` and its `path.resolve('dist', ...)` config
     paths resolve.
3. Exit non-zero on failure → Render fails the deploy **closed** and never cuts traffic
   to an un-migrated schema.

`NODE_ENV=production` (set on the service) selects the SSL production DB config in
`dist/db/config.js`.

### 3. GitHub Actions

- **`deploy-production.yml`** (rewritten): on push to `main`, add
  `concurrency: { group: deploy-production, cancel-in-progress: false }`. Jobs:
  `build-and-test`, `lint-server`, `lint-client`, `test-client`, then
  `build-and-push-image` (build `server/Dockerfile.production`; push `:production`
  **and** `:${{ github.sha }}`), then `deploy-to-render` (existing API-trigger + poll
  job, unchanged). Delete the "promote staging → production" job.
- **Delete** `deploy-staging.yml` and `create-release-pr.yml` (both are develop→main
  artifacts).
- **`test.yml`**: trigger on `pull_request` targeting `main` (so PRs are checked before
  merge) plus push on feature branches.

The image path is hardcoded to `ghcr.io/briankeane/lengua` in both the
workflow and `render.yaml` so CI never pushes to one path while Render pulls another.
`GHCR_USERNAME` / `GHCR_TOKEN` are still used for `docker login`.

### 4. Secrets & env

**GitHub repo secrets:** `RENDER_API_KEY`, `RENDER_PRODUCTION_SERVICE_ID`,
`RENDER_PRODUCTION_WORKER_SERVICE_ID`, `GHCR_USERNAME` (`briankeane`), `GHCR_TOKEN`
(PAT with `write:packages`).

**Render `lengua-production` env group:** `JWT_SECRET` (add `REDIS_URL` later if/when Redis is
added). `DATABASE_URL` comes from `fromDatabase`; `NODE_ENV`/`PORT` are set inline in
`render.yaml`.

### 5. Runbook (Render dashboard, first-time — order matters)

Bootstrap order avoids the "Blueprint references a `:production` image that doesn't
exist yet" chicken-and-egg:

1. Create GitHub secrets `GHCR_USERNAME` + `GHCR_TOKEN`; push `main` once so CI builds
   and pushes the first `ghcr.io/briankeane/lengua:production` image.
   (Render deploy steps are skipped automatically until `RENDER_API_KEY` exists.)
2. Make the GHCR package **public** (Packages → package → Package settings → Change
   visibility), **or** create a Render **registry credential** for GHCR.
3. Create the Render workspace/project; create the `lengua-production` env group with
   `JWT_SECRET`.
4. Create a Blueprint from `render.yaml` → provisions the Postgres + both services.
   (If the image is private, select the registry credential when prompted.)
5. Copy the two service IDs; add `RENDER_API_KEY`, `RENDER_PRODUCTION_SERVICE_ID`,
   `RENDER_PRODUCTION_WORKER_SERVICE_ID` to GitHub secrets.
6. Push to `main` (or re-run the workflow) — CI now builds, pushes, and triggers the
   Render deploy end to end.

## Decisions & trade-offs

- **`dockerCommand: node dist/server.js` (full command), not `web`/`worker` tokens.**
  Codex suggested the bare entrypoint tokens would work via the entrypoint's `*)` case.
  Playola's production experience (captured in its own `render.yaml` comments) is that
  Render does not reliably pass the Docker Command as an arg to the image ENTRYPOINT, so
  bare tokens fail (exit 128). We use the full command — battle-tested.
- **Deploys are pinned to the immutable `:<git-sha>` tag** (Render API `imageUrl`
  param), not the mutable `:production` tag, so a deploy always ships the exact image
  built in that run and can't race another push. `:production` is still pushed as the
  Blueprint bootstrap default, and `concurrency` serializes the pipeline as
  belt-and-suspenders. Both web and worker deploys poll to `live` (including
  `pre_deploy_failed`, so a bad migration fails fast).
- **Worker may start before the web migration finishes on the very first Blueprint
  sync.** Acceptable: the worker only validates env and idles (no jobs/Redis yet).
- **`assertMigrationsApplied`** (playola's extra post-migrate assertion) is **not**
  ported — the `sequelize db:migrate` exit code already fails the deploy closed. Noted as
  optional future hardening.

## Out of scope

Staging environment, Redis/Key Value provisioning, client (frontend) deploy, custom
domains, autoscaling, digest-pinned rollbacks.
