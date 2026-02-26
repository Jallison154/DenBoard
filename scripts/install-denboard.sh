#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

APP_DIR="/opt/denboard"
SERVICE_NAME="denboard"
DENBOARD_USER="denboard"
DEFAULT_BRANCH="main"
DEFAULT_HOST="denboard.local"

print_usage() {
  cat <<'EOF'
Usage:
  sudo bash scripts/install-denboard.sh <git_repo_url> [--branch BRANCH] [--host HOSTNAME] [--with-caddy]

Examples:
  sudo bash scripts/install-denboard.sh https://github.com/USER/denboard.git
  sudo bash scripts/install-denboard.sh https://github.com/USER/denboard.git --branch main --host denboard.local --with-caddy

This script is idempotent and safe to run multiple times.
EOF
}

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "This installer must be run as root (use sudo)." >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  print_usage
  exit 1
fi

REPO_URL="$1"
shift || true
BRANCH="$DEFAULT_BRANCH"
HOSTNAME="$DEFAULT_HOST"
WITH_CADDY="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)
      BRANCH="${2:-}"
      if [[ -z "$BRANCH" ]]; then
        echo "--branch requires a value" >&2
        exit 1
      fi
      shift 2
      ;;
    --host)
      HOSTNAME="${2:-}"
      if [[ -z "$HOSTNAME" ]]; then
        echo "--host requires a value" >&2
        exit 1
      fi
      shift 2
      ;;
    --with-caddy)
      WITH_CADDY="true"
      shift
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      print_usage
      exit 1
      ;;
  esac
done

echo "=== DenBoard installer ==="
echo "Repository : $REPO_URL"
echo "Branch    : $BRANCH"
echo "Hostname  : $HOSTNAME"
echo "With Caddy: $WITH_CADDY"
echo

if [[ ! -r /etc/os-release ]]; then
  echo "Cannot detect OS (missing /etc/os-release). This installer targets Debian 12." >&2
  exit 1
fi

. /etc/os-release

ID_LOWER="$(echo "${ID:-}" | tr '[:upper:]' '[:lower:]')"
ID_LIKE_LOWER="$(echo "${ID_LIKE:-}" | tr '[:upper:]' '[:lower:]')"

if [[ "$ID_LOWER" != "debian" && "$ID_LOWER" != "ubuntu" && "$ID_LIKE_LOWER" != *"debian"* ]]; then
  echo "This installer is intended for Debian-based systems (Debian 12 / Proxmox CT)." >&2
  echo "Detected ID=${ID:-unknown}, ID_LIKE=${ID_LIKE:-unknown}." >&2
  exit 1
fi

if [[ "$ID_LOWER" == "debian" && "${VERSION_ID:-}" != "12" ]]; then
  echo "Warning: this script is tested on Debian 12 but you are on VERSION_ID=${VERSION_ID:-unknown}." >&2
  echo "Aborting to be safe." >&2
  exit 1
fi

echo "Updating apt package index..."
apt-get update -y

echo "Installing base dependencies (curl, git, build-essential, ca-certificates)..."
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates \
  curl \
  git \
  build-essential

echo "Ensuring Node.js 20 is installed..."
if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(\".\")[0]')" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not available even after installation. Please inspect your system and retry." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not available even after Node.js installation." >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git is required but not available." >&2
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemd is required (systemctl not found)." >&2
  exit 1
fi

echo "Ensuring user '$DENBOARD_USER' exists..."
if ! id -u "$DENBOARD_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$DENBOARD_USER"
fi

mkdir -p "$APP_DIR"
chown -R "$DENBOARD_USER":"$DENBOARD_USER" "$APP_DIR"

if [[ -d "$APP_DIR/.git" ]]; then
  echo "Existing DenBoard repo detected at $APP_DIR. Updating..."
  cd "$APP_DIR"
  sudo -u "$DENBOARD_USER" git remote set-url origin "$REPO_URL" || true
  sudo -u "$DENBOARD_USER" git fetch --all --prune
  sudo -u "$DENBOARD_USER" git checkout "$BRANCH"
  sudo -u "$DENBOARD_USER" git reset --hard "origin/$BRANCH"
else
  echo "Cloning DenBoard into $APP_DIR..."
  rm -rf "$APP_DIR"
  mkdir -p "$APP_DIR"
  chown "$DENBOARD_USER":"$DENBOARD_USER" "$APP_DIR"
  sudo -u "$DENBOARD_USER" git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

chown -R "$DENBOARD_USER":"$DENBOARD_USER" "$APP_DIR"
cd "$APP_DIR"

if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    echo "Creating .env from .env.example (please edit /opt/denboard/.env to add secrets)..."
    cp .env.example .env
    chown "$DENBOARD_USER":"$DENBOARD_USER" .env
  else
    echo "Warning: .env.example not found. You must create /opt/denboard/.env manually before starting the service." >&2
  fi
else
  echo ".env already exists; leaving it unchanged."
fi

echo "Installing npm dependencies with npm ci..."
sudo -u "$DENBOARD_USER" npm ci

echo "Building DenBoard (npm run build)..."
sudo -u "$DENBOARD_USER" npm run build

SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "Creating systemd service at $SERVICE_FILE..."
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=DenBoard family dashboard
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${DENBOARD_USER}
Group=${DENBOARD_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd and enabling ${SERVICE_NAME}.service..."
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}.service"
systemctl restart "${SERVICE_NAME}.service"

PORT_ENV=""
if [[ -f "${APP_DIR}/.env" ]]; then
  PORT_ENV="$(grep -E '^PORT=' "${APP_DIR}/.env" | tail -n 1 | cut -d'=' -f2- || true)"
fi
PORT="${PORT_ENV:-3000}"

echo "Performing health check on http://127.0.0.1:${PORT}/api/health ..."
sleep 5
if ! curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  echo "Health check failed. DenBoard service may not be running correctly." >&2
  systemctl status "${SERVICE_NAME}.service" --no-pager || true
  journalctl -u "${SERVICE_NAME}.service" -n 50 --no-pager || true
  exit 1
fi

echo "Health check OK."

if [[ "$WITH_CADDY" == "true" ]]; then
  echo "Installing and configuring Caddy reverse proxy..."
  DEBIAN_FRONTEND=noninteractive apt-get install -y caddy

  CADDYFILE="/etc/caddy/Caddyfile"
  cat > "$CADDYFILE" <<EOF
${HOSTNAME} {
    reverse_proxy 127.0.0.1:${PORT}
}
EOF

  systemctl enable caddy
  systemctl reload caddy || systemctl restart caddy

  cat <<EOF
Caddy is configured.

- Hostname: ${HOSTNAME}
- Backend : http://127.0.0.1:${PORT}

To use this from your LAN, create a DNS entry for ${HOSTNAME} pointing to this CT's IP
(via Pi-hole, Unifi, router DNS, or /etc/hosts on clients).
EOF
fi

cat <<EOF
=== DenBoard installation complete ===

- Code directory : ${APP_DIR}
- Systemd service: ${SERVICE_NAME}.service
- Health check   : http://127.0.0.1:${PORT}/api/health

Edit ${APP_DIR}/.env to configure API keys and secrets, then restart:

  sudo systemctl restart ${SERVICE_NAME}.service

You can check logs with:

  sudo journalctl -u ${SERVICE_NAME}.service -f --no-pager
EOF

