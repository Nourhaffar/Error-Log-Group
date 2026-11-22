import React, { useState, useEffect } from "react";
import {
  Bookmark,
  X,
  FolderOpen,
  Check,
  ExternalLink,
  Clock,
  Download,
  Trash2,
  Plus,
  RotateCw,
} from "lucide-react";
import AssignDialog from "./AssignDialog.jsx";
import { getAssignedErrors, markErrorAssigned } from "../db.js";

/**
 * Slide-over side dialog (drawer) for inspecting, managing, and exporting saved errors.
 * Includes Asana task assignment flow and IndexedDB persistence.
 */
export default function SavedErrorsDrawer({
  isOpen,
  onClose,
  savedErrors = [],
  onRemoveError,
  onClearAll,
  onUpdateError,
}) {
  const [assignTarget, setAssignTarget] = useState(null);
  const [assigned, setAssigned] = useState({}); // map id -> { gid, permalink_url }
  const [toastMessage, setToastMessage] = useState(null);

  // On list load / changes, hydrate assigned state from IndexedDB and savedErrors records
  useEffect(() => {
    let isMounted = true;
    async function hydrateAssigned() {
      try {
        const fromDB = await getAssignedErrors();
        if (!isMounted) return;
        const merged = { ...fromDB };
        for (const item of savedErrors) {
          if (item && item.id && item.assignedTask && !merged[item.id]) {
            merged[item.id] = item.assignedTask;
          }
        }
        setAssigned(merged);
      } catch (err) {
        console.error("Failed to hydrate assigned state from IndexedDB:", err);
      }
    }
    hydrateAssigned();
    return () => {
      isMounted = false;
    };
  }, [savedErrors]);

  if (!isOpen) return null;

  const handleExportJson = () => {
    if (savedErrors.length === 0) return;
    const jsonString = JSON.stringify(savedErrors, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `saved-errors-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        className="drawer-panel"
        onClick={(e) => e.stopPropagation()}
        aria-label="Saved Errors Panel"
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <span className="drawer-icon" style={{ display: "inline-flex", alignItems: "center" }}>
              <Bookmark size={18} strokeWidth={2} />
            </span>
            <h3 className="drawer-title">Saved Errors</h3>
            <span className="badge badge-primary">{savedErrors.length}</span>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close saved errors panel"
            title="Close"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="drawer-body">
          {savedErrors.length === 0 ? (
            <div className="drawer-empty-state">
              <span className="drawer-empty-icon" style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
                <FolderOpen size={44} strokeWidth={2} />
              </span>
              <h4>No Saved Errors Yet</h4>
              <p>
                Click the <strong>"Save"</strong> button beside any record in the{" "}
                <strong>Error Log Records</strong> table to save it here for later review.
              </p>
            </div>
          ) : (
            <div className="saved-errors-list">
              {savedErrors.map((item, index) => {
                const isAssigned = Boolean(assigned[item.id]);
                const taskInfo = assigned[item.id];

                return (
                  <div key={item.id || index} className="saved-error-card">
                    <div className="saved-card-top">
                      <span className="saved-item-index">#{index + 1}</span>
                      <div className="saved-card-actions">
                        {isAssigned && (
                          <a
                            href={taskInfo.permalink_url}
                            target="_blank"
                            rel="noreferrer"
                            className="saved-action-btn saved-asana-btn"
                            title="Open task in Asana"
                            aria-label="Open task in Asana"
                          >
                            <ExternalLink size={14} strokeWidth={2} />
                          </a>
                        )}
                        <button
                          type="button"
                          className="saved-action-btn saved-assign-btn"
                          onClick={() => setAssignTarget(item)}
                          title={isAssigned ? "Reassign task in Asana" : "Assign task in Asana"}
                          aria-label={isAssigned ? "Reassign task in Asana" : "Assign task in Asana"}
                        >
                          {isAssigned ? (
                            <RotateCw size={14} strokeWidth={2} />
                          ) : (
                            <Plus size={15} strokeWidth={2} />
                          )}
                        </button>
                        <button
                          type="button"
                          className="saved-action-btn saved-remove-btn"
                          onClick={() => onRemoveError(item.id)}
                          title="Remove from saved errors"
                          aria-label="Remove from saved errors"
                        >
                          <Trash2 size={15} strokeWidth={2} />
                        </button>
                      </div>
                    </div>

                    {/* 1. Error Name */}
                    <div className="saved-field-group">
                      <span className="saved-field-label">Error Name</span>
                      <h4 className="saved-error-name">{item.name || "(no error message)"}</h4>
                    </div>

                    {/* 2. Route that caused the error */}
                    <div className="saved-field-group">
                      <span className="saved-field-label">Route</span>
                      <div className="saved-route-chip">
                        <code>{item.route || "(no route)"}</code>
                      </div>
                    </div>

                    {/* 3. Error Time */}
                    <div className="saved-field-group">
                      <span className="saved-field-label">Time</span>
                      <div className="saved-time-val">
                        <span className="time-icon" style={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle" }}>
                          <Clock size={14} strokeWidth={2} style={{ marginInlineEnd: 4 }} />
                        </span>
                        <span>{item.time || "—"}</span>
                      </div>
                    </div>

                    {/* Extra metadata if available */}
                    {(item.fingerprint || item.ip) && (
                      <div className="saved-extra-meta">
                        {item.fingerprint && (
                          <span className="badge badge-light" title="Error Fingerprint">
                            FP: {item.fingerprint}
                          </span>
                        )}
                        {item.ip && (
                          <span className="badge badge-light" title="Client IP">
                            IP: {item.ip}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        {savedErrors.length > 0 && (
          <div className="drawer-footer">
            <button
              type="button"
              className="btn btn-primary btn-export-saved"
              onClick={handleExportJson}
            >
              <Download size={16} strokeWidth={2} style={{ marginInlineEnd: 6 }} />
              <span>Export Saved (JSON)</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-clear-saved"
              onClick={onClearAll}
            >
              <Trash2 size={16} strokeWidth={2} style={{ marginInlineEnd: 6 }} />
              <span>Clear All</span>
            </button>
          </div>
        )}

        {/* Asana Assignment Modal Dialog */}
        <AssignDialog
          open={Boolean(assignTarget)}
          errorItem={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={async (info) => {
            if (!assignTarget) return;
            const targetId = assignTarget.id;
            try {
              await markErrorAssigned(targetId, info);
            } catch (err) {
              console.error("Failed to mark error as assigned in IndexedDB:", err);
            }
            setAssigned((m) => ({ ...m, [targetId]: info }));
            if (typeof onUpdateError === "function") {
              onUpdateError(targetId, { assignedTask: info });
            }
            setToastMessage("Task created in Asana");
            setTimeout(() => {
              setToastMessage(null);
            }, 3000);
          }}
        />

        {/* Transient feedback toast */}
        {toastMessage && (
          <div className="toast" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Check size={14} strokeWidth={2} />
            <span>{toastMessage}</span>
          </div>
        )}
      </aside>
    </div>
  );
}
