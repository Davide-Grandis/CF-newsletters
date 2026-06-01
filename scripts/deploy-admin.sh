#!/usr/bin/env bash
#
# Deploy the admin worker (Newsletter Admin Console).
#
# Builds the React SPA into workers/admin/public, then deploys the admin
# worker to the ENEA PoC account. The worker is served on its custom
# hostname (console.eneanewsletter.it) and gated by Cloudflare Access.
#
# After a successful deploy it commits any pending changes and pushes to
# GitHub (origin). Pass a commit message as the first argument; otherwise a
# timestamped default is used.
#
# Usage:
#   ./scripts/deploy-admin.sh
#   ./scripts/deploy-admin.sh "tweak dashboard cards"
#
# Requirements:
#   - wrangler authenticated (npx wrangler login)
#   - web/ dependencies installed (cd web && npm install)
#   - git remote 'origin' configured

set -euo pipefail

# ENEA PoC account — set so wrangler does not prompt for account selection.
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-e1da20c7e9f2e83d2f97f9f73cfbb9dc}"

# Resolve repo root from this script's location so it works from any cwd.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Building SPA"
npm run build:web

echo "==> Deploying admin worker (account: $CLOUDFLARE_ACCOUNT_ID)"
(cd workers/admin && npx wrangler deploy)

echo "==> Pushing to GitHub"
if [[ -n "$(git status --porcelain)" ]]; then
  MSG="${1:-deploy admin worker ($(date -u '+%Y-%m-%d %H:%M UTC'))}"
  git add -A
  git commit -m "$MSG"
else
  echo "    No changes to commit."
fi
git push origin HEAD

echo "==> Done. Console: https://console.eneanewsletter.it/"
