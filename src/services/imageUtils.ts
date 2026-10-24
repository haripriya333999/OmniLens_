import { Detection, HorizontalPosition } from '../types';

/**
 * Flips an image horizontally (left <-> right mirroring).
 * Used when laptop webcam or selfie camera flips directions.
 */
export async function flipImageHorizontally(imageSrc: string): Promise<{ dataUrl: string; file: File }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available for flipping image'));
        return;
      }
      // Flip horizontally
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'flipped-photo.jpg', { type: 'image/jpeg' });
          resolve({ dataUrl, file });
        } else {
          resolve({ dataUrl, file: new File([], 'flipped-photo.jpg') });
        }
      }, 'image/jpeg', 0.95);
    };
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });
}

/**
 * Inverts the horizontal coordinates and directional labels of detections
 * when an image is flipped or when webcam mirror mode is active.
 */
export function flipDetectionsHorizontally(detections: Detection[], imageWidth: number = 1000): Detection[] {
  return detections.map((det) => {
    // Standard bounding box flip: newX = imageWidth - (oldX + width)
    const newX = Math.max(0, imageWidth - (det.box.x + det.box.width));
    const newPosition: HorizontalPosition =
      det.position === 'left' ? 'right' : det.position === 'right' ? 'left' : 'center';

    let newSide = det.sideDirection;
    if (newSide) {
      if (newSide.includes('far left')) {
        newSide = newSide.replace('far left', 'far right');
      } else if (newSide.includes('far right')) {
        newSide = newSide.replace('far right', 'far left');
      } else if (newSide.includes('left')) {
        newSide = newSide.replace('left', 'right');
      } else if (newSide.includes('right')) {
        newSide = newSide.replace('right', 'left');
      }
    }

    let newNormalizedBox = det.normalizedBox;
    if (newNormalizedBox) {
      newNormalizedBox = {
        ...newNormalizedBox,
        x: Math.max(0, 1000 - (newNormalizedBox.x + newNormalizedBox.width)),
      };
    }

    return {
      ...det,
      box: {
        ...det.box,
        x: newX,
      },
      normalizedBox: newNormalizedBox,
      position: newPosition,
      sideDirection: newSide,
    };
  });
}

/**
 * Reverse spatial words in description text if a mirrored perspective is required
 */
export function invertSpatialText(text: string): string {
  if (!text) return text;
  // Use a placeholder to swap 'left' and 'right' safely without double-replacement
  return text
    .replace(/\bleft\b/gi, (m) => (m === 'LEFT' ? '___RIGHT___' : m === 'Left' ? '___Right___' : '___right___'))
    .replace(/\bright\b/gi, (m) => (m === 'RIGHT' ? 'LEFT' : m === 'Right' ? 'Left' : 'left'))
    .replace(/___RIGHT___/g, 'RIGHT')
    .replace(/___Right___/g, 'Right')
    .replace(/___right___/g, 'right');
}
