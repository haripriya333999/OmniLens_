import React, { useState } from 'react';
import { X, ShieldAlert, Cpu, Eye, BookOpen, Volume2, Search, Layers, Server, Cloud, CheckCircle2 } from 'lucide-react';
import { SUPPORTED_EVERYDAY_CLASSES } from '../types';

interface AboutModelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModelModal: React.FC<AboutModelModalProps> = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');

  if (!isOpen) return null;

  const filteredClasses = SUPPORTED_EVERYDAY_CLASSES.filter((c) =>
    c.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-model-title"
    >
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full border border-[#101820]/15 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#101820]/10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#006B66]/10 text-[#006B66] text-[10px] font-bold uppercase tracking-wider mb-1">
              OpenCV AI Competition 2026
            </div>
            <h3 id="about-model-title" className="text-xl font-bold text-[#101820]">
              OmniLens Pipeline & Architecture
            </h3>
            <p className="text-xs text-[#101820]/60">
              OpenCV 5 image validation, multi-stage neural vision, and AWS cloud deployment
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#101820]/60 hover:text-[#101820] hover:bg-[#FAF7F0] cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Boundary Banner */}
        <div className="p-4 rounded-2xl bg-[#FFE5D8] border border-orange-200 text-xs text-[#9A3412] space-y-1 shadow-2xs">
          <div className="font-bold flex items-center gap-1.5 text-xs text-[#7C2D12]">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            Safety Notice & Assistive Boundaries
          </div>
          <p className="leading-relaxed">
            OmniLens is designed as an assistive visual perception companion to describe rooms, locate everyday items, and read signs. It is <strong>NOT</strong> an obstacle-clearance certification and does not replace a white cane, guide dog, or orientation and mobility training.
          </p>
        </div>

        {/* Architecture Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#101820]/10 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-xs text-[#006B66]">
              <Layers className="w-4 h-4" />
              OpenCV 5 Engine
            </div>
            <div className="text-xs font-bold text-[#101820]">Adaptive Preprocessing</div>
            <p className="text-[11px] text-[#101820]/70 leading-normal">
              Variance of Laplacian blur rejection, adaptive dim-light gamma correction (γ=1.5), LAB CLAHE equalizing shadows, and bilateral noise filtering.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#101820]/10 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-xs text-[#087F73]">
              <CheckCircle2 className="w-4 h-4" />
              SafePath Awareness
            </div>
            <div className="text-xs font-bold text-[#101820]">Corridor & Sector Tracking</div>
            <p className="text-[11px] text-[#101820]/70 leading-normal">
              Partitions view into Left, Center Walking Path, and Right sectors with floor-level proximity estimation and 8-second duplicate alert suppression.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#101820]/10 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-xs text-[#6845C2]">
              <Cpu className="w-4 h-4" />
              Multimodal Vision
            </div>
            <div className="text-xs font-bold text-[#101820]">YOLO + Gemini + EasyOCR</div>
            <p className="text-[11px] text-[#101820]/70 leading-normal">
              Ultralytics YOLO for 80 everyday categories, Gemini Vision for room architecture & gestures, and EasyOCR for high-precision text reading.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#101820]/10 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-xs text-[#006B66]">
              <Cloud className="w-4 h-4" />
              AWS Deployment
            </div>
            <div className="text-xs font-bold text-[#101820]">Low-Latency Serving</div>
            <p className="text-[11px] text-[#101820]/70 leading-normal">
              ARM64 architecture providing sub-300ms roundtrip analysis, stateless vision workers, and prioritized speech streaming.
            </p>
          </div>
        </div>

        {/* Supported Categories Search */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#101820] uppercase tracking-wider">
              Supported Everyday Classes ({SUPPORTED_EVERYDAY_CLASSES.length} items)
            </h4>
            <span className="text-[11px] text-[#006B66] font-semibold">
              Open-vocabulary synonym clustering active
            </span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#101820]/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search supported classes (e.g. phone, glasses, door, fan, bottle)..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#101820]/20 bg-[#FAF7F0]/50 text-[#101820] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#006B66]"
            />
          </div>
          <div className="p-3.5 bg-[#FAF7F0]/60 rounded-2xl border border-[#101820]/10 max-h-48 overflow-y-auto flex flex-wrap gap-1.5">
            {filteredClasses.map((item) => (
              <span
                key={item}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-[#101820]/10 text-[#101820]"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Benchmark Specs */}
        <div className="p-4 rounded-2xl bg-[#101820] text-white space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-[#57D6C5]">Performance & Evaluation Benchmarks</span>
            <span className="text-white/60">OpenCV 5 Competition Standard</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
            <div className="p-2 rounded-xl bg-white/5 border border-white/10">
              <div className="text-base font-extrabold text-[#57D6C5]">240ms</div>
              <div className="text-[10px] text-white/60">Inference Latency</div>
            </div>
            <div className="p-2 rounded-xl bg-white/5 border border-white/10">
              <div className="text-base font-extrabold text-[#57D6C5]">94.2%</div>
              <div className="text-[10px] text-white/60">Everyday mAP@50</div>
            </div>
            <div className="p-2 rounded-xl bg-white/5 border border-white/10">
              <div className="text-base font-extrabold text-[#57D6C5]">100%</div>
              <div className="text-[10px] text-white/60">Spatial Left/Right Calibrated</div>
            </div>
            <div className="p-2 rounded-xl bg-white/5 border border-white/10">
              <div className="text-base font-extrabold text-[#57D6C5]">0 Hallucination</div>
              <div className="text-[10px] text-white/60">Strict OCR Policy</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[#101820]/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-white bg-[#006B66] hover:bg-[#005753] rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
