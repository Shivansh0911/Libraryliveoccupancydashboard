# Library Counter — on-premise program (for institute IT)

This small program runs **on a computer the institute provides**. It connects to
the library cameras, counts how many people are in each area, and sends **only
that number** to the occupancy dashboard. No video is ever stored, shown, or sent
anywhere. It works on **any internet connection** — it only needs to reach the
camera source you enter and the dashboard URL; it makes no assumption about the
local network.

```
 Camera (access provided by the institute)
      │  looks
      ▼
 This program (on the institute's machine)  ──►  counts people, discards the frame
      │
      ▼  sends only  { "camera_id": "cam_02", "count": 34 }   (over HTTPS, with a device key)
 Cloud dashboard  ──►  students see Free / Moderate / Full
```

> You can see exactly what leaves this machine any time, in the portal's
> **"What leaves this machine"** page — it lists every outgoing message (all just
> numbers). Nothing else is ever sent.

- Camera links and passwords are entered in a **local portal** and stored
  **encrypted on this machine only** (`data/cameras.enc`). They never leave it.
- Frames are processed in memory and thrown away immediately — nothing is recorded.
- The whole program can be stopped any time by closing it, and access is revoked
  instantly if the camera password is changed.

---

## Setup (one time)

1. **Install Python 3.10+** and then the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
   (This includes the YOLO model library. The model file `yolov8s.pt` downloads
   automatically on first run; on an offline machine, copy it into this folder.)

2. **Create the config file:** copy `.env.example` to `.env` and fill in:
   - `PORTAL_PASSWORD` — a strong password for the local portal login.
   - `DEVICE_API_KEY` — the key shared with the dashboard backend (we provide it,
     or generate one and give it to us to set on the backend).
   - `PORTAL_EMAIL` — the IT email used to sign in.

3. **Start it:**
   - Windows: double-click `run.bat`
   - Linux/macOS: `./run.sh`  (or `python app.py`)

4. Open **http://127.0.0.1:8900** in a browser on that machine and sign in.
   The email/password from `.env` is the initial login; it can be changed any
   time from the portal's **Account** page (stored hashed, never in plain text).

## Adding cameras

In the portal, for each library area add a camera with:

- **Camera ID** — must match the zone's `camera_id` configured in the cloud admin
  (e.g. `cam_02`).
- **Zone name** — a label, e.g. "Main Reading Hall".
- **Source** — the camera's address (`host:port/path`) plus its username and
  password. (Or choose *Webcam* for a USB camera, or *Test* for demo numbers with
  no camera.)

Click **Start** on a camera (or **Start all**). The live count appears in the
table and on the student dashboard. It reconnects on its own if a camera drops.

## Run it permanently (recommended — set and forget)

So it keeps running after the machine is restarted or switched off/on, and
restarts itself if it ever stops, install it as a background service:

1. Right-click **`install-service.bat`** → **Run as administrator**.

That's it. It now:
- starts automatically at every boot (no login needed),
- runs in the background with no window,
- restarts itself within a minute if it ever stops.

Open the portal any time at **http://127.0.0.1:8900**. The cameras you had
**Started** resume on their own.

To remove it later: right-click **`uninstall-service.bat`** → Run as administrator.

> If an offline machine can't download the model, copy `yolov8s.pt` into this
> folder before installing the service.

## Security notes (recommended)

- Restrict this machine's outbound network so it can reach **only** the dashboard
  backend URL — then it is verifiable that nothing but counts leaves.
- Keep `PORTAL_HOST=127.0.0.1` unless LAN access to the portal is needed.
- Run the program as a low-privilege user; keep the camera network on its own VLAN.
- The `.env`, `data/secret.key`, and `data/cameras.enc` files hold secrets — they
  are git-ignored and should stay on this machine only.
