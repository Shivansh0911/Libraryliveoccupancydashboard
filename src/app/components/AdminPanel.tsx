import { useState, useEffect } from "react";
import { Pencil, Plus, Wifi, WifiOff } from "lucide-react";
import { Region } from "./types";
import { EditRegionModal } from "./EditRegionModal";

interface AdminPanelProps {
  regions: Region[];
  onUpdateRegions: (regions: Region[]) => void;
}

function CamDot({ online }: { online: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <span style={{
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        backgroundColor: online ? "#22C55E" : "#EF4444",
        display: "inline-block",
        flexShrink: 0,
        boxShadow: online ? "0 0 0 3px rgba(34,197,94,0.18)" : "none",
        animation: online ? "pulse-dot 2s infinite" : "none",
      }} />
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "12px",
        color: online ? "#22C55E" : "#EF4444",
      }}>
        {online ? "Live" : "Disconnected"}
      </span>
    </span>
  );
}

function AdminTableRow({ region, onEdit, isLast }: { region: Region; onEdit: () => void; isLast: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 140px 80px 120px 40px",
        padding: "0 16px",
        height: "52px",
        alignItems: "center",
        borderBottom: isLast ? "none" : "1px solid #2A2E42",
        backgroundColor: hovered ? "#22263A" : "transparent",
        transition: "background-color 0.15s",
      }}
    >
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "14px", fontWeight: 600, color: "#F1F5F9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "8px" }}>
        {region.name}
      </span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: "#94A3B8" }}>
        {region.camId}
      </span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: "#94A3B8" }}>
        {region.capacity}
      </span>
      <span>
        <CamDot online={region.camOnline} />
      </span>
      <button
        onClick={onEdit}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#475569",
          padding: "6px",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "color 0.2s, background-color 0.2s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.color = "#6366F1";
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#2A2E42";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.color = "#475569";
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
        }}
      >
        <Pencil size={15} />
      </button>
    </div>
  );
}

export function AdminPanel({ regions, onUpdateRegions }: AdminPanelProps) {
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [pingAges, setPingAges] = useState<Record<string, number>>(() =>
    Object.fromEntries(regions.map((r, i) => [r.id, i + 1]))
  );

  useEffect(() => {
    const id = setInterval(() => {
      setPingAges(prev => {
        const next = { ...prev };
        regions.forEach(r => {
          if (r.camOnline) {
            next[r.id] = (prev[r.id] ?? 0) + 1;
            if (next[r.id] > 5) next[r.id] = 1;
          }
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [regions]);

  const handleSave = (updated: Region) => {
    onUpdateRegions(regions.map(r => r.id === updated.id ? updated : r));
    setEditingRegion(null);
  };

  const handleAddRegion = () => {
    const newRegion: Region = {
      id: `region-${Date.now()}`,
      name: "New Region",
      count: 0,
      capacity: 50,
      status: "free",
      camId: `cam_0${regions.length + 1}`,
      camOnline: false,
      lastUpdated: "just now",
      locationNotes: "",
    };
    onUpdateRegions([...regions, newRegion]);
    setEditingRegion(newRegion);
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "clamp(24px, 4vw, 48px)", display: "flex", flexDirection: "column", gap: "40px" }}>

      {/* ── Section 1: Regions & Camera Config ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: "22px", color: "#F1F5F9", margin: 0 }}>
              Regions & Camera Config
            </h2>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#475569", margin: "4px 0 0" }}>
              {regions.length} region{regions.length !== 1 ? "s" : ""} configured
            </p>
          </div>
          <button
            onClick={handleAddRegion}
            style={{
              backgroundColor: "#6366F1",
              border: "none",
              borderRadius: "8px",
              padding: "10px 16px",
              color: "#fff",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "background-color 0.2s",
              flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#4F46E5"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#6366F1"; }}
          >
            <Plus size={16} />
            Add Region
          </button>
        </div>

        <div style={{ backgroundColor: "#1A1D27", borderRadius: "12px", border: "1px solid #2A2E42", overflow: "hidden" }}>
          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 140px 80px 120px 40px",
            padding: "10px 16px",
            borderBottom: "1px solid #2A2E42",
            backgroundColor: "#0F1117",
          }}>
            {["Region Name", "Camera ID", "Cap.", "Status", ""].map((h, i) => (
              <span key={i} style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "11px",
                fontWeight: 600,
                color: "#475569",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}>
                {h}
              </span>
            ))}
          </div>
          {regions.map((region, idx) => (
            <AdminTableRow
              key={region.id}
              region={region}
              onEdit={() => setEditingRegion(region)}
              isLast={idx === regions.length - 1}
            />
          ))}
        </div>
      </div>

      {/* ── Section 2: Camera Feed Health ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: "22px", color: "#F1F5F9", margin: 0 }}>
            Camera Feed Health
          </h2>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#475569", margin: "4px 0 0" }}>
            {regions.filter(r => r.camOnline).length} of {regions.length} feeds active
          </p>
        </div>

        <div style={{ backgroundColor: "#1A1D27", borderRadius: "12px", border: "1px solid #2A2E42", overflow: "hidden" }}>
          {regions.map((region, idx) => {
            const age = pingAges[region.id] ?? 1;
            const isLast = idx === regions.length - 1;
            return (
              <div
                key={region.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "14px 16px",
                  borderBottom: isLast ? "none" : "1px solid #2A2E42",
                  gap: "12px",
                }}
              >
                {/* Icon + cam ID */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "120px", flexShrink: 0 }}>
                  {region.camOnline
                    ? <Wifi size={15} color="#22C55E" />
                    : <WifiOff size={15} color="#EF4444" />
                  }
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: "#F1F5F9", fontWeight: 600 }}>
                    {region.camId}
                  </span>
                </div>

                {/* Region name */}
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "13px", color: "#94A3B8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {region.name}
                </span>

                {/* Status dot */}
                <CamDot online={region.camOnline} />

                {/* Ping / last-seen */}
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "11px",
                  color: region.camOnline ? "#475569" : "#EF4444",
                  minWidth: "170px",
                  textAlign: "right",
                  flexShrink: 0,
                }}>
                  {region.camOnline
                    ? `last ping ${age}s ago`
                    : "Disconnected · last seen 4m ago"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {editingRegion && (
        <EditRegionModal
          region={editingRegion}
          onSave={handleSave}
          onClose={() => setEditingRegion(null)}
        />
      )}
    </div>
  );
}
