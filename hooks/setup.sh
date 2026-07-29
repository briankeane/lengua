#!/bin/bash

set -euo pipefail

if [ ! -f "docker-compose.yaml" ] && [ ! -f "docker-compose.yml" ]; then
  echo "Error: run this script from the project root (docker-compose file not found)."
  exit 1
fi

if [ ! -d ".git" ]; then
  echo "Error: this directory is not a git repository."
  exit 1
fi

mkdir -p .git/hooks
cp hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

echo "Pre-commit hook installed. It relies on running Docker containers to format staged client/server files via Prettier."
