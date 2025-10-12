#!/bin/bash

echo "🚀 Setting up Snap Saver..."

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed. Please install Rust first:"
    echo "   Visit: https://rustup.rs/"
    echo "   Run: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first:"
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if Tauri CLI is installed
if ! command -v tauri &> /dev/null; then
    echo "📦 Installing Tauri CLI..."
    npm install -g @tauri-apps/cli
fi

echo "🎉 Setup complete!"
echo ""
echo "To run the app in development mode:"
echo "  npm run tauri dev"
echo ""
echo "To build the app for production:"
echo "  npm run tauri build"
echo ""
echo "The built app will be in src-tauri/target/release/bundle/"
