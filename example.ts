/**
 * VNC-Addon Example
 * Demonstrates usage of the VNC server addon
 */

import { VncServer, VncError } from './src/index';

async function main() {
  console.log('VNC-Addon Example Application');
  console.log('==============================\n');

  // Parse command line arguments
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

  // Create VNC server instance
  const server = new VncServer({
    port: port,
    password: password,
    virtualDesktop: virtualDesktop,
    width: width,
    height: height,
    maxClients: 5,
    maxFps: 30,
    compression: true
  });

  // Set up event handlers
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

    // Restore quality when clients disconnect
    const clientCount = server.getActiveClientsCount();
    if (clientCount <= 1) {
      console.log('Restoring high quality for single client...');
      server.setQuality({
        jpegQuality: 85,
        zlibLevel: 6
      });
    }
  });

  server.on('capture-started', () => {
    console.log(`[${new Date().toISOString()}] Screen capture started`);
    
    // Start periodic status logging
    const statusInterval = setInterval(() => {
      if (server.getActiveClientsCount() > 0) {
        const status = server.getServerStatus();
        console.log(`[${new Date().toISOString()}] Status Update:`);
        console.log(`  Clients: ${status.clientCount}`);
        console.log(`  Capture Active: ${status.isCaptureActive}`);
        
        if (status.captureStats) {
          console.log(`  FPS: ${status.captureStats.fps.toFixed(1)}`);
          console.log(`  Dirty Regions: ${status.captureStats.dirtyRegions}`);
          console.log(`  CPU Usage: ${status.captureStats.cpuUsage.toFixed(1)}%`);
        }
        console.log();
      } else {
        clearInterval(statusInterval);
      }
    }, 5000); // Every 5 seconds
  });

  server.on('capture-stopped', () => {
    console.log(`[${new Date().toISOString()}] Screen capture stopped - no active clients`);
    console.log();
  });

  server.on('error', (error: VncError) => {
    console.error(`[${new Date().toISOString()}] VNC Server Error:`);
    console.error(`  Type: ${error.type}`);
    console.error(`  Message: ${error.message}`);
    if (error.code) {
      console.error(`  Code: ${error.code}`);
    }
    if (error.details) {
      console.error(`  Details:`, error.details);
    }
    console.error();
  });

  server.on('quality-changed', (quality) => {
    console.log(`[${new Date().toISOString()}] Quality settings updated:`);
    console.log(`  JPEG Quality: ${quality.jpegQuality || 'unchanged'}`);
    console.log(`  Zlib Level: ${quality.zlibLevel || 'unchanged'}`);
    console.log(`  Color Depth: ${quality.colorDepth || 'unchanged'}`);
    console.log();
  });

  // Handle graceful shutdown
  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n[${new Date().toISOString()}] Received ${signal}, shutting down gracefully...`);
    
    try {
      await server.stop();
      console.log('VNC server stopped successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    gracefulShutdown('unhandledRejection');
  });

  try {
    // Start the server
    console.log('Starting VNC server...');
    await server.start();
    
    console.log(`✓ VNC server started successfully!`);
    console.log(`✓ Listening for WebSocket connections on port ${port}`);
    
    if (virtualDesktop) {
      console.log(`✓ Virtual desktop mode enabled (${width}x${height})`);
    } else {
      const screenInfo = server.getScreenInfo();
      console.log(`✓ Physical desktop mode (${screenInfo.width}x${screenInfo.height})`);
    }
    
    console.log();
    console.log('Connection Instructions:');
    console.log('======================');
    console.log('1. Open noVNC in your web browser:');
    console.log('   - Go to https://novnc.com/noVNC/vnc.html');
    console.log('   - Or use a local noVNC installation');
    console.log();
    console.log('2. Connection settings:');
    console.log(`   - Host: localhost (or this machine's IP address)`);
    console.log(`   - Port: ${port}`);
    console.log(`   - Password: ${password || '(none)'}`);
    console.log();
    console.log('3. Alternative VNC clients:');
    console.log('   - TightVNC Viewer');
    console.log('   - RealVNC Viewer');
    console.log('   - TigerVNC');
    console.log();
    console.log('Press Ctrl+C to stop the server');
    console.log();

    // Keep the process running
    await new Promise(() => {});

  } catch (error) {
    console.error('Failed to start VNC server:');
    if (error instanceof VncError) {
      console.error(`  Type: ${error.type}`);
      console.error(`  Message: ${error.message}`);
      if (error.code) {
        console.error(`  Code: ${error.code}`);
      }
    } else {
      console.error(`  ${error}`);
    }
    
    console.error();
    console.error('Common issues and solutions:');
    console.error('- Port already in use: Try a different port with --port <number>');
    console.error('- Permission denied: Run as administrator for virtual desktop mode');
    console.error('- DXGI initialization failed: Ensure you\'re running in a desktop session');
    
    process.exit(1);
  }
}

// Show usage information
function showUsage() {
  console.log('Usage: node dist/example.js [options]');
  console.log();
  console.log('Options:');
  console.log('  --port <number>        WebSocket port (default: 5902)');
  console.log('  --password <string>    VNC password (default: none)');
  console.log('  --virtual-desktop      Enable virtual desktop mode');
  console.log('  --width <number>       Virtual desktop width (default: 1920)');
  console.log('  --height <number>      Virtual desktop height (default: 1080)');
  console.log('  --help                 Show this help message');
  console.log();
  console.log('Examples:');
  console.log('  node dist/example.js');
  console.log('  node dist/example.js --port 5903 --password mypass');
  console.log('  node dist/example.js --virtual-desktop --width 1280 --height 720');
}

if (process.argv.includes('--help')) {
  showUsage();
  process.exit(0);
} else {
  main().catch(console.error);
}