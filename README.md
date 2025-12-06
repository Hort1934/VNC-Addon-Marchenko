# VNC-Addon for Node.js

High-performance native Node.js VNC server addon with DXGI screen capture and noVNC support.

## Overview

This project provides a native Node.js addon that implements a complete VNC server with the following key features:

- **High-Performance Screen Capture**: Uses Windows Desktop Duplication API (DXGI) for efficient GPU-based screen capture
- **Dirty Rectangle Detection**: Only transmits changed screen regions to minimize bandwidth and CPU usage
- **WebSocket Support**: Native support for noVNC clients with WebSocket protocol
- **Virtual Desktop Mode**: Optional isolated virtual desktop for concurrent user sessions
- **Dynamic Quality Control**: Real-time adjustment of compression and quality settings
- **Resource Management**: Automatic start/stop of screen capture based on client connections

## System Requirements

- **Operating System**: Windows 10 x64, Windows 11 x64
- **Node.js**: Version 20.x or newer
- **Development Tools**: 
  - Visual Studio Build Tools 2019 or newer (for C++ compilation)
  - Python 3.7+ (for node-gyp)
- **Runtime Requirements**:
  - DirectX 11 compatible graphics card
  - Desktop session (not Windows service mode for screen capture)

## Installation

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install development dependencies globally (if needed)
npm install -g node-gyp
```

### 2. Build the Project

```bash
# Clean previous builds
npm run clean

# Build native addon and TypeScript
npm run build
```

The build process will:
1. Compile the C++ native addon using node-gyp
2. Compile TypeScript source to JavaScript
3. Generate type definitions (.d.ts files)

## Quick Start

### Basic Usage

```typescript
import { VncServer } from 'vnc-addon-marchenko';

const server = new VncServer({
  port: 5902,
  password: 'mysecretpassword'
});

// Set up event handlers
server.on('client-connected', (client) => {
  console.log(`Client connected: ${client.id} from ${client.address}`);
});

server.on('error', (error) => {
  console.error('VNC Server Error:', error.message);
});

// Start the server
async function startServer() {
  try {
    await server.start();
    console.log('VNC Server is running on port 5902');
  } catch (error) {
    console.error('Failed to start server:', error);
  }
}

startServer();
```

### Virtual Desktop Mode

```typescript
const server = new VncServer({
  port: 5902,
  virtualDesktop: true,
  width: 1920,
  height: 1080
});
```

### Running the Example

```bash
# Basic example
node dist/example.js

# With custom settings
node dist/example.js --port 5903 --password mypass

# Virtual desktop mode
node dist/example.js --virtual-desktop --width 1280 --height 720

# Show all options
node dist/example.js --help
```

## API Documentation

### VncServer Class

The main class that manages the VNC server instance.

#### Constructor

```typescript
new VncServer(options: VncServerOptions)
```

#### Methods

##### `start(): Promise<void>`
Starts the VNC server and begins listening for connections.

##### `stop(): Promise<void>`
Stops the server and disconnects all clients.

##### `setQuality(options: QualityOptions): void`
Dynamically adjusts quality settings.

```typescript
server.setQuality({
  jpegQuality: 80,     // 0-100, higher = better quality
  zlibLevel: 6,        // 0-9, higher = better compression
  colorDepth: 32       // 8, 16, 24, or 32 bits per pixel
});
```

##### `getActiveClientsCount(): number`
Returns the number of connected clients.

##### `getServerStatus(): ServerStatus`
Returns comprehensive server status information.

##### `getScreenInfo(): ScreenInfo`
Returns information about the captured screen.

#### Events

##### `'client-connected'`
Emitted when a client connects.
```typescript
server.on('client-connected', (client: ClientInfo) => {
  // Handle new client
});
```

##### `'client-disconnected'`
Emitted when a client disconnects.
```typescript
server.on('client-disconnected', (client: ClientInfo) => {
  // Handle client disconnect
});
```

##### `'error'`
Emitted when an error occurs.
```typescript
server.on('error', (error: VncError) => {
  // Handle error
});
```

##### `'capture-started'`
Emitted when screen capture starts (first client connects).

##### `'capture-stopped'`
Emitted when screen capture stops (last client disconnects).

### Configuration Options

#### VncServerOptions

```typescript
interface VncServerOptions {
  port: number;                    // WebSocket port for noVNC clients
  password?: string;               // Optional VNC password
  virtualDesktop?: boolean;        // Enable virtual desktop mode
  width?: number;                  // Virtual desktop width (default: 1920)
  height?: number;                 // Virtual desktop height (default: 1080)
  maxClients?: number;             // Maximum concurrent clients (default: 10)
  maxFps?: number;                 // Frame rate limit (default: 30)
  compression?: boolean;           // Enable compression (default: true)
}
```

#### QualityOptions

```typescript
interface QualityOptions {
  jpegQuality?: number;   // JPEG quality 0-100 (default: 80)
  zlibLevel?: number;     // Zlib compression 0-9 (default: 6)
  colorDepth?: number;    // Color depth: 8, 16, 24, 32 (default: 32)
}
```

## Client Connection

### noVNC (Web Browser)

1. Go to https://novnc.com/noVNC/vnc.html
2. Enter connection details:
   - **Host**: `localhost` or server IP address
   - **Port**: The port specified in your server configuration
   - **Password**: The password if set
3. Click "Connect"

### Desktop VNC Clients

Compatible with standard VNC clients:
- TightVNC Viewer
- RealVNC Viewer  
- TigerVNC
- UltraVNC

Connection URL format: `vnc://localhost:5902`

## Architecture

### Components

1. **Native Addon (C++)**
   - DXGI screen capture
   - WebSocket server
   - VNC protocol implementation
   - Virtual desktop management

2. **TypeScript Wrapper**
   - Event-driven API
   - Error handling
   - Type safety

3. **Screen Capturer**
   - Uses Windows Desktop Duplication API
   - Dirty rectangle detection
   - GPU-accelerated capture

4. **WebSocket Server**
   - noVNC compatibility
   - Binary frame transmission
   - Client connection management

### Performance Optimizations

- **Dirty Rectangle Detection**: Only changed screen regions are transmitted
- **Automatic Resource Management**: Screen capture starts/stops based on client connections
- **Multi-threaded**: Capture and networking run in separate threads
- **Quality Adaptation**: Dynamic quality adjustment based on client count and network conditions

## Advanced Features

### Virtual Desktop Mode

Creates an isolated desktop environment:

```typescript
const server = new VncServer({
  port: 5902,
  virtualDesktop: true,
  width: 1920,
  height: 1080
});
```

**Benefits:**
- VNC clients don't interfere with the physical user
- Independent desktop environment
- Enhanced security and isolation

**Requirements:**
- Must run with administrator privileges
- Only available on Windows 10/11

### Quality Management

Dynamically adjust quality based on conditions:

```typescript
// Reduce quality for multiple clients
if (server.getActiveClientsCount() > 2) {
  server.setQuality({
    jpegQuality: 60,
    zlibLevel: 8
  });
}

// High quality for single client
if (server.getActiveClientsCount() === 1) {
  server.setQuality({
    jpegQuality: 90,
    zlibLevel: 6
  });
}
```

### Monitoring and Statistics

```typescript
const status = server.getServerStatus();
console.log(`FPS: ${status.captureStats?.fps}`);
console.log(`Dirty Regions: ${status.captureStats?.dirtyRegions}`);
console.log(`CPU Usage: ${status.captureStats?.cpuUsage}%`);
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```
Error: Failed to bind socket to port 5902
```
**Solution**: Use a different port or stop the process using the port.

#### DXGI Initialization Failed
```
Error: Failed to create desktop duplication
```
**Solutions**:
- Ensure running in a desktop session (not as a Windows service)
- Verify DirectX 11 support
- Run as administrator for virtual desktop mode

#### Permission Denied (Virtual Desktop)
```
Error: Failed to create virtual desktop
```
**Solution**: Run the application as administrator.

### Performance Issues

#### High CPU Usage
- Reduce frame rate: `maxFps: 15`
- Lower quality: `jpegQuality: 50`
- Increase compression: `zlibLevel: 9`

#### Network Lag
- Enable compression: `compression: true`
- Adjust quality for network speed
- Monitor client count and adjust accordingly

### Debugging

Enable verbose logging:
```typescript
server.on('capture-started', () => console.log('Capture started'));
server.on('capture-stopped', () => console.log('Capture stopped'));
server.on('error', (error) => console.error('Error:', error));
```

## Build System

### Build Scripts

```bash
# Full build (native + TypeScript)
npm run build

# Build only native addon
npm run build:native

# Build only TypeScript
npm run build:ts

# Clean build artifacts
npm run clean
```

### Build Configuration

The project uses:
- **node-gyp** for native addon compilation
- **TypeScript compiler** for TypeScript compilation
- **binding.gyp** for native build configuration

### Dependencies

**Runtime:**
- `node-addon-api`: N-API bindings for Node.js

**Development:**
- `typescript`: TypeScript compiler
- `@types/node`: Node.js type definitions
- `node-gyp`: Native addon build tool

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Build and test
5. Submit a pull request

### Development Setup

```bash
git clone https://github.com/Hort1934/VNC-Addon-Marchenko.git
cd VNC-Addon-Marchenko
npm install
npm run build
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Author

**Ihor Marchenko**

## Acknowledgments

- Windows Desktop Duplication API documentation
- noVNC project for WebSocket VNC protocol reference
- Node-API community for native addon development patterns
VNC-Addon-Marchenko-UA-SKILLS
