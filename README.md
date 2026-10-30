# Campus Library, Gym & Badminton Occupancy Dashboard
### BITS Hyderabad · Real-time occupancy tracker for library, gym, and badminton courts, powered by computer vision

[![Live Demo](https://img.shields.io/badge/Live-bits--library.netlify.app-6366F1?style=flat-square)](https://bits-library.netlify.app)
[![Backend](https://img.shields.io/badge/API-Render-46E3B7?style=flat-square)](https://library-backend-x1hu.onrender.com/docs)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

---

## What It Does

Students open a dashboard and instantly see which library areas are **free**, **moderate**, or **full** — and how busy the gym and badminton courts are — updated live, no refresh needed. Cameras run YOLO people-counting independently per region and POST counts to a central backend. The dashboard updates in real-time via WebSocket.

```
IP Cameras (RTSP)
      ↓
cv_camera.py  ←  YOLOv8s people + laptop detection
      ↓  POST /count/update
FastAPI Backend  ←  count storage + status computation
      ↓  WebSocket broadcast
React Dashboard  ←  live UI for students + admin panel
                     ├── 📚 Library section (4 regions, reserved seat detection)
                     ├── 🏋️  Gym section (people count only)
                     └── 🏸 Badminton section (people count only)
```

---

## Live Links

| Service | URL |
|---------|-----|
| Student Dashboard | https://bits-library.netlify.app |
| Backend API Docs | https://library-backend-x1hu.onrender.com/docs |

---

## Features

**Student Dashboard**
- Live occupancy for 4 library regions — updates every 3 seconds
- Separate **Gym Occupancy** section — live people count for the gym floor
- Separate **Badminton Courts** section — live people count per court area
- Color-coded status: FREE · MODERATE · FULL · OFFLINE
- Reserved seat detection — shows how many seats are held by unattended laptops
- Smart suggestion strip — "Group Study is least crowded"
- Offline card degraded state with last known count
- Fully responsive — desktop and mobile

**Admin Panel**
- JWT-protected login
- Add / edit / soft-delete regions and cameras
- Section toggle per region: 📚 Library · 🏋️ Gym · 🏸 Badminton
- Camera feed health monitor with live/disconnected status
- All changes persist to database — no code changes needed

**Backend**
- FastAPI + SQLAlchemy async — non-blocking throughout
- WebSocket broadcasts on every count update + 5s heartbeat
- Camera offline detection — marked offline after 12s of silence
- SQLite for dev, PostgreSQL for production (same codebase)

**Computer Vision**
- YOLOv8s people detection (class 0 — COCO dataset)
- Reserved seat detection via laptop detection (class 63) — library cameras only
- Gym and badminton cameras skip laptop detection entirely (`detect_reserved: False`)
- One-to-one laptop assignment prevents adjacent-seat false positives
- `CEILING_CAM` flag for top-down vs side-angle camera geometry
- Supports USB webcam, IP cameras (RTSP), and simulation mode
- Multi-camera support — one async task per camera
- Auto-reconnect on camera disconnect

---

## Gym & Badminton Occupancy

The gym and badminton sections are separate panels on the dashboard showing live people counts. They work alongside the library but with simpler logic — people count only, no reserved seat detection.

### How they differ from library regions

| | Library | Gym | Badminton |
|---|---|---|---|
| YOLO classes | person + laptop | person only | person only |
| Reserved seats | Yes — unattended laptops counted | No | No |
| Dashboard section | 📚 Library | 🏋️ Gym | 🏸 Badminton |
| DB `section` field | `"library"` | `"gym"` | `"badminton"` |
| Accent color | Indigo | Cyan | Amber |

### Setting up a gym or badminton region

1. Start the backend and open the Admin Panel
2. Click **Add Region**
3. Set **Camera ID** to `cam_gym_01` / `cam_badminton_01` (matching your `CAMERAS` dict)
4. Set **Section** to the appropriate section (🏋️ Gym or 🏸 Badminton)
5. Set capacity (e.g. 50 for gym, 24 for badminton — 4 courts × 6 people)
6. Save — the section goes live immediately via WebSocket

Until a region is added, each section shows an offline placeholder card so it's always visible.

### Camera configuration (`cv_camera.py`)

```python
CAMERAS = {
    # Library cameras — reserved seat detection enabled
    "cam_01":           {"source": 0, "name": "Entrance / Lobby",            "detect_reserved": True},
    "cam_02":           {"source": 1, "name": "Main Reading Hall",           "detect_reserved": True},
    "cam_03":           {"source": 2, "name": "Upper Floor / Quiet Zone",    "detect_reserved": True},
    "cam_04":           {"source": 3, "name": "Collaborative / Group Study", "detect_reserved": True},

    # Gym camera — people count only, no laptop detection
    "cam_gym_01":       {"source": 4, "name": "Main Gym Floor",              "detect_reserved": False},

    # Badminton camera — people count only, no laptop detection
    "cam_badminton_01": {"source": 5, "name": "Badminton Courts",            "detect_reserved": False},
}
```

Run individual cameras:
```bash
# Gym camera
python backend/cv_camera.py --camera-id cam_gym_01 --source 4

# Badminton camera
python backend/cv_camera.py --camera-id cam_badminton_01 --source 5

# Or IP cameras:
python backend/cv_camera.py --camera-id cam_gym_01 --source "rtsp://IP:554/gym"
python backend/cv_camera.py --camera-id cam_badminton_01 --source "rtsp://IP:554/badminton"

# Or run all cameras at once (library + gym + badminton):
python backend/cv_camera.py --multi
```

---

## Reserved Seat Detection (Library)

A seat is **reserved** when a laptop is detected near a table but no person is sitting there — the owner stepped away.

### Detection logic

- YOLO detects both people (class 0) and laptops (class 63) per frame
- Each person is assigned their **closest** laptop using edge-distance (distance from laptop center to nearest edge of the person's bounding box)
- Assignment is **one-to-one** — a person cannot absorb a neighbour's laptop
- Laptops that remain unassigned after matching = reserved seats

### Proximity thresholds

```python
CEILING_CAM = False   # True for top-down/ceiling cameras, False for side/desk-level cameras
```

| Camera angle | Threshold |
|---|---|
| Side view (`CEILING_CAM=False`) | laptop within 0.5× person width from person's bounding box edge |
| Ceiling / top-down (`CEILING_CAM=True`) | laptop within 0.7× person width (uniform, any direction) |

Side-view cameras also ignore laptops detected **above** the person's head (not at desk level).

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS v3 + custom design tokens |
| Backend | Python 3.11 + FastAPI |
| ORM | SQLAlchemy 2.0 async |
| Database | SQLite (dev) → PostgreSQL (prod) |
| Realtime | FastAPI native WebSockets |
| Auth | JWT via python-jose + passlib bcrypt |
| CV | YOLOv8s via Ultralytics |
| Hosting | Railway (backend) + Netlify (frontend) |

---

## Project Structure

```
campus-library-occupancy/
├── backend/
│   ├── main.py               # FastAPI app, WebSocket, heartbeat
│   ├── config.py             # Settings via pydantic-settings
│   ├── database.py           # Async SQLAlchemy engine
│   ├── models.py             # Region + CountLog ORM models (section field)
│   ├── schemas.py            # Pydantic I/O schemas
│   ├── auth.py               # JWT creation + verification
│   ├── dashboard.py          # Status logic + state builder
│   ├── websocket_manager.py  # Connection manager + broadcast
│   ├── seed.py               # First-run DB seed
│   ├── ml_stub.py            # Mock camera simulator (dev)
│   ├── cv_camera.py          # Real YOLO people counter + reserved detection
│   ├── Dockerfile            # Production container
│   ├── requirements.txt      # Backend dependencies
│   └── requirements_cv.txt   # CV dependencies (torch, ultralytics)
└── src/
    ├── app/
    │   ├── App.tsx            # Main app + routing state + library/gym/badminton split
    │   └── components/        # RegionCard, AdminPanel, NavBar...
    ├── hooks/
    │   ├── useRealtimeCount.ts # WebSocket hook with auto-reconnect
    │   └── useAuth.ts          # JWT auth hook
    └── api.ts                  # Typed fetch wrappers
```

---

## Local Development

### Backend
```bash
cd backend
pip install -r requirements.txt
# create backend/.env (copy from backend/.env.example)
uvicorn main:app --reload
# → http://localhost:8000  |  API docs at /docs
```

### Frontend
```bash
npm install
npm run dev
# → http://localhost:5173
```

### Mock Cameras (no hardware needed)
```bash
cd backend
python ml_stub.py
# → simulates 4 cameras posting counts every 5s
```

### Real Camera (YOLO)
```bash
pip install -r backend/requirements_cv.txt

# Library webcam
python backend/cv_camera.py --camera-id cam_01 --source 0

# Gym camera (IP)
python backend/cv_camera.py --camera-id cam_gym_01 --source "rtsp://IP:554/gym"

# Badminton camera (IP)
python backend/cv_camera.py --camera-id cam_badminton_01 --source "rtsp://IP:554/badminton"

# All cameras (library + gym + badminton)
python backend/cv_camera.py --multi
```

---

## ML Integration Contract

The CV system connects via a single endpoint. After each inference:

```http
POST /count/update
Content-Type: application/json

{
  "camera_id": "cam_01",
  "count": 14,
  "reserved": 2
}
```

`camera_id` must match a region configured in the Admin Panel. `reserved` is `0` for gym and badminton cameras. Nothing else changes on the backend side — swap `ml_stub.py` for any real detection system.

---

## Status Logic

```python
if no data or last_update > 12s ago  → OFFLINE
elif occupancy < 40%                 → FREE
elif occupancy < 75%                 → MODERATE
else                                 → FULL
```

---

## Authors

Built at BITS Pilani Hyderabad Campus.

- **Shivansh Shekher Ojha** — Backend, Frontend, System Architecture
- **Avani Pandit** — Computer Vision, Camera Integration
