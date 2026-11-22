import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { parseWorkbook, groupErrors } from "./grouper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Multer memory storage with 25 MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB
  },
});

const ALLOWED_GROUP_BY = ["normalized", "message", "fingerprint"];

// Upload and group endpoint
app.post("/api/upload", (req, res) => {
  upload.single("file")(req, res, (uploadErr) => {
    if (uploadErr instanceof multer.MulterError) {
      if (uploadErr.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File exceeds 25 MB limit" });
      }
      return res.status(400).json({ error: uploadErr.message });
    } else if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const groupBy = (req.query.groupBy || "normalized").toString().trim();
    if (!ALLOWED_GROUP_BY.includes(groupBy)) {
      return res.status(400).json({
        error: `Invalid groupBy parameter '${groupBy}'. Allowed values: ${ALLOWED_GROUP_BY.join(", ")}`,
      });
    }

    try {
      const rows = parseWorkbook(req.file.buffer, req.file.originalname);
      if (!rows || rows.length === 0) {
        return res.status(400).json({ error: "No rows found in file" });
      }

      const result = groupErrors(rows, { groupBy });
      return res.json(result);
    } catch (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ error: err.message || "Failed to process file" });
    }
  });
});

// Production static file serving
if (process.env.NODE_ENV === "production") {
  const clientDistPath = path.resolve(__dirname, "../client/dist");
  app.use(express.static(clientDistPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "Not found" });
    }
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
