#include "vnc_addon.h"
#include <chrono>
#include <sstream>
#include <random>

Napi::Object VncServer::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "VncServer", {
        InstanceMethod("start", &VncServer::Start),
        InstanceMethod("stop", &VncServer::Stop),
        InstanceMethod("setQuality", &VncServer::SetQuality),
        InstanceMethod("getActiveClientsCount", &VncServer::GetActiveClientsCount),
        InstanceMethod("getServerStatus", &VncServer::GetServerStatus),
        InstanceMethod("getScreenInfo", &VncServer::GetScreenInfo)
    });

    exports.Set("VncServer", func);
    return exports;
}

VncServer::VncServer(const Napi::CallbackInfo& info) : Napi::ObjectWrap<VncServer>(info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Expected options object as first argument").ThrowAsJavaScriptException();
        return;
    }
    
    Napi::Object options = info[0].As<Napi::Object>();
    
    // Parse options
    if (options.Has("port")) {
        options_.port = options.Get("port").As<Napi::Number>().Int32Value();
    }
    
    if (options.Has("password")) {
        options_.password = options.Get("password").As<Napi::String>().Utf8Value();
    }
    
    if (options.Has("virtualDesktop")) {
        options_.virtualDesktop = options.Get("virtualDesktop").As<Napi::Boolean>().Value();
    }
    
    if (options.Has("width")) {
        options_.width = options.Get("width").As<Napi::Number>().Int32Value();
    }
    
    if (options.Has("height")) {
        options_.height = options.Get("height").As<Napi::Number>().Int32Value();
    }
    
    if (options.Has("maxClients")) {
        options_.maxClients = options.Get("maxClients").As<Napi::Number>().Int32Value();
    }
    
    if (options.Has("maxFps")) {
        options_.maxFps = options.Get("maxFps").As<Napi::Number>().Int32Value();
    }
    
    if (options.Has("compression")) {
        options_.compression = options.Get("compression").As<Napi::Boolean>().Value();
    }
    
    // Initialize components
    screenCapturer_ = std::make_unique<ScreenCapturer>();
    webSocketServer_ = std::make_unique<WebSocketServer>();
    
    if (options_.virtualDesktop) {
        virtualDesktop_ = std::make_unique<VirtualDesktop>();
    }
    
    // Setup event callbacks
    screenCapturer_->onCaptureStarted = [this]() { OnCaptureStarted(); };
    screenCapturer_->onCaptureStopped = [this]() { OnCaptureStopped(); };
    screenCapturer_->onError = [this](const std::string& msg) { OnError(msg, "CAPTURE_ERROR"); };
    
    webSocketServer_->onClientConnected = [this](const ClientInfo& client) { OnClientConnected(client); };
    webSocketServer_->onClientDisconnected = [this](const ClientInfo& client) { OnClientDisconnected(client); };
    webSocketServer_->onError = [this](const std::string& msg) { OnError(msg, "NETWORK_ERROR"); };
    
    webSocketServer_->onFirstClientConnected = [this]() {
        if (!captureActive_) {
            screenCapturer_->StartCapture();
            captureActive_ = true;
        }
    };
    
    webSocketServer_->onLastClientDisconnected = [this]() {
        if (captureActive_) {
            screenCapturer_->StopCapture();
            captureActive_ = false;
        }
    };
    
    // Create thread-safe function for event emission
    eventEmitter_ = Napi::ThreadSafeFunction::New(
        env,
        Napi::Function::New(env, [](const Napi::CallbackInfo& info) {
            // This function will be called from the main thread to emit events
            return info.Env().Undefined();
        }),
        "VncServerEventEmitter",
        0,
        1
    );
}

VncServer::~VncServer() {
    if (running_) {
        StopInternal();
    }
    
    if (eventEmitter_) {
        eventEmitter_.Release();
    }
}

Napi::Value VncServer::Start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (running_) {
        return Napi::Promise::Resolve(env, env.Undefined());
    }
    
    auto deferred = Napi::Promise::Deferred::New(env);
    
    try {
        StartInternal();
        deferred.Resolve(env.Undefined());
    } catch (const std::exception& e) {
        deferred.Reject(Napi::Error::New(env, e.what()).Value());
    }
    
    return deferred.Promise();
}

Napi::Value VncServer::Stop(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!running_) {
        return Napi::Promise::Resolve(env, env.Undefined());
    }
    
    auto deferred = Napi::Promise::Deferred::New(env);
    
    try {
        StopInternal();
        deferred.Resolve(env.Undefined());
    } catch (const std::exception& e) {
        deferred.Reject(Napi::Error::New(env, e.what()).Value());
    }
    
    return deferred.Promise();
}

void VncServer::SetQuality(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Expected quality options object").ThrowAsJavaScriptException();
        return;
    }
    
    Napi::Object options = info[0].As<Napi::Object>();
    
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (options.Has("jpegQuality")) {
        quality_.jpegQuality = options.Get("jpegQuality").As<Napi::Number>().Int32Value();
    }
    
    if (options.Has("zlibLevel")) {
        quality_.zlibLevel = options.Get("zlibLevel").As<Napi::Number>().Int32Value();
    }
    
    if (options.Has("colorDepth")) {
        quality_.colorDepth = options.Get("colorDepth").As<Napi::Number>().Int32Value();
    }
    
    if (webSocketServer_) {
        webSocketServer_->SetQuality(quality_);
    }
    
    // Emit quality-changed event
    EmitEvent("quality-changed", {});
}

Napi::Value VncServer::GetActiveClientsCount(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), clientCount_.load());
}

Napi::Value VncServer::GetServerStatus(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object status = Napi::Object::New(env);
    
    std::lock_guard<std::mutex> lock(mutex_);
    
    status.Set("isRunning", Napi::Boolean::New(env, running_));
    status.Set("isCaptureActive", Napi::Boolean::New(env, captureActive_));
    status.Set("clientCount", Napi::Number::New(env, clientCount_.load()));
    status.Set("port", Napi::Number::New(env, options_.port));
    
    // Quality settings
    Napi::Object qualityObj = Napi::Object::New(env);
    qualityObj.Set("jpegQuality", Napi::Number::New(env, quality_.jpegQuality));
    qualityObj.Set("zlibLevel", Napi::Number::New(env, quality_.zlibLevel));
    qualityObj.Set("colorDepth", Napi::Number::New(env, quality_.colorDepth));
    status.Set("quality", qualityObj);
    
    // Capture statistics (if active)
    if (captureActive_ && screenCapturer_) {
        const auto& stats = screenCapturer_->GetStats();
        Napi::Object statsObj = Napi::Object::New(env);
        statsObj.Set("fps", Napi::Number::New(env, stats.fps));
        statsObj.Set("totalFrames", Napi::Number::New(env, static_cast<double>(stats.totalFrames)));
        statsObj.Set("dirtyRegions", Napi::Number::New(env, stats.dirtyRegions));
        statsObj.Set("bytesPerSecond", Napi::Number::New(env, stats.bytesPerSecond));
        statsObj.Set("cpuUsage", Napi::Number::New(env, stats.cpuUsage));
        status.Set("captureStats", statsObj);
    }
    
    return status;
}

Napi::Value VncServer::GetScreenInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object screenInfo = Napi::Object::New(env);
    
    if (screenCapturer_) {
        int width, height, bpp;
        screenCapturer_->GetScreenInfo(width, height, bpp);
        
        screenInfo.Set("width", Napi::Number::New(env, width));
        screenInfo.Set("height", Napi::Number::New(env, height));
        screenInfo.Set("bitsPerPixel", Napi::Number::New(env, bpp));
        screenInfo.Set("refreshRate", Napi::Number::New(env, 60)); // Default refresh rate
    }
    
    return screenInfo;
}

void VncServer::StartInternal() {
    if (running_) {
        return;
    }
    
    // Initialize virtual desktop if requested
    if (options_.virtualDesktop && virtualDesktop_) {
        if (!virtualDesktop_->Initialize(options_.width, options_.height)) {
            throw std::runtime_error("Failed to initialize virtual desktop");
        }
        
        if (!virtualDesktop_->SwitchToVirtualDesktop()) {
            throw std::runtime_error("Failed to switch to virtual desktop");
        }
    }
    
    // Initialize screen capturer
    if (!screenCapturer_->Initialize()) {
        throw std::runtime_error("Failed to initialize screen capturer");
    }
    
    screenCapturer_->SetFrameRate(options_.maxFps);
    
    // Start WebSocket server
    if (!webSocketServer_->Start(options_.port, options_.password)) {
        throw std::runtime_error("Failed to start WebSocket server on port " + std::to_string(options_.port));
    }
    
    running_ = true;
}

void VncServer::StopInternal() {
    if (!running_) {
        return;
    }
    
    running_ = false;
    
    // Stop capture if active
    if (captureActive_) {
        screenCapturer_->StopCapture();
        captureActive_ = false;
    }
    
    // Stop WebSocket server
    if (webSocketServer_) {
        webSocketServer_->Stop();
    }
    
    // Shutdown screen capturer
    if (screenCapturer_) {
        screenCapturer_->Shutdown();
    }
    
    // Switch back to original desktop if using virtual desktop
    if (options_.virtualDesktop && virtualDesktop_) {
        virtualDesktop_->SwitchToOriginalDesktop();
        virtualDesktop_->Shutdown();
    }
}

void VncServer::OnClientConnected(const ClientInfo& client) {
    clientCount_++;
    EmitEvent("client-connected", {});
}

void VncServer::OnClientDisconnected(const ClientInfo& client) {
    clientCount_--;
    EmitEvent("client-disconnected", {});
}

void VncServer::OnError(const std::string& message, const std::string& type) {
    EmitEvent("error", {});
}

void VncServer::OnCaptureStarted() {
    EmitEvent("capture-started", {});
}

void VncServer::OnCaptureStopped() {
    EmitEvent("capture-stopped", {});
}

void VncServer::EmitEvent(const std::string& eventName, const std::vector<Napi::Value>& args) {
    if (!eventEmitter_) return;
    
    eventEmitter_.BlockingCall([eventName](Napi::Env env, Napi::Function jsCallback) {
        // This will be handled by the TypeScript wrapper
        // The actual event emission happens in the JavaScript layer
    });
}