#!/usr/bin/env bash
# ==============================================================
#  db-backup.sh — PostgreSQL + MongoDB → Cloudflare R2
#  Usage: bash backup.sh [--dry-run]
#  Cron:  0 2 * * * /path/to/scripts/backup.sh >> /var/log/db-backup.log 2>&1
# ==============================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/backup.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[ERROR] backup.env not found at $ENV_FILE" >&2
  exit 1
fi
# shellcheck source=backup.env
source "$ENV_FILE"

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# ── Helpers ───────────────────────────────────────────────────
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
TMP_DIR="${BACKUP_TMP_DIR}/${TIMESTAMP}"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

log()  { echo "${LOG_PREFIX} $*"; }
err()  { echo "${LOG_PREFIX} [ERROR] $*" >&2; }
ok()   { echo "${LOG_PREFIX} [OK] $*"; }

cleanup() {
  log "Cleaning up temp dir: $TMP_DIR"
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# ── Validate required env vars ────────────────────────────────
required_vars=(
  POSTGRES_URL MONGO_URI
  R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY
  R2_BUCKET_NAME R2_ACCOUNT_ID R2_ENDPOINT
)
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" || "${!var}" == REPLACE_WITH* ]]; then
    err "Required variable \$$var is not set or still has placeholder value in backup.env"
    exit 1
  fi
done

# ── Check dependencies ────────────────────────────────────────
for cmd in pg_dump mongodump aws gzip tar; do
  if ! command -v "$cmd" &>/dev/null; then
    err "Required command '$cmd' not found. Please install it first."
    exit 1
  fi
done

mkdir -p "$TMP_DIR"
log "========================================================"
log " Starting database backup  (dry-run: $DRY_RUN)"
log "========================================================"

# ── PostgreSQL Backup ─────────────────────────────────────────
PG_DUMP_FILE="${TMP_DIR}/postgres_${TIMESTAMP}.sql.gz"
log "Dumping PostgreSQL → ${PG_DUMP_FILE}..."

if [[ "$DRY_RUN" == "false" ]]; then
  pg_dump "$POSTGRES_URL" \
    --no-owner \
    --no-acl \
    --format=plain \
    --compress=0 \
    | gzip > "$PG_DUMP_FILE"
  ok "PostgreSQL dump complete ($(du -sh "$PG_DUMP_FILE" | cut -f1))"
else
  log "[DRY-RUN] Would run: pg_dump $POSTGRES_URL | gzip > $PG_DUMP_FILE"
fi

# ── MongoDB Backup ────────────────────────────────────────────
MONGO_DUMP_DIR="${TMP_DIR}/mongo_dump"
MONGO_DUMP_FILE="${TMP_DIR}/mongodb_${TIMESTAMP}.tar.gz"
log "Dumping MongoDB → ${MONGO_DUMP_FILE}..."

if [[ "$DRY_RUN" == "false" ]]; then
  mongodump \
    --uri="$MONGO_URI" \
    --out="$MONGO_DUMP_DIR" \
    --quiet
  tar -czf "$MONGO_DUMP_FILE" -C "$TMP_DIR" "mongo_dump"
  rm -rf "$MONGO_DUMP_DIR"
  ok "MongoDB dump complete ($(du -sh "$MONGO_DUMP_FILE" | cut -f1))"
else
  log "[DRY-RUN] Would run: mongodump --uri=$MONGO_URI --out=$MONGO_DUMP_DIR"
fi

# ── Upload to Cloudflare R2 ───────────────────────────────────
upload_to_r2() {
  local file="$1"
  local dest="backups/$(basename "$file")"

  log "Uploading $(basename "$file") → r2://${R2_BUCKET_NAME}/${dest} ..."

  if [[ "$DRY_RUN" == "false" ]]; then
    AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    aws s3 cp "$file" "s3://${R2_BUCKET_NAME}/${dest}" \
      --endpoint-url "$R2_ENDPOINT" \
      --region auto \
      --no-progress
    ok "Uploaded: $dest"
  else
    log "[DRY-RUN] Would upload $file → s3://${R2_BUCKET_NAME}/${dest}"
  fi
}

upload_to_r2 "$PG_DUMP_FILE"
upload_to_r2 "$MONGO_DUMP_FILE"

# ── Retention — delete old backups from R2 ────────────────────
if [[ "${RETENTION_DAYS:-0}" -gt 0 ]]; then
  log "Applying retention policy: deleting backups older than ${RETENTION_DAYS} days..."
  CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null \
    || date -v "-${RETENTION_DAYS}d" +%Y-%m-%d)  # macOS fallback

  if [[ "$DRY_RUN" == "false" ]]; then
    AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    aws s3 ls "s3://${R2_BUCKET_NAME}/backups/" \
      --endpoint-url "$R2_ENDPOINT" \
      --region auto \
    | awk '{print $4}' \
    | while read -r key; do
        file_date=$(echo "$key" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1 || echo "")
        if [[ -n "$file_date" && "$file_date" < "$CUTOFF_DATE" ]]; then
          log "  Deleting old backup: backups/$key"
          AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
          AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
          aws s3 rm "s3://${R2_BUCKET_NAME}/backups/$key" \
            --endpoint-url "$R2_ENDPOINT" \
            --region auto
        fi
      done
  else
    log "[DRY-RUN] Would delete backups older than $CUTOFF_DATE from R2"
  fi
fi

log "========================================================"
ok "Backup complete at $(date)"
log "========================================================"
