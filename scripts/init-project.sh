#!/bin/bash

set -euo pipefail

SCAFFOLD_NAME="node-react-scaffold"

echo "=== Project Initializer ==="
echo ""

# Prompt for project name
read -rp "Project name (kebab-case, e.g. my-cool-app): " PROJECT_NAME

if [ -z "$PROJECT_NAME" ]; then
  echo "Error: Project name cannot be empty" >&2
  exit 1
fi

# Validate kebab-case
if ! echo "$PROJECT_NAME" | grep -qE '^[a-z][a-z0-9-]*$'; then
  echo "Error: Project name must be kebab-case (lowercase letters, numbers, hyphens)" >&2
  exit 1
fi

echo ""
echo "Renaming project from '$SCAFFOLD_NAME' to '$PROJECT_NAME'..."

# Root package.json
sed -i '' "s/\"name\": \"$SCAFFOLD_NAME\"/\"name\": \"$PROJECT_NAME\"/" package.json

# README title
sed -i '' "s/^# Node\/React Scaffold/# $PROJECT_NAME/" README.md

# COMPOSE_PROJECT_NAME in .env-example (used on first install)
if [ -f .env-example ]; then
  sed -i '' "s/COMPOSE_PROJECT_NAME=.*/COMPOSE_PROJECT_NAME=$PROJECT_NAME/" .env-example
fi

# COMPOSE_PROJECT_NAME in .env (if already created)
if [ -f .env ]; then
  sed -i '' "s/COMPOSE_PROJECT_NAME=.*/COMPOSE_PROJECT_NAME=$PROJECT_NAME/" .env
fi

# API docs title
DOCS_FILE="server/src/docs/index.ts"
if [ -f "$DOCS_FILE" ]; then
  sed -i '' "s/title: \"API Documentation\"/title: \"$PROJECT_NAME API\"/" "$DOCS_FILE"
fi

echo ""
echo "Done! Updated:"
echo "  - package.json (name)"
echo "  - README.md (title)"
echo "  - .env / .env-example (COMPOSE_PROJECT_NAME)"
echo "  - server/src/docs/index.ts (API title)"
echo ""
echo "Next steps:"
echo "  1. make install"
echo "  2. make launch"
echo "  3. Open http://localhost:3000"
