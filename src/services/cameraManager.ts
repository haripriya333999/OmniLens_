/**
 * Central Camera Lifecycle & Session Manager for OmniLens
 * 
 * Guarantees:
 * 1. Single Camera Owner across the entire application.
 * 2. Complete track release on stop or feature switch (turns off hardware indicator).
 * 3. Asynchronous cancellation protection: late-resolving getUserMedia() promises are immediately stopped.
 * 4. Video readiness verification before frame capture.
 * 5. Clean snapshot capturing with aspect ratio preservation and optional mirroring.
 */

export type CameraLifecycleState =
  | 'idle'
  | 'starting'
  | 'active'
  | 'paused'
  | 'stopping'
  | 'error';

export interface CameraSessionInfo {
  ownerId: string | null;
  state: CameraLifecycleState;
  hasStream: boolean;
  error: string | null;
}

type CameraListener = (info: CameraSessionInfo) => void;

class CameraManager {
  private activeStream: MediaStream | null = null;
  private currentOwnerId: string | null = null;
  private state: CameraLifecycleState = 'idle';
  private currentRequestId: number = 0;
  private lastError: string | null = null;
  private listeners: Set<CameraListener> = new Set();

  public getSessionInfo(): CameraSessionInfo {
    return {
      ownerId: this.currentOwnerId,
      state: this.state,
      hasStream: this.activeStream !== null,
      error: this.lastError,
    };
  }

  public subscribe(listener: CameraListener): () => void {
    this.listeners.add(listener);
    listener(this.getSessionInfo());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const info = this.getSessionInfo();
    this.listeners.forEach((fn) => {
      try {
        fn(info);
      } catch (e) {
        console.error('CameraManager listener error:', e);
      }
    });
  }

  /**
   * Acquire camera session exclusively for a specific component (e.g. 'safepath', 'live-detection')
   * If another component currently owns the camera, releases the previous session first.
   */
  public async acquireSession(
    ownerId: string,
    options: {
      facingMode?: 'user' | 'environment';
      idealWidth?: number;
      idealHeight?: number;
    } = {}
  ): Promise<MediaStream> {
    const reqId = ++this.currentRequestId;
    this.lastError = null;

    // Release any existing stream
    this.stopActiveStreamDirectly();

    this.currentOwnerId = ownerId;
    this.state = 'starting';
    this.notify();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = new Error('Camera access is not supported by your browser.');
      this.state = 'error';
      this.lastError = err.message;
      this.notify();
      throw err;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: options.facingMode || 'user',
          width: { ideal: options.idealWidth || 1280 },
          height: { ideal: options.idealHeight || 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Guard: if cancelled, invalidated, or owner changed while awaiting user permission
      if (this.currentRequestId !== reqId || this.currentOwnerId !== ownerId) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (e) {}
        });
        throw new Error('Camera request was cancelled or superseded.');
      }

      this.activeStream = stream;
      this.state = 'active';
      this.notify();
      return stream;
    } catch (err: any) {
      if (this.currentRequestId === reqId) {
        this.state = 'error';
        let msg = err?.message || 'Unable to access device camera.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          msg = 'Camera permission was denied in your browser settings.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          msg = 'No camera hardware found on this device.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          msg = 'Camera is already in use by another application or tab.';
        }
        this.lastError = msg;
        this.notify();
      }
      throw err;
    }
  }

  /**
   * Release camera session owned by a specific component.
   * Disposes all tracks, detaches video elements, and resets state.
   */
  public releaseSession(ownerId: string, videoElement?: HTMLVideoElement | null) {
    if (this.currentOwnerId === ownerId || !this.currentOwnerId) {
      this.currentRequestId++;
      this.state = 'stopping';
      this.notify();

      this.stopActiveStreamDirectly();

      if (videoElement) {
        try {
          if (videoElement.srcObject) {
            const s = videoElement.srcObject as MediaStream;
            s.getTracks().forEach((t) => t.stop());
            videoElement.srcObject = null;
          }
          videoElement.pause();
        } catch (e) {}
      }

      this.currentOwnerId = null;
      this.state = 'idle';
      this.notify();
    }
  }

  /**
   * Force release all camera resources application-wide.
   */
  public releaseAll(videoElement?: HTMLVideoElement | null) {
    this.currentRequestId++;
    this.state = 'stopping';
    this.notify();

    this.stopActiveStreamDirectly();

    if (videoElement) {
      try {
        if (videoElement.srcObject) {
          const s = videoElement.srcObject as MediaStream;
          s.getTracks().forEach((t) => t.stop());
          videoElement.srcObject = null;
        }
        videoElement.pause();
      } catch (e) {}
    }

    this.currentOwnerId = null;
    this.state = 'idle';
    this.notify();
  }

  private stopActiveStreamDirectly() {
    if (this.activeStream) {
      this.activeStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      this.activeStream = null;
    }
  }

  /**
   * Wait for a video element attached to a stream to become playable and ready with real dimensions.
   */
  public async waitForVideoReady(
    video: HTMLVideoElement,
    timeoutMs: number = 4000
  ): Promise<boolean> {
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      try {
        await video.play();
      } catch (e) {}
      return true;
    }

    return new Promise((resolve) => {
      let isResolved = false;

      const finish = (ok: boolean) => {
        if (!isResolved) {
          isResolved = true;
          video.removeEventListener('loadeddata', onReady);
          video.removeEventListener('playing', onReady);
          video.removeEventListener('error', onError);
          clearTimeout(timer);
          resolve(ok);
        }
      };

      const onReady = () => {
        video.play().catch(() => {});
        finish(true);
      };

      const onError = () => {
        finish(false);
      };

      const timer = setTimeout(() => {
        // Even if timeout, check if readyState has advanced
        finish(video.readyState >= 2);
      }, timeoutMs);

      video.addEventListener('loadeddata', onReady, { once: true });
      video.addEventListener('playing', onReady, { once: true });
      video.addEventListener('error', onError, { once: true });

      video.play().catch(() => {});
    });
  }

  /**
   * Captures a fresh, current frame from a live video element.
   * Honors aspect ratio, optional left/right mirroring for webcam, and compresses to high-quality JPEG.
   */
  public captureFrame(
    video: HTMLVideoElement | null,
    options: { mirror?: boolean; quality?: number; maxWidth?: number; maxHeight?: number } = {}
  ): Promise<{ blob: Blob; dataUrl: string; width: number; height: number } | null> {
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      try {
        const origW = video.videoWidth;
        const origH = video.videoHeight;
        const maxW = options.maxWidth || 1280;
        const maxH = options.maxHeight || 720;

        let targetW = origW;
        let targetH = origH;
        if (targetW > maxW || targetH > maxH) {
          const ratio = Math.min(maxW / targetW, maxH / targetH);
          targetW = Math.round(targetW * ratio);
          targetH = Math.round(targetH * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }

        if (options.mirror) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }

        ctx.drawImage(video, 0, 0, targetW, targetH);

        const quality = options.quality ?? 0.85;
        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({
                blob,
                dataUrl,
                width: targetW,
                height: targetH,
              });
            } else {
              resolve(null);
            }
          },
          'image/jpeg',
          quality
        );
      } catch (err) {
        console.error('Frame capture error:', err);
        resolve(null);
      }
    });
  }
}

export const cameraManager = new CameraManager();
