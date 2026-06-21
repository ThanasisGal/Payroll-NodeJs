#!/usr/bin/env bash
# =============================================================================
# Ubuntu/Linux Deployment Script v1.0 - OPTIMIZED FOR LINUX
# Clean, simple, no Cygwin dependencies
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# =============================================================================
# TIMING SETUP
# =============================================================================
START_TIME=$(date +%s)
START_TIME_FORMATTED=$(date '+%Y-%m-%d %H:%M:%S')

# =============================================================================
# CONFIGURATION - LINUX PATHS
# =============================================================================

PROJECT_DIR="$HOME/Projects/Payroll-NodeJs"
BUILD_DIR="$PROJECT_DIR/build"
OUTPUT_DIR="$PROJECT_DIR/public/min.js"
PACKAGE_JSON="$PROJECT_DIR/package.json"

# AWS Configuration
S3_BUCKET="${S3_BUCKET:-employee-certificates-webpayrollsolutions-central}"
S3_PREFIX="static/min.js"
CLOUDFRONT_DIST_ID="${CLOUDFRONT_DIST_ID:-E2FVQEZRP01HIX}"
AWS_REGION="${AWS_REGION:-eu-central-1}"
CDN_URL="https://cdn.webpayrollsolutions.com"

# EC2 Configuration
EC2_KEY="$HOME/.ssh/Payroll_NodeJS_Server_Frankfurt.pem"
EC2_USER_HOST="ubuntu@18.199.180.229"
REMOTE_DIR="~/Payroll-NodeJs"
EXCLUDES_FILE="$PROJECT_DIR/rsync-excludes.txt"

# Build Configuration
OBF_ENV="${OBF_ENV:-prod}"
SKIP_OBFUSCATION="${SKIP_OBFUSCATION:-false}"
UPLOAD_TO_CDN="${UPLOAD_TO_CDN:-true}"
APP_VERSION=$(date '+%Y%m%d%H%M%S')
DEPLOYMENT_PHASE="Phase 1"

# Disk & Swap
DISK_THRESHOLD=500
SWAP_SIZE="4G"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
TOTAL_FILES_EXPECTED=0
TOTAL_FILES_CREATED=0
TOTAL_FILES_FAILED=0
declare -a FAILED_FILES=()

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

format_duration() {
    local seconds=$1
    local hours=$((seconds / 3600))
    local minutes=$(((seconds % 3600) / 60))
    local secs=$((seconds % 60))
    
    if [ $hours -gt 0 ]; then
        printf "%dh %dm %ds" $hours $minutes $secs
    elif [ $minutes -gt 0 ]; then
        printf "%dm %ds" $minutes $secs
    else
        printf "%ds" $secs
    fi
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 not found. Please install it first."
        exit 1
    fi
}

get_file_size() {
    stat -c%s "$1" 2>/dev/null || echo "0"
}

# =============================================================================
# SYSTEM INFO
# =============================================================================

echo ""
echo "=========================================="
echo "🖥️  SYSTEM INFORMATION"
echo "=========================================="
echo "OS:             Linux/Ubuntu"
echo "Project Dir:    $PROJECT_DIR"
echo "EC2 Key:        $EC2_KEY"
echo "User:            $(whoami)"
echo "Hostname:       $(hostname)"
echo "=========================================="
echo ""

# =============================================================================
# PREREQUISITES CHECK
# =============================================================================

log_info "Checking prerequisites..."

if [[ !  -d "$PROJECT_DIR" ]]; then
    log_error "Directory $PROJECT_DIR not found."
    log_info "💡 Please adjust PROJECT_DIR in the script"
    exit 1
fi

cd "$PROJECT_DIR" || exit 1

# =============================================================================
# GIT BRANCH SAFETY CHECK
# =============================================================================
# Το deploy πρέπει να καταλήγει πάντα στο main.
# Αν είσαι σε άλλο branch, σου δίνει επιλογή να σταματήσεις ή να κάνεις:
# push current branch -> checkout main -> pull main -> merge current branch -> continue.

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

if [[ -z "$CURRENT_BRANCH" ]]; then
    log_error "Could not detect current Git branch."
    exit 1
fi

if [[ "$CURRENT_BRANCH" != "main" ]]; then
    log_warning "You are currently on branch: $CURRENT_BRANCH"
    log_warning "Deployment expects branch: main"
    echo ""
    echo "Choose what to do:"
    echo "  1) Stop deployment"
    echo "  2) Push current branch, switch to main, merge it, then continue"
    echo ""

    read -p "Choice [1]: " BRANCH_CHOICE
    BRANCH_CHOICE=${BRANCH_CHOICE:-1}

    case "$BRANCH_CHOICE" in
        2)
            log_info "Pushing current branch: $CURRENT_BRANCH"
            git push -u origin "$CURRENT_BRANCH"

            log_info "Switching to main..."
            git checkout main

            log_info "Pulling latest main..."
            git pull origin main

            log_info "Merging branch $CURRENT_BRANCH into main..."
            if git merge "$CURRENT_BRANCH"; then
                log_success "Branch $CURRENT_BRANCH merged into main"
            else
                log_error "Merge failed. Resolve conflicts manually, then run deploy again."
                exit 1
            fi
            ;;
        *)
            log_error "Deployment stopped. Please switch to main first:"
            echo "cd $PROJECT_DIR"
            echo "git checkout main"
            echo "git pull origin main"
            exit 1
            ;;
    esac
fi


check_command "node"
check_command "npm"
check_command "git"
check_command "rsync"
check_command "ssh"
check_command "aws"

# Check EC2 key
if [[ ! -f "$EC2_KEY" ]]; then
    log_error "EC2 key not found:  $EC2_KEY"
    exit 1
fi

KEY_PERMS=$(stat -c "%a" "$EC2_KEY" 2>/dev/null)
if [[ "$KEY_PERMS" != "600" ]] && [[ "$KEY_PERMS" != "400" ]]; then
    log_warning "Fixing EC2 key permissions..."
    chmod 600 "$EC2_KEY"
    log_success "Key permissions set to 600"
fi

# Check npm packages
if !  npm list -g terser &>/dev/null; then
    log_warning "Terser not installed globally. Installing..."
    npm install -g terser
fi

if [[ "$SKIP_OBFUSCATION" == "false" ]] && !  npm list -g javascript-obfuscator &>/dev/null; then
    log_warning "javascript-obfuscator not installed. Installing..."
    npm install -g javascript-obfuscator@latest
fi

log_success "All prerequisites met."

# =============================================================================
# DISK SPACE CHECK
# =============================================================================

log_info "Checking disk space..."
AVAILABLE_DISK=$(df --output=avail / | tail -n 1 | tr -d ' ')
if (( AVAILABLE_DISK < DISK_THRESHOLD * 1024 )); then
    log_error "Not enough disk space:  ${AVAILABLE_DISK} KB available, ${DISK_THRESHOLD} MB required."
    exit 1
fi
log_success "Disk space OK ($(( AVAILABLE_DISK / 1024 )) MB available)"

# =============================================================================
# AWS PRE-FLIGHT CHECKS
# =============================================================================

log_info "Running AWS pre-flight checks..."

if aws sts get-caller-identity &>/dev/null; then
    CALLER_INFO=$(aws sts get-caller-identity --output json 2>/dev/null)
    USER_ARN=$(echo "$CALLER_INFO" | grep -o '"Arn": *"[^"]*"' | cut -d'"' -f4)
    log_success "AWS Credentials OK:  $USER_ARN"
else
    log_warning "AWS credentials not configured. CDN operations will be skipped."
    log_info "Run 'aws configure' to enable CDN deployment."
    UPLOAD_TO_CDN="false"
fi

if [[ "$UPLOAD_TO_CDN" == "true" ]]; then
    if aws s3 ls "s3://$S3_BUCKET/" --region "$AWS_REGION" &>/dev/null; then
        log_success "S3 bucket accessible:  $S3_BUCKET"
    else
        log_warning "Cannot access S3 bucket: $S3_BUCKET - CDN upload will be skipped"
        UPLOAD_TO_CDN="false"
    fi
    
    log_info "Checking CloudFront distribution:  $CLOUDFRONT_DIST_ID"
    if aws cloudfront get-distribution --id "$CLOUDFRONT_DIST_ID" --region us-east-1 &>/dev/null 2>&1; then
        log_success "CloudFront distribution accessible"
    else
        log_warning "CloudFront distribution not accessible (invalidation will be skipped)"
    fi
fi

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

minify_file() {
    local input="$1"
    local output="$2"
    local is_module="${3:-false}"
    
    mkdir -p "$(dirname "$output")"
    
    log_step "Minifying:   ${input#"$PROJECT_DIR/"}"
    
    local original_size=$(get_file_size "$input")
    
    local compress_opts="passes=2,drop_console=false,drop_debugger=true,unsafe=false,unsafe_comps=false,unsafe_Function=false,unsafe_math=false,unsafe_symbols=false,unsafe_methods=false,unsafe_proto=false,unsafe_regexp=false,unsafe_undefined=false"
    local mangle_opts="reserved=['require','exports','module','define','Decimal','Swal','\$','jQuery','loadEfories','makeListItem','renderList','executeSearch','updateList','updateName']"
    
    local module_flag=""
    if [[ "$is_module" == "true" ]]; then
        module_flag="--module"
        log_info "  → ES6 Module mode"
    fi
    
    # Direct terser command - works perfectly on Linux!
    if terser "$input" \
        --compress "$compress_opts" \
        --mangle "$mangle_opts" \
        --ecma 2017 \
        --keep-classnames \
        --keep-fnames \
        $module_flag \
        --output "$output" 2>/dev/null; then
        
        local minified_size=$(get_file_size "$output")
        
        if [[ $minified_size -gt 0 ]]; then
            local reduction=0
            if [[ $original_size -gt 0 ]]; then
                reduction=$(( 100 - (minified_size * 100 / original_size) ))
            fi
            log_success "  → $(basename "$output") (${reduction}% smaller:   $original_size → $minified_size bytes)"
        else
            log_warning "  ✗ Empty output, using original"
            cp "$input" "$output"
            local file_size=$(get_file_size "$output")
            log_success "  → $(basename "$output") (original:   $file_size bytes)"
        fi
    else
        log_warning "  ✗ Minification failed, using original"
        cp "$input" "$output"
        local file_size=$(get_file_size "$output")
        log_success "  → $(basename "$output") (original:  $file_size bytes)"
    fi
    
    return 0
}

obfuscate_file() {
    local input="$1"
    local output="$2"
    
    if [[ "$SKIP_OBFUSCATION" == "true" ]]; then
        cp "$input" "$output"
        return 0
    fi
    
    mkdir -p "$(dirname "$output")"
    
    local input_size=$(get_file_size "$input")
    
    if [[ $input_size -eq 0 ]]; then
        log_error "Input file is empty, skipping obfuscation"
        return 1
    fi
    
    local base_name="${input##*/}"
    base_name="${base_name%.min.js}"
    base_name="${base_name%.js}"
    local id_prefix="__${base_name}__"
    
    log_step "Obfuscating (CSP-safe):  ${input#"$PROJECT_DIR/"}"
    
    declare -a obf_args=(
        --compact true
        --simplify false
        --identifier-names-generator mangled-shuffled
        --identifiers-prefix "$id_prefix"
        --rename-globals false
        --string-array false
        --split-strings false
        --control-flow-flattening false
        --dead-code-injection false
        --debug-protection false
        --self-defending false
        --disable-console-output false
        --unicode-escape-sequence false
        --transform-object-keys false
        --reserved-names '^\$|^jQuery$|^document$|^window$|^console$|^navigator$|^Decimal$|^Swal$|^require$|^exports$|^module$|^define$|^loadEfories$|^makeListItem$|^renderList$|^executeSearch$|^updateList$|^updateName$'
        --target browser
    )
    
    if [[ "$OBF_ENV" == "dev" ]]; then
        obf_args+=(--source-map true)
    fi
    
    if !   javascript-obfuscator "$input" \
        --output "$output" \
        "${obf_args[@]}" 2>/dev/null; then
        log_error "Obfuscation failed:   $input"
        log_warning "Using minified file without obfuscation"
        cp "$input" "$output"
        return 0
    fi
    
    local output_size=$(get_file_size "$output")
    
    if [[ $output_size -eq 0 ]]; then
        log_error "  ✗ Obfuscation produced EMPTY file!"
        log_warning "  → Using minified file instead"
        cp "$input" "$output"
        output_size=$(get_file_size "$output")
    fi
    
    log_success "  → Obfuscated (CSP-safe, ${output_size} bytes)"
    
    return 0
}

process_file() {
    local source_path="$1"
    local is_module="${2:-false}"
    
    local rel_path="${source_path#public/js/}"
    local base_name="${rel_path%.js}"
    local minified="$BUILD_DIR/${base_name}.min.js"
    local final_output="$OUTPUT_DIR/${base_name}.js"
    
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}🔍 Processing:   $(basename "$source_path")${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Source:       ${source_path}${NC}"
    echo -e "${BLUE}  rel_path:     ${rel_path}${NC}"
    echo -e "${BLUE}  base_name:    ${base_name}${NC}"
    echo -e "${BLUE}  final_output: ${final_output#$PROJECT_DIR/}${NC}"
    echo -e "${BLUE}  is_module:    ${is_module}${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    local output_dir
    output_dir="$(dirname "$final_output")"
    
    mkdir -p "$output_dir"
    
    if [[ !   -d "$output_dir" ]]; then
        log_error "Failed to create directory:  $output_dir"
        TOTAL_FILES_FAILED=$((TOTAL_FILES_FAILED + 1))
        FAILED_FILES+=("$source_path (directory creation failed)")
        return 1
    fi
    
    if !   minify_file "$source_path" "$minified" "$is_module"; then
        TOTAL_FILES_FAILED=$((TOTAL_FILES_FAILED + 1))
        FAILED_FILES+=("$source_path (minification failed)")
        return 1
    fi
    
    if [[ !   -f "$minified" ]]; then
        log_error "Minified file not created:  $minified"
        TOTAL_FILES_FAILED=$((TOTAL_FILES_FAILED + 1))
        FAILED_FILES+=("$source_path (minified file missing)")
        return 1
    fi
    
    local minified_size=$(get_file_size "$minified")
    if [[ $minified_size -eq 0 ]]; then
        log_error "Minified file is EMPTY:  $minified"
        TOTAL_FILES_FAILED=$((TOTAL_FILES_FAILED + 1))
        FAILED_FILES+=("$source_path (minified file empty)")
        return 1
    fi

    if [[ "$is_module" == "true" || "$SKIP_OBFUSCATION" == "true" ]]; then
        cp "$minified" "$final_output"
        log_info "  → Module preserved (no obfuscation)"
    else
        local base_only
        base_only="$(basename "$base_name")"
        local safe_tmp_in="$BUILD_DIR/__obf_${base_only}_in.js"

        cp "$minified" "$safe_tmp_in"

        if obfuscate_file "$safe_tmp_in" "$final_output"; then
            rm -f "$safe_tmp_in"
            log_info "  → Minified + Obfuscated"
        else
            rm -f "$safe_tmp_in"
            TOTAL_FILES_FAILED=$((TOTAL_FILES_FAILED + 1))
            FAILED_FILES+=("$source_path (obfuscation failed)")
            return 1
        fi
    fi
    
    if [[ -f "$final_output" ]]; then
        local file_size=$(get_file_size "$final_output")
        
        if [[ $file_size -eq 0 ]]; then
            log_error "  ✗ File created but is EMPTY!"
            TOTAL_FILES_FAILED=$((TOTAL_FILES_FAILED + 1))
            FAILED_FILES+=("$source_path (empty file)")
            return 1
        fi
        
        echo -e "${GREEN}  ✅ SUCCESS:  ${final_output#$PROJECT_DIR/}${NC}"
        echo -e "${GREEN}     Size:  ${file_size} bytes${NC}"
        TOTAL_FILES_CREATED=$((TOTAL_FILES_CREATED + 1))
        log_success "  ✓ File verified and ready"
    else
        echo -e "${RED}  ❌ FAILED:  File not created${NC}"
        log_error "  ✗ File creation failed!"
        TOTAL_FILES_FAILED=$((TOTAL_FILES_FAILED + 1))
        FAILED_FILES+=("$source_path (file not found)")
        return 1
    fi
    
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# =============================================================================
# FILE LISTS - PHASE 1
# =============================================================================

declare -a modules=(
    "public/js/app.js"
    "public/js/dropdown-item.js"
    "public/js/dropdownManager.js"
    "public/js/efkaDropdownChain.js"
    "public/js/epa_step1.js"
    "public/js/epa_step2.js"
    "public/js/epa_step3.js"
    "public/js/geoDropdownChain.js"
    "public/js/searchableSelect.js"
    "public/js/symbaseisDropdownChain.js"
    "public/js/symbaseisDropdownChain3-multi.js"
    "public/js/symbaseisDropdownChain3.js"
    "public/js/ts-inline-summary.js"
    "public/js/profTrainingDropdownChain.js"
    "public/js/common/dependentSelectToggle.js"
    "public/js/common/initTomDropdown.js"
    "public/js/companies/genikastoixeia/initDoyDropdowns.js"
    "public/js/companies/genikastoixeia/initKadDropdowns.js"
    "public/js/companies/genikastoixeia/initNomikesMorfesDropdowns.js"
    "public/js/companies/genikastoixeia/initPararthmataEfkaDropdowns.js"
    "public/js/companies/genikastoixeia/initTameiaDropdowns.js"
    "public/js/ergazomenoi/genika/addStoixeiaSymbaseon.js"
    "public/js/ergazomenoi/genika/editStoixeiaSymbaseon.js"
    "public/js/ergazomenoi/genika/reCalcApodoxes.js"
    "public/js/ergazomenoi/programmata/initYpokatasthmataDropdowns.js"
    "public/js/modules/apodoxesCalculations.js"
    "public/js/utils/formatNumber.js"
    "public/js/ergazomenoi/genika/updateLinkFromTomDropdown.js"
)

declare -a utils=(
    "public/js/utils/miscProgs.js"
    "public/js/utils/tree.js"
)

declare -a dates=(
    "public/js/dates/convertDateToISO.js"
    "public/js/dates/convertStringtoDate.js"
    "public/js/dates/getFieldsDate.js"
    "public/js/dates/loadDropdown_Periods.js"
    "public/js/dates/loadDropdown_Xrhseis.js"
)

declare -a common_files=(
    "public/js/common/adjustFontSizeToFit.js"
    "public/js/common/amka_validation.js"
    "public/js/common/anoigmaNeasXrhshs.js"
    "public/js/common/blockInvalidClick.js"
    "public/js/common/changeInputTypeFile.js"
    "public/js/common/changeFontSizeSelectDropdownMenu.js"
    "public/js/common/checkAfm.js"
    "public/js/common/checkAmka.js"
    "public/js/common/checkHlikia.js"
    "public/js/common/checkScreenAnalysis.js"
    "public/js/common/clearableInputs.js"
    "public/js/common/clearImage.js"
    "public/js/common/clearSection.js"
    "public/js/common/clearSelectsSymbaseon.js"
    "public/js/common/convertNumbers.js"
    "public/js/common/countdown.js"
    "public/js/common/createNavTree.js"
    "public/js/common/csrfFetchPatch.js"
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
    "public/js/common/heartbeat.js"
    "public/js/common/hideTooltips.js"
    "public/js/common/ibanChecker.js"
    "public/js/common/input_auto_select.js"
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
    "public/js/common/sessionRefresh.js"
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
    "public/js/common/companiesAnenerghFilter.js"
    "public/js/common/ergazomenoiAnenerghToggle.js"
)

declare -a companies=(
    "public/js/companies/genikastoixeia/dropdownsValue.js"
    "public/js/companies/genikastoixeia/getFieldValues.js"
    "public/js/companies/genikastoixeia/loadDropdowns_add.js"
    "public/js/companies/genikastoixeia/loadDropdowns_edit.js"
    "public/js/companies/genikastoixeia/loadLoipaPedia.js"
    "public/js/companies/genikastoixeia/loadMultipleUsers.js"
    "public/js/companies/genikastoixeia/putFieldValues_Company.js"
    "public/js/companies/genikastoixeia/selectRowInTable.js"
    "public/js/companies/ypokatasthmata/getFieldValues.js"
    "public/js/companies/ypokatasthmata/loadDropdowns_add.js"
    "public/js/companies/ypokatasthmata/loadDropdowns_edit.js"
    "public/js/companies/ypokatasthmata/putFieldValues.js"
    "public/js/companies/ypokatasthmata/selectRowInTable.js"
    "public/js/companies/nomimoiekprosopoi/getFieldValues.js"
    "public/js/companies/nomimoiekprosopoi/loadDropdowns_add.js"
    "public/js/companies/nomimoiekprosopoi/loadDropdowns_edit.js"
    "public/js/companies/nomimoiekprosopoi/putFieldValues.js"
    "public/js/companies/nomimoiekprosopoi/selectRowInTable.js"
    "public/js/companies/antistoixiseis/fillValuesWithZeroes.js"
    "public/js/companies/antistoixiseis/getFieldValues.js"
    "public/js/companies/antistoixiseis/nestingTables.js"
    "public/js/companies/antistoixiseis/putFieldValues.js"
    "public/js/companies/antistoixiseis/selectRowInTable.js"
    "public/js/companies/antistoixiseis/selectRowsInNestedTable.js"
    "public/js/companies/passwords/getFieldValues.js"
    "public/js/companies/passwords/putFieldValues.js"
    "public/js/companies/passwords/selectRowInTable.js"
    "public/js/companies/trapezes/getFieldValues.js"
    "public/js/companies/trapezes/loadMultiFieldsToHiddenInputs.js"
    "public/js/companies/trapezes/putFieldValues.js"
    "public/js/companies/trapezes/selectRowInTable.js"
)

declare -a symbaseis=(
    "public/js/symbaseis/symbaseis/getFieldValues.js"
    "public/js/symbaseis/symbaseis/putFieldValues.js"
    "public/js/symbaseis/symbaseis/selectRowInTable.js"
    "public/js/symbaseis/kathgories/getFieldValues.js"
    "public/js/symbaseis/kathgories/putFieldValues.js"
    "public/js/symbaseis/kathgories/selectRowInTable.js"
    "public/js/symbaseis/kathgories/symbaseis_kathgories.js"
    "public/js/symbaseis/eidikothtes/getFieldValues.js"
    "public/js/symbaseis/eidikothtes/putFieldValues.js"
    "public/js/symbaseis/eidikothtes/selectRowInTable.js"
    "public/js/symbaseis/eidikothtes/symbaseis_kathgories_eidikothtes.js"
    "public/js/symbaseis/stoixeiaSymbaseon/getFieldValues.js"
    "public/js/symbaseis/stoixeiaSymbaseon/loadDropdowns_StoixeiaSymbaseon.js"
    "public/js/symbaseis/stoixeiaSymbaseon/putFieldValues.js"
    "public/js/symbaseis/stoixeiaSymbaseon/selectRowInTable.js"
    "public/js/symbaseis/stoixeiaSymbaseon/stoixeia_list.js"
    "public/js/symbaseis/ypologismoiKlimakion/addStoixeiaSymbaseon.js"
    "public/js/symbaseis/ypologismoiKlimakion/clearSelects.js"
    "public/js/symbaseis/ypologismoiKlimakion/emfanish.js"
    "public/js/symbaseis/ypologismoiKlimakion/enhmerosh.js"
    "public/js/symbaseis/ypologismoiKlimakion/enhmeroshKlimakion.js"
    "public/js/symbaseis/ypologismoiKlimakion/externalRowTrash.js"
    "public/js/symbaseis/ypologismoiKlimakion/loadDropdowns_ypologismoi.js"
    "public/js/symbaseis/ypologismoiKlimakion/stoixeia_list_multi.js"
    "public/js/symbaseis/ypologismoiKlimakion/ypologismos.js"
)

declare -a ergazomenoi=(
    "public/js/ergazomenoi/genika/allodapoiPdfViewer.js"
    "public/js/ergazomenoi/genika/anhlikoiPdfViewer.js"
    "public/js/ergazomenoi/genika/symbashDaneismoyPdfViewer.js"
    "public/js/ergazomenoi/genika/getFieldValues.js"
    "public/js/ergazomenoi/genika/putFieldValues.js"
    "public/js/ergazomenoi/genika/selectRowInTable.js"
    "public/js/ergazomenoi/genika/loadDataFromEfka.js"
    "public/js/ergazomenoi/genika/putInputValuesToHiddenValues.js"
    "public/js/ergazomenoi/genika/calcProyphresia.js"
    "public/js/ergazomenoi/genika/toggleDisabledSelectViaCheckbox.js"
    "public/js/ergazomenoi/genika/toggleDisabledInputViaCheckbox.js"
    "public/js/ergazomenoi/genika/fillLabelFromInput.js"
    "public/js/ergazomenoi/genika/date_sync_add.js"
    "public/js/ergazomenoi/genika/date_sync_edit.js"
    "public/js/ergazomenoi/genika/checkHmeromhniaAllaghsSymbashs.js"
    "public/js/ergazomenoi/genika/getDaysFromDate.js"
    "public/js/ergazomenoi/genika/selectRepo.js"
    "public/js/ergazomenoi/genika/checkAmaTameioy.js"
    "public/js/ergazomenoi/genika/calcChildren.js"
    "public/js/ergazomenoi/genika/autoLoadTaxScale.js"
    "public/js/ergazomenoi/genika/autoCalculateEndDate.js"
    "public/js/ergazomenoi/genika/calcOresApasxolhshs.js"
    "public/js/ergazomenoi/genika/clearableInputs.js"
    "public/js/ergazomenoi/genika/epidothseis_auto_clear.js"
    "public/js/ergazomenoi/genika/dokimastikhPeriodos_Blur.js"
    "public/js/ergazomenoi/genika/pdf_Upload_Modal.js"
    "public/js/ergazomenoi/genika/pdfPreviewModule.js"
    "public/js/ergazomenoi/genika/logos_peratoshs.js"
    "public/js/ergazomenoi/programmata/downloadScheduleButton.js"
    "public/js/ergazomenoi/programmata/downloadCardsButton.js"
    "public/js/ergazomenoi/programmata/calcApasxolhseisPeriodoy.js"
    "public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js"
    "public/js/ergazomenoi/programmata/sendApologistikoButton.js"
    "public/js/ergazomenoi/programmata/sendApologistikoYperorionButton.js"
    "public/js/ergazomenoi/genika/istorikoTable.js"
)

declare -a kinhseis=(
    "public/js/kinhseis/ypologismoi/axiaKrathseon.js"
    "public/js/kinhseis/ypologismoi/fillFieldsKinhseon.js"
    "public/js/kinhseis/ypologismoi/klimakiaForoy.js"
)

declare -a no_obfuscate=(
#    "public/js/ergazomenoi/genika/updateLinkFromTomDropdown.js"
)

# =============================================================================
# VERSION MANAGEMENT
# =============================================================================

log_info "=========================================="
log_info "📦 VERSION MANAGEMENT"
log_info "=========================================="
echo ""

if [[ !   -f "$PACKAGE_JSON" ]]; then
    log_error "package.json not found!"
    exit 1
fi

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

CURRENT_VERSION=$(grep '"version"' "$PACKAGE_JSON" | head -1 | sed 's/.*"version":  *"\([^"]*\)".*/\1/')
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📦 Current version:   ${GREEN}$CURRENT_VERSION${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

PATCH_VERSION=$(increment_patch "$CURRENT_VERSION")
MINOR_VERSION=$(increment_minor "$CURRENT_VERSION")
MAJOR_VERSION=$(increment_major "$CURRENT_VERSION")

echo "Select version bump type:"
echo ""
echo -e "  ${GREEN}1)${NC} Patch (bug fix / optimization)	$CURRENT_VERSION → ${GREEN}$PATCH_VERSION${NC}"
echo -e "  ${BLUE}2)${NC} Minor (new feature)				$CURRENT_VERSION → ${BLUE}$MINOR_VERSION${NC}"
echo -e "  ${RED}3)${NC} Major (breaking change)			$CURRENT_VERSION → ${RED}$MAJOR_VERSION${NC}"
echo -e "  ${YELLOW}4)${NC} Skip (keep current version)		$CURRENT_VERSION → ${YELLOW}$CURRENT_VERSION${NC}"
echo ""

read -p "Choice [1]:   " BUMP_CHOICE
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
        log_warning "Keeping current version:   $CURRENT_VERSION"
        ;;
    *)
        log_warning "Invalid choice, defaulting to Patch"
        NEW_VERSION="$PATCH_VERSION"
        BUMP_TYPE="Patch"
        ;;
esac

if [[ "$NEW_VERSION" != "$CURRENT_VERSION" ]]; then
    sed -i "s/\"version\": *\"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$PACKAGE_JSON"
    
    if [[ $? -eq 0 ]]; then
        echo ""
        echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}✅ Version updated:   $CURRENT_VERSION → $NEW_VERSION ($BUMP_TYPE)${NC}"
        echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        APP_VERSION="$NEW_VERSION"
    else
        log_error "Failed to update version!"
        exit 1
    fi
else
    APP_VERSION="$CURRENT_VERSION"
fi

echo ""

# =============================================================================
# BUILD PROCESS
# =============================================================================

BUILD_START=$(date +%s)

echo ""
echo "=========================================="
echo "🚀 BUILD PROCESS STARTING - $DEPLOYMENT_PHASE"
echo "=========================================="
echo "Start Time:      $START_TIME_FORMATTED"
echo "Environment:    $OBF_ENV"
echo "Obfuscation:    $([ "$SKIP_OBFUSCATION" == "true" ] && echo "DISABLED" || echo "ENABLED")"
echo "CDN Upload:     $([ "$UPLOAD_TO_CDN" == "true" ] && echo "ENABLED" || echo "DISABLED")"
echo "Version:        $APP_VERSION"
echo "Phase:          $DEPLOYMENT_PHASE (Core files only)"
echo "Files:           ~$((${#modules[@]} + ${#utils[@]} + ${#dates[@]} + ${#common_files[@]} + ${#companies[@]} + ${#symbaseis[@]} + ${#ergazomenoi[@]} + ${#kinhseis[@]} + ${#no_obfuscate[@]})) files"
echo "=========================================="
echo ""

TOTAL_FILES_EXPECTED=$((${#modules[@]} + ${#utils[@]} + ${#dates[@]} + ${#common_files[@]} + ${#companies[@]} + ${#symbaseis[@]} + ${#ergazomenoi[@]} + ${#kinhseis[@]}))
PROCESSED=0

PHASE1_START=$(date +%s)
log_phase "PHASE 1.1: Building ES6 Modules (${#modules[@]} files)..."
echo ""

for file in "${modules[@]}"; do
    if [[ -f "$file" ]]; then
        PROCESSED=$((PROCESSED + 1))
        echo "[$PROCESSED/$TOTAL_FILES_EXPECTED]"
        process_file "$file" true
    else
        log_warning "File not found: $file"
        TOTAL_FILES_FAILED=$((TOTAL_FILES_FAILED + 1))
        FAILED_FILES+=("$file (source not found)")
    fi
done

PHASE1_END=$(date +%s)
PHASE1_DURATION=$((PHASE1_END - PHASE1_START))
log_success "Phase 1.1 complete in $(format_duration $PHASE1_DURATION)"
echo ""

PHASE2_START=$(date +%s)
log_phase "PHASE 1.2: Building utility files (${#utils[@]} files)..."
echo ""

for file in "${utils[@]}"; do
    if [[ -f "$file" ]]; then
        PROCESSED=$((PROCESSED + 1))
        echo "[$PROCESSED/$TOTAL_FILES_EXPECTED]"
        process_file "$file" false
    else
        log_warning "File not found: $file"
        TOTAL_FILES_FAILED=$((TOTAL_FILES_FAILED + 1))
        FAILED_FILES+=("$file (source not found)")
    fi
done

PHASE2_END=$(date +%s)
PHASE2_DURATION=$((PHASE2_END - PHASE2_START))
log_success "Phase 1.2 complete in $(format_duration $PHASE2_DURATION)"
echo ""

PHASE3_START=$(date +%s)
log_phase "PHASE 1.3: Building common files (${#common_files[@]} files)..."
echo ""

for file in "${common_files[@]}"; do
    if [[ -f "$file" ]]; then
        PROCESSED=$((PROCESSED + 1))
        echo "[$PROCESSED/$TOTAL_FILES_EXPECTED]"
        process_file "$file" false
    else
        log_warning "File not found: $file"
        TOTAL_FILES_FAILED=$((TOTAL_FILES_FAILED + 1))
        FAILED_FILES+=("$file (source not found)")
    fi
done

PHASE3_END=$(date +%s)
PHASE3_DURATION=$((PHASE3_END - PHASE3_START))
log_success "Phase 1.3 complete in $(format_duration $PHASE3_DURATION)"
echo ""

PHASE4_START=$(date +%s)
log_phase "PHASE 1.4: Building date files (${#dates[@]} files)..."
echo ""

for file in "${dates[@]}"; do
    if [[ -f "$file" ]]; then
        PROCESSED=$((PROCESSED + 1))
        echo "[$PROCESSED/$TOTAL_FILES_EXPECTED]"
        process_file "$file" false
    else
        log_warning "File not found: $file"
        TOTAL_FILES_FAILED=$((TOTAL_FILES_FAILED + 1))
        FAILED_FILES+=("$file (source not found)")
    fi
done

PHASE4_END=$(date +%s)
PHASE4_DURATION=$((PHASE4_END - PHASE4_START))
log_success "Phase 1.4 complete in $(format_duration $PHASE4_DURATION)"
echo ""

PHASE5_START=$(date +%s)
log_phase "PHASE 1.5: Building company files (${#companies[@]} files)..."
echo ""

for file in "${companies[@]}"; do
    if [[ -f "$file" ]]; then
        PROCESSED=$((PROCESSED + 1))
        echo "[$PROCESSED/$TOTAL_FILES_EXPECTED]"
        process_file "$file" false
    else
        log_warning "File not found: $file"
        TOTAL_FILES_FAILED=$((TOTAL_FILES_FAILED + 1))
        FAILED_FILES+=("$file (source not found)")
    fi
done

PHASE5_END=$(date +%s)
PHASE5_DURATION=$((PHASE5_END - PHASE5_START))
log_success "Phase 1.5 complete in $(format_duration $PHASE5_DURATION)"
echo ""

PHASE6_START=$(date +%s)
log_phase "PHASE 1.6: Building symbaseis files (${#symbaseis[@]} files)..."
echo ""

for file in "${symbaseis[@]}"; do
    if [[ -f "$file" ]]; then
        PROCESSED=$((PROCESSED + 1))
        echo "[$PROCESSED/$TOTAL_FILES_EXPECTED]"
        process_file "$file" false
    else
        log_warning "File not found: $file"
        TOTAL_FILES_FAILED=$((TOTAL_FILES_FAILED + 1))
        FAILED_FILES+=("$file (source not found)")
    fi
done

PHASE6_END=$(date +%s)
PHASE6_DURATION=$((PHASE6_END - PHASE6_START))
log_success "Phase 1.6 complete in $(format_duration $PHASE6_DURATION)"
echo ""

PHASE7_START=$(date +%s)
log_phase "PHASE 1.7: Building ergazomenoi files (${#ergazomenoi[@]} files)..."
echo ""

for file in "${ergazomenoi[@]}"; do
    if [[ -f "$file" ]]; then
        PROCESSED=$((PROCESSED + 1))
        echo "[$PROCESSED/$TOTAL_FILES_EXPECTED]"
        process_file "$file" false
    else
        log_warning "File not found: $file"
        TOTAL_FILES_FAILED=$((TOTAL_FILES_FAILED + 1))
        FAILED_FILES+=("$file (source not found)")
    fi
done

PHASE7_END=$(date +%s)
PHASE7_DURATION=$((PHASE7_END - PHASE7_START))
log_success "Phase 1.7 complete in $(format_duration $PHASE7_DURATION)"
echo ""

PHASE8_START=$(date +%s)
log_phase "PHASE 1.8: Building kinhseis files (${#kinhseis[@]} files)..."
echo ""

# Προσωρινά disable obfuscation για αυτά τα files
ORIGINAL_SKIP_OBFUSCATION="$SKIP_OBFUSCATION"
export SKIP_OBFUSCATION="true"

for file in "${no_obfuscate[@]}"; do
    if [[ -f "$file" ]]; then
        PROCESSED=$((PROCESSED + 1))
        echo "[$PROCESSED/$TOTAL_FILES_EXPECTED]"
        process_file "$file" false
    else
        log_warning "File not found: $file"
        TOTAL_FILES_FAILED=$((TOTAL_FILES_FAILED + 1))
        FAILED_FILES+=("$file (source not found)")
    fi
done

# Restore original setting
export SKIP_OBFUSCATION="$ORIGINAL_SKIP_OBFUSCATION"

PHASE8_END=$(date +%s)
PHASE8_DURATION=$((PHASE8_END - PHASE8_START))
log_success "Phase 1.8 complete in $(format_duration $PHASE8_DURATION)"
echo ""

PHASE9_START=$(date +%s)
log_phase "PHASE 1.9: Building utility files (${#kinhseis[@]} files)..."
echo ""

for file in "${kinhseis[@]}"; do
    if [[ -f "$file" ]]; then
        PROCESSED=$((PROCESSED + 1))
        echo "[$PROCESSED/$TOTAL_FILES_EXPECTED]"
        process_file "$file" false
    else
        log_warning "File not found: $file"
        TOTAL_FILES_FAILED=$((TOTAL_FILES_FAILED + 1))
        FAILED_FILES+=("$file (source not found)")
    fi
done

PHASE9_END=$(date +%s)
PHASE9_DURATION=$((PHASE9_END - PHASE9_START))
log_success "Phase 1.9 complete in $(format_duration $PHASE9_DURATION)"
echo ""

BUILD_END=$(date +%s)
BUILD_DURATION=$((BUILD_END - BUILD_START))

# =============================================================================
# REPLACE CDN PATHS (PRODUCTION ONLY)
# =============================================================================

if [[ "$OBF_ENV" == "prod" ]]; then
    log_info "Replacing import paths with CDN URLs..."
    
    CDN_BASE="https://cdn.webpayrollsolutions.com/static/min.js"
    
    find "$OUTPUT_DIR" -type f -name "*.js" !  -name "*.map" -exec sed -i \
        -e "s|from '../dropdown-item\.js'|from '${CDN_BASE}/dropdown-item.js'|g" \
        -e "s|from './dropdown-item\.js'|from '${CDN_BASE}/dropdown-item.js'|g" \
        -e "s|from '/static/js/dropdown-item\.js'|from '${CDN_BASE}/dropdown-item.js'|g" \
        -e "s|from '../dropdownManager\.js'|from '${CDN_BASE}/dropdownManager.js'|g" \
        -e "s|from './dropdownManager\.js'|from '${CDN_BASE}/dropdownManager.js'|g" \
        -e "s|from '/static/js/dropdownManager\.js'|from '${CDN_BASE}/dropdownManager.js'|g" \
        {} +
    
    log_success "CDN paths replaced successfully"
    log_info "CDN Base URL: $CDN_BASE"
else
    log_info "Development mode - keeping relative import paths"
fi

echo ""
echo "=========================================="
echo "📊 BUILD SUMMARY"
echo "=========================================="
echo -e "${BLUE}Expected:   $TOTAL_FILES_EXPECTED files${NC}"
echo -e "${GREEN}Created:   $TOTAL_FILES_CREATED files${NC}"
echo -e "${RED}Failed:    $TOTAL_FILES_FAILED files${NC}"
echo "Duration:  $(format_duration $BUILD_DURATION)"
echo ""

if [[ $TOTAL_FILES_FAILED -gt 0 ]]; then
    echo -e "${RED}⚠️  FAILED FILES:${NC}"
    for failed in "${FAILED_FILES[@]}"; do
        echo -e "${RED}  ✗ $failed${NC}"
    done
    echo ""
fi

log_success "Build process complete!"
echo ""

# =============================================================================
# UPLOAD TO S3/CLOUDFRONT
# =============================================================================

if [[ "$UPLOAD_TO_CDN" == "true" && "$OBF_ENV" == "prod" ]]; then
    UPLOAD_START=$(date +%s)
    
    echo ""
    echo "=========================================="
    echo "☁️  UPLOADING TO CDN"
    echo "=========================================="
    
    log_info "Uploading to S3: s3://$S3_BUCKET/$S3_PREFIX/"
    
    FILES_TO_UPLOAD=$(find "$OUTPUT_DIR" -type f -name "*.js" !  -name "*.map" | wc -l)
    log_info "Files to upload: $FILES_TO_UPLOAD"
    echo ""
    
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
    echo ""
    
    log_info "Verifying S3 upload..."
    FILES_IN_S3=$(aws s3 ls "s3://$S3_BUCKET/$S3_PREFIX/" --recursive --region "$AWS_REGION" 2>/dev/null | grep "\.js$" | grep -v "\.map$" | wc -l || echo "0")
    log_info "Files in S3: $FILES_IN_S3"
    
    echo ""
    echo -e "${YELLOW}🎯 Verifying critical files in S3:${NC}"
    
    declare -a S3_CHECK_FILES=(
        "dropdown-item.js"
        "app.js"
        "dropdownManager.js"
        "searchableSelect.js"
        "modules/apodoxesCalculations.js"
    )
    
    S3_CRITICAL_MISSING=0
    for cfile in "${S3_CHECK_FILES[@]}"; do
        if aws s3 ls "s3://$S3_BUCKET/$S3_PREFIX/$cfile" --region "$AWS_REGION" &>/dev/null 2>&1; then
            echo -e "${GREEN}  ✓ $cfile${NC}"
        else
            echo -e "${RED}  ✗ $cfile MISSING FROM S3${NC}"
            S3_CRITICAL_MISSING=$((S3_CRITICAL_MISSING + 1))
        fi
    done
    
    if [[ $S3_CRITICAL_MISSING -gt 0 ]]; then
        log_warning "$S3_CRITICAL_MISSING critical file(s) missing from S3 (may take time to propagate)"
    else
        log_success "All critical files verified in S3!"
    fi
    
    echo ""
    
    if [[ "$OBF_ENV" == "dev" ]]; then
        log_info "Uploading source maps..."
        aws s3 sync "$OUTPUT_DIR/" "s3://$S3_BUCKET/$S3_PREFIX/" \
            --region "$AWS_REGION" \
            --content-type "application/json" \
            --cache-control "no-cache" \
            --include "*.map" \
            --delete
    fi
    
    log_info "Attempting CloudFront invalidation..."
    
    if !  aws sts get-caller-identity &>/dev/null; then
        log_warning "AWS credentials not configured. Skipping invalidation."
    else
        if aws cloudfront get-distribution --id "$CLOUDFRONT_DIST_ID" --region us-east-1 &>/dev/null 2>&1; then
            log_info "Creating invalidation for:  /$S3_PREFIX/*"
            
            INVAL_RESULT=$(aws cloudfront create-invalidation \
                --distribution-id "$CLOUDFRONT_DIST_ID" \
                --paths "/$S3_PREFIX/*" \
                --region us-east-1 \
                --output json 2>&1)
            
            if [ $? -eq 0 ]; then
                INVAL_ID=$(echo "$INVAL_RESULT" | grep -o '"Id": "[^"]*"' | head -1 | cut -d'"' -f4)
                if [[ -n "$INVAL_ID" ]]; then
                    log_success "CloudFront invalidated (ID: $INVAL_ID)"
                    log_info "Track:  aws cloudfront get-invalidation --id $INVAL_ID --distribution-id $CLOUDFRONT_DIST_ID --region us-east-1"
                else
                    log_success "CloudFront invalidation created"
                fi
            else
                log_warning "CloudFront invalidation failed (non-critical)"
                echo "$INVAL_RESULT" | grep -i "error\|denied\|invalid" | head -3 || true
                log_info "💡 Files uploaded to S3 successfully. CloudFront will update naturally within 24h."
                log_info "💡 Manual invalidation:  aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DIST_ID --paths '/$S3_PREFIX/*' --region us-east-1"
            fi
        else
            log_warning "CloudFront distribution $CLOUDFRONT_DIST_ID not accessible"
            log_info "Files uploaded to S3. CloudFront will update cache naturally."
        fi
    fi
    
    UPLOAD_END=$(date +%s)
    UPLOAD_DURATION=$((UPLOAD_END - UPLOAD_START))
    log_success "CDN operations complete in $(format_duration $UPLOAD_DURATION)"
    
    echo ""
else
    log_warning "Skipping CDN upload (OBF_ENV=$OBF_ENV, UPLOAD_TO_CDN=$UPLOAD_TO_CDN)"
    UPLOAD_DURATION=0
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

log_info "Fetching remote changes..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

if [[ "$CURRENT_BRANCH" != "main" ]]; then
    log_error "Current branch is $CURRENT_BRANCH, not main. Aborting before Git push."
    exit 1
fi

git fetch origin main

LOCAL=$(git rev-parse @ 2>/dev/null || echo "local")
REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "remote")
BASE=$(git merge-base @ @{u} 2>/dev/null || echo "base")

if [ "$LOCAL" != "$REMOTE" ]; then
    if [ "$LOCAL" = "$BASE" ]; then
        log_info "Remote has new commits. Pulling changes..."
        if git pull origin main --rebase --autostash; then
            log_success "Successfully pulled and rebased changes"
        else
            log_warning "Rebase failed, trying regular merge..."
            git rebase --abort 2>/dev/null
            if git pull origin main --no-rebase; then
                log_success "Successfully merged remote changes"
            else
                log_error "Failed to sync with remote!"
                log_info "Please resolve conflicts manually and run script again"
                exit 1
            fi
        fi
    elif [ "$REMOTE" = "$BASE" ]; then
        log_info "Local has new commits (remote is behind)"
    else
        log_warning "Branches have diverged. Pulling with merge strategy..."
        if git pull origin main --no-rebase; then
            log_success "Successfully merged diverged branches"
        else
            log_error "Failed to merge diverged branches!"
            log_info "Please resolve conflicts manually"
            exit 1
        fi
    fi
else
    log_success "Local is up-to-date with remote"
fi

log_info "Staging changes..."
git add -A

if [[ -n $(git status --porcelain) ]]; then
    log_info "Committing changes..."
    git commit -m "🚀 Deploy $OBF_ENV build - $APP_VERSION ($DEPLOYMENT_PHASE)"
    
    log_info "Pushing to GitHub..."
    if git push origin main; then
        log_success "Successfully pushed to GitHub"
    else
        log_error "Git push failed!"
        log_info "💡 Try running manually: git pull origin main && git push origin main"
        exit 1
    fi
else
    log_info "No changes to commit"
fi

echo ""

# =============================================================================
# PRE-RSYNC:  FIX EC2 PERMISSIONS
# =============================================================================

echo "=========================================="
echo "🔧 PREPARING EC2 FOR SYNC"
echo "=========================================="

log_info "Fixing permissions on EC2..."

ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER_HOST" bash <<'ENDSSH'
    set -euo pipefail
    
    echo "[EC2] Changing ownership to ubuntu:ubuntu..."
    sudo chown -R ubuntu:ubuntu ~/Payroll-NodeJs/ 2>/dev/null || true
    
    echo "[EC2] Setting directory permissions (755)..."
    sudo find ~/Payroll-NodeJs/ -type d -exec chmod 755 {} + 2>/dev/null || true
    
    echo "[EC2] Setting file permissions (644)..."
    sudo find ~/Payroll-NodeJs/ -type f -exec chmod 644 {} + 2>/dev/null || true
    
    echo "[EC2] Fixing /home/ubuntu permissions..."
    sudo chmod 755 /home/ubuntu/ 2>/dev/null || true
    
    echo "[EC2] Fixing project root permissions..."
    sudo chmod 755 ~/Payroll-NodeJs/ 2>/dev/null || true
    
    echo "[EC2] Permissions ready for rsync"
ENDSSH

log_success "EC2 ready for sync"
echo ""

# =============================================================================
# RSYNC TO EC2
# =============================================================================

RSYNC_START=$(date +%s)

echo "=========================================="
echo "📤 SYNCING TO EC2"
echo "=========================================="

log_info "Starting rsync..."

if [[ !  -f "$EXCLUDES_FILE" ]]; then
    log_warning "Exclude file not found: $EXCLUDES_FILE"
    log_info "Creating empty excludes file..."
    touch "$EXCLUDES_FILE"
fi

rsync -az --delete --info=progress2 \
    --exclude-from="$EXCLUDES_FILE" \
    -e "ssh -i $EC2_KEY -o StrictHostKeyChecking=no" \
    "$PROJECT_DIR/" "$EC2_USER_HOST:$REMOTE_DIR/" \
    || {
        log_error "RSYNC failed!"
        exit 1
    }

RSYNC_END=$(date +%s)
RSYNC_DURATION=$((RSYNC_END - RSYNC_START))

log_success "Files synced to EC2 in $(format_duration $RSYNC_DURATION)"
echo ""

# =============================================================================
# POST-RSYNC: FIX PERMISSIONS
# =============================================================================

log_info "Fixing permissions..."

ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER_HOST" bash <<'ENDSSH'
    set -euo pipefail
    
    echo "[EC2] Fixing ownership..."
    sudo chmod 755 /home/ubuntu/ 2>/dev/null || true
    sudo chown -R ubuntu:ubuntu ~/Payroll-NodeJs/ 2>/dev/null || true
    
    echo "[EC2] Fixing directory permissions (755 - readable/executable by all)..."
    find ~/Payroll-NodeJs/ -type d -exec chmod 755 {} + 2>/dev/null || true
    
    echo "[EC2] Fixing file permissions (644 - readable by all)..."
    find ~/Payroll-NodeJs/ -type f -exec chmod 644 {} + 2>/dev/null || true
    
    echo "[EC2] Fixing executable scripts (755)..."
    find ~/Payroll-NodeJs/ -type f \( -name "*.sh" -o -name "*.py" \) -exec chmod 755 {} + 2>/dev/null || true
    
    echo "[EC2] Fixing views directory specifically..."
    find ~/Payroll-NodeJs/views/ -type f -name "*.ejs" -exec chmod 644 {} + 2>/dev/null || true
    
    echo "[EC2] Fixing public directory..."
    find ~/Payroll-NodeJs/public/ -type d -exec chmod 755 {} + 2>/dev/null || true
    find ~/Payroll-NodeJs/public/ -type f -exec chmod 644 {} + 2>/dev/null || true
    
    echo "[EC2] ✅ Permissions fixed:"
    echo "       - Directories: 755 (rwxr-xr-x)"
    echo "       - Files:        644 (rw-r--r--)"
    echo "       - Scripts:     755 (rwxr-xr-x)"
ENDSSH

log_success "Permissions fixed"
echo ""

# =============================================================================
# REMOTE DEPLOYMENT
# =============================================================================

DEPLOY_START=$(date +%s)

echo "=========================================="
echo "🚀 EC2 DEPLOYMENT"
echo "=========================================="

log_info "Deploying on EC2..."

ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER_HOST" bash <<'ENDSSH'
    set -euo pipefail
    
    cd ~/Payroll-NodeJs
    
    echo ""
    echo "=========================================="
    echo "📦 INSTALLING DEPENDENCIES"
    echo "=========================================="
    
    echo "[EC2] Configuring npm for network reliability..."
    npm config set fetch-retry-mintimeout 20000
    npm config set fetch-retry-maxtimeout 120000
    npm config set fetch-retries 5
    npm config set fetch-timeout 300000
    
    echo "[EC2] Cleaning npm cache..."
    npm cache clean --force
    
    echo "[EC2] Installing dependencies with retry logic..."
    MAX_ATTEMPTS=3
    ATTEMPT=1
    INSTALL_SUCCESS=false
    
    while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "[EC2] 📦 npm install - Attempt $ATTEMPT of $MAX_ATTEMPTS"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        if [ -f package-lock.json ]; then
            echo "[EC2] Using npm ci (clean install with retries)..."
            if npm ci --omit=dev --prefer-offline --no-audit 2>&1; then
                echo "[EC2] ✅ npm ci succeeded!"
                INSTALL_SUCCESS=true
                break
            fi
        else
            echo "[EC2] Using npm install..."
            if npm install --omit=dev --prefer-offline --no-audit 2>&1; then
                echo "[EC2] ✅ npm install succeeded!"
                INSTALL_SUCCESS=true
                break
            fi
        fi
        
        if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
            echo ""
            echo "[EC2] ❌ All $MAX_ATTEMPTS npm install attempts failed!"
            echo "[EC2] ⚠️  Trying one last time with online registry..."
            
            if [ -f package-lock.json ]; then
                if npm ci --omit=dev --no-audit 2>&1; then
                    echo "[EC2] ✅ Online install succeeded!"
                    INSTALL_SUCCESS=true
                    break
                fi
            else
                if npm install --omit=dev --no-audit 2>&1; then
                    echo "[EC2] ✅ Online install succeeded!"
                    INSTALL_SUCCESS=true
                    break
                fi
            fi
            
            echo "[EC2] ❌ Final attempt failed. Deployment aborted."
            exit 1
        fi
        
        echo ""
        echo "[EC2] ⚠️  Attempt $ATTEMPT failed"
        echo "[EC2] 🔄 Retrying in 10 seconds..."
        sleep 10
        ATTEMPT=$((ATTEMPT + 1))
    done
    
    if [ "$INSTALL_SUCCESS" = true ]; then
        echo ""
        echo "[EC2] ✅ Dependencies installed successfully!"
        
        echo ""
        echo "[EC2] Verifying critical packages..."
        npm list cookie multer --depth=0 || true
    fi
    
    echo ""
    echo "=========================================="
    echo "🔄 RESTARTING APPLICATION"
    echo "=========================================="
    
    # ✅ Ensure custom logs path exists (PM2 uses these paths)
    echo "[EC2] Ensuring custom PM2 logs directory exists..."
    mkdir -p /home/ubuntu/Payroll-NodeJs/logs
    touch /home/ubuntu/Payroll-NodeJs/logs/pm2-out.log \
          /home/ubuntu/Payroll-NodeJs/logs/pm2-error.log
    chown -R ubuntu:ubuntu /home/ubuntu/Payroll-NodeJs/logs
    chmod -R 755 /home/ubuntu/Payroll-NodeJs/logs

    echo "[EC2] Flushing old PM2 logs..."
    pm2 flush

    echo "[EC2] Reloading PM2..."
    if pm2 describe payroll > /dev/null 2>&1; then
      echo "[EC2] App exists - performing reload..."
      pm2 reload payroll --update-env
    else
      echo "[EC2] App not found - starting fresh..."
      pm2 start app.js --name payroll --update-env
    fi
    
    echo ""
    echo "[EC2] Waiting for application startup..."
    sleep 3
    
    echo ""
    echo "[EC2] Application status:"
    pm2 status payroll
    
    echo ""
    echo "[EC2] Last 20 log lines:"
    pm2 logs payroll --lines 20 --nostream || echo "[EC2] Could not fetch logs"
    
    echo ""
    echo "[EC2] ✅ Remote deployment commands completed!"
ENDSSH

# ============================================================================
# POST-DEPLOYMENT VERIFICATION (runs locally, NOT on EC2)
# ============================================================================

if [[ $?  -eq 0 ]]; then
    log_success "Remote commands executed successfully"
    
    echo ""
    log_info "Verifying application status from local machine..."
    
    # Check PM2 status (runs locally via SSH)
    APP_STATUS=$(ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER_HOST" \
        "pm2 jlist 2>/dev/null | jq -r '.[] | select(.name==\"payroll\") | .pm2_env.status' 2>/dev/null || echo 'unknown'")
    
    if [[ "$APP_STATUS" == "online" ]]; then
        log_success "Application status: ONLINE ✅"
        
        # Check for CRITICAL errors only (not warnings)
        log_info "Checking for critical errors..."
        CRITICAL_ERRORS=$(ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER_HOST" \
            "pm2 logs payroll --err --lines 50 --nostream 2>/dev/null | grep -iE 'error:|exception:|fatal:|crash' | wc -l" 2>/dev/null || echo "0")
        
        if [[ $CRITICAL_ERRORS -gt 0 ]]; then
            log_warning "Found $CRITICAL_ERRORS critical error(s):"
            echo ""
            ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER_HOST" \
                "pm2 logs payroll --err --lines 10 --nostream 2>/dev/null | grep -iE 'error:|exception:|fatal:|crash'" || true
        else
            log_success "No critical errors found!  ✅"
        fi
        
        # Show last 5 lines of output for verification
        echo ""
        log_info "Last 5 lines of application output:"
        ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER_HOST" \
            "pm2 logs payroll --out --lines 5 --nostream 2>/dev/null" || log_info "No output logs available"
    else
        log_error "Application status:  $APP_STATUS ❌"
        log_error "Fetching error logs..."
        echo ""
        ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER_HOST" \
            "pm2 logs payroll --err --lines 30 --nostream 2>/dev/null" || log_error "Could not fetch error logs"
        exit 1
    fi
else
    log_error "Remote deployment failed!"
    exit 1
fi

DEPLOY_END=$(date +%s)
DEPLOY_DURATION=$((DEPLOY_END - DEPLOY_START))

log_success "EC2 deployment complete in $(format_duration $DEPLOY_DURATION)"
echo ""

# =============================================================================
# DNS AUTO-UPDATE (Ubuntu/Linux)
# =============================================================================

echo "=========================================="
echo "🌐 DNS AUTO-UPDATE"
echo "=========================================="

DNS_SCRIPT="$PROJECT_DIR/dns-update-ubuntu.sh"

if [[ -f "$DNS_SCRIPT" ]]; then
    log_info "Executing DNS Auto-Update (Bash)..."
    bash "$DNS_SCRIPT" || log_warning "DNS update failed (non-critical)"
else
    log_warning "DNS update script not found: $DNS_SCRIPT"
    log_info "💡 Create $DNS_SCRIPT to enable automatic DNS updates"
fi

echo ""

# =============================================================================
# SUMMARY
# =============================================================================

END_TIME=$(date +%s)
END_TIME_FORMATTED=$(date '+%Y-%m-%d %H:%M:%S')
TOTAL_DURATION=$((END_TIME - START_TIME))
TOTAL_DURATION_FORMATTED=$(format_duration $TOTAL_DURATION)

echo ""
echo "=========================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "=========================================="
echo "Environment:     $OBF_ENV"
echo "Version:        $APP_VERSION"
echo "Phase:          $DEPLOYMENT_PHASE"
echo "OS:             Linux/Ubuntu"
echo ""
echo "📊 FILE STATISTICS:"
echo "  Expected:      $TOTAL_FILES_EXPECTED files"
echo "  Created:      $TOTAL_FILES_CREATED files"
echo "  Failed:       $TOTAL_FILES_FAILED files"
if [[ $TOTAL_FILES_EXPECTED -gt 0 ]]; then
    echo "  Success Rate: $(( TOTAL_FILES_CREATED * 100 / TOTAL_FILES_EXPECTED ))%"
fi

echo ""
echo "⏱️  TIMING:"
echo "  Started:       $START_TIME_FORMATTED"
echo "  Finished:     $END_TIME_FORMATTED"
echo "  Total:         $TOTAL_DURATION_FORMATTED"
echo ""
echo "📊 PHASE BREAKDOWN:"
echo "  Build Phase 1.1:  $(format_duration $PHASE1_DURATION)"
echo "  Build Phase 1.2:  $(format_duration $PHASE2_DURATION)"
echo "  Build Phase 1.3:  $(format_duration $PHASE3_DURATION)"
echo "  Build Phase 1.4:  $(format_duration $PHASE4_DURATION)"
echo "  Build Phase 1.5:  $(format_duration $PHASE5_DURATION)"
echo "  Build Phase 1.6:  $(format_duration $PHASE6_DURATION)"
echo "  Build Phase 1.7:  $(format_duration $PHASE7_DURATION)"
echo "  Build Phase 1.8:  $(format_duration $PHASE8_DURATION)"
echo "  Build Phase 1.9:  $(format_duration $PHASE9_DURATION)"
echo "  Total Build:       $(format_duration $BUILD_DURATION)"

if [[ "$UPLOAD_TO_CDN" == "true" && "$OBF_ENV" == "prod" ]]; then
    echo "  CDN Upload:       $(format_duration $UPLOAD_DURATION)"
fi
echo "  EC2 Sync:         $(format_duration $RSYNC_DURATION)"
echo "  EC2 Deployment:   $(format_duration $DEPLOY_DURATION)"
echo ""
echo "📦 OUTPUT:"
echo "  Build output:  $OUTPUT_DIR"
if [[ "$UPLOAD_TO_CDN" == "true" ]]; then
    echo "  S3 Bucket:    s3://$S3_BUCKET/$S3_PREFIX/"
    echo "  CDN URL:      $CDN_URL/$S3_PREFIX/"
fi
echo "  EC2 Status:   ✅ Running"
echo ""

if [[ $TOTAL_FILES_FAILED -gt 0 ]]; then
    echo -e "${YELLOW}⚠️  WARNING: $TOTAL_FILES_FAILED file(s) failed during build${NC}"
    echo "Review the output above for details."
    echo ""
fi

echo "=========================================="
echo ""