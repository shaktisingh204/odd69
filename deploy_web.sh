#!/bin/bash
# ==========================================
# Frontend Deployment Script
# Zips 'newwebsite/.next' and 'newwebsite/public' and 'newwebsite/package.json' etc.
# Uploads to remote server and restarts the Node process
# Usage: ./deploy_web.sh <SERVER_IP>
# ==========================================

set -e

# -------- Remote Configuration --------
# Assuming same configuration as deploy_db.sh but usually application code is in /var/www/adxwin or similar
REMOTE_SSH_USER="root"
REMOTE_APP_DIR="/var/www/adxwin/newwebsite" # Based on user message context
SSH_KEY_PATH="$HOME/Downloads/zoru"

# -------- Checks --------
if [ -z "$1" ]; then
    echo "❌ Error: Server IP is required."
    echo "Usage: ./deploy_web.sh <SERVER_IP>"
    exit 1
fi

SERVER_IP="$1"

echo "=========================================="
echo "🚀 Starting Frontend Deployment to $SERVER_IP"
echo "=========================================="

# -------- Build and Package Local Code --------
echo "🏗️  Building Next.js app locally..."
cd newwebsite
# npm install # Optional, can skip if node_modules are fine
npm run build 

echo "📦 Zipping build artifacts..."
# Zip .next, public, package.json, next.config.ts
tar -czf ../web_build.tar.gz .next public package.json next.config.ts .env
cd ..

# -------- Upload Build --------
echo "📤 Uploading web_build.tar.gz to server..."
scp -i "$SSH_KEY_PATH" web_build.tar.gz "$REMOTE_SSH_USER@$SERVER_IP:/root/web_build.tar.gz"
echo "✅ Upload successful."

# -------- Deploy on Remote --------
echo "📥 Deploying on server..."

ssh -i "$SSH_KEY_PATH" "$REMOTE_SSH_USER@$SERVER_IP" << EOF
set -e

echo "➡️  Removing old build..."
rm -rf $REMOTE_APP_DIR/.next
rm -rf $REMOTE_APP_DIR/public

mkdir -p $REMOTE_APP_DIR

echo "➡️  Extracting new build..."
tar -xzf /root/web_build.tar.gz -C $REMOTE_APP_DIR

echo "➡️  Installing dependencies (if needed)..."
cd $REMOTE_APP_DIR
npm install --omit=dev

echo "➡️  Restarting PM2 process..."
# Assuming PM2 process name is 'frontend' or similar. 
# Trying to find it or restart generic start command.
# Based on user logs in previous turns, backend was running on PM2 id 2. Frontend might be running too.
# Let's try to reload or restart by name if known, else standard start.

# Check if 'newwebsite' is running in PM2 list
if pm2 list | grep -q "newwebsite"; then
    pm2 reload newwebsite
else
    echo "⚠️  PM2 process 'newwebsite' not found. Starting it..."
    pm2 start npm --name "newwebsite" -- start
fi

echo "🧹 Cleaning up..."
rm -f /root/web_build.tar.gz

echo "✅ Deployment completed successfully."
EOF

# -------- Cleanup Local --------
rm -f web_build.tar.gz

echo "🎉 Frontend deployment complete!"
