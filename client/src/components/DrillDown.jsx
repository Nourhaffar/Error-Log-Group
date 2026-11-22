import React, { useMemo, useRef, useEffect } from "react";

export default function DrillDown({ groupSummary, rows = [], onClose }) {
  const drillDownRef = useRef(null);

  useEffect(() => {
    if (groupSummary && drillDownRef.current) {
      drillDownRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [groupSummary]);

  // Compute non-empty columns across all rows in this group
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

    // Sort according to preferred columnOrder, followed by any remaining columns
    const orderedCols = [
      ...columnOrder.filter((col) => presentKeys.has(col)),
      ...Array.from(presentKeys).filter((col) => !columnOrder.includes(col)),
    ];

    // Filter to only columns where at least one row has non-empty text
    return orderedCols.filter((col) =>
      rows.some(
        (r) =>
          r[col] !== undefined &&
          r[col] !== null &&
          String(r[col]).trim() !== ""
      )
    );
  }, [rows]);

  if (!groupSummary || !rows || rows.length === 0) {
    return null;
  }

  return (
    <div className="card drilldown-card" ref={drillDownRef}>
      <div className="drilldown-header">
        <div className="drilldown-title-area">
          <div className="drilldown-badges">
            <span className="badge badge-primary">{groupSummary.count} rows</span>
            <span className="badge badge-indigo">
              {groupSummary.distinctIps} distinct {groupSummary.distinctIps === 1 ? "IP" : "IPs"}
            </span>
            <span className="badge badge-teal">
              {groupSummary.distinctEndpoints} {groupSummary.distinctEndpoints === 1 ? "endpoint" : "endpoints"}
            </span>
          </div>
          <h3 className="drilldown-message">{groupSummary.message}</h3>
          {groupSummary.fingerprint && (
            <div className="drilldown-meta-item">
              <span className="meta-label">Fingerprint:</span>{" "}
              <code className="fp-code-lg">{groupSummary.fingerprint}</code>
            </div>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            className="btn btn-secondary close-btn"
            onClick={onClose}
            title="Close drill-down"
          >
            ✕ Close
          </button>
        )}
      </div>

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

      {rows.length === 200 && (
        <div className="notice-banner">
          Showing first 200 rows of this group.
        </div>
      )}

      <div className="table-responsive drilldown-table-wrapper">
        <table className="table drilldown-table">
          <thead>
            <tr>
              <th className="row-num-th">#</th>
              {activeColumns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td className="row-num-td">{idx + 1}</td>
                {activeColumns.map((col) => {
                  const val = row[col];
                  const strVal = val !== undefined && val !== null ? String(val) : "";
                  return (
                    <td key={col} className="drilldown-td" title={strVal}>
                      {col === "Request" || col === "SQL" || col === "Error fingerprint" ? (
                        <code className="inline-code">{strVal || "—"}</code>
                      ) : (
                        <span>{strVal || "—"}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
