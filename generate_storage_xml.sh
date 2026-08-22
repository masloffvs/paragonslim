#!/usr/bin/env python3
import os
import sys

VOLUMES_TOML = "/mnt/volumes.toml"
STORAGE_XML = "/mnt/config.d/storage.xml"

print(f"GenerateStorage: Checking for volumes.toml at {VOLUMES_TOML}")

if not os.path.exists(VOLUMES_TOML):
    print("GenerateStorage: volumes.toml not found, using default configuration")
    default_xml = """<yandex>
    <storage_configuration>
        <disks>
            <default_disk>
                <path>/var/lib/clickhouse/</path>
            </default_disk>
        </disks>
        <policies>
            <default_policy>
                <volumes>
                    <main>
                        <disk>default_disk</disk>
                    </main>
                </volumes>
            </default_policy>
        </policies>
    </storage_configuration>
</yandex>"""
    
    os.makedirs(os.path.dirname(STORAGE_XML), exist_ok=True)
    with open(STORAGE_XML, 'w') as f:
        f.write(default_xml)
    print("GenerateStorage: Default storage.xml created")
    sys.exit(0)

print(f"GenerateStorage: Found volumes.toml:")
with open(VOLUMES_TOML, 'r') as f:
    content = f.read()
    print(content)

# Parse simple TOML format: [disks] then name = "/path"
disks = {}
current_section = None

with open(VOLUMES_TOML, 'r') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        
        if line.startswith('[') and line.endswith(']'):
            current_section = line[1:-1]
            continue
        
        if '=' in line and current_section == 'disks':
            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip().strip('"')
            disks[key] = value

print(f"GenerateStorage: Parsed disks: {disks}")

# Generate XML
xml_lines = [
    "<yandex>",
    "    <storage_configuration>",
    "        <disks>"
]

# Add standard default disk only if no custom disks named 'default_disk'
if 'default_disk' not in disks:
    xml_lines.extend([
        "            <default_disk>",
        "                <path>/var/lib/clickhouse/</path>",
        "            </default_disk>"
    ])

for disk_name, disk_path in disks.items():
    print(f"GenerateStorage: Adding disk {disk_name} = {disk_path}")
    xml_lines.extend([
        f"            <{disk_name}>",
        f"                <path>{disk_path}</path>",
        f"            </{disk_name}>"
    ])

xml_lines.append("        </disks>")
xml_lines.append("        <policies>")

if disks:
    xml_lines.extend([
        "            <jbod_policy>",
        "                <volumes>",
        "                    <main>"
    ])
    
    # Add custom disks to policy
    for disk_name in disks.keys():
        xml_lines.append(f"                        <disk>{disk_name}</disk>")
    
    # Add default disk if not already in custom disks
    if 'default_disk' not in disks:
        xml_lines.append("                        <disk>default_disk</disk>")
    
    xml_lines.extend([
        "                    </main>",
        "                </volumes>",
        "            </jbod_policy>"
    ])
else:
    xml_lines.extend([
        "            <default_policy>",
        "                <volumes>",
        "                    <main>",
        "                        <disk>default_disk</disk>",
        "                    </main>",
        "                </volumes>",
        "            </default_policy>"
    ])

xml_lines.extend([
    "        </policies>",
    "    </storage_configuration>",
    "</yandex>"
])

xml_content = "\n".join(xml_lines)

os.makedirs(os.path.dirname(STORAGE_XML), exist_ok=True)
with open(STORAGE_XML, 'w') as f:
    f.write(xml_content)

print("GenerateStorage: Generated storage.xml:")
print(xml_content)
