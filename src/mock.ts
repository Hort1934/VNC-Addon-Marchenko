/**
 * Mock implementation for testing TypeScript layer without native addon
 * This allows testing the API structure and TypeScript functionality
 */

import { EventEmitter } from 'events';
import { 
  VncServerOptions, 
  QualityOptions, 
  ClientInfo, 
  ServerStatus, 
  ScreenInfo, 
  VncError,
  NativeVncServer 
} from './types';

// Mock native addon implementation
class MockNativeVncServer implements NativeVncServer {
  private isRunning = false;
  private clientCount = 0;
  private quality = { jpegQuality: 80, zlibLevel: 6, colorDepth: 32 };

  async start(options: VncServerOptions): Promise<void> {
    console.log('🎭 Mock: Starting VNC server on port', options.port);
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate startup time
    this.isRunning = true;
  }

  async stop(): Promise<void> {
    console.log('🎭 Mock: Stopping VNC server');
    await new Promise(resolve => setTimeout(resolve, 50));
    this.isRunning = false;
    this.clientCount = 0;
  }

  setQuality(options: QualityOptions): void {
    console.log('🎭 Mock: Setting quality', options);
    this.quality = { ...this.quality, ...options };
  }

  getActiveClientsCount(): number {
    return this.clientCount;
  }

  getServerStatus(): ServerStatus {
    if (this.clientCount > 0) {
      return {
        isRunning: this.isRunning,
        isCaptureActive: this.clientCount > 0,
        clientCount: this.clientCount,
        port: 5902,
        quality: this.quality as Required<QualityOptions>,
        captureStats: {
          fps: 30,
          totalFrames: Math.floor(Math.random() * 10000),
          dirtyRegions: Math.floor(Math.random() * 20),
          bytesPerSecond: Math.random() * 1000000,
          cpuUsage: Math.random() * 50
        }
      };
    } else {
      return {
        isRunning: this.isRunning,
        isCaptureActive: false,
        clientCount: 0,
        port: 5902,
        quality: this.quality as Required<QualityOptions>
      };
    }
  }

  getScreenInfo(): ScreenInfo {
    return {
      width: 1920,
      height: 1080,
      bitsPerPixel: 32,
      refreshRate: 60
    };
  }

  // Mock client simulation
  simulateClientConnection(): void {
    if (this.clientCount < 5) {
      this.clientCount++;
      console.log(`🎭 Mock: Client connected (total: ${this.clientCount})`);
    }
  }

  simulateClientDisconnection(): void {
    if (this.clientCount > 0) {
      this.clientCount--;
      console.log(`🎭 Mock: Client disconnected (total: ${this.clientCount})`);
    }
  }
}

// Enhanced VncServer class for testing
export class MockVncServer extends EventEmitter {
  private nativeInstance: MockNativeVncServer;
  private options: Required<VncServerOptions>;
  private isRunning = false;

  constructor(options: VncServerOptions) {
    super();

    // Validate and set defaults (same as real implementation)
    if (!options.port || options.port <= 0 || options.port > 65535) {
      throw new VncError('Invalid port number. Must be between 1 and 65535.', 'SYSTEM_ERROR');
    }

    this.options = {
      port: options.port,
      password: options.password || '',
      virtualDesktop: options.virtualDesktop || false,
      width: options.width || 1920,
      height: options.height || 1080,
      maxClients: options.maxClients || 10,
      maxFps: options.maxFps || 30,
      compression: options.compression !== undefined ? options.compression : true
    };

    this.nativeInstance = new MockNativeVncServer();
    
    console.log('🎭 Mock VncServer created with options:', this.options);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      await this.nativeInstance.start(this.options);
      this.isRunning = true;
      
      // Simulate some client events for demonstration
      setTimeout(() => {
        this.simulateClientActivity();
      }, 1000);
      
    } catch (error) {
      const vncError = new VncError(
        `Failed to start VNC server: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR'
      );
      this.emit('error', vncError);
      throw vncError;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.nativeInstance.stop();
      this.isRunning = false;
    } catch (error) {
      const vncError = new VncError(
        `Failed to stop VNC server: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SYSTEM_ERROR'
      );
      this.emit('error', vncError);
      throw vncError;
    }
  }

  setQuality(options: QualityOptions): void {
    // Same validation as real implementation
    if (options.jpegQuality !== undefined) {
      if (options.jpegQuality < 0 || options.jpegQuality > 100) {
        throw new VncError('JPEG quality must be between 0 and 100.', 'SYSTEM_ERROR');
      }
    }

    if (options.zlibLevel !== undefined) {
      if (options.zlibLevel < 0 || options.zlibLevel > 9) {
        throw new VncError('Zlib compression level must be between 0 and 9.', 'SYSTEM_ERROR');
      }
    }

    try {
      this.nativeInstance.setQuality(options);
      this.emit('quality-changed', options);
    } catch (error) {
      const vncError = new VncError(
        `Failed to set quality options: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SYSTEM_ERROR'
      );
      this.emit('error', vncError);
      throw vncError;
    }
  }

  getActiveClientsCount(): number {
    return this.nativeInstance.getActiveClientsCount();
  }

  getServerStatus(): ServerStatus {
    return this.nativeInstance.getServerStatus();
  }

  getScreenInfo(): ScreenInfo {
    return this.nativeInstance.getScreenInfo();
  }

  getOptions(): Readonly<Required<VncServerOptions>> {
    return { ...this.options };
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }

  // Simulation methods for testing
  simulateClientConnection(): void {
    const mockClient: ClientInfo = {
      id: `mock_client_${Date.now()}`,
      address: '127.0.0.1',
      connectedAt: new Date().toISOString(),
      encodings: ['ZRLE', 'Tight', 'Raw'],
      isWebSocket: true
    };

    this.nativeInstance.simulateClientConnection();
    this.emit('client-connected', mockClient);
    
    if (this.getActiveClientsCount() === 1) {
      this.emit('capture-started');
    }
  }

  simulateClientDisconnection(): void {
    const mockClient: ClientInfo = {
      id: `mock_client_${Date.now()}`,
      address: '127.0.0.1',
      connectedAt: new Date().toISOString(),
      encodings: ['ZRLE', 'Tight', 'Raw'],
      isWebSocket: true
    };

    this.nativeInstance.simulateClientDisconnection();
    this.emit('client-disconnected', mockClient);
    
    if (this.getActiveClientsCount() === 0) {
      this.emit('capture-stopped');
    }
  }

  private simulateClientActivity(): void {
    // Simulate client connections and disconnections
    const activities = [
      () => this.simulateClientConnection(),
      () => this.simulateClientDisconnection(),
      () => {
        this.setQuality({ jpegQuality: Math.floor(Math.random() * 100) });
      }
    ];

    const runActivity = () => {
      if (!this.isRunning) return;
      
      const activity = activities[Math.floor(Math.random() * activities.length)];
      activity();
      
      // Schedule next activity
      setTimeout(runActivity, 2000 + Math.random() * 3000);
    };

    runActivity();
  }
}

export * from './types';