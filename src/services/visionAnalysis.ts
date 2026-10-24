import { BoundingBox, HorizontalPosition } from '../types';

export interface SceneLightingInfo {
  averageLuminance: number; // 0 to 255
  lightingLevel: 'Bright & Clear' | 'Moderate Light' | 'Dim / Low Light';
  recommendation: string;
}

export interface ObjectDetailedInspection {
  label: string;
  confidence: number;
  position: HorizontalPosition;
  sizeCategory: 'Foreground (Prominent)' | 'Midground' | 'Background (Distant/Small)';
  coveragePercent: number;
  dominantColor: string;
  box: BoundingBox;
}

// Color classification dictionary
const COLOR_NAMES: Array<{ name: string; r: number; g: number; b: number }> = [
  { name: 'Pure Black', r: 15, g: 15, b: 15 },
  { name: 'Dark Gray', r: 70, g: 70, b: 70 },
  { name: 'Light Gray', r: 180, g: 180, b: 180 },
  { name: 'White', r: 245, g: 245, b: 245 },
  { name: 'Beige / Cream / Tan', r: 235, g: 220, b: 195 },
  { name: 'Deep Red', r: 180, g: 30, b: 30 },
  { name: 'Bright Red', r: 230, g: 45, b: 45 },
  { name: 'Warm Orange', r: 235, g: 130, b: 40 },
  { name: 'Golden Yellow', r: 235, g: 200, b: 50 },
  { name: 'Olive Green', r: 110, g: 130, b: 60 },
  { name: 'Forest Green', r: 35, g: 120, b: 50 },
  { name: 'Sage Green', r: 145, g: 180, b: 150 },
  { name: 'Sky Blue', r: 90, g: 175, b: 235 },
  { name: 'Navy Blue', r: 30, g: 55, b: 125 },
  { name: 'Royal Purple', r: 115, g: 70, b: 175 },
  { name: 'Rich Brown', r: 120, g: 75, b: 45 },
  { name: 'Warm Wood / Amber', r: 185, g: 125, b: 70 },
];

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

export function classifyColor(r: number, g: number, b: number): string {
  let closest = COLOR_NAMES[0].name;
  let minDist = Infinity;
  for (const c of COLOR_NAMES) {
    const dist = colorDistance(r, g, b, c.r, c.g, c.b);
    if (dist < minDist) {
      minDist = dist;
      closest = c.name;
    }
  }
  return closest;
}

/**
 * Analyzes overall scene lighting from an image element
 */
export function analyzeSceneLighting(imageElement: HTMLImageElement): SceneLightingInfo {
  const canvas = document.createElement('canvas');
  const w = 120;
  const h = Math.round((imageElement.naturalHeight / (imageElement.naturalWidth || 1)) * 120) || 90;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      averageLuminance: 128,
      lightingLevel: 'Moderate Light',
      recommendation: 'Lighting condition normal.',
    };
  }

  ctx.drawImage(imageElement, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  let totalLuminance = 0;
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Perceived luminance formula (ITU-R BT.709)
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    totalLuminance += lum;
  }

  const avg = Math.round(totalLuminance / pixelCount);
  if (avg < 60) {
    return {
      averageLuminance: avg,
      lightingLevel: 'Dim / Low Light',
      recommendation: 'The scene is quite dark. Turn on a room light or point a flashlight for clearer vision results.',
    };
  } else if (avg > 185) {
    return {
      averageLuminance: avg,
      lightingLevel: 'Bright & Clear',
      recommendation: 'High illumination. Ideal visibility for object identification and text reading.',
    };
  } else {
    return {
      averageLuminance: avg,
      lightingLevel: 'Moderate Light',
      recommendation: 'Balanced ambient indoor lighting.',
    };
  }
}

/**
 * Inspects a cropped bounding box from an image for color, prominence, and size
 */
export function inspectObjectRegion(
  imageElement: HTMLImageElement,
  box: BoundingBox,
  label: string,
  confidence: number,
  position: HorizontalPosition
): ObjectDetailedInspection {
  const imgW = imageElement.naturalWidth || imageElement.width || 640;
  const imgH = imageElement.naturalHeight || imageElement.height || 480;
  const totalImagePixels = imgW * imgH;
  const boxPixels = Math.max(1, box.width * box.height);
  const coveragePercent = Math.min(100, Math.round((boxPixels / totalImagePixels) * 100));

  let sizeCategory: 'Foreground (Prominent)' | 'Midground' | 'Background (Distant/Small)' = 'Midground';
  if (coveragePercent >= 22) {
    sizeCategory = 'Foreground (Prominent)';
  } else if (coveragePercent < 6) {
    sizeCategory = 'Background (Distant/Small)';
  }

  // Extract color from center region of the object bounding box
  const canvas = document.createElement('canvas');
  canvas.width = 40;
  canvas.height = 40;
  const ctx = canvas.getContext('2d');
  let dominantColor = 'Natural room tone';

  if (ctx) {
    try {
      const cropX = Math.max(0, box.x + box.width * 0.2);
      const cropY = Math.max(0, box.y + box.height * 0.2);
      const cropW = Math.max(1, box.width * 0.6);
      const cropH = Math.max(1, box.height * 0.6);
      ctx.drawImage(imageElement, cropX, cropY, cropW, cropH, 0, 0, 40, 40);
      const imgData = ctx.getImageData(0, 0, 40, 40).data;
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let i = 0; i < imgData.length; i += 4) {
        rSum += imgData[i];
        gSum += imgData[i + 1];
        bSum += imgData[i + 2];
        count++;
      }
      if (count > 0) {
        dominantColor = classifyColor(
          Math.round(rSum / count),
          Math.round(gSum / count),
          Math.round(bSum / count)
        );
      }
    } catch (e) {
      // Fallback
    }
  }

  return {
    label,
    confidence,
    position,
    sizeCategory,
    coveragePercent,
    dominantColor,
    box,
  };
}
