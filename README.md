# Snap Saver (Web PWA)

Save your Snapchat memories before they're deleted! This local-first web app analyzes your official Snapchat data export ZIPs and identifies which memories are "at risk" under Snapchat's 5 GiB free storage limit.

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** (for the web app)
- **Python 3.11+** (optional, for dev helpers)

### Option 1: Full Setup (Recommended)
```bash
# 1. Set up Python virtual environment (optional)
bash scripts/setup_venv.sh

# 2. Start the web development server
bash scripts/dev_web.sh
```

**Note**: Run these commands from the project root directory (`/Users/sharath/Downloads/Snap`)

### Option 2: Manual Setup
```bash
# 1. Install web dependencies
cd web
npm install

# 2. Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

## ✨ Features

- **🔒 Local-First Processing**: Everything happens in your browser - no data is uploaded
- **⚠️ Risk Analysis**: Identifies which memories are at-risk of deletion (newest content beyond 5 GiB)
- **🎯 Smart Backup**: Choose to save at-risk memories only or all memories
- **📊 Real-time Progress**: Live progress tracking with detailed statistics
- **🔄 Idempotent Operations**: SHA-256 hashing prevents duplicate copies
- **📅 Organized Output**: Date-based folder structure (`YYYY/YYYY-MM/YYYY-MM-DD/`)
- **🌐 PWA Support**: Install as a native app on mobile devices
- **💾 Multiple Export Options**: File System Access API or downloadable ZIP

## 🎯 How It Works

1. **📤 Export Your Data**: Use Snapchat's official data export feature to download your memories as ZIP files
2. **📁 Drop & Scan**: Drag your ZIP files into the app to analyze your memories
3. **📊 Review Risk**: See which memories are safe vs. at-risk based on Snapchat's 5 GiB limit
4. **⚙️ Choose Backup**: Select whether to save at-risk memories only or all memories
5. **💾 Backup**: Choose destination (folder or ZIP download) and start the backup process

## 🛠️ Technical Details

### Architecture
- **Frontend**: React + TypeScript + Tailwind CSS
- **Workers**: Web Workers for unzip, hashing, and export operations
- **Storage**: IndexedDB for hash cache and manifest persistence
- **APIs**: File System Access API, Web Crypto, Wake Lock API

### Browser Support
- **Chrome/Edge**: Full support including File System Access API
- **Firefox/Safari**: Download ZIP mode only
- **Mobile**: PWA support with download ZIP mode

### Data Flow
1. **Scan**: Parse ZIP files → Extract memory metadata → Return scan results
2. **Analyze**: Sort by date → Calculate 5 GiB cutoff → Identify at-risk items
3. **Export**: Stream extract → Compute SHA-256 → Save to organized folders
4. **Track**: Update progress → Maintain manifest → Handle errors gracefully

## 📁 Project Structure

```
snap-saver/
├── web/                    # React PWA application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── workers/        # Web Workers (unzip, hash, export)
│   │   ├── lib/           # Utilities and types
│   │   └── styles/        # Tailwind CSS
│   ├── package.json
│   └── vite.config.ts
├── scripts/               # Development scripts
│   ├── setup_venv.sh     # Python venv setup
│   ├── dev_web.sh        # Start dev server
│   └── build_web.sh      # Build for production
├── legacy_desktop/        # Original Rust desktop app
├── requirements.txt       # Python dependencies
└── README.md
```

## 🔧 Development

### Web App Development
```bash
# Start development server
bash scripts/dev_web.sh

# Build for production
bash scripts/build_web.sh

# Type checking
cd web && npm run typecheck
```

### Python Dev Helpers
```bash
# Set up virtual environment
bash scripts/setup_venv.sh

# Activate venv manually
source .venv/bin/activate
```

## 📱 PWA Features

- **Offline Support**: App shell cached for offline use
- **Install Prompt**: Can be installed as native app
- **Wake Lock**: Keeps screen on during long operations
- **Responsive Design**: Works on desktop and mobile

## 🔒 Privacy & Security

- **No Network Access**: The app never connects to the internet
- **Local Processing**: All analysis happens in your browser
- **No Data Collection**: We don't collect or store any of your data
- **Open Source**: Full source code is available for review

## 🚨 Limitations

### File System Access API
- **Chrome/Edge**: Full folder access support
- **Firefox/Safari**: Download ZIP mode only
- **Mobile**: Limited to download ZIP mode

### Browser Storage
- **IndexedDB**: Used for hash cache and manifests
- **Memory**: Large ZIP files processed with streaming
- **Disk**: Temporary files cleaned up automatically

## 🐛 Troubleshooting

### Common Issues

**"Failed to scan ZIP files"**
- Ensure you're using official Snapchat export ZIPs
- Check that ZIP files aren't corrupted
- Try with a smaller ZIP file first

**"No memories found"**
- Snapchat export format may have changed
- Check that your ZIP contains JSON index files
- Contact support with your export structure

**"Export failed"**
- Ensure you have sufficient disk space
- Try a different destination folder
- Check browser console for error details

### Browser Recommendations
- **Desktop**: Chrome or Edge for best performance
- **Mobile**: Any modern browser (download ZIP mode)
- **Large Files**: Desktop recommended for multi-GB exports

## 🤝 Contributing

We welcome contributions! Please see our development guide for details on:
- Setting up the development environment
- Code style and standards
- Testing procedures
- Submitting pull requests

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This app is not affiliated with Snapchat. It processes data you've already exported from Snapchat using their official tools. Always respect Snapchat's Terms of Service and only use data you have the right to access.

---

**Ready to save your memories?** Run `bash scripts/dev_web.sh` and start the app!