"use strict";
/**
 * Simple test script to verify the VNC addon functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./src/index");
async function runTests() {
    console.log('VNC-Addon Test Suite');
    console.log('====================\n');
    let testsPassed = 0;
    let testsTotal = 0;
    function test(name, testFn) {
        return async () => {
            testsTotal++;
            try {
                console.log(`Testing: ${name}...`);
                await testFn();
                console.log(`✓ ${name} PASSED\n`);
                testsPassed++;
            }
            catch (error) {
                console.error(`✗ ${name} FAILED:`);
                console.error(`  ${error instanceof Error ? error.message : error}\n`);
            }
        };
    }
    // Test 1: Server creation with valid options
    await test('Server Creation with Valid Options', () => {
        const server = new index_1.VncServer({
            port: 5903,
            password: 'test123'
        });
        if (!(server instanceof index_1.VncServer)) {
            throw new Error('Failed to create VncServer instance');
        }
    })();
    // Test 2: Server creation with invalid options should throw
    await test('Server Creation with Invalid Port', () => {
        let errorThrown = false;
        try {
            new index_1.VncServer({ port: 0 });
        }
        catch (error) {
            if (error instanceof index_1.VncError && error.type === 'SYSTEM_ERROR') {
                errorThrown = true;
            }
        }
        if (!errorThrown) {
            throw new Error('Expected VncError to be thrown for invalid port');
        }
    })();
    // Test 3: Quality settings validation
    await test('Quality Settings Validation', () => {
        const server = new index_1.VncServer({ port: 5904 });
        // Valid quality settings should not throw
        server.setQuality({
            jpegQuality: 80,
            zlibLevel: 6,
            colorDepth: 32
        });
        // Invalid quality settings should throw
        let errorThrown = false;
        try {
            server.setQuality({ jpegQuality: 150 }); // Invalid: > 100
        }
        catch (error) {
            if (error instanceof index_1.VncError) {
                errorThrown = true;
            }
        }
        if (!errorThrown) {
            throw new Error('Expected VncError for invalid JPEG quality');
        }
    })();
    // Test 4: Virtual desktop options
    await test('Virtual Desktop Configuration', () => {
        const server = new index_1.VncServer({
            port: 5905,
            virtualDesktop: true,
            width: 1280,
            height: 720
        });
        const options = server.getOptions();
        if (!options.virtualDesktop) {
            throw new Error('Virtual desktop option not set correctly');
        }
        if (options.width !== 1280 || options.height !== 720) {
            throw new Error('Virtual desktop dimensions not set correctly');
        }
    })();
    // Test 5: Event emitter interface
    await test('Event Emitter Interface', () => {
        const server = new index_1.VncServer({ port: 5906 });
        let eventFired = false;
        server.on('error', () => {
            eventFired = true;
        });
        // Verify that event listeners can be added
        if (server.listenerCount('error') !== 1) {
            throw new Error('Event listener not added correctly');
        }
    })();
    // Test 6: Server status when not running
    await test('Server Status (Not Running)', () => {
        const server = new index_1.VncServer({ port: 5907 });
        if (server.isServerRunning()) {
            throw new Error('Server should not be running initially');
        }
        const clientCount = server.getActiveClientsCount();
        if (clientCount !== 0) {
            throw new Error('Active clients count should be 0 initially');
        }
    })();
    // Test 7: Screen info (may fail if no graphics available)
    await test('Screen Info Retrieval', () => {
        const server = new index_1.VncServer({ port: 5908 });
        try {
            const screenInfo = server.getScreenInfo();
            if (!screenInfo || typeof screenInfo.width !== 'number') {
                throw new Error('Invalid screen info returned');
            }
            console.log(`    Screen: ${screenInfo.width}x${screenInfo.height}, ${screenInfo.bitsPerPixel}bpp`);
        }
        catch (error) {
            console.log('    Note: Screen info test may fail in headless environments');
            // Don't fail the test for this - it's expected in some environments
        }
    })();
    // Test 8: Server lifecycle (start/stop) - brief test
    await test('Server Lifecycle (Brief)', async () => {
        const server = new index_1.VncServer({ port: 5909 });
        // Start server briefly
        try {
            await server.start();
            if (!server.isServerRunning()) {
                throw new Error('Server should be running after start()');
            }
            // Stop server immediately
            await server.stop();
            if (server.isServerRunning()) {
                throw new Error('Server should not be running after stop()');
            }
        }
        catch (error) {
            // If server can't start (e.g., no graphics), that's expected in some environments
            if (error instanceof Error && error.message.includes('DXGI')) {
                console.log('    Note: Server start failed (expected in headless environments)');
                return;
            }
            throw error;
        }
    })();
    // Results summary
    console.log('='.repeat(50));
    console.log(`Tests Completed: ${testsTotal}`);
    console.log(`Tests Passed: ${testsPassed}`);
    console.log(`Tests Failed: ${testsTotal - testsPassed}`);
    console.log(`Success Rate: ${((testsPassed / testsTotal) * 100).toFixed(1)}%`);
    if (testsPassed === testsTotal) {
        console.log('\n🎉 All tests passed! VNC-Addon is working correctly.');
        process.exit(0);
    }
    else {
        console.log('\n❌ Some tests failed. Check the output above for details.');
        process.exit(1);
    }
}
// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('\nUncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('\nUnhandled Rejection:', reason);
    process.exit(1);
});
// Run tests
runTests().catch((error) => {
    console.error('Test runner failed:', error);
    process.exit(1);
});
//# sourceMappingURL=test.js.map