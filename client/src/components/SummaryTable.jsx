import React, { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, ArrowRight } from "lucide-react";

export default function SummaryTable({
  summary = [],
  total = 0,
  distinct = 0,
  selectedKey = null,
  onSelectKey,
}) {
  const [sortCol, setSortCol] = useState("count");
  const [sortDir, setSortDir] = useState("desc");

  const handleHeaderClick = (col) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      // For count, percent, and timestamps, default to desc; for text default to asc
      if (["count", "percent", "distinctIps", "distinctEndpoints", "lastSeen"].includes(col)) {
        setSortDir("desc");
      } else {
        setSortDir("asc");
      }
    }
  };

  const sortedSummary = useMemo(() => {
    if (!summary || summary.length === 0) return [];
    const copy = [...summary];

    copy.sort((a, b) => {
      let valA = a[sortCol];
      let valB = b[sortCol];

      if (valA === undefined || valA === null) valA = "";
      if (valB === undefined || valB === null) valB = "";

      let comparison = 0;
      if (typeof valA === "number" && typeof valB === "number") {
        comparison = valA - valB;
      } else {
        comparison = String(valA).localeCompare(String(valB), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }

      return sortDir === "asc" ? comparison : -comparison;
    });

    return copy;
  }, [summary, sortCol, sortDir]);

  const renderSortIndicator = (col) => {
    if (sortCol !== col) {
      return (
        <span className="sort-indicator neutral" style={{ display: "inline-flex", alignItems: "center" }}>
          <ArrowUpDown size={12} strokeWidth={2} />
        </span>
      );
    }
    return (
      <span className="sort-indicator active" style={{ display: "inline-flex", alignItems: "center" }}>
        {sortDir === "asc" ? (
          <ArrowUp size={12} strokeWidth={2} />
        ) : (
          <ArrowDown size={12} strokeWidth={2} />
        )}
      </span>
    );
  };

  return (
    <div className="card summary-card">
      <div className="table-header-title">
        <h3>Grouped Error Summary</h3>
        <span className="table-instruction" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <span>Click any row to open the full drill-down page</span>
          <ArrowRight size={14} strokeWidth={2} />
        </span>
      </div>

      <div className="table-responsive">
        <table className="table summary-table">
          <thead>
            <tr>
              <th onClick={() => handleHeaderClick("message")} className="sortable-th">
                <div className="th-content">
                  Error {renderSortIndicator("message")}
                </div>
              </th>
              <th onClick={() => handleHeaderClick("count")} className="sortable-th th-num">
                <div className="th-content th-content-num">
                  Count {renderSortIndicator("count")}
                </div>
              </th>
              <th onClick={() => handleHeaderClick("percent")} className="sortable-th th-num">
                <div className="th-content th-content-num">
                  % of total {renderSortIndicator("percent")}
                </div>
              </th>
              <th onClick={() => handleHeaderClick("fingerprint")} className="sortable-th">
                <div className="th-content">
                  Fingerprint {renderSortIndicator("fingerprint")}
                </div>
              </th>
              <th onClick={() => handleHeaderClick("firstSeen")} className="sortable-th">
                <div className="th-content">
                  First seen {renderSortIndicator("firstSeen")}
                </div>
              </th>
              <th onClick={() => handleHeaderClick("lastSeen")} className="sortable-th">
                <div className="th-content">
                  Last seen {renderSortIndicator("lastSeen")}
                </div>
              </th>
              <th onClick={() => handleHeaderClick("distinctIps")} className="sortable-th th-num">
                <div className="th-content th-content-num">
                  IPs {renderSortIndicator("distinctIps")}
                </div>
              </th>
              <th onClick={() => handleHeaderClick("distinctEndpoints")} className="sortable-th th-num">
                <div className="th-content th-content-num">
                  Endpoints {renderSortIndicator("distinctEndpoints")}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedSummary.map((item) => {
              const isSelected = selectedKey === item.key;
              return (
                <tr
                  key={item.key}
                  onClick={() => onSelectKey(item.key)}
                  className={`clickable-row ${isSelected ? "selected" : ""}`}
                >
                  <td className="td-error">
                    <div className="error-title" title={item.key}>
                      {item.key || item.message}
                    </div>
                  </td>
                  <td className="td-num">
                    <span className="count-pill">{item.count.toLocaleString()}</span>
                  </td>
                  <td className="td-num">
                    <span className="percent-text">{item.percent.toFixed(1)}%</span>
                  </td>
                  <td className="td-fp">
                    {item.fingerprint ? (
                      <code className="fp-code" title={item.fingerprint}>
                        {item.fingerprint}
                      </code>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="td-time">
                    <span title={item.firstSeen}>{item.firstSeen || "—"}</span>
                  </td>
                  <td className="td-time">
                    <span title={item.lastSeen}>{item.lastSeen || "—"}</span>
                  </td>
                  <td className="td-num">
                    <span className="badge badge-light">{item.distinctIps}</span>
                  </td>
                  <td className="td-num">
                    <span className="badge badge-light">{item.distinctEndpoints}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        Showing {sortedSummary.length} of {distinct || sortedSummary.length} groups ·{" "}
        {total.toLocaleString()} total rows. Click a row to open its drill-down page.
      </div>
    </div>
  );
}
