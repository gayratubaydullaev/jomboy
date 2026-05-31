#!/usr/bin/env sh
# Roll back API and/or Web to a previous GHCR image tag.
# Usage:
#   ./scripts/deploy-rollback.sh api abc1234
#   ./scripts/deploy-rollback.sh web abc1234
#   ./scripts/deploy-rollback.sh all abc1234
set -eu

SERVICE="${1:-}"
TAG="${2:-}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.deploy.yml}"
REGISTRY="${REGISTRY:-ghcr.io}"
OWNER="${GHCR_OWNER:-placeholder}"
REPO="${GHCR_REPO:-myshopuz}"

if [ -z "$SERVICE" ] || [ -z "$TAG" ]; then
  echo "Usage: $0 <api|web|all> <image-tag>"
  echo "Example: $0 all abc1234"
  exit 1
fi

rollback_api() {
  export DEPLOY_IMAGE="${REGISTRY}/${OWNER}/${REPO}-api:${TAG}"
  echo "Rolling back API to ${DEPLOY_IMAGE}"
  docker compose -f "$COMPOSE_FILE" pull api
  docker compose -f "$COMPOSE_FILE" up -d --wait api
}

rollback_web() {
  export DEPLOY_WEB_IMAGE="${REGISTRY}/${OWNER}/${REPO}-web:${TAG}"
  echo "Rolling back Web to ${DEPLOY_WEB_IMAGE}"
  docker compose -f "$COMPOSE_FILE" pull web
  docker compose -f "$COMPOSE_FILE" up -d --wait web
}

case "$SERVICE" in
  api) rollback_api ;;
  web) rollback_web ;;
  all)
    rollback_api
    rollback_web
    ;;
  *)
    echo "Unknown service: $SERVICE (use api, web, or all)"
    exit 1
    ;;
esac

docker compose -f "$COMPOSE_FILE" ps
echo "Rollback complete."
