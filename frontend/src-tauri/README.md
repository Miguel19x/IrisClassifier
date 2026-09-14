# IrisClassifier Desktop - Tauri

Desktop application for IrisClassifier built with Tauri.

## Development

```bash
# Run desktop app in development mode
pnpm tauri:dev
```

## Building

### Windows (All Versions)
```bash
# Build for Windows x64
pnpm tauri:build:windows
```

This creates installers in `src-tauri/target/release/bundle/`:
- `.msi` - Windows Installer
- `.exe` - Portable executable

### macOS (Intel + Apple Silicon)
```bash
# Build universal binary for Mac
pnpm tauri:build:mac
```

This creates:
- `.dmg` - macOS disk image
- `.app` - Application bundle

## Features

- **Offline-First**: Full SQLite database locally
- **Native Performance**: Rust backend, native UI
- **Small Size**: ~10MB installer (vs ~150MB for Electron)
- **Auto-Updates**: Built-in update mechanism

## Requirements

- **Windows**: Windows 7 or later
- **macOS**: macOS 10.15 (Catalina) or later
- **Rust**: Required for building (auto-installed by Tauri)
