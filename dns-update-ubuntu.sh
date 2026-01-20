#!/usr/bin/env bash
# =============================================================================
# DNS Auto-Update Script for Ubuntu/Linux
# Updates Route 53 A record with current public IP
# =============================================================================

set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================

DOMAIN="webpayrollsolutions.com"
HOSTED_ZONE_ID="Z08781101STB1NL30PU2"  # Hardcoded - από το screenshot
LOG_FILE="/tmp/dns-update-$(date +%Y%m%d).log"
JSON_FILE="/tmp/route53-change-batch.json"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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

# =============================================================================
# MAIN SCRIPT
# =============================================================================

log_info "Starting DNS Auto-Update for $DOMAIN..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI not installed"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &>/dev/null; then
    log_error "AWS credentials not configured!"
    exit 1
fi

log_info "Using Hosted Zone ID: $HOSTED_ZONE_ID"

# Get current public IP
log_info "Fetching current public IP..."
NEW_IP=$(curl -s https://checkip.amazonaws.com | tr -d '[:space:]')

if [[ -z "$NEW_IP" ]]; then
    log_error "Failed to fetch public IP"
    exit 1
fi

log_info "Current Public IP: $NEW_IP"

# Get current DNS IP (Route 53 stores domains with trailing dot)
log_info "Fetching current DNS IP..."
CURRENT_IP=$(aws route53 list-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --query "ResourceRecordSets[?Name == '${DOMAIN}.' && Type == 'A']. ResourceRecords[0].Value | [0]" \
    --output text 2>/dev/null || echo "")

if [[ -z "$CURRENT_IP" || "$CURRENT_IP" == "None" ]]; then
    CURRENT_IP="Not set"
fi

log_info "Current DNS IP: $CURRENT_IP"

# Check if update is needed
if [[ "$NEW_IP" == "$CURRENT_IP" ]]; then
    log_info "No IP change detected.  DNS is up-to-date."
    exit 0
fi

log_warning "New IP detected:  $NEW_IP (Old IP:  $CURRENT_IP)"
log_info "Updating Route 53..."

# Create JSON change batch
cat > "$JSON_FILE" <<EOF
{
    "Changes":  [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "${DOMAIN}",
                "Type": "A",
                "TTL":  300,
                "ResourceRecords": [
                    {
                        "Value": "$NEW_IP"
                    }
                ]
            }
        }
    ]
}
EOF

log_info "JSON change batch created"

# Update Route 53 (NO --region flag needed!)
CHANGE_RESULT=$(aws route53 change-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --change-batch "file://$JSON_FILE" \
    --output json 2>&1)

if [[ $? -eq 0 ]]; then
    CHANGE_ID=$(echo "$CHANGE_RESULT" | grep -o '"Id": "[^"]*"' | head -1 | cut -d'"' -f4)
    log_info "✅ DNS successfully updated to $NEW_IP"
    log_info "Change ID: $CHANGE_ID"
    
    # Wait for propagation
    log_info "Waiting for DNS propagation..."
    if [[ -n "$CHANGE_ID" ]]; then
        aws route53 wait resource-record-sets-changed --id "$CHANGE_ID" 2>/dev/null || true
    fi
    log_info "✅ DNS change propagated!"
else
    log_error "Failed to update DNS"
    log_error "Error: $CHANGE_RESULT"
    exit 1
fi

# Cleanup
rm -f "$JSON_FILE"

log_info "DNS Auto-Update complete!"
exit 0
