#!/bin/bash

echo "🐍 Setting up Python virtual environment for Snap Saver dev helpers..."

# Check if Python 3.11+ is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.11+ first:"
    echo "   macOS: brew install python@3.11"
    echo "   Ubuntu: sudo apt install python3.11"
    echo "   Windows: Download from https://python.org"
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
REQUIRED_VERSION="3.11"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Python $REQUIRED_VERSION+ required, found $PYTHON_VERSION"
    echo "   Please upgrade Python to version $REQUIRED_VERSION or higher"
    exit 1
fi

echo "✅ Python $PYTHON_VERSION found"

# Create virtual environment
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .venv
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source .venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "📚 Installing requirements..."
pip install -r requirements.txt

echo ""
echo "🎉 Virtual environment setup complete!"
echo ""
echo "To activate the venv manually:"
echo "  source .venv/bin/activate"
echo ""
echo "Note: The web app itself runs with Node.js; this venv is for dev helpers only."
echo "Run 'bash scripts/dev_web.sh' to start the web development server."
