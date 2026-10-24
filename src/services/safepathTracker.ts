import { BoundingBox, SafePathObstacle, ObstacleSector, ObstacleProximity } from '../types';

interface TrackRecord {
  trackId: number;
  label: string;
  box: BoundingBox;
  sector: ObstacleSector;
  ymax: number;
  confidence: number;
  persistenceFrames: number;
  firstSeen: number;
  lastSeen: number;
  lastAlertedTime: number;
  lastAlertedSector: ObstacleSector | null;
}

export class SafePathTracker {
  private tracks: Map<number, TrackRecord> = new Map();
  private nextTrackId: number = 1;
  private suppressionCooldownMs: number = 7500; // 7.5 seconds duplicate alert suppression
  private maxTrackAgeMs: number = 3000;
  private lastSpokenTime: number = 0;
  private lastSpokenText: string = '';

  public reset(): void {
    this.tracks.clear();
    this.nextTrackId = 1;
    this.lastSpokenTime = 0;
    this.lastSpokenText = '';
  }

  public computeIoU(b1: BoundingBox, b2: BoundingBox): number {
    const x1 = Math.max(b1.x, b2.x);
    const y1 = Math.max(b1.y, b2.y);
    const x2 = Math.min(b1.x + b1.width, b2.x + b2.width);
    const y2 = Math.min(b1.y + b1.height, b2.y + b2.height);

    const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const area1 = Math.max(1, b1.width * b1.height);
    const area2 = Math.max(1, b2.width * b2.height);
    const union = area1 + area2 - intersection;
    return union > 0 ? intersection / union : 0;
  }

  public classifySector(box: BoundingBox, imgWidth: number = 1000): { sector: ObstacleSector; r: number } {
    const xc = box.x + box.width / 2;
    const r = xc / Math.max(1, imgWidth);
    if (r < 0.35) return { sector: 'left', r };
    if (r > 0.65) return { sector: 'right', r };
    return { sector: 'center', r };
  }

  public processDetections(
    rawDetections: Array<{ label: string; confidence: number; box: BoundingBox }>,
    imgWidth: number = 1000,
    imgHeight: number = 1000,
    invertLeftRight: boolean = false
  ): {
    obstacles: SafePathObstacle[];
    primaryObstacle: SafePathObstacle | null;
    spokenAlert: string;
    shouldSpeak: boolean;
  } {
    const now = Date.now();

    // Prune stale tracks
    for (const [id, trk] of this.tracks.entries()) {
      if (now - trk.lastSeen > this.maxTrackAgeMs) {
        this.tracks.delete(id);
      }
    }

    const assignedTrackIds = new Set<number>();
    const obstacles: SafePathObstacle[] = [];

    for (const det of rawDetections) {
      let box = { ...det.box };
      if (invertLeftRight) {
        box.x = Math.max(0, imgWidth - (box.x + box.width));
      }

      const { sector, r } = this.classifySector(box, imgWidth);
      const ymax = (box.y + box.height) / Math.max(1, imgHeight);

      // Match to existing track
      let bestIoU = 0;
      let matchedId: number | null = null;

      for (const [id, trk] of this.tracks.entries()) {
        if (assignedTrackIds.has(id)) continue;
        if (trk.label.toLowerCase() === det.label.toLowerCase()) {
          const iou = this.computeIoU(trk.box, box);
          if (iou > 0.25 && iou > bestIoU) {
            bestIoU = iou;
            matchedId = id;
          }
        }
      }

      let isNew = false;
      let trackId: number;

      if (matchedId !== null) {
        trackId = matchedId;
        const trk = this.tracks.get(matchedId)!;
        trk.box = box;
        trk.sector = sector;
        trk.ymax = ymax;
        trk.confidence = det.confidence;
        trk.persistenceFrames += 1;
        trk.lastSeen = now;
      } else {
        trackId = this.nextTrackId++;
        isNew = true;
        this.tracks.set(trackId, {
          trackId,
          label: det.label,
          box,
          sector,
          ymax,
          confidence: det.confidence,
          persistenceFrames: 1,
          firstSeen: now,
          lastSeen: now,
          lastAlertedTime: 0,
          lastAlertedSector: null,
        });
      }

      assignedTrackIds.add(trackId);

      // Floor proximity & walking corridor analysis
      const isFloor = ymax > 0.55;
      let proximity: ObstacleProximity;
      if (sector === 'center' && isFloor) {
        proximity = 'immediate_path';
      } else if (sector === 'center' || (isFloor && (sector === 'left' || sector === 'right'))) {
        proximity = 'approaching';
      } else {
        proximity = 'peripheral';
      }

      // Generate natural, cautious speech
      const sectorPhrase = sector === 'center' ? 'directly ahead' : `to your ${sector}`;
      let alertText: string;
      if (proximity === 'immediate_path') {
        alertText = `Potential obstacle visible ${sectorPhrase} on the floor.`;
      } else if (['chair', 'table', 'couch', 'desk', 'box', 'backpack'].includes(det.label.toLowerCase())) {
        alertText = `A ${det.label} is visible ${sectorPhrase}.`;
      } else if (det.label.toLowerCase() === 'person') {
        alertText = `A person is visible ${sectorPhrase}.`;
      } else {
        alertText = `Potential obstacle visible ${sectorPhrase}.`;
      }

      const trk = this.tracks.get(trackId)!;

      obstacles.push({
        id: `safepath-${trackId}`,
        trackId,
        label: det.label,
        confidence: det.confidence,
        box,
        sector,
        normalizedXCenter: Math.round(r * 100) / 100,
        normalizedYMax: Math.round(ymax * 100) / 100,
        proximity,
        isFloorLevel: isFloor,
        alertText,
        persistenceFrames: trk.persistenceFrames,
        isNewTrack: isNew,
      });
    }

    // Sort by obstacle danger/relevance: immediate path (center & floor) first
    const proximityScore: Record<ObstacleProximity, number> = {
      immediate_path: 3,
      approaching: 2,
      peripheral: 1,
    };

    obstacles.sort((a, b) => {
      const pDiff = proximityScore[b.proximity] - proximityScore[a.proximity];
      if (pDiff !== 0) return pDiff;
      if (a.sector === 'center' && b.sector !== 'center') return -1;
      if (b.sector === 'center' && a.sector !== 'center') return 1;
      return b.normalizedYMax - a.normalizedYMax;
    });

    const primaryObstacle = obstacles.length > 0 ? obstacles[0] : null;

    // Duplicate alert suppression logic
    let shouldSpeak = false;
    let spokenAlert = '';

    if (primaryObstacle) {
      const trk = this.tracks.get(primaryObstacle.trackId);
      if (trk) {
        const timeSinceAlert = now - trk.lastAlertedTime;
        const sectorChanged = trk.lastAlertedSector !== primaryObstacle.sector;
        const globalQuietTime = now - this.lastSpokenTime;

        // Condition for speaking:
        // High confidence or persistent for 2 frames
        // AND (cooldown expired OR sector changed)
        // AND not talking over speech within 2.5s
        if ((primaryObstacle.confidence >= 0.45 || trk.persistenceFrames >= 2) && globalQuietTime > 2500) {
          if (timeSinceAlert > this.suppressionCooldownMs || sectorChanged) {
            shouldSpeak = true;
            spokenAlert = primaryObstacle.alertText;
            trk.lastAlertedTime = now;
            trk.lastAlertedSector = primaryObstacle.sector;
            this.lastSpokenTime = now;
            this.lastSpokenText = spokenAlert;
          }
        }
      }
    }

    return {
      obstacles,
      primaryObstacle,
      spokenAlert,
      shouldSpeak,
    };
  }
}

export const safePathTracker = new SafePathTracker();
