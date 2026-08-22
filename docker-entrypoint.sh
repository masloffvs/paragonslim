#!/bin/sh
if [ "$HYPERVISOR" = "docker" ] && [ -d "/mnt" ]; then
    echo "[disks]" > /app/volumes.toml
    for dir in /mnt/*/; do
        if [ -d "$dir" ]; then
            name=$(basename "$dir")
            echo "$name = \"$dir\"" >> /app/volumes.toml
        fi
    done
fi
exec "$@"
