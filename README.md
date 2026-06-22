# Campus Library Occupancy Dashboard
### BITS Hyderabad · Real-time library occupancy tracker powered by computer vision

[![Live Demo](https://img.shields.io/badge/Live-bits--library.netlify.app-6366F1?style=flat-square)](https://bits-library.netlify.app)
[![Backend](https://img.shields.io/badge/API-Railway-0B0D0E?style=flat-square)](https://library-backendd-production.up.railway.app/docs)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

---

## What It Does

Students open a dashboard and instantly see which library areas are **free**, **moderate**, or **full** — updated live, no refresh needed. Cameras run YOLO people-counting independently per region and POST counts to a central backend. The dashboard updates in real-time via WebSocket.

```
IP Cameras (RTSP)
      ↓
cv_camera.py  ←  YOLOv8s people detection
      ↓  POST /count/update
FastAPI Backend  ←  count storage + status computation
      ↓  WebSocket broadcast
React Dashboard  ←  live UI for students + admin panel
```

---

## Live Links

| Service | URL |
|---------|-----|
| Student Dashboard | https://bits-library.netlify.app |
| Backend API Docs | https://library-backendd-production.up.railway.app/docs |

---

## Features

**Student Dashboard**
- Live occupancy for 4 library regions — updates every 3 seconds
- Color-coded status: FREE · MODERATE · FULL · OFFLINE
- Smart suggestion strip — "Group Study is least crowded"
- Offline card degraded state with last known count
- Fully responsive — desktop and mobile

**Admin Panel**
- JWT-protected login
- Add / edit / soft-delete regions and cameras
- Camera feed health monitor with live/disconnected status
- All changes persist to database — no code changes needed

**Backend**
- FastAPI + SQLAlchemy async — non-blocking throughout
- WebSocket broadcasts on every count update + 5s heartbeat
- Camera offline detection — marked offline after 12s of silence
- SQLite for dev, PostgreSQL for production (same codebase)

**Computer Vision**
- YOLOv8s people detection (class 0 — COCO dataset)
- Supports USB webcam, IP cameras (RTSP), and simulation mode
- Multi-camera support — one async task per camera
- Auto-reconnect on camera disconnect

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
│   ├── models.py             # Region + CountLog ORM models
│   ├── schemas.py            # Pydantic I/O schemas
│   ├── auth.py               # JWT creation + verification
│   ├── dashboard.py          # Status logic + state builder
│   ├── websocket_manager.py  # Connection manager + broadcast
│   ├── seed.py               # First-run DB seed
│   ├── ml_stub.py            # Mock camera simulator (dev)
│   ├── cv_camera.py          # Real YOLO people counter
│   ├── Dockerfile            # Production container
│   ├── requirements.txt      # Backend dependencies
│   └── requirements_cv.txt   # CV dependencies (torch, ultralytics)
└── src/
    ├── app/
    │   ├── App.tsx            # Main app + routing state
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

# Webcam
python backend/cv_camera.py --camera-id cam_01 --source 0

# IP Camera
python backend/cv_camera.py --camera-id cam_01 --source "rtsp://IP:554/stream1"

# All cameras
python backend/cv_camera.py --multi
```

---

## ML Integration Contract

The CV system connects via a single endpoint. After each inference:

```http
POST /count/update
Content-Type: application/json

{ "camera_id": "cam_01", "count": 14 }
```

`camera_id` must match a region configured in the Admin Panel. Nothing else changes on the backend side — swap `ml_stub.py` for any real detection system.

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
