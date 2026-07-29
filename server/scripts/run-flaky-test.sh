#!/bin/bash

set -euo pipefail

ITERATIONS=10
GREP=""

while getopts "n:g:" opt; do
  case $opt in
    n) ITERATIONS="$OPTARG" ;;
    g) GREP="$OPTARG" ;;
    *) echo "Usage: $0 -n <iterations> -g <grep pattern>" && exit 1 ;;
  esac
done

if [ -z "$GREP" ]; then
  echo "Error: -g <grep pattern> is required"
  echo "Usage: $0 -n <iterations> -g <grep pattern>"
  exit 1
fi

echo "Running test '$GREP' up to $ITERATIONS times..."
echo ""

for i in $(seq 1 "$ITERATIONS"); do
  echo "--- Iteration $i/$ITERATIONS ---"
  if ! npx env-cmd -f .env-test ts-node -r tsconfig-paths/register node_modules/.bin/mocha \
    "./src/{,!(node_modules)/**}/*.test.ts" \
    --require source-map-support/register \
    --recursive --exit \
    --grep "$GREP" 2>&1; then
    echo ""
    echo "FAILED on iteration $i"
    exit 1
  fi
done

echo ""
echo "All $ITERATIONS iterations passed."
