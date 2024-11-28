import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export class HandTracker {
  private hands: Hands;
  private camera: Camera | null = null;
  private videoElement: HTMLVideoElement;
  private onUpdateCallback: ((x: number, y: number, isGrabbing: boolean) => void) | null = null;
  private lastUpdateTime: number = 0;
  private readonly UPDATE_INTERVAL = 16;
  private smoothX: number = 0;
  private smoothY: number = 0;
  private smoothingFactor: number = 0.3;
  private grabThreshold: number = 0.15;
  private lastGrabState: boolean = false;
  private grabStateCount: number = 0;
  private readonly GRAB_FRAMES_THRESHOLD = 3;
  private isWasmLoaded: boolean = false;
  private active: boolean = false;

  constructor() {
    console.log('Initializing HandTracker...');
    this.videoElement = document.createElement('video');
    this.videoElement.style.display = 'none';
    document.body.appendChild(this.videoElement);

    this.hands = new Hands({
      locateFile: (file) => {
        console.log(`Loading MediaPipe file: ${file}`);
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    this.hands.onResults(this.onResults.bind(this));
  }

  public async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Wait for WASM to load
      this.hands.initialize().then(() => {
        this.isWasmLoaded = true;
        console.log('MediaPipe WASM loaded successfully');
        
        // Initialize camera after WASM is loaded
        this.camera = new Camera(this.videoElement, {
          onFrame: async () => {
            try {
              await this.hands.send({ image: this.videoElement });
            } catch (error) {
              console.error('Error processing hand tracking:', error);
            }
          },
          width: 1280,
          height: 720
        });
        
        resolve();
      }).catch(reject);
    });
  }

  public async start(): Promise<void> {
    if (!this.isWasmLoaded) {
      await this.initialize();
    }
    if (this.camera) {
      await this.camera.start();
      this.active = true;
      console.log('Camera started successfully');
    }
  }

  public stop() {
    this.camera?.stop();
    this.active = false;
  }

  public isActive(): boolean {
    return this.active;
  }

  public setUpdateCallback(callback: (x: number, y: number, isGrabbing: boolean) => void) {
    this.onUpdateCallback = callback;
  }

  private smoothValue(current: number, target: number): number {
    return current + (target - current) * this.smoothingFactor;
  }

  private detectGrabGesture(hand: any[]): boolean {
    const palm = hand[0];
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];

    const fingerHeights = [
      thumbTip.y - palm.y,
      indexTip.y - palm.y,
      middleTip.y - palm.y,
      ringTip.y - palm.y,
      pinkyTip.y - palm.y
    ];

    const isCurled = fingerHeights.filter(height => height < this.grabThreshold).length >= 3;

    if (isCurled !== this.lastGrabState) {
      this.grabStateCount = 0;
    } else {
      this.grabStateCount = Math.min(this.grabStateCount + 1, this.GRAB_FRAMES_THRESHOLD + 1);
    }

    this.lastGrabState = isCurled;
    return this.grabStateCount >= this.GRAB_FRAMES_THRESHOLD && isCurled;
  }

  private onResults(results: Results) {
    const currentTime = performance.now();
    if (currentTime - this.lastUpdateTime < this.UPDATE_INTERVAL) {
      return;
    }
    this.lastUpdateTime = currentTime;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const hand = results.multiHandLandmarks[0];
      
      const indexFinger = hand[8];
      
      const targetX = indexFinger.x * window.innerWidth;
      const targetY = indexFinger.y * window.innerHeight;

      this.smoothX = this.smoothValue(this.smoothX, targetX);
      this.smoothY = this.smoothValue(this.smoothY, targetY);

      const isGrabbing = this.detectGrabGesture(hand);

      this.onUpdateCallback?.(this.smoothX, this.smoothY, isGrabbing);
    }
  }
}
