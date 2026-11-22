import React from "react";

export default function StatsCards({ total, distinct, rowsShown }) {
  return (
    <div className="stats-container">
      <div className="card stat-card">
        <div className="stat-label">Total Rows</div>
        <div className="stat-value">{Number(total || 0).toLocaleString()}</div>
        <div className="stat-hint">Parsed log entries</div>
      </div>

      <div className="card stat-card">
        <div className="stat-label">Distinct Error Groups</div>
        <div className="stat-value">{Number(distinct || 0).toLocaleString()}</div>
        <div className="stat-hint">Unique error patterns</div>
      </div>

      <div className="card stat-card">
        <div className="stat-label">Rows Shown in Table</div>
        <div className="stat-value">{Number(rowsShown || 0).toLocaleString()}</div>
        <div className="stat-hint">Grouped summary rows</div>
      </div>
    </div>
  );
}
