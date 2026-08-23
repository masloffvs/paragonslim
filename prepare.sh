#!/bin/bash

set -e

ENV_FILE=".env"

GREEN='\033[0;32m'
NC='\033[0m' 

echo "Checking environment configuration..."
mkdir -p datasets 
mkdir -p env

touch "$ENV_FILE"

ensure_env_var() {
    local var_name="$1"
    local var_value="$2"

    if grep -q "^${var_name}=" "$ENV_FILE"; then
        printf "   %s\n" "$var_name=**************"
    else
        echo "${var_name}=${var_value}" >> "$ENV_FILE"
        printf " ${GREEN}+${NC} %s %s\n" "$var_name" "$var_value"
    fi
}

download_dataset() {
    local dataset_url="$1"
    local output_dir="datasets/fine"
    local filename="$(basename "$dataset_url")"
    
    mkdir -p "$output_dir"
    
    if [ -f "$output_dir/$filename" ]; then
        echo "Dataset $filename already exists, skipping download."
    else
        echo "Downloading dataset from $dataset_url..."
        aria2c -d "$output_dir" -o "$filename" "$dataset_url"
        
        if [ $? -eq 0 ]; then
            echo "Dataset downloaded successfully to $output_dir"
        else
            echo "Failed to download dataset"
            exit 1
        fi
    fi
}

ensure_clickhouse_img() {
    local disk_img="mnt/clickhouse.img"
    local mount_point="/mnt/clickhouse_data"

    mkdir -p "$mount_point"

    if [ ! -f "$disk_img" ]; then
        echo "Creating $disk_img (4GB)..."
        truncate -s 4G "$disk_img"
        echo "$disk_img created."
    fi

    if ! blkid "$disk_img" | grep -q "ext4"; then
        echo "Formatting $disk_img with ext4..."
        sudo mkfs.ext4 "$disk_img"
        echo "$disk_img formatted."
    fi

    if ! mountpoint -q "$mount_point"; then
        echo "Mounting $disk_img to $mount_point..."
        sudo mount -o loop "$disk_img" "$mount_point"
        sudo chown -R $(id -u):$(id -g) "$mount_point"
        echo "Mounted."
    else
        echo "$mount_point already mounted."
    fi
}

ensure_clickhouse_img   

ensure_env_var "CLICKHOUSE_USER" "admin_$(openssl rand -hex 8)"
ensure_env_var "CLICKHOUSE_PASSWORD" "$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)"
ensure_env_var "GENERATED_AT" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
ensure_env_var "SESSION_TOKEN_32" "$(openssl rand -hex 16)"
ensure_env_var "SESSION_TOKEN_64" "$(openssl rand -hex 32)"
ensure_env_var "CLICKLENS_USER" "clicklens_$(openssl rand -hex 4)"
ensure_env_var "CLICKLENS_PASSWORD" "$(openssl rand -base64 12 | tr -d "=+/" | cut -c1-24)"

download_dataset "https://www.kaggle.com/api/v1/datasets/download/rai220/russian-cyrillic-names-and-sex"