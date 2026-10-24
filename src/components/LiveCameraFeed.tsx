import React, { useRef, useState, useEffect } from 'react';
import { Camera, CameraOff, RefreshCw, Radio, AlertCircle, Sparkles, X, CheckCircle2, FlipHorizontal } from 'lucide-react';
import { speechService } from '../services/speech';
import { cameraManager } from '../services/cameraManager';

interface LiveCameraFeedProps {
  onCapture: (dataUrl: string, file?: File) => void;
  onCloseCamera: () => void;
  isLoading: boolean;
}

export const LiveCameraFeed: React.FC<LiveCameraFeedProps> = ({
  onCapture,
  onCloseCamera,
  isLoading,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScan, setAutoScan] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('user');
  const [isMirrored, setIsMirrored] = useState<boolean>(true); // Defaults to true for laptop/front cameras
  const timerRef = useRef<any>(null);
  const cameraRequestIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    const reqId = ++cameraRequestIdRef.current;
    setError(null);

    try {
      const stream = await cameraManager.acquireSession('live-camera-feed', {
        facingMode: mode,
        idealWidth: 1280,
        idealHeight: 720,
      });

      if (!isMountedRef.current || cameraRequestIdRef.current !== reqId) {
        cameraManager.releaseSession('live-camera-feed', videoRef.current);
        return;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const isReady = await cameraManager.waitForVideoReady(videoRef.current);
        if (!isMountedRef.current || cameraRequestIdRef.current !== reqId) {
          cameraManager.releaseSession('live-camera-feed', videoRef.current);
          return;
        }
        if (isReady) {
          setCameraActive(true);
        }
      }
    } catch (err: any) {
      if (cameraRequestIdRef.current !== reqId) return;
      console.warn('Camera start error:', err);
      let msg = err?.message || 'Unable to access device camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission was denied. Please allow camera permissions in your browser address bar.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera device found on this system.';
      }
      setError(msg);
      setCameraActive(false);
    }
  };

  const stopCameraStream = () => {
    cameraRequestIdRef.current++;
    cameraManager.releaseSession('live-camera-feed', videoRef.current);
    setCameraActive(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    startCamera();
    return () => {
      isMountedRef.current = false;
      stopCameraStream();
    };
  }, []);

  const takeSnapshot = () => {
    if (!videoRef.current || !cameraActive) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // If mirrored (laptop webcam), flip horizontally so captured image matches real-world left/right
      if (isMirrored) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'live-camera-frame.jpg', { type: 'image/jpeg' });
          onCapture(dataUrl, file);
        } else {
          onCapture(dataUrl);
        }
      }, 'image/jpeg', 0.95);
    }
  };

  // Continuous auto-scan
  useEffect(() => {
    if (autoScan && cameraActive) {
      timerRef.current = setInterval(() => {
        takeSnapshot();
      }, 5000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoScan, cameraActive]);

  const toggleCameraFacing = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    setIsMirrored(next === 'user');
    startCamera(next);
  };

  const toggleMirrorMode = () => {
    const nextMirror = !isMirrored;
    setIsMirrored(nextMirror);
    speechService.speak(
      nextMirror
        ? 'Mirror mode enabled for laptop camera. Left and right are aligned.'
        : 'Mirror mode disabled. Standard camera orientation.'
    );
  };

  return (
    <div
      className="p-5 bg-white rounded-3xl border border-[#392743]/15 shadow-md space-y-4 mb-6"
      role="region"
      aria-label="Live Camera Assistance Viewfinder"
    >
      <div className="flex items-center justify-between pb-2 border-b border-[#392743]/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#7353B5] text-white flex items-center justify-center">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#392743]">
              Live Camera Assistance Feed
            </h3>
            <p className="text-[11px] text-[#392743]/60">
              Point your camera at doors, signs, or objects and click Capture
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cameraActive && (
            <>
              <button
                onClick={toggleMirrorMode}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                  isMirrored
                    ? 'bg-[#7353B5] text-white border-[#7353B5] shadow-sm'
                    : 'bg-[#FFF9F0] text-[#392743] border-[#392743]/15 hover:bg-[#EAE1D2]'
                }`}
                title="Mirror mode: inverts camera feed so your real right is right, and real left is left (ideal for laptop cameras)"
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                <span>{isMirrored ? 'Laptop Mirror: ON' : 'Mirror: OFF'}</span>
              </button>
              <button
                onClick={toggleCameraFacing}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#FFF9F0] text-[#392743] border border-[#392743]/15 hover:bg-[#EAE1D2] transition-colors cursor-pointer"
                title="Flip between front and rear cameras"
              >
                Flip Camera
              </button>
            </>
          )}

          <button
            onClick={() => {
              stopCameraStream();
              onCloseCamera();
            }}
            className="p-1.5 rounded-lg text-[#392743]/60 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            aria-label="Close live camera feed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-5 bg-[#FFE5D8] rounded-2xl text-xs text-[#9A3412] space-y-2 border border-orange-200">
          <div className="font-bold flex items-center gap-2 text-sm text-[#7C2D12]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Camera Device Status
          </div>
          <p className="leading-relaxed">{error}</p>
          <div className="pt-2 flex gap-2">
            <button
              onClick={() => startCamera()}
              className="px-3.5 py-1.5 rounded-xl bg-orange-700 text-white font-bold text-xs hover:bg-orange-800 transition-colors cursor-pointer"
            >
              Retry Camera
            </button>
            <button
              onClick={onCloseCamera}
              className="px-3.5 py-1.5 rounded-xl bg-white border border-orange-300 text-orange-950 font-semibold text-xs hover:bg-orange-100 transition-colors cursor-pointer"
            >
              Upload Photo Instead
            </button>
          </div>
        </div>
      ) : (
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-[460px] flex items-center justify-center shadow-inner">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
            className="w-full h-full object-cover transition-transform duration-200"
          />

          {/* Viewfinder crosshair */}
          <div className="absolute inset-0 pointer-events-none border-2 border-white/20 rounded-2xl m-4 flex items-center justify-center">
            <div className="w-16 h-16 border-2 border-[#FFE5D8]/60 rounded-xl" />
          </div>

          {autoScan && (
            <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-emerald-600/90 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-md animate-pulse">
              <Radio className="w-3.5 h-3.5" />
              <span>Auto-Scanning Scene...</span>
            </div>
          )}
        </div>
      )}

      {/* Camera Action Buttons */}
      {!error && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoScan(!autoScan)}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                autoScan
                  ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm animate-pulse'
                  : 'bg-[#FFF9F0] text-[#392743] border-[#392743]/15 hover:bg-[#EAE1D2]'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{autoScan ? 'Auto-Scan On (5s)' : 'Enable Continuous Auto-Scan'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={takeSnapshot}
              disabled={isLoading || !cameraActive}
              className="px-6 py-3 rounded-xl bg-[#7353B5] hover:bg-[#5E409B] disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 focus:ring-2 focus:ring-[#7353B5] cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Capture Frame & Analyze</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
