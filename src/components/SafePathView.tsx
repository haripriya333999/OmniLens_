import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Compass,
  Play,
  Pause,
  Square,
  RotateCcw,
  Volume2,
  VolumeX,
  AlertTriangle,
  ShieldCheck,
  Camera,
  CameraOff,
  FlipHorizontal,
  Sliders,
  CheckCircle2,
  Info,
  Activity,
  Footprints,
  Eye,
  RefreshCw,
  MapPin,
  Navigation,
  Search,
  Mic,
  ArrowRight,
  ArrowLeft,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  SafePathResponse,
  SafePathObstacle,
  OpenCVQualityMetrics,
  NavigationPlace,
  NavigationRoute,
  NavigationStep,
  NavigationState,
  GpsAccuracyInfo,
} from '../types';
import { apiService } from '../services/apiService';
import { speechService } from '../services/speech';
import { cameraManager } from '../services/cameraManager';
import { SAMPLE_IMAGES } from '../data/sampleImages';

interface SafePathViewProps {
  highContrast?: boolean;
  onSwitchTask?: (task: any) => void;
}

const POPULAR_DESTINATIONS = [
  'Pharmacy',
  'Coffee Shop',
  'Grocery Store',
  'Bus Stop / Transit',
  'Hospital / Clinic',
  'Library',
];

export const SafePathView: React.FC<SafePathViewProps> = ({
  highContrast = false,
  onSwitchTask,
}) => {
  // Mode: Live Camera vs Sample Image
  const [sourceMode, setSourceMode] = useState<'camera' | 'sample'>('camera');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastResponse, setLastResponse] = useState<SafePathResponse | null>(null);
  const [currentObstacleAlert, setCurrentObstacleAlert] = useState<string>(
    'SafePath sensor ready. Press Start Scanning or tap Inspect Path.'
  );

  // Camera state
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean>(false);
  const [selectedSampleIndex, setSelectedSampleIndex] = useState<number>(0);

  // Settings
  const [invertLR, setInvertLR] = useState<boolean>(true); // Default true for laptop webcam
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.35);
  const [scanIntervalMs, setScanIntervalMs] = useState<number>(1500);

  // Diagnostics
  const [opencvQuality, setOpencvQuality] = useState<OpenCVQualityMetrics | null>(null);
  const [opencvVersion, setOpencvVersion] = useState<string>('5.0.0');
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // --- DESTINATION NAVIGATION STATE ---
  const [navState, setNavState] = useState<NavigationState>('idle');
  const [destQuery, setDestQuery] = useState<string>('');
  const [isSearchingDest, setIsSearchingDest] = useState<boolean>(false);
  const [candidatePlaces, setCandidatePlaces] = useState<NavigationPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<NavigationPlace | null>(null);
  const [activeRoute, setActiveRoute] = useState<NavigationRoute | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isListeningVoiceDest, setIsListeningVoiceDest] = useState<boolean>(false);

  // Geolocation & GPS state
  const [gpsInfo, setGpsInfo] = useState<GpsAccuracyInfo>({
    lat: 43.7257,
    lng: -79.2972,
    accuracyMeters: 8,
    quality: 'fair',
    heading: null,
    speed: null,
    timestamp: Date.now(),
    permissionStatus: 'prompt',
  });
  const [locationError, setLocationError] = useState<string | null>(null);

  // Refs & Camera Lifecycle
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const scanTimerRef = useRef<any>(null);
  const isScanningRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const geoWatchIdRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active' | 'stopping' | 'error'>('idle');

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    const unsub = speechService.subscribe((speaking) => {
      setIsSpeaking(speaking);
    });
    return unsub;
  }, []);

  // --- GEOLOCATION TRACKING ---
  const initGeolocation = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const acc = Math.round(pos.coords.accuracy);
        let quality: GpsAccuracyInfo['quality'] = 'high';
        if (acc > 30) quality = 'poor';
        else if (acc > 12) quality = 'fair';

        setGpsInfo({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: acc,
          quality,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
          permissionStatus: 'granted',
        });
        setLocationError(null);
      },
      (err) => {
        console.warn('Geolocation initial query error:', err.message);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsInfo((prev) => ({ ...prev, permissionStatus: 'denied' }));
          setLocationError('Location permission denied. Please allow location access for walking navigation.');
        } else {
          setLocationError('Acquiring GPS fix. Using default local coordinates for routing.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );

    // Watch position
    try {
      geoWatchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const acc = Math.round(pos.coords.accuracy);
          let quality: GpsAccuracyInfo['quality'] = 'high';
          if (acc > 30) quality = 'poor';
          else if (acc > 12) quality = 'fair';

          setGpsInfo({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyMeters: acc,
            quality,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            timestamp: pos.timestamp,
            permissionStatus: 'granted',
          });
        },
        (err) => {
          console.warn('Geolocation watch notice:', err.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    } catch (e) {}
  }, []);

  useEffect(() => {
    initGeolocation();
    return () => {
      if (geoWatchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
      }
    };
  }, [initGeolocation]);

  // --- CAMERA SETUP & LIFECYCLE ---
  const startCamera = async () => {
    const reqId = ++cameraRequestIdRef.current;
    setCameraState('starting');
    setCameraError(null);

    try {
      const stream = await cameraManager.acquireSession('safepath', {
        facingMode: 'user',
        idealWidth: 1280,
        idealHeight: 720,
      });

      // Guard: if unmounted or request superseded
      if (!isMountedRef.current || cameraRequestIdRef.current !== reqId) {
        cameraManager.releaseSession('safepath', videoRef.current);
        return;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const isReady = await cameraManager.waitForVideoReady(videoRef.current);
        if (!isMountedRef.current || cameraRequestIdRef.current !== reqId) {
          cameraManager.releaseSession('safepath', videoRef.current);
          return;
        }

        if (isReady) {
          setHasCameraPermission(true);
          setCameraState('active');
          setCurrentObstacleAlert('SafePath camera active. Ready to scan path.');
          speechService.speak('SafePath camera active. Ready to scan forward path.', 'interrupt', 'general');
        } else {
          throw new Error('Camera video stream could not be initialized.');
        }
      }
    } catch (err: any) {
      if (cameraRequestIdRef.current !== reqId) return;
      console.warn('Camera access issue:', err);
      let msg = 'Camera access unavailable or denied. You can inspect sample corridor photos below.';
      if (err.name === 'NotAllowedError') {
        msg = 'Camera permission was denied in your browser address bar.';
      }
      setCameraError(msg);
      setCameraState('error');
      setHasCameraPermission(false);
      speechService.speak('Camera access unavailable. You can inspect sample corridor photos below.', 'interrupt', 'general');
    }
  };

  const stopCamera = () => {
    cameraRequestIdRef.current++;
    setCameraState('stopping');
    cameraManager.releaseSession('safepath', videoRef.current);
    setHasCameraPermission(false);
    setCameraState('idle');
  };

  // Component lifecycle: DO NOT auto-start camera on mount. Clean up on unmount.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cameraManager.releaseSession('safepath', videoRef.current);
      if (scanTimerRef.current) {
        clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // When user switches sourceMode to sample, release camera
  useEffect(() => {
    if (sourceMode === 'sample') {
      stopCamera();
    }
  }, [sourceMode]);

  // Capture frame as Blob using cameraManager
  const captureFrameBlob = useCallback(async (): Promise<Blob | null> => {
    if (sourceMode === 'camera') {
      const video = videoRef.current;
      if (!video || cameraState !== 'active') return null;

      const capture = await cameraManager.captureFrame(video, {
        mirror: invertLR,
        quality: 0.85,
      });
      return capture ? capture.blob : null;
    } else {
      const sample = SAMPLE_IMAGES[selectedSampleIndex] || SAMPLE_IMAGES[0];
      try {
        const response = await fetch(sample.src);
        return await response.blob();
      } catch (e) {
        return null;
      }
    }
  }, [sourceMode, selectedSampleIndex, invertLR, cameraState]);

  // Draw overlay with sector lines & obstacles
  const drawOverlay = useCallback(
    (obstacles: SafePathObstacle[], width: number, height: number) => {
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);

      const leftBoundary = width * 0.35;
      const rightBoundary = width * 0.65;
      const floorBoundary = height * 0.55;

      // 1. Sector divider dashed lines
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(87, 214, 197, 0.4)';

      // Left divider
      ctx.beginPath();
      ctx.moveTo(leftBoundary, 0);
      ctx.lineTo(leftBoundary, height);
      ctx.stroke();

      // Right divider
      ctx.beginPath();
      ctx.moveTo(rightBoundary, 0);
      ctx.lineTo(rightBoundary, height);
      ctx.stroke();

      // 2. Center Walking Path Corridor Highlight
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(0, 107, 102, 0.15)';
      ctx.fillRect(leftBoundary, 0, rightBoundary - leftBoundary, height);

      ctx.strokeStyle = 'rgba(87, 214, 197, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(leftBoundary, 0);
      ctx.lineTo(leftBoundary, height);
      ctx.moveTo(rightBoundary, 0);
      ctx.lineTo(rightBoundary, height);
      ctx.stroke();

      // 3. Floor Horizon
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(230, 162, 60, 0.6)';
      ctx.beginPath();
      ctx.moveTo(0, floorBoundary);
      ctx.lineTo(width, floorBoundary);
      ctx.stroke();

      // Sector Headers
      ctx.setLineDash([]);
      ctx.font = 'bold 11px sans-serif';

      // Left Tag
      ctx.fillStyle = 'rgba(16, 24, 32, 0.85)';
      ctx.fillRect(leftBoundary / 2 - 35, 12, 70, 22);
      ctx.fillStyle = '#FAF7F0';
      ctx.fillText('LEFT', leftBoundary / 2 - 16, 27);

      // Walking Path Tag
      ctx.fillStyle = 'rgba(0, 107, 102, 0.9)';
      ctx.fillRect((leftBoundary + rightBoundary) / 2 - 60, 12, 120, 22);
      ctx.fillStyle = '#57D6C5';
      ctx.fillText('WALKING PATH', (leftBoundary + rightBoundary) / 2 - 45, 27);

      // Right Tag
      ctx.fillStyle = 'rgba(16, 24, 32, 0.85)';
      ctx.fillRect((rightBoundary + width) / 2 - 35, 12, 70, 22);
      ctx.fillStyle = '#FAF7F0';
      ctx.fillText('RIGHT', (rightBoundary + width) / 2 - 20, 27);

      // 4. Render Detected Obstacles
      obstacles.forEach((obs) => {
        const { box, sector, proximity, label, confidence } = obs;
        const x = box.x;
        const y = box.y;
        const w = box.width;
        const h = box.height;

        let strokeColor = '#57D6C5';
        let fillColor = 'rgba(87, 214, 197, 0.2)';
        let tagBg = '#006B66';

        if (proximity === 'immediate_path') {
          strokeColor = '#EF4444';
          fillColor = 'rgba(239, 68, 68, 0.35)';
          tagBg = '#EF4444';
        } else if (proximity === 'approaching') {
          strokeColor = '#E6A23C';
          fillColor = 'rgba(230, 162, 60, 0.25)';
          tagBg = '#E6A23C';
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, w, h);

        const title = `${label.toUpperCase()} (${Math.round(confidence * 100)}%) - ${sector.toUpperCase()}`;
        ctx.font = 'bold 11px monospace';
        const textWidth = ctx.measureText(title).width;

        ctx.fillStyle = tagBg;
        ctx.fillRect(x, Math.max(0, y - 24), textWidth + 12, 22);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(title, x + 6, Math.max(16, y - 8));
      });
    },
    []
  );

  // Single-Frame Obstacle Analysis
  const performAnalysis = useCallback(async () => {
    if (isProcessingRef.current || !isMountedRef.current) return;
    isProcessingRef.current = true;
    setIsProcessing(true);

    const startTime = performance.now();
    try {
      const blob = await captureFrameBlob();
      if (!blob || !isMountedRef.current) {
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const file = new File([blob], 'safepath_frame.jpg', { type: 'image/jpeg' });
      const response = await apiService.analyzeSafePath(file, invertLR, confidenceThreshold);
      if (!isMountedRef.current) return;

      setLatencyMs(Math.round(performance.now() - startTime));
      setLastResponse(response);

      if (response.opencv_quality) {
        setOpencvQuality(response.opencv_quality);
      }
      if (response.opencv_version) {
        setOpencvVersion(response.opencv_version);
      }

      // Priority coordinated speech: obstacle alerts yield to active navigation instructions
      if (response.spoken_alert && response.should_speak) {
        setCurrentObstacleAlert(response.spoken_alert);
        speechService.speakObstacleAlert(response.spoken_alert, 6000);
      } else if (response.obstacles.length === 0) {
        setCurrentObstacleAlert('No obstacles detected in the analyzed frame. Continue with cane.');
      }

      const width = videoRef.current?.videoWidth || 640;
      const height = videoRef.current?.videoHeight || 480;
      drawOverlay(response.obstacles, width, height);
    } catch (err: any) {
      if (isMountedRef.current) {
        console.error('SafePath analysis error:', err);
        setCurrentObstacleAlert('Obstacle analysis unavailable. Use your white cane or guide dog.');
        speechService.speakObstacleAlert('Warning: Obstacle analysis unavailable. Do not rely on camera.', 6000);
      }
    } finally {
      if (isMountedRef.current) {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    }
  }, [captureFrameBlob, invertLR, confidenceThreshold, drawOverlay]);

  // Snapshot single frame with camera auto-connect if needed
  const handleSnapshot = async () => {
    if (sourceMode === 'camera' && cameraState !== 'active') {
      await startCamera();
    }
    performAnalysis();
  };

  // Start continuous obstacle scanning
  const handleStartScanning = async () => {
    if (sourceMode === 'camera' && cameraState !== 'active') {
      await startCamera();
    }
    setIsScanning(true);
    speechService.speak('SafePath obstacle sensor started. Scanning forward path.', 'interrupt', 'obstacle');
    performAnalysis();
    if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    scanTimerRef.current = setInterval(() => {
      if (isScanningRef.current) {
        performAnalysis();
      }
    }, scanIntervalMs);
  };

  // Pause continuous scanning (leaves camera on standby)
  const handlePauseScanning = () => {
    setIsScanning(false);
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    speechService.speak('SafePath obstacle monitoring paused.', 'interrupt', 'general');
  };

  // Stop scanning AND stop the camera completely (releases camera hardware and indicator)
  const handleStopAll = () => {
    setIsScanning(false);
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    stopCamera();
    setCurrentObstacleAlert('SafePath obstacle sensor stopped. Camera turned off.');
    speechService.speak('SafePath obstacle monitoring stopped. Camera turned off.', 'interrupt', 'general');
  };

  // --- DESTINATION SEARCH & ROUTING ---
  const handleSearchDestination = async (queryText?: string) => {
    const q = (queryText || destQuery).trim();
    if (!q) return;

    setIsSearchingDest(true);
    setNavState('searching');
    speechService.speak(`Searching for ${q}.`, 'interrupt', 'general');

    try {
      const places = await apiService.searchDestinations(q, gpsInfo.lat, gpsInfo.lng);
      setCandidatePlaces(places);
      if (places.length > 0) {
        setNavState('confirming_destination');
        const top = places[0];
        setSelectedPlace(top);
        const distStr = top.distanceMeters ? `about ${top.distanceMeters} metres away` : '';
        speechService.speak(
          `Found destination: ${top.name}, ${distStr}. Press Confirm or select another to begin walking navigation.`,
          'interrupt',
          'navigation'
        );
      } else {
        setNavState('error');
        speechService.speak(`No matching destination found for ${q}. Please try another location.`, 'interrupt', 'general');
      }
    } catch (e: any) {
      console.error('Destination search failed:', e);
      setNavState('error');
      speechService.speak('Destination search could not connect. Check internet connection.', 'interrupt', 'general');
    } finally {
      setIsSearchingDest(false);
    }
  };

  // Voice recognition for destination
  const handleVoiceDestinationInput = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      speechService.speak('Voice input is not supported in this browser. Please type your destination.', 'interrupt', 'general');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListeningVoiceDest(true);
        speechService.speak('Listening. Say your destination now.', 'interrupt', 'general');
      };

      recognition.onresult = (event: any) => {
        const spoken = event.results?.[0]?.[0]?.transcript;
        if (spoken) {
          const cleaned = spoken.replace(/^navigate to\s+/i, '').trim();
          setDestQuery(cleaned);
          handleSearchDestination(cleaned);
        }
      };

      recognition.onerror = () => {
        setIsListeningVoiceDest(false);
      };

      recognition.onend = () => {
        setIsListeningVoiceDest(false);
      };

      recognition.start();
    } catch (e) {
      setIsListeningVoiceDest(false);
    }
  };

  // Confirm destination and compute route
  const handleConfirmAndStartRoute = async (placeToRoute?: NavigationPlace) => {
    const place = placeToRoute || selectedPlace;
    if (!place) return;

    setNavState('calculating_route');
    speechService.speak(`Calculating pedestrian route to ${place.name}.`, 'interrupt', 'navigation');

    try {
      const origin = { lat: gpsInfo.lat, lng: gpsInfo.lng };
      const destination = { lat: place.lat, lng: place.lng };

      const route = await apiService.getPedestrianRoute(origin, destination, place.name);
      if (route && route.steps && route.steps.length > 0) {
        setActiveRoute(route);
        setCurrentStepIndex(0);
        setNavState('navigating');

        const firstStep = route.steps[0];
        const distKm = (route.totalDistanceMeters / 1000).toFixed(1);
        const mins = Math.max(1, Math.round(route.totalDurationSeconds / 60));

        speechService.speakNavigationTurn(
          `Walking route started. Total distance is ${distKm} kilometres, approximately ${mins} minutes walk. First turn: ${firstStep.spokenInstruction}`
        );

        // Auto-start camera obstacle scan if not already running
        if (!isScanning) {
          handleStartScanning();
        }
      } else {
        setNavState('error');
        speechService.speak(
          'Could not calculate an exact pedestrian walking route for this location. You can open the route in Google Maps using the button below.',
          'interrupt',
          'navigation'
        );
      }
    } catch (e: any) {
      console.error('Route calculation error:', e);
      setNavState('error');
    }
  };

  // Turn-by-Turn Navigation Controls
  const handleNextTurn = () => {
    if (!activeRoute) return;
    if (currentStepIndex < activeRoute.steps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      const step = activeRoute.steps[nextIdx];
      speechService.speakNavigationTurn(`Step ${nextIdx + 1} of ${activeRoute.steps.length}: ${step.spokenInstruction}`);
    } else {
      setNavState('arrived');
      speechService.speakNavigationTurn('You have reached the vicinity of your destination. Navigation completed.');
    }
  };

  const handlePrevTurn = () => {
    if (!activeRoute || currentStepIndex === 0) return;
    const prevIdx = currentStepIndex - 1;
    setCurrentStepIndex(prevIdx);
    const step = activeRoute.steps[prevIdx];
    speechService.speakNavigationTurn(`Previous turn: ${step.spokenInstruction}`);
  };

  const handleRepeatTurn = () => {
    if (activeRoute && activeRoute.steps[currentStepIndex]) {
      const step = activeRoute.steps[currentStepIndex];
      speechService.speakNavigationTurn(step.spokenInstruction);
    } else {
      speechService.repeat(true);
    }
  };

  const handleStopNavigation = () => {
    setNavState('idle');
    setActiveRoute(null);
    setSelectedPlace(null);
    setCandidatePlaces([]);
    speechService.stop();
    speechService.speak('Walking navigation stopped.', 'interrupt', 'navigation');
  };

  // Helper for turn icon
  const getTurnIcon = (modifier: string) => {
    if (modifier.includes('left')) return <CornerUpLeft className="w-8 h-8 text-[#57D6C5]" />;
    if (modifier.includes('right')) return <CornerUpRight className="w-8 h-8 text-[#57D6C5]" />;
    if (modifier === 'arrive') return <CheckCircle2 className="w-8 h-8 text-emerald-400" />;
    return <Navigation className="w-8 h-8 text-[#57D6C5]" />;
  };

  return (
    <div className={`space-y-6 ${highContrast ? 'contrast-125' : ''}`}>
      {/* 1. Header Banner & Mobility Disclaimer */}
      <div className="p-6 sm:p-7 rounded-3xl bg-[#101820] text-[#FAF7F0] shadow-xl border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Ambient Teal Backlight */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#006B66]/20 blur-3xl rounded-full pointer-events-none" />

        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#006B66]/30 border border-[#57D6C5]/40 text-[#57D6C5] text-xs font-bold uppercase tracking-wider">
            <Footprints className="w-3.5 h-3.5" />
            <span>Dual-Engine Mobility Companion</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <span>SafePath Navigation & Obstacle Sensor</span>
            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-lg bg-[#57D6C5]/20 text-[#57D6C5] border border-[#57D6C5]/30">
              OpenCV 5 + Maps
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-[#FAF7F0]/70 max-w-2xl leading-relaxed">
            Spoken pedestrian turn-by-turn guidance coordinated with real-time camera obstacle detection. Divides your view into Left, Center Corridor, and Right sectors with duplicate-suppressed voice cues.
          </p>
        </div>

        {/* Global Controls & Status */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto relative z-10">
          {/* GPS Accuracy Pill */}
          <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs flex items-center gap-2 font-mono">
            <MapPin className="w-3.5 h-3.5 text-[#57D6C5]" />
            <span>
              GPS: {gpsInfo.permissionStatus === 'granted' ? `±${gpsInfo.accuracyMeters}m` : 'Default Loc'}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                gpsInfo.quality === 'high' ? 'bg-[#57D6C5]' : gpsInfo.quality === 'fair' ? 'bg-amber-400' : 'bg-rose-400'
              }`}
            />
          </div>

          {/* Repeat Button */}
          <button
            onClick={() => speechService.repeat(navState === 'navigating')}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#FAF7F0] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5]"
            title="Repeat last spoken instruction or alert"
            aria-label="Repeat speech"
          >
            <RotateCcw className="w-4 h-4 text-[#57D6C5]" />
          </button>

          {/* Stop Speaking Button */}
          <button
            onClick={() => speechService.stop()}
            className="py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#FAF7F0] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5]"
            aria-label="Silence audio immediately"
          >
            <VolumeX className="w-4 h-4 text-rose-400" />
            <span>Stop Speaking</span>
          </button>
        </div>
      </div>

      {/* 2. Destination Walking Navigation Deck */}
      <div className="p-6 rounded-3xl bg-[#16212B] border border-white/10 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#006B66] text-[#57D6C5] flex items-center justify-center shadow-md">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-white">1. Accessible Destination Walking Guidance</h2>
              <p className="text-xs text-[#FAF7F0]/60">
                Enter or speak a destination for step-by-step pedestrian walking routes.
              </p>
            </div>
          </div>

          {navState === 'navigating' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleStopNavigation}
                className="py-1.5 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel Navigation
              </button>
            </div>
          )}
        </div>

        {/* Search Input Bar (when not actively in route) */}
        {navState !== 'navigating' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-[#FAF7F0]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={destQuery}
                  onChange={(e) => setDestQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchDestination()}
                  placeholder="Where do you want to walk? (e.g. Pharmacy, Coffee Shop, Metro, Oak St)..."
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#101820] border border-white/15 text-sm text-white placeholder-[#FAF7F0]/40 focus:outline-none focus:border-[#57D6C5] focus:ring-1 focus:ring-[#57D6C5] transition-all"
                  aria-label="Destination address or place query"
                />
              </div>

              {/* Voice Input Trigger */}
              <button
                onClick={handleVoiceDestinationInput}
                className={`py-3 px-4 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5] ${
                  isListeningVoiceDest
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-white/10 hover:bg-white/20 text-[#FAF7F0]'
                }`}
                aria-label="Speak destination with voice"
                title="Speak destination"
              >
                <Mic className="w-4 h-4 text-[#57D6C5]" />
                <span className="hidden sm:inline">{isListeningVoiceDest ? 'Listening...' : 'Voice Search'}</span>
              </button>

              {/* Search Submit */}
              <button
                onClick={() => handleSearchDestination()}
                disabled={isSearchingDest || !destQuery.trim()}
                className="py-3 px-5 rounded-2xl bg-gradient-to-r from-[#006B66] to-[#087F73] hover:from-[#005753] hover:to-[#006B66] text-white font-bold text-xs shadow-md shadow-[#006B66]/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{isSearchingDest ? 'Searching...' : 'Find Route'}</span>
                <ArrowRight className="w-4 h-4 text-[#57D6C5]" />
              </button>
            </div>

            {/* Quick Suggested Categories */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-[#FAF7F0]/50 font-medium">Quick suggestions:</span>
              {POPULAR_DESTINATIONS.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setDestQuery(cat);
                    handleSearchDestination(cat);
                  }}
                  className="py-1 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-[#FAF7F0]/80 hover:text-white border border-white/10 transition-colors cursor-pointer"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Candidate Destination Confirmation Card */}
        {navState === 'confirming_destination' && selectedPlace && (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#006B66]/20 border border-[#57D6C5]/40 space-y-4 animate-fade-in">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-[#57D6C5] uppercase font-bold tracking-wider">
                  Candidate Destination Selected
                </span>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#57D6C5] shrink-0" />
                  <span>{selectedPlace.name}</span>
                </h3>
                <p className="text-xs text-[#FAF7F0]/70 max-w-xl">{selectedPlace.displayName}</p>
                {selectedPlace.distanceMeters && (
                  <p className="text-xs font-mono text-[#57D6C5] pt-1">
                    Straight-line distance: ~{selectedPlace.distanceMeters} metres
                  </p>
                )}
              </div>

              <button
                onClick={() => setNavState('idle')}
                className="text-xs text-[#FAF7F0]/60 hover:text-white p-1"
                aria-label="Cancel destination selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Candidate Alternatives if multiple found */}
            {candidatePlaces.length > 1 && (
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <span className="text-[11px] text-[#FAF7F0]/60">Other matches found:</span>
                <div className="flex flex-wrap gap-2">
                  {candidatePlaces.slice(1, 4).map((alt) => (
                    <button
                      key={alt.id}
                      onClick={() => {
                        setSelectedPlace(alt);
                        speechService.speak(`Selected ${alt.name}.`, 'interrupt', 'navigation');
                      }}
                      className="py-1 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white border border-white/10 transition-colors cursor-pointer text-left"
                    >
                      {alt.name} {alt.distanceMeters ? `(~${alt.distanceMeters}m)` : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Confirm and Start Button */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => handleConfirmAndStartRoute()}
                className="py-3 px-6 rounded-xl bg-gradient-to-r from-[#006B66] to-[#087F73] hover:from-[#005753] hover:to-[#006B66] text-white font-extrabold text-sm shadow-lg shadow-[#006B66]/30 transition-all flex items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5]"
              >
                <CheckCircle2 className="w-5 h-5 text-[#57D6C5]" />
                <span>Confirm & Start Walking Navigation</span>
              </button>

              <button
                onClick={() => setNavState('idle')}
                className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-[#FAF7F0] text-xs font-semibold transition-colors cursor-pointer"
              >
                Choose Another
              </button>
            </div>
          </div>
        )}

        {/* ACTIVE NAVIGATION GUIDANCE VIEWPORT */}
        {navState === 'navigating' && activeRoute && activeRoute.steps[currentStepIndex] && (
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#0B151F] to-[#101820] border-2 border-[#57D6C5]/50 shadow-2xl space-y-5">
            {/* Turn Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#006B66]/40 border border-[#57D6C5]/40 flex items-center justify-center shrink-0 shadow-lg">
                  {getTurnIcon(activeRoute.steps[currentStepIndex].modifier)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#57D6C5] uppercase font-bold tracking-wider">
                      Turn {currentStepIndex + 1} of {activeRoute.steps.length}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                      Step Distance: {activeRoute.steps[currentStepIndex].distanceMeters}m
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white mt-0.5 leading-snug">
                    {activeRoute.steps[currentStepIndex].instruction}
                  </h3>
                </div>
              </div>

              {/* Quick Repeat Turn Speech */}
              <button
                onClick={handleRepeatTurn}
                className="py-2.5 px-4 rounded-xl bg-[#57D6C5]/20 hover:bg-[#57D6C5]/30 text-[#57D6C5] border border-[#57D6C5]/40 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                aria-label="Repeat turn instruction"
              >
                <Volume2 className="w-4 h-4" />
                <span>Repeat Turn</span>
              </button>
            </div>

            {/* Stepper Navigation Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={handlePrevTurn}
                disabled={currentStepIndex === 0}
                className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-30 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <ArrowLeft className="w-4 h-4 text-[#57D6C5]" />
                <span>Previous Turn</span>
              </button>

              <button
                onClick={handleRepeatTurn}
                className="py-3 px-4 rounded-xl bg-white/15 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <RotateCcw className="w-4 h-4 text-[#57D6C5]" />
                <span>Where Am I?</span>
              </button>

              <button
                onClick={handleNextTurn}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-[#006B66] to-[#087F73] hover:from-[#005753] hover:to-[#006B66] text-white font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
              >
                <span>{currentStepIndex < activeRoute.steps.length - 1 ? 'Next Turn' : 'Arrived at Destination'}</span>
                <ArrowRight className="w-4 h-4 text-[#57D6C5]" />
              </button>
            </div>

            {/* Route Stats & External Navigation Fallback */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs text-[#FAF7F0]/70">
              <div className="flex items-center gap-3 font-mono">
                <span>Total: {(activeRoute.totalDistanceMeters / 1000).toFixed(1)} km</span>
                <span>•</span>
                <span>Est: {Math.max(1, Math.round(activeRoute.totalDurationSeconds / 60))} mins</span>
                <span>•</span>
                <span>Dest: {activeRoute.destination.name}</span>
              </div>

              {/* External App Fallback */}
              <div className="flex items-center gap-2">
                <a
                  href={activeRoute.externalGoogleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Open this route in Google Maps navigation"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#57D6C5]" />
                  <span>Google Maps Fallback</span>
                </a>

                <a
                  href={activeRoute.externalAppleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Open this route in Apple Maps"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#57D6C5]" />
                  <span>Apple Maps</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Camera Obstacle Sensor Viewport */}
      <div className="p-6 rounded-3xl bg-[#16212B] border border-white/10 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#087F73] text-[#57D6C5] flex items-center justify-center shadow-md">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-white">2. Camera Walking Path Obstacle Sensor</h2>
              <p className="text-xs text-[#FAF7F0]/60">
                Scans ground-level hazards and floor obstacles independently while walking.
              </p>
            </div>
          </div>

          {/* Scanner Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {!isScanning ? (
              <>
                <button
                  onClick={handleStartScanning}
                  className="flex-1 sm:flex-initial py-2.5 px-5 rounded-xl bg-[#006B66] hover:bg-[#005753] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5]"
                  aria-label="Start SafePath continuous obstacle scan"
                >
                  <Play className="w-4 h-4 fill-current text-[#57D6C5]" />
                  <span>{cameraState === 'active' ? 'Resume Scanner' : 'Start Camera Scanner'}</span>
                </button>
                {cameraState === 'active' && (
                  <button
                    onClick={handleStopAll}
                    className="py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-white hover:text-rose-300 font-bold text-xs border border-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                    aria-label="Stop camera and release hardware"
                    title="Turn off camera"
                  >
                    <CameraOff className="w-4 h-4 text-rose-400" />
                    <span>Turn Off Camera</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={handlePauseScanning}
                  className="py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  aria-label="Pause SafePath obstacle scan"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause Scanner</span>
                </button>
                <button
                  onClick={handleStopAll}
                  className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  aria-label="Stop SafePath scan and turn off camera completely"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Camera</span>
                </button>
              </>
            )}

            <button
              onClick={handleSnapshot}
              disabled={isProcessing}
              className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Inspect single frame"
              aria-label="Inspect single frame"
            >
              <Camera className="w-4 h-4 text-[#57D6C5]" />
              <span>Snapshot</span>
            </button>
          </div>
        </div>

        {/* Live Spoken Alert Banner with Accessibility Live Region */}
        <div
          role="region"
          aria-live="polite"
          aria-atomic="true"
          className="p-4 rounded-2xl bg-[#101820] border border-white/10 flex items-center gap-3"
        >
          <Volume2 className="w-5 h-5 text-[#57D6C5] shrink-0" />
          <div className="flex-1 text-xs sm:text-sm font-semibold text-white">
            <span className="text-[#57D6C5] font-mono text-[10px] uppercase block tracking-wider font-bold">
              Active Obstacle Feedback
            </span>
            <span>{currentObstacleAlert}</span>
          </div>
        </div>

        {/* Viewfinder Canvas Area */}
        <div className="relative aspect-video w-full rounded-2xl bg-[#0B1017] border border-white/10 overflow-hidden shadow-inner flex items-center justify-center">
          {sourceMode === 'camera' ? (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${invertLR ? 'scale-x-[-1]' : ''}`}
              />
              {cameraState !== 'active' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#0B1017]/90 z-10 space-y-3">
                  {cameraState === 'starting' ? (
                    <>
                      <Activity className="w-9 h-9 text-[#57D6C5] animate-spin" />
                      <p className="text-sm font-bold text-white">Starting SafePath Camera...</p>
                      <p className="text-xs text-[#FAF7F0]/60">Connecting to device camera stream.</p>
                    </>
                  ) : cameraError ? (
                    <>
                      <AlertTriangle className="w-9 h-9 text-rose-400" />
                      <p className="text-sm font-bold text-white">{cameraError}</p>
                      <button
                        onClick={startCamera}
                        className="mt-2 py-2 px-4 rounded-xl bg-[#006B66] hover:bg-[#005753] text-white text-xs font-bold cursor-pointer transition-colors"
                      >
                        Retry Camera
                      </button>
                    </>
                  ) : (
                    <>
                      <Camera className="w-9 h-9 text-[#57D6C5]" />
                      <p className="text-sm font-bold text-white">Camera Standby</p>
                      <p className="text-xs text-[#FAF7F0]/60 max-w-sm">
                        Press "Start Camera Scanner" or tap "Turn On Camera" below to begin live obstacle awareness.
                      </p>
                      <button
                        onClick={startCamera}
                        className="py-2.5 px-5 rounded-xl bg-[#006B66] hover:bg-[#005753] text-white text-xs font-bold cursor-pointer transition-all flex items-center gap-2 shadow-md shadow-[#006B66]/30"
                      >
                        <Play className="w-4 h-4 text-[#57D6C5]" />
                        <span>Turn On Camera</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <img
              src={SAMPLE_IMAGES[selectedSampleIndex]?.src || SAMPLE_IMAGES[0].src}
              alt="SafePath corridor test scene"
              className="w-full h-full object-cover"
            />
          )}

          {/* Analysis Overlay Canvas */}
          <canvas
            ref={overlayCanvasRef}
            className={`absolute inset-0 w-full h-full pointer-events-none ${invertLR ? 'scale-x-[-1]' : ''}`}
          />

          {/* Hidden Snapshot Canvas */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="absolute top-4 right-4 py-1.5 px-3 rounded-full bg-[#101820]/90 border border-[#57D6C5]/50 text-[#57D6C5] text-xs font-mono font-bold flex items-center gap-2 shadow-lg backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#57D6C5] animate-ping" />
              <span>Scanning Frame...</span>
            </div>
          )}

          {/* Low-Light Enhancement Indicator */}
          {opencvQuality?.low_light_applied && (
            <div className="absolute bottom-4 left-4 py-1.5 px-3 rounded-xl bg-amber-500/90 text-black text-xs font-bold flex items-center gap-1.5 shadow-lg">
              <span>Low-Light CLAHE Boosted</span>
            </div>
          )}
        </div>

        {/* Source Mode & Webcam Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSourceMode('camera')}
              className={`py-1.5 px-3 rounded-xl font-bold transition-colors cursor-pointer ${
                sourceMode === 'camera'
                  ? 'bg-[#006B66] text-white'
                  : 'bg-white/5 text-[#FAF7F0]/70 hover:text-white'
              }`}
            >
              Live Camera
            </button>
            <button
              onClick={() => setSourceMode('sample')}
              className={`py-1.5 px-3 rounded-xl font-bold transition-colors cursor-pointer ${
                sourceMode === 'sample'
                  ? 'bg-[#006B66] text-white'
                  : 'bg-white/5 text-[#FAF7F0]/70 hover:text-white'
              }`}
            >
              Test Corridor Photos
            </button>
          </div>

          {/* Mirror Toggle */}
          <button
            onClick={() => setInvertLR(!invertLR)}
            className="flex items-center gap-1.5 text-[#FAF7F0]/80 hover:text-white cursor-pointer py-1 px-2 rounded-lg bg-white/5"
          >
            <FlipHorizontal className="w-3.5 h-3.5 text-[#57D6C5]" />
            <span>Mirror Perspective: {invertLR ? 'Laptop Webcam' : 'Rear Camera'}</span>
          </button>
        </div>
      </div>

      {/* 4. Mobility Boundaries & Safety Disclosure */}
      <div className="p-5 rounded-2xl bg-[#006B66]/15 border border-[#57D6C5]/30 text-xs text-[#FAF7F0]/80 space-y-2">
        <div className="flex items-center gap-2 font-bold text-white text-sm">
          <ShieldCheck className="w-4 h-4 text-[#57D6C5]" />
          <span>SafePath Assistive Mobility Disclosure</span>
        </div>
        <p className="leading-relaxed">
          SafePath combines pedestrian map routing with camera obstacle exploration. Neither capability guarantees step-free sidewalks, safe pedestrian crossings, or detection of every hazard. OmniLens is an assistive tool that supplements, but NEVER replaces, a white cane, guide dog, or physical orientation training.
        </p>
      </div>
    </div>
  );
};
