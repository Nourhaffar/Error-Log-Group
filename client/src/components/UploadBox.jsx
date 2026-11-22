import React, { useState, useRef, useEffect } from "react";
import { FolderOpen, Upload, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select.jsx";

export default function UploadBox({
  onUpload,
  currentFile = null,
  activeGroupBy = "normalized",
  onGroupByChange,
  loading = false,
  reanalyzing = false,
}) {
  const [file, setFile] = useState(currentFile);
  const [groupBy, setGroupBy] = useState(activeGroupBy);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Sync internal state if parent props change
  useEffect(() => {
    if (currentFile && !file) {
      setFile(currentFile);
    }
  }, [currentFile]);

  useEffect(() => {
    setGroupBy(activeGroupBy);
  }, [activeGroupBy]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const validExtensions = [".xlsx", ".xls", ".csv"];
      const lowerName = droppedFile.name.toLowerCase();
      if (validExtensions.some((ext) => lowerName.endsWith(ext))) {
        setFile(droppedFile);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleGroupBySelect = (newMode) => {
    setGroupBy(newMode);
    // If a file is already analyzed and idle, trigger re-analysis automatically on mode change
    if (currentFile && onGroupByChange && !loading && !reanalyzing) {
      onGroupByChange(newMode);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const targetFile = file || currentFile;
    if (!targetFile || loading || reanalyzing) return;
    onUpload(targetFile, groupBy);
  };

  const handleClearFile = (e) => {
    e.stopPropagation();
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const activeDisplayFile = file || currentFile;
  const isBusy = loading || reanalyzing;

  return (
    <div className="card upload-box">
      <form onSubmit={handleSubmit} className="upload-form">
        <div
          className={`dropzone ${isDragOver ? "drag-over" : ""} ${activeDisplayFile ? "has-file" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label={
            activeDisplayFile
              ? `Selected file: ${activeDisplayFile.name}. Click or press Enter to choose a different file.`
              : "Upload error log file. Click or press Enter to choose an Excel or CSV file, or drag and drop here."
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            style={{ display: "none" }}
            tabIndex={-1}
          />
          <div className="dropzone-content">
            <span className="dropzone-icon" style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
              <FolderOpen size={36} strokeWidth={2} />
            </span>
            {activeDisplayFile ? (
              <div className="file-info">
                <div className="file-name-row">
                  <strong>{activeDisplayFile.name}</strong>
                  <span className="file-size">({formatFileSize(activeDisplayFile.size)})</span>
                </div>
                <div className="file-action-hints">
                  <span className="change-hint">Click or drop a different file to replace</span>
                  <button
                    type="button"
                    className="clear-file-btn"
                    onClick={handleClearFile}
                    onKeyDown={(e) => e.stopPropagation()}
                    title="Remove selected file"
                    aria-label="Remove selected file"
                  >
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="dropzone-prompt">
                  <strong>Click to choose a file</strong> or drag and drop here
                </p>
                <p className="helper-text">
                  Supports Excel (.xlsx, .xls) and CSV files up to 25 MB.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="controls-row">
          <div className="form-group">
            <label htmlFor="groupBy-select" className="label">
              Grouping Strategy:
            </label>
            <Select
              value={groupBy}
              onValueChange={handleGroupBySelect}
              disabled={isBusy}
            >
              <SelectTrigger id="groupBy-select" className="w-[380px] max-w-full">
                <SelectValue placeholder="Grouping strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normalized">
                  Group by Message + endpoint (recommended)
                </SelectItem>
                <SelectItem value="message">Group by Message only</SelectItem>
                <SelectItem value="fingerprint">Group by Error fingerprint</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!activeDisplayFile || isBusy}
          >
            <Upload size={16} strokeWidth={2} style={{ marginInlineEnd: 6 }} aria-hidden="true" />
            {loading ? "Processing…" : reanalyzing ? "Re-analyzing…" : activeDisplayFile === currentFile ? "Re-analyze" : "Analyze & Group"}
          </button>
        </div>

        <p className="subtext">
          Sheet preference: searches for a sheet named <strong>"Errors"</strong> (case-insensitive),
          falling back to the first sheet if not found. You can switch grouping modes anytime without re-uploading.
        </p>
      </form>
    </div>
  );
}
