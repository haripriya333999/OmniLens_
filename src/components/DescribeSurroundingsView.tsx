import React, { useState, useRef, useEffect } from 'react';
import {
  Eye,
  Sparkles,
  Loader2,
  Compass,
  AlertCircle,
  Sun,
  Palette,
  Layers,
  Volume2,
  Info,
  Radio,
  Search,
  FileText,
  ArrowRight,
  BookOpen,
  ArrowLeft,
  User,
  Shield,
  Activity,
  FlipHorizontal,
} from 'lucide-react';
import { DescribeResponse, Detection, ActiveTask } from '../types';
import { apiService } from '../services/apiService';
import { speechService } from '../services/speech';
import {
  analyzeSceneLighting,
  inspectObjectRegion,
  SceneLightingInfo,
  ObjectDetailedInspection,
} from '../services/visionAnalysis';
import { flipImageHorizontally, flipDetectionsHorizontally, invertSpatialText } from '../services/imageUtils';
import { ImageInputZone } from './ImageInputZone';
import { BoundingBoxCanvas } from './BoundingBoxCanvas';
import { SpeechController } from './SpeechController';

interface DescribeSurroundingsViewProps {
  highContrast?: boolean;
  onSwitchTask?: (task: ActiveTask) => void;
}

export const DescribeSurroundingsView: React.FC<DescribeSurroundingsViewProps> = ({
  highContrast = false,
  onSwitchTask,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<File | undefined>(undefined);
  const [confidence, setConfidence] = useState<number>(0.20);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DescribeResponse | null>(null);
  const [isFlipping, setIsFlipping] = useState<boolean>(false);
  const [invertLeftRight, setInvertLeftRight] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('omnilens_accessibility');
      if (saved) {
        try {
          return JSON.parse(saved).invertLeftRight || false;
        } catch (e) {}
      }
    }
    return false;
  });

  // Advanced vision states
  const [lighting, setLighting] = useState<SceneLightingInfo | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<ObjectDetailedInspection | null>(null);
  const [autoContinuous, setAutoContinuous] = useState<boolean>(false);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const timerRef = useRef<any>(null);

  const handleImageSelected = (src: string, file?: File) => {
    setSelectedImage(src);
    setActiveFile(file);
    setResult(null);
    setLighting(null);
    setSelectedInspection(null);
    setError(null);
    speechService.stop();
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setActiveFile(undefined);
    setResult(null);
    setLighting(null);
    setSelectedInspection(null);
    setError(null);
    if (autoContinuous) setAutoContinuous(false);
    speechService.stop();
  };

  const handleFlipImage = async () => {
    if (!selectedImage || isFlipping) return;
    setIsFlipping(true);
    try {
      const { dataUrl, file } = await flipImageHorizontally(selectedImage);
      setSelectedImage(dataUrl);
      setActiveFile(file);

      // If results already exist, flip bounding boxes and swap left/right spatial cues immediately
      if (result && result.detections.length > 0) {
        const imgW = imageElementRef.current?.naturalWidth || imageElementRef.current?.width || 640;
        const flippedDets = flipDetectionsHorizontally(result.detections, imgW);
        const flippedDesc = invertSpatialText(result.scene_description);
        const flippedNav = invertSpatialText(result.navigation_guidance || '');
        setResult({
          ...result,
          detections: flippedDets,
          scene_description: flippedDesc,
          navigation_guidance: flippedNav,
        });
        speechService.speak('Photo flipped horizontally. Left and right cues reversed.');
      } else {
        speechService.speak('Photo flipped horizontally.');
      }
    } catch (err) {
      console.error('Failed to flip image:', err);
    } finally {
      setIsFlipping(false);
    }
  };

  const handleRunDescribe = async (silent: boolean = false) => {
    if (!selectedImage || !imageElementRef.current) {
      if (!silent) setError('Please provide or capture an image first.');
      return;
    }
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const response = await apiService.describeSurroundings(
        imageElementRef.current,
        activeFile,
        confidence,
        invertLeftRight
      );
      setResult(response);

      // Perform real lighting and luminance analysis
      const lightInfo = analyzeSceneLighting(imageElementRef.current);
      setLighting(lightInfo);

      if (response.detections.length > 0) {
        const first = response.detections[0];
        const detail = inspectObjectRegion(
          imageElementRef.current,
          first.box,
          first.label,
          first.confidence,
          first.position
        );
        setSelectedInspection(detail);
      }
    } catch (err: any) {
      console.error('Describe surroundings failed:', err);
      if (!silent) setError(err?.message || 'Failed to analyze the scene. Please try again.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Continuous auto-scan effect
  useEffect(() => {
    if (autoContinuous && selectedImage) {
      timerRef.current = setInterval(() => {
        handleRunDescribe(true);
      }, 5000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoContinuous, selectedImage, confidence]);

  const handleInspectObject = (det: Detection) => {
    if (!imageElementRef.current) return;
    const detail = inspectObjectRegion(
      imageElementRef.current,
      det.box,
      det.label,
      det.confidence,
      det.position
    );
    setSelectedInspection(detail);

    const side = det.sideDirection || (det.position === 'center' ? 'in the center' : `on your ${det.position} side`);
    const vert = det.verticalPosition ? ` ${det.verticalPosition}` : '';
    const extra = det.activityOrDetails ? `. Details: ${det.activityOrDetails}` : '';
    const speech = `${detail.label}, located ${side}${vert}. Visual tone is ${detail.dominantColor}${extra}.`;
    speechService.speak(speech);
  };

  const handleAnnounceLighting = () => {
    if (lighting) {
      speechService.speak(
        `Lighting condition is ${lighting.lightingLevel}. ${lighting.recommendation}`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar with prominent "Upload Another Photo" and Task switcher */}
      <div className="p-3.5 bg-white rounded-2xl border border-[#392743]/15 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#392743]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#7353B5] animate-pulse" />
          <span>Mode: 1. Describe Surroundings & Human Activity</span>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Prominent Back to Upload / Upload Another button */}
          {selectedImage && (
            <button
              onClick={handleClearImage}
              className="px-3.5 py-1.5 rounded-xl bg-[#FFF9F0] hover:bg-[#EAE1D2] text-[#392743] font-bold text-xs border border-[#392743]/20 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Clear current photo and choose another"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#7353B5]" />
              <span>Upload Another Photo</span>
            </button>
          )}

          {onSwitchTask && (
            <>
              <button
                onClick={() => onSwitchTask('find')}
                className="px-3 py-1.5 rounded-xl bg-[#FFE5D8] hover:bg-[#FDD0BB] text-orange-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                aria-label="Switch to Find an Object"
              >
                <Search className="w-3.5 h-3.5 text-orange-800" />
                <span>Go to Find Object</span>
              </button>
              <button
                onClick={() => onSwitchTask('read')}
                className="px-3 py-1.5 rounded-xl bg-[#E8F1FF] hover:bg-[#D5E5FF] text-blue-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                aria-label="Switch to Read Text (OCR)"
              >
                <FileText className="w-3.5 h-3.5 text-blue-800" />
                <span>Go to Read Text (OCR)</span>
              </button>
            </>
          )}

          {selectedImage && (
            <button
              onClick={() => setAutoContinuous(!autoContinuous)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                autoContinuous
                  ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm animate-pulse'
                  : 'bg-white text-[#392743] border-[#392743]/15 hover:bg-[#FFF9F0]'
              }`}
              aria-label="Toggle continuous auto-scan mode"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{autoContinuous ? 'Auto-Scan On' : 'Auto-Scan'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Intro Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#392743] mb-1">
          Describe Surroundings & Vision Intelligence
        </h2>
        <p className="text-xs sm:text-sm text-[#392743]/70 leading-relaxed">
          Accurately detects <strong>doors, door latches, windows, ceiling fans, people, and human actions/gestures</strong> with natural <strong>left side, center, and right side</strong> directional guidance.
        </p>
      </div>

      {/* Input zone */}
      <ImageInputZone
        selectedImage={selectedImage}
        onImageSelected={handleImageSelected}
        onClearImage={handleClearImage}
        isLoading={isLoading}
      />

      {/* When image is loaded */}
      {selectedImage && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Visual Canvas & Detection Trigger */}
          <div className="lg:col-span-7 space-y-4">
            <BoundingBoxCanvas
              imageSrc={selectedImage}
              detections={result?.detections || []}
              highlightLabel={selectedInspection?.label}
              selectedDetectionId={selectedInspection ? `det-${selectedInspection.label}` : undefined}
              onImageReady={(img) => {
                imageElementRef.current = img;
              }}
              highContrast={highContrast}
            />

            {/* Threshold and Primary Trigger */}
            <div className="p-5 bg-white rounded-2xl border border-[#392743]/10 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <label htmlFor="conf-slider" className="text-xs font-bold text-[#392743] block">
                    Detection Sensitivity Filter
                  </label>
                  <span className="text-[11px] text-[#392743]/60">
                    Lower threshold captures subtle doors, windows, and background items
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-[#7353B5] tabular-nums px-2 py-0.5 rounded bg-[#7353B5]/10">
                  {Math.round(confidence * 100)}%
                </span>
              </div>
              <input
                id="conf-slider"
                type="range"
                min="0.10"
                max="0.65"
                step="0.05"
                value={confidence}
                onChange={(e) => setConfidence(parseFloat(e.target.value))}
                className="w-full accent-[#7353B5] cursor-pointer"
              />

              {/* Laptop Camera Left-Right Alignment Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FFF9F0] border border-[#392743]/10">
                <button
                  onClick={handleFlipImage}
                  disabled={isLoading || isFlipping}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Flips the photo horizontally so left and right match your real-world perspective"
                >
                  <FlipHorizontal className={`w-3.5 h-3.5 text-amber-700 ${isFlipping ? 'animate-spin' : ''}`} />
                  <span>{isFlipping ? 'Flipping...' : 'Flip Photo (Left ↔ Right)'}</span>
                </button>

                <button
                  onClick={() => {
                    const nextVal = !invertLeftRight;
                    setInvertLeftRight(nextVal);
                    speechService.speak(
                      nextVal
                        ? 'Laptop camera perspective enabled. Left and right cues are inverted.'
                        : 'Laptop camera perspective disabled.'
                    );
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    invertLeftRight
                      ? 'bg-[#7353B5] text-white border-[#7353B5] shadow-2xs'
                      : 'bg-white text-[#392743] border-[#392743]/15 hover:bg-[#FFF9F0]'
                  }`}
                  title="Inverts spatial directions (left vs right) for laptop webcams"
                >
                  <span>Laptop Invert Directions:</span>
                  <span className="font-bold">{invertLeftRight ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleRunDescribe(false)}
                  disabled={isLoading}
                  className="flex-1 py-3.5 px-5 rounded-xl bg-[#7353B5] text-white font-bold text-sm hover:bg-[#5E409B] disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7353B5] cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Scanning Doors, Windows, People & Gestures...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Describe My Surroundings & People</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleClearImage}
                  disabled={isLoading}
                  className="px-4 py-3.5 rounded-xl bg-white border border-[#392743]/20 hover:bg-[#FFF9F0] text-[#392743] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Choose a different image file"
                >
                  <ArrowLeft className="w-4 h-4 text-[#7353B5]" />
                  <span>Choose Another Photo</span>
                </button>
              </div>
            </div>

            {/* Ambient Lighting & Environmental Vision Card */}
            {lighting && (
              <div className="p-4 bg-white rounded-2xl border border-[#392743]/10 shadow-sm flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      lighting.lightingLevel === 'Bright & Clear'
                        ? 'bg-amber-100 text-amber-700'
                        : lighting.lightingLevel === 'Moderate Light'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#392743]">
                        Ambient Lighting: {lighting.lightingLevel}
                      </span>
                      <span className="text-[11px] font-mono text-[#392743]/50 tabular-nums">
                        ({Math.round((lighting.averageLuminance / 255) * 100)}% lux)
                      </span>
                    </div>
                    <p className="text-xs text-[#392743]/70 mt-0.5">
                      {lighting.recommendation}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleAnnounceLighting}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#FFF9F0] text-[#7353B5] border border-[#7353B5]/30 hover:bg-[#EAE1D2] shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
                  aria-label="Speak lighting condition"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Hear</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Audio Output, Gestures & Results */}
          <div className="lg:col-span-5 space-y-4">
            {error && (
              <div className="p-4 bg-[#FFE5D8] rounded-2xl text-xs text-[#9A3412] flex items-center justify-between gap-3 shadow-sm border border-orange-200">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-orange-600" />
                  <div>
                    <div className="font-bold mb-0.5">Analysis Notice</div>
                    <div>{error}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleRunDescribe(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#9A3412] text-white font-bold text-xs hover:bg-[#7C2D12] transition-colors shrink-0 cursor-pointer shadow-2xs"
                >
                  Retry Analysis
                </button>
              </div>
            )}

            {/* Speech Player */}
            {result && (
              <div className="space-y-4">
                <SpeechController
                  currentText={
                    `${result.navigation_guidance || result.scene_description}. ${result.human_activities ? 'People activities: ' + result.human_activities : ''}`
                  }
                  autoSpeak={true}
                />

                {/* Primary Spoken Description Card */}
                <div className="p-5 bg-white rounded-2xl border border-[#392743]/10 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs text-[#392743]/60">
                    <span className="font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5 text-[#7353B5]">
                      <Compass className="w-3.5 h-3.5" />
                      Directional Guidance (Left / Center / Right)
                    </span>
                    <span className="font-mono tabular-nums text-[11px]">
                      {result.processing_time_ms}ms · {result.model_status}
                    </span>
                  </div>
                  <blockquote className="text-base font-bold text-[#392743] leading-relaxed p-4 bg-[#FFF9F0] rounded-xl border-l-4 border-[#7353B5]">
                    "{result.navigation_guidance || result.scene_description}"
                  </blockquote>
                </div>

                {/* What the person is doing & Gestures Card */}
                {result.human_activities && result.human_activities.trim().length > 0 && (
                  <div className="p-4.5 bg-[#DDF3E5]/90 rounded-2xl border border-emerald-300 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 uppercase tracking-wider text-[11px]">
                        <User className="w-4 h-4 text-emerald-800" />
                        <span>What the Person is Doing & Gestures</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 font-bold">
                        Activity Detected
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-emerald-950 leading-relaxed bg-white/80 p-3 rounded-xl border border-emerald-200">
                      {result.human_activities}
                    </p>
                    <button
                      onClick={() => speechService.speak(`Person activity: ${result.human_activities}`)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Hear Person's Action</span>
                    </button>
                  </div>
                )}

                {/* Visible OCR Text Banner if visible in the scene */}
                {result.visible_text && result.visible_text.trim().length > 0 && (
                  <div className="p-4 bg-[#E8F1FF] rounded-2xl border border-blue-200 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950 uppercase tracking-wider text-[10px]">
                        <BookOpen className="w-3.5 h-3.5 text-blue-700" />
                        <span>Visible Text / Labels Found in Photo</span>
                      </div>
                      {onSwitchTask && (
                        <button
                          onClick={() => onSwitchTask('read')}
                          className="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Open in OCR</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="p-3 rounded-xl bg-white/90 text-xs font-medium text-[#392743] whitespace-pre-wrap border border-blue-100">
                      "{result.visible_text}"
                    </div>
                    <button
                      onClick={() => speechService.speak(`Text visible in photo: ${result.visible_text}`)}
                      className="px-3 py-1 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>Read This Text Aloud</span>
                    </button>
                  </div>
                )}

                {/* Object Detailed Inspector Card */}
                {selectedInspection && (
                  <div className="p-4 bg-white rounded-2xl border border-[#392743]/10 shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#392743] uppercase tracking-wider text-[10px]">
                        <Info className="w-3.5 h-3.5 text-[#7353B5]" />
                        <span>Focused Object Inspection</span>
                      </div>
                      <span className="text-xs font-bold text-[#7353B5] capitalize">
                        {selectedInspection.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-xl bg-[#FFF9F0] border border-[#392743]/10 flex items-center gap-2">
                        <Palette className="w-3.5 h-3.5 text-[#7353B5] shrink-0" />
                        <div>
                          <div className="text-[10px] text-[#392743]/60">Visual Tone</div>
                          <div className="font-bold text-[#392743]">{selectedInspection.dominantColor}</div>
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-[#FFF9F0] border border-[#392743]/10 flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <div>
                          <div className="text-[10px] text-[#392743]/60">Depth Prominence</div>
                          <div className="font-bold text-[#392743]">{selectedInspection.sizeCategory}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Detected Objects List with click to inspect */}
                <div className="p-5 bg-white rounded-2xl border border-[#392743]/10 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[#392743]">
                    <span>Detected Objects & Architectural Items ({result.detections.length})</span>
                    <span className="text-[11px] text-[#392743]/60">Tap any item to hear detail</span>
                  </div>

                  {result.detections.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[#392743]/60">
                      No objects met the {Math.round(confidence * 100)}% sensitivity threshold.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {result.detections.map((det) => {
                        const isSelected = selectedInspection?.label === det.label;
                        const sideLabel = det.sideDirection || (det.position === 'center' ? 'In Center' : det.position === 'left' ? 'Left Side' : 'Right Side');

                        return (
                          <button
                            key={det.id}
                            onClick={() => handleInspectObject(det)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#7353B5]/10 border-[#7353B5] ring-1 ring-[#7353B5]'
                                : 'bg-[#FFF9F0]/70 border-[#392743]/10 hover:border-[#7353B5]/40 hover:bg-white'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-[#392743] capitalize text-sm">
                                  {det.label}
                                </span>
                                <span className="text-[#392743]/40">·</span>
                                <span className="text-[#392743]/70 font-mono tabular-nums">
                                  {Math.round(det.confidence * 100)}%
                                </span>
                                {det.verticalPosition && (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-[#7353B5] border border-[#7353B5]/20">
                                    {det.verticalPosition}
                                  </span>
                                )}
                              </div>
                              {det.activityOrDetails && (
                                <div className="text-[11px] text-[#392743]/75 mt-0.5 italic">
                                  {det.activityOrDetails}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1 font-bold text-[#7353B5] bg-white px-2.5 py-1 rounded-lg border border-[#7353B5]/20 shadow-2xs shrink-0">
                              <Compass className="w-3.5 h-3.5 text-[#7353B5]" />
                              <span className="capitalize whitespace-nowrap">{sideLabel}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!result && !isLoading && (
              <div className="p-8 bg-white/80 rounded-2xl border border-[#392743]/10 text-center space-y-3 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-[#FFF9F0] border border-[#392743]/10 flex items-center justify-center text-[#7353B5] mx-auto">
                  <Eye className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-[#392743]">
                  Ready to Describe Scene
                </h4>
                <p className="text-xs text-[#392743]/70 max-w-sm mx-auto leading-relaxed">
                  Click "Describe My Surroundings & People" above to detect doors (open/closed), window grills, fans, people and their gestures, and surrounding objects.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
