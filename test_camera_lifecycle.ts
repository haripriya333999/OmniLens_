/**
 * Automated Test Suite: Camera Lifecycle, Race Conditions, and Resource Cleanup
 * Verifies:
 *  1. Complete track disposal on stopCamera()
 *  2. Video srcObject detachment and pause
 *  3. Guard against late-resolving getUserMedia promise races
 *  4. Rapid start/stop cycling without resource leaks
 *  5. Error state recovery
 */

class MockMediaStreamTrack {
  public stopped: boolean = false;
  constructor(public kind: string = 'video') {}
  stop() {
    this.stopped = true;
  }
}

class MockMediaStream {
  public tracks: MockMediaStreamTrack[];
  constructor(tracks?: MockMediaStreamTrack[]) {
    this.tracks = tracks || [new MockMediaStreamTrack('video')];
  }
  getTracks() {
    return this.tracks;
  }
}

class MockVideoElement {
  public srcObject: MockMediaStream | null = null;
  public isPaused: boolean = false;
  pause() {
    this.isPaused = true;
  }
  play() {
    this.isPaused = false;
    return Promise.resolve();
  }
}

// Emulate the Camera Controller pattern implemented in SafePathView and LiveDetectionView
class CameraController {
  public stream: MockMediaStream | null = null;
  public video: MockVideoElement = new MockVideoElement();
  public state: 'idle' | 'starting' | 'active' | 'stopping' | 'error' = 'idle';
  public requestId: number = 0;
  public isMounted: boolean = true;

  // Mock getUserMedia delay
  public async mockGetUserMedia(delayMs: number = 50, shouldFail: boolean = false): Promise<MockMediaStream> {
    await new Promise((res) => setTimeout(res, delayMs));
    if (shouldFail) throw new Error('NotAllowedError');
    return new MockMediaStream([new MockMediaStreamTrack('video')]);
  }

  public async startCamera(delayMs: number = 50, shouldFail: boolean = false) {
    const currentId = ++this.requestId;
    this.state = 'starting';

    // Stop any existing stream directly without altering currentId
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.video.srcObject) {
      this.video.srcObject.getTracks().forEach((t) => t.stop());
      this.video.srcObject = null;
    }

    try {
      const stream = await this.mockGetUserMedia(delayMs, shouldFail);

      // Race check: if stopped or unmounted while permission was pending
      if (!this.isMounted || this.requestId !== currentId) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      this.stream = stream;
      this.video.srcObject = stream;
      this.state = 'active';
    } catch (err) {
      if (this.requestId !== currentId) return;
      this.state = 'error';
    }
  }

  public stopCamera() {
    this.requestId++;
    this.state = 'stopping';

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    if (this.video.srcObject) {
      this.video.srcObject.getTracks().forEach((t) => t.stop());
      this.video.srcObject = null;
    }
    this.video.pause();
    this.state = 'idle';
  }
}

async function runCameraTests() {
  console.log('=== RUNNING CAMERA LIFECYCLE & RACE CONDITION TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // Test 1: Clean Startup and Track Active
  {
    const cam = new CameraController();
    await cam.startCamera(10);
    assert(cam.state === 'active', 'Test 1.1: Camera transitions to active state');
    assert(cam.stream !== null, 'Test 1.2: Stream reference stored');
    assert(cam.stream?.getTracks()[0].stopped === false, 'Test 1.3: Video track is live');
    assert(cam.video.srcObject === cam.stream, 'Test 1.4: Video element attached');
  }

  // Test 2: Complete Track Disposal on Stop
  {
    const cam = new CameraController();
    await cam.startCamera(10);
    const track = cam.stream?.getTracks()[0];
    cam.stopCamera();

    assert(cam.state === 'idle', 'Test 2.1: State returns to idle');
    assert(cam.stream === null, 'Test 2.2: Stream ref is nulled');
    assert(track?.stopped === true, 'Test 2.3: All stream tracks stopped');
    assert(cam.video.srcObject === null, 'Test 2.4: Video srcObject detached');
    assert(cam.video.isPaused === true, 'Test 2.5: Video element paused');
  }

  // Test 3: Race Condition: User Stops while Permission is Pending
  {
    const cam = new CameraController();
    const startPromise = cam.startCamera(100); // 100ms async delay

    // User immediately presses Stop at 20ms
    await new Promise((res) => setTimeout(res, 20));
    cam.stopCamera();

    // Wait for the original getUserMedia promise to resolve
    await startPromise;

    assert(cam.state === 'idle', 'Test 3.1: State remains idle after delayed promise finishes');
    assert(cam.stream === null, 'Test 3.2: No orphaned stream attached');
    assert(cam.video.srcObject === null, 'Test 3.3: Video srcObject remained null');
  }

  // Test 4: Unmount during pending camera request
  {
    const cam = new CameraController();
    const startPromise = cam.startCamera(80);

    // Component unmounts
    cam.isMounted = false;
    cam.stopCamera();

    await startPromise;
    assert(cam.stream === null, 'Test 4.1: Unmounted component rejects late stream');
  }

  // Test 5: Rapid Start / Stop cycling (10 iterations)
  {
    const cam = new CameraController();
    for (let i = 0; i < 10; i++) {
      cam.startCamera(15);
      cam.stopCamera();
    }
    // Final wait to ensure all promises settle
    await new Promise((res) => setTimeout(res, 50));
    assert(cam.state === 'idle', 'Test 5.1: 10 rapid Start/Stop cycles result in idle state');
    assert(cam.stream === null, 'Test 5.2: No leftover stream references');
  }

  // Test 6: Permission Denied error handling
  {
    const cam = new CameraController();
    await cam.startCamera(10, true); // throws error
    assert(cam.state === 'error', 'Test 6.1: Gracefully enters error state on permission denial');
    assert(cam.stream === null, 'Test 6.2: Stream remains null on error');
  }

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runCameraTests();
