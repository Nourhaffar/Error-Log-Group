import XLSX from "xlsx";

/**
 * Parses an Excel (.xlsx / .xls) or CSV buffer into an array of clean row objects.
 *
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original file name
 * @returns {Array<Object>} Array of row objects with trimmed header keys and string values
 */
export function parseWorkbook(buffer, filename = "") {
  const isCsv = typeof filename === "string" && filename.toLowerCase().endsWith(".csv");
  let workbook;

  if (isCsv) {
    const text = buffer.toString("utf8");
    workbook = XLSX.read(text, { type: "string" });
  } else {
    workbook = XLSX.read(buffer, { type: "buffer" });
  }

  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    return [];
  }

  // Prefer sheet named "errors" (case-insensitive, trimmed), else fallback to first sheet
  const targetSheetName =
    workbook.SheetNames.find(
      (name) => name.trim().toLowerCase() === "errors"
    ) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) {
    return [];
  }

  // Use raw: false so numbers/IDs remain formatted strings, defval: "" for empty cells
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  if (!Array.isArray(rawRows)) {
    return [];
  }

  return rawRows
    .map((row) => {
      const cleanRow = {};
      for (const [key, value] of Object.entries(row)) {
        const trimmedKey = typeof key === "string" ? key.trim() : String(key);
        cleanRow[trimmedKey] =
          value !== undefined && value !== null ? String(value) : "";
      }
      return cleanRow;
    })
    .filter((row) => Object.values(row).some((val) => val.trim() !== ""));
}

/**
 * Groups error rows by mode: "normalized" (default), "message", or "fingerprint".
 *
 * @param {Array<Object>} rows - Array of row objects
 * @param {Object} options
 * @param {"normalized"|"message"|"fingerprint"} [options.groupBy="normalized"]
 * @returns {{ total: number, distinct: number, groupBy: string, summary: Array<Object>, groups: Object }}
 */
export function groupErrors(rows, { groupBy = "normalized" } = {}) {
  const allowedModes = ["normalized", "message", "fingerprint"];
  const mode = allowedModes.includes(groupBy) ? groupBy : "normalized";

  const total = rows.length;
  if (total === 0) {
    return {
      total: 0,
      distinct: 0,
      groupBy: mode,
      summary: [],
      groups: {},
    };
  }

  const groupMap = new Map();

  for (const row of rows) {
    const message = (row["Message"] || "").toString().trim() || "(no message)";
    const fingerprint = (row["Error fingerprint"] || "").toString().trim();
    const request = (row["Request"] || "").toString().trim();
    const endpoint = request.split("?")[0] || "(no endpoint)";

    let key;
    if (mode === "fingerprint" && fingerprint) {
      key = fingerprint;
    } else if (mode === "message") {
      key = message;
    } else {
      key = `${message} | ${endpoint}`;
    }

    let group = groupMap.get(key);
    if (!group) {
      group = {
        key,
        message,
        fingerprint: fingerprint || "",
        module: (row["Module / level"] || "").toString().trim(),
        count: 0,
        firstSeen: "",
        lastSeen: "",
        ips: new Set(),
        endpoints: new Set(),
        sampleRequests: [],
        rows: [],
      };
      groupMap.set(key, group);
    }

    group.count += 1;

    // Time (Beirut) lexicographic ISO comparison
    const time = (row["Time (Beirut)"] || "").toString().trim();
    if (time) {
      if (!group.firstSeen || time < group.firstSeen) {
        group.firstSeen = time;
      }
      if (!group.lastSeen || time > group.lastSeen) {
        group.lastSeen = time;
      }
    }

    // Client IP
    const ip = (row["Client IP"] || "").toString().trim();
    if (ip) {
      group.ips.add(ip);
    }

    // Endpoint
    if (endpoint) {
      group.endpoints.add(endpoint);
    }

    // Sample requests (up to 3 unique non-empty strings)
    if (request && group.sampleRequests.length < 3 && !group.sampleRequests.includes(request)) {
      group.sampleRequests.push(request);
    }

    // Capture first non-empty fingerprint or module if initial row lacked them
    if (!group.fingerprint && fingerprint) {
      group.fingerprint = fingerprint;
    }
    const moduleVal = (row["Module / level"] || "").toString().trim();
    if (!group.module && moduleVal) {
      group.module = moduleVal;
    }

    // Cap stored rows to 200 per group
    if (group.rows.length < 200) {
      group.rows.push(row);
    }
  }

  const summary = [];
  const groups = {};

  for (const [key, group] of groupMap.entries()) {
    const percent = total > 0 ? Number(((group.count / total) * 100).toFixed(1)) : 0;
    summary.push({
      key: group.key,
      message: group.message,
      fingerprint: group.fingerprint,
      module: group.module,
      count: group.count,
      percent,
      firstSeen: group.firstSeen,
      lastSeen: group.lastSeen,
      distinctIps: group.ips.size,
      distinctEndpoints: group.endpoints.size,
      sampleRequests: group.sampleRequests,
    });
    groups[key] = group.rows;
  }

  // Sort summary by count DESC
  summary.sort((a, b) => b.count - a.count);

  return {
    total,
    distinct: summary.length,
    groupBy: mode,
    summary,
    groups,
  };
}
