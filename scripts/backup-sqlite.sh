#!/usr/bin/env sh
set -eu

COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.yml}"
SERVICE="${SERVICE:-api}"
DATABASE_PATH="${DATABASE_PATH:-/data/app.db}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
SQLITE_FILE="${BACKUP_DIR}/pipiseries-${STAMP}.sqlite"
ARCHIVE_FILE="${SQLITE_FILE}.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "Creando backup SQLite en ${SQLITE_FILE}..."
docker compose ${COMPOSE_FILES} exec -T "$SERVICE" node --experimental-sqlite -e "
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(process.env.DATABASE_PATH || '${DATABASE_PATH}');
  db.exec(\"VACUUM INTO '/tmp/pipiseries-backup.sqlite'\");
  db.close();
"

docker compose ${COMPOSE_FILES} cp "${SERVICE}:/tmp/pipiseries-backup.sqlite" "$SQLITE_FILE"
docker compose ${COMPOSE_FILES} exec -T "$SERVICE" rm -f /tmp/pipiseries-backup.sqlite

tar -czf "$ARCHIVE_FILE" "$SQLITE_FILE"

echo "Backup listo:"
echo "- ${SQLITE_FILE}"
echo "- ${ARCHIVE_FILE}"
