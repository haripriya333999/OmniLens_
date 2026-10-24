import React, { useState, useRef, useEffect } from 'react';
import {
  Activity,
  Play,
  Pause,
  Square,
  Volume2,
  RefreshCw,
  Camera,
  CameraOff,
  AlertCircle,
  Clock,
  Sparkles,
  FlipHorizontal,
  Sliders,
} from 'lucide-react';
import { ActiveTask, Detection } from '../types';
import { speechService } from '../services/speech';
import { apiService } from '../services/apiService';
import { cameraManager } from '../services/cameraManager';

interface LiveDetectionViewProps {
  highContrast?: boolean;
  onSwitchTask?: (task: ActiveTask) => void;
}

interface AnnouncementItem {
  id: string;
  time: string;
  text: string;
  type: 'detection' | 'guidance' | 'system';
}

export const LiveDetectionView: React.FC<LiveDetectionViewProps> = ({
  highContrast = false,
  onSwitchTask,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [intervalSec, setIntervalSec] = useState<number>(3);
  const [duplicateSuppression, setDuplicateSuppression] = useState<boolean>(true);
  const [invertLeftRight, setInvertLeftRight] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('omnilens_accessibility');
      if (saved) {
        try {
          return JSON.parse(saved).invertLeftRight || false;
        } catch (e) {}
      }
    }
    return true; // Default to true for laptop webcam
  });

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [latestAnnouncement, setLatestAnnouncement] = useState<string>('Live detection ready. Press Start Camera & Stream.');
  const [detections, setDetections] = useState<Detection[]>([]);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active' | 'stopping' | 'error'>('idle');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalTimerRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);
  const cameraRequestIdRef = useRef<number>(0);

  // Start live webcam stream with cameraManager race condition protection
  const startCamera = async () => {
    const reqId = ++cameraRequestIdRef.current;
    setError(null);
    setCameraState('starting');

    try {
      const stream = await cameraManager.acquireSession('live-detection', {
        facingMode: 'user',
        idealWidth: 1280,
        idealHeight: 720,
      });

      // Guard: if user stopped or switched while permission prompt was pending
      if (!isMountedRef.current || cameraRequestIdRef.current !== reqId) {
        cameraManager.releaseSession('live-detection', videoRef.current);
        return;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const isReady = await cameraManager.waitForVideoReady(videoRef.current);
        if (!isMountedRef.current || cameraRequestIdRef.current !== reqId) {
          cameraManager.releaseSession('live-detection', videoRef.current);
          return;
        }

        if (isReady) {
          setCameraActive(true);
          setCameraState('active');
        } else {
          throw new Error('Camera stream could not initialize video playback.');
        }
      }
    } catch (err: any) {
      if (cameraRequestIdRef.current !== reqId) return;
      console.warn('Live camera error:', err);
      let msg = err?.message || 'Unable to access device camera.';
      if (err.name === 'NotAllowedError') {
        msg = 'Camera permission denied. Please allow camera access in browser address bar.';
      }
      setError(msg);
      setCameraActive(false);
      setCameraState('error');
      speechService.speak(msg, 'interrupt');
    }
  };

  const stopCameraStream = () => {
    cameraRequestIdRef.current++;
    setCameraState('stopping');
    cameraManager.releaseSession('live-detection', videoRef.current);
    setCameraActive(false);
    setCameraState('idle');
    setDetections([]);
  };

  // DO NOT auto-start camera on mount. Clean up resources when unmounted.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cameraManager.releaseSession('live-detection', videoRef.current);
      if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
      speechService.stop();
    };
  }, []);

  // Process a live frame using cameraManager
  const processLiveFrame = async () => {
    if (!videoRef.current || !cameraActive || isProcessing || !isRunning) return;

    try {
      setIsProcessing(true);
      const video = videoRef.current;
      const capture = await cameraManager.captureFrame(video, {
        mirror: invertLeftRight,
        quality: 0.85,
      });

      if (!capture || !isMountedRef.current) return;

      const img = new Image();
      img.src = capture.dataUrl;
      await new Promise((res) => {
        img.onload = res;
      });

      const res = await apiService.describeSurroundings(img, undefined, 0.25, invertLeftRight);
      if (!isMountedRef.current) return;

      if (res && res.detections) {
        setDetections(res.detections);

        // Generate concise spoken alert for blind users
        let spokenText = '';
        if (res.navigation_guidance) {
          spokenText = res.navigation_guidance;
        } else if (res.detections.length > 0) {
          const top = res.detections.slice(0, 3).map((d) => {
            const side = d.sideDirection || `${d.position} side`;
            return `${d.label} ${side}`;
          });
          spokenText = `Visible: ${top.join(', ')}.`;
        }

        if (spokenText) {
          setLatestAnnouncement(spokenText);
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setAnnouncements((prev) => [
            {
              id: Date.now().toString(),
              time: timeStr,
              text: spokenText,
              type: 'detection',
            },
            ...prev.slice(0, 15),
          ]);

          if (duplicateSuppression) {
            speechService.speakLiveAlert(spokenText, 8000);
          } else {
            speechService.speak(spokenText, 'interrupt');
          }
        }
      }
    } catch (err) {
      console.warn('Live frame process notice:', err);
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  };

  // Live timer interval
  useEffect(() => {
    if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);

    if (isRunning && cameraActive) {
      intervalTimerRef.current = setInterval(() => {
        processLiveFrame();
      }, intervalSec * 1000);
    }

    return () => {
      if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
    };
  }, [isRunning, cameraActive, intervalSec, duplicateSuppression, invertLeftRight]);

  const handlePauseStream = () => {
    setIsRunning(false);
    speechService.stop();
    speechService.speak('Live detection paused. Camera remains on standby.');
  };

  const handleResumeStream = async () => {
    if (!cameraActive) {
      await startCamera();
    }
    setIsRunning(true);
    speechService.speak('Live detection started. Monitoring continuous view.', 'interrupt');
    setTimeout(() => {
      if (isMountedRef.current) processLiveFrame();
    }, 400);
  };

  const handleStopCamera = () => {
    setIsRunning(false);
    stopCameraStream();
    speechService.stop();
    speechService.speak('Camera turned off. Live stream stopped.');
  };

  const handleStopSpeaking = () => {
    speechService.stop();
  };

  const handleRepeatLast = () => {
    speechService.speak(latestAnnouncement, 'interrupt');
  };

  return (
    <div className="space-y-6">
      {/* Top Status & Controls Header */}
      <div className="p-6 rounded-3xl bg-white border border-[#101828]/10 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full ${
                isRunning
                  ? 'bg-[#087F73] animate-pulse'
                  : cameraActive
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
            />
            <h2 className="text-xl font-bold text-[#101828]">
              4. Live Detection Stream
            </h2>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                isRunning
                  ? 'bg-[#087F73]/10 text-[#087F73]'
                  : cameraActive
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {isRunning ? 'Continuous Monitoring' : cameraActive ? 'Paused (Camera Standby)' : 'Camera Off'}
            </span>
          </div>
          <p className="text-xs text-[#101828]/70">
            Monitors camera every {intervalSec}s with duplicate suppression to prevent repetitive audio.
          </p>
        </div>

        {/* Primary Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isRunning ? (
            <>
              <button
                onClick={handlePauseStream}
                className="py-2.5 px-4 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm bg-[#A65312] hover:bg-[#8e450e] text-white"
                aria-label="Pause Live Detection and keep camera on standby"
              >
                <Pause className="w-4 h-4" />
                <span>Pause (Standby)</span>
              </button>
              <button
                onClick={handleStopCamera}
                className="py-2.5 px-4 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm bg-rose-600 hover:bg-rose-700 text-white"
                aria-label="Stop camera and turn off hardware"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Camera</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleResumeStream}
                className="py-2.5 px-4 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm bg-[#087F73] hover:bg-[#06675d] text-white"
                aria-label="Resume Live Detection"
              >
                <Play className="w-4 h-4" />
                <span>{cameraActive ? 'Resume Stream' : 'Start Camera & Stream'}</span>
              </button>
              {cameraActive && (
                <button
                  onClick={handleStopCamera}
                  className="py-2.5 px-3.5 rounded-xl bg-white border border-[#101828]/15 hover:bg-rose-50 text-rose-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  aria-label="Stop camera and release hardware"
                >
                  <CameraOff className="w-3.5 h-3.5 text-rose-600" />
                  <span>Turn Off Camera</span>
                </button>
              )}
            </>
          )}

          <button
            onClick={handleStopSpeaking}
            className="py-2.5 px-4 rounded-xl bg-[#B42318] hover:bg-[#971b12] text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm"
            aria-label="Stop Speaking immediately"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Stop Speaking</span>
          </button>

          <button
            onClick={handleRepeatLast}
            className="py-2.5 px-3.5 rounded-xl bg-[#F8FAFC] border border-[#101828]/15 hover:bg-[#101828]/5 text-[#101828] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            aria-label="Repeat last spoken announcement"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#6845C2]" />
            <span>Repeat</span>
          </button>
        </div>
      </div>

      {/* Main Viewport Grid: Camera on Left, Spoken Announcements on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Camera Feed Area */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-4 rounded-3xl bg-white border border-[#101828]/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-semibold text-[#101828] flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#6845C2]" />
                Live Camera Input
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setInvertLeftRight(!invertLeftRight)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                    invertLeftRight
                      ? 'bg-[#6845C2]/10 border-[#6845C2] text-[#6845C2]'
                      : 'bg-[#F8FAFC] border-gray-300 text-gray-700'
                  }`}
                  aria-label="Toggle camera left/right mirror inversion"
                >
                  <FlipHorizontal className="w-3 h-3" />
                  <span>Mirror: {invertLeftRight ? 'On (Webcam)' : 'Off'}</span>
                </button>
              </div>
            </div>

            {/* Video Preview Element */}
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-[#101828]/15">
              {error ? (
                <div className="p-6 text-center text-white space-y-2 max-w-sm">
                  <AlertCircle className="w-8 h-8 text-[#B42318] mx-auto" />
                  <p className="text-xs font-semibold">{error}</p>
                  <button
                    onClick={startCamera}
                    className="mt-2 py-2 px-4 rounded-xl bg-[#6845C2] text-white text-xs font-bold cursor-pointer"
                  >
                    Retry Camera
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${
                      invertLeftRight ? 'scale-x-[-1]' : ''
                    }`}
                  />
                  {!cameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/85 z-10 space-y-3">
                      {cameraState === 'starting' ? (
                        <>
                          <Activity className="w-8 h-8 text-[#57D6C5] animate-spin" />
                          <p className="text-xs font-bold text-white">Starting live camera stream...</p>
                        </>
                      ) : (
                        <>
                          <Camera className="w-8 h-8 text-[#6845C2]" />
                          <p className="text-xs font-bold text-white">Live Camera is Standby</p>
                          <p className="text-[11px] text-white/70 max-w-xs">
                            Press "Start Camera & Stream" to activate continuous object recognition.
                          </p>
                          <button
                            onClick={handleResumeStream}
                            className="py-2 px-4 rounded-xl bg-[#087F73] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-[#06675d] transition-colors shadow-sm"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Start Camera & Stream</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {/* Real-time bounding box overlays over video */}
                  {cameraActive && detections.map((d, i) => {
                    const nb = d.normalizedBox || {
                      x: (d.box?.x || 0) / 640,
                      y: (d.box?.y || 0) / 480,
                      width: (d.box?.width || 0) / 640,
                      height: (d.box?.height || 0) / 480,
                    };
                    const leftPct = invertLeftRight ? (1 - (nb.x + nb.width)) * 100 : nb.x * 100;
                    return (
                      <div
                        key={d.id || i}
                        className="absolute border-2 border-[#57D6C5] bg-[#006B66]/20 rounded-md pointer-events-none transition-all duration-300"
                        style={{
                          left: `${Math.max(0, Math.min(90, leftPct))}%`,
                          top: `${Math.max(0, Math.min(90, nb.y * 100))}%`,
                          width: `${Math.max(5, Math.min(100, nb.width * 100))}%`,
                          height: `${Math.max(5, Math.min(100, nb.height * 100))}%`,
                        }}
                      >
                        <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#006B66] text-white whitespace-nowrap shadow-sm">
                          {d.label} ({Math.round(d.confidence * 100)}%)
                        </span>
                      </div>
                    );
                  })}

                  {/* Processing Badge */}
                  {isProcessing && (
                    <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur-sm text-white text-[11px] font-semibold flex items-center gap-2">
                      <RefreshCw className="w-3 h-3 animate-spin text-[#57D6C5]" />
                      <span>Scanning frame...</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Settings Toolbar for Live Interval & Suppression */}
            <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#101828]/10 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#101828]">Interval:</span>
                {[2, 3, 5].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setIntervalSec(sec)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs cursor-pointer transition-colors ${
                      intervalSec === sec
                        ? 'bg-[#6845C2] text-white'
                        : 'bg-white border border-[#101828]/15 text-[#101828]'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#101828]">
                <input
                  type="checkbox"
                  checked={duplicateSuppression}
                  onChange={(e) => setDuplicateSuppression(e.target.checked)}
                  className="rounded text-[#6845C2] focus:ring-[#6845C2]"
                />
                <span>Duplicate suppression (calm audio)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Live Audio Announcements & History Panel */}
        <div className="lg:col-span-5 space-y-4">
          {/* Latest Spoken Announcement Card */}
          <div className="p-6 rounded-3xl bg-white border border-[#087F73]/30 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#087F73] flex items-center gap-1.5">
                <Volume2 className="w-4 h-4" />
                Latest Spoken Guidance
              </span>
              <span className="text-[10px] text-[#101828]/50 font-mono">
                Live Speech Queue
              </span>
            </div>

            <div
              className="p-4 rounded-2xl bg-[#087F73]/5 border border-[#087F73]/20 text-[#101828] text-sm font-semibold leading-relaxed"
              aria-live="polite"
              aria-atomic="true"
            >
              “{latestAnnouncement}”
            </div>

            <p className="text-[11px] text-[#101828]/60">
              Announces changes in your physical surroundings based on detected objects, room elements, and human activity.
            </p>
          </div>

          {/* Announcement Timeline Log */}
          <div className="p-6 rounded-3xl bg-white border border-[#101828]/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#101828]/10">
              <span className="text-xs font-bold text-[#101828] flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#6845C2]" />
                Recent Announcements
              </span>
              <button
                onClick={() => setAnnouncements([])}
                className="text-[11px] font-bold text-[#6845C2] hover:underline cursor-pointer"
              >
                Clear Log
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {announcements.length === 0 ? (
                <p className="text-xs text-[#101828]/50 italic py-4 text-center">
                  Waiting for detection stream...
                </p>
              ) : (
                announcements.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[#F8FAFC] border border-[#101828]/5 flex items-start justify-between gap-3 text-xs"
                  >
                    <p className="text-[#101828]/90 font-medium leading-snug">
                      {item.text}
                    </p>
                    <span className="text-[10px] font-mono text-[#101828]/50 shrink-0">
                      {item.time}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
