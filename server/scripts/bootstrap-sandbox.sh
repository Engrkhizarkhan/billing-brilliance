#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PRODUCTION_ENV="$SERVER_DIR/.env"
SANDBOX_ENV="$SERVER_DIR/.env.sandbox"
SANDBOX_DB='Fintap_sandbox'
SANDBOX_DB_USER='fintap_sandbox_app'
SANDBOX_URL='https://sandbox.fintap.pk'

umask 077

for executable in openssl mysql sed grep; do
  command -v "$executable" >/dev/null 2>&1 || {
    echo "Missing required executable: $executable" >&2
    exit 1
  }
done

if [[ ! -f "$PRODUCTION_ENV" ]]; then
  echo "Production environment file not found: $PRODUCTION_ENV" >&2
  exit 1
fi

if [[ -e "$SANDBOX_ENV" ]]; then
  echo "Refusing to overwrite existing sandbox secrets: $SANDBOX_ENV" >&2
  echo "Back up and review the existing deployment instead of rotating it." >&2
  exit 1
fi

read_env_value() {
  local file="$1"
  local name="$2"
  sed -n "s/^${name}=//p" "$file" | tail -n 1
}

set_env_value() {
  local file="$1"
  local name="$2"
  local value="$3"
  sed -i "/^${name}=/d" "$file"
  printf '%s=%s\n' "$name" "$value" >> "$file"
}

PURGE_SECRET="$(read_env_value "$PRODUCTION_ENV" 'SANDBOX_PURGE_SECRET')"
if [[ -z "$PURGE_SECRET" || "$PURGE_SECRET" == replace_* ]]; then
  PURGE_SECRET="$(openssl rand -hex 32)"
  set_env_value "$PRODUCTION_ENV" 'SANDBOX_PURGE_SECRET' "$PURGE_SECRET"
fi
set_env_value "$PRODUCTION_ENV" 'SANDBOX_BASE_URL' "$SANDBOX_URL"
chmod 600 "$PRODUCTION_ENV"

DB_PASSWORD="$(openssl rand -hex 24)"
JWT_SECRET="$(openssl rand -hex 32)"
JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
ADMIN_PIN="$(printf '%06d' "$((16#$(openssl rand -hex 4) % 1000000))")"
API_KEY_ENCRYPTION_KEY="$(openssl rand -hex 32)"
WEBHOOK_SECRET="$(openssl rand -hex 32)"

echo "Creating isolated MySQL database and least-privilege application user."
echo "MySQL will prompt for the root password once."
mysql -u root -p <<SQL
CREATE DATABASE IF NOT EXISTS \`${SANDBOX_DB}\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${SANDBOX_DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${SANDBOX_DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON \`${SANDBOX_DB}\`.* TO '${SANDBOX_DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

TEMP_ENV="$(mktemp "$SERVER_DIR/.env.sandbox.tmp.XXXXXX")"
{
  printf '%s\n' 'NODE_ENV=production'
  printf '%s\n' 'APP_ENVIRONMENT=sandbox'
  printf '%s\n' 'PORT=3001'
  printf '%s\n' 'TRUST_PROXY_HOPS=1'
  printf '%s\n' 'REQUIRE_HTTPS=true'
  printf '%s\n' 'DB_HOST=127.0.0.1'
  printf '%s\n' 'DB_PORT=3306'
  printf 'DB_NAME=%s\n' "$SANDBOX_DB"
  printf 'DB_USER=%s\n' "$SANDBOX_DB_USER"
  printf 'DB_PASSWORD=%s\n' "$DB_PASSWORD"
  printf '%s\n' 'DB_CONNECTION_LIMIT=10'
  printf 'JWT_SECRET=%s\n' "$JWT_SECRET"
  printf '%s\n' 'JWT_EXPIRES_IN=1h'
  printf 'JWT_REFRESH_SECRET=%s\n' "$JWT_REFRESH_SECRET"
  printf '%s\n' 'JWT_REFRESH_EXPIRES_IN=1d'
  printf '%s\n' 'ADMIN_EMAIL='
  printf '%s\n' 'ADMIN_PASSWORD='
  printf '%s\n' 'ADMIN_NAME=Sandbox Administrator'
  printf 'ADMIN_ACTION_PIN=%s\n' "$ADMIN_PIN"
  printf 'API_KEY_ENCRYPTION_KEY=%s\n' "$API_KEY_ENCRYPTION_KEY"
  printf 'SANDBOX_PURGE_SECRET=%s\n' "$PURGE_SECRET"
  printf '%s\n' 'ORG_CALLBACK_URL=/api/payment/callback'
  printf 'ORG_WEBHOOK_SECRET=%s\n' "$WEBHOOK_SECRET"
  printf '%s\n' 'ORG_PAYMENT_EXPIRY_HOURS=48'
  printf '%s\n' 'REQUIRE_WEBHOOK_SIGNATURE=true'
  printf '%s\n' 'FINTECH_PREFIX=105172'
  printf '%s\n' 'CORS_ORIGIN=https://app.fintap.pk'
  printf '%s\n' 'RATE_LIMIT_WINDOW_MS=900000'
  printf '%s\n' 'RATE_LIMIT_MAX_REQUESTS=300'
  printf '%s\n' 'SAAS_RATE_LIMIT_PER_MINUTE=300'
  printf '%s\n' 'LOG_LEVEL=info'
  printf '%s\n' 'OUTBOX_POLL_MS=2000'
  printf '%s\n' 'OUTBOX_MAX_ATTEMPTS=5'
} > "$TEMP_ENV"
mv "$TEMP_ENV" "$SANDBOX_ENV"
chmod 600 "$SANDBOX_ENV"

unset DB_PASSWORD JWT_SECRET JWT_REFRESH_SECRET ADMIN_PIN API_KEY_ENCRYPTION_KEY WEBHOOK_SECRET PURGE_SECRET
echo "Sandbox database and protected environment file created. No secrets were printed."
echo "Next: run the sandbox migration and PM2 commands from the deployment runbook."
