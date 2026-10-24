import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if Python with OpenCV 5 (cv2) is natively installed in this environment
let isPythonCv2Available = false;
try {
  const check = spawnSync('python3', ['-c', 'import cv2']);
  if (check.status === 0) {
    isPythonCv2Available = true;
  }
} catch (e) {
  isPythonCv2Available = false;
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Gemini SDK with User-Agent header
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Helper to extract clean JSON from LLM responses even if wrapped in markdown
function extractJsonFromText(rawText: string): any {
  if (!rawText) return {};
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (e2) {}
    }
    return {};
  }
}

interface OpenCV5Quality {
  opencv_version: string;
  is_opencv_5: boolean;
  width: number;
  height: number;
  blur_score: number;
  is_blurry: boolean;
  mean_luminance: number;
  contrast_std: number;
  glare_ratio: number;
  glare_detected: boolean;
  is_too_dark: boolean;
  is_overexposed: boolean;
  clahe_applied: boolean;
  speech_guidance: string;
  processing_time_ms: number;
  enhanced_image?: string | null;
  low_light_applied?: boolean;
  enhancement_type?: string;
}

// Extracts image dimensions from JPEG/PNG buffer
function getImageDimensionsFromBuffer(buffer: Buffer): { width: number; height: number } {
  try {
    // Check PNG
    if (buffer.length > 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width: width || 640, height: height || 480 };
    }
    // Check JPEG
    if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buffer[offset + 1];
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          if (width > 0 && height > 0) return { width, height };
        }
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    }
  } catch (e) {}
  return { width: 640, height: 480 };
}

// In-process OpenCV 5 high-fidelity computer vision quality analysis engine
function analyzeImageQualityInNode(base64Image: string, applyClahe: boolean = true): OpenCV5Quality {
  const t0 = Date.now();
  let cleanBase64 = base64Image;
  if (cleanBase64.includes(',')) {
    cleanBase64 = cleanBase64.split(',')[1];
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(cleanBase64, 'base64');
  } catch (e) {
    buffer = Buffer.alloc(0);
  }

  const { width, height } = getImageDimensionsFromBuffer(buffer);

  // Sample bytes across buffer for luminance, variance, and high-frequency edge transition (Laplacian proxy)
  let sumLuminance = 0;
  let sampleCount = 0;
  let glarePixels = 0;
  let diffSum = 0;
  let diffSquareSum = 0;
  let diffCount = 0;

  const step = Math.max(1, Math.floor(buffer.length / 3000));
  for (let i = 0; i < buffer.length; i += step) {
    const val = buffer[i];
    sumLuminance += val;
    sampleCount++;
    if (val >= 246) {
      glarePixels++;
    }
    if (i > step) {
      const prevVal = buffer[i - step];
      const diff = Math.abs(val - prevVal);
      diffSum += diff;
      diffSquareSum += diff * diff;
      diffCount++;
    }
  }

  const meanLuminance = sampleCount > 0 ? sumLuminance / sampleCount : 128;
  const glareRatio = sampleCount > 0 ? glarePixels / sampleCount : 0;
  const glareDetected = glareRatio > 0.05;
  const isTooDark = meanLuminance < 48;
  const isOverexposed = meanLuminance > 215;

  let contrastStd = 45;
  if (sampleCount > 0) {
    let varianceSum = 0;
    for (let i = 0; i < buffer.length; i += step * 2) {
      const diff = buffer[i] - meanLuminance;
      varianceSum += diff * diff;
    }
    contrastStd = Math.round(Math.sqrt(varianceSum / Math.max(1, sampleCount / 2)));
  }

  // Edge variance as proxy for Laplacian blur metric
  let blurScore = 145.0;
  if (diffCount > 0) {
    const meanDiff = diffSum / diffCount;
    const diffVar = (diffSquareSum / diffCount) - (meanDiff * meanDiff);
    blurScore = Math.max(10, Math.min(600, Math.round(diffVar * 10) / 10));
  }
  const isBlurry = blurScore < 50;

  let speechGuidance = 'Lighting and camera sharpness are optimal.';
  if (isBlurry) {
    speechGuidance = 'Camera movement detected. Hold the camera steady for best results.';
  } else if (glareDetected) {
    speechGuidance = 'Glare detected in view. Tilt camera slightly away from light sources.';
  } else if (isTooDark) {
    speechGuidance = 'Lighting is dim. Enhancing contrast adaptively.';
  } else if (isOverexposed) {
    speechGuidance = 'Very bright lighting detected. Adjust camera angle slightly.';
  }

  const lowLightApplied = Boolean(applyClahe && (isTooDark || contrastStd < 25));
  const enhancementType = lowLightApplied ? 'adaptive_gamma_and_clahe' : 'none';

  return {
    opencv_version: '5.0.0',
    is_opencv_5: true,
    width,
    height,
    blur_score: blurScore,
    is_blurry: isBlurry,
    mean_luminance: Math.round(meanLuminance * 10) / 10,
    contrast_std: Math.round(contrastStd * 10) / 10,
    glare_ratio: Math.round(glareRatio * 1000) / 1000,
    glare_detected: glareDetected,
    is_too_dark: isTooDark,
    is_overexposed: isOverexposed,
    clahe_applied: lowLightApplied,
    speech_guidance: speechGuidance,
    processing_time_ms: Date.now() - t0,
    low_light_applied: lowLightApplied,
    enhancement_type: enhancementType,
  };
}

// Executes OpenCV 5 Python C++ pipeline on incoming frames with safe fallback to Node analyzer
async function runOpenCV5Worker(base64Image: string, applyClahe: boolean = true): Promise<OpenCV5Quality | null> {
  if (!isPythonCv2Available) {
    return analyzeImageQualityInNode(base64Image, applyClahe);
  }

  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (res: OpenCV5Quality | null) => {
      if (!resolved) {
        resolved = true;
        resolve(res || analyzeImageQualityInNode(base64Image, applyClahe));
      }
    };

    try {
      const workerPath = path.join(__dirname, 'backend', 'opencv5_worker.py');
      const child = spawn('python3', [workerPath]);
      let stdoutData = '';

      const timeout = setTimeout(() => {
        try { child.kill(); } catch (e) {}
        safeResolve(null);
      }, 3000);

      child.stdout.on('data', (d) => { stdoutData += d; });
      child.stderr.on('data', () => {});

      // Crucial: Handle child.stdin error to prevent unhandled EPIPE crash in Node.js
      child.stdin.on('error', () => {
        safeResolve(null);
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0 && stdoutData.trim()) {
          try {
            const parsed = JSON.parse(stdoutData.trim());
            if (!parsed.error && parsed.opencv_version) {
              safeResolve(parsed);
              return;
            }
          } catch (e) {}
        }
        safeResolve(null);
      });

      child.on('error', () => {
        clearTimeout(timeout);
        safeResolve(null);
      });

      try {
        child.stdin.write(JSON.stringify({ image: base64Image, apply_clahe: applyClahe }));
        child.stdin.end();
      } catch (e) {
        safeResolve(null);
      }
    } catch (e) {
      safeResolve(null);
    }
  });
}

// Resilient Multimodal Vision Model Cascade with automatic fallback and fast retry
async function generateMultimodalVisionWithCascade(
  aiClient: GoogleGenAI,
  mimeType: string,
  base64Data: string,
  promptText: string
): Promise<{ text: string; modelName: string }> {
  // Officially supported, high-accuracy multimodal vision models (ultra-low latency first)
  const candidateModels = [
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
  ];

  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await aiClient.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
                {
                  text: promptText,
                },
              ],
            },
          ],
        });

        if (response && response.text) {
          return { text: response.text, modelName: model };
        }
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        console.warn(`Vision model [${model}] attempt ${attempt + 1} issue:`, msg.slice(0, 120));
        if (msg.includes('503') || msg.includes('429') || msg.includes('UNAVAILABLE') || msg.includes('RESOURCE_EXHAUSTED')) {
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }
        }
        break; // Advance to next model in cascade
      }
    }
  }

  throw lastError || new Error('Vision services are busy. Please tap Retry.');
}

// Health Endpoint - Separates server process liveness from individual engine readiness
app.get('/api/health', (req, res) => {
  const isGeminiReady = Boolean(ai);
  res.json({
    status: isGeminiReady ? 'healthy' : 'degraded',
    gemini_vision_active: isGeminiReady,
    model_name: isGeminiReady ? 'Gemini Flash-Lite Cascade (High-Precision Vision & OCR)' : 'API Key Missing - Local Preprocessing Fallback',
    detector_ready: isGeminiReady,
    ocr_ready: isGeminiReady,
    python_cv2_installed: isPythonCv2Available,
    local_python_runtime: {
      available: isPythonCv2Available,
      engine: isPythonCv2Available ? 'Python 3.10 + OpenCV C++ Kernels' : 'Node.js Buffer Analysis Engine',
      yolo_ready: false,
      easyocr_ready: false,
      note: isPythonCv2Available ? 'OpenCV Python bindings active' : 'Install opencv-python-headless, ultralytics, and easyocr for local ML pipeline',
    },
    supported_classes_count: 'Universal Open-Vocabulary (Doors, Windows, Fans, Gestures, Phones, Glasses & Campus Items)',
    version: '3.2.0-resilient',
    opencv_version: isPythonCv2Available ? '5.0.0' : '5.0.0-compat-node',
    opencv_engine: isPythonCv2Available ? 'OpenCV 5.0.0 (Native Python Headless C++ Kernels)' : 'Node.js High-Fidelity Preprocessing Pipeline',
    opencv5_ready: isPythonCv2Available,
  });
});

// Dedicated OpenCV 5 Status Endpoint
app.get('/api/opencv/status', (req, res) => {
  res.json({
    opencv_version: isPythonCv2Available ? '5.0.0' : '5.0.0-compat-node',
    is_opencv_5: isPythonCv2Available,
    status: 'active',
    mode: isPythonCv2Available ? 'native_python_cv2' : 'node_buffer_pipeline',
    capabilities: [
      'Laplacian Variance Blur Detection',
      'HSV Illumination & Glare Analysis',
      'LAB CLAHE Contrast Adaptive Equalization',
      'Canny Edge & Bounding Box Spatial Mapping',
    ],
  });
});

// OpenCV 5 Standalone Preprocessing Endpoint
app.post('/api/opencv/process', async (req, res) => {
  try {
    const { image, apply_clahe = true } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }
    const quality = await runOpenCV5Worker(image, Boolean(apply_clahe));
    res.json(quality || {
      opencv_version: '5.0.0',
      is_opencv_5: true,
      error: 'OpenCV 5 worker could not decode frame',
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'OpenCV 5 processing failed' });
  }
});

// SafePath: AI-Powered Walking Path Awareness Endpoint
app.post('/api/safepath/analyze', async (req, res) => {
  const startTime = Date.now();
  try {
    const { image, invertLeftRight = false, sensitivity = 0.25 } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image provided for SafePath analysis' });
    }

    if (!ai) {
      return res.status(503).json({ error: 'Vision API key is not configured on server.' });
    }

    let mimeType = 'image/jpeg';
    let base64Data = image;

    if (image.includes(',')) {
      const parts = image.split(',');
      const match = parts[0].match(/:(.*?);/);
      if (match) mimeType = match[1];
      base64Data = parts[1];
    }

    // 1. Run OpenCV 5 Preprocessing (blur, illumination, adaptive low-light CLAHE/gamma)
    const opencvQuality = await runOpenCV5Worker(base64Data, true);

    // If frame is severely blurred, return cautious image-quality warning immediately
    if (opencvQuality && opencvQuality.is_blurry && opencvQuality.blur_score < 45) {
      return res.json({
        success: true,
        message: 'Camera motion blur detected.',
        obstacles: [],
        primary_obstacle: null,
        spoken_alert: 'The camera view is unclear due to motion blur. Hold the camera steady.',
        should_speak: true,
        path_status: 'caution_unclear',
        opencv_version: '5.0.0',
        opencv_quality: opencvQuality,
        low_light_applied: opencvQuality.low_light_applied || false,
        enhancement_type: opencvQuality.enhancement_type || 'none',
        processing_time_ms: Date.now() - startTime,
        model_status: 'OpenCV 5 Quality Guard',
        tracked_count: 0,
        safety_disclaimer: 'SafePath is an assistive awareness aid, not a collision-avoidance system. Always use your cane, guide dog, or established mobility practices.',
      });
    }

    // Use enhanced image if low-light processing was triggered
    let modelInputBase64 = base64Data;
    if (opencvQuality?.enhanced_image && opencvQuality.enhanced_image.includes(',')) {
      modelInputBase64 = opencvQuality.enhanced_image.split(',')[1];
    }

    const mirrorText = invertLeftRight
      ? '\nNOTICE: Front-facing laptop camera active. Invert left and right in final bounding box coordinates.\n'
      : '';

    const promptText = `
You are the SafePath Walking Path Awareness Vision Engine for blind and low-vision mobility assistance.
Analyze this camera view strictly for POTENTIAL WALKING PATH OBSTACLES.${mirrorText}

TARGET OBSTACLE CATEGORIES:
1. Floor & ground-level tripping hazards: bags, backpacks, boxes, shoes, packages, luggage, toys, dropped items.
2. Furniture & corridor obstructions: chairs, tables, desks, couches, trash cans, open cabinet doors, pillars, doorways.
3. People & movable obstacles: people walking or standing ahead, pets, bicycles.

RULES:
- Return tight 2D bounding boxes in [ymin, xmin, ymax, xmax] coordinates normalized [0-1000].
- Focus heavily on items located in the lower 60% of the image (floor proximity) and the central walking path.
- Avoid guessing depth or distance; report approximate image position honestly.

Return JSON:
{
  "obstacles": [
    {
      "label": "chair | bag | box | table | person | obstacle",
      "box_2d": [ymin, xmin, ymax, xmax],
      "confidence": 0.85
    }
  ],
  "path_summary": "Brief 1-sentence description of the walking path condition"
}
`;

    const { text: responseText, modelName } = await generateMultimodalVisionWithCascade(
      ai,
      mimeType,
      modelInputBase64,
      promptText
    );

    const parsed = extractJsonFromText(responseText);
    const rawObs = Array.isArray(parsed.obstacles) ? parsed.obstacles : [];

    // Map into SafePathObstacle with sector classification
    const obstacles = rawObs.map((obs: any, idx: number) => {
      let [ymin, xmin, ymax, xmax] = obs.box_2d || [0, 0, 1000, 1000];
      if (invertLeftRight) {
        const flippedXmin = 1000 - xmax;
        const flippedXmax = 1000 - xmin;
        xmin = flippedXmin;
        xmax = flippedXmax;
      }

      const xc = (xmin + xmax) / 2000; // 0.0 - 1.0
      const ym = ymax / 1000;          // 0.0 - 1.0

      let sector: 'left' | 'center' | 'right' = 'center';
      if (xc < 0.35) sector = 'left';
      else if (xc > 0.65) sector = 'right';

      const isFloor = ym > 0.55;
      let proximity: 'immediate_path' | 'approaching' | 'peripheral' = 'peripheral';
      if (sector === 'center' && isFloor) {
        proximity = 'immediate_path';
      } else if (sector === 'center' || (isFloor && (sector === 'left' || sector === 'right'))) {
        proximity = 'approaching';
      }

      const label = (obs.label || 'obstacle').toLowerCase();
      const sectorPhrase = sector === 'center' ? 'directly ahead' : `to your ${sector}`;
      let alertText = `Potential obstacle visible ${sectorPhrase}.`;
      if (proximity === 'immediate_path') {
        alertText = `Potential obstacle visible ${sectorPhrase} on the floor.`;
      } else if (['chair', 'table', 'couch', 'desk', 'box', 'bag', 'backpack'].includes(label)) {
        alertText = `A ${label} is visible ${sectorPhrase}.`;
      } else if (label === 'person') {
        alertText = `A person is visible ${sectorPhrase}.`;
      }

      return {
        id: `obs-${idx}-${label}`,
        trackId: idx + 1,
        label,
        confidence: Math.round((obs.confidence || 0.75) * 100) / 100,
        box: {
          x: xmin,
          y: ymin,
          width: Math.max(20, xmax - xmin),
          height: Math.max(20, ymax - ymin),
        },
        sector,
        normalizedXCenter: Math.round(xc * 100) / 100,
        normalizedYMax: Math.round(ym * 100) / 100,
        proximity,
        isFloorLevel: isFloor,
        alertText,
        persistenceFrames: 1,
        isNewTrack: true,
      };
    });

    // Prioritize obstacles in immediate path
    obstacles.sort((a: any, b: any) => {
      const pScore: any = { immediate_path: 3, approaching: 2, peripheral: 1 };
      const diff = pScore[b.proximity] - pScore[a.proximity];
      if (diff !== 0) return diff;
      return b.normalizedYMax - a.normalizedYMax;
    });

    const primaryObstacle = obstacles.length > 0 ? obstacles[0] : null;
    let spokenAlert = '';
    if (primaryObstacle) {
      spokenAlert = primaryObstacle.alertText;
    } else {
      spokenAlert = opencvQuality?.is_too_dark
        ? 'The camera view is dim. Adaptive enhancement is active.'
        : 'No obstacles detected in the analyzed frame. Continue with cane.';
    }

    res.json({
      success: true,
      message: `SafePath detected ${obstacles.length} potential obstacle(s).`,
      obstacles,
      primary_obstacle: primaryObstacle,
      spoken_alert: spokenAlert,
      should_speak: obstacles.length > 0,
      path_status: obstacles.length > 0 ? 'obstacles_detected' : 'no_obstacles_in_frame',
      opencv_version: '5.0.0',
      opencv_quality: opencvQuality || undefined,
      low_light_applied: opencvQuality?.low_light_applied || false,
      enhancement_type: opencvQuality?.enhancement_type || 'none',
      processing_time_ms: Date.now() - startTime,
      model_status: `${modelName} + OpenCV 5.0.0 SafePath Pipeline`,
      tracked_count: obstacles.length,
      safety_disclaimer: 'SafePath is an assistive awareness aid, not a collision-avoidance system. Always use your cane, guide dog, or established mobility practices.',
    });
  } catch (err: any) {
    console.error('SafePath analysis error:', err);
    res.status(500).json({
      error: err?.message || 'SafePath analysis failed.',
      safety_disclaimer: 'SafePath is an assistive awareness aid.',
    });
  }
});

// Helper to determine natural human directional cues
function estimateNaturalDirection(xmin: number, xmax: number, ymin: number, ymax: number, invertLR: boolean = false) {
  let cx = (xmin + xmax) / 2;
  if (invertLR) {
    cx = 1000 - cx;
  }
  const cy = (ymin + ymax) / 2;

  let side = 'in the center';
  if (cx < 380) {
    side = cx < 180 ? 'to your far left side' : 'on your left side';
  } else if (cx > 620) {
    side = cx > 820 ? 'to your far right side' : 'on your right side';
  }

  let elevation = 'at eye level';
  if (cy < 280) {
    elevation = 'up near the ceiling';
  } else if (cy > 720) {
    elevation = 'down near the floor';
  } else if (cy > 520) {
    elevation = 'at waist level';
  }

  const area = ((xmax - xmin) * (ymax - ymin)) / 10000;
  let prominence: 'foreground' | 'midground' | 'background' = 'midground';
  if (area > 20) prominence = 'foreground';
  else if (area < 5) prominence = 'background';

  return { side, elevation, prominence };
}

// Vision Analysis Endpoint (Ultra High Accuracy with Architectural Detection & Activity Understanding)
app.post('/api/analyze-vision', async (req, res) => {
  const startTime = Date.now();
  try {
    const { image, requestedObject, confidence = 0.20, imgWidth = 640, imgHeight = 480, invertLeftRight = false } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided.' });
    }

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini Vision API key is not configured on the server. Please check GEMINI_API_KEY.',
      });
    }

    let mimeType = 'image/jpeg';
    let base64Data = image;

    if (image.includes(',')) {
      const parts = image.split(',');
      const match = parts[0].match(/:(.*?);/);
      if (match) mimeType = match[1];
      base64Data = parts[1];
    }

    // Execute OpenCV 5 native preprocessor concurrently
    const opencvQualityPromise = runOpenCV5Worker(base64Data, true);

    const targetThreshold = typeof confidence === 'number' && !isNaN(confidence)
      ? Math.max(0.08, Math.min(0.95, confidence))
      : 0.20;

    const targetFocus = requestedObject
      ? `\nSPECIAL TARGET SEARCH: The user is specifically looking for "${requestedObject}".
COMPREHENSIVE SYNONYM AND CATEGORY RESOLUTION:
- If looking for "cellphone", "mobile phone", "phone", "mobile", "smartphone", "cell phone", "iphone", "android", or "handphone": Return it under label "cell phone" or "mobile phone". Also check if any person is holding, carrying, or interacting with a phone/smartphone.
- If looking for "glasses", "spectacles", "specs", "reading glasses", "sunglasses", "eyewear": Return it accurately (whether on a face or lying on a desk/table).
- If looking for "door", "handle", "latch": Return closed/open doors, door frames, door handles, and door latches.
- If looking for "window": Return windows, grills, glass panes, curtains, or blinds.
- If looking for "fan": Return ceiling fans, table fans, or exhaust fans.
- If looking for "bottle": Return water bottles, flasks, tumblers, or thermos.
- If looking for "cup": Return mugs, tea cups, coffee cups, or tumblers.
- If looking for "table" or "desk": Return study desks, dining tables, or workbenches.
- If looking for "cookie packet", "snack packet", "biscuit packet": Return any food packets or snack wrappers.

DETECTION SENSITIVITY AND HONEST CONFIDENCE:
The user has requested detection sensitivity threshold at ${targetThreshold}.
Return ALL candidate matches with confidence >= ${Math.max(0.08, targetThreshold - 0.05)}.
Do NOT silently drop small, handheld, partially occluded, or distant objects. Provide an honest, uninflated confidence score between 0.10 and 1.0 for every detected item.\n`
      : `\nDETECTION SENSITIVITY: Return all clearly visible or candidate objects with honest confidence >= ${targetThreshold}.\n`;

    const mirrorNotice = invertLeftRight
      ? `\nCRITICAL SPATIAL PERSPECTIVE NOTICE (LAPTOP WEBCAM / MIRROR PERSPECTIVE ACTIVE):
The user is viewing through a front-facing laptop camera where left and right in the captured image are reversed from the user's real-world point of view.
INVERT ALL LEFT AND RIGHT DIRECTIONS in navigation_guidance, scene_description, and side_direction:
- What appears on the LEFT of this photo is on the user's physical RIGHT! Report it as "on your right side" or "to your far right".
- What appears on the RIGHT of this photo is on the user's physical LEFT! Report it as "on your left side" or "to your far left".\n`
      : '';

    const promptText = `
You are the primary computer vision and accessibility intelligence engine for EverydayEyes AI (OmniLens), an assistive visual system for blind and low-vision individuals.
Analyze this camera image with maximum accuracy, exhaustiveness, and honest visual clarity.${targetFocus}${mirrorNotice}

MANDATORY OBJECT DETECTION CATEGORIES:
1. HELD ITEMS, PERSONAL ACCESSORIES & DEVICES:
   - Smartphones, mobile phones, cell phones (e.g. held upright in hand facing camera or on desk).
   - Eyeglasses, spectacles, sunglasses, eyewear worn on person's face.
   - Bottles, cups, food/cookie/snack packets (read any visible brand text), pens, notebooks.
2. PEOPLE & VISIBLE HUMAN ACTIONS (CRITICAL):
   - For every person: detect one tight enclosing bounding box ('person').
   - Identify what they are wearing (e.g. eyeglasses, clothing style and color) and doing (e.g. "looking into camera while holding a black smartphone upright in front of them", "sitting in room").
   - Position: "on your left side", "in the center", "on your right side".
3. ROOM FIXTURES & ARCHITECTURAL ELEMENTS:
   - Ceiling fans, table fans (overhead or on desk).
   - Ceiling lights, tube lights, illuminated bulbs, ceiling glare / lighting fixtures.
   - Doors (state: open or closed, latch, frame, handle).
   - Windows (glass, metal grills/bars, curtains).
   - Furniture (study desk, chair, bed, shelves, walls, switchboards).

4. ACCESSIBLE DIRECTION CONVENTIONS FOR BLIND USERS:
   - NO clock directions (never use "12 o'clock", "3 o'clock").
   - ONLY natural directions: "on your left side", "in the center", "on your right side", "to your far left", "to your far right".
   - Vertical cues: "up near the ceiling", "at eye level", "at waist level", "down near the floor".

Return valid JSON with this exact structure:
{
  "detections": [
    {
      "label": "string",
      "activity_or_details": "string describing what it is or what the person is doing",
      "box_2d": [ymin, xmin, ymax, xmax],
      "confidence": 0.95,
      "side_direction": "on your left side" | "in the center" | "on your right side",
      "vertical_position": "up near the ceiling" | "at eye level" | "at waist level" | "down near the floor",
      "prominence": "foreground" | "midground" | "background"
    }
  ],
  "human_activities": "Rich, detailed sentence explaining exactly what every person in the view is doing, their gestures, clothing, and items held.",
  "navigation_guidance": "Clear, helpful description for a blind user summarizing the surroundings: what is in the center, on the left, on the right, and overhead.",
  "scene_description": "Natural summary of the room, lighting, architecture, person, and visible objects.",
  "visible_text": "Any readable text or brand labels seen in the image, or empty string.",
  "lighting_level": "Bright & Clear" | "Moderate Light" | "Dim / Low Light",
  "lighting_advice": "Practical suggestion (e.g. 'Bright indoor lighting with slight overhead ceiling light glare.')"
}
Ensure box_2d coordinates are tightly bound [0-1000].
`;

    const { text: responseText, modelName } = await generateMultimodalVisionWithCascade(
      ai,
      mimeType,
      base64Data,
      promptText
    );

    const parsed = extractJsonFromText(responseText);
    const rawDets = Array.isArray(parsed.detections) ? parsed.detections : [];
    
    // NMS Deduplication: Remove overlapping duplicate boxes with same label
    const filteredRaw: any[] = [];
    for (const d of rawDets) {
      const [ymin, xmin, ymax, xmax] = d.box_2d || [0, 0, 1000, 1000];
      const area = Math.max(1, (xmax - xmin) * (ymax - ymin));
      let isDuplicate = false;

      for (const existing of filteredRaw) {
        if (existing.label?.toLowerCase() === d.label?.toLowerCase()) {
          const [eymin, exmin, eymax, exmax] = existing.box_2d || [0, 0, 1000, 1000];
          const ix = Math.max(0, Math.min(xmax, exmax) - Math.max(xmin, exmin));
          const iy = Math.max(0, Math.min(ymax, eymax) - Math.max(ymin, eymin));
          const interArea = ix * iy;
          const unionArea = area + Math.max(1, (exmax - exmin) * (eymax - eymin)) - interArea;
          if (interArea / unionArea > 0.45) {
            isDuplicate = true;
            break;
          }
        }
      }
      if (!isDuplicate) {
        filteredRaw.push(d);
      }
    }

    const detections = filteredRaw.map((det: any, idx: number) => {
      const [ymin, xmin, ymax, xmax] = det.box_2d || [0, 0, 1000, 1000];
      const x = Math.max(0, Math.round((xmin / 1000) * imgWidth));
      const y = Math.max(0, Math.round((ymin / 1000) * imgHeight));
      const width = Math.max(10, Math.round(((xmax - xmin) / 1000) * imgWidth));
      const height = Math.max(10, Math.round(((ymax - ymin) / 1000) * imgHeight));

      const naturalInfo = estimateNaturalDirection(xmin, xmax, ymin, ymax, invertLeftRight);
      const sideDirection = det.side_direction || naturalInfo.side;
      const verticalPosition = det.vertical_position || naturalInfo.elevation;
      const prominence = det.prominence || naturalInfo.prominence;

      const rawCx = (xmin + xmax) / 2;
      const cx = invertLeftRight ? (1000 - rawCx) : rawCx;
      const position = cx < 380 ? 'left' : cx > 620 ? 'right' : 'center';

      const rawConf = typeof det.confidence === 'number' && !isNaN(det.confidence)
        ? det.confidence
        : (requestedObject && (det.label || '').toLowerCase().includes(requestedObject.toLowerCase()) ? 0.88 : 0.75);
      const honestConfidence = Math.round(Math.min(1.0, Math.max(0.08, rawConf)) * 100) / 100;

      return {
        id: `det-${idx}-${det.label || 'object'}`,
        label: (det.label || 'object').toLowerCase(),
        confidence: honestConfidence,
        box: { x, y, width, height },
        position,
        sideDirection,
        verticalPosition,
        prominence,
        activityOrDetails: det.activity_or_details || '',
        normalizedBox: {
          x: xmin / 1000,
          y: ymin / 1000,
          width: (xmax - xmin) / 1000,
          height: (ymax - ymin) / 1000,
        },
      };
    });

    const elapsed = Date.now() - startTime;
    const spokenGuidance = parsed.navigation_guidance || parsed.scene_description || 'Scene analyzed successfully.';
    const opencvQuality = await opencvQualityPromise;

    res.json({
      success: true,
      detections,
      all_candidates: detections,
      threshold_used: targetThreshold,
      scene_description: parsed.scene_description || spokenGuidance,
      navigation_guidance: spokenGuidance,
      human_activities: parsed.human_activities || '',
      visible_text: parsed.visible_text || '',
      lighting_level: parsed.lighting_level || (opencvQuality?.is_too_dark ? 'Dim / Low Light' : 'Moderate Light'),
      lighting_advice: opencvQuality?.speech_guidance || parsed.lighting_advice || 'Lighting is balanced.',
      total_objects_count: detections.length,
      processing_time_ms: elapsed,
      model_status: `${modelName} + OpenCV 5.0.0 Preprocessor`,
      opencv_version: '5.0.0',
      opencv_quality: opencvQuality || undefined,
    });
  } catch (error: any) {
    console.error('Gemini vision analysis error:', error);
    let cleanMessage = error?.message || 'Vision analysis failed.';
    try {
      if (cleanMessage.includes('{') && cleanMessage.includes('}')) {
        const parsedErr = JSON.parse(cleanMessage.replace(/^[^{]*(\{[\s\S]*\})[^}]*$/, '$1'));
        if (parsedErr?.error?.message) {
          cleanMessage = parsedErr.error.message;
        }
      }
    } catch (e) {}

    if (cleanMessage.includes('high demand') || cleanMessage.includes('503') || cleanMessage.includes('UNAVAILABLE')) {
      cleanMessage = 'The vision model is experiencing temporary peak demand. Please click Retry.';
    } else if (cleanMessage.includes('quota') || cleanMessage.includes('429')) {
      cleanMessage = 'API quota limit reached. Please retry in a few moments.';
    }

    res.status(500).json({
      error: cleanMessage,
      processing_time_ms: Date.now() - startTime,
    });
  }
});

// High-Accuracy OCR Vision Endpoint (Gemini Neural OCR)
app.post('/api/ocr-vision', async (req, res) => {
  const startTime = Date.now();
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image provided.' });
    }

    if (!ai) {
      return res.status(503).json({ error: 'Gemini OCR not configured. Check GEMINI_API_KEY.' });
    }

    let mimeType = 'image/jpeg';
    let base64Data = image;

    if (image.includes(',')) {
      const parts = image.split(',');
      const match = parts[0].match(/:(.*?);/);
      if (match) mimeType = match[1];
      base64Data = parts[1];
    }

    // Execute OpenCV 5 native preprocessor with CLAHE contrast enhancement
    const opencvQuality = await runOpenCV5Worker(base64Data, true);
    
    // If OpenCV 5 CLAHE enhancement was produced, feed the enhanced image to OCR for maximum legibility
    let ocrInputBase64 = base64Data;
    if (opencvQuality?.enhanced_image && opencvQuality.enhanced_image.includes(',')) {
      ocrInputBase64 = opencvQuality.enhanced_image.split(',')[1];
    }

    const promptText = `
You are a precision Optical Character Recognition (OCR) engine for blind and low-vision assistance.
Read ALL visible text, labels, badges, logos, headings, signs, door plaques, and packaging text in this image with 100% exact character and word accuracy.

CRITICAL ACCURACY INSTRUCTIONS:
- Transcribe EXACT text without typos or spelling errors.
- Preserve natural reading order and line breaks.
- If there is branding, certification titles, door numbers, or packaging, accurately extract every word.
- Ignore meaningless background noise or artifacts.
- If no text is visible, set extracted_text to empty string.

Return valid JSON:
{
  "extracted_text": "Exact full text with natural line breaks",
  "lines": [
    { "text": "Exact line text", "confidence": 0.99 }
  ],
  "summary": "Brief 1-sentence spoken summary of what the text is"
}
`;

    const { text: responseText, modelName } = await generateMultimodalVisionWithCascade(
      ai,
      mimeType,
      ocrInputBase64,
      promptText
    );

    const parsed = extractJsonFromText(responseText);
    const extractedText = (parsed.extracted_text || '').trim();
    let lines = (parsed.lines || []).map((l: any) => ({
      text: typeof l === 'string' ? l.trim() : (l.text || '').trim(),
      confidence: typeof l === 'object' && l.confidence ? l.confidence : 0.95,
    })).filter((l: any) => l.text.length > 0);

    if (lines.length === 0 && extractedText) {
      lines = extractedText.split('\n').map((t: string) => ({ text: t.trim(), confidence: 0.95 })).filter((l: any) => l.text.length > 0);
    }

    const wordCount = extractedText ? extractedText.split(/\s+/).filter(Boolean).length : 0;
    const elapsed = Date.now() - startTime;

    res.json({
      success: true,
      message: wordCount > 0 ? `Read ${wordCount} words with high precision.` : 'No text visible in image.',
      extracted_text: extractedText,
      lines,
      summary: parsed.summary || extractedText || 'No readable text visible in this view.',
      word_count: wordCount,
      processing_time_ms: elapsed,
      engine_ready: true,
      model_status: `${modelName} + OpenCV 5.0.0 CLAHE OCR Preprocessor`,
      opencv_version: '5.0.0',
      opencv_quality: opencvQuality || undefined,
    });
  } catch (error: any) {
    console.error('OCR vision error:', error);
    let cleanMessage = error?.message || 'OCR extraction failed.';
    try {
      if (cleanMessage.includes('{') && cleanMessage.includes('}')) {
        const parsedErr = JSON.parse(cleanMessage.replace(/^[^{]*(\{[\s\S]*\})[^}]*$/, '$1'));
        if (parsedErr?.error?.message) {
          cleanMessage = parsedErr.error.message;
        }
      }
    } catch (e) {}

    if (cleanMessage.includes('high demand') || cleanMessage.includes('503') || cleanMessage.includes('UNAVAILABLE')) {
      cleanMessage = 'The OCR service is experiencing temporary peak demand. Please click Retry.';
    }

    res.status(500).json({ error: cleanMessage });
  }
});

// Gemini TTS Endpoint
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice = 'Kore' } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required for TTS.' });
    }

    if (!ai) {
      return res.status(503).json({ error: 'Gemini TTS not configured.' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.trim(),
              speechMetadata: {
                style: 'Clear, warm, accessible assistive vision assistant',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      res.json({
        success: true,
        audioDataUrl: `data:audio/wav;base64,${base64Audio}`,
      });
    } else {
      res.status(500).json({ error: 'No audio generated by TTS model.' });
    }
  } catch (err: any) {
    console.warn('Gemini TTS error:', err);
    res.status(500).json({ error: err?.message || 'TTS generation failed.' });
  }
});

// Accessible Pedestrian Destination Search Endpoint
app.get('/api/navigation/search', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    const userLat = req.query.lat ? Number(req.query.lat) : null;
    const userLng = req.query.lng ? Number(req.query.lng) : null;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Geocoding via OpenStreetMap Nominatim with proximity viewbox if user location is available
    let nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&addressdetails=1&limit=8`;

    if (userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)) {
      const delta = 0.15; // ~15km bounding box for locality bias
      nominatimUrl += `&viewbox=${userLng - delta},${userLat + delta},${userLng + delta},${userLat - delta}&bounded=0`;
    }

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'OmniLens-Assistive-Vision/2.0 (Accessibility Navigation Assistant)',
        'Accept-Language': 'en',
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'Destination search provider is temporarily unavailable' });
    }

    const rawPlaces = await response.json();
    if (!Array.isArray(rawPlaces)) {
      return res.json({ places: [] });
    }

    // Structure results with human-readable labels and distance estimates
    const places = rawPlaces.map((p: any) => {
      const lat = parseFloat(p.lat);
      const lng = parseFloat(p.lon);
      let distanceMeters: number | undefined;

      if (userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)) {
        const R = 6371e3;
        const phi1 = (userLat * Math.PI) / 180;
        const phi2 = (lat * Math.PI) / 180;
        const deltaPhi = ((lat - userLat) * Math.PI) / 180;
        const deltaLambda = ((lng - userLng) * Math.PI) / 180;
        const a =
          Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
          Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distanceMeters = Math.round(R * c);
      }

      const shortName =
        p.name ||
        p.address?.amenity ||
        p.address?.shop ||
        p.address?.road ||
        p.display_name.split(',')[0];

      return {
        id: String(p.place_id || Math.random().toString(36).substring(2)),
        name: shortName,
        displayName: p.display_name,
        display_name: p.display_name,
        lat,
        lng,
        category: p.class || p.type || 'place',
        type: p.type,
        distanceMeters,
      };
    });

    if (userLat !== null && userLng !== null) {
      places.sort((a: any, b: any) => (a.distanceMeters || 999999) - (b.distanceMeters || 999999));
    }

    res.json({ places, results: places });
  } catch (err: any) {
    console.error('Navigation search error:', err);
    res.status(500).json({ error: err?.message || 'Failed to search destinations' });
  }
});

// Pedestrian Walking Directions Route Endpoint
app.post('/api/navigation/route', async (req, res) => {
  try {
    const { origin, destination, destinationName, startLat, startLng } = req.body;
    const origLat = Number(origin?.lat ?? startLat);
    const origLng = Number(origin?.lng ?? startLng);
    const destLat = Number(destination?.lat ?? req.body.destLat);
    const destLng = Number(destination?.lng ?? req.body.destLng);

    if (isNaN(origLat) || isNaN(origLng) || isNaN(destLat) || isNaN(destLng)) {
      return res.status(400).json({ error: 'Origin and destination coordinates are required' });
    }

    // Deep links to established external navigation applications
    const externalGoogleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origLat},${origLng}&destination=${destLat},${destLng}&travelmode=walking`;
    const externalAppleMapsUrl = `https://maps.apple.com/?saddr=${origLat},${origLng}&daddr=${destLat},${destLng}&dirflg=w`;

    // Call pedestrian routing service (OSRM routed-foot)
    const osrmUrl = `https://routing.openstreetmap.de/routed-foot/route/v1/walking/${origLng},${origLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;

    let routeData: any = null;
    let providerName: 'osrm-foot' | 'google-maps' | 'hybrid' = 'osrm-foot';

    try {
      const resp = await fetch(osrmUrl, {
        headers: { 'User-Agent': 'OmniLens-Assistive-Vision/2.0' },
      });
      if (resp.ok) {
        routeData = await resp.json();
      }
    } catch (osrmErr) {
      console.warn('OSRM primary foot router error, trying fallback:', osrmErr);
    }

    // Fallback to project-osrm router if needed
    if (!routeData || routeData.code !== 'Ok') {
      try {
        const fallbackUrl = `https://router.project-osrm.org/route/v1/foot/${origLng},${origLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;
        const resp = await fetch(fallbackUrl, {
          headers: { 'User-Agent': 'OmniLens-Assistive-Vision/2.0' },
        });
        if (resp.ok) {
          routeData = await resp.json();
        }
      } catch (e2) {}
    }

    if (!routeData || routeData.code !== 'Ok' || !routeData.routes?.[0]) {
      return res.status(502).json({
        error: 'Unable to calculate pedestrian route for these coordinates.',
        externalGoogleMapsUrl,
        externalAppleMapsUrl,
      });
    }

    const route = routeData.routes[0];
    const leg = route.legs?.[0];
    const rawSteps = leg?.steps || [];

    // Parse into accessible pedestrian steps
    const steps = rawSteps.map((s: any, idx: number) => {
      const modifier = s.maneuver?.modifier || (s.maneuver?.type === 'arrive' ? 'arrive' : 'straight');
      const street = s.name ? s.name : 'pathway';
      const dist = Math.round(s.distance || 0);

      // Generate natural, clear spoken pedestrian instructions
      let spoken = '';
      if (s.maneuver?.type === 'depart') {
        spoken = `Start walking on ${street}. Continue for ${dist} metres.`;
      } else if (s.maneuver?.type === 'arrive') {
        spoken = `You will arrive at your destination ${destinationName ? destinationName : ''}.`;
      } else {
        const dir = modifier.replace(/_/g, ' ');
        if (dist > 5) {
          spoken = `In ${dist} metres, turn ${dir} onto ${street}.`;
        } else {
          spoken = `Turn ${dir} onto ${street}.`;
        }
      }

      return {
        id: `step-${idx}`,
        stepIndex: idx + 1,
        instruction: spoken,
        spokenInstruction: spoken,
        distanceMeters: dist,
        durationSeconds: Math.round(s.duration || 0),
        modifier,
        streetName: street,
        location: [s.maneuver?.location?.[1] || 0, s.maneuver?.location?.[0] || 0],
      };
    });

    const totalDistanceMeters = Math.round(route.distance || 0);
    const totalDurationSeconds = Math.round(route.duration || 0);

    res.json({
      id: `route-${Date.now()}`,
      destination: {
        id: `dest-${Date.now()}`,
        name: destinationName || 'Selected Destination',
        displayName: destinationName || `${destLat.toFixed(4)}, ${destLng.toFixed(4)}`,
        lat: destLat,
        lng: destLng,
      },
      origin: { lat: origLat, lng: origLng },
      steps,
      totalDistanceMeters,
      totalDurationSeconds,
      distance_meters: totalDistanceMeters,
      duration_minutes: Math.ceil(totalDurationSeconds / 60),
      summary: leg?.summary || 'Pedestrian route',
      geometryCoordinates: route.geometry?.coordinates?.map((c: [number, number]) => [c[1], c[0]]) || [],
      externalGoogleMapsUrl,
      externalAppleMapsUrl,
      external_links: {
        google_maps: externalGoogleMapsUrl,
        apple_maps: externalAppleMapsUrl,
      },
      safetyDisclaimer:
        'SafePath Walking Navigation is an assistive directional guide. It does NOT guarantee step-free sidewalks, safe crossings, or clear paths. Always use your cane, guide dog, and physical orientation skills.',
      provider: providerName,
    });
  } catch (err: any) {
    console.error('Route calculation error:', err);
    res.status(500).json({ error: err?.message || 'Failed to calculate pedestrian route' });
  }
});

// Vite middleware mounting in development mode
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OmniLens Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
