"use strict";
/**
 * Mock test suite - tests TypeScript API without native dependencies
 */
Object.defineProperty(exports, "__esModule", { value: true });
const mock_1 = require("./src/mock");
const types_1 = require("./src/types");
async function runMockTests() {
    console.log('🎭 VNC-Addon Mock Test Suite');
    console.log('=============================\n');
    console.log('ℹ️  Testing TypeScript API without native dependencies');
    console.log();
    let testsPassed = 0;
    let testsTotal = 0;
    function test(name, testFn) {
        return async () => {
            testsTotal++;
            try {
                console.log(`🧪 Testing: ${name}...`);
                await testFn();
                console.log(`✅ ${name} PASSED\n`);
                testsPassed++;
            }
            catch (error) {
                console.error(`❌ ${name} FAILED:`);
                console.error(`   ${error instanceof Error ? error.message : error}\n`);
            }
        };
    }
    // Test 1: Mock server creation
    await test('Mock Server Creation with Valid Options', () => {
        const server = new mock_1.MockVncServer({
            port: 5903,
            password: 'test123'
        });
        if (!(server instanceof mock_1.MockVncServer)) {
            throw new Error('Failed to create MockVncServer instance');
        }
    })();
    // Test 2: Server creation with invalid options should throw
    await test('Mock Server Creation with Invalid Port', () => {
        let errorThrown = false;
        try {
            new mock_1.MockVncServer({ port: 0 });
        }
        catch (error) {
            if (error instanceof types_1.VncError && error.type === 'SYSTEM_ERROR') {
                errorThrown = true;
            }
        }
        if (!errorThrown) {
            throw new Error('Expected VncError to be thrown for invalid port');
        }
    })();
    // Test 3: Quality settings validation
    await test('Mock Quality Settings Validation', () => {
        const server = new mock_1.MockVncServer({ port: 5904 });
        // Valid quality settings should not throw
        server.setQuality({
            jpegQuality: 80,
            zlibLevel: 6,
            colorDepth: 32
        });
        // Invalid quality settings should throw
        let errorThrown = false;
        try {
            server.setQuality({ jpegQuality: 150 });
        }
        catch (error) {
            if (error instanceof types_1.VncError) {
                errorThrown = true;
            }
        }
        if (!errorThrown) {
            throw new Error('Expected VncError for invalid JPEG quality');
        }
    })();
    // Test 4: Virtual desktop options
    await test('Mock Virtual Desktop Configuration', () => {
        const server = new mock_1.MockVncServer({
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
    await test('Mock Event Emitter Interface', () => {
        const server = new mock_1.MockVncServer({ port: 5906 });
        let eventFired = false;
        server.on('error', () => {
            eventFired = true;
        });
        if (server.listenerCount('error') !== 1) {
            throw new Error('Event listener not added correctly');
        }
    })();
    // Test 6: Server lifecycle (start/stop)
    await test('Mock Server Lifecycle', async () => {
        const server = new mock_1.MockVncServer({ port: 5907 });
        if (server.isServerRunning()) {
            throw new Error('Server should not be running initially');
        }
        await server.start();
        if (!server.isServerRunning()) {
            throw new Error('Server should be running after start()');
        }
        await server.stop();
        if (server.isServerRunning()) {
            throw new Error('Server should not be running after stop()');
        }
    })();
    // Test 7: Client simulation
    await test('Mock Client Simulation', () => {
        const server = new mock_1.MockVncServer({ port: 5908 });
        const initialCount = server.getActiveClientsCount();
        if (initialCount !== 0) {
            throw new Error('Initial client count should be 0');
        }
        server.simulateClientConnection();
        if (server.getActiveClientsCount() !== 1) {
            throw new Error('Client count should be 1 after connection');
        }
        server.simulateClientDisconnection();
        if (server.getActiveClientsCount() !== 0) {
            throw new Error('Client count should be 0 after disconnection');
        }
    })();
    // Test 8: Status information
    await test('Mock Server Status', async () => {
        const server = new mock_1.MockVncServer({ port: 5909 });
        const initialStatus = server.getServerStatus();
        if (initialStatus.isRunning) {
            throw new Error('Server should not be running initially');
        }
        await server.start();
        const runningStatus = server.getServerStatus();
        if (!runningStatus.isRunning) {
            throw new Error('Server should be running after start');
        }
        server.simulateClientConnection();
        const activeStatus = server.getServerStatus();
        if (!activeStatus.isCaptureActive) {
            throw new Error('Capture should be active with clients connected');
        }
        await server.stop();
    })();
    // Test 9: Screen info
    await test('Mock Screen Info', () => {
        const server = new mock_1.MockVncServer({ port: 5910 });
        const screenInfo = server.getScreenInfo();
        if (typeof screenInfo.width !== 'number' || screenInfo.width <= 0) {
            throw new Error('Invalid screen width');
        }
        if (typeof screenInfo.height !== 'number' || screenInfo.height <= 0) {
            throw new Error('Invalid screen height');
        }
    })();
    // Test 10: Event flow simulation
    await test('Mock Event Flow', (done) => {
        return new Promise((resolve, reject) => {
            const server = new mock_1.MockVncServer({ port: 5911 });
            let eventsReceived = [];
            server.on('client-connected', () => {
                eventsReceived.push('client-connected');
            });
            server.on('capture-started', () => {
                eventsReceived.push('capture-started');
            });
            server.on('quality-changed', () => {
                eventsReceived.push('quality-changed');
                // Check events after a short delay
                setTimeout(() => {
                    if (eventsReceived.includes('client-connected') &&
                        eventsReceived.includes('capture-started')) {
                        resolve();
                    }
                    else {
                        reject(new Error(`Expected events not received. Got: ${eventsReceived.join(', ')}`));
                    }
                }, 100);
            });
            // Simulate events
            server.simulateClientConnection();
            server.setQuality({ jpegQuality: 90 });
            // Timeout
            setTimeout(() => reject(new Error('Test timeout')), 2000);
        });
    })();
    // Results summary
    console.log('='.repeat(50));
    console.log(`🎭 Mock Tests Completed: ${testsTotal}`);
    console.log(`✅ Mock Tests Passed: ${testsPassed}`);
    console.log(`❌ Mock Tests Failed: ${testsTotal - testsPassed}`);
    console.log(`📊 Success Rate: ${((testsPassed / testsTotal) * 100).toFixed(1)}%`);
    if (testsPassed === testsTotal) {
        console.log('\n🎉 All mock tests passed! TypeScript API is working correctly.');
        console.log('');
        console.log('📋 Next Steps:');
        console.log('1. Install Visual Studio Build Tools (see BUILD_SETUP.md)');
        console.log('2. Run: npm install  (to build native addon)');
        console.log('3. Run: npm run example  (to test real VNC server)');
        console.log('');
        process.exit(0);
    }
    else {
        console.log('\n❌ Some mock tests failed. Check the output above for details.');
        process.exit(1);
    }
}
// Run mock tests
runMockTests().catch((error) => {
    console.error('Mock test runner failed:', error);
    process.exit(1);
});
//# sourceMappingURL=mock-test.js.map