import React, { useState, useEffect, useRef } from "react";
import {
  BarChart3,
  Bookmark,
  AlertTriangle,
  X,
  Trash2,
  Download,
} from "lucide-react";
import { uploadFile } from "./api.js";
import {
  saveUpload,
  listUploads,
  getUpload,
  deleteUpload,
  clearAllData,
} from "./db.js";
import UploadBox from "./components/UploadBox.jsx";
import StatsCards from "./components/StatsCards.jsx";
import HistoryList from "./components/HistoryList.jsx";
import SummaryTable from "./components/SummaryTable.jsx";
import DrillDown from "./components/DrillDown.jsx";
import SavedErrorsDrawer from "./components/SavedErrorsDrawer.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";

const STORAGE_KEY = "error_grouper_saved_errors_v1";

export default function App() {
  const [currentFile, setCurrentFile] = useState(null);
  const [groupBy, setGroupBy] = useState("normalized");
  // Cache results per grouping mode for the current file: { [mode]: resultData }
  const [resultsCache, setResultsCache] = useState({});
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [loading, setLoading] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [currentView, setCurrentView] = useState("summary"); // "summary" | "drilldown"
  const isUploadingRef = useRef(false);

  // Restore previous upload history on mount
  useEffect(() => {
    let isMounted = true;
    async function restoreHistory() {
      try {
        const items = await listUploads();
        if (!isMounted) return;
        setHistory(items);
        if (items.length > 0 && !isUploadingRef.current && !loading) {
          setResult({
            total: items[0].totalRows,
            distinct: items[0].distinct,
            groupBy: items[0].groupBy,
            summary: items[0].summary,
            groups: {},
          });
          setCurrentId(items[0].id);
          setGroupBy(items[0].groupBy);
          if (items[0].rawFile) {
            setCurrentFile(
              items[0].rawFile.name
                ? items[0].rawFile
                : new File([items[0].rawFile], items[0].filename)
            );
          }
        }
      } catch (e) {
        console.error("Failed to restore history from IndexedDB:", e);
      } finally {
        if (isMounted) {
          setRestoring(false);
        }
      }
    }
    restoreHistory();
    return () => {
      isMounted = false;
    };
  }, []);

  // Saved errors for later & side drawer state
  const [savedErrors, setSavedErrors] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load saved errors from localStorage", e);
      return [];
    }
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Sync saved errors with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedErrors));
    } catch (e) {
      console.error("Failed to save errors to localStorage", e);
    }
  }, [savedErrors]);

  // Browser back/forward navigation support
  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state && event.state.view === "drilldown" && event.state.key) {
        setSelectedKey(event.state.key);
        setCurrentView("drilldown");
      } else {
        setCurrentView("summary");
        setSelectedKey(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Main upload handler for new files or re-analyzing an existing file
  const handleUpload = async (file, targetGroupBy) => {
    const isNewFile = !currentFile || file !== currentFile;
    const mode = targetGroupBy || groupBy;

    if (!isNewFile && resultsCache[mode]) {
      setGroupBy(mode);
      setResult(resultsCache[mode]);
      setSelectedKey(null);
      setCurrentView("summary");
      return;
    }

    if (isNewFile) {
      setLoading(true);
      setResultsCache({});
    } else {
      setReanalyzing(true);
    }

    isUploadingRef.current = true;
    setError(null);
    setSelectedKey(null);
    setCurrentView("summary");

    try {
      const data = await uploadFile(file, mode);
      setCurrentFile(file);
      setGroupBy(mode);
      setResult(data);
      setResultsCache((prev) => (isNewFile ? { [mode]: data } : { ...prev, [mode]: data }));
      window.history.replaceState({ view: "summary" }, "", window.location.pathname);

      // Persist upload to IndexedDB
      const id = await saveUpload({
        filename: file.name,
        groupBy: mode,
        result: data,
        rawFile: file,
      });
      setCurrentId(id);
      setHistory(await listUploads());
    } catch (err) {
      console.error("Upload/analysis error:", err);
      setError(err.message || "An unexpected error occurred while processing the file.");
      if (isNewFile) {
        setResultsCache({});
      }
    } finally {
      isUploadingRef.current = false;
      setLoading(false);
      setReanalyzing(false);
    }
  };

  // Switch grouping mode anytime on the currently loaded file
  const handleModeChange = async (newMode) => {
    if (newMode === groupBy || loading || reanalyzing) return;

    if (resultsCache[newMode]) {
      setGroupBy(newMode);
      setResult(resultsCache[newMode]);
      setSelectedKey(null);
      setCurrentView("summary");
      window.history.replaceState({ view: "summary" }, "", window.location.pathname);
      return;
    }

    if (!currentFile) {
      setGroupBy(newMode);
      return;
    }

    await handleUpload(currentFile, newMode);
  };

  const handleOpenFromHistory = async (id) => {
    try {
      const rec = await getUpload(id);
      if (!rec) return;
      setResult({
        total: rec.totalRows,
        distinct: rec.distinct,
        groupBy: rec.groupBy,
        summary: rec.summary,
        groups: {},
      });
      setCurrentId(id);
      setSelectedKey(null);
      setGroupBy(rec.groupBy);
      setCurrentView("summary");
      setResultsCache({});
      if (rec.rawFile) {
        setCurrentFile(
          rec.rawFile.name
            ? rec.rawFile
            : new File([rec.rawFile], rec.filename)
        );
      } else {
        setCurrentFile(null);
      }
      window.history.replaceState({ view: "summary" }, "", window.location.pathname);
    } catch (err) {
      console.error("Failed to open upload from history:", err);
    }
  };

  const handleDeleteUpload = async (id) => {
    if (!window.confirm("Delete this analysis?")) return;
    try {
      await deleteUpload(id);
      const updated = await listUploads();
      setHistory(updated);
      if (id === currentId) {
        setResult(null);
        setCurrentId(null);
        setSelectedKey(null);
        setCurrentFile(null);
        setResultsCache({});
      }
    } catch (err) {
      console.error("Failed to delete upload:", err);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("All saved analyses will be permanently deleted. Are you sure?")) return;
    try {
      await clearAllData();
      setHistory([]);
      setResult(null);
      setCurrentId(null);
      setSelectedKey(null);
      setCurrentFile(null);
      setResultsCache({});
    } catch (err) {
      console.error("Failed to clear all data:", err);
    }
  };

  const handleSelectGroup = (key) => {
    setSelectedKey(key);
    setCurrentView("drilldown");
    window.history.pushState(
      { view: "drilldown", key },
      "",
      `#drilldown-${encodeURIComponent(key)}`
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToSummary = () => {
    setCurrentView("summary");
    setSelectedKey(null);
    window.history.pushState({ view: "summary" }, "", window.location.pathname);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const currentResult = result;

  const handleExportJson = () => {
    if (!currentResult || !currentResult.summary) return;
    const jsonString = JSON.stringify(currentResult.summary, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `error-summary-${groupBy}-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Saved Errors Handlers
  const handleToggleSaveError = (row) => {
    const time = row["Time (Beirut)"] || "";
    const req = row["Request"] || "";
    const msg = row["Message"] || "";
    const ip = row["Client IP"] || "";
    const fp = row["Error fingerprint"] || "";
    const id = `${time}_${req}_${msg}_${ip}_${fp}`;

    const exists = savedErrors.some((item) => item.id === id);
    if (exists) {
      setSavedErrors((prev) => prev.filter((item) => item.id !== id));
    } else {
      const newEntry = {
        id,
        name: row["Message"] || selectedGroupSummary?.message || "(no error message)",
        time: row["Time (Beirut)"] || "—",
        route: row["Request"] || selectedGroupSummary?.key || "(no route)",
        method: row["Method"] || "",
        fingerprint: row["Error fingerprint"] || selectedGroupSummary?.fingerprint || "",
        ip: row["Client IP"] || "",
        module: row["Module / level"] || selectedGroupSummary?.module || "",
        savedAt: new Date().toISOString(),
      };
      setSavedErrors((prev) => [newEntry, ...prev]);
      // Open the beside drawer when saving, matching the slide-over flow
      setIsDrawerOpen(true);
    }
  };

  const handleRemoveSavedError = (id) => {
    setSavedErrors((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAllSavedErrors = () => {
    if (window.confirm("Are you sure you want to remove all saved errors?")) {
      setSavedErrors([]);
    }
  };

  const handleUpdateSavedError = (id, updates) => {
    setSavedErrors((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const selectedGroupSummary = currentResult?.summary?.find((s) => s.key === selectedKey);
  const selectedGroupRows =
    selectedKey && currentResult?.groups ? currentResult.groups[selectedKey] || [] : [];

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-top-row">
          <div className="header-brand">
            <h1 onClick={handleBackToSummary} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
              <BarChart3 size={28} strokeWidth={2} style={{ marginInlineEnd: 10 }} />
              <span>Error Log Grouper</span>
            </h1>
            <p className="header-subtitle">
              Parse, aggregate, and analyze high-volume backend error logs
            </p>
          </div>

          {/* Header Controls: Theme Toggle & Quick Access to Saved Errors Drawer */}
          <div className="header-actions flex flex-row items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              className="btn btn-secondary btn-header-saved"
              onClick={() => setIsDrawerOpen(true)}
              title="Open saved errors panel"
            >
              <Bookmark size={16} strokeWidth={2} style={{ marginInlineEnd: 6 }} />
              <span>Saved Errors ({savedErrors.length})</span>
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {/* Error Banner */}
        {error && (
          <div className="error-banner">
            <span className="error-icon" style={{ display: "inline-flex", alignItems: "center" }}>
              <AlertTriangle size={18} strokeWidth={2} />
            </span>
            <div className="error-text">
              <strong>Error:</strong> {error}
            </div>
            <button
              className="error-dismiss"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* View 1: DrillDown Separate Page */}
        {currentView === "drilldown" && selectedGroupSummary ? (
          <DrillDown
            groupSummary={selectedGroupSummary}
            rows={selectedGroupRows}
            totalLogRows={currentResult?.total || 0}
            onBack={handleBackToSummary}
            savedErrors={savedErrors}
            onToggleSaveError={handleToggleSaveError}
            onOpenSavedDrawer={() => setIsDrawerOpen(true)}
          />
        ) : (
          /* View 2: Summary Page */
          <>
            <div className="toolbar">
              <button
                type="button"
                className="secondary"
                onClick={handleClearAll}
                disabled={!history.length}
              >
                <Trash2 size={16} strokeWidth={2} style={{ marginInlineEnd: 6 }} />
                <span>Clear all data</span>
              </button>
              <span className="muted small">
                {history.length} saved {history.length === 1 ? "analysis" : "analyses"}
              </span>
              <div className="spacer" />
            </div>

            {restoring && (
              <div className="restoring">
                Restoring saved data…
              </div>
            )}

            <UploadBox
              onUpload={handleUpload}
              currentFile={currentFile}
              activeGroupBy={groupBy}
              onGroupByChange={handleModeChange}
              loading={loading}
              reanalyzing={reanalyzing}
            />

            {currentResult && (
              <section className="results-section">
                {/* Mode Switcher Bar */}
                <div className="card grouping-control-card">
                  <div className="grouping-control-left">
                    <span className="control-label">Switch Grouping Mode:</span>
                    <div className="mode-toggle-group">
                      <button
                        type="button"
                        className={`mode-pill-btn ${groupBy === "normalized" ? "active" : ""}`}
                        onClick={() => handleModeChange("normalized")}
                        disabled={loading || reanalyzing}
                        title="Group by Message + endpoint path (strips query params)"
                      >
                        Message + Endpoint
                      </button>
                      <button
                        type="button"
                        className={`mode-pill-btn ${groupBy === "message" ? "active" : ""}`}
                        onClick={() => handleModeChange("message")}
                        disabled={loading || reanalyzing}
                        title="Group purely by error message"
                      >
                        Message Only
                      </button>
                      <button
                        type="button"
                        className={`mode-pill-btn ${groupBy === "fingerprint" ? "active" : ""}`}
                        onClick={() => handleModeChange("fingerprint")}
                        disabled={loading || reanalyzing}
                        title="Group by Error fingerprint"
                      >
                        Fingerprint
                      </button>
                    </div>
                    {reanalyzing && (
                      <span className="reanalyzing-indicator">
                        <span className="spinner"></span> Re-analyzing…
                      </span>
                    )}
                  </div>

                  <div className="grouping-control-right">
                    <button
                      type="button"
                      className="btn btn-secondary export-btn"
                      onClick={handleExportJson}
                    >
                      <Download size={16} strokeWidth={2} style={{ marginInlineEnd: 6 }} />
                      <span>Export summary JSON</span>
                    </button>
                  </div>
                </div>

                <div className="results-top-bar">
                  <StatsCards
                    total={currentResult.total}
                    distinct={currentResult.distinct}
                    rowsShown={currentResult.summary.length}
                  />
                </div>

                <HistoryList
                  items={history}
                  currentId={currentId}
                  onOpen={handleOpenFromHistory}
                  onDelete={handleDeleteUpload}
                />

                <SummaryTable
                  summary={currentResult.summary}
                  total={currentResult.total}
                  distinct={currentResult.distinct}
                  selectedKey={selectedKey}
                  onSelectKey={handleSelectGroup}
                />
              </section>
            )}

            {!currentResult && history.length > 0 && !restoring && (
              <HistoryList
                items={history}
                currentId={currentId}
                onOpen={handleOpenFromHistory}
                onDelete={handleDeleteUpload}
              />
            )}
          </>
        )}
      </main>

      {/* Floating Widget to open saved drawer from bottom right */}
      {savedErrors.length > 0 && !isDrawerOpen && (
        <button
          type="button"
          className="floating-saved-btn"
          onClick={() => setIsDrawerOpen(true)}
          title="Open saved errors dialog"
        >
          <span className="floating-icon" style={{ display: "inline-flex", alignItems: "center" }}>
            <Bookmark size={16} strokeWidth={2} />
          </span>
          <span className="floating-label">Saved Errors</span>
          <span className="floating-badge">{savedErrors.length}</span>
        </button>
      )}

      {/* Side Slide-Over Drawer */}
      <SavedErrorsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        savedErrors={savedErrors}
        onRemoveError={handleRemoveSavedError}
        onClearAll={handleClearAllSavedErrors}
        onUpdateError={handleUpdateSavedError}
      />
    </div>
  );
}
