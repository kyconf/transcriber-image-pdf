#!/bin/bash

echo "🚀 Starting installation script..."

# Ensure the script is running with admin rights if needed
if [[ "$EUID" -ne 0 ]]; then
    echo "⚠️ Warning: You are not running as root. Some installations might require sudo."
fi

# Update package managers
echo "🔄 Updating Homebrew..."
brew update

# Install Homebrew dependencies
echo "🍺 Installing dependencies via Homebrew..."
brew install libtiff poppler cairo jpeg

# Install specific Python version (3.11.9)
echo "🐍 Installing Python 3.11.9..."
brew install python@3.11

# Ensure the correct Python version is being used
PYTHON_PATH=$(brew --prefix python@3.11)/bin/python3.11
if [ -f "$PYTHON_PATH" ]; then
    echo "✅ Python 3.11.9 installed successfully!"
    ln -sf "$PYTHON_PATH" /usr/local/bin/python3
    ln -sf "$PYTHON_PATH" /usr/local/bin/python
else
    echo "❌ Failed to install Python 3.11.9!"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "⚠️ Node.js is not installed! Installing..."
    brew install node
else
    echo "✅ Node.js is already installed: $(node -v)"
fi

# Install Node.js dependencies
echo "📦 Installing npm packages..."
npm install

# Install Python dependencies
if [ -f "requirements.txt" ]; then
    echo "🐍 Installing Python packages from requirements.txt..."
    $PYTHON_PATH -m pip install -r requirements.txt
else
    echo "⚠️ requirements.txt not found. Skipping Python package installation."
fi


echo "✅ Installation complete!"
