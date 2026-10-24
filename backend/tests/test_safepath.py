import sys
import os
import time
from PIL import Image
import numpy as np

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from safepath_tracker import SafePathTracker
from utils.image_preprocessing import (
    get_opencv5_version,
    estimate_blur_and_lighting,
    adaptive_enhance_for_safepath,
)

def test_opencv5_version_verified():
    """Verify strictly OpenCV 5.0.0 is loaded and reported."""
    ver = get_opencv5_version()
    assert ver.startswith("5.0.0"), f"Expected OpenCV 5.0.0.x but got {ver}"

def test_safepath_sector_classification():
    """Verify horizontal normalization: Left (<0.35), Center (0.35-0.65), Right (>0.65)."""
    tracker = SafePathTracker()

    # Left obstacle (center at x=200 in 1000px image -> r=0.20)
    box_left = {"x": 150, "y": 600, "width": 100, "height": 100}
    sector, r = tracker.classify_sector(box_left, img_width=1000)
    assert sector == "left"
    assert r < 0.35

    # Center obstacle (center at x=500 in 1000px image -> r=0.50)
    box_center = {"x": 450, "y": 600, "width": 100, "height": 100}
    sector, r = tracker.classify_sector(box_center, img_width=1000)
    assert sector == "center"
    assert 0.35 <= r <= 0.65

    # Right obstacle (center at x=800 in 1000px image -> r=0.80)
    box_right = {"x": 750, "y": 600, "width": 100, "height": 100}
    sector, r = tracker.classify_sector(box_right, img_width=1000)
    assert sector == "right"
    assert r > 0.65

def test_safepath_floor_and_proximity_detection():
    """Verify floor-level priority (immediate_path for center floor objects)."""
    tracker = SafePathTracker()

    # Center + Floor obstacle (ymax = 800/1000 = 0.80 > 0.55)
    det_floor_center = [{
        "label": "backpack",
        "confidence": 0.85,
        "box": {"x": 450, "y": 600, "width": 100, "height": 200}
    }]
    res = tracker.update(det_floor_center, img_width=1000, img_height=1000)
    assert len(res["obstacles"]) == 1
    obs = res["obstacles"][0]
    assert obs["sector"] == "center"
    assert obs["isFloorLevel"] is True
    assert obs["proximity"] == "immediate_path"
    assert "floor" in obs["alertText"].lower()

def test_safepath_duplicate_alert_suppression():
    """Verify consecutive frames of the same obstacle suppress repetitive audio within 8s cooldown."""
    tracker = SafePathTracker(suppression_cooldown_sec=8.0)

    det = [{
        "label": "chair",
        "confidence": 0.80,
        "box": {"x": 450, "y": 600, "width": 100, "height": 200}
    }]

    # Frame 1: First appearance (should speak)
    res1 = tracker.update(det, img_width=1000, img_height=1000)
    assert res1["should_speak"] is True
    assert len(res1["spoken_alert"]) > 0

    # Frame 2: 0.5 seconds later, same obstacle (must be suppressed!)
    res2 = tracker.update(det, img_width=1000, img_height=1000)
    assert res2["should_speak"] is False
    assert res2["spoken_alert"] == ""

    # Frame 3: Move obstacle to left side (sector changed -> should trigger update)
    det_left = [{
        "label": "chair",
        "confidence": 0.80,
        "box": {"x": 100, "y": 600, "width": 100, "height": 200}
    }]
    # Advance time slightly to bypass global quiet window
    tracker.last_spoken_time -= 4.0
    res3 = tracker.update(det_left, img_width=1000, img_height=1000)
    assert res3["should_speak"] is True
    assert "left" in res3["spoken_alert"].lower()

def test_safepath_adaptive_lowlight_enhancement():
    """Verify adaptive OpenCV 5 CLAHE and gamma enhancement on dim image."""
    dim_img = Image.new("RGB", (320, 240), (25, 25, 25))
    enhanced, stats = adaptive_enhance_for_safepath(dim_img)
    assert stats["is_low_light"] is True
    assert stats["gamma_applied"] > 1.0
    assert stats["clahe_applied"] is True
    assert isinstance(enhanced, np.ndarray)

def test_safepath_cautious_safety_language():
    """Verify SafePath phrasing avoids definitive claims and uses cautious assistance terms."""
    tracker = SafePathTracker()
    det = [{
        "label": "box",
        "confidence": 0.75,
        "box": {"x": 480, "y": 700, "width": 80, "height": 100}
    }]
    res = tracker.update(det, img_width=1000, img_height=1000)
    alert = res["obstacles"][0]["alertText"]
    assert "potential obstacle" in alert.lower()
    # Must NOT claim certainty of collision or clear path
    assert "collision imminent" not in alert.lower()

if __name__ == "__main__":
    test_opencv5_version_verified()
    print("PASS: test_opencv5_version_verified")
    test_safepath_sector_classification()
    print("PASS: test_safepath_sector_classification")
    test_safepath_floor_and_proximity_detection()
    print("PASS: test_safepath_floor_and_proximity_detection")
    test_safepath_duplicate_alert_suppression()
    print("PASS: test_safepath_duplicate_alert_suppression")
    test_safepath_adaptive_lowlight_enhancement()
    print("PASS: test_safepath_adaptive_lowlight_enhancement")
    test_safepath_cautious_safety_language()
    print("PASS: test_safepath_cautious_safety_language")
    print("\nALL SAFEPATH TESTS PASSED SUCCESSFULLY!")
