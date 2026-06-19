#!/usr/bin/env bash
# ============================================================================
#  ODD69 — one-shot fresh-VPS provisioner & deployer
# ----------------------------------------------------------------------------
#  Installs and wires up the WHOLE stack on a clean Ubuntu/Debian VPS:
#    • Node.js 22 + PM2        • Rust toolchain (for sports-sync-rust)
#    • PostgreSQL              • MongoDB 8.0          • Redis
#    • nginx reverse proxy     • Let's Encrypt TLS (certbot)
#    • .env files for all 4 sub-projects (secrets auto-generated)
#    • builds + starts: rust-sync → newbackend → newadmin → newwebsite
#
#  Apps & ports (all behind nginx):
#    newwebsite  :3000   ->  https://odd69.com
#    newadmin    :3010   ->  https://admin.odd69.com
#    newbackend  :9828   ->  https://odd69.com/api  (+ /socket.io)
#    rust-sync     —      Sportradar -> Redis + Mongo (needs a real API key)
#
#  USAGE (run ON the VPS, as root, from the repo root):
#     1. Get the code onto the box, e.g.
#          git clone <repo> /var/www/odd69     # or rsync it up
#     2. cd /var/www/odd69
#     3. sudo DOMAIN=odd69.com EMAIL=you@example.com ./deploy.sh
#
#  Safe to re-run: every step is idempotent. Secrets are generated once and
#  cached in .deploy.secrets so re-runs don't log every user out.
# ============================================================================

set -euo pipefail

# ─────────────────────────── Configuration ─────────────────────────────────
# Override any of these by exporting them before running, e.g.
#   DOMAIN=odd69.com EMAIL=admin@odd69.com ./deploy.sh
DOMAIN="${DOMAIN:-odd69.com}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.${DOMAIN}}"
WWW_DOMAIN="www.${DOMAIN}"
EMAIL="${EMAIL:-}"                       # required for Let's Encrypt; blank = skip TLS

# Database
PG_USER="${PG_USER:-zoru}"
PG_PASS="${PG_PASS:-Zoru@9828}"
PG_DB="${PG_DB:-adxwin_db}"
MONGO_DB="${MONGO_DB:-adxwin}"
DB_DUMP="${DB_DUMP:-backup.dump}"        # restored if present in repo root

# Toggles
ENABLE_SSL="${ENABLE_SSL:-true}"         # run certbot (needs DNS pointed + EMAIL)
CONFIGURE_FIREWALL="${CONFIGURE_FIREWALL:-true}"
INSTALL_CLICKHOUSE="${INSTALL_CLICKHOUSE:-false}"  # analytics only; optional
NODE_MAJOR="${NODE_MAJOR:-22}"
MONGO_VERSION="${MONGO_VERSION:-8.0}"

# Resolve repo dir = directory this script lives in
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS_FILE="${REPO_DIR}/.deploy.secrets"

export DEBIAN_FRONTEND=noninteractive

# ─────────────────────────── Helpers ───────────────────────────────────────
c_blue='\033[1;34m'; c_green='\033[1;32m'; c_yellow='\033[1;33m'; c_red='\033[1;31m'; c_reset='\033[0m'
log()  { echo -e "${c_blue}==>${c_reset} $*"; }
ok()   { echo -e "${c_green}  ✓${c_reset} $*"; }
warn() { echo -e "${c_yellow}  ! ${c_reset}$*"; }
die()  { echo -e "${c_red}✗ $*${c_reset}" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

require_root() { [ "$(id -u)" -eq 0 ] || die "Run as root (use sudo)."; }

# ─────────────────────────── 0. Preflight ──────────────────────────────────
require_root
[ -d "${REPO_DIR}/newbackend" ] || die "Run from the repo root (newbackend/ not found at ${REPO_DIR})."

. /etc/os-release 2>/dev/null || die "Cannot read /etc/os-release."
OS_ID="${ID:-}"; OS_CODENAME="${VERSION_CODENAME:-}"
case "$OS_ID" in
  ubuntu|debian) ;;
  *) die "This script targets Ubuntu/Debian. Detected: ${OS_ID:-unknown}." ;;
esac
log "Target: ${DOMAIN} (admin: ${ADMIN_DOMAIN}) on ${OS_ID} ${OS_CODENAME}"
log "Repo:   ${REPO_DIR}"

# ─────────────────────────── 1. Swap (build OOM guard) ──────────────────────
ensure_swap() {
  local mem_mb; mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
  if [ "$mem_mb" -lt 2600 ] && [ ! -f /swapfile ]; then
    log "Low RAM (${mem_mb}MB) — creating 4G swapfile so Next.js builds don't OOM"
    fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
    chmod 600 /swapfile; mkswap /swapfile; swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    ok "Swap enabled"
  else
    ok "RAM ${mem_mb}MB — swap setup skipped"
  fi
}
ensure_swap

# ─────────────────────────── 2. Base packages ──────────────────────────────
log "Installing base packages"
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl wget gnupg lsb-release apt-transport-https \
  build-essential pkg-config libssl-dev git ufw nginx
ok "Base packages installed"

# ─────────────────────────── 3. Node.js + PM2 ──────────────────────────────
if ! have node || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt "$NODE_MAJOR" ]; then
  log "Installing Node.js ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
ok "Node $(node -v) / npm $(npm -v)"
have pm2 || { log "Installing PM2"; npm install -g pm2; }
ok "PM2 $(pm2 -v)"

# ─────────────────────────── 4. Rust toolchain ─────────────────────────────
RUST_HOME=/root/.cargo
if ! have cargo && [ ! -x "${RUST_HOME}/bin/cargo" ]; then
  log "Installing Rust (rustup)"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
fi
# shellcheck disable=SC1091
source "${RUST_HOME}/env"
ok "Rust $(cargo --version)"

# ─────────────────────────── 5. PostgreSQL ─────────────────────────────────
log "Installing PostgreSQL"
apt-get install -y postgresql postgresql-contrib
systemctl enable --now postgresql
ok "PostgreSQL running"

log "Creating role '${PG_USER}' and database '${PG_DB}'"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${PG_USER}') THEN
    CREATE ROLE "${PG_USER}" LOGIN PASSWORD '${PG_PASS}';
  END IF;
END \$\$;
ALTER ROLE "${PG_USER}" WITH LOGIN PASSWORD '${PG_PASS}';
SQL
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" | grep -q 1; then
  sudo -u postgres createdb -O "${PG_USER}" "${PG_DB}"
  ok "Database ${PG_DB} created"
else
  ok "Database ${PG_DB} already exists"
fi

# ─────────────────────────── 6. MongoDB ────────────────────────────────────
# MongoDB 5.0+ requires a CPU with the AVX instruction set. On hosts without AVX
# (common on budget VPS / nested virtualization) mongod core-dumps instantly with
# SIGILL. We detect that and fall back to MongoDB 4.4 — the last AVX-free release —
# run in Docker (its image bundles libssl, sidestepping the libssl1.1 dependency
# conflict you'd hit installing 4.4 natively on Ubuntu 24.04).
if grep -qm1 avx /proc/cpuinfo; then
  if ! have mongod; then
    log "Installing MongoDB ${MONGO_VERSION} (native — CPU supports AVX)"
    curl -fsSL "https://www.mongodb.org/static/pgp/server-${MONGO_VERSION}.asc" \
      | gpg -o "/usr/share/keyrings/mongodb-server-${MONGO_VERSION}.gpg" --dearmor
    if [ "$OS_ID" = "ubuntu" ]; then
      MONGO_REPO="https://repo.mongodb.org/apt/ubuntu ${OS_CODENAME}/mongodb-org/${MONGO_VERSION} multiverse"
    else
      MONGO_REPO="https://repo.mongodb.org/apt/debian ${OS_CODENAME}/mongodb-org/${MONGO_VERSION} main"
    fi
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-${MONGO_VERSION}.gpg ] ${MONGO_REPO}" \
      > "/etc/apt/sources.list.d/mongodb-org-${MONGO_VERSION}.list"
    apt-get update -y
    apt-get install -y mongodb-org
  fi
  systemctl enable --now mongod
  ok "MongoDB ${MONGO_VERSION} running (native)"
else
  warn "CPU has no AVX — MongoDB ${MONGO_VERSION} would crash (SIGILL). Falling back to MongoDB 4.4 in Docker."
  systemctl disable --now mongod 2>/dev/null || true
  systemctl mask mongod 2>/dev/null || true   # keep the broken native unit out of the way
  have docker || { log "Installing Docker"; apt-get install -y docker.io; }
  systemctl enable --now docker
  if docker ps -a --format '{{.Names}}' | grep -qx mongo; then
    docker start mongo >/dev/null 2>&1 || true
  else
    log "Starting mongo:4.4 container"
    docker run -d --name mongo --restart unless-stopped \
      -p 127.0.0.1:27017:27017 -v mongo_data:/data/db mongo:4.4 >/dev/null
  fi
  log "Waiting for MongoDB to accept connections"
  for _i in $(seq 1 40); do
    docker exec mongo mongo --quiet --eval 'db.runCommand({ping:1}).ok' 2>/dev/null | grep -q 1 && break
    sleep 2
  done
  ok "MongoDB 4.4 running (Docker, AVX-free)"
fi

# ─────────────────────────── 7. Redis ──────────────────────────────────────
log "Installing Redis"
apt-get install -y redis-server
systemctl enable --now redis-server
ok "Redis running"

# ─────────────────────────── 8. ClickHouse (optional) ──────────────────────
if [ "$INSTALL_CLICKHOUSE" = "true" ] && ! have clickhouse-server; then
  log "Installing ClickHouse"
  curl -fsSL https://packages.clickhouse.com/rpm/lts/repodata/repomd.xml >/dev/null 2>&1 || true
  GNUPGHOME=$(mktemp -d) gpg --no-default-keyring --keyring /usr/share/keyrings/clickhouse-keyring.gpg \
    --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 8919F6BD2B48D754 || true
  echo "deb [signed-by=/usr/share/keyrings/clickhouse-keyring.gpg] https://packages.clickhouse.com/deb stable main" \
    > /etc/apt/sources.list.d/clickhouse.list
  apt-get update -y
  apt-get install -y clickhouse-server clickhouse-client || warn "ClickHouse install failed — continuing (analytics only)"
  systemctl enable --now clickhouse-server || true
fi

# ─────────────────────────── 9. Secrets ────────────────────────────────────
# Generated once and cached so re-runs keep JWT/ADMIN tokens stable.
if [ -f "$SECRETS_FILE" ]; then
  log "Reusing cached secrets (${SECRETS_FILE})"
  # shellcheck disable=SC1090
  source "$SECRETS_FILE"
else
  log "Generating production secrets"
  JWT_SECRET=$(openssl rand -hex 32)
  PAYMENT_TOKEN_SECRET=$(openssl rand -hex 24)
  ADMIN_API_TOKEN=$(openssl rand -hex 24)
  cat > "$SECRETS_FILE" <<EOF
JWT_SECRET=${JWT_SECRET}
PAYMENT_TOKEN_SECRET=${PAYMENT_TOKEN_SECRET}
ADMIN_API_TOKEN=${ADMIN_API_TOKEN}
EOF
  chmod 600 "$SECRETS_FILE"
fi
ok "Secrets ready"

DATABASE_URL="postgresql://${PG_USER}:${PG_PASS}@127.0.0.1:5432/${PG_DB}?schema=public"
MONGO_URI="mongodb://127.0.0.1:27017/${MONGO_DB}"

# ─────────────────────────── 10. Write .env files ──────────────────────────
# NOTE: NEXT_PUBLIC_* are inlined at BUILD time, so envs must exist before build.
log "Writing .env files"

cat > "${REPO_DIR}/newbackend/.env" <<EOF
# Generated by deploy.sh — production
NODE_ENV=production
PORT=9828
FRONTEND_URL=https://${DOMAIN}
NEXT_PUBLIC_API_URL=https://${DOMAIN}/api

DATABASE_URL=${DATABASE_URL}
MONGO_URI=${MONGO_URI}

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=
PROXY_REDIS_HOST=127.0.0.1
PROXY_REDIS_PORT=6379
PROXY_REDIS_DB=1
PROXY_REDIS_PASSWORD=

CLICKHOUSE_URL=http://127.0.0.1:8123
CLICKHOUSE_DB=adxwin_analytics
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=

JWT_SECRET=${JWT_SECRET}
PAYMENT_TOKEN_SECRET=${PAYMENT_TOKEN_SECRET}
ADMIN_API_TOKEN=${ADMIN_API_TOKEN}
EXTERNAL_API_TOKEN=${ADMIN_API_TOKEN}
PAYMENT_RETURN_URL_ALLOWED_HOSTS=${DOMAIN},${WWW_DOMAIN},${ADMIN_DOMAIN}

# Single writer = the Rust daemon. Keep the in-process sync disabled.
SPORTRADAR_SYNC_DISABLED=true
SPORTRADAR_WRITER=rust
SPORTRADAR_API_KEY=<FILL_SPORTRADAR_API_KEY>
SPORTRADAR_HOST_PRIMARY=https://api.sportradar.com
SPORTRADAR_HOST_SECONDARY=https://api.sportradar.com
SPORTRADAR_PROXY_UPSTREAM=
SPORTRADAR_PROXY_UPSTREAM_TOKEN=
SPORTS_API_KEY=<FILL_SPORTS_API_KEY>
SPORTS_BASE_URL=https://api.sportradar.com
SPORTS_FEED_URLS=

# Casino / game providers — fill to enable
CASINO_PARTNER_KEY_INR=
CASINO_PARTNER_KEY_LKR=
DIAMOND_API_URL=
DIAMOND_API_HOST=
DIAMOND_API_KEY=
HUIDU_BASE_URL=
HUIDU_AGENCY_UID=
HUIDU_AES_KEY=
HUIDU_PLAYER_PREFIX=adx
MYZOSH_API_URL=
MYZOSH_AGENT_CODE=
MYZOSH_SECRET_KEY=
MYZOSH_STATIC_TOKEN=
EOF

cat > "${REPO_DIR}/newwebsite/.env.local" <<EOF
# Generated by deploy.sh — production
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://${DOMAIN}/api
NEXT_PUBLIC_API_PROXY_URL=https://${DOMAIN}/api
NEXT_PUBLIC_SOCKET_URL=https://${DOMAIN}
NEXT_PUBLIC_WS_URL=https://${DOMAIN}
NEXT_PUBLIC_CF_IMAGES_FLEX_VARIANTS=0

# Server-side only (SSR talks to the local backend directly)
API_URL=http://127.0.0.1:9828/api
INTERNAL_API_URL=http://127.0.0.1:9828/api
ADMIN_API_TOKEN=${ADMIN_API_TOKEN}
MONGO_URI=${MONGO_URI}
EOF

cat > "${REPO_DIR}/newadmin/.env" <<EOF
# Generated by deploy.sh — production
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://${ADMIN_DOMAIN}/api
NEXT_PUBLIC_API_PROXY_URL=https://${ADMIN_DOMAIN}/api
BACKEND_URL=http://127.0.0.1:9828/api
NEXT_PUBLIC_WEBSITE_URL=https://${DOMAIN}

JWT_SECRET=${JWT_SECRET}
ADMIN_API_TOKEN=${ADMIN_API_TOKEN}

MONGO_URI=${MONGO_URI}
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=

SPORTRADAR_API_KEY=<FILL_SPORTRADAR_API_KEY>
SPORTRADAR_HOST_PRIMARY=https://api.sportradar.com
SPORTRADAR_HOST_SECONDARY=https://api.sportradar.com
SPORTS_API_KEY=<FILL_SPORTS_API_KEY>

CF_ACCOUNT_ID=
CF_IMAGES_TOKEN=
IMAGES_TOKEN=
NEXPAY_API_TOKEN=
EOF

cat > "${REPO_DIR}/sports-sync-rust/.env" <<EOF
# Generated by deploy.sh — production
REDIS_URL=redis://127.0.0.1:6379
MONGO_URI=${MONGO_URI}
MONGODB_URI=${MONGO_URI}
PROXY_REDIS_URL=redis://127.0.0.1:6379/1
SPORTRADAR_API_KEY=<FILL_SPORTRADAR_API_KEY>
SPORTRADAR_HOST_PRIMARY=https://api.sportradar.com
SPORTRADAR_HOST_SECONDARY=https://api.sportradar.com
EOF
ok ".env files written (Sportradar/casino keys left as <FILL_…> placeholders)"

# Ensure the admin subdomain is in the backend CORS allow-list (same-origin /api
# via nginx already avoids CORS, but belt-and-suspenders for cross-host calls).
MAIN_TS="${REPO_DIR}/newbackend/src/main.ts"
if ! grep -q "https://${ADMIN_DOMAIN}" "$MAIN_TS"; then
  sed -i "s#'https://${DOMAIN}',#'https://${DOMAIN}',\n    'https://${ADMIN_DOMAIN}',#" "$MAIN_TS" \
    && ok "Added https://${ADMIN_DOMAIN} to backend CORS" || warn "Could not patch CORS; add ${ADMIN_DOMAIN} manually in newbackend/src/main.ts"
fi

# ─────────────────────────── 11. Build rust-sync ───────────────────────────
log "Building sports-sync-rust (release)"
( cd "${REPO_DIR}/sports-sync-rust" && cargo build --release )
ok "rust-sync built"

# ─────────────────────────── 12. Backend: deps, db, build ──────────────────
log "Installing backend deps + generating Prisma client"
( cd "${REPO_DIR}/newbackend" && npm install --no-audit --no-fund --legacy-peer-deps && npx prisma generate )

if [ -f "${REPO_DIR}/${DB_DUMP}" ]; then
  log "Restoring Postgres dump (${DB_DUMP})"
  PGPASSWORD="${PG_PASS}" pg_restore -h 127.0.0.1 -U "${PG_USER}" -d "${PG_DB}" \
    --no-owner --no-privileges --clean --if-exists "${REPO_DIR}/${DB_DUMP}" \
    && ok "Database restored" || warn "pg_restore reported issues (often harmless on a fresh DB)"
else
  log "No ${DB_DUMP} found — pushing Prisma schema to create tables"
  ( cd "${REPO_DIR}/newbackend" && npx prisma db push --skip-generate )
fi

log "Building backend"
( cd "${REPO_DIR}/newbackend" && npm run build )
mkdir -p "${REPO_DIR}/newbackend/uploads"
ok "Backend built"

# ─────────────────────────── 13. Frontends: deps + build ───────────────────
log "Installing + building newwebsite (this is the heavy one)"
( cd "${REPO_DIR}/newwebsite" && npm install --no-audit --no-fund --legacy-peer-deps && npm run build )
ok "newwebsite built"

log "Installing + building newadmin"
( cd "${REPO_DIR}/newadmin" && npm install --no-audit --no-fund --legacy-peer-deps && npm run build )
ok "newadmin built"

# ─────────────────────────── 14. PM2 ecosystem + start ─────────────────────
log "Writing PM2 ecosystem and starting all processes"
cat > "${REPO_DIR}/ecosystem.deploy.config.js" <<EOF
// Generated by deploy.sh — start order: rust-sync -> backend -> admin -> website
module.exports = {
  apps: [
    {
      name: 'rust-sync',
      cwd: '${REPO_DIR}/sports-sync-rust',
      script: './target/release/sports-sync-rust',
      autorestart: true,
      max_memory_restart: '500M',
      env: { NODE_ENV: 'production', RUST_LOG: 'info,sports_sync_rust=info' },
    },
    {
      name: 'newbackend',
      cwd: '${REPO_DIR}/newbackend',
      script: 'dist/main.js',
      autorestart: true,
      max_memory_restart: '1G',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'newadmin',
      cwd: '${REPO_DIR}/newadmin',
      script: 'npm',
      args: 'start',
      autorestart: true,
      max_memory_restart: '700M',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'newwebsite',
      cwd: '${REPO_DIR}/newwebsite',
      script: 'npm',
      args: 'start',
      autorestart: true,
      max_memory_restart: '1G',
      env: { NODE_ENV: 'production' },
    },
  ],
};
EOF

pm2 start "${REPO_DIR}/ecosystem.deploy.config.js" --update-env
pm2 save
pm2 startup systemd -u root --hp /root | grep -E '^sudo' | bash || true
ok "PM2 processes started and persisted"

# ─────────────────────────── 15. nginx ─────────────────────────────────────
log "Configuring nginx"
# websocket upgrade map (must live in http{} context, not a server block)
cat > /etc/nginx/conf.d/odd69-upgrade.conf <<'EOF'
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
EOF

# shared proxy snippet
mkdir -p /etc/nginx/snippets
cat > /etc/nginx/snippets/odd69-proxy.conf <<'EOF'
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
proxy_read_timeout 300s;
EOF

# main site
# NOTE: the Next.js website owns a few /api/* paths as its own route handlers
# (they read Mongo / server actions in-process). Those MUST go to :3000, not the
# backend — otherwise they 404 and the SSR-vs-client divergence throws React #418
# (hydration mismatch). Everything else under /api/* is the NestJS backend.
cat > /etc/nginx/sites-available/${DOMAIN}.conf <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};
    client_max_body_size 25m;

    location ~ ^/api/(sidebar-categories|page-sliders|odds-events|odds-sports|daily-checkin)(/|\$) {
        proxy_pass http://127.0.0.1:3000; include snippets/odd69-proxy.conf;
    }
    location /socket.io/ { proxy_pass http://127.0.0.1:9828; include snippets/odd69-proxy.conf; }
    location /api/       { proxy_pass http://127.0.0.1:9828; include snippets/odd69-proxy.conf; }
    location /           { proxy_pass http://127.0.0.1:3000; include snippets/odd69-proxy.conf; }
}
EOF

# admin panel — same idea: the admin Next.js app owns these /api/* route handlers.
cat > /etc/nginx/sites-available/${ADMIN_DOMAIN}.conf <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${ADMIN_DOMAIN};
    client_max_body_size 25m;

    location ~ ^/api/(auth|events|export|import|fixdb|upload|upload-cf|upload-image)(/|\$) {
        proxy_pass http://127.0.0.1:3010; include snippets/odd69-proxy.conf;
    }
    location /socket.io/ { proxy_pass http://127.0.0.1:9828; include snippets/odd69-proxy.conf; }
    location /api/       { proxy_pass http://127.0.0.1:9828; include snippets/odd69-proxy.conf; }
    location /           { proxy_pass http://127.0.0.1:3010; include snippets/odd69-proxy.conf; }
}
EOF

ln -sf /etc/nginx/sites-available/${DOMAIN}.conf       /etc/nginx/sites-enabled/${DOMAIN}.conf
ln -sf /etc/nginx/sites-available/${ADMIN_DOMAIN}.conf /etc/nginx/sites-enabled/${ADMIN_DOMAIN}.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ok "nginx configured for ${DOMAIN}, ${WWW_DOMAIN}, ${ADMIN_DOMAIN}"

# ─────────────────────────── 16. Firewall ──────────────────────────────────
if [ "$CONFIGURE_FIREWALL" = "true" ]; then
  log "Configuring UFW firewall"
  ufw allow OpenSSH >/dev/null 2>&1 || true
  ufw allow 'Nginx Full' >/dev/null 2>&1 || true
  yes | ufw enable >/dev/null 2>&1 || true
  ok "Firewall: SSH + HTTP/HTTPS allowed"
fi

# ─────────────────────────── 17. TLS (certbot) ─────────────────────────────
if [ "$ENABLE_SSL" = "true" ] && [ -n "$EMAIL" ]; then
  log "Requesting Let's Encrypt certificates"
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx --non-interactive --agree-tos -m "$EMAIL" --redirect \
    -d "${DOMAIN}" -d "${WWW_DOMAIN}" -d "${ADMIN_DOMAIN}" \
    && ok "TLS enabled (auto-renew via certbot timer)" \
    || warn "certbot failed — make sure DNS for ${DOMAIN}/${ADMIN_DOMAIN} points at this server, then re-run: certbot --nginx -d ${DOMAIN} -d ${WWW_DOMAIN} -d ${ADMIN_DOMAIN}"
else
  warn "Skipping TLS (set EMAIL=you@example.com and ENABLE_SSL=true once DNS is pointed)."
fi

# ─────────────────────────── Done ──────────────────────────────────────────
echo
echo -e "${c_green}============================================================${c_reset}"
echo -e "${c_green} ODD69 deployment complete${c_reset}"
echo -e "${c_green}============================================================${c_reset}"
echo "  Website : https://${DOMAIN}        (pm2: newwebsite -> :3000)"
echo "  Admin   : https://${ADMIN_DOMAIN}  (pm2: newadmin   -> :3010)"
echo "  API     : https://${DOMAIN}/api     (pm2: newbackend -> :9828)"
echo "  Syncer  : pm2: rust-sync"
echo
echo "  pm2 status        # see all processes"
echo "  pm2 logs          # tail logs"
echo
echo -e "${c_yellow}NEXT STEPS — required for full functionality:${c_reset}"
echo "  1. Point DNS A records ${DOMAIN}, ${WWW_DOMAIN}, ${ADMIN_DOMAIN} -> this server's IP."
echo "  2. Fill <FILL_SPORTRADAR_API_KEY> / <FILL_SPORTS_API_KEY> in newbackend/.env,"
echo "     newadmin/.env, sports-sync-rust/.env, then: pm2 restart all"
echo "  3. Fill payment/casino provider keys in newbackend/.env as needed."
echo "  4. If TLS was skipped, run certbot once DNS resolves (command above)."
echo "  Secrets cached in ${SECRETS_FILE} (chmod 600) — keep it; re-runs reuse it."
