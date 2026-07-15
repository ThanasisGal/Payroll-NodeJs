#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly CSS_SOURCE="public/css/main.css"
readonly CLEAN_CSS_BIN="./node_modules/.bin/cleancss"
readonly S3_BUCKET="employee-certificates-webpayrollsolutions-central"
readonly S3_FINAL_KEY="assets/own/css/main.min.css"
readonly AWS_REGION="eu-central-1"
readonly CLOUDFRONT_REGION="us-east-1"
readonly CLOUDFRONT_DISTRIBUTION_ID="E2FVQEZRP01HIX"
readonly CDN_CSS_URL="https://cdn.webpayrollsolutions.com/assets/own/css/main.min.css"
readonly CSS_CACHE_CONTROL="public, max-age=0, s-maxage=31536000, must-revalidate"

ACTION=""
INTERACTIVE="false"
INITIAL_HEAD=""
INITIAL_VERSION=""
REPOSITORY=""
TEMP_DIR=""
GENERATED_CSS=""
LOCAL_CSS_SHA=""
REMOTE_CSS_SHA=""
FINAL_S3_SHA=""
CDN_SHA=""
INVALIDATION_ID=""
VERIFY_STATE=""
S3_OBJECT_PRESENT="false"
S3_COMPLIANT="false"
CDN_COMPLIANT="false"

log() { printf '%s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

cleanup() {
    if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
        rm -rf -- "$TEMP_DIR"
    fi
}
trap cleanup EXIT INT TERM

usage() {
    cat <<'EOF'
Usage: ./deploy-css-linux.sh [verify|deploy|--help]

Actions:
  verify  Read-only verification of merged CSS against production S3/CDN.
  deploy  Verified CSS-only production promotion through staging, S3, and CloudFront.

Without an action, an interactive menu is displayed.
EOF
}

select_interactive_action() {
    INTERACTIVE="true"
    log "1) Verify merged CSS"
    log "2) Deploy merged CSS"
    log "3) Exit"
    read -r -p "Select action: " choice
    case "$choice" in
        1) ACTION="verify" ;;
        2) ACTION="deploy" ;;
        3) exit 0 ;;
        *) fail "Invalid selection" ;;
    esac
}

parse_action() {
    case "${1:-}" in
        "") select_interactive_action ;;
        verify|deploy) ACTION="$1" ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; fail "Invalid action: $1" ;;
    esac
    if (( $# > 1 )); then
        fail "Unexpected additional arguments"
    fi
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "Required command is not installed: $1"
}

immutable_git_preflight() {
    require_command git
    require_command node
    require_command gh

    cd "$SCRIPT_DIR"
    [[ "$(git branch --show-current)" == "main" ]] || fail "CSS workflow requires the main branch"
    [[ -z "$(git status --porcelain)" ]] || fail "Working tree or index is not clean"

    git fetch --prune origin main

    INITIAL_HEAD="$(git rev-parse HEAD)"
    INITIAL_VERSION="$(node -p "require('./package.json').version")"
    local origin_head divergence
    origin_head="$(git rev-parse origin/main)"
    divergence="$(git rev-list --left-right --count main...origin/main)"

    [[ "$INITIAL_HEAD" == "$origin_head" ]] || fail "Local HEAD does not match origin/main"
    [[ "$divergence" == $'0\t0' ]] || fail "main and origin/main have diverged: $divergence"
    [[ -n "$INITIAL_VERSION" ]] || fail "Package version is empty"

    log "Immutable Git preflight passed: main=$INITIAL_HEAD version=$INITIAL_VERSION"
}

exact_head_main_ci_guard() {
    gh auth status >/dev/null 2>&1 || fail "GitHub CLI is not authenticated"
    REPOSITORY="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
    [[ -n "$REPOSITORY" ]] || fail "Unable to resolve GitHub repository"

    local run_id validate_result
    run_id="$(gh run list \
        --repo "$REPOSITORY" \
        --branch main \
        --event push \
        --limit 50 \
        --json databaseId,headSha,event,status,conclusion \
        --jq ".[] | select(.headSha == \"$INITIAL_HEAD\" and .event == \"push\" and .status == \"completed\" and .conclusion == \"success\") | .databaseId" \
        | head -n 1)"
    [[ -n "$run_id" ]] || fail "No successful exact-head main push CI exists for $INITIAL_HEAD"

    validate_result="$(gh run view "$run_id" --repo "$REPOSITORY" --json jobs \
        --jq '.jobs[] | select(.name == "validate") | select(.status == "completed" and .conclusion == "success") | .databaseId')"
    [[ -n "$validate_result" ]] || fail "Exact-head main CI does not contain a successful validate job"
    log "Exact-head main push CI passed: run=$run_id validate_job=$validate_result"
}

prepare_temp_directory() {
    TEMP_DIR="$(mktemp -d)"
    chmod 700 "$TEMP_DIR"
}

deterministic_css_build() {
    [[ -x "$CLEAN_CSS_BIN" ]] || fail "Local cleancss binary is missing; dependencies were not installed"
    [[ -f "$CSS_SOURCE" ]] || fail "CSS source is missing: $CSS_SOURCE"
    [[ -n "$TEMP_DIR" ]] || fail "Temporary directory is not initialized"

    local first_css="$TEMP_DIR/first.min.css"
    local second_css="$TEMP_DIR/second.min.css"
    "$CLEAN_CSS_BIN" --inline none -o "$first_css" "$CSS_SOURCE"
    "$CLEAN_CSS_BIN" --inline none -o "$second_css" "$CSS_SOURCE"
    if ! cmp -s "$first_css" "$second_css"; then
        fail "CSS BUILD IS NOT DETERMINISTIC"
    fi
    [[ -s "$first_css" ]] || fail "Generated CSS is empty"

    GENERATED_CSS="$first_css"
    LOCAL_CSS_SHA="$(sha256sum "$GENERATED_CSS" | awk '{ print $1 }')"
    log "Deterministic CSS build passed: sha256=$LOCAL_CSS_SHA"
}

aws_readiness_guard() {
    require_command aws
    aws sts get-caller-identity >/dev/null
    aws s3api list-objects-v2 \
        --bucket "$S3_BUCKET" \
        --prefix "assets/own/css/" \
        --max-keys 1 \
        --region "$AWS_REGION" >/dev/null
    aws cloudfront get-distribution \
        --id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --region "$CLOUDFRONT_REGION" >/dev/null
    log "AWS identity, S3 read access, and CloudFront read access passed"
}

read_current_production_css() {
    local remote_css="$TEMP_DIR/current-s3.min.css"
    local exact_key_count
    exact_key_count="$(aws s3api list-objects-v2 \
        --bucket "$S3_BUCKET" \
        --prefix "$S3_FINAL_KEY" \
        --max-keys 1000 \
        --query "length(Contents[?Key == '$S3_FINAL_KEY'])" \
        --output text \
        --region "$AWS_REGION")"
    case "$exact_key_count" in
        0)
            S3_OBJECT_PRESENT="false"
            S3_COMPLIANT="false"
            REMOTE_CSS_SHA=""
            return
            ;;
        1) S3_OBJECT_PRESENT="true" ;;
        *) fail "Malformed exact-key S3 lookup response" ;;
    esac

    aws s3api get-object \
        --bucket "$S3_BUCKET" \
        --key "$S3_FINAL_KEY" \
        --region "$AWS_REGION" \
        "$remote_css" >/dev/null
    [[ -s "$remote_css" ]] || fail "Production S3 CSS object is empty"
    REMOTE_CSS_SHA="$(sha256sum "$remote_css" | awk '{ print $1 }')"

    local remote_content_type remote_cache_control remote_git_sha remote_app_version remote_metadata_css_sha
    read -r remote_content_type remote_cache_control remote_git_sha remote_app_version remote_metadata_css_sha < <(
        aws s3api head-object \
            --bucket "$S3_BUCKET" \
            --key "$S3_FINAL_KEY" \
            --region "$AWS_REGION" \
            --query '[ContentType,CacheControl,Metadata."git-sha",Metadata."app-version",Metadata."css-sha256"]' \
            --output text
    )
    [[ -n "$remote_content_type" && -n "$remote_cache_control" ]] \
        || fail "Malformed production S3 CSS metadata response"

    if [[ "$REMOTE_CSS_SHA" == "$LOCAL_CSS_SHA" \
        && "$remote_content_type" == "text/css; charset=utf-8" \
        && "$remote_cache_control" == "$CSS_CACHE_CONTROL" \
        && "$remote_git_sha" == "$INITIAL_HEAD" \
        && "$remote_app_version" == "$INITIAL_VERSION" \
        && "$remote_metadata_css_sha" == "$LOCAL_CSS_SHA" ]]; then
        S3_COMPLIANT="true"
    else
        S3_COMPLIANT="false"
    fi
}

read_current_cdn_css() {
    require_command curl
    local cdn_probe="$TEMP_DIR/current-cdn.min.css"
    local cdn_headers="$TEMP_DIR/current-cdn.headers"
    local cdn_content_type cdn_cache_control

    curl --fail --silent --show-error --location \
        "$CDN_CSS_URL?verify=${LOCAL_CSS_SHA}-${INITIAL_HEAD}" \
        --dump-header "$cdn_headers" \
        --output "$cdn_probe"
    [[ -s "$cdn_probe" ]] || fail "Production CDN CSS response is empty"
    [[ -s "$cdn_headers" ]] || fail "Production CDN response headers are empty"

    cdn_content_type="$(awk 'BEGIN { IGNORECASE=1 } /^Content-Type:/ { sub(/^[^:]*:[[:space:]]*/, ""); value=$0 } END { print value }' "$cdn_headers" | tr -d '\r')"
    cdn_cache_control="$(awk 'BEGIN { IGNORECASE=1 } /^Cache-Control:/ { sub(/^[^:]*:[[:space:]]*/, ""); value=$0 } END { print value }' "$cdn_headers" | tr -d '\r')"
    [[ -n "$cdn_content_type" && -n "$cdn_cache_control" ]] \
        || fail "Malformed production CDN response headers"

    CDN_SHA="$(sha256sum "$cdn_probe" | awk '{ print $1 }')"
    if [[ "$CDN_SHA" == "$LOCAL_CSS_SHA" \
        && "${cdn_content_type,,}" == text/css* \
        && "${cdn_cache_control,,}" == *max-age=0* \
        && "${cdn_cache_control,,}" == *must-revalidate* ]]; then
        CDN_COMPLIANT="true"
    else
        CDN_COMPLIANT="false"
    fi
}

calculate_verify_state() {
    if [[ "$S3_OBJECT_PRESENT" != "true" ]]; then
        VERIFY_STATE="CSS_REMOTE_OBJECT_MISSING"
    elif [[ "$S3_COMPLIANT" != "true" ]]; then
        VERIFY_STATE="CSS_DEPLOYMENT_REQUIRED"
    elif [[ "$CDN_COMPLIANT" != "true" ]]; then
        VERIFY_STATE="CSS_DEPLOYMENT_REQUIRED"
    else
        VERIFY_STATE="CSS_ALREADY_DEPLOYED"
    fi

    log "local_css_hash=$LOCAL_CSS_SHA"
    log "s3_css_hash=${REMOTE_CSS_SHA:-unavailable}"
    log "cdn_css_hash=${CDN_SHA:-unavailable}"
    log "s3_compliant=$S3_COMPLIANT"
    log "cdn_compliant=$CDN_COMPLIANT"
    log "verify_state=$VERIFY_STATE"
}

immutable_git_postflight() {
    local current_head current_version origin_head divergence
    current_head="$(git rev-parse HEAD)"
    current_version="$(node -p "require('./package.json').version")"
    origin_head="$(git rev-parse origin/main)"
    divergence="$(git rev-list --left-right --count main...origin/main)"

    [[ "$(git branch --show-current)" == "main" ]] || fail "Branch changed during CSS workflow"
    [[ "$current_head" == "$INITIAL_HEAD" ]] || fail "HEAD changed during CSS workflow"
    [[ "$origin_head" == "$INITIAL_HEAD" ]] || fail "origin/main changed during CSS workflow"
    [[ "$current_version" == "$INITIAL_VERSION" ]] || fail "Package version changed during CSS workflow"
    [[ "$divergence" == $'0\t0' ]] || fail "main divergence changed during CSS workflow"
    [[ -z "$(git status --porcelain)" ]] || fail "Repository changed during CSS workflow"
    log "Immutable Git postflight passed"
}

immutable_git_pre_mutation_guard() {
    git fetch --prune origin main

    local current_head current_version origin_head divergence
    current_head="$(git rev-parse HEAD)"
    current_version="$(node -p "require('./package.json').version")"
    origin_head="$(git rev-parse origin/main)"
    divergence="$(git rev-list --left-right --count main...origin/main)"

    if [[ "$(git branch --show-current)" != "main" \
        || -n "$(git status --porcelain)" \
        || "$current_head" != "$INITIAL_HEAD" \
        || "$origin_head" != "$INITIAL_HEAD" \
        || "$divergence" != $'0\t0' \
        || "$current_version" != "$INITIAL_VERSION" ]]; then
        fail "CSS DEPLOYMENT ABORTED — MAIN CHANGED AFTER VERIFICATION"
    fi
    log "Immutable Git pre-mutation guard passed"
}

immutable_git_pre_final_promotion_guard() {
    git fetch --prune origin main

    local current_head current_version origin_head divergence
    current_head="$(git rev-parse HEAD)"
    current_version="$(node -p "require('./package.json').version")"
    origin_head="$(git rev-parse origin/main)"
    divergence="$(git rev-list --left-right --count main...origin/main)"

    if [[ "$(git branch --show-current)" != "main" \
        || -n "$(git status --porcelain)" \
        || "$current_head" != "$INITIAL_HEAD" \
        || "$origin_head" != "$INITIAL_HEAD" \
        || "$divergence" != $'0\t0' \
        || "$current_version" != "$INITIAL_VERSION" ]]; then
        fail "CSS DEPLOYMENT ABORTED — MAIN CHANGED BEFORE FINAL CSS PROMOTION"
    fi
    log "Immutable Git pre-final-promotion guard passed"
}

run_verify_workflow() {
    immutable_git_preflight
    exact_head_main_ci_guard
    prepare_temp_directory
    deterministic_css_build
    aws_readiness_guard
    read_current_production_css
    read_current_cdn_css
    calculate_verify_state
    immutable_git_postflight
    log "$VERIFY_STATE"
}

confirm_production_deploy() {
    if [[ "$INTERACTIVE" == "true" ]]; then
        local confirmation
        read -r -p "Type DEPLOY CSS PRODUCTION to continue: " confirmation
        [[ "$confirmation" == "DEPLOY CSS PRODUCTION" ]] || fail "Production CSS deployment was not confirmed"
    else
        [[ "${CONFIRM_PRODUCTION_CSS_DEPLOY:-}" == "yes" ]] || fail "Set CONFIRM_PRODUCTION_CSS_DEPLOY=yes to deploy production CSS"
    fi
}

promote_css_through_staging() {
    local staging_key="assets/own/css/.staging/main.min.${INITIAL_HEAD}.${LOCAL_CSS_SHA}.css"
    local staging_download="$TEMP_DIR/staging-download.min.css"
    local final_download="$TEMP_DIR/final-download.min.css"
    local staging_sha

    aws s3api put-object \
        --bucket "$S3_BUCKET" \
        --key "$staging_key" \
        --body "$GENERATED_CSS" \
        --content-type "text/css; charset=utf-8" \
        --cache-control "$CSS_CACHE_CONTROL" \
        --metadata "git-sha=$INITIAL_HEAD,app-version=$INITIAL_VERSION,css-sha256=$LOCAL_CSS_SHA" \
        --region "$AWS_REGION" >/dev/null

    aws s3api get-object \
        --bucket "$S3_BUCKET" \
        --key "$staging_key" \
        --region "$AWS_REGION" \
        "$staging_download" >/dev/null
    staging_sha="$(sha256sum "$staging_download" | awk '{ print $1 }')"
    [[ "$staging_sha" == "$LOCAL_CSS_SHA" ]] || fail "Staging S3 CSS hash verification failed"

    immutable_git_pre_final_promotion_guard

    aws s3api copy-object \
        --bucket "$S3_BUCKET" \
        --key "$S3_FINAL_KEY" \
        --copy-source "$S3_BUCKET/$staging_key" \
        --metadata-directive REPLACE \
        --content-type "text/css; charset=utf-8" \
        --cache-control "$CSS_CACHE_CONTROL" \
        --metadata "git-sha=$INITIAL_HEAD,app-version=$INITIAL_VERSION,css-sha256=$LOCAL_CSS_SHA" \
        --region "$AWS_REGION" >/dev/null

    aws s3api get-object \
        --bucket "$S3_BUCKET" \
        --key "$S3_FINAL_KEY" \
        --region "$AWS_REGION" \
        "$final_download" >/dev/null
    FINAL_S3_SHA="$(sha256sum "$final_download" | awk '{ print $1 }')"
    [[ "$FINAL_S3_SHA" == "$LOCAL_CSS_SHA" ]] || fail "Final S3 CSS hash verification failed"

    local final_content_type final_cache_control final_git_sha final_app_version final_css_sha
    read -r final_content_type final_cache_control final_git_sha final_app_version final_css_sha < <(
        aws s3api head-object \
            --bucket "$S3_BUCKET" \
            --key "$S3_FINAL_KEY" \
            --region "$AWS_REGION" \
            --query '[ContentType,CacheControl,Metadata."git-sha",Metadata."app-version",Metadata."css-sha256"]' \
            --output text
    )
    [[ "$final_content_type" == "text/css; charset=utf-8" ]] || fail "Final S3 ContentType verification failed"
    [[ "$final_cache_control" == "$CSS_CACHE_CONTROL" ]] || fail "Final S3 CacheControl verification failed"
    [[ "$final_git_sha" == "$INITIAL_HEAD" ]] || fail "Final S3 git-sha metadata verification failed"
    [[ "$final_app_version" == "$INITIAL_VERSION" ]] || fail "Final S3 app-version metadata verification failed"
    [[ "$final_css_sha" == "$LOCAL_CSS_SHA" ]] || fail "Final S3 css-sha256 metadata verification failed"

    aws s3api delete-object \
        --bucket "$S3_BUCKET" \
        --key "$staging_key" \
        --region "$AWS_REGION" >/dev/null
    log "S3 staging and final hash verification passed"
}

invalidate_cloudfront_and_wait() {
    INVALIDATION_ID="$(aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --paths "/$S3_FINAL_KEY" "/$S3_FINAL_KEY*" \
        --region "$CLOUDFRONT_REGION" \
        --query 'Invalidation.Id' \
        --output text)"
    [[ -n "$INVALIDATION_ID" && "$INVALIDATION_ID" != "None" ]] || fail "CloudFront invalidation ID was not returned"
    aws cloudfront wait invalidation-completed \
        --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --id "$INVALIDATION_ID" \
        --region "$CLOUDFRONT_REGION"
    log "CloudFront invalidation completed: id=$INVALIDATION_ID"
}

verify_cdn_after_deploy() {
    require_command curl
    local cdn_download="$TEMP_DIR/deployed-cdn.min.css"
    local cdn_headers="$TEMP_DIR/deployed-cdn.headers"
    curl --fail --silent --show-error --location \
        "$CDN_CSS_URL?css_sha=$LOCAL_CSS_SHA" \
        --dump-header "$cdn_headers" \
        --output "$cdn_download"
    local cdn_content_type cdn_cache_control
    cdn_content_type="$(awk 'BEGIN { IGNORECASE=1 } /^Content-Type:/ { sub(/^[^:]*:[[:space:]]*/, ""); value=$0 } END { print value }' "$cdn_headers" | tr -d '\r')"
    cdn_cache_control="$(awk 'BEGIN { IGNORECASE=1 } /^Cache-Control:/ { sub(/^[^:]*:[[:space:]]*/, ""); value=$0 } END { print value }' "$cdn_headers" | tr -d '\r')"
    [[ "${cdn_content_type,,}" == text/css* ]] || fail "CDN Content-Type verification failed"
    [[ "${cdn_cache_control,,}" == *max-age=0* ]] || fail "CDN Cache-Control max-age verification failed"
    [[ "${cdn_cache_control,,}" == *must-revalidate* ]] || fail "CDN Cache-Control revalidation verification failed"
    CDN_SHA="$(sha256sum "$cdn_download" | awk '{ print $1 }')"
    if [[ "$CDN_SHA" != "$LOCAL_CSS_SHA" ]]; then
        log "local_hash=$LOCAL_CSS_SHA"
        log "final_s3_hash=$FINAL_S3_SHA"
        log "cdn_hash=$CDN_SHA"
        log "git_sha=$INITIAL_HEAD"
        log "invalidation_id=$INVALIDATION_ID"
        fail "CSS DEPLOYMENT VERIFICATION FAILED"
    fi
    log "CDN hash verification passed: sha256=$CDN_SHA"
}

run_deploy_workflow() {
    run_verify_workflow
    case "$VERIFY_STATE" in
        CSS_ALREADY_DEPLOYED) exit 0 ;;
        CSS_DEPLOYMENT_REQUIRED|CSS_REMOTE_OBJECT_MISSING) ;;
        *) fail "Unexpected or empty CSS verify state" ;;
    esac
    confirm_production_deploy
    immutable_git_pre_mutation_guard
    promote_css_through_staging
    invalidate_cloudfront_and_wait
    verify_cdn_after_deploy
    immutable_git_postflight
    log "CSS_DEPLOYMENT_COMPLETED"
    log "git_sha=$INITIAL_HEAD css_sha256=$LOCAL_CSS_SHA invalidation_id=$INVALIDATION_ID"
}

parse_action "$@"
case "$ACTION" in
    verify) run_verify_workflow ;;
    deploy) run_deploy_workflow ;;
esac
