#!/bin/bash
# ==========================================
# Database Deployment Script
# Uploads local 'backup.dump' to remote PostgreSQL
# Usage: ./deploy_db.sh <SERVER_IP>
# ==========================================

set -e  # Exit immediately if any command fails

# -------- Remote Configuration --------
REMOTE_SSH_USER="root"
REMOTE_DB_USER="zoru"
REMOTE_DB_NAME="adxwin_db"
REMOTE_DB_PASSWORD='Zoru@9828'
SSH_KEY_PATH="$HOME/Downloads/zoru"

# -------- Local Dump File --------
DUMP_FILE="backup.dump"

# -------- Checks --------
if [ ! -f "$DUMP_FILE" ]; then
    echo "❌ Error: $DUMP_FILE not found in current directory."
    exit 1
fi

if [ -z "$1" ]; then
    echo "❌ Error: Server IP is required."
    echo "Usage: ./deploy_db.sh <SERVER_IP>"
    exit 1
fi

SERVER_IP="$1"

echo "=========================================="
echo "🚀 Starting Database Migration to $SERVER_IP"
echo "=========================================="

# -------- Upload Dump --------
echo "📤 Uploading $DUMP_FILE to server..."
scp -i "$SSH_KEY_PATH" "$DUMP_FILE" "$REMOTE_SSH_USER@$SERVER_IP:/root/$DUMP_FILE"
echo "✅ Upload successful."

# -------- Restore Database --------
echo "📥 Restoring database on server..."

ssh -i "$SSH_KEY_PATH" "$REMOTE_SSH_USER@$SERVER_IP" << EOF
set -e

export PGPASSWORD='$REMOTE_DB_PASSWORD'

echo "➡️  Running pg_restore..."

pg_restore \
  -h localhost \
  -U $REMOTE_DB_USER \
  -d $REMOTE_DB_NAME \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  /root/$DUMP_FILE

echo "🧹 Cleaning up dump file..."
rm -f /root/$DUMP_FILE

echo "✅ Remote restore completed successfully."
EOF

echo "🎉 Database migration complete!"
