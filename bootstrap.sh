#!/bin/sh
set -x
echo "Bootstrap: Preparing disks for ClickHouse..."

# Ensure /mnt directory exists
mkdir -p /mnt

echo "Bootstrap: Available disks in /mnt:"
ls -la /mnt/

echo "Bootstrap: Checking disk permissions and structure:"
if [ -d "/mnt" ]; then
    for dir in /mnt/*/; do
        if [ -d "$dir" ]; then
            echo "Bootstrap: Found disk: $dir"
            ls -ld "$dir"
        fi
    done
else
    echo "Bootstrap: No /mnt directory found"
fi

# Generate volumes.toml and storage.xml
if [ -d "/mnt" ]; then
    echo "[disks]" > /mnt/volumes.toml
    for dir in /mnt/*/; do
        if [ -d "$dir" ]; then
            name=$(basename "$dir")
            # Skip system directories like config.d
            if [ "$name" != "config.d" ] && [ "$name" != "volumes.toml" ]; then
                echo "$name = \"$dir\"" >> /mnt/volumes.toml
            fi
        fi
    done
    echo "Bootstrap: Generated volumes.toml"
    cat /mnt/volumes.toml
    
    # Generate storage.xml using Python script
    if [ -f "/bootstrap/generate_storage_xml.sh" ]; then
        # Run the generator with modified paths
        python3 /bootstrap/generate_storage_xml.sh
        echo "Bootstrap: Generated storage.xml"
        cat /mnt/config.d/storage.xml
    fi
fi

echo "Bootstrap: Initialization complete"
