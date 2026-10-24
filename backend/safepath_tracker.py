"""
OmniLens SafePath - Obstacle Localization, Sector Classification & Multi-Frame Tracker
Maintains temporal stability across video frames, tracks obstacle persistence,
and suppresses duplicate voice alerts.
"""

import time
from typing import List, Dict, Any, Tuple, Optional

# Supported obstacle classes for walking path awareness
OBSTACLE_CLASSES = {
    'chair', 'table', 'dining table', 'couch', 'sofa', 'bed',
    'backpack', 'handbag', 'suitcase', 'bag',
    'bottle', 'box', 'shoes', 'footwear',
    'person', 'bicycle', 'motorcycle',
    'potted plant', 'trash can', 'dustbin',
    'door', 'closed door', 'steps', 'stairs'
}

class SafePathTrack:
    def __init__(self, track_id: int, label: str, box: Dict[str, float], sector: str, ymax: float, confidence: float, is_new: bool = True):
        self.track_id = track_id
        self.label = label
        self.box = box
        self.sector = sector
        self.ymax = ymax
        self.confidence = confidence
        self.persistence_frames = 1
        self.first_seen = time.time()
        self.last_seen = time.time()
        self.last_alerted = 0.0
        self.last_alerted_sector = None
        self.is_new = is_new

class SafePathTracker:
    def __init__(self, suppression_cooldown_sec: float = 8.0, max_track_age_sec: float = 3.0):
        self.suppression_cooldown = suppression_cooldown_sec
        self.max_track_age = max_track_age_sec
        self.tracks: Dict[int, SafePathTrack] = {}
        self.next_track_id = 1
        self.last_spoken_message = ""
        self.last_spoken_time = 0.0

    def compute_iou(self, b1: Dict[str, float], b2: Dict[str, float]) -> float:
        x1 = max(b1['x'], b2['x'])
        y1 = max(b1['y'], b2['y'])
        x2 = min(b1['x'] + b1['width'], b2['x'] + b2['width'])
        y2 = min(b1['y'] + b1['height'], b2['y'] + b2['height'])

        intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)
        area1 = max(1.0, b1['width'] * b1['height'])
        area2 = max(1.0, b2['width'] * b2['height'])
        union = area1 + area2 - intersection
        return intersection / union if union > 0 else 0.0

    def classify_sector(self, box: Dict[str, float], img_width: float = 1000.0) -> Tuple[str, float]:
        xc = box['x'] + (box['width'] / 2.0)
        r = xc / max(1.0, img_width)
        if r < 0.35:
            return "left", r
        elif r > 0.65:
            return "right", r
        else:
            return "center", r

    def update(
        self,
        raw_detections: List[Dict[str, Any]],
        img_width: float = 1000.0,
        img_height: float = 1000.0,
        invert_lr: bool = False
    ) -> Dict[str, Any]:
        current_time = time.time()

        # Prune stale tracks
        stale_ids = [tid for tid, trk in self.tracks.items() if (current_time - trk.last_seen) > self.max_track_age]
        for tid in stale_ids:
            del self.tracks[tid]

        # Match new detections to existing tracks
        processed_obstacles: List[Dict[str, Any]] = []
        assigned_track_ids = set()

        for det in raw_detections:
            label = det.get('label', 'object').lower()
            box = det.get('box', {'x': 0, 'y': 0, 'width': 100, 'height': 100})
            confidence = det.get('confidence', 0.5)

            # Flip coordinates if webcam mirroring is active
            if invert_lr:
                box = {
                    'x': max(0.0, img_width - (box['x'] + box['width'])),
                    'y': box['y'],
                    'width': box['width'],
                    'height': box['height']
                }

            sector, r = self.classify_sector(box, img_width)
            ymax = (box['y'] + box['height']) / max(1.0, img_height)

            # Match to existing track with highest IoU
            best_iou = 0.0
            matched_id = None
            for tid, trk in self.tracks.items():
                if tid in assigned_track_ids:
                    continue
                if trk.label == label:
                    iou = self.compute_iou(trk.box, box)
                    if iou > 0.25 and iou > best_iou:
                        best_iou = iou
                        matched_id = tid

            is_new = False
            if matched_id is not None:
                track = self.tracks[matched_id]
                track.box = box
                track.sector = sector
                track.ymax = ymax
                track.confidence = confidence
                track.persistence_frames += 1
                track.last_seen = current_time
                track.is_new = False
                track_id = matched_id
            else:
                track_id = self.next_track_id
                self.next_track_id += 1
                track = SafePathTrack(track_id, label, box, sector, ymax, confidence)
                self.tracks[track_id] = track
                is_new = True

            assigned_track_ids.add(track_id)

            # Determine proximity
            is_floor = ymax > 0.55
            if sector == "center" and is_floor:
                proximity = "immediate_path"
            elif sector == "center" or (is_floor and sector in ("left", "right")):
                proximity = "approaching"
            else:
                proximity = "peripheral"

            # Formulate natural human obstacle warning
            sector_phrasing = "directly ahead" if sector == "center" else f"to your {sector}"
            if proximity == "immediate_path":
                alert_text = f"Potential obstacle visible {sector_phrasing} on the floor."
            elif label in ('chair', 'table', 'couch', 'desk'):
                alert_text = f"A {label} is visible {sector_phrasing}."
            elif label == 'person':
                alert_text = f"A person is visible {sector_phrasing}."
            else:
                alert_text = f"Potential obstacle visible {sector_phrasing}."

            processed_obstacles.append({
                "id": f"safepath-{track_id}",
                "trackId": track_id,
                "label": label,
                "confidence": round(float(confidence), 2),
                "box": box,
                "sector": sector,
                "normalizedXCenter": round(float(r), 3),
                "normalizedYMax": round(float(ymax), 3),
                "proximity": proximity,
                "isFloorLevel": is_floor,
                "alertText": alert_text,
                "persistenceFrames": track.persistence_frames,
                "isNewTrack": is_new
            })

        # Prioritize primary obstacle: immediate_path first, then approaching, center over sides
        priority_map = {"immediate_path": 3, "approaching": 2, "peripheral": 1}
        processed_obstacles.sort(
            key=lambda obs: (
                priority_map.get(obs["proximity"], 0),
                1 if obs["sector"] == "center" else 0,
                obs["normalizedYMax"],
                obs["confidence"]
            ),
            reverse=True
        )

        primary = processed_obstacles[0] if processed_obstacles else None

        # Decide whether to speak (duplicate suppression policy)
        should_speak = False
        spoken_alert = ""

        if primary:
            track = self.tracks.get(primary["trackId"])
            time_since_last_alert = current_time - (track.last_alerted if track else 0.0)
            sector_changed = track and (track.last_alerted_sector != primary["sector"])
            global_quiet_time = current_time - self.last_spoken_time

            # Announce if:
            # 1. New track with high confidence or persistence >= 2
            # 2. Track changed sectors (e.g. center to left)
            # 3. Cooldown expired (8+ seconds) and at least 3 seconds since any speech
            if track:
                if (track.is_new and primary["confidence"] >= 0.40) or track.persistence_frames >= 2:
                    if (time_since_last_alert > self.suppression_cooldown or sector_changed) and global_quiet_time > 3.0:
                        should_speak = True
                        spoken_alert = primary["alertText"]
                        track.last_alerted = current_time
                        track.last_alerted_sector = primary["sector"]
                        self.last_spoken_message = spoken_alert
                        self.last_spoken_time = current_time
        else:
            # No obstacles detected
            if (current_time - self.last_spoken_time) > 20.0 and self.last_spoken_message != "Path appears open ahead.":
                spoken_alert = "No potential obstacles visible in your camera view."
                # Note: We do NOT proclaim path is definitely clear (per Safety Rule #9)

        path_status = "obstacles_detected" if processed_obstacles else "clear_view"

        return {
            "obstacles": processed_obstacles,
            "primary_obstacle": primary,
            "spoken_alert": spoken_alert if should_speak else "",
            "should_speak": should_speak,
            "path_status": path_status,
            "tracked_count": len(self.tracks)
        }
