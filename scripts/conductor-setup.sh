#!/usr/bin/env bash
set -euo pipefail

PORT="${CONDUCTOR_PORT:?This script must be run by Conductor (CONDUCTOR_PORT not set)}"
WORKSPACE="${CONDUCTOR_WORKSPACE_NAME:-conductor}"

echo "Setting up Conductor workspace: $WORKSPACE (base port: $PORT)"

# Copy .env files from examples if they don't exist
[ -f ./.env ] || cp ./.env-example ./.env
[ -f ./server/.env ] || cp ./server/.env-example ./server/.env
[ -f ./client/.env ] || cp ./client/.env-example ./client/.env

# Run port setup (detects CONDUCTOR_PORT automatically)
./scripts/set-ports.sh

# Build Docker images
docker compose build

# Start all services
docker compose up -d

echo ""
echo "Workspace ready! Port mapping:"
echo "  Server:   http://localhost:$((PORT + 2))"
echo "  Client:   http://localhost:${PORT}"
echo "  Postgres: localhost:$((PORT + 5))"
