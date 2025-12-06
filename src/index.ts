/**
 * VNC-Addon for Node.js
 * High-performance native VNC server addon with DXGI screen capture
 * 
 * @author Ihor Marchenko
 * @license MIT
 */

// Main exports
export { VncServer } from './main';

// Type exports
export {
  VncServerOptions,
  QualityOptions,
  ClientInfo,
  ServerStatus,
  ScreenInfo,
  CaptureStats,
  DirtyRect,
  VncError,
  VncErrorType,
  VncServerEvents,
  NativeVncServer
} from './types';

// Default export for convenience
export { VncServer as default } from './main';