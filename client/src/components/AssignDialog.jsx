import React, { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { getAssignees, getProjects, createAsanaTask } from "../asanaApi.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSearchInput,
  SelectEmpty,
} from "./ui/select.jsx";

function formatErrorMessage(msg) {
  if (!msg) return "An unexpected error occurred while connecting to Asana";
  if (
    msg.includes("Asana authentication failed") ||
    msg.includes("check ASANA_PAT") ||
    msg.includes("Not Authorized") ||
    msg.includes("401") ||
    msg.includes("403")
  ) {
    return "Asana authentication failed — check ASANA_PAT";
  }
  if (msg.includes("not configured") || msg.includes("503")) {
    return "Asana service is not configured on the server (check ASANA_PAT and ASANA_WORKSPACE)";
  }
  if (msg.includes("Not a Long") || msg.includes("Not a recognized ID")) {
    return "Invalid workspace identifier (check ASANA_WORKSPACE)";
  }
  return msg;
}

/**
 * Modal dialog for assigning a saved error to an employee/project in Asana.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether dialog is visible
 * @param {Object} props.errorItem - The saved error record to assign
 * @param {() => void} props.onClose - Dismiss callback
 * @param {(taskInfo: { gid: string, permalink_url: string }) => void} props.onAssigned - Success callback
 */
export default function AssignDialog({ open, errorItem, onClose, onAssigned }) {
  if (!open || !errorItem) return null;

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [assigneeGid, setAssigneeGid] = useState("");
  const [projectGid, setProjectGid] = useState("");
  const [dueOn, setDueOn] = useState("");

  const [loadingLists, setLoadingLists] = useState(false);
  const [listError, setListError] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [projects, setProjects] = useState([]);

  // Search filter states for dropdowns
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [assigneeSelectOpen, setAssigneeSelectOpen] = useState(false);
  const [projectSelectOpen, setProjectSelectOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Prefill title and notes when dialog opens or errorItem changes
  useEffect(() => {
    const msg = errorItem.message || errorItem.name || "";
    setTitle(msg.slice(0, 200));
    setNotes(
      `${msg}\n\nFingerprint: ${errorItem.fingerprint || "—"}\n\n(Created from Error Log Grouper)`
    );
    setDueOn("");
    setAssigneeGid("");
    setProjectGid("");
    setAssigneeSearch("");
    setProjectSearch("");
    setAssigneeSelectOpen(false);
    setProjectSelectOpen(false);
    setSubmitError(null);
  }, [errorItem]);

  // Filtered lists based on search input
  const filteredAssignees = React.useMemo(() => {
    const q = assigneeSearch.trim().toLowerCase();
    if (!q) return assignees;
    return assignees.filter((u) => {
      const matchName = u.name && u.name.toLowerCase().includes(q);
      const matchEmail = u.email && u.email.toLowerCase().includes(q);
      return matchName || matchEmail;
    });
  }, [assignees, assigneeSearch]);

  const filteredProjects = React.useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name && p.name.toLowerCase().includes(q));
  }, [projects, projectSearch]);

  const selectedAssignee = React.useMemo(
    () => assignees.find((u) => u.gid === assigneeGid),
    [assignees, assigneeGid]
  );

  const selectedProject = React.useMemo(
    () => projects.find((p) => p.gid === projectGid),
    [projects, projectGid]
  );

  // Fetch assignees and projects in parallel when opened
  const loadLists = async () => {
    setLoadingLists(true);
    setListError(null);
    try {
      const [assigneesRes, projectsRes] = await Promise.all([
        getAssignees(),
        getProjects(),
      ]);
      setAssignees(assigneesRes.assignees || []);
      setProjects(projectsRes.projects || []);
    } catch (err) {
      setListError(formatErrorMessage(err.message));
    } finally {
      setLoadingLists(false);
    }
  };

  useEffect(() => {
    loadLists();
  }, []);

  const isSubmitDisabled =
    !title.trim() ||
    !assigneeGid ||
    !projectGid ||
    submitting ||
    loadingLists ||
    Boolean(listError);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitDisabled) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const taskResult = await createAsanaTask({
        name: title.trim(),
        notes: notes || undefined,
        assigneeGid,
        projectGid,
        dueOn: dueOn || undefined,
      });

      onAssigned(taskResult);
      onClose();
    } catch (err) {
      setSubmitError(formatErrorMessage(err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0 }}>Assign Task in Asana</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6b7280",
              borderRadius: "4px",
            }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {loadingLists && (
          <div className="modal-loading" style={{ margin: "16px 0" }}>
            Loading lists…
          </div>
        )}

        {listError && (
          <div className="modal-error" style={{ marginBottom: "16px" }}>
            <p style={{ margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: "6px" }}>
              <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
              <span>{listError}</span>
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadLists}
              style={{ fontSize: "13px", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <RefreshCw size={14} strokeWidth={2} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {!loadingLists && !listError && (
          <form onSubmit={handleSubmit}>
            {/* Task Title */}
            <div>
              <label htmlFor="asana-task-title">Task Title (Required)</label>
              <input
                id="asana-task-title"
                type="text"
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title..."
                required
                disabled={submitting}
              />
            </div>

            {/* Assignee Selection with Search */}
            <div>
              <label htmlFor="asana-assignee">Assignee (Required)</label>
              <Select
                value={assigneeGid}
                onValueChange={(val) => {
                  setAssigneeGid(val);
                  setAssigneeSearch("");
                }}
                open={assigneeSelectOpen}
                onOpenChange={(isOpen) => {
                  setAssigneeSelectOpen(isOpen);
                  if (!isOpen) setAssigneeSearch("");
                }}
                disabled={submitting || loadingLists}
              >
                <SelectTrigger id="asana-assignee" className="w-full mt-1 bg-white">
                  <SelectValue placeholder="Select an employee…">
                    {selectedAssignee
                      ? `${selectedAssignee.name} ${selectedAssignee.email ? `(${selectedAssignee.email})` : ""}`
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectSearchInput
                    placeholder="Search employee by name or email…"
                    value={assigneeSearch}
                    onChange={(e) => setAssigneeSearch(e.target.value)}
                    onClear={() => setAssigneeSearch("")}
                  />
                  {filteredAssignees.length === 0 ? (
                    <SelectEmpty>No employees found</SelectEmpty>
                  ) : (
                    filteredAssignees.map((u) => (
                      <SelectItem key={u.gid} value={u.gid}>
                        {u.name} {u.email ? `(${u.email})` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Project Selection with Search */}
            <div>
              <label htmlFor="asana-project">Project (Required)</label>
              <Select
                value={projectGid}
                onValueChange={(val) => {
                  setProjectGid(val);
                  setProjectSearch("");
                }}
                open={projectSelectOpen}
                onOpenChange={(isOpen) => {
                  setProjectSelectOpen(isOpen);
                  if (!isOpen) setProjectSearch("");
                }}
                disabled={submitting || loadingLists}
              >
                <SelectTrigger id="asana-project" className="w-full mt-1 bg-white">
                  <SelectValue placeholder="Select a project…">
                    {selectedProject ? selectedProject.name : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectSearchInput
                    placeholder="Search project by name…"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    onClear={() => setProjectSearch("")}
                  />
                  {filteredProjects.length === 0 ? (
                    <SelectEmpty>No projects found</SelectEmpty>
                  ) : (
                    filteredProjects.map((p) => (
                      <SelectItem key={p.gid} value={p.gid}>
                        {p.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <div>
              <label htmlFor="asana-due-date">Due Date (Optional)</label>
              <input
                id="asana-due-date"
                type="date"
                value={dueOn}
                onChange={(e) => setDueOn(e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="asana-notes">Notes (Optional)</label>
              <textarea
                id="asana-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes and additional error details..."
                disabled={submitting}
              />
            </div>

            {submitError && (
              <div className="modal-error" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span>{submitError}</span>
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitDisabled}
              >
                {submitting ? "Assigning…" : "Assign Task"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
