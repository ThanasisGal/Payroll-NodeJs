# 🌐 DNS Update Scripts

## Scripts

### `dns-update-ubuntu.sh` (Default - EC2 Safe)
- **Purpose:** Ensure DNS always points to EC2 server
- **IP:** Hardcoded `63.178.15.216` (EC2 Public IP)
- **Usage:** Runs automatically during deployment
- **Safe:** Yes - can run from anywhere

```bash
./dns-update-ubuntu.sh
