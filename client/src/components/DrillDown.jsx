import React, { useMemo, useState } from "react";
import { ArrowLeft, Bookmark, Download, Copy, Check } from "lucide-react";

/**
 * Dedicated DrillDown Page component for inspecting a selected error group,
 * with action buttons beside each error row to save it for later review.
 */
export default function DrillDown({
  groupSummary,
  rows = [],
  totalLogRows = 0,
  onBack,
  savedErrors = [],
  onToggleSaveError,
  onOpenSavedDrawer,
}) {
  const [copiedFp, setCopiedFp] = useState(false);

  // Filter columns to only those that have non-empty values in at least one row
  const activeColumns = useMemo(() => {
    if (!rows || rows.length === 0) return [];

    const columnOrder = [
      "Time (Beirut)",
      "Severity",
      "Kind",
      "Site",
      "Method",
      "Request",
      "Message",
      "Client IP",
      "Referring page",
      "PHP file",
      "MySQL error",
      "Query type",
      "Tables",
      "SQL",
      "Apache code",
      "Module / level",
      "Worker pid",
      "Error fingerprint",
      "Log file",
      "Collector",
    ];

    const presentKeys = new Set();
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        presentKeys.add(k);
      }
    }

    const orderedCols = [
      ...columnOrder.filter((col) => presentKeys.has(col)),
      ...Array.from(presentKeys).filter((col) => !columnOrder.includes(col)),
    ];

    return orderedCols.filter((col) =>
      rows.some(
        (r) =>
          r[col] !== undefined &&
          r[col] !== null &&
          String(r[col]).trim() !== ""
      )
    );
  }, [rows]);

  const handleCopyFingerprint = () => {
    if (!groupSummary?.fingerprint) return;
    navigator.clipboard.writeText(groupSummary.fingerprint);
    setCopiedFp(true);
    setTimeout(() => setCopiedFp(false), 2000);
  };

  const handleExportGroupJson = () => {
    if (!rows || rows.length === 0) return;
    const exportData = {
      group: groupSummary,
      rows: rows,
    };
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeName = (groupSummary?.fingerprint || "group-rows").replace(/[^a-zA-Z0-9_-]/g, "_");
    link.download = `error-group-${safeName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getRowId = (row) => {
    const time = row["Time (Beirut)"] || "";
    const req = row["Request"] || "";
    const msg = row["Message"] || "";
    const ip = row["Client IP"] || "";
    const fp = row["Error fingerprint"] || "";
    return `${time}_${req}_${msg}_${ip}_${fp}`;
  };

  if (!groupSummary) {
    return (
      <div className="drilldown-page-empty">
        <div className="card empty-card">
          <h2>No Error Group Selected</h2>
          <p>Please return to the summary table and select an error group to inspect.</p>
          <button type="button" className="btn btn-primary" onClick={onBack} style={{ display: "inline-flex", alignItems: "center" }}>
            <ArrowLeft size={16} strokeWidth={2} style={{ marginInlineEnd: 6 }} />
            <span>Back to Summary Table</span>
          </button>
        </div>
      </div>
    );
  }

  const isRestored = !rows || rows.length === 0;

  const percentDisplay = totalLogRows > 0
    ? ((groupSummary.count / totalLogRows) * 100).toFixed(1)
    : groupSummary.percent?.toFixed(1) || "0.0";

  return (
    <div className="drilldown-page">
      {/* Top Navigation & Breadcrumbs */}
      <nav className="drilldown-nav-bar">
        <div className="breadcrumbs">
          <button
            type="button"
            className="breadcrumb-link"
            onClick={onBack}
            style={{ display: "inline-flex", alignItems: "center" }}
          >
            <ArrowLeft size={14} strokeWidth={2} style={{ marginInlineEnd: 4 }} />
            <span>Summary Table</span>
          </button>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">
            {groupSummary.key || groupSummary.message}
          </span>
        </div>

        <div className="drilldown-nav-actions">
          {onOpenSavedDrawer && (
            <button
              type="button"
              className="btn btn-secondary btn-drawer-trigger"
              onClick={onOpenSavedDrawer}
              style={{ display: "inline-flex", alignItems: "center" }}
            >
              <Bookmark size={16} strokeWidth={2} style={{ marginInlineEnd: 6 }} />
              <span>Saved Errors ({savedErrors.length})</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportGroupJson}
            title="Download rows in this group as JSON"
            disabled={isRestored || !rows || rows.length === 0}
            style={{ display: "inline-flex", alignItems: "center" }}
          >
            <Download size={16} strokeWidth={2} style={{ marginInlineEnd: 6 }} />
            <span>Export Group Rows (JSON)</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onBack}
            style={{ display: "inline-flex", alignItems: "center" }}
          >
            <ArrowLeft size={16} strokeWidth={2} style={{ marginInlineEnd: 6 }} />
            <span>Back to Summary</span>
          </button>
        </div>
      </nav>

      {/* Main Error Overview Card */}
      <div className="card drilldown-overview-card">
        <div className="overview-header">
          <div className="overview-badges">
            <span className="badge badge-primary">{groupSummary.count.toLocaleString()} occurrences</span>
            <span className="badge badge-indigo">
              {groupSummary.distinctIps} distinct {groupSummary.distinctIps === 1 ? "IP" : "IPs"}
            </span>
            <span className="badge badge-teal">
              {groupSummary.distinctEndpoints} {groupSummary.distinctEndpoints === 1 ? "endpoint" : "endpoints"}
            </span>
            <span className="badge badge-light">{percentDisplay}% of total log</span>
          </div>

          <h2 className="overview-error-title">{groupSummary.message}</h2>
          {groupSummary.key !== groupSummary.message && (
            <div className="overview-key-subtext">
              <span className="meta-label">Grouping Key:</span> <code>{groupSummary.key}</code>
            </div>
          )}
        </div>

        {/* Quick Stats Grid */}
        <div className="overview-meta-grid">
          <div className="meta-box">
            <span className="meta-label">Error Fingerprint</span>
            <div className="meta-fp-container">
              {groupSummary.fingerprint ? (
                <>
                  <code className="fp-code-lg">{groupSummary.fingerprint}</code>
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={handleCopyFingerprint}
                    title="Copy fingerprint"
                    style={{ display: "inline-flex", alignItems: "center" }}
                  >
                    {copiedFp ? (
                      <>
                        <Check size={12} strokeWidth={2} style={{ marginInlineEnd: 4 }} />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} strokeWidth={2} style={{ marginInlineEnd: 4 }} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <span className="text-muted">None</span>
              )}
            </div>
          </div>

          <div className="meta-box">
            <span className="meta-label">Module / Level</span>
            <div className="meta-value">{groupSummary.module || "—"}</div>
          </div>

          <div className="meta-box">
            <span className="meta-label">First Seen</span>
            <div className="meta-value font-mono">{groupSummary.firstSeen || "—"}</div>
          </div>

          <div className="meta-box">
            <span className="meta-label">Last Seen</span>
            <div className="meta-value font-mono">{groupSummary.lastSeen || "—"}</div>
          </div>
        </div>

        {/* Sample Requests */}
        {groupSummary.sampleRequests && groupSummary.sampleRequests.length > 0 && (
          <div className="sample-requests-box">
            <div className="sample-requests-title">Sample Requests (up to 3):</div>
            <div className="sample-requests-chips">
              {groupSummary.sampleRequests.map((req, idx) => (
                <code key={idx} className="request-chip">
                  {req}
                </code>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cap Notice if 200 Rows */}
      {!isRestored && rows.length === 200 && (
        <div className="notice-banner">
          Showing first 200 rows of this group.
        </div>
      )}

      {/* Detailed Table Card with Save buttons */}
      <div className="card drilldown-table-card">
        <div className="drilldown-table-title-row">
          <div>
            <h3>Error Log Records</h3>
            <p className="table-subtitle">
              {isRestored
                ? "This analysis was restored from local storage — re-upload the file to view detailed rows."
                : `Displaying ${rows.length} rows and ${activeColumns.length} active columns. Click "Save" beside any error to save it to your side panel.`}
            </p>
          </div>
          <div className="table-action-links">
            {onOpenSavedDrawer && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onOpenSavedDrawer}
                style={{ display: "inline-flex", alignItems: "center" }}
              >
                <Bookmark size={14} strokeWidth={2} style={{ marginInlineEnd: 4 }} />
                <span>View Saved ({savedErrors.length})</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onBack}
              style={{ display: "inline-flex", alignItems: "center" }}
            >
              <ArrowLeft size={14} strokeWidth={2} style={{ marginInlineEnd: 4 }} />
              <span>Back to Summary</span>
            </button>
          </div>
        </div>

        {isRestored ? (
          <div
            className="restored-notice-banner"
            style={{
              padding: "36px 20px",
              textAlign: "center",
              color: "#4b5563",
              backgroundColor: "#f9fafb",
              borderRadius: "8px",
              marginTop: "16px",
              border: "1px dashed #d1d5db",
            }}
          >
            <p style={{ fontSize: "1.05rem", fontWeight: 500, margin: 0 }}>
              This analysis was restored from local storage — re-upload the file to view detailed rows.
            </p>
          </div>
        ) : (
          <>
            <div className="table-responsive drilldown-table-wrapper">
              <table className="table drilldown-table">
                <thead>
                  <tr>
                    <th className="row-num-th">#</th>
                    <th className="save-col-th">Action</th>
                    {activeColumns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const rowId = getRowId(row);
                    const isSaved = savedErrors.some((item) => item.id === rowId);

                    return (
                      <tr key={idx} className={isSaved ? "saved-row-highlight" : ""}>
                        <td className="row-num-td">{idx + 1}</td>
                        <td className="save-col-td">
                          <button
                            type="button"
                            className={`btn-save-error ${isSaved ? "is-saved" : ""}`}
                            onClick={() => onToggleSaveError(row)}
                            title={
                              isSaved
                                ? "Saved! Click to remove or view in drawer"
                                : "Save this error for later"
                            }
                            style={{ display: "inline-flex", alignItems: "center" }}
                          >
                            {isSaved ? (
                              <>
                                <Check size={12} strokeWidth={2} style={{ marginInlineEnd: 4 }} />
                                <span>Saved</span>
                              </>
                            ) : (
                              <>
                                <Bookmark size={12} strokeWidth={2} style={{ marginInlineEnd: 4 }} />
                                <span>Save</span>
                              </>
                            )}
                          </button>
                        </td>
                        {activeColumns.map((col) => {
                          const val = row[col];
                          const strVal = val !== undefined && val !== null ? String(val) : "";
                          const isCodeCol =
                            col === "Request" ||
                            col === "SQL" ||
                            col === "Error fingerprint" ||
                            col === "PHP file";

                          return (
                            <td key={col} className="drilldown-td" title={strVal}>
                              {isCodeCol ? (
                                <code className="inline-code">{strVal || "—"}</code>
                              ) : (
                                <span>{strVal || "—"}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="table-footer">
              Showing {rows.length} of {groupSummary.count.toLocaleString()} occurrences in this group.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
