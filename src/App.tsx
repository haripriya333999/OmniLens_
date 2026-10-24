import React, { useState, useEffect } from 'react';
import {
  Eye,
  Search,
  FileText,
  Activity,
  Sliders,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Square,
  ArrowLeft,
  Compass,
  Play,
  Volume2,
  VolumeX,
  Footprints,
  BookOpen,
  MapPin,
  Cpu,
} from 'lucide-react';
import { ActiveTask, AccessibilitySettings, EngineMode, HealthResponse } from './types';
import { Header } from './components/Header';
import { VoiceAssistantController } from './components/VoiceAssistantController';
import { DescribeSurroundingsView } from './components/DescribeSurroundingsView';
import { FindObjectView } from './components/FindObjectView';
import { ReadTextView } from './components/ReadTextView';
import { LiveDetectionView } from './components/LiveDetectionView';
import { SafePathView } from './components/SafePathView';
import { UserManualModal } from './components/UserManualModal';
import { AccessibilityModal } from './components/AccessibilityModal';
import { AboutModelModal } from './components/AboutModelModal';
import { BackendModal } from './components/BackendModal';
import { apiService } from './services/apiService';
import { speechService } from './services/speech';

export default function App() {
  const [activeTask, setActiveTask] = useState<ActiveTask>('describe');
  const [engineMode, setEngineMode] = useState<EngineMode>(apiService.getEngineMode());
  const [health, setHealth] = useState<HealthResponse | null>(null);

  // Accessibility & Modals
  const [isManualOpen, setIsManualOpen] = useState<boolean>(false);
  const [isAccessibilityOpen, setIsAccessibilityOpen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [isEngineOpen, setIsEngineOpen] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Persistent accessibility configuration
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    const saved = localStorage.getItem('omnilens_accessibility');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      fontSize: 'normal',
      highContrast: false,
      reduceMotion: false,
      speechRate: 1.0,
      speechPitch: 1.0,
      autoSpeakResults: true,
      announcePosition: true,
      soundEffects: true,
      invertLeftRight: false,
    };
  });

  useEffect(() => {
    localStorage.setItem('omnilens_accessibility', JSON.stringify(settings));
    speechService.setRate(settings.speechRate);
    speechService.setPitch(settings.speechPitch);
  }, [settings]);

  useEffect(() => {
    const unsub = speechService.subscribe((speaking: boolean) => {
      setIsSpeaking(speaking);
    });
    return unsub;
  }, []);

  const refreshHealth = async () => {
    try {
      const res = await apiService.checkHealth();
      setHealth(res);
    } catch (e) {
      setHealth(null);
    }
  };

  useEffect(() => {
    refreshHealth();
  }, [engineMode]);

  const handleUpdateSettings = (newPartial: Partial<AccessibilitySettings>) => {
    setSettings((prev) => ({ ...prev, ...newPartial }));
  };

  const handleSelectTaskFromNav = (task: ActiveTask) => {
    setActiveTask(task);
  };

  const handleEngineModeChange = (mode: EngineMode) => {
    apiService.setEngineMode(mode);
    setEngineMode(mode);
  };

  return (
    <div
      className={`min-h-screen flex flex-col bg-[#0B1017] text-[#FAF7F0] font-sans selection:bg-[#006B66] selection:text-white ${
        settings.highContrast ? 'contrast-125' : ''
      }`}
    >
      {/* 1. Header with Showcase Aesthetics */}
      <Header
        activeTask={activeTask}
        onSelectTask={handleSelectTaskFromNav}
        onOpenAccessibility={() => setIsAccessibilityOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
        onOpenEngine={() => setIsEngineOpen(true)}
        onOpenManual={() => setIsManualOpen(true)}
        engineMode={engineMode}
        isBackendHealthy={health?.status === 'healthy'}
      />

      {/* Main Workspace Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative">
        {/* Ambient background decorative glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#006B66]/15 blur-[120px] rounded-full pointer-events-none" />

        {/* 2. Unified Voice Assistant Controller */}
        <VoiceAssistantController
          onSelectTask={handleSelectTaskFromNav}
          onRunAction={(task) => setActiveTask(task)}
          isSpeaking={isSpeaking}
          onOpenAccessibility={() => setIsAccessibilityOpen(true)}
        />

        {/* 3. Workspace Mode Selector Banner */}
        <div className="p-4 sm:p-5 rounded-3xl bg-[#101820] border border-white/10 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#006B66]/40 border border-[#57D6C5]/30 text-[#57D6C5] flex items-center justify-center font-bold">
              {activeTask === 'describe' && <Eye className="w-5 h-5" />}
              {activeTask === 'find' && <Search className="w-5 h-5" />}
              {activeTask === 'read' && <FileText className="w-5 h-5" />}
              {activeTask === 'safepath' && <Footprints className="w-5 h-5" />}
              {activeTask === 'live' && <Activity className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#57D6C5] uppercase tracking-wider">
                  Active Mode
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-white/80 font-mono">
                  {engineMode === 'gemini-vision' ? 'Gemini 3.8 Flash' : engineMode}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                {activeTask === 'describe' && '1. Describe Surroundings & Human Activity'}
                {activeTask === 'find' && '2. Find an Object with Spatial Elevation'}
                {activeTask === 'read' && '3. Read Text Aloud (Neural OCR)'}
                {activeTask === 'safepath' && '4. SafePath Walking Navigation & Obstacle Sensor'}
                {activeTask === 'live' && '5. Continuous Live Spatial Stream'}
              </h1>
            </div>
          </div>

          {/* Quick Action Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => setIsManualOpen(true)}
              className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-[#FAF7F0] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#57D6C5]" />
              <span>How to use</span>
            </button>

            <button
              onClick={() => speechService.repeat(activeTask === 'safepath')}
              className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-[#FAF7F0] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Repeat last spoken announcement"
            >
              <RotateCcw className="w-4 h-4 text-[#57D6C5]" />
              <span>Repeat Speech</span>
            </button>
          </div>
        </div>

        {/* 4. Active Task Content Routing */}
        <div className="relative z-10">
          {activeTask === 'describe' && (
            <DescribeSurroundingsView
              highContrast={settings.highContrast}
              onSwitchTask={handleSelectTaskFromNav}
            />
          )}

          {activeTask === 'find' && (
            <FindObjectView
              highContrast={settings.highContrast}
              onSwitchTask={handleSelectTaskFromNav}
            />
          )}

          {activeTask === 'read' && (
            <ReadTextView
              highContrast={settings.highContrast}
              onSwitchTask={handleSelectTaskFromNav}
            />
          )}

          {activeTask === 'safepath' && (
            <SafePathView
              highContrast={settings.highContrast}
              onSwitchTask={handleSelectTaskFromNav}
            />
          )}

          {activeTask === 'live' && (
            <LiveDetectionView
              highContrast={settings.highContrast}
              onSwitchTask={handleSelectTaskFromNav}
            />
          )}
        </div>
      </main>

      {/* 5. Accessible Footer */}
      <footer className="mt-auto border-t border-white/10 bg-[#0B1017] py-6 text-xs text-[#FAF7F0]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#57D6C5]" />
            <span className="font-bold text-white">OmniLens</span>
            <span>—</span>
            <span>Voice-first visual & mobility companion for blind and low-vision users.</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsManualOpen(true)}
              className="hover:text-[#57D6C5] transition-colors cursor-pointer underline"
            >
              User Manual & Guide
            </button>
            <button
              onClick={() => setIsAccessibilityOpen(true)}
              className="hover:text-[#57D6C5] transition-colors cursor-pointer"
            >
              Accessibility Options
            </button>
          </div>
        </div>
      </footer>

      {/* --- MODALS --- */}
      {/* User Manual & Help Guide Modal */}
      <UserManualModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        onSelectTask={handleSelectTaskFromNav}
      />

      {/* Accessibility Settings Modal */}
      <AccessibilityModal
        isOpen={isAccessibilityOpen}
        onClose={() => setIsAccessibilityOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* About Model Specs Modal */}
      <AboutModelModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />

      {/* Backend Engine Modal */}
      <BackendModal
        isOpen={isEngineOpen}
        onClose={() => setIsEngineOpen(false)}
        engineMode={engineMode}
        onUpdateEngineMode={handleEngineModeChange}
        health={health}
        onRefreshHealth={refreshHealth}
      />
    </div>
  );
}
