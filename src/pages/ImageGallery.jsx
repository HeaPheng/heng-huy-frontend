import { useEffect, useState, useRef } from "react";
import api from "../api";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Kantumruy+Pro:wght@400;500;600;700&display=swap');

  .ig-container {
    font-family: 'Kantumruy Pro', 'Inter', sans-serif;
    min-height: 100vh;
    background-color: #0b1120; /* Slate 950 base */
    color: #f8fafc;
    padding: 2rem 1.5rem 4rem;
  }

  .ig-wrapper {
    max-width: 1200px;
    margin: 0 auto;
  }

  /* Header Section */
  .ig-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .ig-title-group .ig-subtitle {
    color: #38bdf8;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.25rem;
  }

  .ig-title-group .ig-title {
    font-size: 2rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    line-height: 1.2;
  }

  .ig-header-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  /* Search & Stats Bar */
  .ig-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 1rem;
    padding: 0.75rem 1.25rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .ig-search {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: #0f172a;
    border: 1px solid #334155;
    padding: 0.5rem 1rem;
    border-radius: 0.75rem;
    flex: 1;
    min-width: 250px;
    max-width: 400px;
    transition: all 0.2s ease;
  }

  .ig-search:focus-within {
    border-color: #38bdf8;
    box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
  }

  .ig-search input {
    background: transparent;
    border: none;
    color: #f8fafc;
    font-size: 0.875rem;
    width: 100%;
    outline: none;
    font-family: inherit;
  }

  .ig-search input::placeholder {
    color: #64748b;
  }

  .ig-stats {
    display: flex;
    gap: 1.5rem;
    color: #94a3b8;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .ig-stat-item span {
    color: #f8fafc;
    font-weight: 700;
    margin-right: 0.25rem;
  }

  /* Upload Button */
  .ig-upload-btn-wrap {
    position: relative;
  }

  .ig-upload-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #0ea5e9, #3b82f6);
    color: white;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.75rem;
    cursor: pointer;
    box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.39);
    transition: all 0.2s ease;
  }

  .ig-upload-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
  }

  .ig-upload-btn:active {
    transform: translateY(1px);
  }

  /* Progress Bar */
  .ig-progress-container {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    width: 250px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 0.75rem;
    padding: 1rem;
    z-index: 10;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    animation: igFadeIn 0.2s ease;
  }

  .ig-progress-text {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    font-weight: 600;
    color: #e2e8f0;
    margin-bottom: 0.5rem;
  }

  .ig-progress-bar {
    width: 100%;
    height: 6px;
    background: #0f172a;
    border-radius: 99px;
    overflow: hidden;
  }

  .ig-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #38bdf8, #3b82f6);
    transition: width 0.3s ease;
  }

  /* Grid Layout */
  .ig-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1.5rem;
  }

  .ig-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 1rem;
    overflow: hidden;
    position: relative;
    transition: all 0.2s ease;
    cursor: zoom-in;
    display: flex;
    flex-direction: column;
  }

  .ig-card:hover {
    transform: translateY(-4px);
    border-color: #475569;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
  }

  .ig-card-img-wrap {
    position: relative;
    width: 100%;
    padding-top: 100%; /* 1:1 Aspect Ratio */
    background: #0f172a;
    overflow: hidden;
  }

  .ig-card-img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }

  .ig-card:hover .ig-card-img {
    transform: scale(1.05);
  }

  .ig-card-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(15,23,42,0.9) 0%, rgba(15,23,42,0) 50%);
    opacity: 0;
    transition: opacity 0.2s ease;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 0.75rem;
  }

  .ig-card:hover .ig-card-overlay {
    opacity: 1;
  }

  .ig-btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 0.5rem;
    color: #f8fafc;
    cursor: pointer;
    backdrop-filter: blur(4px);
    transition: all 0.2s ease;
  }

  .ig-btn-icon:hover {
    background: #ef4444;
    border-color: #ef4444;
  }

  .ig-card-info {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .ig-card-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ig-card-date {
    font-size: 0.75rem;
    color: #94a3b8;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  /* Empty State */
  .ig-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    background: #1e293b;
    border: 1px dashed #334155;
    border-radius: 1rem;
    color: #94a3b8;
    text-align: center;
  }

  .ig-empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .ig-empty-text {
    font-size: 1rem;
    font-weight: 500;
    color: #e2e8f0;
  }

  /* Lightbox */
  .ig-lightbox {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(2, 6, 23, 0.95);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: igFadeIn 0.2s ease;
  }

  .ig-lightbox-img {
    max-width: 90vw;
    max-height: 85vh;
    border-radius: 0.5rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    object-fit: contain;
  }

  .ig-lightbox-close {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    width: 44px;
    height: 44px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 50%;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  }

  .ig-lightbox-close:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .ig-lightbox-toolbar {
    position: absolute;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 1rem;
    background: rgba(15, 23, 42, 0.8);
    padding: 0.75rem 1rem;
    border-radius: 1rem;
    border: 1px solid rgba(255,255,255,0.1);
    backdrop-filter: blur(8px);
  }

  .ig-lightbox-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    border: none;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .ig-lightbox-btn.download {
    background: #38bdf8;
    color: #0f172a;
  }

  .ig-lightbox-btn.download:hover {
    background: #0ea5e9;
  }

  .ig-lightbox-btn.danger {
    background: transparent;
    color: #ef4444;
  }

  .ig-lightbox-btn.danger:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  /* Toasts & Modals */
  .ig-toast-container {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 10000;
    pointer-events: none;
  }

  .ig-toast {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    border-radius: 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
    animation: igToastSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    pointer-events: auto;
  }

  .ig-toast.success { background: #064e3b; border: 1px solid #059669; color: #34d399; }
  .ig-toast.error   { background: #450a0a; border: 1px solid #dc2626; color: #f87171; }
  .ig-toast.warning { background: #422006; border: 1px solid #d97706; color: #fbbf24; }

  /* Delete Modal */
  .ig-modal-overlay {
    position: fixed; inset: 0; z-index: 10001;
    background: rgba(2, 6, 23, 0.85); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    animation: igFadeIn 0.2s ease;
  }
  
  .ig-modal {
    background: #1e293b; border: 1px solid #334155; border-radius: 1rem;
    padding: 1.5rem; width: 90%; max-width: 360px;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); text-align: center;
    animation: igToastSlideUp 0.25s ease;
  }
  
  .ig-modal-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 48px; height: 48px; border-radius: 50%;
    background: rgba(239, 68, 68, 0.1); color: #ef4444; margin-bottom: 1rem;
  }
  
  .ig-modal-title { font-size: 1.125rem; font-weight: 700; color: #f8fafc; margin-bottom: 0.5rem; }
  .ig-modal-text { font-size: 0.875rem; color: #94a3b8; margin-bottom: 1.5rem; line-height: 1.4; }
  .ig-modal-actions { display: flex; gap: 0.75rem; }
  
  .ig-modal-btn {
    flex: 1; padding: 0.6rem; border-radius: 0.5rem;
    font-size: 0.875rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s;
  }
  .ig-modal-btn.cancel { background: #334155; color: #f8fafc; }
  .ig-modal-btn.cancel:hover { background: #475569; }
  .ig-modal-btn.confirm { background: #ef4444; color: white; }
  .ig-modal-btn.confirm:hover { background: #dc2626; }

  @keyframes igFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes igToastSlideUp {
    from { opacity: 0; transform: translateY(1rem) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* Load More Button */
  .ig-load-more-wrap {
    display: flex;
    justify-content: center;
    margin-top: 3rem;
  }

  .ig-load-more-btn {
    background: #1e293b;
    border: 1px solid #334155;
    color: #e2e8f0;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.75rem 2rem;
    border-radius: 99px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .ig-load-more-btn:hover {
    background: #334155;
    color: #f8fafc;
  }

  @media (max-width: 640px) {
    .ig-container { padding: 1rem 1rem 4rem; }
    .ig-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
    .ig-title-group .ig-title { font-size: 1.5rem; }
    .ig-header-actions { width: 100%; justify-content: flex-start; }
    .ig-upload-btn { width: 100%; justify-content: center; }
    .ig-toolbar { flex-direction: column; align-items: stretch; gap: 1rem; padding: 1rem; }
    .ig-search { max-width: 100%; }
    .ig-stats { justify-content: space-between; width: 100%; }
    .ig-grid { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
    .ig-card-info { padding: 0.75rem; }
    .ig-card-name { font-size: 0.75rem; }
    .ig-card-date { font-size: 0.65rem; }
    .ig-card-overlay { opacity: 1; background: linear-gradient(to top, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0) 60%); padding: 0.5rem; }
    .ig-btn-icon { width: 28px; height: 28px; }
    .ig-lightbox-img { max-width: 95vw; max-height: 80vh; }
    .ig-lightbox-toolbar { width: 90%; justify-content: center; bottom: 1rem; }
    .ig-lightbox-btn { font-size: 0.75rem; padding: 0.5rem 0.75rem; flex: 1; justify-content: center; }
  }
`;

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") || "";

export default function ImageGallery() {
  const [images, setImages] = useState([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lightbox, setLightbox] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const fileRef = useRef(null);

  // Reset visible count when search changes
  useEffect(() => {
    setVisibleCount(10);
  }, [search]);

  const addToast = (type, msg) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, msg }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const loadImages = async () => {
    try {
      const { data } = await api.get("/images");
      setImages(Array.isArray(data) ? data : data.data || []);
    } catch (e) {
      console.error("Failed to load images:", e);
    }
  };

  useEffect(() => {
    loadImages();
  }, []);

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append("image", files[i]);

      try {
        await api.post("/images", formData, {
          onUploadProgress: (e) => {
            const fileProgress = ((i + (e.loaded / e.total)) / files.length) * 100;
            setUploadProgress(Math.round(fileProgress));
          },
        });
        successCount++;
      } catch (e) {
        if (e.response?.status === 409) {
          duplicateCount++;
        } else {
          errorCount++;
        }
      }
    }

    setUploading(false);
    setUploadProgress(0);
    if (fileRef.current) fileRef.current.value = "";

    // Show appropriate toasts based on results
    if (successCount > 0) {
      addToast("success", `បានបញ្ចូលរូបភាព ${successCount} សម្រេច`);
      loadImages();
    }
    if (duplicateCount > 0) {
      addToast("warning", `រំលងរូបភាព ${duplicateCount} (មានរួចហើយ)`);
    }
    if (errorCount > 0) {
      addToast("error", `បរាជ័យក្នុងការបញ្ចូល ${errorCount} រូបភាព`);
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/images/${deleteConfirm}`);
      setImages((prev) => prev.filter((img) => img.id !== deleteConfirm));
      if (lightbox && lightbox.id === deleteConfirm) setLightbox(null);
      addToast("success", "បានលុបរូបភាពសម្រេច");
    } catch (e) {
      addToast("error", "លុបរូបភាពមិនបានទេ");
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleDownload = (img) => {
    const a = document.createElement("a");
    a.href = getImageUrl(img);
    a.download = img.original_name || img.filename || "image";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  function getImageUrl(img) {
    if (img.url) return img.url.startsWith("http") ? img.url : `${API_BASE}${img.url}`;
    if (img.path) return `${API_BASE}/storage/${img.path}`;
    return "";
  }

  function formatDate(dateString) {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("km-KH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const filtered = images.filter((img) => {
    const name = (img.original_name || img.filename || "").toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const displayedImages = filtered.slice(0, visibleCount);

  const totalSizeMB = (images.reduce((s, img) => s + (img.size || 0), 0) / 1024 / 1024).toFixed(1);

  return (
    <div className="ig-container">
      <style>{css}</style>

      {/* Toast Notification Container */}
      <div className="ig-toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`ig-toast ${t.type}`}>
            {t.type === "success" && "✅"}
            {t.type === "error" && "❌"}
            {t.type === "warning" && "⚠️"}
            {t.msg}
          </div>
        ))}
      </div>

      <div className="ig-wrapper">
        {/* Header */}
        <div className="ig-header">
          <div className="ig-title-group">
            <div className="ig-subtitle">Media Library</div>
            <h1 className="ig-title">វិចិត្រសាលរូបភាព</h1>
          </div>

          <div className="ig-header-actions">
            <div className="ig-upload-btn-wrap">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  handleUpload(e.target.files);
                }}
                style={{ display: "none" }}
              />
              <button 
                className="ig-upload-btn" 
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {uploading ? "កំពុងបញ្ចូល..." : "បញ្ចូលរូបភាព"}
              </button>

              {/* Upload Progress Popover */}
              {uploading && (
                <div className="ig-progress-container">
                  <div className="ig-progress-text">
                    <span>កំពុងផ្ទុកឡើង...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="ig-progress-bar">
                    <div className="ig-progress-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Toolbar (Search & Stats) */}
        <div className="ig-toolbar">
          <div className="ig-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="ស្វែងរករូបភាពតាមឈ្មោះ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="ig-stats">
            <div className="ig-stat-item">
              <span>{images.length}</span> រូបភាព
            </div>
            <div className="ig-stat-item">
              <span>{totalSizeMB}</span> MB
            </div>
          </div>
        </div>

        {/* Grid Display */}
        {filtered.length === 0 ? (
          <div className="ig-empty">
            <div className="ig-empty-icon">📂</div>
            <div className="ig-empty-text">មិនមានរូបភាពទេ</div>
          </div>
        ) : (
          <div className="ig-grid">
            {displayedImages.map((img) => (
              <div
                key={img.id}
                className="ig-card"
                onClick={() => setLightbox(img)}
              >
                <div className="ig-card-img-wrap">
                  <img
                    className="ig-card-img"
                    src={getImageUrl(img)}
                    alt={img.original_name || "image"}
                    loading="lazy"
                  />
                  
                  {/* Hover Overlay Actions */}
                  <div className="ig-card-overlay">
                    <button
                      className="ig-btn-icon"
                      title="លុប"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(img.id);
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="ig-card-info">
                  <div className="ig-card-name" title={img.original_name}>
                    {img.original_name || img.filename || "—"}
                  </div>
                  <div className="ig-card-date">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {formatDate(img.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {filtered.length > visibleCount && (
          <div className="ig-load-more-wrap">
            <button className="ig-load-more-btn" onClick={() => setVisibleCount(prev => prev + 10)}>
              បង្ហាញបន្ថែមទៀត...
            </button>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightbox && (
        <div className="ig-lightbox" onClick={() => setLightbox(null)}>
          <button className="ig-lightbox-close" onClick={() => setLightbox(null)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          
          <img
            className="ig-lightbox-img"
            src={getImageUrl(lightbox)}
            alt={lightbox.original_name || "image"}
            onClick={(e) => e.stopPropagation()}
          />
          
          <div className="ig-lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
            <button className="ig-lightbox-btn download" onClick={() => handleDownload(lightbox)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              ទាញយក
            </button>
            <button className="ig-lightbox-btn danger" onClick={() => handleDeleteClick(lightbox.id)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
              លុប
            </button>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="ig-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="ig-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ig-modal-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </div>
            <h3 className="ig-modal-title">លុបរូបភាព?</h3>
            <p className="ig-modal-text">
              តើអ្នកពិតជាចង់លុបរូបភាពនេះមែនទេ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។
            </p>
            <div className="ig-modal-actions">
              <button className="ig-modal-btn cancel" onClick={() => setDeleteConfirm(null)}>
                បោះបង់
              </button>
              <button className="ig-modal-btn confirm" onClick={confirmDelete}>
                យល់ព្រមលុប
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
