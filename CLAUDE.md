## Project Structure

Monorepo with two components:

- **Server**: Node.js 22.15.0 backend, TypeScript, Express 5, Sequelize ORM, PostgreSQL
- **Client**: React frontend with Vite

Docker Compose for orchestration. All cross-project commands are in the root `Makefile`.

## Task-Type Quick Reference

| Task Type                  | Read This                |
| -------------------------- | ------------------------ |
| Creating a database model  | `/create-model` skill    |
| Creating library functions | `/create-lib` skill      |
| Creating an API endpoint   | `/create-endpoint` skill |
| Creating a client feature  | `/create-feature` skill  |
| Debugging flaky tests      | `/diagnose-flaky` skill  |

## Codebase Map

### Server (`/server/src/`)

- `api/` — REST endpoints (one dir per module: `index.ts`, `[module].api.ts`, `[module].api.test.ts`, `[module].api.docs.yaml`)
- `api/routes.ts` — Central route mounting
- `api/security.ts` — Auth middleware (JWT, Basic Auth, role checks)
- `api/validation.ts` — Request validation middleware
- `db/models/` — Sequelize models (one dir per model)
- `db/migrations/` — Database migrations
- `lib/` — Business logic (`index.ts`, `[module].lib.ts`, `[module].lib.test.ts`)
- `utils/errors.ts` — Error classes (NotFoundError, AuthenticationError, ValidationError, etc.)
- `utils/jwt.ts` — JWT token generation
- `test/testDataGenerator.ts` — Factory functions for test data
- `middleware/errorHandler.ts` — Express error handler

### Client (`/client/src/`)

- `Components/` — Reusable React components (Navbar, etc.)
- `Contexts/` — React context providers (`AuthProvider`, `authContext`, `useAuth` hook)
- `Pages/` — Page components (one dir per page: `LoginPage/`, `SignupPage/`, `DashboardPage/`)
- `Routes/` — Router config (`AppRoutes.tsx`, `ProtectedRoute.tsx`)
- `Services/` — API client layer (`apiClient.ts`, `authService.ts`, `userService.ts`)
- `test/` — Test setup and helpers
- `App.tsx` — Root component (layout shell with `<Outlet />`)
- `main.tsx` — Entry point

## Development Commands

All commands run via `make` from the project root. These execute inside Docker containers.

### Essential Commands

- `make prettier-all` — **Run before every push** to format all files
- `make test-server` — Run server tests
- `make lint-server` — Run server linter
- `make build-server` — Build TypeScript to dist/
- `make build-and-test-server` — Build then test
- `make test-client` — Run client tests
- `make lint-client` — Run client linter
- `make prettier-server` — Format server files only
- `make prettier-client` — Format client files only

### Database Commands

- `make migrate` — Run pending migrations
- `make migrate-all` — Run migrations for dev and test DBs
- `make generate-migration NAME=migration-name` — Create a new migration

### Docker Commands

- `make install` — Initial setup (copy env files, set ports, build containers)
- `make launch` — Start all services
- `make launch-detached` — Start all services in background
- `make terminate` — Stop all services
- `make logs` — Tail all logs
- `make logs-server` — Tail server logs

## Before Pushing

Always run:

```
make prettier-all
```

## Code Style Guide

### TypeScript Best Practices

- **All new files must be TypeScript** — no new `.js` files
- Use type inference where context makes types obvious
- Explicitly annotate function parameters and return types
- Import proper types instead of using `any`
- Document why code exists, not what it does

### Model Enum Pattern

Define enum constants in the model file as the single source of truth:

```typescript
export const USER_ROLES = ['admin', 'user', 'guest'] as const;
export type UserRole = (typeof USER_ROLES)[number];
```

Use in routes for validation:

```typescript
import { USER_ROLES } from '../../db/models/user.model';
import { checkBodyEnum } from '../validation';

router.put('/:id/role', checkBodyEnum('role', USER_ROLES), controller.updateRole);
```

## Testing Strategy

### Server Testing

- Mocha + Chai for test framework with co-located `.test.ts` files
- Integration tests for API endpoints using Supertest
- HTTP mocking with Nock for external API calls
- Function mocking with Sinon
- Factory functions in `test/testDataGenerator.ts`
- Tests clear the database between runs (`afterEach`)

### Client Testing

- Vitest with jsdom environment
- React Testing Library for component behavior testing

## Building New Endpoints (TDD)

Follow this exact procedure:

1. Write library tests in `/server/src/lib/[module]/[module].lib.test.ts`
2. See them fail (red)
3. Write library functions in `/server/src/lib/[module]/[module].lib.ts`
4. See them succeed (green)
5. Run `make build-server && make lint-server && make test-server`
6. Write integration tests in `/server/src/api/[module]/[module].api.test.ts`
7. See them fail (red)
8. Hook up routing and controller in `/server/src/api/[module]/`
9. See them succeed (green)
10. Run `make build-server && make lint-server && make test-server`
11. Add API documentation in `/server/src/api/[module]/[module].api.docs.yaml`
12. Run `make build-server` to compile documentation

**Important**: Implement one function at a time. Write tests for one function, implement it, verify, then move to the next.

## API Design

- RESTful endpoints with `/v1/` versioning
- Resource-based organization — no "summary" endpoints combining unrelated data
- JWT authentication via `authenticate` middleware in `security.ts`
- Validation via middleware from `validation.ts` (e.g., `checkBodyFor`, `checkBodyEnum`)
- Error handling via custom error classes thrown from lib layer

## Documentation Standards

- OpenAPI/Swagger YAML in `.api.docs.yaml` files
- Never use relative paths between YAML files
- Reference components as if all definitions are in a single file
- Use `$ref: '#/components/responses/400'` for common error responses

## Docker & Multi-Instance Support

- `COMPOSE_PROJECT_NAME` in root `.env` handles container naming — never use hardcoded `container_name` in `docker-compose.yaml`
- Port variables (`POSTGRES_PORT`, `SERVER_PORT`, etc.) in root `.env` enable multiple instances

## Skill Routing

When the user's request matches an available skill, invoke it using the Skill tool as your FIRST action.

Key routing rules:

- Bugs, errors, "why is this broken" → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Design system, brand → invoke design-consultation
- Architecture review → invoke plan-eng-review
- Code quality, health check → invoke health
