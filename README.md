# Error Log Grouper

A full-stack, lightweight web application for uploading, parsing, aggregating, and inspecting high-volume backend error logs (Excel `.xlsx` / `.xls` or `.csv`).

---

## Features

- **Multi-Format Parsing:** Ingests Excel workbooks (`.xlsx`, `.xls`) and CSV files up to 25 MB using SheetJS (`xlsx`).
- **Flexible Grouping Modes:**
  - `normalized` (Default): Groups by error message + endpoint path (strips query parameters), separating identical errors occurring on different routes.
  - `message`: Groups strictly by the error message text.
  - `fingerprint`: Groups by the unique `Error fingerprint` string (falling back to message + endpoint if missing).
- **Interactive Drill-Down:** Click any group in the summary table to view its individual rows, active non-empty columns, count badges, distinct IP count, and up to 3 sample request strings.
- **Dynamic Non-Empty Column Filtering:** In drill-down mode, hides columns that are empty across all rows in the selected group to maximize readability.
- **Sortable Metrics:** Sort summary rows by Error message, Count, % of total, Fingerprint, First seen, Last seen, Distinct IPs, and Endpoints.
- **Export Summary:** Download aggregated summary results as pretty-printed JSON with one click.
- **Stateless & Database-Free:** In-memory streaming and processing; no authentication or persistent database required.
- **Production-Ready Single Container Serving:** In production (`NODE_ENV=production`), Express statically serves the built client (`client/dist`).

---

## Run Instructions

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Development Mode

1. **Start the Backend API:**
   ```bash
   cd server
   npm install
   npm run dev
   ```
   *Runs Express on [http://localhost:4000](http://localhost:4000)*

2. **Start the Frontend UI:**
   ```bash
   cd client
   npm install
   npm run dev
   ```
   *Runs Vite dev server on [http://localhost:5173](http://localhost:5173) with `/api` proxy to `:4000`*

3. **Open the Application:**
   Open [http://localhost:5173](http://localhost:5173) in your browser, upload an `.xlsx`, `.xls`, or `.csv` error log, choose a grouping mode, and view results.

### Production Build & Single-Port Serving

To build the client and serve everything from the single Node server on port 4000:

```bash
# 1. Build frontend
cd client && npm install && npm run build

# 2. Run server in production mode
cd ../server && npm install
NODE_ENV=production npm start
```
Then visit [http://localhost:4000](http://localhost:4000).

---

## How Grouping Works

The backend parser and grouping logic reside in `server/grouper.js`:

1. **Sheet Resolution & Data Normalization (`parseWorkbook`)**:
   - Searches workbook sheets for one whose name trims to `"errors"` (case-insensitive); falls back to `SheetNames[0]`.
   - Reads data using `sheet_to_json` with `{ defval: "", raw: false }` to ensure all fields remain plain strings without accidental numeric casting or NaN conversion.
   - Trims all column header keys and removes empty trailing phantom rows.

2. **Key Derivation (`groupErrors`)**:
   - `message`: `row["Message"]` trimmed (fallback: `"(no message)"`).
   - `fingerprint`: `row["Error fingerprint"]` trimmed.
   - `request`: `row["Request"]` trimmed.
   - `endpoint`: `request.split("?")[0]` (strips query parameters).
   - Mode resolution:
     - If `groupBy === "fingerprint"` and fingerprint exists &rarr; `key = fingerprint`.
     - Else if `groupBy === "message"` &rarr; `key = message`.
     - Else (default `normalized`) &rarr; `key = `${message} | ${endpoint}``.

3. **Metrics Aggregation**:
   For each group, the parser accumulates:
   - Total row count (`count`) and percentage of total rows (`percent`).
   - First seen and last seen timestamps (`Time (Beirut)` ISO strings compared lexicographically).
   - Set of unique `Client IP` addresses (`distinctIps`).
   - Set of unique endpoint paths (`distinctEndpoints`).
   - Up to 3 unique sample request strings.
   - Stores up to 200 original row records for drill-down inspection.

---

## Repository Structure

```
error-grouper/
├── server/
│   ├── package.json      # Express, Multer, SheetJS, CORS
│   ├── index.js          # Express app + /api routes + static file fallback
│   └── grouper.js        # parseWorkbook() + groupErrors()
├── client/
│   ├── package.json      # React 18, Vite
│   ├── vite.config.js    # Proxy /api -> http://localhost:4000
│   ├── index.html        # HTML entry point
│   └── src/
│       ├── main.jsx      # React root mount
│       ├── App.jsx       # State management and root layout
│       ├── api.js        # Fetch client for /api/upload
│       ├── index.css     # Clean CSS styling (cards, tables, badges, sticky headers)
│       └── components/
│           ├── UploadBox.jsx    # File drag & drop, mode selector, submit
│           ├── StatsCards.jsx   # Total rows, distinct groups, table rows
│           ├── SummaryTable.jsx # Sortable summary table with sticky header
│           └── DrillDown.jsx    # Selected group details & non-empty columns table
├── sample-errors.xlsx    # Sample error log for quick testing
├── sample-errors.csv     # Sample CSV error log
└── README.md
```

---

## API Reference

### `GET /api/health`
Health check endpoint.
- **Response:** `{ "ok": true }`

### `POST /api/upload`
Uploads an error log file and computes grouped statistics.
- **Query Parameter:** `groupBy` (`normalized` | `message` | `fingerprint`, default: `normalized`)
- **Body:** `multipart/form-data` with `file` field.
- **Max File Size:** 25 MB (enforced by Multer).
- **Response (200 OK):**
  ```json
  {
    "total": 215,
    "distinct": 7,
    "groupBy": "normalized",
    "summary": [
      {
        "key": "Error: Product doesn't exist | /catalog/product",
        "message": "Error: Product doesn't exist",
        "fingerprint": "fp_prod_not_found_01",
        "module": "catalog/product",
        "count": 150,
        "percent": 69.8,
        "firstSeen": "2026-11-20T10:00:00+02:00",
        "lastSeen": "2026-11-20T12:29:00+02:00",
        "distinctIps": 30,
        "distinctEndpoints": 1,
        "sampleRequests": [
          "/catalog/product?product_id=0091823&telephone=[REDACTED]&t=0",
          "/catalog/product?product_id=0091823&telephone=[REDACTED]&t=1",
          "/catalog/product?product_id=0091823&telephone=[REDACTED]&t=2"
        ]
      }
    ],
    "groups": {
      "Error: Product doesn't exist | /catalog/product": [ /* up to 200 raw row objects */ ]
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Missing file, unsupported `groupBy`, 0 data rows, or file exceeding 25 MB.
  - `500 Internal Server Error`: Parsing/server failure.
