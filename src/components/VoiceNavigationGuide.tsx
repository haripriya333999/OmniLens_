import React, { useEffect, useState } from 'react';
import { Eye, Search, FileText, Square, RotateCcw, Compass } from 'lucide-react';
import { ActiveTask } from '../types';
import { speechService } from '../services/speech';

interface VoiceNavigationGuideProps {
  activeTask: ActiveTask;
  onSelectTask: (task: ActiveTask) => void;
  isSpeaking: boolean;
  onOpenAccessibility: () => void;
}

export const VoiceNavigationGuide: React.FC<VoiceNavigationGuideProps> = ({
  activeTask,
  onSelectTask,
  isSpeaking,
}) => {
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');

  const announce = (msg: string) => {
    setLiveAnnouncement(msg);
    speechService.speak(msg);
  };

  // Keyboard shortcut listener for blind & keyboard users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (e.key === 'Escape') {
          speechService.stop();
          announce('Speech stopped.');
          target.blur();
        }
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'escape' || key === 's') {
        e.preventDefault();
        speechService.stop();
        announce('Speech stopped.');
      } else if (key === 'a') {
        e.preventDefault();
        speechService.repeat();
      } else if (key === 'd' || key === '1') {
        e.preventDefault();
        onSelectTask('describe');
        announce('Switched to Describe Surroundings.');
      } else if (key === 'f' || key === '2') {
        e.preventDefault();
        onSelectTask('find');
        announce('Switched to Find an Object.');
      } else if (key === 'r' || key === '3') {
        e.preventDefault();
        onSelectTask('read');
        announce('Switched to Read Text and Signs.');
      } else if (key === 'h' || key === '?') {
        e.preventDefault();
        announce(
          'OmniLens Keyboard Navigation: Press D to describe surroundings, F to find an object, R to read signs, A to repeat speech, and Escape to stop speaking.'
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectTask]);

  return (
    <div
      className="bg-[#392743] text-white p-3.5 sm:p-4 rounded-2xl shadow-md border border-[#7353B5]/30 mb-6"
      role="region"
      aria-label="Blind User Audio Navigation Bar"
    >
      {/* Hidden Live Region for Screen Readers */}
      <div role="status" aria-live="assertive" className="sr-only">
        {liveAnnouncement}
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: Directional & Speech Indicator */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              isSpeaking
                ? 'bg-[#7353B5] text-white animate-pulse'
                : 'bg-white/10 text-white'
            }`}
            aria-hidden="true"
          >
            <Compass className="w-5 h-5 text-[#FFE5D8]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-wide text-white">
                Directional Voice Guide
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#7353B5]/40 text-[#DDF3E5]">
                Left · Center · Right
              </span>
            </div>
            <p className="text-xs text-white/70">
              Announces natural human positions and what persons are doing.
            </p>
          </div>
        </div>

        {/* Tactile Voice Action Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          <button
            onClick={() => {
              onSelectTask('describe');
              announce('Describe Surroundings activated.');
            }}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#FFE5D8] cursor-pointer ${
              activeTask === 'describe'
                ? 'bg-[#7353B5] text-white ring-2 ring-white/30 shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            aria-label="Describe Surroundings. Shortcut: key D"
          >
            <Eye className="w-4 h-4 text-[#DDF3E5]" />
            <span>Describe (D)</span>
          </button>

          <button
            onClick={() => {
              onSelectTask('find');
              announce('Find an Object activated. Type or select an object.');
            }}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#FFE5D8] cursor-pointer ${
              activeTask === 'find'
                ? 'bg-[#7353B5] text-white ring-2 ring-white/30 shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            aria-label="Find an Object. Shortcut: key F"
          >
            <Search className="w-4 h-4 text-[#FFE5D8]" />
            <span>Find Object (F)</span>
          </button>

          <button
            onClick={() => {
              onSelectTask('read');
              announce('Read Text and Signs activated.');
            }}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#FFE5D8] cursor-pointer ${
              activeTask === 'read'
                ? 'bg-[#7353B5] text-white ring-2 ring-white/30 shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            aria-label="Read Text. Shortcut: key R"
          >
            <FileText className="w-4 h-4 text-[#DDF3E5]" />
            <span>Read Signs (R)</span>
          </button>

          <div className="h-6 w-px bg-white/20 hidden sm:block mx-1" />

          {/* Repeat Button */}
          <button
            onClick={() => {
              speechService.repeat();
            }}
            className="p-2 text-xs font-medium rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Repeat last description (Key A)"
            aria-label="Repeat last spoken description"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Stop Speaking Button */}
          <button
            onClick={() => {
              speechService.stop();
              announce('Speech stopped.');
            }}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Stop voice output (Escape or S)"
            aria-label="Stop voice output"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop (Esc)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
