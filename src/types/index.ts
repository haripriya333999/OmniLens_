export interface BoundingBox {
  x: number;      // x coordinate (left)
  y: number;      // y coordinate (top)
  width: number;  // width
  height: number; // height
}

export type HorizontalPosition = 'left' | 'center' | 'right';

export interface Detection {
  id: string;
  label: string;
  confidence: number; // 0.0 to 1.0
  box: BoundingBox;
  position: HorizontalPosition;
  sideDirection?: string;      // e.g. "on your left side", "in the center", "on your right side"
  verticalPosition?: string;   // e.g. "up near the ceiling", "at eye level", "at waist level", "down near the floor"
  prominence?: 'foreground' | 'midground' | 'background';
  activityOrDetails?: string;  // e.g. "making thumbs-down gesture with eyeglasses", "closed beige wooden door with latch"
  normalizedBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface OpenCVQuality {
  opencv_version: string;
  is_opencv_5: boolean;
  width: number;
  height: number;
  blur_score: number;
  laplacian_variance?: number;
  is_blurry: boolean;
  mean_luminance: number;
  contrast_std: number;
  glare_ratio: number;
  glare_detected: boolean;
  is_too_dark: boolean;
  is_low_light?: boolean;
  is_overexposed: boolean;
  clahe_applied: boolean;
  low_light_applied?: boolean;
  enhancement_type?: string;
  speech_guidance: string;
  processing_time_ms: number;
  enhanced_image?: string | null;
}

export type OpenCVQualityMetrics = OpenCVQuality;

export interface DescribeResponse {
  success: boolean;
  message: string;
  detections: Detection[];
  scene_description: string;
  navigation_guidance?: string;
  human_activities?: string;
  visible_text?: string;
  total_objects_count: number;
  processing_time_ms: number;
  model_status: string;
  lighting_level?: string;
  lighting_advice?: string;
  opencv_version?: string;
  opencv_quality?: OpenCVQuality;
}

export interface FindResponse {
  success: boolean;
  message: string;
  requested_object: string;
  is_category_supported: boolean;
  found: boolean;
  matches: Detection[];
  position?: HorizontalPosition;
  side_direction?: string;
  vertical_position?: string;
  confidence?: number;
  spoken_summary: string;
  processing_time_ms: number;
  model_status: string;
  all_candidates?: Detection[];
  sub_threshold_candidates?: Detection[];
  threshold_used?: number;
  has_sub_threshold?: boolean;
  agentic_guidance?: string;
  search_attempt?: number;
  opencv_version?: string;
  opencv_quality?: OpenCVQuality;
}

export interface OCRLine {
  text: string;
  confidence: number;
  box?: BoundingBox;
}

export interface OCRResponse {
  success: boolean;
  message: string;
  extracted_text: string;
  lines: OCRLine[];
  summary?: string;
  word_count: number;
  processing_time_ms: number;
  engine_ready: boolean;
  model_status: string;
  opencv_version?: string;
  opencv_quality?: OpenCVQuality;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'offline';
  model_name: string;
  detector_ready: boolean;
  ocr_ready: boolean;
  gemini_vision_active?: boolean;
  supported_classes_count: number | string;
  version: string;
  opencv_version?: string;
  opencv5_ready?: boolean;
}

export type ActiveTask = 'describe' | 'find' | 'read' | 'safepath' | 'live' | 'settings' | 'about';

export type ObstacleSector = 'left' | 'center' | 'right';
export type ObstacleProximity = 'immediate_path' | 'approaching' | 'peripheral';

export interface SafePathObstacle {
  id: string;
  trackId: number;
  label: string;
  confidence: number;
  box: BoundingBox;
  sector: ObstacleSector;       // left, center, right
  normalizedXCenter: number;   // 0.0 - 1.0
  normalizedYMax: number;      // 0.0 - 1.0 (how close to bottom/floor)
  proximity: ObstacleProximity; // immediate_path, approaching, peripheral
  isFloorLevel: boolean;       // bags, shoes, boxes, chairs on floor
  alertText: string;           // e.g. "Potential obstacle visible ahead, slightly to your left"
  persistenceFrames: number;   // consecutive frames seen
  isNewTrack: boolean;
}

export interface NavigationPlace {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  category?: string;
  type?: string;
  distanceMeters?: number;
}

export interface NavigationStep {
  id: string;
  stepIndex: number;
  instruction: string;
  spokenInstruction: string;
  distanceMeters: number;
  durationSeconds: number;
  modifier: 'depart' | 'straight' | 'slight left' | 'left' | 'sharp left' | 'slight right' | 'right' | 'sharp right' | 'u-turn' | 'arrive';
  streetName: string;
  location: [number, number]; // [lat, lng]
}

export interface NavigationRoute {
  id: string;
  destination: NavigationPlace;
  origin: { lat: number; lng: number };
  steps: NavigationStep[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  summary: string;
  geometryCoordinates?: [number, number][]; // [lat, lng][]
  externalGoogleMapsUrl: string;
  externalAppleMapsUrl: string;
  safetyDisclaimer: string;
  provider: 'osrm-foot' | 'google-maps' | 'hybrid';
}

export type NavigationState =
  | 'idle'
  | 'searching'
  | 'confirming_destination'
  | 'calculating_route'
  | 'navigating'
  | 'paused'
  | 'arrived'
  | 'rerouting'
  | 'error';

export interface GpsAccuracyInfo {
  lat: number;
  lng: number;
  accuracyMeters: number;
  quality: 'high' | 'fair' | 'poor' | 'searching' | 'unavailable';
  heading: number | null;
  speed: number | null;
  timestamp: number;
  permissionStatus: 'granted' | 'prompt' | 'denied';
}

export interface SafePathResponse {
  success: boolean;
  message: string;
  obstacles: SafePathObstacle[];
  primary_obstacle?: SafePathObstacle | null;
  spoken_alert: string;        // Concise prioritized speech
  should_speak: boolean;       // False if duplicate suppressed
  path_status: 'clear_view' | 'obstacles_detected' | 'caution_unclear' | 'low_light_enhanced';
  opencv_version: string;
  opencv_quality?: OpenCVQuality;
  low_light_applied: boolean;
  enhancement_type?: 'none' | 'clahe_lab' | 'gamma_correction' | 'bilateral_denoise' | 'gamma_and_clahe';
  processing_time_ms: number;
  model_status: string;
  tracked_count: number;
  safety_disclaimer: string;
}

export type EngineMode = 'gemini-vision' | 'python-fastapi' | 'web-ml';

export interface AccessibilitySettings {
  fontSize: 'normal' | 'large' | 'extra-large';
  highContrast: boolean;
  reduceMotion: boolean;
  speechRate: number;
  speechPitch: number;
  autoSpeakResults: boolean;
  announcePosition: boolean;
  soundEffects: boolean;
  invertLeftRight: boolean; // Laptop camera / webcam mirror perspective (swaps left & right directions)
}

// Broad supported everyday, architectural, room, and campus classes
export const SUPPORTED_EVERYDAY_CLASSES: string[] = [
  // Architectural & Structural
  'door', 'closed door', 'open door', 'doorway', 'door handle', 'door latch',
  'window', 'grilled window', 'glass window', 'ventilator', 'curtain', 'window blinds',
  'wall', 'corridor', 'hallway', 'stairs', 'staircase', 'steps', 'railing', 'pillar',
  
  // Overhead & Electrical
  'ceiling fan', 'table fan', 'fan', 'exhaust fan',
  'light', 'tube light', 'bulb', 'lamp', 'ceiling light',
  'switchboard', 'switch', 'socket', 'plug',
  
  // Furniture & Room Fixtures
  'chair', 'armchair', 'office chair', 'study desk', 'desk', 'table', 'dining table',
  'bed', 'cot', 'couch', 'sofa', 'wardrobe', 'cupboard', 'shelf', 'mirror', 'clock',
  'dustbin', 'trash can', 'waste basket', 'sink', 'tap',
  
  // Clothing & Personal Items
  'clothes', 'shirt', 'dress', 'garment', 'laundry', 'jacket', 't-shirt',
  'glasses', 'spectacles', 'eyewear', 'sunglasses',
  'shoes', 'slippers', 'sandals', 'footwear',
  'backpack', 'bag', 'handbag', 'wallet', 'purse', 'suitcase',
  'water bottle', 'bottle', 'flask', 'cup', 'mug', 'tumbler', 'snack packet', 'food packet',
  
  // Electronics
  'cell phone', 'phone', 'smartphone', 'laptop', 'computer', 'screen', 'monitor', 'tv', 'keyboard', 'mouse',
  
  // Persons & Activities
  'person', 'man', 'woman', 'girl', 'boy', 'student', 'teacher',
  
  // Classroom & Public Campus
  'whiteboard', 'blackboard', 'notice board', 'projector', 'podium', 'bench',
  'water dispenser', 'water purifier', 'water cooler', 'exit sign', 'fire extinguisher',
  'book', 'notebook', 'pen', 'pencil'
];

export const COCO_CLASSES = SUPPORTED_EVERYDAY_CLASSES;
