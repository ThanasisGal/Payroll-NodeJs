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
AWS_REGION="eu-central-1"
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

# Check if AWS CLI is installed
if !  command -v aws &> /dev/null; then
    log_error "AWS CLI is not installed.  Please install it first."
    log_info "Install:  curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip' && unzip awscliv2.zip && sudo ./aws/install"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &>/dev/null; then
    log_error "AWS credentials not configured!"
    log_info "Run: aws configure"
    exit 1
fi

# AWS credentials are automatically loaded from: 
# - ~/.aws/credentials
# - Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
# - EC2 IAM Role (if running on EC2)

# Get Hosted Zone ID
log_info "Fetching Hosted Zone ID..."
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name == '$DOMAIN. ']. Id" \
    --output text \
    --region "$AWS_REGION" 2>/dev/null)

if [[ -z "$HOSTED_ZONE_ID" ]]; then
    log_error "Hosted Zone for $DOMAIN not found."
    exit 1
fi

# Remove /hostedzone/ prefix if present
HOSTED_ZONE_ID="${HOSTED_ZONE_ID#/hostedzone/}"

log_info "Using Hosted Zone ID: $HOSTED_ZONE_ID"

# Get current public IP
log_info "Fetching current public IP..."
NEW_IP=$(curl -s https://checkip.amazonaws.com | tr -d '[:space:]')

if [[ -z "$NEW_IP" ]]; then
    log_error "Failed to fetch public IP"
    exit 1
fi

log_info "Current Public IP: $NEW_IP"

# Get current DNS IP
log_info "Fetching current DNS IP..."
CURRENT_IP=$(aws route53 list-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --query "ResourceRecordSets[?Name == '$DOMAIN.'].ResourceRecords[0].Value" \
    --output text \
    --region "$AWS_REGION" 2>/dev/null)

log_info "Current DNS IP: $CURRENT_IP"

# Check if update is needed
if [[ "$NEW_IP" == "$CURRENT_IP" ]]; then
    log_info "No IP change detected. DNS is up-to-date."
    exit 0
fi

log_warning "New IP detected: $NEW_IP (Old IP: $CURRENT_IP)"
log_info "Updating Route 53..."

# Create JSON change batch
cat > "$JSON_FILE" <<EOF
{
    "Changes": [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name":  "$DOMAIN",
                "Type": "A",
                "TTL": 300,
                "ResourceRecords":  [
                    {
                        "Value": "$NEW_IP"
                    }
                ]
            }
        }
    ]
}
EOF

log_info "JSON change batch created: $JSON_FILE"

# Update Route 53
CHANGE_ID=$(aws route53 change-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --change-batch "file://$JSON_FILE" \
    --query "ChangeInfo.Id" \
    --output text \
    --region "$AWS_REGION" 2>&1)

if [[ $? -eq 0 ]]; then
    log_info "✅ DNS successfully updated to $NEW_IP"
    log_info "Change ID: $CHANGE_ID"
    
    # Wait for change to propagate
    log_info "Waiting for DNS propagation..."
    aws route53 wait resource-record-sets-changed --id "$CHANGE_ID" --region "$AWS_REGION" 2>/dev/null || true
    log_info "✅ DNS change propagated!"
else
    log_error "Failed to update DNS"
    log_error "Error:  $CHANGE_ID"
    exit 1
fi

# Cleanup
rm -f "$JSON_FILE"

log_info "DNS Auto-Update complete!"

exit 0
