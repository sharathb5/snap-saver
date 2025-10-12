#!/bin/bash

echo "🚀 Starting Snap Saver web development server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first:"
    echo "   Visit: https://nodejs.org/"
    echo "   Recommended: Node.js 18+ (LTS)"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
echo "✅ Node.js $NODE_VERSION found"

# Navigate to web directory
cd ../web

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found in web/ directory"
    echo "   Make sure you're running this from the project root"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Check if pnpm is available (preferred)
if command -v pnpm &> /dev/null; then
    echo "🚀 Starting development server with pnpm..."
    pnpm dev
else
    echo "🚀 Starting development server with npm..."
    npm run dev
fi
