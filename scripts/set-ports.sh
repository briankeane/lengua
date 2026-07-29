#!/bin/bash

set -euo pipefail

BASE_POSTGRES_PORT=5432
BASE_SERVER_PORT=10020
BASE_SERVER_DEBUG_PORT=9229
BASE_WORKER_PORT=10030
BASE_CLIENT_PORT=3000
BASE_CLIENT_HMR_PORT=3010

check_port() {
  local port=$1
  if lsof -i :"$port" >/dev/null 2>&1; then
    return 1
  fi
  return 0
}

check_all_ports() {
  local offset=$1
  local postgres_port=$((BASE_POSTGRES_PORT + offset))
  local server_port=$((BASE_SERVER_PORT + offset))
  local server_debug_port=$((BASE_SERVER_DEBUG_PORT + offset))
  local worker_port=$((BASE_WORKER_PORT + offset))
  local client_port=$((BASE_CLIENT_PORT + offset))
  local client_hmr_port=$((BASE_CLIENT_HMR_PORT + offset))

  check_port "$postgres_port" && \
  check_port "$server_port" && \
  check_port "$server_debug_port" && \
  check_port "$worker_port" && \
  check_port "$client_port" && \
  check_port "$client_hmr_port"
}

find_available_offset() {
  local offset=0
  local max_attempts=10

  for ((i=0; i<max_attempts; i++)); do
    if check_all_ports "$offset"; then
      echo "$offset"
      return 0
    fi
    offset=$((offset + 100))
  done

  echo "Error: Could not find available ports after $max_attempts attempts" >&2
  exit 1
}

update_env_var() {
  local file=$1
  local var=$2
  local value=$3

  if grep -q "^${var}=" "$file" 2>/dev/null; then
    sed -i '' "s|^${var}=.*|${var}=${value}|" "$file"
  else
    echo "${var}=${value}" >> "$file"
  fi
}

# Support Conductor workspace integration
if [ -n "${CONDUCTOR_PORT:-}" ]; then
  echo "Conductor workspace detected (base port: $CONDUCTOR_PORT)"
  CLIENT_PORT=$((CONDUCTOR_PORT))
  CLIENT_HMR_PORT=$((CONDUCTOR_PORT + 1))
  SERVER_PORT=$((CONDUCTOR_PORT + 2))
  SERVER_DEBUG_PORT=$((CONDUCTOR_PORT + 3))
  WORKER_PORT=$((CONDUCTOR_PORT + 4))
  POSTGRES_PORT=$((CONDUCTOR_PORT + 5))
  offset="conductor"
else
  # Read PORT_OFFSET from root .env if it exists, otherwise auto-detect
  touch .env
  if grep -q "^PORT_OFFSET=" .env 2>/dev/null; then
    offset=$(grep "^PORT_OFFSET=" .env | cut -d= -f2)
    echo "Using PORT_OFFSET=$offset from .env"
    if ! check_all_ports "$offset"; then
      echo "Ports at offset $offset are in use, finding available offset..."
      offset=$(find_available_offset)
      echo "Auto-detected available PORT_OFFSET=$offset"
    fi
  else
    offset=$(find_available_offset)
    echo "Auto-detected available PORT_OFFSET=$offset"
  fi

  POSTGRES_PORT=$((BASE_POSTGRES_PORT + offset))
  SERVER_PORT=$((BASE_SERVER_PORT + offset))
  SERVER_DEBUG_PORT=$((BASE_SERVER_DEBUG_PORT + offset))
  WORKER_PORT=$((BASE_WORKER_PORT + offset))
  CLIENT_PORT=$((BASE_CLIENT_PORT + offset))
  CLIENT_HMR_PORT=$((BASE_CLIENT_HMR_PORT + offset))
fi

# Derive a project name from the directory name
PROJECT_NAME=$(basename "$(pwd)")

# Update root .env for docker compose
update_env_var ".env" "COMPOSE_PROJECT_NAME" "$PROJECT_NAME"
update_env_var ".env" "PORT_OFFSET" "$offset"
update_env_var ".env" "POSTGRES_PORT" "$POSTGRES_PORT"
update_env_var ".env" "SERVER_PORT" "$SERVER_PORT"
update_env_var ".env" "SERVER_DEBUG_PORT" "$SERVER_DEBUG_PORT"
update_env_var ".env" "WORKER_PORT" "$WORKER_PORT"
update_env_var ".env" "CLIENT_PORT" "$CLIENT_PORT"
update_env_var ".env" "CLIENT_HMR_PORT" "$CLIENT_HMR_PORT"

# Update server/.env (PORT is the host-mapped port for external access)
if [ -f "server/.env" ]; then
  update_env_var "server/.env" "PORT" "$SERVER_PORT"
fi

# Update client/.env
if [ -f "client/.env" ]; then
  update_env_var "client/.env" "VITE_CLIENT_BASE_URL" "http://localhost:$CLIENT_PORT"
  update_env_var "client/.env" "VITE_SERVER_BASE_URL" "http://localhost:$SERVER_PORT"
  update_env_var "client/.env" "VITE_HMR_PORT" "$CLIENT_HMR_PORT"
fi

if [ "$offset" = "conductor" ]; then
  echo "Using Conductor-assigned ports"
elif [ "$offset" -eq 0 ]; then
  echo "Using default ports (offset 0)"
else
  echo "Using offset +$offset"
fi

echo "  PostgreSQL: $POSTGRES_PORT"
echo "  Server:     $SERVER_PORT (debug: $SERVER_DEBUG_PORT)"
echo "  Worker:     $WORKER_PORT"
echo "  Client:     $CLIENT_PORT (HMR: $CLIENT_HMR_PORT)"
