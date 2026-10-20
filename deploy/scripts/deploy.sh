#!/usr/bin/env bash
#
# Deploys Lectio to an image tag, gated on the image's healthcheck, and
# rolls back to the previous tag if it never becomes healthy.
#
#   scripts/deploy.sh <latest|sha-abc1234>
#
# Run over SSH by .github/workflows/ci.yml, and by hand to go back to an older
# build. Runs from /opt/lectio; the edge's routing is installed separately
# by scripts/apply-edge.sh.
#
set -euo pipefail

# cron and non-interactive SSH sessions get a threadbare PATH.
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

TAG="${1:-}"
if ! printf '%s' "$TAG" | grep -qE '^(latest|sha-[0-9a-f]{7,40})$'; then
    echo "usage: deploy.sh <latest|sha-abc1234>" >&2
    exit 2
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"
ENV_FILE="${APP_DIR}/.env"

# The edge's apply.sh creates this network, but a deploy on a host whose edge
# is down must not fail on it.
docker network inspect edge >/dev/null 2>&1 || docker network create edge >/dev/null

# The database lives here, written by the image's `node` user (uid 1000).
if [ ! -d "${APP_DIR}/data" ]; then
    echo "!! ${APP_DIR}/data does not exist. Create it once: sudo install -d -o 1000 -g 1000 ${APP_DIR}/data" >&2
    exit 1
fi
if [ "$(stat -c %u "${APP_DIR}/data" 2>/dev/null || echo 1000)" != "1000" ]; then
    echo "!! ${APP_DIR}/data must belong to uid 1000: sudo chown -R 1000:1000 ${APP_DIR}/data" >&2
    exit 1
fi

read_tag() {
    [ -f "$ENV_FILE" ] || return 0
    grep -E '^WEB_TAG=' "$ENV_FILE" | head -n1 | cut -d= -f2- || true
}

# Through a temp file and a rename: `sed -i` differs between GNU and BSD, and a
# crash halfway cannot leave a truncated .env behind.
write_tag() {
    local tmp
    tmp="$(mktemp "${ENV_FILE}.XXXXXX")"
    if [ -f "$ENV_FILE" ] && grep -qE '^WEB_TAG=' "$ENV_FILE"; then
        sed "s|^WEB_TAG=.*|WEB_TAG=$1|" "$ENV_FILE" > "$tmp"
    else
        if [ -f "$ENV_FILE" ]; then cat "$ENV_FILE" > "$tmp"; fi
        printf 'WEB_TAG=%s\n' "$1" >> "$tmp"
    fi
    mv "$tmp" "$ENV_FILE"
}

# The image declares its own HEALTHCHECK, so a missing one means the image was
# built wrong, and accepting it would make this gate a no-op.
wait_healthy() {
    local deadline=$((SECONDS + 120)) cid state
    while [ "$SECONDS" -lt "$deadline" ]; do
        cid="$(docker compose ps -q web 2>/dev/null || true)"
        if [ -n "$cid" ]; then
            state="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}nohealthcheck{{end}}' "$cid" 2>/dev/null || echo starting)"
            case "$state" in
                healthy)       return 0 ;;
                unhealthy)     echo "   web reported unhealthy."; return 1 ;;
                nohealthcheck) echo "   the image declares no HEALTHCHECK; refusing it."; return 1 ;;
            esac
        fi
        sleep 2
    done
    echo "   Timed out waiting for web to become healthy."
    return 1
}

PREVIOUS_TAG="$(read_tag)"
PREVIOUS_TAG="${PREVIOUS_TAG:-latest}"

echo ">> Deploying web: ${PREVIOUS_TAG} -> ${TAG}"
write_tag "$TAG"

rollback() {
    echo
    echo "!! Rolling web back to ${PREVIOUS_TAG}."
    write_tag "$PREVIOUS_TAG"
    docker compose pull web || true
    docker compose up -d web || true
    if wait_healthy; then
        echo ">> Rolled back to ${PREVIOUS_TAG}; web is healthy."
    else
        echo "!! ROLLBACK DID NOT REACH HEALTHY. MANUAL INTERVENTION REQUIRED."
        docker compose logs --tail 50 web || true
    fi
    exit 1
}

# Every failure from here on goes through `rollback`, never through `set -e`:
# an unguarded failure would leave .env naming a tag that never ran, and the
# next deploy would take it as the version to roll back to.
if ! docker compose pull web; then
    echo "!! Could not pull ${TAG}. Does it exist in GHCR, and is the package still public?"
    echo "!! Never docker login ghcr.io on this host: it would replace Grazia's credential."
    rollback
fi
if ! docker compose up -d web; then
    echo "!! Could not start the container."
    rollback
fi

echo ">> Waiting for web to report healthy..."
wait_healthy || rollback
echo ">> web is healthy on ${TAG}."

# Every deploy pulls a new image. Keep the running one and the one before it,
# so a rollback needs no network, and drop Lectio's other tags.
repository="$(docker compose config --images web | head -n1)"
repository="${repository%:*}"
docker image ls "$repository" --format '{{.Repository}}:{{.Tag}}' \
    | grep -vxF -e "${repository}:${TAG}" -e "${repository}:${PREVIOUS_TAG}" \
    | xargs -r docker image rm >/dev/null 2>&1 || true
# Untagged layers left behind by the pull.
docker image prune -f >/dev/null 2>&1 || true
