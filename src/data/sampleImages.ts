import sampleRoomPhoto from '../assets/sample-room.jpg';
import sampleOcrPhoto from '../assets/sample-ocr.jpg';
import sampleFindPhoto from '../assets/sample-find.jpg';

export interface SampleImage {
  id: string;
  title: string;
  description: string;
  category: 'describe' | 'read' | 'find';
  src: string;
}

// 1. High-Accuracy OCR Badge: AWS Academy Generative AI Foundations
const SAMPLE_AWS_BADGE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <rect width="600" height="600" fill="%23F3F4F6"/>
  <g transform="translate(100, 60)">
    <!-- Badge Shield Frame -->
    <path d="M 20 20 L 380 20 L 380 340 L 200 440 L 20 340 Z" fill="%23FFFFFF" stroke="%231E293B" stroke-width="12" stroke-linejoin="round"/>
    <!-- Banner bottom -->
    <path d="M 26 330 L 374 330 L 374 340 L 200 432 L 26 340 Z" fill="%231E293B"/>

    <!-- AWS Logo & Text -->
    <text x="200" y="80" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="900" font-size="38" fill="%23111827" text-anchor="middle">aws</text>
    <path d="M 160 92 Q 200 108 240 92" stroke="%23F59E0B" stroke-width="5" fill="none" stroke-linecap="round"/>

    <!-- ACADEMY -->
    <text x="200" y="145" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="800" font-size="22" letter-spacing="6" fill="%231E293B" text-anchor="middle">ACADEMY</text>
    <line x1="80" y1="165" x2="320" y2="165" stroke="%23E5E7EB" stroke-width="3"/>

    <!-- Generative AI -->
    <text x="200" y="215" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="800" font-size="28" fill="%230F172A" text-anchor="middle">Generative AI</text>
    <!-- Foundations -->
    <text x="200" y="260" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="700" font-size="26" fill="%231E293B" text-anchor="middle">Foundations</text>

    <!-- TRAINED Banner Text -->
    <text x="200" y="375" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="900" font-size="24" letter-spacing="4" fill="%23FFFFFF" text-anchor="middle">TRAINED</text>
  </g>
</svg>`;

// 2. Navigation Room Sign for OCR & Doors
const SAMPLE_ROOM_SIGN_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <rect width="600" height="400" fill="%23F8FAFC" />
  <rect x="40" y="40" width="520" height="320" rx="16" fill="%230F172A" stroke="%2338BDF8" stroke-width="8"/>
  <rect x="60" y="60" width="480" height="70" rx="8" fill="%230284C7"/>
  <text x="300" y="105" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="900" font-size="34" fill="%23FFFFFF" text-anchor="middle" letter-spacing="2">ROOM 204</text>
  <text x="300" y="200" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="800" font-size="28" fill="%23F8FAFC" text-anchor="middle">MEDICAL SUITE</text>
  <text x="300" y="245" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="600" font-size="20" fill="%2394A3B8" text-anchor="middle">Dr. Sarah Jenkins, MD</text>
  <line x1="120" y1="275" x2="480" y2="275" stroke="%23334155" stroke-width="2"/>
  <text x="300" y="320" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="800" font-size="22" fill="%2334D399" text-anchor="middle" letter-spacing="3">EMERGENCY EXIT AHEAD</text>
</svg>`;

export const SAMPLE_IMAGES: SampleImage[] = [
  {
    id: 'sample-room-scene',
    title: 'Modern Room & Study Desk',
    description: 'Desk with laptop, smartphone, eyeglasses, water bottle, door on the left & sunny window on the right',
    category: 'describe',
    src: sampleRoomPhoto,
  },
  {
    id: 'sample-find-objects',
    title: 'Everyday Objects on Coffee Table',
    description: 'Brass keys with blue keychain, iPhone, reading glasses, stainless steel water bottle & leather wallet',
    category: 'find',
    src: sampleFindPhoto,
  },
  {
    id: 'sample-prescription-ocr',
    title: 'Medicine Bottle & Granola Bar',
    description: 'Atorvastatin 20mg prescription bottle (John R. Smith) & Nature\'s Harvest Oat & Honey Granola Bar box',
    category: 'read',
    src: sampleOcrPhoto,
  },
  {
    id: 'sample-aws-badge',
    title: 'AWS Academy Trained Badge',
    description: 'High-precision test: "aws ACADEMY Generative AI Foundations TRAINED"',
    category: 'read',
    src: SAMPLE_AWS_BADGE_SVG,
  },
  {
    id: 'sample-room-sign',
    title: 'Door Sign & Room 204 Plaque',
    description: 'ROOM 204 MEDICAL SUITE & Emergency Exit signage',
    category: 'read',
    src: SAMPLE_ROOM_SIGN_SVG,
  },
];

export const HERO_BANNER_SRC = sampleRoomPhoto;
