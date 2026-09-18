#!/usr/bin/env bash
# ==============================================================================
# Cloudflare Deployment Script for uniswap-v2-trader
# Supports Cloudflare Pages and Cloudflare Workers (Static Assets)
# ==============================================================================

set -eo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Color definitions
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default parameters
TARGET="pages"
SKIP_BUILD=false
RUN_TEST=false
BRANCH="main"
PROJECT_NAME="pk-trader-test"

print_banner() {
  echo -e "${CYAN}======================================================${NC}"
  echo -e "${CYAN}     Uniswap V2 Trader - Cloudflare Deployment        ${NC}"
  echo -e "${CYAN}======================================================${NC}"
}

# Parse command line options
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target|-t)
      TARGET="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --test)
      RUN_TEST=true
      shift
      ;;
    --branch|-b)
      BRANCH="$2"
      shift 2
      ;;
    --project-name|-p)
      PROJECT_NAME="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: bash scripts/deploy-cloudflare.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  -t, --target [pages|workers|both]   Deployment target (default: pages)"
      echo "  --skip-build                       Skip running 'pnpm build'"
      echo "  --test                             Run E2E verification test after deployment"
      echo "  -b, --branch <name>                Target branch (default: main)"
      echo "  -p, --project-name <name>          Cloudflare project name (default: pk-trader-test)"
      echo "  -h, --help                         Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

print_banner
echo -e "Target:       ${YELLOW}${TARGET}${NC}"
echo -e "Project Name: ${YELLOW}${PROJECT_NAME}${NC}"
echo -e "Branch:       ${YELLOW}${BRANCH}${NC}"
echo -e "Skip Build:   ${YELLOW}${SKIP_BUILD}${NC}"
echo -e "Run Tests:    ${YELLOW}${RUN_TEST}${NC}"
echo "------------------------------------------------------"

# 1. Check environment prerequisites
echo -e "\n${CYAN}[1/4] Checking prerequisites & Cloudflare credentials...${NC}"
if ! command -v pnpm &> /dev/null; then
  echo -e "${RED}Error: pnpm is not installed.${NC}"
  exit 1
fi

if [[ -z "$CLOUDFLARE_API_TOKEN" ]] && [[ -z "$CLOUDFLARE_ACCOUNT_ID" ]]; then
  echo -e "${YELLOW}Warning: CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID is not set in environment.${NC}"
  echo -e "Checking if wrangler has cached authentication..."
fi

# 2. Build the project (unless skipped)
if [ "$SKIP_BUILD" = false ]; then
  echo -e "\n${CYAN}[2/4] Building production assets (tsc -b && vite build)...${NC}"
  pnpm build
  echo -e "${GREEN}✓ Build completed successfully.${NC}"
else
  echo -e "\n${YELLOW}[2/4] Skipping build as requested.${NC}"
fi

if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
  echo -e "${RED}Error: dist/index.html not found! Build failed or dist directory is empty.${NC}"
  exit 1
fi

# 3. Deploy to Cloudflare
echo -e "\n${CYAN}[3/4] Deploying to Cloudflare ($TARGET)...${NC}"

PAGES_URL=""
WORKERS_URL=""

if [[ "$TARGET" == "pages" || "$TARGET" == "both" ]]; then
  echo -e "Deploying static assets to Cloudflare Pages [${PROJECT_NAME}]..."
  DEPLOY_OUTPUT=$(pnpm wrangler pages deploy dist \
    --project-name "$PROJECT_NAME" \
    --branch "$BRANCH" \
    --commit-dirty=true 2>&1)

  echo "$DEPLOY_OUTPUT"
  
  # Extract deployment URL
  PAGES_URL=$(echo "$DEPLOY_OUTPUT" | grep -o 'https://[^ ]*\.pages\.dev' | tail -n 1 || true)
  if [[ -z "$PAGES_URL" ]]; then
    PAGES_URL="https://${PROJECT_NAME}.pages.dev"
  fi
  echo -e "${GREEN}✓ Cloudflare Pages deployment completed: ${PAGES_URL}${NC}"
fi

if [[ "$TARGET" == "workers" || "$TARGET" == "both" ]]; then
  echo -e "Deploying static assets to Cloudflare Workers..."
  WORKER_OUTPUT=$(pnpm wrangler deploy --config wrangler.workers.jsonc 2>&1)
  echo "$WORKER_OUTPUT"
  
  WORKERS_URL=$(echo "$WORKER_OUTPUT" | grep -o 'https://[^ ]*\.workers\.dev' | tail -n 1 || true)
  echo -e "${GREEN}✓ Cloudflare Workers deployment completed: ${WORKERS_URL}${NC}"
fi

PRIMARY_URL="${PAGES_URL:-$WORKERS_URL}"

echo -e "\n${CYAN}======================================================${NC}"
echo -e "${GREEN}🎉 Deployment Successful!${NC}"
if [[ -n "$PAGES_URL" ]]; then
  echo -e "Pages URL:   ${GREEN}${PAGES_URL}${NC} (Production: https://${PROJECT_NAME}.pages.dev)"
fi
if [[ -n "$WORKERS_URL" ]]; then
  echo -e "Workers URL: ${GREEN}${WORKERS_URL}${NC}"
fi
echo -e "${CYAN}======================================================${NC}"

# 4. Run automated post-deploy verification test if requested
if [ "$RUN_TEST" = true ]; then
  echo -e "\n${CYAN}[4/4] Executing deployment verification tests on ${PRIMARY_URL}...${NC}"
  export DEPLOY_URL="$PRIMARY_URL"
  pnpm tsx scripts/test-cf-deployment.ts "$PRIMARY_URL"
else
  echo -e "\n${YELLOW}Tip: To verify the deployment, run:${NC}"
  echo -e "  pnpm test:cf ${PRIMARY_URL}"
fi
