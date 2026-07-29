COMPOSE := docker compose

find-open-ports:
	./scripts/set-ports.sh

install:
	[ -f ./.env ] || cp ./.env-example ./.env
	[ -f ./server/.env ] || cp ./server/.env-example ./server/.env
	[ -f ./client/.env ] || cp ./client/.env-example ./client/.env
	./scripts/set-ports.sh
	$(COMPOSE) build

launch:
	$(COMPOSE) up

launch-detached:
	$(COMPOSE) up -d

terminate:
	$(COMPOSE) down

restart:
	$(COMPOSE) down
	$(COMPOSE) up

logs:
	$(COMPOSE) logs -f

logs-server:
	$(COMPOSE) logs -f server

logs-client:
	$(COMPOSE) logs -f client

logs-worker:
	$(COMPOSE) logs -f worker

test-server:
	$(COMPOSE) exec server npm run test

test-server-file:
	$(COMPOSE) exec server npx env-cmd -f .env-test ts-node -r tsconfig-paths/register node_modules/.bin/mocha "./src/{,!(node_modules)/**}/*.test.ts" --require source-map-support/register --recursive --exit --grep "$(GREP)"

test-server-with-logging:
	$(COMPOSE) exec -e LOGGING_LEVEL=verbose server npm run test

test-server-debug:
	$(COMPOSE) exec server npm run test:debug

test-client:
	$(COMPOSE) exec client npm run test

lint-server:
	$(COMPOSE) exec server npm run lint

lint-client:
	$(COMPOSE) exec client npm run lint

prettier-server:
	$(COMPOSE) exec server npm run prettier:write

prettier-client:
	$(COMPOSE) exec client npm run prettier:write

prettier-all:
	$(MAKE) prettier-server
	$(MAKE) prettier-client

build-server:
	$(COMPOSE) exec server npm run build-ts

build-client:
	$(COMPOSE) exec client npm run build

build-and-test-server:
	$(COMPOSE) exec server npm run build-ts
	$(COMPOSE) exec server npm run test

migrate:
	$(COMPOSE) exec server npm run migrate

migrate-all:
	$(COMPOSE) exec server npm run migrate:all

generate-migration:
	$(COMPOSE) exec server sequelize migration:generate --name=$(NAME)
	cp ./server/dist/db/migrations/* ./server/src/db/migrations

worker-debug:
	$(COMPOSE) exec server npm run worker:debug

create-release-pr:
	./scripts/release.sh

.PHONY: find-open-ports install launch launch-detached terminate restart logs logs-server logs-client \
	test-server test-server-file test-server-with-logging test-server-debug test-client \
	lint-server lint-client prettier-server prettier-client \
	prettier-all build-server build-client build-and-test-server migrate migrate-all \
	generate-migration worker-debug create-release-pr
