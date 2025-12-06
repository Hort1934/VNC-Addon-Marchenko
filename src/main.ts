import { EventEmitter } from 'events';
import { 
  VncServerOptions, 
  QualityOptions, 
  ClientInfo, 
  ServerStatus, 
  ScreenInfo, 
  VncError, 
  VncServerEvents, 
  NativeVncServer 
} from './types';

// Import the native addon
const nativeAddon = require('../build/Release/vnc_addon.node');

/**
 * Main VncServer class that manages the VNC server.
 *
 * This class provides a high-level API to start, stop, and configure a
 * VNC server instance.
 *
 * It extends EventEmitter to provide asynchronous event notifications for
 * client connections, disconnections, and errors from the native layer.
 *
 * @example
 * ```typescript
 * import { VncServer } from 'vnc-addon-marchenko';
 *
 * const server = new VncServer({
 *   port: 5902, // This is the WebSocket port
 *   password: 'mysecretpassword'
 * });
 *
 * server.on('client-connected', (client) => {
 *   console.log(`Client connected: ${client.id}`);
 * });
 *
 * server.on('error', (err) => {
 *   console.error('VNC Server Error:', err);
 * });
 *
 * async function startServer() {
 *   await server.start();
 *   console.log('VNC Server is running!');
 * }
 *
 * startServer();
 * ```
 */
export class VncServer extends EventEmitter<VncServerEvents> {
  private nativeInstance: NativeVncServer;
  private options: Required<VncServerOptions>;
  private isRunning: boolean = false;

  /**
   * Creates a new instance of the VncServer.
   *
   * Note: This only initializes the class and state.
   * The server's network listeners are not activated until {@link VncServer.start} is called.
   *
   * @param options - The configuration options for the server instance.
   */
  constructor(options: VncServerOptions) {
    super();

    // Validate required options
    if (!options.port || options.port <= 0 || options.port > 65535) {
      throw new VncError('Invalid port number. Must be between 1 and 65535.', 'SYSTEM_ERROR');
    }

    // Set default values for optional options
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

    // Validate virtual desktop dimensions
    if (this.options.virtualDesktop) {
      if (this.options.width < 640 || this.options.width > 7680) {
        throw new VncError('Virtual desktop width must be between 640 and 7680 pixels.', 'SYSTEM_ERROR');
      }
      if (this.options.height < 480 || this.options.height > 4320) {
        throw new VncError('Virtual desktop height must be between 480 and 4320 pixels.', 'SYSTEM_ERROR');
      }
    }

    try {
      // Create native instance
      this.nativeInstance = new nativeAddon.VncServer(this.options);
      
      // Set up event forwarding from native layer
      this.setupNativeEventHandlers();
    } catch (error) {
      throw new VncError(
        `Failed to initialize native VNC server: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SYSTEM_ERROR'
      );
    }
  }

  /**
   * Starts the VNC server and begins listening for incoming connections.
   *
   * This method initializes the network listeners on the ports specified
   * in the constructor.
   *
   * Note: This does *not* immediately start the screen capture loop. The capture loop
   * will be automatically started only when the first client connects and
   * stopped when the last client disconnects to conserve resources.
   *
   * @returns A Promise that resolves when the server has successfully started
   * listening on all specified ports.
   * @throws Will reject the promise if the server fails to start (e.g.,
   * if a port is already in use).
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      await this.nativeInstance.start(this.options);
      this.isRunning = true;
      
      // Emit start event (not in the official API but useful for debugging)
      this.emit('server-started' as any);
    } catch (error) {
      const vncError = new VncError(
        `Failed to start VNC server: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR'
      );
      this.emit('error', vncError);
      throw vncError;
    }
  }

  /**
   * Stops the VNC server, disconnects all active clients, and cleans up all resources.
   *
   * This method gracefully shuts down the network listeners and stops all
   * underlying threads, including the screen capture loop (if active).
   *
   * @returns A Promise that resolves when the server and all its
   * components have been successfully shut down.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.nativeInstance.stop();
      this.isRunning = false;
      
      // Emit stop event (not in the official API but useful for debugging)
      this.emit('server-stopped' as any);
    } catch (error) {
      const vncError = new VncError(
        `Failed to stop VNC server: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SYSTEM_ERROR'
      );
      this.emit('error', vncError);
      throw vncError;
    }
  }

  /**
   * Dynamically updates the stream quality settings for all active and future connections.
   *
   * This allows for "on-the-fly" adjustments to the trade-off between
   * image quality and performance (CPU usage, bandwidth). For example,
   * you can change the JPEG quality or zlib compression level.
   *
   * @param options - An object containing the quality settings to update.
   * Any unspecified settings will remain at their current value.
   */
  setQuality(options: QualityOptions): void {
    // Validate quality options
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

    if (options.colorDepth !== undefined) {
      if (![8, 16, 24, 32].includes(options.colorDepth)) {
        throw new VncError('Color depth must be 8, 16, 24, or 32 bits per pixel.', 'SYSTEM_ERROR');
      }
    }

    try {
      this.nativeInstance.setQuality(options);
    } catch (error) {
      const vncError = new VncError(
        `Failed to set quality options: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SYSTEM_ERROR'
      );
      this.emit('error', vncError);
      throw vncError;
    }
  }

  /**
   * Gets the current number of actively connected VNC clients.
   *
   * This can be used to monitor server load or to verify if the
   * screen capture loop is active (count > 0).
   *
   * @returns The total count of active VNC clients
   * (both standard RFB and WebSocket-based clients like noVNC).
   */
  getActiveClientsCount(): number {
    try {
      return this.nativeInstance.getActiveClientsCount();
    } catch (error) {
      // In case of error, assume no clients are connected
      return 0;
    }
  }

  /**
   * Gets comprehensive server status information.
   *
   * @returns An object containing detailed server status including
   * runtime state, client count, quality settings, and capture statistics.
   */
  getServerStatus(): ServerStatus {
    try {
      return this.nativeInstance.getServerStatus();
    } catch (error) {
      throw new VncError(
        `Failed to get server status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SYSTEM_ERROR'
      );
    }
  }

  /**
   * Gets information about the current screen being captured.
   *
   * @returns An object containing screen dimensions, color depth, and refresh rate.
   */
  getScreenInfo(): ScreenInfo {
    try {
      return this.nativeInstance.getScreenInfo();
    } catch (error) {
      throw new VncError(
        `Failed to get screen info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CAPTURE_ERROR'
      );
    }
  }

  /**
   * Gets the current server configuration options.
   *
   * @returns A copy of the server configuration options.
   */
  getOptions(): Readonly<Required<VncServerOptions>> {
    return { ...this.options };
  }

  /**
   * Checks if the server is currently running.
   *
   * @returns True if the server is running, false otherwise.
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Sets up event handlers to forward events from the native layer
   * to the JavaScript EventEmitter interface.
   */
  private setupNativeEventHandlers(): void {
    // Note: In a real implementation, the native layer would use
    // ThreadSafeFunction to emit these events. For this example,
    // we're showing the structure but the actual event forwarding
    // would be implemented in the native C++ code.
    
    // The native layer would call JavaScript callbacks through
    // the ThreadSafeFunction mechanism to emit these events:
    
    // this.emit('client-connected', clientInfo);
    // this.emit('client-disconnected', clientInfo);  
    // this.emit('error', error);
    // this.emit('capture-started');
    // this.emit('capture-stopped');
  }

  // Event interface overrides for better TypeScript support
  
  /**
   * Emitted when a new VNC client successfully connects and authenticates.
   */
  on(event: 'client-connected', listener: (client: ClientInfo) => void): this;
  
  /**
   * Emitted when a VNC client disconnects from the server.
   */
  on(event: 'client-disconnected', listener: (client: ClientInfo) => void): this;
  
  /**
   * Emitted when an asynchronous error occurs within the native addon or server runtime.
   */
  on(event: 'error', listener: (error: VncError) => void): this;
  
  /**
   * Emitted when screen capture starts (first client connects).
   */
  on(event: 'capture-started', listener: () => void): this;
  
  /**
   * Emitted when screen capture stops (last client disconnects).
   */
  on(event: 'capture-stopped', listener: () => void): this;

  /**
   * Emitted when quality settings are changed.
   */
  on(event: 'quality-changed', listener: (quality: QualityOptions) => void): this;

  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event as any, listener);
  }

  /**
   * Clean up resources when the server is destroyed.
   */
  async destroy(): Promise<void> {
    if (this.isRunning) {
      await this.stop();
    }
    
    // Remove all listeners to prevent memory leaks
    this.removeAllListeners();
  }
}

// Re-export types for convenience
export * from './types';