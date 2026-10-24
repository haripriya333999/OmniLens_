import React, { useState, useRef } from 'react';
import {
  Search,
  Compass,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  Eye,
  FileText,
  ArrowLeft,
  Volume2,
  Mic,
  MicOff,
  FlipHorizontal,
} from 'lucide-react';
import { FindResponse, ActiveTask, Detection } from '../types';
import { apiService } from '../services/apiService';
import { speechService } from '../services/speech';
import { ImageInputZone } from './ImageInputZone';
import { BoundingBoxCanvas } from './BoundingBoxCanvas';
import { SpeechController } from './SpeechController';
import { inspectObjectRegion } from '../services/visionAnalysis';
import { flipImageHorizontally, flipDetectionsHorizontally, invertSpatialText } from '../services/imageUtils';

interface FindObjectViewProps {
  highContrast?: boolean;
  onSwitchTask?: (task: ActiveTask) => void;
}

const COMMON_SUGGESTIONS = [
  'phone',
  'glasses',
  'person',
  'fan',
  'light',
  'door',
  'window',
  'cookie packet',
  'bottle',
  'chair',
  'desk',
  'laptop',
  'clothes',
  'switchboard',
  'backpack',
];

export const FindObjectView: React.FC<FindObjectViewProps> = ({
  highContrast = false,
  onSwitchTask,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<File | undefined>(undefined);
  const [query, setQuery] = useState<string>('door');
  const [confidence, setConfidence] = useState<number>(0.20);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FindResponse | null>(null);
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
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  const handleImageSelected = (src: string, file?: File) => {
    setSelectedImage(src);
    setActiveFile(file);
    setResult(null);
    setError(null);
    speechService.stop();
  };

  const [isMicListening, setIsMicListening] = useState<boolean>(false);
  const voiceSearchRecRef = useRef<any>(null);

  const handleClearImage = () => {
    setSelectedImage(null);
    setActiveFile(undefined);
    setResult(null);
    setError(null);
    speechService.stop();
  };

  const handleFlipImage = async () => {
    if (!selectedImage || isFlipping) return;
    setIsFlipping(true);
    try {
      const { dataUrl, file } = await flipImageHorizontally(selectedImage);
      setSelectedImage(dataUrl);
      setActiveFile(file);

      if (result && result.matches.length > 0) {
        const imgW = imageElementRef.current?.naturalWidth || imageElementRef.current?.width || 640;
        const flippedMatches = flipDetectionsHorizontally(result.matches, imgW);
        const flippedSummary = invertSpatialText(result.spoken_summary);
        setResult({
          ...result,
          matches: flippedMatches,
          spoken_summary: flippedSummary,
          position: result.position === 'left' ? 'right' : result.position === 'right' ? 'left' : 'center',
          side_direction: result.side_direction
            ? invertSpatialText(result.side_direction)
            : undefined,
        });
        speechService.speak('Photo flipped horizontally. Spatial directions inverted.');
      } else {
        speechService.speak('Photo flipped horizontally.');
      }
    } catch (err) {
      console.error('Failed to flip image:', err);
    } finally {
      setIsFlipping(false);
    }
  };

  const handleVoiceSearch = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      speechService.speak('Voice search is not supported in this browser. Please type the object name.');
      return;
    }

    if (isMicListening) {
      if (voiceSearchRecRef.current) {
        try { voiceSearchRecRef.current.stop(); } catch (e) {}
      }
      setIsMicListening(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = 'en-US';
      rec.interimResults = false;

      rec.onstart = () => {
        setIsMicListening(true);
        speechService.speak('Listening for object name.');
      };

      rec.onresult = (e: any) => {
        const spoken = e.results[0][0].transcript.trim().toLowerCase();
        const cleanSpoken = spoken.replace(/find\s+(my\s+|the\s+|a\s+|an\s+)?/g, '').trim();
        setQuery(cleanSpoken || spoken);
        setIsMicListening(false);
        handleRunFind(cleanSpoken || spoken);
      };

      rec.onerror = () => {
        setIsMicListening(false);
      };

      rec.onend = () => {
        setIsMicListening(false);
      };

      voiceSearchRecRef.current = rec;
      rec.start();
    } catch (e) {
      setIsMicListening(false);
    }
  };

  const handleRunFind = async (targetQuery: string = query, overrideConfidence?: number) => {
    if (!selectedImage || !imageElementRef.current) {
      setError('Please provide or capture an image first.');
      return;
    }
    if (!targetQuery.trim()) {
      setError('Please enter an object name to find (e.g. door, window, bottle).');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const effectiveConf = typeof overrideConfidence === 'number' ? overrideConfidence : confidence;
      const response = await apiService.findObject(
        imageElementRef.current,
        targetQuery.trim(),
        activeFile,
        effectiveConf,
        invertLeftRight
      );

      // Enhance with real color inspection if match found
      if (response.found && response.matches.length > 0 && imageElementRef.current) {
        const primaryMatch = response.matches[0];
        const inspection = inspectObjectRegion(
          imageElementRef.current,
          primaryMatch.box,
          primaryMatch.label,
          primaryMatch.confidence,
          primaryMatch.position
        );
        const side = primaryMatch.sideDirection || (primaryMatch.position === 'center' ? 'in the center' : `on your ${primaryMatch.position} side`);
        const elev = primaryMatch.verticalPosition ? ` ${primaryMatch.verticalPosition}` : '';
        const details = primaryMatch.activityOrDetails ? ` (${primaryMatch.activityOrDetails})` : '';
        const enrichedSpeech = `${primaryMatch.label.toUpperCase()} detected ${side}${elev}${details} with ${inspection.dominantColor} visual tone.`;
        response.spoken_summary = enrichedSpeech;
      }
      setResult(response);
    } catch (err: any) {
      console.error('Find object failed:', err);
      setError(err?.message || 'Failed to search for object.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Mode Navigation Banner */}
      <div className="p-3.5 bg-white rounded-2xl border border-[#392743]/15 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#392743]">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-orange-950">Mode: 2. Find an Object</span>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {selectedImage && (
            <button
              onClick={handleClearImage}
              className="px-3.5 py-1.5 rounded-xl bg-[#FFF9F0] hover:bg-[#EAE1D2] text-[#392743] font-bold text-xs border border-[#392743]/20 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Clear active image and upload another"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#7353B5]" />
              <span>Upload Another Photo</span>
            </button>
          )}

          {onSwitchTask && (
            <>
              <button
                onClick={() => onSwitchTask('describe')}
                className="px-3 py-1.5 rounded-xl bg-[#DDF3E5] hover:bg-[#C8EBD4] text-emerald-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                aria-label="Switch to Describe Surroundings"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-800" />
                <span>1. Describe Scene</span>
              </button>
              <button
                onClick={() => onSwitchTask('read')}
                className="px-3 py-1.5 rounded-xl bg-[#E8F1FF] hover:bg-[#D5E5FF] text-blue-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                aria-label="Switch to Read Text (OCR)"
              >
                <FileText className="w-3.5 h-3.5 text-blue-800" />
                <span>3. Read Text (OCR)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Intro Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#392743] mb-1">
          Find an Object
        </h2>
        <p className="text-xs sm:text-sm text-[#392743]/70 leading-relaxed">
          Locate doors, door handles, windows, fans, bottles, packets, or personal belongings and hear their exact <strong>left side, center, or right side</strong> positions.
        </p>
      </div>

      {/* Input zone */}
      <ImageInputZone
        selectedImage={selectedImage}
        onImageSelected={handleImageSelected}
        onClearImage={handleClearImage}
        isLoading={isLoading}
      />

      {selectedImage && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Canvas & Query Box */}
          <div className="lg:col-span-7 space-y-4">
            <BoundingBoxCanvas
              imageSrc={selectedImage}
              detections={result?.matches || []}
              highlightLabel={result?.requested_object}
              onImageReady={(img) => {
                imageElementRef.current = img;
              }}
              highContrast={highContrast}
            />

            {/* Search query input box */}
            <div className="p-5 bg-white rounded-2xl border border-[#392743]/10 shadow-sm space-y-4">
              <div>
                <label
                  htmlFor="object-query-input"
                  className="text-xs font-bold text-[#392743] block mb-1.5"
                >
                  What object or architectural item are you looking for?
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-[#392743]/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="object-query-input"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRunFind();
                      }
                    }}
                    placeholder="e.g. door, window, fan, cookie packet, bottle, glasses, person"
                    className="w-full pl-10 pr-12 py-3 rounded-xl border border-[#392743]/20 bg-[#FFF9F0]/40 text-sm font-semibold text-[#392743] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7353B5]"
                  />
                  <button
                    type="button"
                    onClick={handleVoiceSearch}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all cursor-pointer ${
                      isMicListening
                        ? 'bg-emerald-500 text-white animate-pulse'
                        : 'text-[#7353B5] hover:bg-[#7353B5]/10'
                    }`}
                    title={isMicListening ? 'Listening... speak object name' : 'Click to speak object name'}
                    aria-label={isMicListening ? 'Listening for object name' : 'Speak object name using microphone'}
                  >
                    {isMicListening ? <Mic className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Suggestions */}
              <div>
                <span className="text-[11px] font-bold text-[#392743]/65 block mb-1.5">
                  Suggested common items & fixtures:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        setQuery(item);
                        handleRunFind(item);
                      }}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        query.toLowerCase() === item
                          ? 'bg-[#7353B5] text-white border-[#7353B5] shadow-2xs'
                          : 'bg-[#FFF9F0] text-[#392743] border-[#392743]/15 hover:border-[#7353B5]/50'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* Confidence filter */}
              <div className="pt-2 border-t border-[#392743]/10 flex items-center justify-between gap-4">
                <span className="text-xs text-[#392743]/70 font-medium">Detection sensitivity filter</span>
                <span className="text-xs font-mono font-bold text-[#7353B5] tabular-nums px-2 py-0.5 rounded bg-[#7353B5]/10">
                  {Math.round(confidence * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.65"
                step="0.05"
                value={confidence}
                onChange={(e) => setConfidence(parseFloat(e.target.value))}
                className="w-full accent-[#7353B5] cursor-pointer"
                aria-label="Confidence threshold"
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
                  onClick={() => handleRunFind()}
                  disabled={isLoading || !query.trim()}
                  className="flex-1 py-3.5 px-4 rounded-xl bg-[#7353B5] text-white font-bold text-sm hover:bg-[#5E409B] disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7353B5] cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Searching for "{query}"...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Find "{query || 'Object'}" in Image</span>
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
          </div>

          {/* Right: Results & Audio Feedback */}
          <div className="lg:col-span-5 space-y-4">
            {error && (
              <div className="p-4 bg-[#FFE5D8] rounded-2xl text-xs text-[#9A3412] flex items-center justify-between gap-3 border border-orange-200 shadow-sm">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-orange-600" />
                  <div>
                    <div className="font-bold mb-0.5">Search Notice</div>
                    <div>{error}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleRunFind()}
                  className="px-3.5 py-1.5 rounded-xl bg-[#9A3412] text-white font-bold text-xs hover:bg-[#7C2D12] transition-colors shrink-0 cursor-pointer shadow-2xs"
                >
                  Retry Search
                </button>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <SpeechController
                  currentText={result.spoken_summary}
                  autoSpeak={true}
                />

                {/* Status Announcement Banner */}
                <div
                  className={`p-5 rounded-2xl border shadow-sm space-y-3 ${
                    !result.is_category_supported
                      ? 'bg-amber-50 border-amber-200'
                      : result.found
                      ? 'bg-[#E1F5EA] border-emerald-200'
                      : 'bg-rose-50 border-rose-200'
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-2.5">
                    {!result.is_category_supported ? (
                      <HelpCircle className="w-5 h-5 text-amber-700 shrink-0" />
                    ) : result.found ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-700 shrink-0" />
                    )}
                    <div className="font-bold text-sm text-[#392743]">
                      {!result.is_category_supported
                        ? 'Unsupported Model Category'
                        : result.found
                        ? 'Object Found in Image'
                        : 'Object Not Detected'}
                    </div>
                  </div>

                  <blockquote className="text-base font-bold text-[#392743] leading-relaxed p-3.5 bg-white/90 rounded-xl border-l-4 border-[#7353B5]">
                    "{result.spoken_summary}"
                  </blockquote>

                  {/* Agentic Vision Re-aiming Guidance Card */}
                  {result.agentic_guidance && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900">
                        <Compass className="w-4 h-4 text-amber-700" />
                        <span>Agentic Vision Re-aiming Guidance:</span>
                      </div>
                      <p className="text-amber-950 font-medium leading-relaxed">
                        {result.agentic_guidance}
                      </p>

                      {!result.found && (
                        <div className="pt-1 flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              speechService.speak('Checking view again. Hold camera steady.');
                              handleRunFind();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>Re-aim & Check Again</span>
                          </button>

                          {result.has_sub_threshold && result.sub_threshold_candidates && result.sub_threshold_candidates.length > 0 && (
                            <button
                              onClick={() => {
                                const newThresh = Math.max(0.10, Math.floor(result.sub_threshold_candidates![0].confidence * 100) / 100);
                                setConfidence(newThresh);
                                speechService.speak(`Sensitivity lowered to ${Math.round(newThresh * 100)} percent. Searching again.`);
                                setTimeout(() => handleRunFind(undefined, newThresh), 200);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 font-bold text-xs cursor-pointer shadow-2xs"
                            >
                              <span>Lower Sensitivity to {Math.round(result.sub_threshold_candidates[0].confidence * 100)}%</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {result.found && result.matches.length > 0 && (
                    <div className="pt-2 border-t border-[#392743]/10 space-y-2">
                      <div className="text-xs font-bold text-[#392743]">
                        Spatial Location Breakdown
                      </div>
                      {result.matches.map((m: Detection, idx: number) => (
                        <div
                          key={m.id || idx}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white text-xs border border-[#392743]/10 shadow-2xs"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5 font-bold text-[#392743]">
                              <span className="capitalize">{m.label}</span>
                              <span className="text-[#392743]/40">·</span>
                              <span className="font-mono text-[#7353B5]">
                                {Math.round(m.confidence * 100)}% confidence
                              </span>
                            </div>
                            {m.activityOrDetails && (
                              <div className="text-[11px] text-[#392743]/70 italic truncate">
                                {m.activityOrDetails}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 font-bold text-emerald-800 text-xs shrink-0">
                            <Compass className="w-3.5 h-3.5 text-emerald-700" />
                            <span>
                              {m.sideDirection ||
                                (m.position === 'center'
                                  ? 'In Center'
                                  : m.position === 'left'
                                  ? 'Left Side'
                                  : 'Right Side')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!result && !isLoading && (
              <div className="p-8 bg-white/80 rounded-2xl border border-[#392743]/10 text-center space-y-3 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-[#FFF9F0] border border-[#392743]/10 flex items-center justify-center text-[#7353B5] mx-auto">
                  <Search className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-[#392743]">
                  Ready to Search Scene
                </h4>
                <p className="text-xs text-[#392743]/70 max-w-xs mx-auto leading-relaxed">
                  Type an object (e.g. door, window, cookie packet, bottle, person) to locate it in the photo.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
