#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Point-in-time backup of the live SQLite database.
#
# Why this exists: the accounts, subscriptions, plans and logged workouts all
# live in ONE file. A persistent disk protects it from deploys, but it does not
# protect it from a bad migration, a wrong DELETE, or disk corruption. This
# script is the cheap insurance: a consistent copy (never a raw `cp`, which can
# capture a half-written page), gzip-compressed, with automatic retention.
#
# Usage:
#   bash scripts/backup-db.sh                 # backup into $EF_DATA_DIR/backups
#   bash scripts/backup-db.sh /path/to/dir    # backup into a custom directory
#   EF_BACKUP_KEEP=30 bash scripts/backup-db.sh
#
# Schedule it as a Render Cron Job (daily) once the persistent disk is mounted.
# ---------------------------------------------------------------------------
set -euo pipefail

DATA_DIR="${EF_DATA_DIR:-$(cd "$(dirname "$0")/.." && pwd)/data}"
DB_PATH="$DATA_DIR/elforma.db"
OUT_DIR="${1:-$DATA_DIR/backups}"
KEEP="${EF_BACKUP_KEEP:-14}"

if [ ! -f "$DB_PATH" ]; then
  echo "FAIL: no database at $DB_PATH (is EF_DATA_DIR set correctly?)" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="$OUT_DIR/elforma-$STAMP.db"

# A consistent snapshot. `sqlite3 .backup` is the correct way (it respects WAL
# and in-flight writes); Node's built-in driver is the fallback when the sqlite3
# CLI is not installed on the host.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" ".backup '$TARGET'"
else
  node -e "
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(process.argv[1], { readOnly: true });
    db.exec(\"VACUUM INTO '\" + process.argv[2] + \"'\");
    db.close();
  " "$DB_PATH" "$TARGET"
fi

gzip -f "$TARGET"
echo "Backup written: $TARGET.gz ($(du -h "$TARGET.gz" | cut -f1))"

# Integrity gate: a backup that cannot be read is not a backup.
TMP_CHECK="$(mktemp -u)".db
gunzip -c "$TARGET.gz" > "$TMP_CHECK"
if command -v sqlite3 >/dev/null 2>&1; then
  RESULT="$(sqlite3 "$TMP_CHECK" 'PRAGMA integrity_check;' | head -1)"
else
  RESULT="$(node -e "
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(process.argv[1], { readOnly: true });
    console.log(db.prepare('PRAGMA integrity_check').get()['integrity_check']);
    db.close();
  " "$TMP_CHECK")"
fi
rm -f "$TMP_CHECK"
if [ "$RESULT" != "ok" ]; then
  echo "FAIL: backup failed its integrity check ($RESULT)" >&2
  exit 1
fi
echo "Verified: integrity_check = ok"

# Retention: keep the newest $KEEP archives, delete older ones.
COUNT="$(ls -1t "$OUT_DIR"/elforma-*.db.gz 2>/dev/null | wc -l | tr -d ' ')"
if [ "$COUNT" -gt "$KEEP" ]; then
  ls -1t "$OUT_DIR"/elforma-*.db.gz | tail -n +$((KEEP + 1)) | while read -r old; do
    rm -f "$old"
    echo "Pruned old backup: $(basename "$old")"
  done
fi
echo "Retention: keeping the newest $KEEP backups in $OUT_DIR"
