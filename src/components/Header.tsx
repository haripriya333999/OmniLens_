import React, { useState, useRef, useEffect } from 'react';
import {
  Sliders,
  BookOpen,
  Eye,
  Search,
  FileText,
  Cpu,
  ChevronDown,
  Footprints,
  Compass,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { ActiveTask, EngineMode } from '../types';
import { speechService } from '../services/speech';

interface HeaderProps {
  activeTask: ActiveTask;
  onSelectTask: (task: ActiveTask) => void;
  onOpenAccessibility: () => void;
  onOpenAbout: () => void;
  onOpenEngine: () => void;
  onOpenManual: () => void;
  engineMode: EngineMode;
  isBackendHealthy: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTask,
  onSelectTask,
  onOpenAccessibility,
  onOpenAbout,
  onOpenEngine,
  onOpenManual,
  engineMode,
  isBackendHealthy,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = speechService.subscribe((speaking) => {
      setIsSpeaking(speaking);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[#101820]/95 backdrop-blur-md text-[#FAF7F0] border-b border-white/10 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Title */}
        <button
          onClick={() => onSelectTask('describe')}
          className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5] rounded-2xl p-1"
          aria-label="OmniLens Workspace Home"
        >
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#006B66] to-[#57D6C5] p-0.5 shadow-lg shadow-[#006B66]/30 flex items-center justify-center group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#101820] rounded-[14px] flex items-center justify-center">
              <Compass className="w-6 h-6 text-[#57D6C5]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-white block leading-none">
                OmniLens
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md bg-[#57D6C5]/20 text-[#57D6C5] border border-[#57D6C5]/30 hidden sm:inline-block">
                AI + SafePath
              </span>
            </div>
            <p className="text-[11px] text-[#FAF7F0]/60 hidden md:block mt-0.5">
              Understand your world. Through sound.
            </p>
          </div>
        </button>

        {/* Middle: 4 Primary Core Actions */}
        <nav
          aria-label="Core Assistive Capabilities"
          className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-semibold overflow-x-auto py-1 scrollbar-none"
        >
          {/* 1. Describe Surroundings */}
          <button
            onClick={() => onSelectTask('describe')}
            className={`whitespace-nowrap shrink-0 transition-all py-2.5 px-3.5 sm:px-4 rounded-xl flex items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5] ${
              activeTask === 'describe'
                ? 'bg-gradient-to-r from-[#006B66] to-[#087F73] text-white font-bold shadow-md shadow-[#006B66]/20'
                : 'text-[#FAF7F0]/80 hover:text-white hover:bg-white/10'
            }`}
            aria-current={activeTask === 'describe' ? 'page' : undefined}
            aria-label="Describe Surroundings"
          >
            <Eye className="w-4 h-4 text-[#57D6C5]" />
            <span>Describe</span>
          </button>

          {/* 2. Find Object */}
          <button
            onClick={() => onSelectTask('find')}
            className={`whitespace-nowrap shrink-0 transition-all py-2.5 px-3.5 sm:px-4 rounded-xl flex items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5] ${
              activeTask === 'find'
                ? 'bg-gradient-to-r from-[#006B66] to-[#087F73] text-white font-bold shadow-md shadow-[#006B66]/20'
                : 'text-[#FAF7F0]/80 hover:text-white hover:bg-white/10'
            }`}
            aria-current={activeTask === 'find' ? 'page' : undefined}
            aria-label="Find an Object"
          >
            <Search className="w-4 h-4 text-[#57D6C5]" />
            <span>Find Object</span>
          </button>

          {/* 3. Read Text */}
          <button
            onClick={() => onSelectTask('read')}
            className={`whitespace-nowrap shrink-0 transition-all py-2.5 px-3.5 sm:px-4 rounded-xl flex items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5] ${
              activeTask === 'read'
                ? 'bg-gradient-to-r from-[#006B66] to-[#087F73] text-white font-bold shadow-md shadow-[#006B66]/20'
                : 'text-[#FAF7F0]/80 hover:text-white hover:bg-white/10'
            }`}
            aria-current={activeTask === 'read' ? 'page' : undefined}
            aria-label="Read Text Aloud"
          >
            <FileText className="w-4 h-4 text-[#57D6C5]" />
            <span>Read Text</span>
          </button>

          {/* 4. SafePath Navigation */}
          <button
            onClick={() => onSelectTask('safepath')}
            className={`whitespace-nowrap shrink-0 transition-all py-2.5 px-3.5 sm:px-4 rounded-xl flex items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5] ${
              activeTask === 'safepath'
                ? 'bg-gradient-to-r from-[#087F73] to-[#006B66] text-white font-bold shadow-md shadow-[#087F73]/30 border border-[#57D6C5]/40'
                : 'text-[#FAF7F0]/80 hover:text-white hover:bg-white/10'
            }`}
            aria-current={activeTask === 'safepath' ? 'page' : undefined}
            aria-label="SafePath Walking Navigation and Obstacle Sensor"
          >
            <Footprints className="w-4 h-4 text-[#57D6C5]" />
            <span>SafePath Nav</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#57D6C5] animate-ping" />
          </button>

          {/* 5. Live Stream */}
          <button
            onClick={() => onSelectTask('live')}
            className={`whitespace-nowrap shrink-0 transition-all py-2.5 px-3 sm:px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5] ${
              activeTask === 'live'
                ? 'bg-white/20 text-white font-bold'
                : 'text-[#FAF7F0]/60 hover:text-white hover:bg-white/10'
            }`}
            aria-current={activeTask === 'live' ? 'page' : undefined}
            aria-label="Continuous Live Stream View"
          >
            <span className="w-2 h-2 rounded-full bg-[#57D6C5] animate-pulse" />
            <span className="hidden lg:inline">Live Stream</span>
          </button>
        </nav>

        {/* Right: Manual, Audio Controls & Accessibility Settings */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quick Speech Repeat / Stop Indicator */}
          {isSpeaking && (
            <div className="flex items-center gap-1 bg-[#006B66]/30 border border-[#57D6C5]/30 rounded-xl px-2.5 py-1.5 animate-pulse">
              <Volume2 className="w-3.5 h-3.5 text-[#57D6C5]" />
              <button
                onClick={() => speechService.stop()}
                className="text-[10px] font-bold text-[#57D6C5] hover:text-white underline cursor-pointer ml-1"
                aria-label="Silence voice speech immediately"
              >
                Stop
              </button>
            </div>
          )}

          {/* How to Use / User Manual */}
          <button
            onClick={onOpenManual}
            className="py-2 px-3 sm:px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-[#FAF7F0] font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5]"
            aria-label="Open User Manual and Guide"
          >
            <BookOpen className="w-4 h-4 text-[#57D6C5]" />
            <span className="hidden sm:inline">Guide & Manual</span>
          </button>

          {/* Engine & Settings Dropdown */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className="p-2 sm:px-3 sm:py-2 text-xs font-semibold text-[#FAF7F0]/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5]"
              aria-label="More options, engine models and benchmarks"
              aria-expanded={isMoreOpen}
            >
              <Cpu className="w-4 h-4 text-[#57D6C5]" />
              <ChevronDown className="w-3.5 h-3.5 text-[#FAF7F0]/60" />
            </button>

            {isMoreOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#16212B] border border-white/15 shadow-2xl py-2 z-50 text-xs text-[#FAF7F0]">
                <button
                  onClick={() => {
                    setIsMoreOpen(false);
                    onOpenAbout();
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex items-center gap-2.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#57D6C5]" />
                  <div>
                    <div className="font-bold text-white">Model Specs & Verification</div>
                    <div className="text-[10px] text-[#FAF7F0]/60">Gemini 3.8 Flash & OpenCV 5</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsMoreOpen(false);
                    onOpenEngine();
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex items-center gap-2.5 cursor-pointer border-t border-white/10"
                >
                  <Cpu className="w-4 h-4 text-[#087F73]" />
                  <div>
                    <div className="font-bold flex items-center gap-1.5 text-white">
                      <span>Engine Settings</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isBackendHealthy ? 'bg-[#57D6C5]' : 'bg-amber-400'
                        }`}
                      />
                    </div>
                    <div className="text-[10px] text-[#FAF7F0]/60">
                      {engineMode === 'gemini-vision' ? 'Active: Multimodal Cascade' : engineMode}
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Accessibility Settings */}
          <button
            onClick={onOpenAccessibility}
            className="py-2 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-[#006B66] to-[#087F73] hover:from-[#005753] hover:to-[#006B66] text-white font-bold text-xs shadow-md shadow-[#006B66]/20 transition-all flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5]"
            aria-label="Open accessibility settings dialog"
          >
            <Sliders className="w-3.5 h-3.5 text-[#57D6C5]" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
