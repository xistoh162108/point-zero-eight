#!/usr/bin/env bash
# Build the static site and copy it to the server. Usage: scripts/deploy.sh
# Old hashed files under _next/static are kept on purpose: a phone that opened the page
# before this deploy may still ask for them.
set -euo pipefail
HOST="${DEPLOY_HOST:-root@206.189.92.225}"
cd "$(dirname "$0")/.."
npm test
npm run build
rsync -az out/ "$HOST:/var/www/pze/"
curl -fsS -o /dev/null -w "https://129.212.216.42/ -> %{http_code}\n" https://129.212.216.42/
