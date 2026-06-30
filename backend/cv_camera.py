"""
Real YOLO-based people counter for Campus Library Occupancy Dashboard.

Usage — one camera:
    python cv_camera.py --camera-id cam_01 --source 0

Usage — all 4 cameras (run 4 separate terminals, or use --multi):
    python cv_camera.py --multi

Camera source can be:
    0, 1, 2 ...     → USB/built-in webcam index
    rtsp://...      → IP camera RTSP stream
    http://...      → MJPEG stream
    /dev/video0     → Linux device
    test            → uses ml_stub simulation (no real camera needed)

━━━ HOW THIS CONNECTS TO BACKEND ━━━
After each inference it POSTs:
    POST https://library-backendd-production.up.railway.app/count/update
    { "camera_id": "cam_01", "count": 14 }

camera_id must match what's configured in Admin Panel.
"""

import argparse
import asyncio
import sys
import time
import random
from datetime import datetime, timezone

import httpx

BACKEND_URL = "https://library-backendd-production.up.railway.app"

# ─── Configure your cameras here ───────────────────────────────────────────
# source: webcam index (0,1,2), RTSP URL, or "test" for simulation
CAMERAS = {
    "cam_01": {"source": 0,      "name": "Entrance / Lobby"},
    "cam_02": {"source": 1,      "name": "Main Reading Hall"},
    "cam_03": {"source": 2,      "name": "Upper Floor / Quiet Zone"},
    "cam_04": {"source": 3,      "name": "Collaborative / Group Study"},
}

INFERENCE_INTERVAL = 3   # seconds between each count POST
SHOW_PREVIEW = False     # set True to open a CV window (requires display)
MODEL_NAME = "yolov8s.pt"  # small model — better overlap detection than nano, ~22MB

# Set True if cameras are ceiling-mounted (top-down view).
# False = side-angle view (webcam on desk/wall).
# Ceiling: laptop can be in ANY direction → uniform expansion used.
# Side: laptop is typically to the side/below person → directional expansion used.
CEILING_CAM = False
# ───────────────────────────────────────────────────────────────────────────


def load_yolo():
    """Import and load YOLO model. Fails clearly if ultralytics not installed."""
    try:
        from ultralytics import YOLO
        print(f"[CV] Loading model {MODEL_NAME} ...")
        model = YOLO(MODEL_NAME)
        print(f"[CV] Model ready.")
        return model
    except ImportError:
        print(
            "\n[ERROR] ultralytics not installed.\n"
            "Run:  pip install -r requirements_cv.txt\n"
        )
        sys.exit(1)


def is_near_person(obj_box: list, person_boxes: list) -> bool:
    """Check if an object belongs to a person using edge-distance proximity.

    Measures distance from laptop center to the NEAREST EDGE of person's bbox —
    not to the center. This avoids false negatives from adjacent seats because
    the threshold is relative to how far beyond the person's body the laptop is.

    CEILING_CAM=False (side view / webcam):
      Threshold = 0.5x person width beyond their edge.
      Also ignores laptops that are above the person in frame (not desk level).

    CEILING_CAM=True (top-down / ceiling cameras):
      Threshold = 0.7x person width beyond their edge, uniform all directions.
      Tighter than before (was 120% expansion) to avoid adjacent seat overlap.
    """
    ox = (obj_box[0] + obj_box[2]) / 2
    oy = (obj_box[1] + obj_box[3]) / 2
    for pb in person_boxes:
        pw = pb[2] - pb[0]
        ph = pb[3] - pb[1]

        # Distance from laptop center to nearest point on person bbox edge
        # 0 if laptop center is already inside/overlapping the person box
        dx = max(pb[0] - ox, 0, ox - pb[2])
        dy = max(pb[1] - oy, 0, oy - pb[3])
        dist_to_edge = (dx ** 2 + dy ** 2) ** 0.5

        if CEILING_CAM:
            # Top-down: uniform threshold, tighter to avoid adjacent seat spill
            threshold = pw * 0.7
        else:
            # Side view: skip laptops clearly above person (not at desk level)
            if oy < pb[1] - ph * 0.2:
                continue
            threshold = pw * 0.5

        if dist_to_edge < threshold:
            return True
    return False


def count_people_and_reserved(model, frame) -> tuple[int, int]:
    """Detect people and reserved seats separately.

    Returns (people_count, reserved_count) where reserved = laptops/books
    that are NOT near any detected person (i.e. seat is held but person absent).

    COCO classes used:
        0  = person
        63 = laptop  (books excluded — too many false positives from shelves)
    """
    # class 63 = laptop only — books excluded (false positives from shelves)
    results = model(frame, verbose=False, classes=[0, 63])
    boxes = results[0].boxes

    person_boxes = []
    object_boxes = []

    for box in boxes:
        cls = int(box.cls[0])
        coords = box.xyxy[0].tolist()
        if cls == 0:
            person_boxes.append(coords)
        else:
            object_boxes.append(coords)

    reserved = sum(
        1 for obj in object_boxes if not is_near_person(obj, person_boxes)
    )

    return len(person_boxes), reserved


async def post_count(client: httpx.AsyncClient, camera_id: str, count: int, reserved: int = 0) -> bool:
    """POST count to backend. Returns True on success."""
    try:
        r = await client.post(
            f"{BACKEND_URL}/count/update",
            json={
                "camera_id": camera_id,
                "count": count,
                "reserved": reserved,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            timeout=5.0,
        )
        return r.status_code == 200
    except Exception as e:
        print(f"[{camera_id}] POST failed: {e}")
        return False


async def run_camera(model, camera_id: str, source, client: httpx.AsyncClient):
    """Main loop for a single camera — capture → infer → POST."""
    import cv2

    cam_name = CAMERAS.get(camera_id, {}).get("name", camera_id)
    print(f"[{camera_id}] Starting — source={source!r}  region='{cam_name}'")

    while True:
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            print(f"[{camera_id}] Cannot open source {source!r}, retrying in 5s ...")
            await asyncio.sleep(5)
            continue

        print(f"[{camera_id}] Camera opened.")

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    print(f"[{camera_id}] Frame read failed — camera disconnected, reconnecting ...")
                    break

                count, reserved = count_people_and_reserved(model, frame)
                ok = await post_count(client, camera_id, count, reserved)
                status = "✓" if ok else "✗"
                ts = datetime.now().strftime("%H:%M:%S")
                print(f"[{camera_id}] {ts}  people={count:>3}  reserved={reserved:>2}  {status}")

                if SHOW_PREVIEW:
                    cv2.putText(frame, f"{camera_id}: {count} people  {reserved} reserved", (20, 40),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
                    cv2.imshow(f"Library CV — {camera_id}", frame)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        return

                await asyncio.sleep(INFERENCE_INTERVAL)

        finally:
            cap.release()

        await asyncio.sleep(3)  # wait before reconnect attempt


async def run_simulation(camera_id: str, client: httpx.AsyncClient):
    """Simulation mode — no real camera, generates realistic counts like ml_stub."""
    ranges = {"cam_01": (0,40,2), "cam_02": (10,80,5), "cam_03": (5,30,3), "cam_04": (0,25,2)}
    lo, hi, drift = ranges.get(camera_id, (0, 50, 3))
    count = random.randint(lo, hi)
    cam_name = CAMERAS.get(camera_id, {}).get("name", camera_id)

    print(f"[{camera_id}] Simulation mode — region='{cam_name}'")

    while True:
        count = max(lo, min(hi, count + random.randint(-drift, drift)))
        ok = await post_count(client, camera_id, count)
        status = "✓" if ok else "✗"
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{camera_id}] {ts}  count={count:>3}  {status} [SIM]")
        await asyncio.sleep(INFERENCE_INTERVAL)


async def main():
    parser = argparse.ArgumentParser(description="Library YOLO people counter")
    parser.add_argument("--camera-id", default=None, help="e.g. cam_01")
    parser.add_argument("--source", default=None, help="Webcam index, RTSP URL, or 'test'")
    parser.add_argument("--multi", action="store_true", help="Run all cameras from CAMERAS dict")
    parser.add_argument("--backend", default=BACKEND_URL, help="Backend base URL")
    args = parser.parse_args()

    backend = args.backend.rstrip("/")

    if not args.multi and args.camera_id is None:
        parser.print_help()
        print("\nExample: python cv_camera.py --camera-id cam_01 --source 0")
        print("Example: python cv_camera.py --multi")
        sys.exit(1)

    # Build list of tasks
    tasks_spec: list[tuple[str, object]] = []

    if args.multi:
        for cam_id, cfg in CAMERAS.items():
            tasks_spec.append((cam_id, cfg["source"]))
    else:
        source_raw = args.source
        # Try to cast to int for webcam index
        try:
            source = int(source_raw)
        except (TypeError, ValueError):
            source = source_raw  # RTSP string or "test"
        tasks_spec.append((args.camera_id, source))

    # Decide whether to load real YOLO
    all_test = all(str(src) == "test" for _, src in tasks_spec)
    model = None if all_test else load_yolo()

    async with httpx.AsyncClient() as client:
        coroutines = []
        for cam_id, source in tasks_spec:
            if str(source) == "test":
                coroutines.append(run_simulation(cam_id, client))
            else:
                coroutines.append(run_camera(model, cam_id, source, client))

        print(f"\n[CV] Starting {len(coroutines)} camera(s) → backend: {backend}\n")
        await asyncio.gather(*coroutines)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[CV] Stopped.")
