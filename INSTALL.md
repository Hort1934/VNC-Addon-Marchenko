# Installation Instructions

## Prerequisites

Before building the VNC-Addon, ensure you have the following installed:

### Required Software

1. **Node.js 20.x or newer**
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. **Visual Studio Build Tools 2019 or newer**
   - Download from: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2019
   - **Alternative**: Visual Studio Community with C++ development workload
   - **Required components**:
     - MSVC v142 - VS 2019 C++ x64/x86 build tools
     - Windows 10 SDK (latest version)
     - CMake tools for Visual Studio (optional but recommended)

3. **Python 3.7+**
   - Download from: https://python.org/
   - Add to PATH during installation
   - Verify: `python --version`

### Optional Tools

- **Git** for version control
- **Visual Studio Code** for development

## Installation Steps

### 1. Clone or Extract Project

```bash
# If using Git
git clone https://github.com/Hort1934/VNC-Addon-Marchenko.git
cd VNC-Addon-Marchenko

# Or extract from archive and navigate to folder
cd VNC-Addon-Marchenko
```

### 2. Install Node.js Dependencies

```bash
npm install
```

This installs:
- Runtime dependencies (node-addon-api)
- Development dependencies (TypeScript, node-gyp, etc.)

### 3. Build the Project

```bash
# Clean any previous builds
npm run clean

# Build everything (native addon + TypeScript)
npm run build
```

The build process will:
1. Clean previous build artifacts
2. Compile C++ native addon using node-gyp
3. Compile TypeScript to JavaScript
4. Generate type definitions

### 4. Test Installation

```bash
# Run the example application
npm test

# Or run directly
node dist/example.js
```

If successful, you should see:
```
VNC-Addon Example Application
==============================

Configuration:
  Port: 5902
  Password: None
  Virtual Desktop: false

Starting VNC server...
✓ VNC server started successfully!
✓ Listening for WebSocket connections on port 5902
✓ Physical desktop mode (1920x1080)
```

## Build Troubleshooting

### Common Issues

#### 1. Python Not Found
```
Error: Python executable not found
```

**Solutions:**
- Install Python 3.7+ from python.org
- Ensure Python is in your PATH
- Or specify Python path: `npm config set python C:\Python39\python.exe`

#### 2. Visual Studio Build Tools Missing
```
Error: MSBuild not found
```

**Solutions:**
- Install Visual Studio Build Tools 2019 or newer
- Install Visual Studio Community with C++ workload
- Ensure Windows SDK is installed

#### 3. Node-gyp Rebuild Fails
```
Error: node-gyp rebuild failed
```

**Solutions:**
- Ensure all prerequisites are installed
- Try: `npm install -g node-gyp`
- Clear npm cache: `npm cache clean --force`
- Delete node_modules and reinstall: `rm -rf node_modules && npm install`

#### 4. TypeScript Compilation Errors
```
Error: TypeScript compilation failed
```

**Solutions:**
- Check TypeScript version: `npx tsc --version`
- Ensure TypeScript is installed: `npm install typescript`
- Clean and rebuild: `npm run clean && npm run build`

#### 5. Missing Windows Headers
```
Error: windows.h not found
```

**Solutions:**
- Install Windows SDK through Visual Studio Installer
- Verify Windows SDK path in Visual Studio

### Advanced Build Options

#### Manual Build Steps

```bash
# Build only native addon
npm run build:native
# or
node-gyp rebuild

# Build only TypeScript
npm run build:ts
# or
npx tsc
```

#### Debug Build

```bash
# Build with debug symbols
node-gyp rebuild --debug
```

#### Verbose Output

```bash
# Show detailed build output
npm run build:native -- --verbose
```

## Verification

### 1. Check Build Artifacts

Verify these files exist after building:

```
dist/
├── index.js
├── index.d.ts
├── main.js
├── main.d.ts
├── types.js
├── types.d.ts
└── example.js

build/Release/
└── vnc_addon.node
```

### 2. Test Basic Functionality

```bash
# Should show server start message
node dist/example.js

# Should show help
node dist/example.js --help
```

### 3. Test with noVNC Client

1. Start the server: `node dist/example.js`
2. Open browser to: https://novnc.com/noVNC/vnc.html
3. Connect to: `localhost:5902`
4. Verify connection success

## System-Specific Notes

### Windows 10/11

- Requires DirectX 11 compatible graphics
- Virtual desktop mode requires administrator privileges
- Works best in desktop sessions (not Windows services)

### Windows Server

- Desktop Experience feature may be required
- Graphics drivers must support DirectX 11
- May require additional Visual C++ redistributables

## Performance Optimization

### Build Optimizations

```bash
# Release build (default)
npm run build

# Or explicitly
node-gyp rebuild --release
```

### Runtime Optimizations

- Ensure graphics drivers are up to date
- Close unnecessary applications during capture
- Use SSD storage for better I/O performance
- Consider dedicated graphics card for better DXGI performance

## Next Steps

After successful installation:

1. **Read the documentation**: Review README.md for API usage
2. **Run examples**: Try different configuration options
3. **Test with clients**: Connect with noVNC and desktop VNC clients
4. **Performance tuning**: Adjust quality and FPS settings
5. **Integration**: Integrate into your applications

## Support

If you encounter issues:

1. Check this installation guide
2. Review the troubleshooting section in README.md
3. Ensure all prerequisites are correctly installed
4. Try building on a clean system or VM
5. Check Node.js and npm versions for compatibility