/**
 * Represents information about a connected VNC client.
 */
export interface ClientInfo {
  /** Unique identifier for the client connection */
  readonly id: string;
  
  /** Client's IP address */
  readonly address: string;
  
  /** Connection timestamp (ISO string) */
  readonly connectedAt: string;
  
  /** Client's supported encodings */
  readonly encodings: string[];
  
  /** Whether the client is using WebSocket (noVNC) or raw TCP */
  readonly isWebSocket: boolean;
}

/**
 * VncServer create options
 */
export interface VncServerOptions {
  /** 
   * The WebSocket port for noVNC clients.
   * Standard TCP VNC connections are not supported.
   */
  port: number;
  
  /** Optional password for VNC authentication */
  password?: string;
  
  /**
   * Enables the Virtual Desktop mode.
   * When false (default), the server captures the main physical desktop.
   * When true, the server activates the virtual desktop implementation.
   * @default false
   */ 
  virtualDesktop?: boolean;
  
  /** 
   * Optional width and height for the virtual desktop.
   * NOTE: This setting is ignored unless the server is started
   * in 'virtual desktop' mode.
   */
  width?: number;
  height?: number;
  
  /**
   * Maximum number of concurrent client connections
   * @default 10
   */
  maxClients?: number;
  
  /**
   * Frame rate limit for screen capture (FPS)
   * @default 30
   */
  maxFps?: number;
  
  /**
   * Enable compression for better performance over slow networks
   * @default true
   */
  compression?: boolean;
}

/**
 * Quality options for dynamic adjustment of stream quality
 */
export interface QualityOptions {
  /** 
   * JPEG quality level (0-100) for TIGHT encoding
   * Higher values = better quality, more bandwidth
   * @default 80
   */
  jpegQuality?: number;
  
  /**
   * Zlib compression level (0-9) for zlib-based encodings
   * Higher values = better compression, more CPU usage
   * @default 6
   */
  zlibLevel?: number;
  
  /**
   * Color depth in bits per pixel (8, 16, 24, 32)
   * @default 32
   */
  colorDepth?: number;
}

/**
 * Screen capture statistics
 */
export interface CaptureStats {
  /** Current frames per second being captured */
  readonly fps: number;
  
  /** Total frames captured since start */
  readonly totalFrames: number;
  
  /** Number of dirty regions in last frame */
  readonly dirtyRegions: number;
  
  /** Average bytes per second being transmitted */
  readonly bytesPerSecond: number;
  
  /** CPU usage percentage for capture thread */
  readonly cpuUsage: number;
}

/**
 * Server status information
 */
export interface ServerStatus {
  /** Whether the server is currently running */
  readonly isRunning: boolean;
  
  /** Whether screen capture is active (has clients) */
  readonly isCaptureActive: boolean;
  
  /** Current number of connected clients */
  readonly clientCount: number;
  
  /** Port the server is listening on */
  readonly port: number;
  
  /** Current quality settings */
  readonly quality: Required<QualityOptions>;
  
  /** Screen capture statistics (if active) */
  readonly captureStats?: CaptureStats;
}

/**
 * Rectangle representing a dirty region on screen
 */
export interface DirtyRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Screen information
 */
export interface ScreenInfo {
  readonly width: number;
  readonly height: number;
  readonly bitsPerPixel: number;
  readonly refreshRate: number;
}

/**
 * Error types that can be emitted by the VNC server
 */
export type VncErrorType = 
  | 'NETWORK_ERROR'
  | 'CAPTURE_ERROR' 
  | 'CLIENT_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'SYSTEM_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Enhanced error class for VNC server errors
 */
export class VncError extends Error {
  constructor(
    message: string,
    public readonly type: VncErrorType,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'VncError';
  }
}

/**
 * Event types emitted by VncServer
 */
export interface VncServerEvents {
  'client-connected': [client: ClientInfo];
  'client-disconnected': [client: ClientInfo];
  'error': [error: VncError];
  'capture-started': [];
  'capture-stopped': [];
  'quality-changed': [quality: QualityOptions];
}

/**
 * Native addon interface (implemented in C++)
 */
export interface NativeVncServer {
  start(options: VncServerOptions): Promise<void>;
  stop(): Promise<void>;
  setQuality(options: QualityOptions): void;
  getActiveClientsCount(): number;
  getServerStatus(): ServerStatus;
  getScreenInfo(): ScreenInfo;
}