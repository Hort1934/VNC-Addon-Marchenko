{
  "targets": [
    {
      "target_name": "vnc_addon",
      "sources": [
        "native/addon.cpp",
        "native/vnc_server.cpp",
        "native/screen_capturer.cpp",
        "native/websocket_server.cpp",
        "native/vnc_protocol.cpp",
        "native/virtual_desktop.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "native"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "WIN32_LEAN_AND_MEAN",
        "NOMINMAX"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": ["/std:c++17"]
        }
      },
      "conditions": [
        ["OS=='win'", {
          "libraries": [
            "-ld3d11.lib",
            "-ldxgi.lib",
            "-luser32.lib",
            "-lgdi32.lib",
            "-lws2_32.lib",
            "-lwsock32.lib",
            "-ladvapi32.lib",
            "-lkernel32.lib"
          ],
          "defines": [
            "_WIN32_WINNT=0x0A00"
          ]
        }]
      ]
    }
  ]
}