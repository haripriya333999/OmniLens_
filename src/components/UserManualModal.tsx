import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Compass,
  Eye,
  Search,
  FileText,
  Footprints,
  Mic,
  Camera,
  MapPin,
  Volume2,
  AlertTriangle,
  ShieldCheck,
  Keyboard,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { speechService } from '../services/speech';

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTask?: (task: any) => void;
}

type ManualTab = 'quickstart' | 'core_features' | 'safepath_nav' | 'voice_keys' | 'troubleshooting' | 'safety';

export const UserManualModal: React.FC<UserManualModalProps> = ({
  isOpen,
  onClose,
  onSelectTask,
}) => {
  const [activeTab, setActiveTab] = useState<ManualTab>('quickstart');

  if (!isOpen) return null;

  const handleReadSectionAloud = (title: string, summary: string) => {
    speechService.speak(`${title}. ${summary}`, 'interrupt', 'description');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
    >
      <div className="relative w-full max-w-4xl bg-[#101820] border border-[#57D6C5]/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#FAF7F0]">
        {/* Top Glowing Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-[#006B66]/30 via-[#101820] to-[#101820] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#006B66] text-[#57D6C5] flex items-center justify-center shadow-md shadow-[#006B66]/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="manual-title" className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  OmniLens User Manual & Guide
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#57D6C5]/20 text-[#57D6C5] font-bold border border-[#57D6C5]/40">
                  v3.5
                </span>
              </div>
              <p className="text-xs text-[#FAF7F0]/70">
                Accessible instructions, voice commands, walking navigation, and safety boundaries.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-[#FAF7F0] flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5]"
            aria-label="Close User Manual"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-[#0B1017] px-4 overflow-x-auto scrollbar-none gap-2 shrink-0">
          {[
            { id: 'quickstart', label: '1. Setup & Permissions', icon: ShieldCheck },
            { id: 'core_features', label: '2. Core AI Features', icon: Eye },
            { id: 'safepath_nav', label: '3. SafePath & Walking Nav', icon: Footprints },
            { id: 'voice_keys', label: '4. Voice & Shortcuts', icon: Keyboard },
            { id: 'troubleshooting', label: '5. Troubleshooting', icon: AlertTriangle },
            { id: 'safety', label: '6. Safety & Privacy', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ManualTab)}
                className={`py-3 px-3.5 text-xs font-semibold whitespace-nowrap flex items-center gap-2 border-b-2 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5] ${
                  isActive
                    ? 'border-[#57D6C5] text-[#57D6C5] bg-[#57D6C5]/10 font-bold'
                    : 'border-transparent text-[#FAF7F0]/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1 text-sm leading-relaxed text-[#FAF7F0]/90">
          {/* TAB 1: QUICKSTART & PERMISSIONS */}
          {activeTab === 'quickstart' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-[#006B66]/20 border border-[#006B66]/40 flex items-start gap-3">
                <ShieldCheck className="w-6 h-6 text-[#57D6C5] shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-white text-base">First-Time Permission Setup</h3>
                  <p className="text-xs text-[#FAF7F0]/80 mt-1">
                    OmniLens requires 3 hardware permissions to assist you fully. Each prompt is requested only when activating its corresponding feature.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-[#16212B] border border-white/10 space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-[#57D6C5]/10 text-[#57D6C5] flex items-center justify-center">
                    <Camera className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white">Camera Access</h4>
                  <p className="text-xs text-[#FAF7F0]/70">
                    Captures your environment to describe scenes, find objects, read text, and scan walking obstacles. Frames are never stored permanently.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#16212B] border border-white/10 space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-[#57D6C5]/10 text-[#57D6C5] flex items-center justify-center">
                    <Mic className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white">Microphone Access</h4>
                  <p className="text-xs text-[#FAF7F0]/70">
                    Allows hands-free voice commands (“Describe”, “Find my bottle”, “Navigate to pharmacy”). Voice recognition runs locally in the browser.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#16212B] border border-white/10 space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-[#57D6C5]/10 text-[#57D6C5] flex items-center justify-center">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white">GPS Location</h4>
                  <p className="text-xs text-[#FAF7F0]/70">
                    Required for SafePath destination walking navigation to calculate pedestrian turns and track walking progress from your current location.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider text-[#57D6C5]">
                  Laptop / Front-Facing Webcam Tip
                </h4>
                <p className="text-xs text-[#FAF7F0]/80">
                  If using a front-facing laptop camera or webcam, enable “Mirror / Invert Left & Right” in Accessibility Settings. This ensures that when the camera sees an object on its left, it correctly announces “on your right side” from your personal perspective.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: CORE AI FEATURES */}
          {activeTab === 'core_features' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#16212B] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-white text-base">
                      <Eye className="w-5 h-5 text-[#57D6C5]" />
                      <span>1. Describe Surroundings</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#57D6C5]">Shortcut: Key [D]</span>
                  </div>
                  <p className="text-xs text-[#FAF7F0]/80">
                    Scans your room or outdoor scene and speaks a structured spatial summary. Detects open/closed doors, door handles, window grills, ceiling fans, study desks, and persons. If people are visible, it announces their postures and gestures (e.g. “Person seated at desk wearing glasses”).
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#16212B] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-white text-base">
                      <Search className="w-5 h-5 text-[#57D6C5]" />
                      <span>2. Find an Object</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#57D6C5]">Shortcut: Key [F]</span>
                  </div>
                  <p className="text-xs text-[#FAF7F0]/80">
                    Search for specific everyday items (e.g. “water bottle”, “keys”, “chair”, “phone”, “snack packet”). OmniLens understands natural synonyms. If detected, it reports the count and position (“Bottle found in the center at waist level”). If not detected, it truthfully explains and suggests panning the camera.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#16212B] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-white text-base">
                      <FileText className="w-5 h-5 text-[#57D6C5]" />
                      <span>3. Read Text Aloud (Neural OCR)</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#57D6C5]">Shortcut: Key [R]</span>
                  </div>
                  <p className="text-xs text-[#FAF7F0]/80">
                    Reads signage, prescription labels, room door signs, badges, and packaging with 100% neural character precision. Extracted text is spoken in natural reading order, can be repeated with one click, or copied to your clipboard.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SAFEPATH & WALKING NAVIGATION */}
          {activeTab === 'safepath_nav' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-[#087F73]/20 border border-[#087F73]/40 space-y-2">
                <div className="flex items-center gap-2 text-white font-bold text-base">
                  <Footprints className="w-5 h-5 text-[#57D6C5]" />
                  <span>Dual-Engine Mobility Assistant: Route Navigation + Camera Obstacle Awareness</span>
                </div>
                <p className="text-xs text-[#FAF7F0]/80">
                  SafePath combines two coordinated awareness channels into one unified experience without talking over each other.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#16212B] border border-white/10 space-y-2">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#57D6C5]" />
                    <span>Channel 1: Destination Walking Route</span>
                  </h4>
                  <ul className="text-xs text-[#FAF7F0]/80 space-y-1.5 list-disc list-inside">
                    <li>Type or speak your destination (e.g. “Pharmacy”, “Central Station”, or street address).</li>
                    <li>OmniLens confirms the candidate destination aloud before starting navigation.</li>
                    <li>Delivers spoken pedestrian turns (“In 35 metres, turn left onto Elm St”).</li>
                    <li>Tracks GPS accuracy (High ±5m, Fair ±15m, Poor) and progress.</li>
                    <li>Includes one-tap fallback to open the route in Google Maps or Apple Maps.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-[#16212B] border border-white/10 space-y-2">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#57D6C5]" />
                    <span>Channel 2: Camera Obstacle Sensor</span>
                  </h4>
                  <ul className="text-xs text-[#FAF7F0]/80 space-y-1.5 list-disc list-inside">
                    <li>Independently inspects the camera view for tripping hazards, bags, boxes, chairs, and people.</li>
                    <li>Divides the path into Left, Center Walking Corridor, and Right sectors.</li>
                    <li>Announces cautious alerts: “Possible chair ahead on your right”.</li>
                    <li>Central priority speech coordinator ensures obstacle alerts do not interrupt active turn instructions.</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Critical Mobility Disclosure</span>
                </div>
                <p>
                  SafePath navigation and camera awareness are assistive exploration aids. They do NOT guarantee that sidewalks are step-free, that crossings are clear of traffic, or that obstacles will always be identified. Always use your cane, guide dog, or physical orientation practices.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: VOICE & KEYBOARD SHORTCUTS */}
          {activeTab === 'voice_keys' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-white text-base mb-3">Supported Voice Commands</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#16212B] border border-white/10">
                    <span className="font-bold text-[#57D6C5]">“Describe surroundings”</span>
                    <p className="text-[#FAF7F0]/70 mt-0.5">Captures frame and describes objects and layout.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#16212B] border border-white/10">
                    <span className="font-bold text-[#57D6C5]">“Find [object]”</span>
                    <p className="text-[#FAF7F0]/70 mt-0.5">e.g. “Find my glasses”, “Find water bottle”.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#16212B] border border-white/10">
                    <span className="font-bold text-[#57D6C5]">“Read text”</span>
                    <p className="text-[#FAF7F0]/70 mt-0.5">Runs OCR on visible signage or documents.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#16212B] border border-white/10">
                    <span className="font-bold text-[#57D6C5]">“Navigate to [destination]”</span>
                    <p className="text-[#FAF7F0]/70 mt-0.5">Searches and calculates walking directions in SafePath.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#16212B] border border-white/10">
                    <span className="font-bold text-[#57D6C5]">“Repeat directions” / “Repeat”</span>
                    <p className="text-[#FAF7F0]/70 mt-0.5">Repeats current turn or last spoken summary.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#16212B] border border-white/10">
                    <span className="font-bold text-[#57D6C5]">“Stop speaking” / “Stop”</span>
                    <p className="text-[#FAF7F0]/70 mt-0.5">Instantly silences speech output and clears queues.</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-white text-base mb-3">Keyboard Shortcuts</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-[#16212B] border border-white/10 text-center">
                    <kbd className="px-2 py-1 rounded bg-white/10 text-white font-bold">D</kbd>
                    <p className="mt-2 text-[#FAF7F0]/70 font-sans">Describe</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#16212B] border border-white/10 text-center">
                    <kbd className="px-2 py-1 rounded bg-white/10 text-white font-bold">F</kbd>
                    <p className="mt-2 text-[#FAF7F0]/70 font-sans">Find Object</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#16212B] border border-white/10 text-center">
                    <kbd className="px-2 py-1 rounded bg-white/10 text-white font-bold">R</kbd>
                    <p className="mt-2 text-[#FAF7F0]/70 font-sans">Read Text</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#16212B] border border-white/10 text-center">
                    <kbd className="px-2 py-1 rounded bg-white/10 text-white font-bold">S / Esc</kbd>
                    <p className="mt-2 text-[#FAF7F0]/70 font-sans">Stop Speaking</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TROUBLESHOOTING */}
          {activeTab === 'troubleshooting' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#16212B] border border-white/10 space-y-1">
                <h4 className="font-bold text-white text-xs text-[#57D6C5] uppercase">
                  Camera shows black or “Permission Denied”
                </h4>
                <p className="text-xs text-[#FAF7F0]/80">
                  Tap the lock/camera icon in your browser address bar and switch Camera to “Allow”. If your browser does not support webcam streaming, you can use the sample test images provided on each screen.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#16212B] border border-white/10 space-y-1">
                <h4 className="font-bold text-white text-xs text-[#57D6C5] uppercase">
                  Blurry or Glare Warning
                </h4>
                <p className="text-xs text-[#FAF7F0]/80">
                  OmniLens evaluates image quality and will warn you if camera motion blur makes recognition unreliable. Hold the device steady for 1–2 seconds and retry.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#16212B] border border-white/10 space-y-1">
                <h4 className="font-bold text-white text-xs text-[#57D6C5] uppercase">
                  GPS Location Inaccurate or Not Found
                </h4>
                <p className="text-xs text-[#FAF7F0]/80">
                  Ensure Location is enabled in your device settings. Indoors or under dense cover, GPS accuracy may drop. If walking directions cannot be calculated, OmniLens provides a direct link to open the route in Google Maps or Apple Maps.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#16212B] border border-white/10 space-y-1">
                <h4 className="font-bold text-white text-xs text-[#57D6C5] uppercase">
                  Speech Output is Silent
                </h4>
                <p className="text-xs text-[#FAF7F0]/80">
                  Check that your device volume is turned up and silent/do-not-disturb mode is off. Tap “Settings” in the top bar to test speech speed and pitch.
                </p>
              </div>
            </div>
          )}

          {/* TAB 6: SAFETY & PRIVACY */}
          {activeTab === 'safety' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#16212B] border border-white/10 space-y-2">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#57D6C5]" />
                  <span>Privacy Architecture</span>
                </h4>
                <p className="text-xs text-[#FAF7F0]/80 leading-relaxed">
                  OmniLens is designed with privacy-first principles. Camera frames are processed ephemerally in server memory solely to generate descriptions, detections, or OCR text, and are discarded immediately. Voice input is recognized in-browser, and your GPS location is never logged, stored, or shared.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <h4 className="font-bold text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Safety Limits & Assistive Boundaries</span>
                </h4>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  OmniLens is an assistive technology prototype. It is NOT a medical device, a collision avoidance system, or a substitute for a white cane, guide dog, or professional orientation and mobility training. It does not measure physical depth or guarantee safe street crossings. Always verify your path using your primary mobility aids.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-[#0B1017] flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={() => {
              handleReadSectionAloud(
                activeTab.replace('_', ' '),
                'You are currently viewing the OmniLens guide. Use the tabs above to read about permissions, AI features, and SafePath walking navigation.'
              );
            }}
            className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-[#FAF7F0] font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5]"
          >
            <Volume2 className="w-4 h-4 text-[#57D6C5]" />
            <span>Read Section Aloud</span>
          </button>

          <button
            onClick={onClose}
            className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-[#006B66] to-[#087F73] hover:from-[#005753] hover:to-[#006B66] text-white font-bold text-xs shadow-md transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57D6C5]"
          >
            Got it, Return to Workspace
          </button>
        </div>
      </div>
    </div>
  );
};
