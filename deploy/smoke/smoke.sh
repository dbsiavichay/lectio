#!/usr/bin/env bash
#
# Rehearses the production topology on this machine (and in CI): the stack in
# deploy/compose.yml, hardened as on the VPS, behind a Caddy that loads
# caddy/lectio.caddy the way the edge does.
#
#   deploy/smoke/smoke.sh up      start the stack from lectio:smoke
#   deploy/smoke/smoke.sh check   probe it through the proxy and inside
#   deploy/smoke/smoke.sh down    remove the containers, network and volume
#
# Build the image first:  docker build -t lectio:smoke .
#
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "${DEPLOY_DIR}/.." && pwd)"
DOMAIN="lectio.dbsiavichay.dev"
HTTPS_PORT=8643
HTTP_PORT=8280

compose() {
    docker compose -f "${DEPLOY_DIR}/compose.yml" -f "${DEPLOY_DIR}/smoke/compose.yml" "$@"
}

fetch() {
    local path="$1"
    shift
    curl -ks --resolve "${DOMAIN}:${HTTPS_PORT}:127.0.0.1" "$@" "https://${DOMAIN}:${HTTPS_PORT}${path}"
}

wait_healthy() {
    local deadline=$((SECONDS + 90)) cid state
    while [ "$SECONDS" -lt "$deadline" ]; do
        cid="$(compose ps -q web 2>/dev/null || true)"
        state="$( [ -n "$cid" ] && docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || echo missing)"
        [ "$state" = "healthy" ] && return 0
        sleep 2
    done
    echo "ERROR: web is not healthy (${state})." >&2
    compose logs --tail 50 web >&2 || true
    return 1
}

up() {
    compose up -d
    wait_healthy
    local deadline=$((SECONDS + 30))
    until fetch /healthz -o /dev/null -f; do
        [ "$SECONDS" -lt "$deadline" ] || { echo "ERROR: the proxy does not answer." >&2; compose logs --tail 50 edge >&2; exit 1; }
        sleep 1
    done
    echo ">> Up: https://${DOMAIN}:${HTTPS_PORT} (resolve ${DOMAIN} to 127.0.0.1; self-signed)"
}

check() {
    local failed=0 headers body logs
    expect() {
        local desc="$1"
        shift
        if "$@"; then echo "   ok    ${desc}"; else echo "   FAIL  ${desc}"; failed=1; fi
    }
    matches() { printf '%s' "$1" | grep -qiE "$2"; }
    not() { ! "$@"; }
    status() { printf '%s' "$1" | awk 'NR==1 {print $2}'; }
    run() { compose exec -T "$@" </dev/null; }

    echo ">> Probing https://${DOMAIN}:${HTTPS_PORT}"
    body="$(fetch /healthz)"
    expect "health check through the proxy" matches "$body" '"status":"ok"'
    if [ -n "${EXPECT_SHA:-}" ]; then
        expect "the build answering is ${EXPECT_SHA:0:7}" matches "$body" "\"version\":\"${EXPECT_SHA}\""
    fi

    headers="$(fetch / -I)"
    expect "/ without a session goes to /entrar ($(status "$headers"))" [ "$(status "$headers")" = "307" ]
    expect "…on the same https origin" matches "$headers" "^location: (https://${DOMAIN}(:${HTTPS_PORT})?)?/entrar"

    # A GET, not a HEAD: Caddy only compresses a streamed page when it has a body.
    headers="$(fetch /entrar -D - -o /dev/null -H 'Accept-Encoding: zstd, gzip')"
    expect "/entrar answers 200 ($(status "$headers"))" [ "$(status "$headers")" = "200" ]
    expect "CSP header" matches "$headers" "^content-security-policy: default-src 'self'"
    expect "HSTS header" matches "$headers" '^strict-transport-security:'
    expect "nosniff header" matches "$headers" '^x-content-type-options: nosniff'
    expect "Caddy compresses with zstd" matches "$headers" '^content-encoding: zstd'
    expect "no X-Powered-By header" not matches "$headers" '^x-powered-by:'
    expect "the web manifest is served" matches "$(fetch /manifest.webmanifest)" '"name":"Lectio"'

    headers="$(curl -s -I --resolve "${DOMAIN}:${HTTP_PORT}:127.0.0.1" "http://${DOMAIN}:${HTTP_PORT}/entrar")"
    expect "plain http redirects to https ($(status "$headers"))" matches "$(status "$headers")" '^30[18]$'

    # The command-line scripts and the native addons, inside the image.
    if ! matches "$(run web node scripts/user.mjs list)" '^smoke'; then
        expect "creates an administrator" run -e LECTIO_PASSWORD=smoke-password-123 web node scripts/user.mjs create smoke "Smoke" --admin
    fi
    tar -C "${ROOT_DIR}/content/fixtures" -cf - libro-ejemplo | compose exec -T web tar -xf - -C /app/data
    expect "imports the example book" run web node scripts/import-book.mjs /app/data/libro-ejemplo
    expect "takes a backup" run web node scripts/backup.mjs
    expect "the backup is on the data volume" run web sh -c 'ls /app/data/backups/lectio-*.db'

    compose restart web >/dev/null
    wait_healthy
    expect "the account survives a restart" matches "$(run web node scripts/user.mjs list)" '^smoke'

    expect "the root filesystem is read-only" not run web sh -c 'touch /app/write-test 2>/dev/null'
    expect "the data directory is writable" run web sh -c 'touch /app/data/write-test && rm /app/data/write-test'
    expect "the server runs as node, not root" matches "$(run web id -un)" '^node$'

    logs="$(compose logs --no-log-prefix web 2>&1)"
    expect "the server logged no errors" not matches "$logs" 'error|EROFS|EACCES|unhandled'

    if [ "$failed" -ne 0 ]; then
        echo ">> Some checks FAILED."
        compose logs --tail 30 web || true
        exit 1
    fi
    echo ">> All checks passed."
}

down() {
    compose down -v --remove-orphans
    echo ">> Smoke stack removed."
}

case "${1:-}" in
    up)    up ;;
    check) check ;;
    down)  down ;;
    *)     echo "usage: deploy/smoke/smoke.sh up|check|down" >&2; exit 2 ;;
esac
