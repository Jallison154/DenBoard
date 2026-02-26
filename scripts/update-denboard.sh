#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

APP_DIR="/opt/denboard"
SERVICE_NAME="denboard"
DENBOARD_USER="denboard"

on_error() {
  local lineno="$1"
  echo "Update failed at line ${lineno}." >&2
  echo
  echo "=== systemctl status ${SERVICE_NAME}.service ==="
  systemctl status "${SERVICE_NAME}.service" --no-pager || true
  echo
  echo "=== journalctl -u ${SERVICE_NAME}.service (last 50 lines) ==="
  journalctl -u "${SERVICE_NAME}.service" -n 50 --no-pager || true
}
trap 'on_error $LINENO' ERR

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "This update script must be run as root (use sudo)." >&2
  exit 1
fi

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "No git repository found at ${APP_DIR}. Has DenBoard been installed?" >&2
  exit 1
fi

echo "=== Updating DenBoard at ${APP_DIR} ==="
cd "${APP_DIR}"

echo "Fetching latest changes from origin..."
sudo -u "${DENBOARD_USER}" git fetch --all --prune

echo "Fast-forwarding current branch..."
sudo -u "${DENBOARD_USER}" git pull --ff-only

echo "Installing npm dependencies with npm ci..."
sudo -u "${DENBOARD_USER}" npm ci

echo "Building DenBoard (npm run build)..."
sudo -u "${DENBOARD_USER}" npm run build

echo "Restarting systemd service ${SERVICE_NAME}.service..."
systemctl restart "${SERVICE_NAME}.service"

echo "Checking service status..."
systemctl status "${SERVICE_NAME}.service" --no-pager

echo "DenBoard update completed successfully."

