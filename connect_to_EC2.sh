#!/usr/bin/env bash
# =============================================================================
# EC2 SSH Connection Script
# Quick connect to Payroll NodeJS EC2 Server (Frankfurt)
# =============================================================================

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
EC2_KEY="$HOME/Utilities/AWS-EC2-S3/pair-key-pem/Payroll_NodeJS_Server_Frankfurt.pem"
EC2_USER_HOST="ubuntu@63.178.15.216"
EC2_HOST="63.178.15.216"

# =============================================================================
# MAIN
# =============================================================================

echo ""
echo -e "${BLUE}=========================================="
echo "🚀 Connecting to EC2 Server"
echo "==========================================${NC}"
echo -e "${GREEN}Server: ${NC}   $EC2_HOST"
echo -e "${GREEN}User:${NC}     ubuntu"
echo -e "${GREEN}Key:${NC}      $EC2_KEY"
echo ""

# Check if key exists
if [[ ! -f "$EC2_KEY" ]]; then
    echo -e "${YELLOW}❌ EC2 key not found:  $EC2_KEY${NC}"
    exit 1
fi

# Check key permissions
KEY_PERMS=$(stat -c "%a" "$EC2_KEY" 2>/dev/null)
if [[ "$KEY_PERMS" != "600" ]] && [[ "$KEY_PERMS" != "400" ]]; then
    echo -e "${YELLOW}⚠️  Fixing key permissions...${NC}"
    chmod 600 "$EC2_KEY"
    echo -e "${GREEN}✅ Key permissions set to 600${NC}"
    echo ""
fi

echo -e "${BLUE}Connecting... ${NC}"
echo ""

# Connect to EC2
ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER_HOST"

echo ""
echo -e "${GREEN}✅ Connection closed${NC}"
echo ""
