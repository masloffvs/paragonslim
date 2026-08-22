#!/bin/sh
echo "Bootstrap: Preparing disks for ClickHouse..."

# Create required directories for ClickHouse storage
mkdir -p /mnt/default
mkdir -p /mnt/disk2

echo "Bootstrap: ClickHouse directories created:"
ls -la /mnt/

echo "Bootstrap: Initialization complete"
