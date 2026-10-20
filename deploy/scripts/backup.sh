#!/usr/bin/env bash
#
# Nightly backup of Lectio's database: a consistent copy taken while the
# server runs (SQLite's online backup), kept for 14 days in data/backups.
#
#   scripts/backup.sh
#
# Installed in the deploy user's crontab (docs/DEPLOYMENT.md):
#   15 3 * * * /opt/lectio/scripts/backup.sh >> /opt/lectio/backup.log 2>&1
#
set -euo pipefail

# cron gets a threadbare PATH.
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo ">> $(date -u +%Y-%m-%dT%H:%M:%SZ) backup"
docker compose exec -T web node scripts/backup.mjs </dev/null
