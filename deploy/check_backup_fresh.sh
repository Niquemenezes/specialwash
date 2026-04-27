#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_DIR="/root/specialwash/backend/instance/backups/auto"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-36}"
STATUS_FILE="${BACKUP_DIR}/LAST_BACKUP_STATUS.txt"

mkdir -p "$BACKUP_DIR"

latest_backup="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'specialwash-auto-*.db' | sort | tail -n 1)"

if [[ -z "${latest_backup:-}" ]]; then
  msg="ERROR: no backup files found in $BACKUP_DIR"
  echo "$msg" | tee "$STATUS_FILE" >&2
  exit 1
fi

latest_sha="${latest_backup}.sha256"
if [[ ! -f "$latest_sha" ]]; then
  msg="ERROR: checksum file missing for $(basename "$latest_backup")"
  echo "$msg" | tee "$STATUS_FILE" >&2
  exit 1
fi

backup_mtime="$(stat -c %Y "$latest_backup")"
now_ts="$(date +%s)"
age_hours="$(( (now_ts - backup_mtime) / 3600 ))"

if (( age_hours > MAX_AGE_HOURS )); then
  msg="ERROR: latest backup $(basename "$latest_backup") is too old (${age_hours}h)"
  echo "$msg" | tee "$STATUS_FILE" >&2
  exit 1
fi

msg="OK: latest backup $(basename "$latest_backup") age=${age_hours}h"
echo "$msg" | tee "$STATUS_FILE"
