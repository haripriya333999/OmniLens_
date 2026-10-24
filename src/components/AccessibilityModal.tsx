import React from 'react';
import { X, Volume2, Eye, Sun, Sparkles, Compass, FlipHorizontal } from 'lucide-react';
import { AccessibilitySettings } from '../types';
import { speechService } from '../services/speech';

interface AccessibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AccessibilitySettings;
  onUpdateSettings: (newSettings: Partial<AccessibilitySettings>) => void;
}

export const AccessibilityModal: React.FC<AccessibilityModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  const handleTestSpeech = () => {
    speechService.speak(
      'This is an accessibility test of OmniLens voice synthesis. Text size and contrast settings are saved on your device.'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="accessibility-settings-title"
    >
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-[#392743]/15 shadow-2xl space-y-6 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-[#392743]/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#7353B5] text-white flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h3 id="accessibility-settings-title" className="text-lg font-bold text-[#392743]">
                Accessibility Settings
              </h3>
              <p className="text-xs text-[#392743]/60">
                Tailor contrast, typography size, and speech output
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#392743]/60 hover:text-[#392743] hover:bg-[#FFF9F0] cursor-pointer"
            aria-label="Close accessibility settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Text Size Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#392743] block">
            Interface Text Size
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'normal', label: 'Standard (16px)' },
              { id: 'large', label: 'Large (18px)' },
              { id: 'extra-large', label: 'Extra Large (20px)' },
            ].map((size) => (
              <button
                key={size.id}
                onClick={() => onUpdateSettings({ fontSize: size.id as any })}
                className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all text-center cursor-pointer ${
                  settings.fontSize === size.id
                    ? 'bg-[#7353B5] text-white border-[#7353B5] shadow-sm'
                    : 'bg-[#FFF9F0] text-[#392743] border-[#392743]/15 hover:border-[#7353B5]/40'
                }`}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>

        {/* High Contrast Mode */}
        <div className="p-4 rounded-2xl bg-[#FFF9F0] border border-[#392743]/10 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-[#392743] flex items-center gap-2">
              <Sun className="w-4 h-4 text-[#7353B5]" />
              High Contrast Display
            </div>
            <div className="text-xs text-[#392743]/70 mt-0.5">
              Enforces high-visibility yellow/green bounding boxes and dark backgrounds
            </div>
          </div>
          <button
            onClick={() => onUpdateSettings({ highContrast: !settings.highContrast })}
            className={`w-12 h-7 rounded-full transition-colors relative p-0.5 cursor-pointer ${
              settings.highContrast ? 'bg-[#7353B5]' : 'bg-[#392743]/20'
            }`}
            aria-label="Toggle high contrast display"
            role="switch"
            aria-checked={settings.highContrast}
          >
            <div
              className={`w-6 h-6 rounded-full bg-white transition-transform ${
                settings.highContrast ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Reduced Motion Mode */}
        <div className="p-4 rounded-2xl bg-[#FFF9F0] border border-[#392743]/10 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-[#392743] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#7353B5]" />
              Reduce Animations
            </div>
            <div className="text-xs text-[#392743]/70 mt-0.5">
              Disables decorative transitions for vestibular comfort and speed
            </div>
          </div>
          <button
            onClick={() => onUpdateSettings({ reduceMotion: !settings.reduceMotion })}
            className={`w-12 h-7 rounded-full transition-colors relative p-0.5 cursor-pointer ${
              settings.reduceMotion ? 'bg-[#7353B5]' : 'bg-[#392743]/20'
            }`}
            aria-label="Toggle reduced motion"
            role="switch"
            aria-checked={settings.reduceMotion}
          >
            <div
              className={`w-6 h-6 rounded-full bg-white transition-transform ${
                settings.reduceMotion ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Laptop Camera Mirror / Direction Correction */}
        <div className="p-4 rounded-2xl bg-[#FFF9F0] border border-[#392743]/10 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-[#392743] flex items-center gap-2">
              <FlipHorizontal className="w-4 h-4 text-[#7353B5]" />
              Invert Left & Right Directions (Laptop Camera Mode)
            </div>
            <div className="text-xs text-[#392743]/70 mt-0.5">
              Fixes front/laptop cameras that swap left for right so spoken spatial cues match your real-world position
            </div>
          </div>
          <button
            onClick={() => {
              const nextVal = !settings.invertLeftRight;
              onUpdateSettings({ invertLeftRight: nextVal });
              speechService.speak(
                nextVal
                  ? 'Laptop camera perspective mode enabled. Left and right directions are inverted to match your real surroundings.'
                  : 'Laptop camera perspective mode disabled. Standard directions restored.'
              );
            }}
            className={`w-12 h-7 rounded-full transition-colors relative p-0.5 cursor-pointer ${
              settings.invertLeftRight ? 'bg-[#7353B5]' : 'bg-[#392743]/20'
            }`}
            aria-label="Toggle laptop camera left right inversion"
            role="switch"
            aria-checked={settings.invertLeftRight}
          >
            <div
              className={`w-6 h-6 rounded-full bg-white transition-transform ${
                settings.invertLeftRight ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Blind Navigation Keyboard Shortcuts */}
        <div className="p-4 rounded-2xl bg-[#392743] text-white space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-[#FFE5D8] flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-[#DDF3E5]" />
            Accessibility Keyboard Shortcuts
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono text-white/90 pt-1">
            <div className="p-2 rounded-xl bg-white/10 flex justify-between">
              <span>Describe Scene</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/20 font-bold">D</kbd>
            </div>
            <div className="p-2 rounded-xl bg-white/10 flex justify-between">
              <span>Find Object</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/20 font-bold">F</kbd>
            </div>
            <div className="p-2 rounded-xl bg-white/10 flex justify-between">
              <span>Read Signs</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/20 font-bold">R</kbd>
            </div>
            <div className="p-2 rounded-xl bg-white/10 flex justify-between">
              <span>Repeat Voice</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/20 font-bold">A</kbd>
            </div>
            <div className="p-2 rounded-xl bg-white/10 flex justify-between col-span-2">
              <span>Stop Speaking Voice</span>
              <kbd className="px-1.5 py-0.5 rounded bg-rose-600 font-bold text-white">Esc or S</kbd>
            </div>
          </div>
        </div>

        {/* Audio Test Button */}
        <div className="pt-2 border-t border-[#392743]/10 flex items-center justify-between gap-3">
          <button
            onClick={handleTestSpeech}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#FFF9F0] text-[#7353B5] border border-[#7353B5]/30 hover:bg-[#EAE1D2] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Volume2 className="w-4 h-4" />
            <span>Test Voice Output</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-[#7353B5] hover:bg-[#5E409B] rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            Save & Done
          </button>
        </div>
      </div>
    </div>
  );
};
