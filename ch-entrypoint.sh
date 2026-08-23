#!/bin/bash
set -e

echo '<Debug> Grep me! I am here!'

cp /etc/clickhouse-server/config.d.tmp/* /etc/clickhouse-server/config.d/ 2>/dev/null || true

OUTPUT_FILE="/etc/clickhouse-server/config.d/storage.xml"

extra_disks=()
for dir in /mnt/*/; do
    [ -d "$dir" ] || continue
    extra_disks+=("$(basename "$dir")")
done

{
  echo '<clickhouse>'
  echo '    <storage_configuration>'
  echo '        <default>'
  echo '            <keep_free_space_bytes>2147483648</keep_free_space_bytes>'
  echo '        </default>'
  echo '        <disks>'

  for disk_name in "${extra_disks[@]}"; do
    echo "            <${disk_name}>"
    echo '                <type>local</type>'
    echo "                <path>/mnt/${disk_name}/</path>"
    echo "            </${disk_name}>"
  done

  echo '        </disks>'
  echo '        <policies>'
  echo '            <hot>'
  echo '                <volumes>'
  echo '                    <default>'
  # echo '                        <disk>default</disk>' 

  for disk_name in "${extra_disks[@]}"; do
    echo "                        <disk>${disk_name}</disk>"
  done

  echo '                        <load_balancing>round_robin</load_balancing>'
  echo '                    </default>'
  echo '                </volumes>'
  echo '            </hot>'
  echo '        </policies>'
  echo '    </storage_configuration>'
  echo '</clickhouse>'
} > "$OUTPUT_FILE"

echo "<Debug> Generated storage config:"
cat "$OUTPUT_FILE"

: "${CLICKLENS_USER:?CLICKLENS_USER must be set}"
: "${CLICKLENS_PASSWORD:?CLICKLENS_PASSWORD must be set}"

USERS_OUTPUT_FILE="/etc/clickhouse-server/users.d/clicklens.xml"
PASS_SHA256=$(printf '%s' "$CLICKLENS_PASSWORD" | sha256sum | awk '{print $1}')

{
  echo '<clickhouse>'
  echo '    <roles>'
  echo '        <clicklens_role>'
  echo '            <grants>'
  echo '                <query>GRANT SELECT ON system.*</query>'
  echo '                <query>GRANT SHOW DATABASES ON *.*</query>'
  echo '                <query>GRANT SHOW TABLES ON *.*</query>'
  echo '                <query>GRANT SHOW COLUMNS ON *.*</query>'
  echo '                <query>GRANT SELECT ON *.*</query>'
  echo '            </grants>'
  echo '        </clicklens_role>'
  echo '    </roles>'
  echo '    <users>'
  echo "        <${CLICKLENS_USER}>"
  echo "            <password_sha256_hex>${PASS_SHA256}</password_sha256_hex>"
  echo '            <networks>'
  echo '                <ip>::/0</ip>'
  echo '            </networks>'
  echo '            <profile>default</profile>'
  echo '            <quota>default</quota>'
  echo '            <access_management>0</access_management>'
  echo '            <named_collection_control>0</named_collection_control>'
  echo '            <show_named_collections>0</show_named_collections>'
  echo '            <grantees_list>'
  echo '                <role>clicklens_role</role>'
  echo '            </grantees_list>'
  echo "        </${CLICKLENS_USER}>"
  echo '    </users>'
  echo '</clickhouse>'
} > "$USERS_OUTPUT_FILE"

echo "<Debug> Generated users config (password hash redacted from log):"
sed "s/${PASS_SHA256}/<redacted>/" "$USERS_OUTPUT_FILE"