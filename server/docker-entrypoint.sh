#!/bin/sh
set -e

case "${1:-web}" in
  web)     exec node dist/server.js ;;
  worker)  exec node dist/worker.js ;;
  release) node dist/scripts/checkEnv.js && exec npx sequelize-cli --options-path=.sequelizerc db:migrate ;;
  *)       exec "$@" ;;
esac
