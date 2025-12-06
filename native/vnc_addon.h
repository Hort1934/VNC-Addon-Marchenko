#pragma once

#include <napi.h>
#include <memory>
#include <string>
#include <vector>
#include <functional>
#include <atomic>
#include <mutex>
#include <thread>

#ifdef _WIN32
#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#endif

/**
 * Represents a dirty rectangle on the screen
 */
struct DirtyRect {
    int x, y, width, height;
    
    DirtyRect() : x(0), y(0), width(0), height(0) {}
    DirtyRect(int x, int y, int w, int h) : x(x), y(y), width(w), height(h) {}
};

/**
 * Represents client connection information
 */
struct ClientInfo {
    std::string id;
    std::string address;
    std::string connectedAt;
    std::vector<std::string> encodings;
    bool isWebSocket;
    
    ClientInfo() : isWebSocket(false) {}
};

/**
 * VNC Server quality options
 */
struct QualityOptions {
    int jpegQuality = 80;
    int zlibLevel = 6;
    int colorDepth = 32;
};

/**
 * VNC Server configuration options
 */
struct VncServerOptions {
    int port = 5902;
    std::string password;
    bool virtualDesktop = false;
    int width = 1920;
    int height = 1080;
    int maxClients = 10;
    int maxFps = 30;
    bool compression = true;
};

/**
 * Screen capture statistics
 */
struct CaptureStats {
    double fps = 0.0;
    uint64_t totalFrames = 0;
    int dirtyRegions = 0;
    double bytesPerSecond = 0.0;
    double cpuUsage = 0.0;
};

/**
 * Forward declarations
 */
class ScreenCapturer;
class WebSocketServer;
class VirtualDesktop;

/**
 * Main VNC Server implementation
 */
class VncServer : public Napi::ObjectWrap<VncServer> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    VncServer(const Napi::CallbackInfo& info);
    virtual ~VncServer();

    // JavaScript-accessible methods
    Napi::Value Start(const Napi::CallbackInfo& info);
    Napi::Value Stop(const Napi::CallbackInfo& info);
    void SetQuality(const Napi::CallbackInfo& info);
    Napi::Value GetActiveClientsCount(const Napi::CallbackInfo& info);
    Napi::Value GetServerStatus(const Napi::CallbackInfo& info);
    Napi::Value GetScreenInfo(const Napi::CallbackInfo& info);

private:
    // Internal methods
    void StartInternal();
    void StopInternal();
    void OnClientConnected(const ClientInfo& client);
    void OnClientDisconnected(const ClientInfo& client);
    void OnError(const std::string& message, const std::string& type = "UNKNOWN_ERROR");
    void OnCaptureStarted();
    void OnCaptureStopped();
    
    // Thread-safe event emission
    void EmitEvent(const std::string& eventName, const std::vector<Napi::Value>& args);
    
    // Member variables
    std::atomic<bool> running_{false};
    std::atomic<bool> captureActive_{false};
    std::atomic<int> clientCount_{0};
    
    VncServerOptions options_;
    QualityOptions quality_;
    
    std::unique_ptr<ScreenCapturer> screenCapturer_;
    std::unique_ptr<WebSocketServer> webSocketServer_;
    std::unique_ptr<VirtualDesktop> virtualDesktop_;
    
    Napi::ThreadSafeFunction eventEmitter_;
    std::mutex mutex_;
    
    // Statistics
    CaptureStats captureStats_;
};

/**
 * Screen capturer using Windows Desktop Duplication API (DXGI)
 */
class ScreenCapturer {
public:
    ScreenCapturer();
    virtual ~ScreenCapturer();
    
    bool Initialize();
    void Shutdown();
    
    bool StartCapture();
    void StopCapture();
    
    bool CaptureFrame(std::vector<uint8_t>& frameData, std::vector<DirtyRect>& dirtyRects);
    void GetScreenInfo(int& width, int& height, int& bitsPerPixel);
    
    void SetFrameRate(int fps);
    const CaptureStats& GetStats() const { return stats_; }
    
    // Event callbacks
    std::function<void()> onCaptureStarted;
    std::function<void()> onCaptureStopped;
    std::function<void(const std::string&)> onError;

private:
    void CaptureThread();
    bool InitializeDXGI();
    void CleanupDXGI();
    bool ProcessFrame();
    
    std::atomic<bool> capturing_{false};
    std::thread captureThread_;
    
    // DXGI objects
    ID3D11Device* d3dDevice_ = nullptr;
    ID3D11DeviceContext* d3dContext_ = nullptr;
    IDXGIOutputDuplication* duplication_ = nullptr;
    
    // Frame data
    std::vector<uint8_t> currentFrame_;
    std::vector<uint8_t> previousFrame_;
    std::vector<DirtyRect> dirtyRects_;
    
    int screenWidth_ = 0;
    int screenHeight_ = 0;
    int frameRate_ = 30;
    
    CaptureStats stats_;
    std::mutex frameMutex_;
};

/**
 * WebSocket server for noVNC clients
 */
class WebSocketServer {
public:
    WebSocketServer();
    virtual ~WebSocketServer();
    
    bool Start(int port, const std::string& password = "");
    void Stop();
    
    void BroadcastFrame(const std::vector<uint8_t>& frameData, const std::vector<DirtyRect>& dirtyRects);
    void SetQuality(const QualityOptions& quality);
    
    int GetClientCount() const { return clientCount_; }
    
    // Event callbacks
    std::function<void(const ClientInfo&)> onClientConnected;
    std::function<void(const ClientInfo&)> onClientDisconnected;
    std::function<void(const std::string&)> onError;
    std::function<void()> onFirstClientConnected;
    std::function<void()> onLastClientDisconnected;

private:
    void ServerThread();
    void HandleClient(SOCKET clientSocket);
    bool PerformWebSocketHandshake(SOCKET socket);
    void ProcessVncProtocol(SOCKET socket, const ClientInfo& client);
    
    std::atomic<bool> running_{false};
    std::atomic<int> clientCount_{0};
    std::thread serverThread_;
    
    SOCKET serverSocket_ = INVALID_SOCKET;
    int port_ = 0;
    std::string password_;
    QualityOptions quality_;
    
    std::mutex clientsMutex_;
    std::vector<SOCKET> clients_;
};

/**
 * Virtual Desktop implementation (optional feature)
 */
class VirtualDesktop {
public:
    VirtualDesktop();
    virtual ~VirtualDesktop();
    
    bool Initialize(int width, int height);
    void Shutdown();
    
    bool SwitchToVirtualDesktop();
    bool SwitchToOriginalDesktop();
    
    HDESK GetVirtualDesktop() const { return virtualDesktop_; }

private:
    HDESK originalDesktop_ = nullptr;
    HDESK virtualDesktop_ = nullptr;
    HWINSTA windowStation_ = nullptr;
    
    int width_ = 1920;
    int height_ = 1080;
};

/**
 * Utility functions
 */
namespace VncUtils {
    std::string GenerateClientId();
    std::string GetCurrentTimestamp();
    std::vector<DirtyRect> FindDirtyRects(
        const std::vector<uint8_t>& current,
        const std::vector<uint8_t>& previous,
        int width, int height, int bytesPerPixel
    );
    bool InitializeWinsock();
    void CleanupWinsock();
}