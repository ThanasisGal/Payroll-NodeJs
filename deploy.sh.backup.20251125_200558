#!/usr/bin/env bash
# =============================================================================
# Production Deployment Script v2.0 - PHASE 1
# Supports: ES6 Modules, CloudFront CDN, Minification, Obfuscation
# 
# Usage:
#   DEV:  OBF_ENV=dev ./deploy.sh
#   PROD: OBF_ENV=prod ./deploy.sh (default)
#   Skip CDN: UPLOAD_TO_CDN=false ./deploy.sh
#   Skip obfuscation: SKIP_OBFUSCATION=true ./deploy.sh
# 
# PHASE 1: Core files only (~78 files)
#   - ES6 Modules (20 files) - NO obfuscation
#   - Common files (56 files) - WITH obfuscation
#   - Utils (2 files) - WITH obfuscation
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# =============================================================================
# CONFIGURATION
# =============================================================================

PROJECT_DIR="/cygdrive/c/Payroll-NodeJs"
BUILD_DIR="$PROJECT_DIR/build"
OUTPUT_DIR="$PROJECT_DIR/public/min.js"

# AWS Configuration
S3_BUCKET="${S3_BUCKET:-employee-certificates-webpayrollsolutions-central}"
S3_PREFIX="static/min.js"
CLOUDFRONT_DIST_ID="${CLOUDFRONT_DIST_ID:-E3F1QE9DQ1H6X}"
AWS_REGION="${AWS_REGION:-eu-central-1}"
CDN_URL="https://cdn.webpayrollsolutions.com"

# EC2 Configuration
EC2_KEY="/cygdrive/c/Users/User/Desktop/AWS-EC2-S3/pair-key-pem/Payroll_NodeJS_Server_Frankfurt.pem"
EC2_USER_HOST="ubuntu@63.178.15.216"
REMOTE_DIR="~/Payroll-NodeJs"
EXCLUDES_FILE="$PROJECT_DIR/rsync-excludes.txt"

# Build Configuration
OBF_ENV="${OBF_ENV:-prod}"
SKIP_OBFUSCATION="${SKIP_OBFUSCATION:-false}"
UPLOAD_TO_CDN="${UPLOAD_TO_CDN:-true}"
APP_VERSION=$(date '+%Y%m%d%H%M%S')
DEPLOYMENT_PHASE="Phase 1"

# Disk & Swap
DISK_THRESHOLD=500 # MB
SWAP_SIZE="4G"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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
    echo -e "${PURPLE}👉 $1${NC}"
}

log_phase() {
    echo -e "${CYAN}🚀 $1${NC}"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 not found. Please install it first."
        exit 1
    fi
}

# =============================================================================
# PREREQUISITES CHECK
# =============================================================================

log_info "Checking prerequisites..."

cd "$PROJECT_DIR" || { log_error "Directory $PROJECT_DIR not found."; exit 1; }

check_command "node"
check_command "npm"
check_command "git"
check_command "rsync"
check_command "ssh"
check_command "aws"

# Check Node packages
if ! npm list -g terser &>/dev/null; then
    log_warning "Terser not installed globally. Installing..."
    npm install -g terser
fi

if [[ "$SKIP_OBFUSCATION" == "false" ]] && ! npm list -g javascript-obfuscator &>/dev/null; then
    log_warning "javascript-obfuscator not installed. Installing..."
    npm install -g javascript-obfuscator
fi

log_success "All prerequisites met."

# =============================================================================
# DISK SPACE CHECK
# =============================================================================

log_info "Checking disk space..."
AVAILABLE_DISK=$(df --output=avail / | tail -n 1 | tr -d ' ')
if (( AVAILABLE_DISK < DISK_THRESHOLD * 1024 )); then
  log_error "Not enough disk space: ${AVAILABLE_DISK} KB available, ${DISK_THRESHOLD} MB required."
  exit 1
fi
log_success "Disk space OK ($(( AVAILABLE_DISK / 1024 )) MB available)"

# =============================================================================
# GIT STATUS
# =============================================================================

log_info "Current Git status:"
git status --short

# =============================================================================
# CLEANUP
# =============================================================================

log_info "Cleaning build directories..."

rm -rf "$BUILD_DIR"
rm -rf "$OUTPUT_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$OUTPUT_DIR"

log_success "Cleanup complete."

# =============================================================================
# BUILD FUNCTIONS
# =============================================================================

# Minify with Terser (preserves ES6 modules)
minify_file() {
    local input="$1"
    local output="$2"
    local is_module="${3:-false}"
    
    mkdir -p "$(dirname "$output")"
    
    # Cygwin path fix
    if uname -o 2>/dev/null | grep -qi 'cygwin'; then
        input=$(cygpath -m "$input")
        output=$(cygpath -m "$output")
    fi
    
    log_step "Minifying: ${input#"$PROJECT_DIR/"}"
    
    local terser_args=(
        "$input"
        --compress "passes=2,drop_console=true,drop_debugger=true"
        --mangle "reserved=['require','exports','module','define','Decimal','Swal','$','jQuery']"
        --output "$output"
    )
    
    # Add module flag for ES6 modules
    if [[ "$is_module" == "true" ]]; then
        terser_args+=(--module)
        log_info "  → ES6 Module mode"
    fi
    
    # Add source map for dev
    if [[ "$OBF_ENV" == "dev" ]]; then
        terser_args+=(--source-map "url=$(basename "$output").map")
    fi
    
    terser "${terser_args[@]}" || {
        log_error "Minification failed: $input"
        return 1
    }
    
    local original_size=$(stat -c%s "$input" 2>/dev/null || stat -f%z "$input" 2>/dev/null || echo "0")
    local minified_size=$(stat -c%s "$output" 2>/dev/null || stat -f%z "$output" 2>/dev/null || echo "0")
    local reduction=0
    if [[ $original_size -gt 0 ]]; then
        reduction=$(( 100 - (minified_size * 100 / original_size) ))
    fi
    
    log_success "  → $(basename "$output") (${reduction}% smaller: $original_size → $minified_size bytes)"
}

# Obfuscate (optional, for non-modules only)
obfuscate_file() {
    local input="$1"
    local output="$2"
    
    if [[ "$SKIP_OBFUSCATION" == "true" ]]; then
        cp "$input" "$output"
        return 0
    fi
    
    mkdir -p "$(dirname "$output")"
    
    # Cygwin path fix
    if uname -o 2>/dev/null | grep -qi 'cygwin'; then
        input=$(cygpath -m "$input")
        output=$(cygpath -m "$output")
    fi
    
    local base_name=$(basename "$input" .min.js)
    base_name=$(basename "$base_name" .js)
    local id_prefix="__${base_name}__"
    
    log_step "Obfuscating: ${input#"$PROJECT_DIR/"}"
    
    declare -a obf_args=(
        --compact true
        --identifier-names-generator mangled
        --string-array true
        --string-array-threshold 0.2
        --identifiers-prefix "$id_prefix"
        --reserved-names '^\$|^jQuery$|^document$|^window$|^console$|^navigator$|^Decimal$|^Swal$'
        --debug-protection false
        --self-defending false
    )
    
    if [[ "$OBF_ENV" == "dev" ]]; then
        obf_args+=(
            --disable-console-output false
            --control-flow-flattening false
            --dead-code-injection false
            --source-map true
        )
    else
        obf_args+=(
            --disable-console-output true
            --control-flow-flattening false
            --dead-code-injection false
        )
    fi
    
    javascript-obfuscator "$input" \
        --output "$output" \
        "${obf_args[@]}" \
        || {
            log_error "Obfuscation failed: $input"
            return 1
        }
    
    log_success "  → Obfuscated"
}

# Process file (minify + optional obfuscate)
process_file() {
    local source_path="$1"      # e.g., public/js/modules/apodoxesCalculations.js
    local is_module="${2:-false}"
    
    local rel_path="${source_path#public/js/}"  # modules/apodoxesCalculations.js
    
    # Step 1: Minify
    local minified="$BUILD_DIR/${rel_path%.js}.min.js"
    minify_file "$source_path" "$minified" "$is_module" || return 1
    
    # Step 2: Obfuscate (only non-modules)
    local final_output="$OUTPUT_DIR/${rel_path%.js}.min.js"
	mkdir -p "$(dirname "$final_output")"
    if [[ "$is_module" == "true" || "$SKIP_OBFUSCATION" == "true" ]]; then
        # Modules: No obfuscation, just copy minified
        cp "$minified" "$final_output"
        log_info "  → Module preserved (no obfuscation)"
    else
        # Non-modules: Obfuscate
        obfuscate_file "$minified" "$final_output" || return 1
    fi
}

# =============================================================================
# FILE LISTS - PHASE 1
# =============================================================================

# ES6 MODULES (NO obfuscation) - 20 files
declare -a modules=(
    # Core calculation module
    "public/js/modules/apodoxesCalculations.js"
    
    # Utilities with exports
    "public/js/utils/formatNumber.js"
    
    # Common modules
    "public/js/common/dependentSelectToggle.js"
    "public/js/common/initTomDropdown.js"
    
    # Dropdown managers
    "public/js/dropdown-item.js"
    "public/js/dropdownManager.js"
    "public/js/searchableSelect.js"
    
    # Company dropdown chains
    "public/js/companies/genikastoixeia/initDoyDropdowns.js"
    "public/js/companies/genikastoixeia/initKadDropdowns.js"
    "public/js/companies/genikastoixeia/initNomikesMorfesDropdowns.js"
    "public/js/companies/genikastoixeia/initPararthmataEfkaDropdowns.js"
    "public/js/companies/genikastoixeia/initTameiaDropdowns.js"
    
    # Dropdown chains
    "public/js/efkaDropdownChain.js"
    "public/js/geoDropdownChain.js"
    "public/js/symbaseisDropdownChain.js"
    "public/js/symbaseisDropdownChain3-multi.js"
    "public/js/symbaseisDropdownChain3.js"
    
    # Employee modules
    "public/js/ergazomenoi/genika/addStoixeiaSymbaseon.js"
    "public/js/ergazomenoi/genika/reCalcApodoxes.js"
    "public/js/ergazomenoi/programmata/initYpokatasthmataDropdowns.js"
	
	# Problematic Files   (obfuscation fails)
	# "public/js/common/amka-validation.js"
	# "public/js/common/kathestos-apasxolhshs-fulltime-sync.js"
)

# UTILITIES (can obfuscate) - 2 files
declare -a utils=(
    "public/js/utils/scripts.js"
    "public/js/utils/tree.js"
)

# COMMON FILES (can obfuscate) - 56 files
declare -a common_files=(
    "public/js/common/adjustFontSizeToFit.js"
    "public/js/common/amka_validation.js"
    "public/js/common/blockInvalidClick.js"
    "public/js/common/changeFontSizeSelectDropdownMenu.js"
    "public/js/common/changeInputTypeFile.js"
    "public/js/common/changeUrl.js"
    "public/js/common/checkAfm.js"
    "public/js/common/checkAmka.js"
    "public/js/common/checkHlikia.js"
    "public/js/common/checkScreenAnalysis.js"
    "public/js/common/clearImage.js"
    "public/js/common/clearSection.js"
    "public/js/common/clearSelectsSymbaseon.js"
    "public/js/common/clearableInputs.js"
    "public/js/common/convertNumbers.js"
    "public/js/common/countdown.js"
    "public/js/common/createNavTree.js"
    "public/js/common/deviceSwitcher.js"
    "public/js/common/expandIcons.js"
    "public/js/common/formatDates.js"
    "public/js/common/formatNumbers_2dec.js"
    "public/js/common/formatTimes.js"
    "public/js/common/getAppDate.js"
    "public/js/common/getCompanyDescription.js"
    "public/js/common/getFieldValues.js"
    "public/js/common/getFocusNumberFields.js"
    "public/js/common/getPeriod.js"
    "public/js/common/getUser.js"
    "public/js/common/getUserRole.js"
    "public/js/common/getXrhsh.js"
    "public/js/common/hideTooltips.js"
    "public/js/common/ibanChecker.js"
    "public/js/common/kathestos_apasxolhshs_fulltime_sync.js"
    "public/js/common/logger.js"
    "public/js/common/makeMoreSpaceInMenuElements.js"
    "public/js/common/modal.js"
    "public/js/common/moveByEnter.js"
    "public/js/common/multipleChoicesDropdowns.js"
    "public/js/common/navTabs.js"
    "public/js/common/num2words.js"
    "public/js/common/putFieldValues.js"
    "public/js/common/readAndPreviewImage.js"
    "public/js/common/removeGreekAccentsAndToUpper.js"
    "public/js/common/scrollToTop.js"
    "public/js/common/searchFormSubmit.js"
    "public/js/common/sectionsVisible.js"
    "public/js/common/selectUnselectAndChangeButtonTextContent.js"
    "public/js/common/setupTabKeyNavigation.js"
    "public/js/common/showModal.js"
    "public/js/common/sidebar.js"
    "public/js/common/sortTable.js"
    "public/js/common/toggleLabel.js"
    "public/js/common/toggleLabelErgazomenon.js"
    "public/js/common/toggleLabelKrathseon.js"
    "public/js/common/toggleLabelSymbaseis.js"
    "public/js/common/tooltips.js"
    "public/js/common/tooltipsForButtons.js"
    "public/js/common/totalPercentChecker.js"
)

# =============================================================================
# BUILD PROCESS
# =============================================================================

echo ""
echo "=========================================="
echo "🚀 BUILD PROCESS STARTING - $DEPLOYMENT_PHASE"
echo "=========================================="
echo "Environment:    $OBF_ENV"
echo "Obfuscation:    $([ "$SKIP_OBFUSCATION" == "true" ] && echo "DISABLED" || echo "ENABLED")"
echo "CDN Upload:     $([ "$UPLOAD_TO_CDN" == "true" ] && echo "ENABLED" || echo "DISABLED")"
echo "Version:        $APP_VERSION"
echo "Phase:          $DEPLOYMENT_PHASE (Core files only)"
echo "Files:          ~78 files"
echo "=========================================="
echo ""

# Count files
TOTAL_FILES=$((${#modules[@]} + ${#utils[@]} + ${#common_files[@]}))
PROCESSED=0

# ES6 MODULES (no obfuscation, preserve imports/exports)
log_phase "PHASE 1.1: Building ES6 Modules (${#modules[@]} files)..."
echo ""

for file in "${modules[@]}"; do
    if [[ -f "$file" ]]; then
        PROCESSED=$((PROCESSED + 1))
        echo "[$PROCESSED/$TOTAL_FILES]"
        process_file "$file" true
        echo ""
    else
        log_warning "File not found: $file"
    fi
done

# UTILITIES (can be obfuscated)
log_phase "PHASE 1.2: Building utility files (${#utils[@]} files)..."
echo ""

for file in "${utils[@]}"; do
    if [[ -f "$file" ]]; then
        PROCESSED=$((PROCESSED + 1))
        echo "[$PROCESSED/$TOTAL_FILES]"
        process_file "$file" false
        echo ""
    else
        log_warning "File not found: $file"
    fi
done

# COMMON FILES (can be obfuscated)
log_phase "PHASE 1.3: Building common files (${#common_files[@]} files)..."
echo ""

for file in "${common_files[@]}"; do
    if [[ -f "$file" ]]; then
        PROCESSED=$((PROCESSED + 1))
        echo "[$PROCESSED/$TOTAL_FILES]"
        process_file "$file" false
        echo ""
    else
        log_warning "File not found: $file"
    fi
done

echo ""
log_success "Build complete! Processed $PROCESSED/$TOTAL_FILES files"
log_info "Output directory: $OUTPUT_DIR"
echo ""

# Show summary
log_info "Build summary:"
du -sh "$OUTPUT_DIR" 2>/dev/null || echo "  Size calculation failed"
find "$OUTPUT_DIR" -type f -name "*.min.js" | wc -l | xargs echo "  Files created:"

# =============================================================================
# UPLOAD TO S3/CLOUDFRONT
# =============================================================================

if [[ "$UPLOAD_TO_CDN" == "true" && "$OBF_ENV" == "prod" ]]; then
    echo ""
    echo "=========================================="
    echo "☁️  UPLOADING TO CDN"
    echo "=========================================="
    
    log_info "Uploading to S3: s3://$S3_BUCKET/$S3_PREFIX/"
    
    aws s3 sync "$OUTPUT_DIR/" "s3://$S3_BUCKET/$S3_PREFIX/" \
        --region "$AWS_REGION" \
        --content-type "application/javascript; charset=utf-8" \
        --cache-control "public, max-age=31536000, immutable" \
        --metadata "version=$APP_VERSION,phase=$DEPLOYMENT_PHASE" \
        --exclude "*.map" \
        --delete \
        || {
            log_error "S3 upload failed!"
            exit 1
        }
    
    log_success "Uploaded to S3"
    
    # Upload source maps separately (no cache)
    if [[ "$OBF_ENV" == "dev" ]]; then
        log_info "Uploading source maps..."
        aws s3 sync "$OUTPUT_DIR/" "s3://$S3_BUCKET/$S3_PREFIX/" \
            --region "$AWS_REGION" \
            --content-type "application/json" \
            --cache-control "no-cache" \
            --include "*.map" \
            --delete
    fi
    
    # Invalidate CloudFront
    log_info "Invalidating CloudFront distribution: $CLOUDFRONT_DIST_ID"
    
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_DIST_ID" \
        --paths "/$S3_PREFIX/*" \
        --region us-east-1 \
        --query 'Invalidation.Id' \
        --output text 2>/dev/null) \
        || log_warning "CloudFront invalidation failed (non-critical)"
    
    if [[ -n "$INVALIDATION_ID" ]]; then
        log_success "CloudFront invalidated (ID: $INVALIDATION_ID)"
    fi
    
    echo ""
else
    log_warning "Skipping CDN upload (OBF_ENV=$OBF_ENV, UPLOAD_TO_CDN=$UPLOAD_TO_CDN)"
    echo ""
fi

# =============================================================================
# SWAP SETUP (EC2)
# =============================================================================

log_info "Checking swap on EC2..."

ssh -i "$EC2_KEY" "$EC2_USER_HOST" "
  if ! free | grep -q Swap; then
    echo 'Creating $SWAP_SIZE Swap...'
    sudo fallocate -l $SWAP_SIZE /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  else
    echo 'Swap already exists.'
  fi
" || echo "ℹ️  Skip swap setup (no SSH or already configured)."

# =============================================================================
# GIT COMMIT & PUSH
# =============================================================================

echo ""
echo "=========================================="
echo "📦 GIT COMMIT & PUSH"
echo "=========================================="

log_info "Committing to Git..."

git add -A

if [[ -n $(git status --porcelain) ]]; then
    git commit -m "🚀 Deploy $OBF_ENV build - $APP_VERSION ($DEPLOYMENT_PHASE)"
    git push origin main || log_warning "Git push failed (check credentials)"
    log_success "Pushed to GitHub"
else
    log_info "No changes to commit"
fi

echo ""

# =============================================================================
# RSYNC TO EC2
# =============================================================================

echo "=========================================="
echo "📤 SYNCING TO EC2"
echo "=========================================="

log_info "Starting rsync..."

/usr/bin/rsync -az --delete --info=progress2 \
    --exclude-from="$EXCLUDES_FILE" \
    -e "ssh -i $EC2_KEY -o StrictHostKeyChecking=no" \
    "$PROJECT_DIR/" "$EC2_USER_HOST:$REMOTE_DIR/" \
    || {
        log_error "RSYNC failed!"
        exit 1
    }

log_success "Files synced to EC2"
echo ""

# =============================================================================
# REMOTE DEPLOYMENT
# =============================================================================

echo "=========================================="
echo "🚀 EC2 DEPLOYMENT"
echo "=========================================="

log_info "Deploying on EC2..."

ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER_HOST" bash <<'ENDSSH'
    set -euo pipefail
    
    cd ~/Payroll-NodeJs
    
    echo "[EC2] Installing production dependencies..."
    npm cache clean --force
    
    if [ -f package-lock.json ]; then
        npm ci --omit=dev --prefer-offline
    else
        npm install --omit=dev --prefer-offline
    fi
    
    echo "[EC2] Reloading PM2..."
    pm2 reload payroll --update-env || pm2 start app.js --name payroll --update-env
    
    echo "[EC2] PM2 status:"
    pm2 status
ENDSSH

log_success "EC2 deployment complete"
echo ""

# =============================================================================
# DNS AUTO-UPDATE
# =============================================================================

echo "=========================================="
echo "🌐 DNS AUTO-UPDATE"
echo "=========================================="

log_info "Executing DNS Auto-Update..."

powershell.exe -ExecutionPolicy Bypass -Command "C:\\Users\\User\\Desktop\\AWS-EC2-S3\\deploy.ps1" \
    || log_warning "DNS update failed (non-critical)"

echo ""

# =============================================================================
# SUMMARY
# =============================================================================

echo ""
echo "=========================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "=========================================="
echo "Environment:    $OBF_ENV"
echo "Version:        $APP_VERSION"
echo "Phase:          $DEPLOYMENT_PHASE"
echo "Files:          $PROCESSED processed"
echo "Build output:   $OUTPUT_DIR"
if [[ "$UPLOAD_TO_CDN" == "true" ]]; then
    echo "S3 Bucket:      s3://$S3_BUCKET/$S3_PREFIX/"
    echo "CDN URL:        $CDN_URL/$S3_PREFIX/"
fi
echo "EC2 Status:     ✅ Running"
echo "=========================================="
echo ""
echo "✅ Next steps:"
echo "  1. Test CDN URL: $CDN_URL/$S3_PREFIX/modules/apodoxesCalculations.min.js"
echo "  2. Check browser console for errors"
echo "  3. Test critical pages"
echo "  4. If all OK → Deploy Phase 2 (remaining ~162 files)"
echo ""
echo "🚧 Phase 2 files waiting (uncomment in script):"
echo "  - Krathseis/* (12 files)"
echo "  - companies/* (36 files)"
echo "  - ergazomenoi/* (43 files)"
echo "  - kinhseis/* (27 files)"
echo "  - symbaseis/* (40 files)"
echo "  - dates/* (4 files)"
echo ""