import { useEffect, useState } from "react";
import api from "../api";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');

  .bm-scope *, .bm-scope *::before, .bm-scope *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .bm-scope {
    font-family: 'Syne', sans-serif;
    color: #e8eaf0;
  }

  .bm-body {
    font-family: 'Syne', sans-serif;
    background: #0a0b0f;
    color: #e8eaf0;
    min-height: 100vh;
    padding: 24px 16px 48px;
  }

  .bm-wrap { max-width: 720px; margin: 0 auto; }

  /* ── Header ── */
  .bm-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .bm-eyebrow {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #4f8eff;
    margin-bottom: 6px;
  }

  .bm-title {
    font-size: clamp(26px, 5vw, 34px);
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #e8eaf0;
    line-height: 1.1;
  }

  .bm-sub {
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    color: #5a6070;
    margin-top: 6px;
  }

  .bm-btn-create {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #4f8eff;
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 11px 20px;
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 0 20px rgba(79,142,255,0.18), 0 2px 8px rgba(0,0,0,0.4);
    transition: all 0.2s;
    flex-shrink: 0;
  }
  .bm-btn-create:hover { filter: brightness(1.12); transform: translateY(-1px); }
  .bm-btn-create:active { transform: translateY(0); }

  /* ── Auto-schedule banner ── */
  .bm-schedule-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(79,142,255,0.07);
    border: 1px solid rgba(79,142,255,0.2);
    border-radius: 12px;
    padding: 12px 16px;
    margin-bottom: 20px;
  }

  .bm-schedule-dot {
    width: 8px; height: 8px;
    background: #2de0a5;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 8px #2de0a5;
    animation: bmPulse 2s ease-in-out infinite;
  }

  @keyframes bmPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }

  .bm-schedule-text {
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    color: #8899bb;
    flex: 1;
  }

  .bm-schedule-text strong {
    color: #b8c8ee;
    font-weight: 500;
  }

  .bm-schedule-next {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: #4f8eff;
    background: rgba(79,142,255,0.12);
    border-radius: 6px;
    padding: 3px 9px;
    white-space: nowrap;
  }

  /* ── Stats ── */
  .bm-stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 20px;
  }

  .bm-stat {
    background: #12141a;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 12px 14px;
    text-align: center;
  }

  .bm-stat-value {
    font-family: 'Syne', sans-serif;
    font-size: 22px;
    font-weight: 800;
    color: #e8eaf0;
    line-height: 1;
  }

  .bm-stat-label {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: #5a6070;
    margin-top: 4px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* ── Filter tabs ── */
  .bm-filter-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .bm-filter-tab {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.1);
    background: transparent;
    color: #5a6070;
    cursor: pointer;
    transition: all 0.15s;
    letter-spacing: 0.04em;
  }
  .bm-filter-tab:hover { border-color: rgba(255,255,255,0.2); color: #aab0c0; }
  .bm-filter-tab.active {
    background: rgba(79,142,255,0.15);
    border-color: rgba(79,142,255,0.4);
    color: #4f8eff;
  }

  /* ── Search ── */
  .bm-search-wrap { position: relative; margin-bottom: 16px; }

  .bm-search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: #5a6070;
    pointer-events: none;
    display: flex;
    align-items: center;
  }

  .bm-search-input {
    width: 100%;
    background: #12141a;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    padding: 12px 16px 12px 42px;
    font-family: 'DM Mono', monospace;
    font-size: 13px;
    color: #e8eaf0;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .bm-search-input::placeholder { color: #5a6070; }
  .bm-search-input:focus {
    border-color: #4f8eff;
    box-shadow: 0 0 0 3px rgba(79,142,255,0.12);
  }

  /* ── List ── */
  .bm-list { display: flex; flex-direction: column; gap: 10px; }

  .bm-card {
    background: #12141a;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    transition: border-color 0.18s, background 0.18s;
    animation: bmSlideIn 0.25s ease both;
  }
  .bm-card:hover { border-color: rgba(255,255,255,0.13); background: #1a1d26; }

  @keyframes bmSlideIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .bm-card-icon {
    width: 40px; height: 40px;
    background: #1e2130;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .bm-card-info { flex: 1; min-width: 0; }

  .bm-card-top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .bm-card-name {
    font-family: 'DM Mono', monospace;
    font-size: 13px;
    font-weight: 500;
    color: #e8eaf0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 220px;
  }

  .bm-card-meta {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: #5a6070;
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .bm-meta-dot {
    width: 3px; height: 3px;
    background: #3a3f50;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }

  /* ── Type badges ── */
  .bm-type-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-radius: 5px;
    padding: 2px 7px;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.06em;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .bm-type-badge.auto        { background: rgba(79,142,255,0.12);  color: #4f8eff;  border: 1px solid rgba(79,142,255,0.25); }
  .bm-type-badge.manual      { background: rgba(180,130,255,0.12); color: #b482ff;  border: 1px solid rgba(180,130,255,0.25); }
  .bm-type-badge.pre-restore { background: rgba(255,180,50,0.1);   color: #ffb432;  border: 1px solid rgba(255,180,50,0.25); }

  .bm-ready-badge {
    display: inline-flex;
    align-items: center;
    background: rgba(45,224,165,0.1);
    color: #2de0a5;
    border-radius: 5px;
    padding: 2px 7px;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }

  /* ── Action buttons ── */
  .bm-card-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .bm-btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px; height: 34px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.08);
    background: transparent;
    color: #5a6070;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .bm-btn-icon:hover         { color: #e8eaf0; border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.04); }
  .bm-btn-icon.restore:hover { color: #4f8eff; border-color: rgba(79,142,255,0.4);  background: rgba(79,142,255,0.08); }
  .bm-btn-icon.download:hover{ color: #2de0a5; border-color: rgba(45,224,165,0.4);  background: rgba(45,224,165,0.08); }
  .bm-btn-icon.delete:hover  { color: #ff4f6a; border-color: rgba(255,79,106,0.4);  background: rgba(255,79,106,0.08); }

  /* ── Tooltips ── */
  .bm-tooltip-wrap { position: relative; }
  .bm-tooltip-wrap:hover .bm-tooltip { opacity: 1; transform: translateX(-50%) translateY(-4px); }

  .bm-tooltip {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%) translateY(0px);
    background: #1e2130;
    border: 1px solid rgba(255,255,255,0.1);
    color: #c0c8d8;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    padding: 4px 8px;
    border-radius: 6px;
    white-space: nowrap;
    opacity: 0;
    transition: all 0.15s;
    pointer-events: none;
    z-index: 10;
  }

  /* ── Empty ── */
  .bm-empty {
    background: #12141a;
    border: 1px dashed rgba(255,255,255,0.07);
    border-radius: 14px;
    padding: 48px 24px;
    text-align: center;
    color: #5a6070;
    font-family: 'DM Mono', monospace;
    font-size: 13px;
  }
  .bm-empty-icon { font-size: 28px; margin-bottom: 10px; opacity: 0.4; }

  /* ── Toast ── */
  .bm-toast {
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%) translateY(0);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    border-radius: 12px;
    font-family: 'DM Mono', monospace;
    font-size: 13px;
    font-weight: 500;
    z-index: 9999;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    animation: bmToastIn 0.25s ease both;
    white-space: nowrap;
  }

  .bm-toast.success {
    background: #0d1f17;
    border: 1px solid rgba(45,224,165,0.35);
    color: #2de0a5;
  }

  .bm-toast.error {
    background: #1f0d12;
    border: 1px solid rgba(255,79,106,0.35);
    color: #ff4f6a;
  }

  @keyframes bmToastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(12px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  @media (max-width: 520px) {
    .bm-card-name { max-width: 120px; }
    .bm-ready-badge { display: none; }
    .bm-stats-row { grid-template-columns: repeat(3, 1fr); }
    .bm-toast { font-size: 11px; padding: 10px 14px; white-space: normal; max-width: 90vw; text-align: center; }
  }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBackupType(name = "") {
  const n = name.toLowerCase();
  if (n.includes("auto") || n.includes("scheduled")) return "auto";
  if (n.includes("pre") || n.includes("restore"))     return "pre-restore";
  return "manual";
}

function TypeBadge({ type }) {
  const map = { auto: "⚡ Auto", manual: "✋ Manual", "pre-restore": "🔖 Pre-restore" };
  return <span className={`bm-type-badge ${type}`}>{map[type]}</span>;
}

function getNextAutoTime() {
  const now  = new Date();
  const next = new Date();
  next.setHours(20, 0, 0, 0);
  if (now >= next) next.setDate(next.getDate() + 1);
  const diff = next - now;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Backup() {
  const [backups, setBackups] = useState([]);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState("all");
  const [toast,   setToast]   = useState(null); // { type: "success"|"error", msg: string }

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const token = localStorage.getItem("pos_token");

  const loadBackups = async () => {
    try {
      const { data } = await api.get("/api/backups");
      setBackups(data);
    } catch (e) {
      console.error("Failed to load backups:", e);
    }
  };

  useEffect(() => { loadBackups(); }, []);

  const createBackup = async () => {
    await api.post("/api/backup/create");
    showToast("success", "Backup created successfully");
    loadBackups();
  };

  const restoreBackup = async (name) => {
    if (prompt("Type YES to restore") !== "YES") return;
    await api.post("/api/backup/restore", { file_name: name });
    showToast("success", "Restore complete — reloading...");
    setTimeout(() => window.location.reload(), 1200);
  };

  const deleteBackup = async (name) => {
    if (prompt("Type DELETE to remove this backup") !== "DELETE") return;
    await api.delete("/api/backup/delete", { data: { file_name: name } });
    showToast("success", "Backup deleted");
    loadBackups();
  };

  const downloadBackup = async (name) => {
    try {
      const res = await api.get("/api/backup/download", {
        params: { file_name: name },
        responseType: "blob",
      });

      const blob = res.data;
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast("error", `Download failed: ${e.message}`);
    }
  };

  const FILTERS = ["all", "auto", "manual", "pre-restore"];

  const counts = Object.fromEntries(
    FILTERS.map((f) => [
      f,
      f === "all" ? backups.length : backups.filter((b) => getBackupType(b.name) === f).length,
    ])
  );

  const totalSizeMB = (backups.reduce((s, b) => s + (b.size || 0), 0) / 1024 / 1024).toFixed(1);

  const filtered = backups
    .filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
    .filter((b) => filter === "all" || getBackupType(b.name) === filter);

  return (
    <div className="bm-scope">
      <style>{styles}</style>

      {/* ── Toast ── */}
      {toast && (
        <div className={`bm-toast ${toast.type}`}>
          {toast.type === "success" ? "✓" : "✕"} {toast.msg}
        </div>
      )}
      <div className="bm-body">
        <div className="bm-wrap">

          {/* ── Header ── */}
          <div className="bm-header">
            <div>
              <div className="bm-eyebrow">System Control</div>
              <h1 className="bm-title">Backup Manager</h1>
              <div className="bm-sub">// All snapshots encrypted at rest</div>
            </div>
            <button className="bm-btn-create" onClick={createBackup}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Backup
            </button>
          </div>

          {/* ── Auto-schedule banner ── */}
          <div className="bm-schedule-banner">
            <div className="bm-schedule-dot" />
            <div className="bm-schedule-text">
              Auto backup runs daily at <strong>20:00</strong> — next run <strong>{getNextAutoTime()}</strong>
            </div>
            <span className="bm-schedule-next">Scheduled</span>
          </div>

          {/* ── Stats ── */}
          <div className="bm-stats-row">
            <div className="bm-stat">
              <div className="bm-stat-value">{backups.length}</div>
              <div className="bm-stat-label">Total</div>
            </div>
            <div className="bm-stat">
              <div className="bm-stat-value">{counts.auto}</div>
              <div className="bm-stat-label">Auto</div>
            </div>
            <div className="bm-stat">
              <div className="bm-stat-value">{totalSizeMB} MB</div>
              <div className="bm-stat-label">Storage Used</div>
            </div>
          </div>

          {/* ── Filter tabs ── */}
          <div className="bm-filter-row">
            {FILTERS.map((f) => (
              <button
                key={f}
                className={`bm-filter-tab ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {counts[f] > 0 ? ` (${counts[f]})` : ""}
              </button>
            ))}
          </div>

          {/* ── Search ── */}
          <div className="bm-search-wrap">
            <span className="bm-search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              className="bm-search-input"
              type="text"
              placeholder="Search backups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* ── Backup list ── */}
          <div className="bm-list">
            {filtered.length === 0 ? (
              <div className="bm-empty">
                <div className="bm-empty-icon">💾</div>
                No backups found
              </div>
            ) : (
              filtered.map((b, i) => {
                const type      = getBackupType(b.name);
                const iconColor = type === "auto" ? "#4f8eff" : type === "pre-restore" ? "#ffb432" : "#b482ff";
                return (
                  <div key={b.name} className="bm-card" style={{ animationDelay: `${i * 40}ms` }}>

                    <div className="bm-card-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <ellipse cx="12" cy="5" rx="9" ry="3" />
                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                      </svg>
                    </div>

                    <div className="bm-card-info">
                      <div className="bm-card-top">
                        <span className="bm-card-name">{b.name}</span>
                        <TypeBadge type={type} />
                        <span className="bm-ready-badge">✓ Ready</span>
                      </div>
                      <div className="bm-card-meta">
                        <span>{b.date}</span>
                        <span className="bm-meta-dot" />
                        <span>{(b.size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>

                    <div className="bm-card-actions">

                      {/* Download */}
                      <div className="bm-tooltip-wrap">
                        <button className="bm-btn-icon download" onClick={() => downloadBackup(b.name)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>
                        <span className="bm-tooltip">Download</span>
                      </div>

                      {/* Restore */}
                      <div className="bm-tooltip-wrap">
                        <button className="bm-btn-icon restore" onClick={() => restoreBackup(b.name)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 4 1 10 7 10" />
                            <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
                          </svg>
                        </button>
                        <span className="bm-tooltip">Restore</span>
                      </div>

                      {/* Delete */}
                      <div className="bm-tooltip-wrap">
                        <button className="bm-btn-icon delete" onClick={() => deleteBackup(b.name)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                        <span className="bm-tooltip">Delete</span>
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
}