"""Counting engine: connects to each camera locally, counts people with YOLO,
and POSTs ONLY the number to the cloud backend.

Key privacy property: a frame is read into memory, counted, and immediately
discarded. No frame is ever written to disk, shown, or transmitted.
"""

import time
import random
import threading
from collections import deque
from datetime import datetime, timezone

import httpx

from config import get_settings

settings = get_settings()

# Rolling record of exactly what this machine sends out — used by the portal's
# "Outbound log" so IT can see with their own eyes that only numbers leave.
_outbound = deque(maxlen=100)
_outbound_lock = threading.Lock()


def record_outbound(entry: dict) -> None:
    with _outbound_lock:
        _outbound.appendleft(entry)


def get_outbound(limit: int = 50) -> list[dict]:
    with _outbound_lock:
        return list(_outbound)[:limit]

# YOLO is loaded lazily (and only once) the first time a real camera needs it,
# so the portal and "test" cameras work without torch installed.
_model = None
_model_lock = threading.Lock()
_infer_lock = threading.Lock()  # YOLO inference is not thread-safe; serialize it.

# COCO classes: 0 = person, 63 = laptop (used to detect reserved-but-empty seats)
_PERSON, _LAPTOP = 0, 63


def load_model():
    global _model
    with _model_lock:
        if _model is None:
            from pathlib import Path
            from ultralytics import YOLO
            import config as _cfg
            # Resolve a bare model filename against this folder, so it works no
            # matter what the working directory is (e.g. started as a service).
            name = settings.MODEL_NAME
            local = Path(_cfg.BASE_DIR) / name
            if not Path(name).is_absolute() and local.exists():
                name = str(local)
            _model = YOLO(name)
    return _model


# ── Reserved-seat geometry (ported from the original cv_camera.py) ───────────
def _edge_distance(obj_box, person_box):
    ox = (obj_box[0] + obj_box[2]) / 2
    oy = (obj_box[1] + obj_box[3]) / 2
    dx = max(person_box[0] - ox, 0, ox - person_box[2])
    dy = max(person_box[1] - oy, 0, oy - person_box[3])
    return (dx ** 2 + dy ** 2) ** 0.5


def _within_threshold(obj_box, person_box):
    oy = (obj_box[1] + obj_box[3]) / 2
    pw = person_box[2] - person_box[0]
    ph = person_box[3] - person_box[1]
    dist = _edge_distance(obj_box, person_box)
    if settings.CEILING_CAM:
        return dist < pw * 0.7
    if oy < person_box[1] - ph * 0.2:   # laptop well above the person → not at desk
        return False
    return dist < pw * 0.5


def count_reserved_seats(person_boxes: list, object_boxes: list) -> int:
    """Pure logic: laptops NOT claimed by any nearby person = reserved seats.

    One-to-one matching — each person claims only their single closest laptop, so
    one person sitting between two laptops can't absorb a neighbour's reserved seat.
    Separated from YOLO so it can be unit-tested without a model or a frame.
    """
    assigned: set[int] = set()
    for pb in person_boxes:
        best_idx, best_dist = None, float("inf")
        for i, lb in enumerate(object_boxes):
            if i in assigned or not _within_threshold(lb, pb):
                continue
            d = _edge_distance(lb, pb)
            if d < best_dist:
                best_dist, best_idx = d, i
        if best_idx is not None:
            assigned.add(best_idx)
    return len(object_boxes) - len(assigned)


def count_people_and_reserved(frame, detect_reserved: bool = True) -> tuple[int, int]:
    """Return (people_count, reserved_seats). The frame is used only here."""
    model = load_model()
    classes = [_PERSON, _LAPTOP] if detect_reserved else [_PERSON]
    with _infer_lock:
        results = model(
            frame, verbose=False, classes=classes, conf=settings.DETECT_CONFIDENCE
        )
    boxes = results[0].boxes

    person_boxes, object_boxes = [], []
    for box in boxes:
        coords = box.xyxy[0].tolist()
        (person_boxes if int(box.cls[0]) == _PERSON else object_boxes).append(coords)

    reserved = count_reserved_seats(person_boxes, object_boxes) if detect_reserved else 0
    return len(person_boxes), reserved


def build_source(cam: dict):
    """Turn a stored camera record into something cv2.VideoCapture understands."""
    stype = cam.get("source_type")
    if stype == "webcam":
        return int(cam.get("webcam_index", 0))
    if stype == "test":
        return "test"
    host_path = cam.get("host_path", "").strip()
    user = cam.get("username", "")
    pwd = cam.get("password", "")
    scheme = "rtsp://"
    if host_path.startswith(("rtsp://", "http://", "https://")):
        scheme, host_path = host_path.split("://", 1)
        scheme += "://"
    if user:
        return f"{scheme}{user}:{pwd}@{host_path}"
    return f"{scheme}{host_path}"


class CameraWorker(threading.Thread):
    def __init__(self, cam: dict):
        super().__init__(daemon=True)
        self.cam = cam
        self.camera_id = cam["camera_id"]
        self._stop = threading.Event()
        self.status = {
            "camera_id": self.camera_id,
            "zone_name": cam.get("zone_name", self.camera_id),
            "online": False,
            "last_count": None,
            "last_reserved": None,
            "last_post_ok": None,
            "last_update": None,
            "error": None,
            "mode": cam.get("source_type"),
        }

    def stop(self):
        self._stop.set()

    # ── networking: only the number leaves the machine ──────────────────────
    def _post(self, client: httpx.Client, count: int, reserved: int) -> bool:
        headers = {}
        if settings.DEVICE_API_KEY:
            headers["X-API-Key"] = settings.DEVICE_API_KEY
        # This body is the ENTIRE payload that leaves the machine — only numbers.
        body = {
            "camera_id": self.camera_id,
            "count": count,
            "reserved": reserved,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        sent_at = datetime.now().strftime("%H:%M:%S")
        try:
            r = client.post(
                f"{settings.BACKEND_URL.rstrip('/')}/count/update",
                json=body, headers=headers, timeout=5.0,
            )
            ok = r.status_code == 200
            self.status["last_post_ok"] = ok
            self.status["error"] = None if ok else f"backend returned {r.status_code}"
            record_outbound({"at": sent_at, "body": body, "ok": ok,
                             "detail": "200 OK" if ok else f"HTTP {r.status_code}"})
            return ok
        except Exception as exc:
            self.status["last_post_ok"] = False
            self.status["error"] = f"send failed: {exc}"
            record_outbound({"at": sent_at, "body": body, "ok": False, "detail": f"send failed: {exc}"})
            return False

    def _record(self, count, reserved):
        self.status["last_count"] = count
        self.status["last_reserved"] = reserved
        self.status["last_update"] = datetime.now().strftime("%H:%M:%S")

    def run(self):
        if self.cam.get("source_type") == "test":
            self._run_sim()
        else:
            self._run_camera()
        self.status["online"] = False

    def _run_camera(self):
        import cv2  # imported here so the portal runs even without OpenCV

        source = build_source(self.cam)
        detect_reserved = self.cam.get("detect_reserved", True)
        with httpx.Client() as client:
            while not self._stop.is_set():
                cap = cv2.VideoCapture(source)
                if not cap.isOpened():
                    self.status["online"] = False
                    self.status["error"] = "cannot open camera stream"
                    if self._stop.wait(5):
                        break
                    continue
                self.status["online"] = True
                self.status["error"] = None
                try:
                    while not self._stop.is_set():
                        ok, frame = cap.read()
                        if not ok:
                            self.status["online"] = False
                            self.status["error"] = "frame read failed — reconnecting"
                            break
                        try:
                            count, reserved = count_people_and_reserved(frame, detect_reserved)
                        except Exception as exc:
                            # Model missing/failed or inference error — stay alive, report it.
                            self.status["error"] = f"count failed: {exc}"
                            if self._stop.wait(settings.INFERENCE_INTERVAL):
                                break
                            continue
                        finally:
                            frame = None  # drop the frame immediately
                        self.status["error"] = None
                        self._post(client, count, reserved)
                        self._record(count, reserved)
                        if self._stop.wait(settings.INFERENCE_INTERVAL):
                            break
                finally:
                    cap.release()
                if not self._stop.is_set():
                    self._stop.wait(3)  # brief pause before reconnect

    def _run_sim(self):
        """No real camera — generates plausible numbers for demos / portal testing."""
        lo, hi, drift = 5, 60, 4
        count = random.randint(lo, hi)
        detect_reserved = self.cam.get("detect_reserved", True)
        with httpx.Client() as client:
            while not self._stop.is_set():
                count = max(lo, min(hi, count + random.randint(-drift, drift)))
                reserved = random.randint(0, 3) if detect_reserved else 0
                self.status["online"] = True
                self._post(client, count, reserved)
                self._record(count, reserved)
                if self._stop.wait(settings.INFERENCE_INTERVAL):
                    break


class Manager:
    """Owns the running workers. Start/stop cameras and report live status."""

    def __init__(self):
        self._workers: dict[str, CameraWorker] = {}
        self._lock = threading.RLock()

    def start_camera(self, cam: dict):
        with self._lock:
            self.stop_camera(cam["camera_id"])
            worker = CameraWorker(cam)
            self._workers[cam["camera_id"]] = worker
            worker.start()

    def stop_camera(self, camera_id: str):
        with self._lock:
            worker = self._workers.pop(camera_id, None)
        if worker:
            worker.stop()

    def start_all(self, cameras: list[dict]):
        for cam in cameras:
            if cam.get("enabled", True):
                self.start_camera(cam)

    def stop_all(self):
        with self._lock:
            ids = list(self._workers)
        for camera_id in ids:
            self.stop_camera(camera_id)

    def is_running(self, camera_id: str) -> bool:
        with self._lock:
            worker = self._workers.get(camera_id)
            return bool(worker and worker.is_alive())

    def status(self) -> dict[str, dict]:
        with self._lock:
            return {cid: dict(w.status) for cid, w in self._workers.items()}


manager = Manager()
