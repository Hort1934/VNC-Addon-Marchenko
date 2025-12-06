/**
 * Mock VNC-Addon Example (works without native build)
 * This demonstrates the API structure and TypeScript functionality
 */

import { MockVncServer } from './src/mock';

async function main() {
  console.log('🎭 VNC-Addon Mock Test Application');
  console.log('=====================================\n');
  console.log('⚠️  This is a MOCK implementation for testing the TypeScript API');
  console.log('   To use the real VNC server, install Visual Studio Build Tools first.\n');

  // Parse command line arguments (same as real example)
  const args = process.argv.slice(2);
  const port = args.includes('--port') ? parseInt(args[args.indexOf('--port') + 1]) : 5902;
  const password = args.includes('--password') ? args[args.indexOf('--password') + 1] : '';
  const virtualDesktop = args.includes('--virtual-desktop');
  const width = args.includes('--width') ? parseInt(args[args.indexOf('--width') + 1]) : 1920;
  const height = args.includes('--height') ? parseInt(args[args.indexOf('--height') + 1]) : 1080;

  console.log('Configuration:');
  console.log(`  Port: ${port}`);
  console.log(`  Password: ${password ? '***' : 'None'}`);
  console.log(`  Virtual Desktop: ${virtualDesktop}`);
  if (virtualDesktop) {
    console.log(`  Resolution: ${width}x${height}`);
  }
  console.log();

  // Create Mock VNC server instance
  const server = new MockVncServer({
    port: port,
    password: password,
    virtualDesktop: virtualDesktop,
    width: width,
    height: height,
    maxClients: 5,
    maxFps: 30,
    compression: true
  });

  // Set up event handlers (identical to real implementation)
  server.on('client-connected', (client) => {
    console.log(`[${new Date().toISOString()}] Client connected:`);
    console.log(`  ID: ${client.id}`);
    console.log(`  Address: ${client.address}`);
    console.log(`  WebSocket: ${client.isWebSocket ? 'Yes' : 'No'}`);
    console.log(`  Total clients: ${server.getActiveClientsCount()}`);
    console.log();

    // Adjust quality for multiple clients
    const clientCount = server.getActiveClientsCount();
    if (clientCount > 1) {
      console.log(`Adjusting quality for ${clientCount} clients...`);
      server.setQuality({
        jpegQuality: Math.max(50, 90 - clientCount * 10),
        zlibLevel: Math.min(9, 6 + clientCount)
      });
    }
  });

  server.on('client-disconnected', (client) => {
    console.log(`[${new Date().toISOString()}] Client disconnected:`);
    console.log(`  ID: ${client.id}`);
    console.log(`  Address: ${client.address}`);
    console.log(`  Total clients: ${server.getActiveClientsCount()}`);
    console.log();
  });

  server.on('capture-started', () => {
    console.log(`[${new Date().toISOString()}] 📹 Screen capture started (MOCK)`);
    
    // Status updates
    const statusInterval = setInterval(() => {
      if (server.getActiveClientsCount() > 0) {
        const status = server.getServerStatus();
        console.log(`[${new Date().toISOString()}] Status Update:`);
        console.log(`  Clients: ${status.clientCount}`);
        console.log(`  Capture Active: ${status.isCaptureActive}`);
        
        if (status.captureStats) {
          console.log(`  FPS: ${status.captureStats.fps.toFixed(1)} (MOCK)`);
          console.log(`  Dirty Regions: ${status.captureStats.dirtyRegions} (MOCK)`);
          console.log(`  CPU Usage: ${status.captureStats.cpuUsage.toFixed(1)}% (MOCK)`);
        }
        console.log();
      } else {
        clearInterval(statusInterval);
      }
    }, 3000);
  });

  server.on('capture-stopped', () => {
    console.log(`[${new Date().toISOString()}] 🛑 Screen capture stopped - no active clients (MOCK)`);
    console.log();
  });

  server.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] VNC Server Error:`);
    console.error(`  Type: ${error.type}`);
    console.error(`  Message: ${error.message}`);
    console.error();
  });

  server.on('quality-changed', (quality) => {
    console.log(`[${new Date().toISOString()}] Quality settings updated:`);
    console.log(`  JPEG Quality: ${quality.jpegQuality || 'unchanged'}`);
    console.log(`  Zlib Level: ${quality.zlibLevel || 'unchanged'}`);
    console.log(`  Color Depth: ${quality.colorDepth || 'unchanged'}`);
    console.log();
  });

  // Graceful shutdown
  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n[${new Date().toISOString()}] Received ${signal}, shutting down...`);
    
    try {
      await server.stop();
      console.log('🎭 Mock VNC server stopped successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  try {
    console.log('🚀 Starting Mock VNC server...');
    await server.start();
    
    console.log(`✅ Mock VNC server started successfully!`);
    console.log(`🎭 Simulating WebSocket connections on port ${port}`);
    
    const screenInfo = server.getScreenInfo();
    console.log(`📺 Mock screen mode (${screenInfo.width}x${screenInfo.height})`);
    
    console.log();
    console.log('🧪 Mock Simulation Features:');
    console.log('============================');
    console.log('- Automatic client connection/disconnection simulation');
    console.log('- Quality adjustment testing');
    console.log('- Event system demonstration');
    console.log('- API validation without native dependencies');
    console.log();
    console.log('📋 To build the REAL VNC server:');
    console.log('1. Install Visual Studio Build Tools (see BUILD_SETUP.md)');
    console.log('2. Run: npm run clean && npm install');
    console.log('3. Run: npm run example');
    console.log();
    console.log('Press Ctrl+C to stop the mock server');
    console.log('=====================================\n');

    // Keep running and show periodic updates
    setInterval(() => {
      const status = server.getServerStatus();
      if (status.isRunning) {
        console.log(`🔄 Mock server running | Clients: ${status.clientCount} | ${new Date().toLocaleTimeString()}`);
      }
    }, 10000);

    // Keep the process running
    await new Promise(() => {});

  } catch (error) {
    console.error('Failed to start mock VNC server:');
    console.error(`  ${error}`);
    process.exit(1);
  }
}

// Show usage for mock
function showUsage() {
  console.log('Usage: node dist/mock-example.js [options]');
  console.log();
  console.log('🎭 This is a MOCK version for testing the API without native build');
  console.log();
  console.log('Options:');
  console.log('  --port <number>        WebSocket port (mock, default: 5902)');
  console.log('  --password <string>    VNC password (mock, default: none)');
  console.log('  --virtual-desktop      Enable virtual desktop mode (mock)');
  console.log('  --width <number>       Virtual desktop width (mock, default: 1920)');
  console.log('  --height <number>      Virtual desktop height (mock, default: 1080)');
  console.log('  --help                 Show this help message');
  console.log();
  console.log('Examples:');
  console.log('  node dist/mock-example.js');
  console.log('  node dist/mock-example.js --port 5903 --password mypass');
  console.log('  node dist/mock-example.js --virtual-desktop --width 1280 --height 720');
}

if (process.argv.includes('--help')) {
  showUsage();
  process.exit(0);
} else {
  main().catch(console.error);
}