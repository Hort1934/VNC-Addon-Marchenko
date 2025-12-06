#include "vnc_addon.h"
#include <sstream>
#include <iomanip>
#include <string>
#include <vector>
#include <regex>

#pragma comment(lib, "ws2_32.lib")

WebSocketServer::WebSocketServer() {
}

WebSocketServer::~WebSocketServer() {
    Stop();
}

bool WebSocketServer::Start(int port, const std::string& password) {
    if (running_) {
        return true;
    }
    
    port_ = port;
    password_ = password;
    
    // Initialize Winsock
    WSADATA wsaData;
    int result = WSAStartup(MAKEWORD(2, 2), &wsaData);
    if (result != 0) {
        if (onError) {
            onError("WSAStartup failed: " + std::to_string(result));
        }
        return false;
    }
    
    // Create socket
    serverSocket_ = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (serverSocket_ == INVALID_SOCKET) {
        if (onError) {
            onError("Failed to create socket: " + std::to_string(WSAGetLastError()));
        }
        WSACleanup();
        return false;
    }
    
    // Allow socket reuse
    int opt = 1;
    setsockopt(serverSocket_, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&opt), sizeof(opt));
    
    // Bind socket
    sockaddr_in serverAddr;
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_addr.s_addr = INADDR_ANY;
    serverAddr.sin_port = htons(port_);
    
    if (bind(serverSocket_, reinterpret_cast<sockaddr*>(&serverAddr), sizeof(serverAddr)) == SOCKET_ERROR) {
        if (onError) {
            onError("Failed to bind socket to port " + std::to_string(port_) + ": " + std::to_string(WSAGetLastError()));
        }
        closesocket(serverSocket_);
        WSACleanup();
        return false;
    }
    
    // Listen for connections
    if (listen(serverSocket_, SOMAXCONN) == SOCKET_ERROR) {
        if (onError) {
            onError("Failed to listen on socket: " + std::to_string(WSAGetLastError()));
        }
        closesocket(serverSocket_);
        WSACleanup();
        return false;
    }
    
    running_ = true;
    serverThread_ = std::thread(&WebSocketServer::ServerThread, this);
    
    return true;
}

void WebSocketServer::Stop() {
    if (!running_) {
        return;
    }
    
    running_ = false;
    
    // Close server socket to break accept() call
    if (serverSocket_ != INVALID_SOCKET) {
        closesocket(serverSocket_);
        serverSocket_ = INVALID_SOCKET;
    }
    
    // Close all client connections
    {
        std::lock_guard<std::mutex> lock(clientsMutex_);
        for (SOCKET clientSocket : clients_) {
            closesocket(clientSocket);
        }
        clients_.clear();
    }
    
    // Wait for server thread to finish
    if (serverThread_.joinable()) {
        serverThread_.join();
    }
    
    WSACleanup();
}

void WebSocketServer::BroadcastFrame(const std::vector<uint8_t>& frameData, const std::vector<DirtyRect>& dirtyRects) {
    if (dirtyRects.empty() || frameData.empty()) {
        return;
    }
    
    std::lock_guard<std::mutex> lock(clientsMutex_);
    
    // Send frame updates to all connected clients
    for (auto it = clients_.begin(); it != clients_.end();) {
        SOCKET clientSocket = *it;
        
        // Try to send frame update
        bool success = true;
        try {
            // This is a simplified implementation
            // In a real VNC implementation, you would encode the frame data
            // according to the VNC protocol (RFB) and the client's supported encodings
            
            // For now, we'll just send a basic frame update message
            // A proper implementation would need to:
            // 1. Encode the dirty rectangles using supported encodings (Raw, ZRLE, Tight, etc.)
            // 2. Compress the data if compression is enabled
            // 3. Send WebSocket frames for noVNC clients
            
        } catch (...) {
            success = false;
        }
        
        if (!success) {
            // Remove disconnected client
            closesocket(clientSocket);
            it = clients_.erase(it);
            clientCount_--;
            
            if (clientCount_ == 0 && onLastClientDisconnected) {
                onLastClientDisconnected();
            }
        } else {
            ++it;
        }
    }
}

void WebSocketServer::SetQuality(const QualityOptions& quality) {
    quality_ = quality;
}

void WebSocketServer::ServerThread() {
    while (running_) {
        sockaddr_in clientAddr;
        int addrSize = sizeof(clientAddr);
        
        SOCKET clientSocket = accept(serverSocket_, reinterpret_cast<sockaddr*>(&clientAddr), &addrSize);
        
        if (clientSocket == INVALID_SOCKET) {
            if (running_) {
                // Only report error if we're still supposed to be running
                if (onError) {
                    onError("Accept failed: " + std::to_string(WSAGetLastError()));
                }
            }
            continue;
        }
        
        // Handle client in separate thread
        std::thread clientThread(&WebSocketServer::HandleClient, this, clientSocket);
        clientThread.detach(); // Let it run independently
    }
}

void WebSocketServer::HandleClient(SOCKET clientSocket) {
    // Get client address
    sockaddr_in clientAddr;
    int addrSize = sizeof(clientAddr);
    getpeername(clientSocket, reinterpret_cast<sockaddr*>(&clientAddr), &addrSize);
    
    char clientIP[INET_ADDRSTRLEN];
    inet_ntop(AF_INET, &clientAddr.sin_addr, clientIP, INET_ADDRSTRLEN);
    
    ClientInfo client;
    client.id = VncUtils::GenerateClientId();
    client.address = clientIP;
    client.connectedAt = VncUtils::GetCurrentTimestamp();
    client.isWebSocket = false; // Will be updated after handshake
    
    try {
        // Perform WebSocket handshake
        if (!PerformWebSocketHandshake(clientSocket)) {
            closesocket(clientSocket);
            return;
        }
        
        client.isWebSocket = true;
        
        // Add to client list
        {
            std::lock_guard<std::mutex> lock(clientsMutex_);
            clients_.push_back(clientSocket);
            
            bool wasFirstClient = (clientCount_ == 0);
            clientCount_++;
            
            if (wasFirstClient && onFirstClientConnected) {
                onFirstClientConnected();
            }
        }
        
        // Notify about new client
        if (onClientConnected) {
            onClientConnected(client);
        }
        
        // Process VNC protocol
        ProcessVncProtocol(clientSocket, client);
        
    } catch (const std::exception& e) {
        if (onError) {
            onError("Client handling error: " + std::string(e.what()));
        }
    }
    
    // Client disconnected
    closesocket(clientSocket);
    
    // Remove from client list
    {
        std::lock_guard<std::mutex> lock(clientsMutex_);
        auto it = std::find(clients_.begin(), clients_.end(), clientSocket);
        if (it != clients_.end()) {
            clients_.erase(it);
            clientCount_--;
            
            if (clientCount_ == 0 && onLastClientDisconnected) {
                onLastClientDisconnected();
            }
        }
    }
    
    // Notify about client disconnection
    if (onClientDisconnected) {
        onClientDisconnected(client);
    }
}

bool WebSocketServer::PerformWebSocketHandshake(SOCKET socket) {
    // Read HTTP request
    char buffer[4096];
    int bytesReceived = recv(socket, buffer, sizeof(buffer) - 1, 0);
    
    if (bytesReceived <= 0) {
        return false;
    }
    
    buffer[bytesReceived] = '\0';
    std::string request(buffer);
    
    // Check if it's a WebSocket upgrade request
    if (request.find("Upgrade: websocket") == std::string::npos) {
        return false;
    }
    
    // Extract WebSocket key
    std::regex keyRegex(R"(Sec-WebSocket-Key:\s*([A-Za-z0-9+/=]+))");
    std::smatch keyMatch;
    
    if (!std::regex_search(request, keyMatch, keyRegex)) {
        return false;
    }
    
    std::string webSocketKey = keyMatch[1].str();
    
    // Generate WebSocket accept key
    std::string acceptKey = webSocketKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    
    // In a real implementation, you would compute SHA-1 hash and base64 encode it
    // For simplicity, we'll use a placeholder
    std::string hashedKey = "placeholder_accept_key";
    
    // Send WebSocket handshake response
    std::ostringstream response;
    response << "HTTP/1.1 101 Switching Protocols\\r\\n"
             << "Upgrade: websocket\\r\\n"
             << "Connection: Upgrade\\r\\n"
             << "Sec-WebSocket-Accept: " << hashedKey << "\\r\\n"
             << "Sec-WebSocket-Protocol: binary\\r\\n"
             << "\\r\\n";
    
    std::string responseStr = response.str();
    int bytesSent = send(socket, responseStr.c_str(), static_cast<int>(responseStr.length()), 0);
    
    return bytesSent > 0;
}

void WebSocketServer::ProcessVncProtocol(SOCKET socket, const ClientInfo& client) {
    // This is where the VNC protocol implementation would go
    // For a complete implementation, you would need to:
    
    // 1. Send RFB protocol version
    // 2. Handle authentication (if password is set)
    // 3. Send server initialization message (screen size, pixel format, etc.)
    // 4. Process client messages (SetPixelFormat, SetEncodings, FramebufferUpdateRequest, etc.)
    // 5. Send framebuffer updates when requested
    // 6. Handle pointer and keyboard events
    
    // This is a simplified placeholder implementation
    char buffer[1024];
    
    while (running_) {
        int bytesReceived = recv(socket, buffer, sizeof(buffer), 0);
        
        if (bytesReceived <= 0) {
            // Connection closed or error
            break;
        }
        
        // Process received VNC protocol messages
        // This would include handling client input events, framebuffer update requests, etc.
        
        // For now, just echo back to keep connection alive
        // In a real implementation, this is where you would:
        // - Parse VNC protocol messages
        // - Handle client input (mouse, keyboard)
        // - Send framebuffer updates
        // - Manage encoding preferences
    }
}

// Utility functions implementation
namespace VncUtils {
    std::string GenerateClientId() {
        static std::random_device rd;
        static std::mt19937 gen(rd());
        static std::uniform_int_distribution<> dis(0, 15);
        
        std::ostringstream oss;
        for (int i = 0; i < 16; ++i) {
            oss << std::hex << dis(gen);
        }
        return oss.str();
    }
    
    std::string GetCurrentTimestamp() {
        auto now = std::chrono::system_clock::now();
        auto time_t = std::chrono::system_clock::to_time_t(now);
        
        std::ostringstream oss;
        oss << std::put_time(std::gmtime(&time_t), "%Y-%m-%dT%H:%M:%SZ");
        return oss.str();
    }
    
    std::vector<DirtyRect> FindDirtyRects(
        const std::vector<uint8_t>& current,
        const std::vector<uint8_t>& previous,
        int width, int height, int bytesPerPixel
    ) {
        std::vector<DirtyRect> dirtyRects;
        
        if (current.size() != previous.size() || current.empty()) {
            // If sizes don't match or empty, mark entire screen as dirty
            dirtyRects.emplace_back(0, 0, width, height);
            return dirtyRects;
        }
        
        // Simple dirty rectangle detection
        // In a more sophisticated implementation, you might use:
        // - Block-based comparison for better performance
        // - Rectangle merging to reduce the number of updates
        // - Adaptive block sizes based on change patterns
        
        const int blockSize = 32; // 32x32 pixel blocks
        const int stride = width * bytesPerPixel;
        
        for (int y = 0; y < height; y += blockSize) {
            for (int x = 0; x < width; x += blockSize) {
                bool isDirty = false;
                
                // Check if this block has changed
                int blockWidth = std::min(blockSize, width - x);
                int blockHeight = std::min(blockSize, height - y);
                
                for (int by = 0; by < blockHeight && !isDirty; ++by) {
                    const uint8_t* currentLine = current.data() + (y + by) * stride + x * bytesPerPixel;
                    const uint8_t* previousLine = previous.data() + (y + by) * stride + x * bytesPerPixel;
                    
                    if (memcmp(currentLine, previousLine, blockWidth * bytesPerPixel) != 0) {
                        isDirty = true;
                    }
                }
                
                if (isDirty) {
                    dirtyRects.emplace_back(x, y, blockWidth, blockHeight);
                }
            }
        }
        
        return dirtyRects;
    }
    
    bool InitializeWinsock() {
        WSADATA wsaData;
        return WSAStartup(MAKEWORD(2, 2), &wsaData) == 0;
    }
    
    void CleanupWinsock() {
        WSACleanup();
    }
}