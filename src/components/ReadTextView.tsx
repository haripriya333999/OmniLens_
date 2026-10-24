import React, { useState, useRef } from 'react';
import {
  FileText,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Volume2,
  BookOpen,
  Eye,
  Search,
  ArrowLeft,
  Sparkles,
  FlipHorizontal,
} from 'lucide-react';
import { OCRResponse, ActiveTask } from '../types';
import { apiService } from '../services/apiService';
import { speechService } from '../services/speech';
import { ImageInputZone } from './ImageInputZone';
import { SpeechController } from './SpeechController';
import { flipImageHorizontally } from '../services/imageUtils';

interface ReadTextViewProps {
  highContrast?: boolean;
  onSwitchTask?: (task: ActiveTask) => void;
}

export const ReadTextView: React.FC<ReadTextViewProps> = ({
  highContrast = false,
  onSwitchTask,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<File | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OCRResponse | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  const handleImageSelected = (src: string, file?: File) => {
    setSelectedImage(src);
    setActiveFile(file);
    setResult(null);
    setError(null);
    speechService.stop();
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setActiveFile(undefined);
    setResult(null);
    setError(null);
    speechService.stop();
  };

  const [isFlipping, setIsFlipping] = useState<boolean>(false);

  const handleFlipImage = async () => {
    if (!selectedImage || isFlipping) return;
    setIsFlipping(true);
    try {
      const { dataUrl, file } = await flipImageHorizontally(selectedImage);
      setSelectedImage(dataUrl);
      setActiveFile(file);
      setResult(null);
      speechService.speak('Photo flipped horizontally to un-mirror text. Click Read Text to scan.');
    } catch (err) {
      console.error('Failed to flip image:', err);
    } finally {
      setIsFlipping(false);
    }
  };

  const handleRunOCR = async () => {
    if (!selectedImage || !imageElementRef.current) {
      setError('Please provide or capture an image containing text first.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiService.readText(
        imageElementRef.current,
        activeFile
      );
      setResult(response);
    } catch (err: any) {
      console.error('OCR failed:', err);
      setError(err?.message || 'Failed to extract text from the image.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = () => {
    if (result?.extracted_text) {
      navigator.clipboard.writeText(result.extracted_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Mode Navigation Banner */}
      <div className="p-3.5 bg-white rounded-2xl border border-[#392743]/15 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#392743]">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
          <span className="text-blue-950 font-bold">Mode: 3. Read Text & Signage (Neural OCR)</span>
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
                onClick={() => onSwitchTask('find')}
                className="px-3 py-1.5 rounded-xl bg-[#FFE5D8] hover:bg-[#FDD0BB] text-orange-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                aria-label="Switch to Find an Object"
              >
                <Search className="w-3.5 h-3.5 text-orange-800" />
                <span>2. Find Object</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Intro Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#392743] mb-1">
          Read Text & Signage (High-Accuracy OCR)
        </h2>
        <p className="text-xs sm:text-sm text-[#392743]/70 leading-relaxed">
          Extract exact text from badges, certificates, door plaques, medication bottles, blackboard notes, room signs, and product labels, and listen aloud.
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
          {/* Left: Image preview & Action */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative w-full rounded-2xl overflow-hidden bg-black/5 border border-[#392743]/15 flex items-center justify-center max-h-[480px] shadow-sm">
              <img
                ref={imageElementRef}
                src={selectedImage}
                alt="Document or sign to extract text from"
                className="max-h-[480px] w-full object-contain"
                crossOrigin="anonymous"
              />
            </div>

            {/* Laptop Camera Un-mirror Text Control */}
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FFF9F0] border border-[#392743]/10">
              <span className="text-xs text-[#392743]/70">
                Laptop camera mirrored the text backward?
              </span>
              <button
                onClick={handleFlipImage}
                disabled={isLoading || isFlipping}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Flips the photo horizontally so backward/mirrored text becomes readable"
              >
                <FlipHorizontal className={`w-3.5 h-3.5 text-amber-700 ${isFlipping ? 'animate-spin' : ''}`} />
                <span>{isFlipping ? 'Flipping...' : 'Flip Photo (Un-mirror Text)'}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleRunOCR}
                disabled={isLoading}
                className="flex-1 py-3.5 px-5 rounded-xl bg-[#7353B5] text-white font-bold text-sm hover:bg-[#5E409B] disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7353B5] cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Extracting Text with High-Precision Neural OCR...</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4" />
                    <span>Extract & Read Text Aloud</span>
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

          {/* Right: Extracted Text & Speech */}
          <div className="lg:col-span-6 space-y-4">
            {error && (
              <div className="p-4 bg-[#FFE5D8] rounded-2xl text-xs text-[#9A3412] flex items-center justify-between gap-3 border border-orange-200 shadow-sm">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-orange-600" />
                  <div>
                    <div className="font-bold mb-0.5">OCR Notice</div>
                    <div>{error}</div>
                  </div>
                </div>
                <button
                  onClick={handleRunOCR}
                  className="px-3.5 py-1.5 rounded-xl bg-[#9A3412] text-white font-bold text-xs hover:bg-[#7C2D12] transition-colors shrink-0 cursor-pointer shadow-2xs"
                >
                  Retry OCR
                </button>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <SpeechController
                  currentText={result.extracted_text || 'No readable text was found in the image.'}
                  autoSpeak={true}
                />

                {/* Extracted Text Content Box */}
                <div className="p-5 bg-white rounded-2xl border border-[#392743]/10 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-[#392743] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#7353B5]" />
                      <span>Extracted Text Content ({result.word_count} words)</span>
                    </div>
                    {result.extracted_text && (
                      <button
                        onClick={handleCopyText}
                        className="text-xs font-bold text-[#7353B5] hover:text-[#5E409B] flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg hover:bg-[#7353B5]/10 cursor-pointer"
                        aria-label="Copy extracted text to clipboard"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Text</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {result.extracted_text ? (
                    <div className="p-4 rounded-xl bg-[#FFF9F0] border border-[#392743]/10 max-h-72 overflow-y-auto whitespace-pre-wrap font-sans text-base font-semibold text-[#392743] leading-relaxed selection:bg-[#7353B5] selection:text-white">
                      {result.extracted_text}
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl bg-amber-50/70 border border-amber-200 text-center space-y-1">
                      <p className="text-xs font-bold text-amber-900">
                        No readable text recognized
                      </p>
                      <p className="text-[11px] text-amber-800/80">
                        The neural OCR engine did not find text in this view. Try capturing closer or with better lighting.
                      </p>
                    </div>
                  )}

                  {/* Lines breakdown */}
                  {result.lines.length > 1 && (
                    <div className="pt-2 border-t border-[#392743]/10 space-y-1.5">
                      <span className="text-[11px] font-bold text-[#392743]/65 block">
                        Recognized Text Segments ({result.lines.length}):
                      </span>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {result.lines.map((l, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-2 rounded-xl bg-[#FFF9F0]/80 text-xs text-[#392743] border border-[#392743]/5"
                          >
                            <span className="font-semibold pr-2 text-xs">
                              {l.text}
                            </span>
                            <span className="text-[10px] text-[#7353B5] font-mono font-bold tabular-nums shrink-0">
                              {Math.round(l.confidence * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-[#392743]/55 font-mono pt-1">
                    <span>Engine: {result.model_status}</span>
                    <span className="tabular-nums">{result.processing_time_ms}ms latency</span>
                  </div>
                </div>
              </div>
            )}

            {!result && !isLoading && (
              <div className="p-8 bg-white/80 rounded-2xl border border-[#392743]/10 text-center space-y-3 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-[#FFF9F0] border border-[#392743]/10 flex items-center justify-center text-[#7353B5] mx-auto">
                  <FileText className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-[#392743]">
                  Ready to Read Text
                </h4>
                <p className="text-xs text-[#392743]/70 max-w-xs mx-auto leading-relaxed">
                  Click "Extract & Read Text" to process badge titles, room numbers, door signs, medicine bottles, or letters with neural accuracy.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
