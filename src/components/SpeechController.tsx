import React, { useEffect, useState } from 'react';
import { Volume2, RotateCcw, Play, Square, Gauge, Sparkles } from 'lucide-react';
import { speechService } from '../services/speech';

interface SpeechControllerProps {
  currentText: string;
  autoSpeak?: boolean;
}

export const SpeechController: React.FC<SpeechControllerProps> = ({
  currentText,
  autoSpeak = false,
}) => {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [rate, setRate] = useState<number>(speechService.getRate());
  const [useAiVoice, setUseAiVoice] = useState<boolean>(speechService.getUseAiVoice());

  useEffect(() => {
    const unsubscribe = speechService.subscribe((speaking) => {
      setIsSpeaking(speaking);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (autoSpeak && currentText) {
      speechService.speak(currentText);
    }
  }, [currentText, autoSpeak]);

  const handlePlay = () => {
    if (currentText) {
      speechService.speak(currentText);
    }
  };

  const handleRepeat = () => {
    speechService.repeat();
  };

  const handleStop = () => {
    speechService.stop();
  };

  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    speechService.setRate(newRate);
    if (isSpeaking && currentText) {
      speechService.speak(currentText);
    }
  };

  const handleToggleAiVoice = () => {
    const nextVal = !useAiVoice;
    setUseAiVoice(nextVal);
    speechService.setUseAiVoice(nextVal);
  };

  const rates = [0.8, 1.0, 1.25, 1.5];

  return (
    <div
      className="p-4 bg-white rounded-2xl border border-[#392743]/10 shadow-sm flex flex-wrap items-center justify-between gap-4"
      role="region"
      aria-label="Speech and Audio Controls"
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
            isSpeaking
              ? 'bg-[#7353B5] text-white animate-pulse shadow-md'
              : 'bg-[#FFF9F0] text-[#7353B5] border border-[#7353B5]/20'
          }`}
          aria-hidden="true"
        >
          <Volume2 className={`w-5 h-5 ${isSpeaking ? 'scale-110' : 'opacity-80'}`} />
        </div>
        <div>
          <div className="text-sm font-bold text-[#392743] flex items-center gap-2">
            <span>{isSpeaking ? 'Speaking Output Aloud...' : 'Voice Audio Ready'}</span>
            {isSpeaking && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            )}
          </div>
          <div className="text-xs text-[#392743]/65">
            {isSpeaking ? 'Press Stop to silence speech' : 'Press Read Aloud or use shortcuts to listen'}
          </div>
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-2">
        {/* Read Aloud Button */}
        <button
          onClick={handlePlay}
          disabled={!currentText}
          className="px-4 py-2.5 text-xs font-bold rounded-xl bg-[#7353B5] text-white hover:bg-[#5E409B] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7353B5] cursor-pointer"
          aria-label="Read description aloud"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Read Aloud</span>
        </button>

        {/* Repeat Button */}
        <button
          onClick={handleRepeat}
          disabled={!speechService.getLastSpoken()}
          className="px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-[#FFF9F0] text-[#392743] hover:bg-[#EAE1D2] disabled:opacity-40 disabled:cursor-not-allowed border border-[#392743]/15 transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7353B5] cursor-pointer"
          aria-label="Repeat last spoken description"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Repeat</span>
        </button>

        {/* Stop Button */}
        <button
          onClick={handleStop}
          disabled={!isSpeaking}
          className="px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-[#FFE5D8] text-[#9A3412] hover:bg-[#FDD0BB] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 cursor-pointer"
          aria-label="Stop speaking"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Stop</span>
        </button>

        {/* Speed / Rate Selector */}
        <div className="flex items-center gap-1 pl-2 border-l border-[#392743]/15 text-xs text-[#392743]/70">
          <Gauge className="w-3.5 h-3.5 mr-0.5 text-[#7353B5]" />
          <span className="sr-only">Speech speed:</span>
          {rates.map((r) => (
            <button
              key={r}
              onClick={() => handleRateChange(r)}
              className={`px-2 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                rate === r
                  ? 'bg-[#392743] text-white shadow-2xs'
                  : 'bg-transparent hover:bg-[#FFF9F0] text-[#392743]/80'
              }`}
              aria-label={`Set speech speed to ${r} times normal`}
              aria-pressed={rate === r}
            >
              {r}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
