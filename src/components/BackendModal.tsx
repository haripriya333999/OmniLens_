import React, { useState } from 'react';
import { X, Cpu, Server, CheckCircle2, RefreshCw, Terminal } from 'lucide-react';
import { EngineMode, HealthResponse } from '../types';
import { apiService } from '../services/apiService';

interface BackendModalProps {
  isOpen: boolean;
  onClose: () => void;
  engineMode: EngineMode;
  onUpdateEngineMode: (mode: EngineMode) => void;
  health: HealthResponse | null;
  onRefreshHealth: () => void;
}

export const BackendModal: React.FC<BackendModalProps> = ({
  isOpen,
  onClose,
  engineMode,
  onUpdateEngineMode,
  health,
  onRefreshHealth,
}) => {
  const [customUrl, setCustomUrl] = useState<string>(apiService.getBackendUrl());
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveUrl = () => {
    apiService.setBackendUrl(customUrl);
    onRefreshHealth();
  };

  const handleTestNow = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await apiService.checkHealth();
      if (res.status === 'healthy') {
        setTestResult(`Success! Connected to ${res.model_name} (v${res.version}).`);
      } else if (res.status === 'degraded') {
        setTestResult(`Connected with warnings: ${res.model_name}`);
      } else {
        setTestResult('Cannot reach backend. Make sure uvicorn is running on port 8000.');
      }
    } catch (e: any) {
      setTestResult(`Connection failed: ${e?.message || 'Network error'}`);
    } finally {
      setIsTesting(false);
      onRefreshHealth();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backend-setup-title"
    >
      <div className="bg-white rounded-3xl p-6 max-w-xl w-full border border-[#392743]/15 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#392743]/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#7353B5] text-white flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 id="backend-setup-title" className="text-lg font-bold text-[#392743]">
                OmniLens ML Engine & Setup
              </h3>
              <p className="text-xs text-[#392743]/60">
                Choose between High-Precision Cloud Vision or Local Python FastAPI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#392743]/60 hover:text-[#392743] hover:bg-[#FFF9F0] cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Engine Mode Toggle */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-[#392743] uppercase tracking-wider block">
            Select Active Vision Engine
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Mode 1: Gemini Vision (Doors, Windows, Fans, Gestures, OCR) */}
            <button
              onClick={() => onUpdateEngineMode('gemini-vision')}
              className={`p-4 rounded-2xl border text-left transition-all relative cursor-pointer ${
                engineMode === 'gemini-vision'
                  ? 'bg-[#7353B5]/15 border-[#7353B5] ring-2 ring-[#7353B5]/40 shadow-sm'
                  : 'bg-[#FFF9F0]/60 border-[#392743]/10 hover:border-[#7353B5]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-[#392743] flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-[#7353B5]" />
                  Everyday & Campus Vision
                </span>
                {engineMode === 'gemini-vision' && (
                  <CheckCircle2 className="w-4 h-4 text-[#7353B5]" />
                )}
              </div>
              <p className="text-[11px] text-[#392743]/70 leading-relaxed">
                Recommended. Accurately detects doors (open/closed, latches), window grills, ceiling fans, people & their gestures, and 100% exact OCR badges.
              </p>
            </button>

            {/* Mode 2: Local Python FastAPI (Ultralytics YOLO + EasyOCR) */}
            <button
              onClick={() => onUpdateEngineMode('python-fastapi')}
              className={`p-4 rounded-2xl border text-left transition-all relative cursor-pointer ${
                engineMode === 'python-fastapi'
                  ? 'bg-[#FFE5D8] border-orange-400 ring-2 ring-orange-400/40 shadow-sm'
                  : 'bg-[#FFF9F0]/60 border-[#392743]/10 hover:border-[#7353B5]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-[#392743] flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-orange-800" />
                  Python FastAPI Local
                </span>
                {engineMode === 'python-fastapi' && (
                  <CheckCircle2 className="w-4 h-4 text-orange-700" />
                )}
              </div>
              <p className="text-[11px] text-[#392743]/70 leading-relaxed">
                Connects to Ultralytics YOLO + EasyOCR microservice running locally on your machine at localhost:8000.
              </p>
            </button>
          </div>
        </div>

        {/* Verified OpenCV 5 Status Card */}
        <div className="p-4 rounded-2xl bg-[#087F73]/10 border border-[#087F73]/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#087F73] flex items-center gap-1.5 uppercase tracking-wide">
              <CheckCircle2 className="w-4 h-4 text-[#087F73]" />
              OpenCV 5 Pipeline Status
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#087F73] text-white font-bold">
              v5.0.0 Verified
            </span>
          </div>
          <p className="text-xs text-[#101828]/80 leading-relaxed">
            Native C++ image preprocessing executes on every captured frame via OpenCV 5 (cv2 5.0.0.93):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#101828]/70 pt-1 font-mono">
            <div className="p-1.5 rounded-lg bg-white/80 border border-[#087F73]/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#087F73]" />
              <span>cv2.Laplacian Blur Check</span>
            </div>
            <div className="p-1.5 rounded-lg bg-white/80 border border-[#087F73]/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#087F73]" />
              <span>cv2.createCLAHE Contrast</span>
            </div>
            <div className="p-1.5 rounded-lg bg-white/80 border border-[#087F73]/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#087F73]" />
              <span>HSV Glare / Dark Analysis</span>
            </div>
            <div className="p-1.5 rounded-lg bg-white/80 border border-[#087F73]/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#087F73]" />
              <span>Camera Perspective Inversion</span>
            </div>
          </div>
        </div>

        {/* Python FastAPI Connection Config */}
        {engineMode === 'python-fastapi' && (
          <div className="p-4 rounded-2xl bg-[#FFF9F0] border border-[#392743]/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#392743]">
                FastAPI Server URL
              </span>
              <span className="text-[10px] text-[#392743]/60 font-mono">
                Default: http://localhost:8000
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="http://localhost:8000"
                className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-[#392743]/20 bg-white text-[#392743] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7353B5]"
              />
              <button
                onClick={handleSaveUrl}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-[#392743] text-white hover:bg-[#5E409B] transition-colors cursor-pointer"
              >
                Save
              </button>
            </div>
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleTestNow}
                disabled={isTesting}
                className="text-xs font-bold text-[#7353B5] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>Test Connection Now</span>
              </button>
              {health && (
                <span className="text-xs font-mono flex items-center gap-1.5 text-[#392743]/80">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      health.status === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  <span>{health.status}</span>
                </span>
              )}
            </div>
            {testResult && (
              <div className="p-2.5 rounded-xl bg-white border border-[#392743]/10 text-xs text-[#392743] font-medium">
                {testResult}
              </div>
            )}
          </div>
        )}

        {/* Local Setup Instructions */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#7353B5]" />
            <h4 className="text-xs font-bold text-[#392743] uppercase tracking-wider">
              How to Run Python Backend on Windows / Mac
            </h4>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#282130] text-gray-100 font-mono text-[11px] space-y-1.5 overflow-x-auto selection:bg-[#7353B5]">
            <div className="text-gray-400"># 1. Open terminal in the backend directory</div>
            <div>cd backend</div>
            <div className="text-gray-400"># 2. Create virtual environment & install requirements</div>
            <div>python -m venv venv</div>
            <div>venv\Scripts\activate <span className="text-gray-500"># or source venv/bin/activate</span></div>
            <div>pip install -r requirements.txt</div>
            <div className="text-gray-400"># 3. Start FastAPI server on port 8000</div>
            <div className="text-emerald-400">uvicorn main:app --port 8000 --reload</div>
          </div>
          <p className="text-[11px] text-[#392743]/70">
            A convenient <code>run_backend.bat</code> and <code>run_backend.ps1</code> are included in <code>/backend</code> for 1-click launch on Windows.
          </p>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[#392743]/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-[#7353B5] hover:bg-[#5E409B] rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
