import React, { useState, useRef } from "react";

export default function UploadBox({ onUpload, loading }) {
  const [file, setFile] = useState(null);
  const [groupBy, setGroupBy] = useState("normalized");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file || loading) return;
    onUpload(file, groupBy);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="card upload-box">
      <form onSubmit={handleSubmit} className="upload-form">
        <div
          className={`dropzone ${isDragOver ? "drag-over" : ""} ${file ? "has-file" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <div className="dropzone-content">
            <span className="dropzone-icon">📁</span>
            {file ? (
              <div className="file-info">
                <strong>{file.name}</strong>
                <span className="file-size">({formatFileSize(file.size)})</span>
                <span className="change-hint">Click or drop to replace</span>
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
            <select
              id="groupBy-select"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="select-input"
              disabled={loading}
            >
              <option value="normalized">
                Group by Message + endpoint (recommended)
              </option>
              <option value="message">Group by Message only</option>
              <option value="fingerprint">Group by Error fingerprint</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!file || loading}
          >
            {loading ? "Processing…" : "Analyze & Group"}
          </button>
        </div>

        <p className="subtext">
          Sheet preference: searches for a sheet named <strong>"Errors"</strong> (case-insensitive),
          falling back to the first sheet if not found.
        </p>
      </form>
    </div>
  );
}
