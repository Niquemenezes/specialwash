#!/usr/bin/env bash
set -Eeuo pipefail

DB_PATH="/root/specialwash/backend/instance/specialwash.db"
BACKUP_DIR="/root/specialwash/backend/instance/backups/auto"
KEEP_DAILY="${KEEP_DAILY:-60}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TMP_PATH="${BACKUP_DIR}/.specialwash-auto-${STAMP}.db.tmp"
FINAL_PATH="${BACKUP_DIR}/specialwash-auto-${STAMP}.db"
CHECKSUM_PATH="${FINAL_PATH}.sha256"
LOCK_FILE="/tmp/specialwash-backup.lock"

mkdir -p "$BACKUP_DIR"

if [[ ! -f "$DB_PATH" ]]; then
  echo "ERROR: database not found at $DB_PATH" >&2
  exit 1
fi

cleanup() {
  rm -f "$TMP_PATH"
}
trap cleanup EXIT

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "ERROR: another backup is already running" >&2
  exit 1
fi

sqlite3 "$DB_PATH" ".backup '$TMP_PATH'"

if [[ ! -s "$TMP_PATH" ]]; then
  echo "ERROR: backup file is empty: $TMP_PATH" >&2
  exit 1
fi

mv "$TMP_PATH" "$FINAL_PATH"
sha256sum "$FINAL_PATH" > "$CHECKSUM_PATH"

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'specialwash-auto-*.db' | sort | head -n -"${KEEP_DAILY}" 2>/dev/null | xargs -r rm -f
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'specialwash-auto-*.db.sha256' | sort | head -n -"${KEEP_DAILY}" 2>/dev/null | xargs -r rm -f

echo "Backup OK: $(basename "$FINAL_PATH") ($(du -h "$FINAL_PATH" | cut -f1))"
