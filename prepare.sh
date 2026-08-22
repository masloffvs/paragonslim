#!/bin/bash

set -e

ENV_FILE=".env"

echo "Checking environment configuration..."

if [ -f "$ENV_FILE" ]; then
    echo "✓ .env file already exists, skipping generation"
    echo "Current variables:"
    cat "$ENV_FILE"
else
    echo "✓ Creating .env file with secure credentials"
    
    # Generate secure random credentials
    CLICKHOUSE_USER="admin_$(openssl rand -hex 8)"
    CLICKHOUSE_PASSWORD="$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)"
    GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    
    cat > "$ENV_FILE" <<EOF
CLICKHOUSE_USER=$CLICKHOUSE_USER
CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD
GENERATED_AT=$GENERATED_AT
EOF
    
    echo "✓ Generated secure credentials:"
    echo "  CLICKHOUSE_USER=$CLICKHOUSE_USER"
    echo "  CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD"
    echo "✓ Saved to $ENV_FILE"
fi

echo "✓ Environment preparation complete"
