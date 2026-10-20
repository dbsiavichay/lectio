#!/usr/bin/env bash
#
# Installs this site's routing into the shared edge proxy and applies it.
#
#   scripts/apply-edge.sh
#
# The edge (/opt/edge) belongs to grazia-infra and imports every
# caddy/sites/*.caddy. Its apply.sh fails while Caddy rejects any of them, and
# every Grazia deploy runs it, so a broken lectio.caddy left on disk would
# block the deploys of a project that has nothing to do with this one. This
# script only ever leaves behind a file Caddy accepted: if the new one is
# rejected, it puts the previous one back and applies again.
#
set -euo pipefail

# cron and non-interactive SSH sessions get a threadbare PATH.
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_DIR="${EDGE_DIR:-/opt/edge}"
SOURCE="${APP_DIR}/caddy/lectio.caddy"
TARGET="${EDGE_DIR}/caddy/sites/lectio.caddy"

[ -x "${EDGE_DIR}/apply.sh" ] || { echo "ERROR: no edge proxy at ${EDGE_DIR}. See deploy/README.md." >&2; exit 2; }

if [ -f "$TARGET" ] && cmp -s "$SOURCE" "$TARGET"; then
    echo ">> edge: lectio.caddy is unchanged; nothing to apply."
    exit 0
fi

backup=""
if [ -f "$TARGET" ]; then
    backup="$(mktemp "${APP_DIR}/.lectio.caddy.XXXXXX")"
    cp "$TARGET" "$backup"
fi

# Written under a name the edge's glob (*.caddy) does not match, then renamed,
# so Caddy can never read half a file.
cp "$SOURCE" "${TARGET}.new"
chmod 644 "${TARGET}.new"
mv "${TARGET}.new" "$TARGET"

if "${EDGE_DIR}/apply.sh"; then
    rm -f "$backup"
    exit 0
fi

echo "!! edge: Caddy rejected lectio.caddy; putting back what was there before." >&2
if [ -n "$backup" ]; then mv "$backup" "$TARGET"; else rm -f "$TARGET"; fi
"${EDGE_DIR}/apply.sh" || echo "!! edge: re-applying the previous config failed too. MANUAL INTERVENTION REQUIRED." >&2
exit 1
