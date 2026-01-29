#!/bin/bash

# Prayer Times - Package Script for GNOME Extensions submission
# Creates a zip file suitable for uploading to extensions.gnome.org

set -e

EXTENSION_UUID="prayertimestr@emre.dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_FILE="${SCRIPT_DIR}/${EXTENSION_UUID}.zip"

echo "🕌 Prayer Times - Packaging for GNOME Extensions"
echo "================================================="
echo ""

# Remove existing zip if present
if [ -f "$OUTPUT_FILE" ]; then
    echo "Removing existing package..."
    rm "$OUTPUT_FILE"
fi

# Create the zip file with required files only
echo "Creating package..."
cd "$SCRIPT_DIR"

zip -r "$OUTPUT_FILE" \
    metadata.json \
    extension.js \
    prefs.js \
    stylesheet.css \
    schemas/org.gnome.shell.extensions.prayertimestr.gschema.xml

echo ""
echo "✅ Package created: $OUTPUT_FILE"
echo ""
echo "Package contents:"
unzip -l "$OUTPUT_FILE"
echo ""
echo "Next steps:"
echo "1. Go to https://extensions.gnome.org/"
echo "2. Log in or create an account"
echo "3. Navigate to 'Upload Extension'"
echo "4. Upload the file: $OUTPUT_FILE"
