#!/bin/bash

# Prayer Times - Installation Script
# Compatible with GNOME 45+

set -e

EXTENSION_UUID="prayertimestr@emre.dev"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🕌 Prayer Times - GNOME Shell Extension Installer"
echo "=================================================="
echo ""

# Check if gnome-shell is available
if ! command -v gnome-shell &> /dev/null; then
    echo "❌ Error: gnome-shell not found. Is GNOME Shell installed?"
    exit 1
fi

# Get GNOME Shell version
GNOME_VERSION=$(gnome-shell --version | grep -oP '\d+' | head -1)
echo "📌 Detected GNOME Shell version: $GNOME_VERSION"

if [ "$GNOME_VERSION" -lt 45 ]; then
    echo "⚠️  Warning: This extension is designed for GNOME 45+. You have version $GNOME_VERSION."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Compile GSettings schema
echo ""
echo "📦 Compiling GSettings schema..."
if [ -d "$SCRIPT_DIR/schemas" ]; then
    glib-compile-schemas "$SCRIPT_DIR/schemas/"
    echo "✓ Schema compiled successfully"
else
    echo "❌ Error: schemas directory not found"
    exit 1
fi

# Create extension directory
echo ""
echo "📁 Creating extension directory..."
mkdir -p "$EXTENSION_DIR"

# Copy files
echo "📋 Copying extension files..."
cp "$SCRIPT_DIR/metadata.json" "$EXTENSION_DIR/"
cp "$SCRIPT_DIR/extension.js" "$EXTENSION_DIR/"
cp "$SCRIPT_DIR/prefs.js" "$EXTENSION_DIR/"
cp "$SCRIPT_DIR/stylesheet.css" "$EXTENSION_DIR/"
cp -r "$SCRIPT_DIR/schemas" "$EXTENSION_DIR/"

echo "✓ Files copied to: $EXTENSION_DIR"

# Enable the extension
echo ""
echo "🔧 Enabling extension..."
if command -v gnome-extensions &> /dev/null; then
    gnome-extensions enable "$EXTENSION_UUID" 2>/dev/null || true
    echo "✓ Extension enabled (may require shell restart)"
fi

echo ""
echo "=================================================="
echo "✅ Installation complete!"
echo ""
echo "To activate the extension:"
echo "  1. Press Alt+F2, type 'r', and press Enter (X11 only)"
echo "  OR"
echo "  2. Log out and log back in"
echo "  OR"
echo "  3. Run: busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'Meta.restart(\"Restarting...\")'"
echo ""
echo "To configure settings:"
echo "  gnome-extensions prefs $EXTENSION_UUID"
echo ""
echo "To uninstall:"
echo "  rm -rf \"$EXTENSION_DIR\""
echo ""
