#include "vnc_addon.h"

/**
 * Entry point for the native addon
 */
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // Initialize Winsock for Windows networking
    if (!VncUtils::InitializeWinsock()) {
        Napi::Error::New(env, "Failed to initialize Winsock").ThrowAsJavaScriptException();
        return exports;
    }
    
    // Register the VncServer class
    return VncServer::Init(env, exports);
}

// Register the addon
NODE_API_MODULE(vnc_addon, Init)