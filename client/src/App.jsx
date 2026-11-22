import React, { useState } from "react";
import { uploadFile } from "./api.js";
import UploadBox from "./components/UploadBox.jsx";
import StatsCards from "./components/StatsCards.jsx";
import SummaryTable from "./components/SummaryTable.jsx";
import DrillDown from "./components/DrillDown.jsx";

export default function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);

  const handleUpload = async (file, groupBy) => {
    setLoading(true);
    setError(null);
    setSelectedKey(null);

    try {
      const data = await uploadFile(file, groupBy);
      setResult(data);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "An unexpected error occurred while processing the file.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExportJson = () => {
    if (!result || !result.summary) return;
    const jsonString = JSON.stringify(result.summary, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `error-summary-${result.groupBy || "grouped"}-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const selectedGroupSummary = result?.summary?.find((s) => s.key === selectedKey);
  const selectedGroupRows = selectedKey && result?.groups ? result.groups[selectedKey] || [] : [];

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-brand">
          <h1>📊 Error Log Grouper</h1>
          <p className="header-subtitle">
            Parse, aggregate, and analyze high-volume backend error logs
          </p>
        </div>
      </header>

      <main className="app-main">
        <UploadBox onUpload={handleUpload} loading={loading} />

        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            <div className="error-text">
              <strong>Error:</strong> {error}
            </div>
            <button
              className="error-dismiss"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {result && (
          <section className="results-section">
            <div className="results-top-bar">
              <StatsCards
                total={result.total}
                distinct={result.distinct}
                rowsShown={result.summary.length}
              />
              <div className="actions-bar">
                <span className="mode-badge">
                  Active Mode: <strong>{result.groupBy}</strong>
                </span>
                <button
                  type="button"
                  className="btn btn-secondary export-btn"
                  onClick={handleExportJson}
                >
                  📥 Export summary JSON
                </button>
              </div>
            </div>

            <SummaryTable
              summary={result.summary}
              total={result.total}
              distinct={result.distinct}
              selectedKey={selectedKey}
              onSelectKey={(key) => setSelectedKey((prev) => (prev === key ? null : key))}
            />

            {selectedKey && selectedGroupSummary && (
              <DrillDown
                groupSummary={selectedGroupSummary}
                rows={selectedGroupRows}
                onClose={() => setSelectedKey(null)}
              />
            )}
          </section>
        )}
      </main>
    </div>
  );
}
