#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# DNS Auto-Update - ELASTIC IP VERSION
# =============================================================================

DOMAIN="webpayrollsolutions.com"
LOG_FILE="/tmp/dns-update-$(date +%Y%m%d).log"
JSON_FILE="/tmp/route53-change-batch.json"

# ✅ ELASTIC IP - ΣΤΑΘΕΡΗ - ΔΕΝ ΑΛΛΑΖΕΙ ΠΟΤΕ
EC2_PUBLIC_IP="18.199.180.229"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# =============================================================================
# FUNCTIONS
# =============================================================================

log_info() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ℹ️  $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ⚠️  $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ❌ $1" | tee -a "$LOG_FILE"
}

log_step() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} 👉 $1" | tee -a "$LOG_FILE"
}

# =============================================================================
# MAIN SCRIPT
# =============================================================================

echo ""
echo "=========================================="
echo "🌐 DNS AUTO-UPDATE (ELASTIC IP MODE)"
echo "=========================================="

log_info "Target Domain:    $DOMAIN"
log_info "Elastic IP (EC2): $EC2_PUBLIC_IP"
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI not installed"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &>/dev/null; then
    log_error "AWS credentials not configured!"
    log_info "💡 Run: aws configure"
    exit 1
fi

# Get Hosted Zone ID dynamically
log_step "Fetching Hosted Zone ID..."
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name == '${DOMAIN}.'].Id | [0]" \
    --output text 2>/dev/null || echo "")

HOSTED_ZONE_ID="${HOSTED_ZONE_ID#/hostedzone/}"

if [[ -z "$HOSTED_ZONE_ID" || "$HOSTED_ZONE_ID" == "None" ]]; then
    log_error "Hosted Zone for $DOMAIN not found"
    exit 1
fi

log_info "✅ Hosted Zone ID: $HOSTED_ZONE_ID"

# Get current DNS IPs
log_step "Fetching current DNS records..."

CURRENT_ROOT_IP=$(aws route53 list-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --query "ResourceRecordSets[?Name == '${DOMAIN}.' && Type == 'A'].ResourceRecords[0].Value | [0]" \
    --output text 2>/dev/null || echo "")

CURRENT_WWW_IP=$(aws route53 list-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --query "ResourceRecordSets[?Name == 'www.${DOMAIN}.' && Type == 'A'].ResourceRecords[0].Value | [0]" \
    --output text 2>/dev/null || echo "")

log_info "Current $DOMAIN IP:     ${CURRENT_ROOT_IP:-Not set}"
log_info "Current www.$DOMAIN IP: ${CURRENT_WWW_IP:-Not set}"
log_info "Target Elastic IP:       $EC2_PUBLIC_IP"

# Check if update is needed
ROOT_NEEDS_UPDATE=false
WWW_NEEDS_UPDATE=false

[[ "$CURRENT_ROOT_IP" != "$EC2_PUBLIC_IP" ]] && ROOT_NEEDS_UPDATE=true
[[ "$CURRENT_WWW_IP"  != "$EC2_PUBLIC_IP" ]] && WWW_NEEDS_UPDATE=true

if [[ "$ROOT_NEEDS_UPDATE" == "false" && "$WWW_NEEDS_UPDATE" == "false" ]]; then
    log_info "✅ DNS already correct - no update needed"
    echo ""
    exit 0
fi

log_warning "DNS update needed!"
log_step "Updating Route 53 records..."

# Create JSON change batch (both root and www)
cat > "$JSON_FILE" <<EOF
{
    "Changes": [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "${DOMAIN}",
                "Type": "A",
                "TTL": 300,
                "ResourceRecords": [{"Value": "$EC2_PUBLIC_IP"}]
            }
        },
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "www.${DOMAIN}",
                "Type": "A",
                "TTL": 300,
                "ResourceRecords": [{"Value": "$EC2_PUBLIC_IP"}]
            }
        }
    ]
}
EOF

# Update Route 53
CHANGE_RESULT=$(aws route53 change-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --change-batch "file://$JSON_FILE" \
    --output json 2>&1)

if [[ $? -eq 0 ]]; then
    CHANGE_ID=$(echo "$CHANGE_RESULT" | grep -o '"Id": "[^"]*"' | head -1 | cut -d'"' -f4)
    log_info "✅ DNS updated → $EC2_PUBLIC_IP"

    if [[ -n "$CHANGE_ID" ]]; then
        log_info "Change ID: $CHANGE_ID"
        log_step "Waiting for DNS propagation..."
        aws route53 wait resource-record-sets-changed --id "$CHANGE_ID" 2>/dev/null || true
        log_info "✅ DNS propagated!"
    fi
else
    log_error "Failed to update DNS"
    log_error "$CHANGE_RESULT"
    rm -f "$JSON_FILE"
    exit 1
fi

rm -f "$JSON_FILE"

echo ""
log_info "🎉 DNS Auto-Update complete!"
log_info "✅ $DOMAIN       → $EC2_PUBLIC_IP"
log_info "✅ www.$DOMAIN   → $EC2_PUBLIC_IP"
echo "=========================================="
echo ""

exit 0