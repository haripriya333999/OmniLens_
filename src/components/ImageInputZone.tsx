import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, Image as ImageIcon, X, RefreshCw, CheckCircle2, ArrowLeft, FlipHorizontal } from 'lucide-react';
import { SAMPLE_IMAGES, SampleImage } from '../data/sampleImages';
import { flipImageHorizontally } from '../services/imageUtils';
import { speechService } from '../services/speech';
import { cameraManager } from '../services/cameraManager';

interface ImageInputZoneProps {
  selectedImage: string | null;
  onImageSelected: (imageSrc: string, file?: File) => void;
  onClearImage: () => void;
  isLoading: boolean;
}

export const ImageInputZone: React.FC<ImageInputZoneProps> = ({
  selectedImage,
  onImageSelected,
  onClearImage,
  isLoading,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [isFlipping, setIsFlipping] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraRequestIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Stop camera when closing
  const stopCameraStream = () => {
    cameraRequestIdRef.current++;
    cameraManager.releaseSession('image-input-zone', videoRef.current);
    setIsCameraOpen(false);
    setCameraError(null);
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopCameraStream();
    };
  }, []);

  const handleStartCamera = async () => {
    const reqId = ++cameraRequestIdRef.current;
    setCameraError(null);

    try {
      const stream = await cameraManager.acquireSession('image-input-zone', {
        facingMode: 'user',
        idealWidth: 1280,
        idealHeight: 720,
      });

      if (!isMountedRef.current || cameraRequestIdRef.current !== reqId) {
        cameraManager.releaseSession('image-input-zone', videoRef.current);
        return;
      }

      setIsCameraOpen(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const isReady = await cameraManager.waitForVideoReady(videoRef.current);
        if (!isMountedRef.current || cameraRequestIdRef.current !== reqId) {
          cameraManager.releaseSession('image-input-zone', videoRef.current);
          return;
        }
      }
    } catch (err: any) {
      if (cameraRequestIdRef.current !== reqId) return;
      console.error('Camera error:', err);
      setCameraError(err.message || 'Unable to access device camera.');
      setIsCameraOpen(true);
    }
  };

  const handleCaptureSnapshot = async () => {
    if (!videoRef.current) return;
    const capture = await cameraManager.captureFrame(videoRef.current, {
      mirror: isMirrored,
      quality: 0.95,
    });
    if (capture) {
      const file = new File([capture.blob], 'camera-capture.jpg', { type: 'image/jpeg' });
      onImageSelected(capture.dataUrl, file);
      stopCameraStream();
      speechService.speak('Photo captured. Processing image analysis.', 'interrupt');
    }
  };

  const handleFlipCurrentImage = async () => {
    if (!selectedImage || isFlipping) return;
    setIsFlipping(true);
    try {
      const { dataUrl, file } = await flipImageHorizontally(selectedImage);
      onImageSelected(dataUrl, file);
      speechService.speak('Photo flipped horizontally. Left and right reversed.');
    } catch (err) {
      console.error('Failed to flip image:', err);
    } finally {
      setIsFlipping(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndLoadFile(file);
    }
    // Reset file input value so selecting the same file triggers change event
    if (e.target) e.target.value = '';
  };

  const validateAndLoadFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPEG, PNG, WEBP).');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      alert('File size exceeds 25MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImageSelected(reader.result, file);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndLoadFile(file);
    }
  };

  const handleSelectSample = (sample: SampleImage) => {
    onImageSelected(sample.src);
  };

  return (
    <div className="w-full">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp,image/bmp,image/gif"
        className="hidden"
        aria-label="Upload photo file"
      />

      {/* Camera Capture Modal / Overlay */}
      {isCameraOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Camera Capture"
        >
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full border border-[#392743]/15 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#392743]/10">
              <h3 className="text-lg font-bold text-[#392743] flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#7353B5]" />
                Live Camera Capture
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMirrored(!isMirrored)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                    isMirrored
                      ? 'bg-[#7353B5] text-white border-[#7353B5]'
                      : 'bg-[#FFF9F0] text-[#392743] border-[#392743]/15'
                  }`}
                  title="Toggle mirror mode for laptop webcam"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  <span>{isMirrored ? 'Laptop Mirror: ON' : 'Mirror: OFF'}</span>
                </button>
                <button
                  onClick={stopCameraStream}
                  className="p-1 rounded-lg text-[#392743]/60 hover:text-[#392743] hover:bg-[#FFF9F0]"
                  aria-label="Close camera"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {cameraError ? (
              <div className="p-4 bg-[#FFE5D8] rounded-xl text-sm text-[#9A3412] mb-4">
                <p className="font-semibold mb-1">Camera Permission or Device Error</p>
                <p>{cameraError}</p>
                <p className="mt-2 text-xs opacity-90">
                  Tip: Make sure camera permissions are enabled in your browser or select an image file from your device.
                </p>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-4 flex items-center justify-center shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
                  className="w-full h-full object-cover transition-transform duration-200"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={stopCameraStream}
                className="px-4 py-2 text-xs font-semibold text-[#392743] hover:bg-[#FFF9F0] rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              {!cameraError && (
                <button
                  onClick={handleCaptureSnapshot}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#7353B5] hover:bg-[#5E409B] rounded-lg shadow-sm transition-colors flex items-center gap-2 focus:ring-2 focus:ring-[#7353B5] cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Capture Photo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Image Selection Area */}
      {!selectedImage ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`p-8 border-2 border-dashed rounded-3xl transition-all text-center flex flex-col items-center justify-center ${
            isDragging
              ? 'border-[#7353B5] bg-[#7353B5]/10 scale-[0.99]'
              : 'border-[#392743]/20 bg-white/80 hover:border-[#7353B5]/60 hover:bg-white shadow-sm'
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-[#FFF9F0] border border-[#392743]/10 flex items-center justify-center text-[#7353B5] mb-4 shadow-sm">
            <Upload className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-bold text-[#392743] mb-1">
            Upload or Capture an Image for Analysis
          </h3>
          <p className="text-xs text-[#392743]/70 max-w-md mb-6 leading-relaxed">
            Drag and drop a photo here, choose a file from your device, capture with camera, or test with sample everyday scenes.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="px-5 py-3 text-xs sm:text-sm font-bold rounded-xl bg-[#7353B5] text-white hover:bg-[#5E409B] shadow-md transition-all flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7353B5] cursor-pointer"
            >
              <ImageIcon className="w-4 h-4" />
              <span>Select Photo from Device</span>
            </button>
            <button
              onClick={handleStartCamera}
              disabled={isLoading}
              className="px-5 py-3 text-xs sm:text-sm font-bold rounded-xl bg-white border border-[#392743]/20 text-[#392743] hover:bg-[#FFF9F0] shadow-sm transition-all flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7353B5] cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[#7353B5]" />
              <span>Use Live Camera</span>
            </button>
          </div>

          {/* Quick Verified Presets */}
          <div className="w-full pt-4 border-t border-[#392743]/10 text-left">
            <div className="text-xs font-semibold text-[#392743]/60 mb-2.5 text-center">
              Or test immediately with a verified sample scene:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 max-w-4xl mx-auto">
              {SAMPLE_IMAGES.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => handleSelectSample(sample)}
                  className="flex items-center gap-2.5 p-2 rounded-xl border border-[#392743]/10 bg-white hover:border-[#7353B5] hover:bg-[#FFF9F0] text-left transition-all group shadow-2xs cursor-pointer"
                >
                  <img
                    src={sample.src}
                    alt={sample.title}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-lg object-cover border border-[#392743]/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#392743] group-hover:text-[#7353B5] truncate">
                      {sample.title}
                    </div>
                    <div className="text-[10px] text-[#392743]/60 truncate">
                      {sample.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Highly prominent Active Image Bar with crystal clear "Upload / Change Photo" & "Go Back" controls */
        <div className="p-3.5 bg-white rounded-2xl border border-[#392743]/15 shadow-sm mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={selectedImage}
              alt="Active analysis subject"
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-xl object-cover border border-[#392743]/15 shadow-2xs shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#392743] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Active Image Loaded</span>
              </div>
              <div className="text-[11px] text-[#392743]/65 truncate">
                Ready for detection, scene summary, or text extraction
              </div>
            </div>
          </div>

          {/* Large, clearly labeled actions for switching or uploading another image */}
          <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleFlipCurrentImage}
              disabled={isLoading || isFlipping}
              className="px-3.5 py-2 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              aria-label="Flip photo horizontally to invert left and right"
              title="Laptop camera swapped left for right? Click to flip photo horizontally"
            >
              <FlipHorizontal className={`w-3.5 h-3.5 text-amber-700 ${isFlipping ? 'animate-spin' : ''}`} />
              <span>{isFlipping ? 'Flipping...' : 'Flip Left ↔ Right'}</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="px-3.5 py-2 text-xs font-bold text-[#7353B5] bg-[#7353B5]/10 hover:bg-[#7353B5]/20 border border-[#7353B5]/30 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              aria-label="Upload a different photo from device"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Upload Another Photo</span>
            </button>
            <button
              onClick={handleStartCamera}
              disabled={isLoading}
              className="px-3 py-2 text-xs font-semibold text-[#392743] hover:bg-[#FFF9F0] border border-[#392743]/15 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              aria-label="Take a new photo with camera"
            >
              <Camera className="w-3.5 h-3.5 text-[#7353B5]" />
              <span>Camera</span>
            </button>
            <button
              onClick={onClearImage}
              disabled={isLoading}
              className="px-3 py-2 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              aria-label="Clear active image and go back to upload screen"
              title="Go back to upload screen"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back / Clear</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
