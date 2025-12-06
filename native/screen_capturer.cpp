#include "vnc_addon.h"
#include <chrono>
#include <algorithm>

ScreenCapturer::ScreenCapturer() {
}

ScreenCapturer::~ScreenCapturer() {
    Shutdown();
}

bool ScreenCapturer::Initialize() {
    return InitializeDXGI();
}

void ScreenCapturer::Shutdown() {
    StopCapture();
    CleanupDXGI();
}

bool ScreenCapturer::StartCapture() {
    if (capturing_) {
        return true;
    }
    
    if (!d3dDevice_ || !duplication_) {
        if (!InitializeDXGI()) {
            return false;
        }
    }
    
    capturing_ = true;
    captureThread_ = std::thread(&ScreenCapturer::CaptureThread, this);
    
    if (onCaptureStarted) {
        onCaptureStarted();
    }
    
    return true;
}

void ScreenCapturer::StopCapture() {
    if (!capturing_) {
        return;
    }
    
    capturing_ = false;
    
    if (captureThread_.joinable()) {
        captureThread_.join();
    }
    
    if (onCaptureStopped) {
        onCaptureStopped();
    }
}

bool ScreenCapturer::CaptureFrame(std::vector<uint8_t>& frameData, std::vector<DirtyRect>& dirtyRects) {
    std::lock_guard<std::mutex> lock(frameMutex_);
    
    if (currentFrame_.empty()) {
        return false;
    }
    
    frameData = currentFrame_;
    dirtyRects = dirtyRects_;
    
    return true;
}

void ScreenCapturer::GetScreenInfo(int& width, int& height, int& bitsPerPixel) {
    width = screenWidth_;
    height = screenHeight_;
    bitsPerPixel = 32; // DXGI typically uses 32 bits per pixel
}

void ScreenCapturer::SetFrameRate(int fps) {
    frameRate_ = std::max(1, std::min(fps, 120)); // Clamp between 1-120 FPS
}

void ScreenCapturer::CaptureThread() {
    auto lastFrameTime = std::chrono::high_resolution_clock::now();
    const auto frameDuration = std::chrono::microseconds(1000000 / frameRate_);
    
    stats_.totalFrames = 0;
    auto fpsStartTime = std::chrono::high_resolution_clock::now();
    uint64_t fpsFrameCount = 0;
    
    while (capturing_) {
        auto currentTime = std::chrono::high_resolution_clock::now();
        
        // Frame rate limiting
        if (currentTime - lastFrameTime < frameDuration) {
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
            continue;
        }
        
        if (ProcessFrame()) {
            stats_.totalFrames++;
            fpsFrameCount++;
            
            // Calculate FPS every second
            auto fpsDuration = std::chrono::duration_cast<std::chrono::seconds>(currentTime - fpsStartTime).count();
            if (fpsDuration >= 1) {
                stats_.fps = static_cast<double>(fpsFrameCount) / fpsDuration;
                fpsFrameCount = 0;
                fpsStartTime = currentTime;
            }
        }
        
        lastFrameTime = currentTime;
        
        // Small sleep to prevent excessive CPU usage
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
}

bool ScreenCapturer::InitializeDXGI() {
    HRESULT hr;
    
    // Create D3D11 device
    D3D_FEATURE_LEVEL featureLevel;
    hr = D3D11CreateDevice(
        nullptr,
        D3D_DRIVER_TYPE_HARDWARE,
        nullptr,
        0,
        nullptr,
        0,
        D3D11_SDK_VERSION,
        &d3dDevice_,
        &featureLevel,
        &d3dContext_
    );
    
    if (FAILED(hr) || !d3dDevice_) {
        if (onError) {
            onError("Failed to create D3D11 device");
        }
        return false;
    }
    
    // Get DXGI adapter
    IDXGIDevice* dxgiDevice = nullptr;
    hr = d3dDevice_->QueryInterface(__uuidof(IDXGIDevice), reinterpret_cast<void**>(&dxgiDevice));
    if (FAILED(hr)) {
        if (onError) {
            onError("Failed to get DXGI device");
        }
        return false;
    }
    
    IDXGIAdapter* dxgiAdapter = nullptr;
    hr = dxgiDevice->GetAdapter(&dxgiAdapter);
    dxgiDevice->Release();
    
    if (FAILED(hr)) {
        if (onError) {
            onError("Failed to get DXGI adapter");
        }
        return false;
    }
    
    // Get output (monitor)
    IDXGIOutput* dxgiOutput = nullptr;
    hr = dxgiAdapter->EnumOutputs(0, &dxgiOutput);
    dxgiAdapter->Release();
    
    if (FAILED(hr)) {
        if (onError) {
            onError("Failed to get DXGI output");
        }
        return false;
    }
    
    // Get output description to determine screen size
    DXGI_OUTPUT_DESC outputDesc;
    hr = dxgiOutput->GetDesc(&outputDesc);
    if (SUCCEEDED(hr)) {
        screenWidth_ = outputDesc.DesktopCoordinates.right - outputDesc.DesktopCoordinates.left;
        screenHeight_ = outputDesc.DesktopCoordinates.bottom - outputDesc.DesktopCoordinates.top;
    }
    
    // Get DXGI output1 for duplication
    IDXGIOutput1* dxgiOutput1 = nullptr;
    hr = dxgiOutput->QueryInterface(__uuidof(IDXGIOutput1), reinterpret_cast<void**>(&dxgiOutput1));
    dxgiOutput->Release();
    
    if (FAILED(hr)) {
        if (onError) {
            onError("Failed to get DXGI output1 interface");
        }
        return false;
    }
    
    // Create desktop duplication
    hr = dxgiOutput1->DuplicateOutput(d3dDevice_, &duplication_);
    dxgiOutput1->Release();
    
    if (FAILED(hr)) {
        if (onError) {
            onError("Failed to create desktop duplication. Make sure the application is running in a desktop session.");
        }
        return false;
    }
    
    // Initialize frame buffers
    const size_t frameSize = screenWidth_ * screenHeight_ * 4; // 4 bytes per pixel (RGBA)
    currentFrame_.resize(frameSize);
    previousFrame_.resize(frameSize);
    
    return true;
}

void ScreenCapturer::CleanupDXGI() {
    if (duplication_) {
        duplication_->Release();
        duplication_ = nullptr;
    }
    
    if (d3dContext_) {
        d3dContext_->Release();
        d3dContext_ = nullptr;
    }
    
    if (d3dDevice_) {
        d3dDevice_->Release();
        d3dDevice_ = nullptr;
    }
}

bool ScreenCapturer::ProcessFrame() {
    if (!duplication_) {
        return false;
    }
    
    HRESULT hr;
    IDXGIResource* desktopResource = nullptr;
    DXGI_OUTDUPL_FRAME_INFO frameInfo;
    
    // Acquire next frame
    hr = duplication_->AcquireNextFrame(50, &frameInfo, &desktopResource); // 50ms timeout
    
    if (hr == DXGI_ERROR_WAIT_TIMEOUT) {
        // No new frame available, this is normal
        return false;
    }
    
    if (FAILED(hr)) {
        if (hr == DXGI_ERROR_ACCESS_LOST) {
            // Desktop duplication interface is invalid, try to reinitialize
            CleanupDXGI();
            if (!InitializeDXGI()) {
                if (onError) {
                    onError("Failed to reinitialize DXGI after access lost");
                }
                return false;
            }
        }
        return false;
    }
    
    // Check if frame has updates
    if (frameInfo.LastPresentTime.QuadPart == 0) {
        desktopResource->Release();
        duplication_->ReleaseFrame();
        return false;
    }
    
    // Get texture interface
    ID3D11Texture2D* desktopTexture = nullptr;
    hr = desktopResource->QueryInterface(__uuidof(ID3D11Texture2D), reinterpret_cast<void**>(&desktopTexture));
    desktopResource->Release();
    
    if (FAILED(hr)) {
        duplication_->ReleaseFrame();
        return false;
    }
    
    // Create staging texture for CPU access
    D3D11_TEXTURE2D_DESC textureDesc;
    desktopTexture->GetDesc(&textureDesc);
    
    textureDesc.Usage = D3D11_USAGE_STAGING;
    textureDesc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
    textureDesc.BindFlags = 0;
    textureDesc.MiscFlags = 0;
    
    ID3D11Texture2D* stagingTexture = nullptr;
    hr = d3dDevice_->CreateTexture2D(&textureDesc, nullptr, &stagingTexture);
    
    if (FAILED(hr)) {
        desktopTexture->Release();
        duplication_->ReleaseFrame();
        return false;
    }
    
    // Copy desktop texture to staging texture
    d3dContext_->CopyResource(stagingTexture, desktopTexture);
    desktopTexture->Release();
    
    // Map staging texture for reading
    D3D11_MAPPED_SUBRESOURCE mappedResource;
    hr = d3dContext_->Map(stagingTexture, 0, D3D11_MAP_READ, 0, &mappedResource);
    
    if (FAILED(hr)) {
        stagingTexture->Release();
        duplication_->ReleaseFrame();
        return false;
    }
    
    // Copy frame data
    {
        std::lock_guard<std::mutex> lock(frameMutex_);
        
        // Store previous frame for dirty rect calculation
        previousFrame_ = currentFrame_;
        
        // Copy new frame data
        const uint8_t* sourceData = static_cast<const uint8_t*>(mappedResource.pData);
        const size_t frameSize = screenWidth_ * screenHeight_ * 4;
        
        if (mappedResource.RowPitch == screenWidth_ * 4) {
            // Direct copy if no padding
            std::copy(sourceData, sourceData + frameSize, currentFrame_.begin());
        } else {
            // Copy row by row if there's padding
            for (int y = 0; y < screenHeight_; ++y) {
                const uint8_t* srcRow = sourceData + y * mappedResource.RowPitch;
                uint8_t* dstRow = currentFrame_.data() + y * screenWidth_ * 4;
                std::copy(srcRow, srcRow + screenWidth_ * 4, dstRow);
            }
        }
        
        // Calculate dirty rectangles
        if (!previousFrame_.empty()) {
            dirtyRects_ = VncUtils::FindDirtyRects(currentFrame_, previousFrame_, screenWidth_, screenHeight_, 4);
            stats_.dirtyRegions = static_cast<int>(dirtyRects_.size());
        } else {
            // First frame - mark entire screen as dirty
            dirtyRects_.clear();
            dirtyRects_.emplace_back(0, 0, screenWidth_, screenHeight_);
            stats_.dirtyRegions = 1;
        }
    }
    
    // Cleanup
    d3dContext_->Unmap(stagingTexture, 0);
    stagingTexture->Release();
    duplication_->ReleaseFrame();
    
    return true;
}