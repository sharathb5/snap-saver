#!/bin/bash

echo "🏗️  Building Snap Saver web app for production..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first:"
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

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
fi

# Build the app
echo "🔨 Building production bundle..."
if command -v pnpm &> /dev/null; then
    pnpm build
else
    npm run build
fi

# Check if build was successful
if [ -d "dist" ]; then
    echo "✅ Build successful!"
    echo "📁 Production files are in web/dist/"
    echo ""
    echo "To preview the build:"
    echo "  cd web && npm run preview"
    echo ""
    echo "To deploy:"
    echo "  Upload the contents of web/dist/ to your web server"
else
    echo "❌ Build failed - dist/ directory not found"
    exit 1
fi
