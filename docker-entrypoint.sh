#!/bin/sh
if [ "$HYPERVISOR" = "docker" ] && [ -d "/mnt" ]; then
    echo "[disks]" > /app/volumes.toml
    for dir in /mnt/*/; do
        if [ -d "$dir" ]; then
            name=$(basename "$dir")
            echo "$name = \"$dir\"" >> /app/volumes.toml
        fi
    done
    echo "DockerEntrypoint: Generated volumes.toml"
    cat /app/volumes.toml
    
    # Generate storage.xml from volumes.toml
    if [ -f "/app/generate_storage_xml.sh" ]; then
        python3 /app/generate_storage_xml.sh
        echo "DockerEntrypoint: Generated storage.xml"
    fi
fi
exec "$@"
