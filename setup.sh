#!/bin/bash
if [ ! -f .env ]; then
    echo "Generating .env..."
    echo "CLICKHOUSE_USER=default" > .env
    echo "CLICKHOUSE_PASSWORD=$(openssl rand -base64 12)" >> .env
    echo ".env generated."
else
    echo ".env already exists."
fi
