import React from "react";
import { FolderOpen, Trash2 } from "lucide-react";

/**
 * Component to display the list of persisted uploads in IndexedDB.
 *
 * Props:
 * - items: Array of upload records
 * - currentId: ID of currently active upload
 * - onOpen: (id) => void
 * - onDelete: (id) => void
 */
export default function HistoryList({ items = [], currentId, onOpen, onDelete }) {
  return (
    <div className="card history-card">
      <div className="history-header" style={{ marginBottom: "16px" }}>
        <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center" }}>
          <FolderOpen size={18} strokeWidth={2} style={{ marginInlineEnd: 8 }} />
          <span>Saved Analyses</span>
        </h3>
      </div>

      {items.length === 0 ? (
        <p className="muted">No saved analyses yet.</p>
      ) : (
        <div className="table-responsive">
          <table className="table history-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Uploaded At</th>
                <th>Total Rows</th>
                <th>Distinct Groups</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isSelected = item.id === currentId;
                const formattedDate = item.uploadedAt
                  ? new Date(item.uploadedAt).toLocaleString()
                  : "—";

                return (
                  <tr
                    key={item.id}
                    className={isSelected ? "selected" : ""}
                  >
                    <td style={{ fontWeight: isSelected ? 600 : 400 }}>
                      {item.filename}
                    </td>
                    <td className="muted small">{formattedDate}</td>
                    <td>{item.totalRows}</td>
                    <td>{item.distinct}</td>
                    <td>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => onOpen(item.id)}
                          title="Open this analysis"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => onDelete(item.id)}
                          title="Delete this analysis"
                          aria-label="Delete this analysis"
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "6px 8px" }}
                        >
                          <Trash2 size={14} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
