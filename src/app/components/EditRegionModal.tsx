import { useState } from "react";
import { X } from "lucide-react";
import { Region } from "./types";

interface EditRegionModalProps {
  region: Region;
  onSave: (updated: Region) => void;
  onClose: () => void;
}

export function EditRegionModal({ region, onSave, onClose }: EditRegionModalProps) {
  const [name, setName] = useState(region.name);
  const [camId, setCamId] = useState(region.camId);
  const [capacity, setCapacity] = useState(String(region.capacity));
  const [notes, setNotes] = useState(region.locationNotes);

  const handleSave = () => {
    onSave({ ...region, name, camId, capacity: parseInt(capacity) || region.capacity, locationNotes: notes });
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "#2A2E42",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "10px 12px",
    color: "#F1F5F9",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "13px",
    fontWeight: 500,
    color: "#94A3B8",
    marginBottom: "6px",
    display: "block",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        backdropFilter: "blur(2px)",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "480px",
          maxWidth: "calc(100vw - 32px)",
          backgroundColor: "#22263A",
          borderRadius: "16px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          border: "1px solid #2A2E42",
          boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 700,
              fontSize: "18px",
              color: "#F1F5F9",
            }}
          >
            Edit Region
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#475569",
              padding: "4px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              transition: "color 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#F1F5F9"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#475569"; }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Region Name */}
        <div>
          <label style={labelStyle}>Region Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            style={inputStyle}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "#6366F1"; }}
            onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "#334155"; }}
          />
        </div>

        {/* Camera ID */}
        <div>
          <label style={labelStyle}>Camera ID / Stream URL</label>
          <input
            type="text"
            value={camId}
            onChange={e => setCamId(e.target.value)}
            style={inputStyle}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "#6366F1"; }}
            onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "#334155"; }}
          />
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "11px",
              color: "#475569",
              marginTop: "4px",
              display: "block",
            }}
          >
            Enter the RTSP stream URL or camera identifier for occupancy detection
          </span>
        </div>

        {/* Max Capacity */}
        <div>
          <label style={labelStyle}>Max Capacity</label>
          <input
            type="number"
            value={capacity}
            onChange={e => setCapacity(e.target.value)}
            min={1}
            style={inputStyle}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "#6366F1"; }}
            onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "#334155"; }}
          />
        </div>

        {/* Location Notes */}
        <div>
          <label style={labelStyle}>Location Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            style={{
              ...inputStyle,
              resize: "vertical",
              fontFamily: "'DM Sans', sans-serif",
            }}
            onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = "#6366F1"; }}
            onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = "#334155"; }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "4px" }}>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid #2A2E42",
              borderRadius: "8px",
              padding: "10px 20px",
              color: "#94A3B8",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              fontSize: "14px",
              cursor: "pointer",
              transition: "border-color 0.2s, color 0.2s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#475569";
              (e.currentTarget as HTMLButtonElement).style.color = "#F1F5F9";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#2A2E42";
              (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8";
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              backgroundColor: "#6366F1",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              color: "#fff",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              fontSize: "14px",
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#4F46E5"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#6366F1"; }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
