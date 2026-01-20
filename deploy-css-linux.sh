#!/usr/bin/env bash
# =============================================================================
# CSS Deployment Script - Linux Version WITH INTERACTIVE VERSIONING
# Auto:    Version++ → Minify → S3 → CloudFront → Git → EC2
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# =============================================================================
# CONFIGURATION
# =============================================================================

PROJECT_DIR="$HOME/Projects/Payroll-NodeJs"
CSS_SOURCE="$PROJECT_DIR/public/css/main.css"
CSS_MINIFIED="$PROJECT_DIR/public/css/main.min.css"
PACKAGE_JSON="$PROJECT_DIR/package.json"

# AWS Configuration
S3_BUCKET="employee-certificates-webpayrollsolutions-central"
S3_CSS_PATH="assets/own/css/main.min.css"
AWS_REGION="eu-central-1"
CDN_URL="https://cdn.webpayrollsolutions.com"
CLOUDFRONT_DIST_ID="E2FVQEZRP01HIX"

# EC2 Configuration
EC2_KEY="$HOME/Utilities/AWS-EC2-S3/pair-key-pem/Payroll_NodeJS_Server_Frankfurt.pem"
EC2_USER_HOST="ubuntu@63.178.15.216"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${CYAN}👉 $1${NC}"
}

# =============================================================================
# VERSION MANAGEMENT FUNCTIONS
# =============================================================================

increment_patch() {
    local version=$1
    local array=($(echo "$version" | tr '.' '\n'))
    array[2]=$((array[2]+1))
    echo "${array[0]}.${array[1]}.${array[2]}"
}

increment_minor() {
    local version=$1
    local array=($(echo "$version" | tr '.' '\n'))
    array[1]=$((array[1]+1))
    array[2]=0
    echo "${array[0]}.${array[1]}.${array[2]}"
}

increment_major() {
    local version=$1
    local array=($(echo "$version" | tr '.' '\n'))
    array[0]=$((array[0]+1))
    array[1]=0
    array[2]=0
    echo "${array[0]}.${array[1]}.${array[2]}"
}

# =============================================================================
# START
# =============================================================================

START_TIME=$(date +%s)

echo ""
echo "=========================================="
echo "🎨 CSS DEPLOYMENT WITH VERSIONING"
echo "=========================================="
echo "Start Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

cd "$PROJECT_DIR" || { log_error "Directory $PROJECT_DIR not found. "; exit 1; }

# =============================================================================
# STEP 0: VERSION MANAGEMENT
# =============================================================================

log_step "Step 0: Version Management..."
echo ""

if [[ !  -f "$PACKAGE_JSON" ]]; then
    log_error "package.json not found!"
    exit 1
fi

# Read current version
CURRENT_VERSION=$(grep '"version"' "$PACKAGE_JSON" | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📦 Current version: ${GREEN}$CURRENT_VERSION${NC}"
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Calculate preview versions
PATCH_VERSION=$(increment_patch "$CURRENT_VERSION")
MINOR_VERSION=$(increment_minor "$CURRENT_VERSION")
MAJOR_VERSION=$(increment_major "$CURRENT_VERSION")

echo "Select version bump type:"
echo ""
echo -e "  ${GREEN}1)${NC} Patch (bug fix / CSS update)    ${CURRENT_VERSION} → ${GREEN}$PATCH_VERSION${NC}"
echo -e "  ${BLUE}2)${NC} Minor (new feature)              ${CURRENT_VERSION} → ${BLUE}$MINOR_VERSION${NC}"
echo -e "  ${RED}3)${NC} Major (breaking change)          ${CURRENT_VERSION} → ${RED}$MAJOR_VERSION${NC}"
echo -e "  ${YELLOW}4)${NC} Skip (keep current version)      ${CURRENT_VERSION} → ${YELLOW}$CURRENT_VERSION${NC}"
echo ""

read -p "Choice [1]:  " BUMP_CHOICE
BUMP_CHOICE=${BUMP_CHOICE:-1}

case $BUMP_CHOICE in
    1)
        NEW_VERSION="$PATCH_VERSION"
        BUMP_TYPE="Patch"
        ;;
    2)
        NEW_VERSION="$MINOR_VERSION"
        BUMP_TYPE="Minor"
        ;;
    3)
        NEW_VERSION="$MAJOR_VERSION"
        BUMP_TYPE="Major"
        ;;
    4)
        NEW_VERSION="$CURRENT_VERSION"
        BUMP_TYPE="Skip"
        log_warning "Keeping current version:  $CURRENT_VERSION"
        ;;
    *)
        log_warning "Invalid choice, defaulting to Patch"
        NEW_VERSION="$PATCH_VERSION"
        BUMP_TYPE="Patch"
        ;;
esac

if [[ "$NEW_VERSION" != "$CURRENT_VERSION" ]]; then
    # Update package.json
    sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$PACKAGE_JSON"
    
    if [[ $? -eq 0 ]]; then
        echo ""
        echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}✅ Version updated:  ${CURRENT_VERSION} → ${NEW_VERSION} (${BUMP_TYPE})${NC}"
        echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    else
        log_error "Failed to update version!"
        exit 1
    fi
fi

echo ""

# =============================================================================
# STEP 1: CSS MINIFY + S3 UPLOAD
# =============================================================================

log_step "Step 1: Minifying CSS and uploading to S3..."

if [[ ! -f "$CSS_SOURCE" ]]; then
    log_error "Source CSS not found: $CSS_SOURCE"
    exit 1
fi

ORIGINAL_SIZE=$(stat -c%s "$CSS_SOURCE" 2>/dev/null || stat -f%z "$CSS_SOURCE" 2>/dev/null)
log_info "Original size: $ORIGINAL_SIZE bytes"

# ONE COMMAND:  Minify + Upload
npm run css:deploy

if [[ $? -ne 0 ]]; then
    log_error "CSS deployment failed!"
    exit 1
fi

if [[ ! -f "$CSS_MINIFIED" ]]; then
    log_error "Minified file not created:  $CSS_MINIFIED"
    exit 1
fi

MINIFIED_SIZE=$(stat -c%s "$CSS_MINIFIED" 2>/dev/null || stat -f%z "$CSS_MINIFIED" 2>/dev/null)
REDUCTION=$(( 100 - (MINIFIED_SIZE * 100 / ORIGINAL_SIZE) ))

log_success "CSS minified and uploaded to S3!"
log_info "Minified:  $MINIFIED_SIZE bytes (${REDUCTION}% reduction)"
log_info "S3 Path: s3://$S3_BUCKET/$S3_CSS_PATH"
echo ""

# =============================================================================
# STEP 2: CLOUDFRONT INVALIDATION
# =============================================================================

log_step "Step 2: Invalidating CloudFront cache..."

# Add timeout to prevent hanging (10 seconds max)
INVALIDATION_RESULT=$(timeout 10s aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DIST_ID" \
    --paths "/$S3_CSS_PATH" \
    --region us-east-1 \
    --output json 2>&1)

INVALIDATION_EXIT_CODE=$? 

if [[ $INVALIDATION_EXIT_CODE -eq 124 ]]; then
    # Timeout occurred
    log_warning "CloudFront invalidation timed out after 10s (non-critical)"
    log_info "CDN will update naturally within 24 hours"
elif [[ $INVALIDATION_EXIT_CODE -eq 0 ]]; then
    # Success
    INVAL_ID=$(echo "$INVALIDATION_RESULT" | grep -o '"Id": "[^"]*"' | head -1 | cut -d'"' -f4)
    if [[ -n "$INVAL_ID" ]]; then
        log_success "CloudFront invalidation created (ID:  $INVAL_ID)"
        log_info "Cache will clear in ~2-3 minutes"
    else
        log_warning "CloudFront invalidation completed but ID not found"
    fi
else
    # Other error
    log_warning "CloudFront invalidation failed (non-critical)"
    log_info "CDN will update naturally within 24 hours"
fi

echo ""

# =============================================================================
# STEP 3: GIT COMMIT & PUSH
# =============================================================================

log_step "Step 3: Committing to Git..."

read -p "💬 Enter commit message (or press Enter for default): " COMMIT_MSG

if [[ -z "$COMMIT_MSG" ]]; then
    if [[ "$NEW_VERSION" != "$CURRENT_VERSION" ]]; then
        COMMIT_MSG="Update CSS v$NEW_VERSION ($BUMP_TYPE) - $(date '+%Y-%m-%d %H:%M:%S')"
    else
        COMMIT_MSG="Update CSS - $(date '+%Y-%m-%d %H:%M:%S')"
    fi
fi

# Add files (including package.json if version changed)
if [[ "$NEW_VERSION" != "$CURRENT_VERSION" ]]; then
    git add app.js package.json public/css/main.css public/css/main.min.css
else
    git add app.js public/css/main.css public/css/main.min.css
fi

if [[ -n $(git status --porcelain) ]]; then
    git commit -m "$COMMIT_MSG"
    log_success "Changes committed"
    
    log_info "Pushing to GitHub..."
    git push origin main
    
    if [[ $? -eq 0 ]]; then
        log_success "Pushed to GitHub"
    else
        log_warning "Git push failed (check credentials)"
    fi
else
    log_info "No changes to commit"
fi

echo ""

# =============================================================================
# STEP 4: EC2 DEPLOYMENT
# =============================================================================

read -p "🌐 Deploy to EC2? (y/n): " DEPLOY_EC2

if [[ "$DEPLOY_EC2" == "y" || "$DEPLOY_EC2" == "Y" ]]; then
    echo ""
    log_step "Step 4: Deploying to EC2..."
    
    log_info "Connecting to EC2: $EC2_USER_HOST"
    
    ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER_HOST" bash <<'ENDSSH'
        set -euo pipefail
        
        echo "[EC2] Navigating to project directory..."
        cd ~/Payroll-NodeJs
        
        echo "[EC2] Pulling latest changes from GitHub..."
        git pull origin main
        
        echo "[EC2] Restarting application with PM2..."
        pm2 restart all --update-env
        
        echo ""
        echo "[EC2] PM2 Status:"
        pm2 list
        
        echo ""
        echo "[EC2] ✅ Deployment complete!"
ENDSSH
    
    if [[ $? -eq 0 ]]; then
        log_success "EC2 deployment completed successfully!"
    else
        log_error "EC2 deployment failed!"
        exit 1
    fi
else
    log_info "Skipping EC2 deployment"
fi

echo ""

# =============================================================================
# SUMMARY
# =============================================================================

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "=========================================="
echo "🎉 CSS DEPLOYMENT COMPLETE!"
echo "=========================================="
echo "End Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Duration: ${DURATION}s"
echo ""
echo "📊 SUMMARY:"
if [[ "$NEW_VERSION" != "$CURRENT_VERSION" ]]; then
    echo "  ✅ Version updated:  $CURRENT_VERSION → $NEW_VERSION ($BUMP_TYPE)"
else
    echo "  ℹ️  Version unchanged:  $CURRENT_VERSION"
fi
echo "  ✅ CSS minified: $ORIGINAL_SIZE → $MINIFIED_SIZE bytes (${REDUCTION}% reduction)"
echo "  ✅ Uploaded to S3: s3://$S3_BUCKET/$S3_CSS_PATH"
echo "  ✅ CDN URL: $CDN_URL/$S3_CSS_PATH"
echo "  ✅ CloudFront invalidated"
echo "  ✅ Changes committed to Git"
if [[ "$DEPLOY_EC2" == "y" || "$DEPLOY_EC2" == "Y" ]]; then
    echo "  ✅ Deployed to EC2"
fi
echo ""
echo "💡 NEXT STEPS:"
echo "  1. Wait 2-3 minutes for CloudFront cache to clear"
echo "  2. Clear browser cache: Ctrl+Shift+Delete"
echo "  3. Hard refresh: Ctrl+Shift+R"
echo ""
echo "=========================================="
echo ""
