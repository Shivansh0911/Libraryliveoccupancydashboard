/* MARKER-MAKE-KIT-INVOKED */
import { useState, useEffect, useCallback, useRef } from "react";
import { Region } from "./components/types";
import { RegionCard } from "./components/RegionCard";
import { StudentTopNav, AdminTopNav } from "./components/TopNavBar";
import { SmartSuggestionStrip } from "./components/SmartSuggestionStrip";
import { AdminLoginForm } from "./components/AdminLoginForm";
import { AdminPanel } from "./components/AdminPanel";

type View = "dashboard" | "login" | "admin";

const SEED: Region[] = [
  {
    id: "r1",
    name: "Entrance / Lobby",
    count: 12,
    capacity: 40,
    status: "free",
    camId: "cam_01",
    camOnline: true,
    lastUpdated: "2s ago",
    locationNotes: "Ground floor main entrance. Camera mounted above main doors.",
  },
  {
    id: "r2",
    name: "Main Reading Hall",
    count: 62,
    capacity: 80,
    status: "moderate",
    camId: "cam_02",
    camOnline: true,
    lastUpdated: "1s ago",
    locationNotes: "Central hall, rows A–H. High-ceiling area with skylight.",
  },
  {
    id: "r3",
    name: "Upper Floor / Quiet Zone",
    count: 28,
    capacity: 30,
    status: "full",
    camId: "cam_03",
    camOnline: true,
    lastUpdated: "4s ago",
    locationNotes: "Strict silence policy. Staircase access only.",
  },
  {
    id: "r4",
    name: "Collaborative / Group Study",
    count: 8,
    capacity: 25,
    status: "free",
    camId: "cam_04",
    camOnline: true,
    lastUpdated: "2s ago",
    locationNotes: "West wing, round tables. Audio permitted at low volumes.",
  },
];

function computeStatus(count: number, capacity: number): Region["status"] {
  const p = count / capacity;
  if (p >= 0.75) return "full";
  if (p >= 0.40) return "moderate";
  return "free";
}

function fmtFull(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [adminUser, setAdminUser] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>(SEED);
  const [refreshTime, setRefreshTime] = useState(fmtFull(new Date()));
  const [secsSince, setSecsSince] = useState(0);
  const [offlineMode, setOfflineMode] = useState(false);
  const isMobile = useIsMobile();
  const tickRef = useRef(0);

  // Live simulation every 5s
  const simulate = useCallback(() => {
    setRegions(prev =>
      prev.map(r => {
        if (offlineMode && r.id === "r4") return r;
        const delta = Math.floor(Math.random() * 5) - 2;
        const c = Math.max(0, Math.min(r.capacity, r.count + delta));
        return { ...r, count: c, status: computeStatus(c, r.capacity) };
      })
    );
    setRefreshTime(fmtFull(new Date()));
    setSecsSince(0);
  }, [offlineMode]);

  useEffect(() => {
    const sim = setInterval(simulate, 5000);
    const counter = setInterval(() => setSecsSince(s => s + 1), 1000);
    return () => { clearInterval(sim); clearInterval(counter); };
  }, [simulate]);

  // "Xs ago" label for the nav
  const agoLabel = secsSince < 60
    ? `${secsSince}s ago`
    : `${Math.floor(secsSince / 60)}m ago`;

  const displayRegions = regions.map(r =>
    offlineMode && r.id === "r4"
      ? { ...r, status: "offline" as const, camOnline: false, lastUpdated: "8:47 AM" }
      : r
  );

  const handleLogin = (username: string) => { setAdminUser(username); setView("admin"); };
  const handleLogout = () => { setAdminUser(null); setView("dashboard"); };

  return (
    <div style={{
      width: "100%",
      height: "100%",
      backgroundColor: "#0F1117",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'DM Sans', sans-serif",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { box-shadow: 0 0 0 0px rgba(34,197,94,0.5); }
          60%       { box-shadow: 0 0 0 5px rgba(34,197,94,0.07); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: #334155; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2A2E42; border-radius: 4px; }
      `}</style>

      {/* ── ADMIN LOGIN ─────────────────────────────────── */}
      {view === "login" && (
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
          padding: "24px",
          overflow: "auto",
          animation: "fadeUp 0.25s ease",
        }}>
          {/* Wordmark */}
          <div style={{ textAlign: "center", marginBottom: "4px" }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: "24px", color: "#F1F5F9", marginBottom: "6px" }}>
              BITS Hyderabad
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#475569", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Library Management System
            </div>
            {/* Divider */}
            <div style={{ margin: "16px auto 0", width: "40px", height: "1px", backgroundColor: "#2A2E42" }} />
          </div>

          <AdminLoginForm onLogin={handleLogin} />

          <button
            onClick={() => setView("dashboard")}
            style={{
              background: "none",
              border: "none",
              color: "#334155",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              cursor: "pointer",
              transition: "color 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#334155"; }}
          >
            ← Back to Live Dashboard
          </button>
        </div>
      )}

      {/* ── ADMIN PANEL ─────────────────────────────────── */}
      {view === "admin" && adminUser && (
        <>
          <AdminTopNav username={adminUser} onLogout={handleLogout} onStudentView={() => setView("dashboard")} />
          <AdminPanel regions={displayRegions} onUpdateRegions={setRegions} />
        </>
      )}

      {/* ── STUDENT DASHBOARD ───────────────────────────── */}
      {view === "dashboard" && (
        <>
          <StudentTopNav lastUpdated={agoLabel} onAdminClick={() => setView("login")} />

          {/* Scrollable content area */}
          <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "20px 16px" : "clamp(24px, 4vw, 48px)" }}>

            {/* Page heading */}
            <div style={{
              marginBottom: "28px",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}>
              <div>
                <h1 style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 700,
                  fontSize: isMobile ? "20px" : "clamp(22px, 2.2vw, 28px)",
                  color: "#F1F5F9",
                  margin: 0,
                  lineHeight: 1.25,
                }}>
                  BITS Hyderabad — Library Live Status
                </h1>
                <p style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "12px",
                  color: "#475569",
                  margin: "6px 0 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  flexWrap: "wrap",
                }}>
                  <span>{displayRegions.length} regions</span>
                  <span style={{ color: "#2A2E42" }}>·</span>
                  {offlineMode && <span style={{ color: "#EF4444" }}>1 camera offline</span>}
                  {offlineMode && <span style={{ color: "#2A2E42" }}>·</span>}
                  <span>Refreshed {refreshTime}</span>
                </p>
              </div>

              {/* Offline toggle */}
              <button
                onClick={() => setOfflineMode(p => !p)}
                style={{
                  backgroundColor: offlineMode ? "#2D0707" : "transparent",
                  border: `1px solid ${offlineMode ? "#EF4444" : "#2A2E42"}`,
                  borderRadius: "8px",
                  padding: "6px 12px",
                  color: offlineMode ? "#EF4444" : "#334155",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "11px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                  alignSelf: "flex-start",
                  letterSpacing: "0.03em",
                }}
                onMouseEnter={e => {
                  if (!offlineMode) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#475569";
                    (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8";
                  }
                }}
                onMouseLeave={e => {
                  if (!offlineMode) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#2A2E42";
                    (e.currentTarget as HTMLButtonElement).style.color = "#334155";
                  }
                }}
              >
                {offlineMode ? "● cam_04 offline · restore" : "⚡ Simulate cam_04 offline"}
              </button>
            </div>

            {/* Cards */}
            {isMobile ? (
              /* Mobile: single column, full-width */
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {displayRegions.map((r, i) => (
                  <div key={r.id} style={{ animation: `fadeUp 0.3s ease ${i * 0.06}s both` }}>
                    <RegionCard region={r} mobile />
                  </div>
                ))}
                {/* Suggestion strip inside scroll on mobile */}
                <div style={{ marginTop: "8px" }}>
                  <SmartSuggestionStrip regions={displayRegions} inline />
                </div>
              </div>
            ) : (
              /* Desktop: 2×2 grid, max 900px */
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(280px, 1fr))",
                gap: "16px",
                maxWidth: "900px",
              }}>
                {displayRegions.map((r, i) => (
                  <div key={r.id} style={{ animation: `fadeUp 0.3s ease ${i * 0.07}s both` }}>
                    <RegionCard region={r} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sticky suggestion strip — desktop only */}
          {!isMobile && <SmartSuggestionStrip regions={displayRegions} />}
        </>
      )}
    </div>
  );
}
