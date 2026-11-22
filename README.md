# Error Log Grouper

A full-stack, lightweight web application for uploading, parsing, aggregating, and inspecting high-volume backend error logs (Excel `.xlsx` / `.xls` or `.csv`).

---

## Features

- **Multi-Format Parsing:** Ingests Excel workbooks (`.xlsx`, `.xls`) and CSV files up to 25 MB using SheetJS (`xlsx`).
- **Flexible Grouping Modes:**
  - `normalized` (Default): Groups by error message + endpoint path (strips query parameters), separating identical errors occurring on different routes.
  - `message`: Groups strictly by the error message text.
  - `fingerprint`: Groups by the unique `Error fingerprint` string (falling back to message + endpoint if missing).
- **Dedicated Drill-Down Page:**
  - Clicking any row in the summary table opens a **full separate page** dedicated to that error group.
  - Features breadcrumb navigation (`← Summary Table / [Group Key]`), deep linking with browser Back/Forward history support.
  - Overview cards displaying occurrences, % of total log, distinct IPs, distinct endpoints, module/level, timestamps, and error fingerprint (with one-click copy).
  - Displays up to 3 sample request strings.
  - Dynamic non-empty column filtering: hides columns that are empty across all rows in the group.
  - "Export Group Rows (JSON)" button to download records for just the selected group.
- **Saved Errors Side-Drawer (Slide-Over Panel):**
  - Save individual errors for later investigation by clicking the **"Save"** button beside each row in **Error Log Records**.
  - Opens a slide-over panel on the right displaying:
    - **Error Name** (message)
    - **Error Time** (`Time (Beirut)` timestamp)
    - **Route that caused the error** (`Request` endpoint & query)
  - Supports one-click item removal, clearing all saved records, and exporting saved errors as JSON.
  - Saved errors persist in browser `localStorage` across page navigations and re-analyses.
- **Repeatable & Multi-Analysis Flow:**
  - In-memory file retention allows switching between `normalized`, `message`, and `fingerprint` modes anytime with one click.
  - Grouping results are cached in memory for instant mode switching.
- **Sortable Summary Table:** Sort summary rows by Error message, Count, % of total, Fingerprint, First seen, Last seen, Distinct IPs, and Endpoints.
- **Export Summary:** Download aggregated summary results as pretty-printed JSON with one click.
- **Client-Side Persistence & History:**
  - Persists analysis results and raw uploads into browser IndexedDB automatically.
  - History panel to switch between past uploads or delete specific analyses.
  - "Clear all data" button to wipe all persisted data with confirmation.
- **Stateless & Database-Free Backend:** In-memory streaming and processing on the server; no server database or external storage required.
- **Production-Ready Single Container Serving:** In production (`NODE_ENV=production`), Express statically serves the built client (`client/dist`).

---

## UI

- **Icons**: Icons are powered by `lucide-react` across all components (tree-shakeable imports).
- **Dropdowns**: Dropdowns use the shadcn/ui `Select` component built on `@radix-ui/react-select` for improved keyboard navigation, accessibility, and RTL compatibility.
- **Tailwind CSS**: Tailwind is used only for the Select component and shadcn utilities; the rest of the app keeps its existing custom CSS.

> *Note*: shadcn/ui component files are vendored directly under `client/src/components/ui/` and can be edited freely.

---

## Persistence

The application includes fully client-side persistence powered by **IndexedDB** (`idb`):

- **What is stored:**
  - Analysis metadata (`filename`, `groupBy` mode, `uploadedAt` ISO timestamp, `totalRows`, `distinct` count).
  - Full aggregated `summary` array (all metrics and sample requests).
  - Original uploaded file (`rawFile` as a Blob for re-analysis).
  - *Note:* Per-row detail (`groups`) is not persisted to keep storage lightweight; full rows can be re-inspected by re-uploading the file.
- **Where:**
  - Stored directly in the browser's IndexedDB database named `"error-grouper"` (object store: `"uploads"`).
  - No server-side storage or database is used; all data remains entirely local to your machine.
- **Device & Browser Scope:**
  - Persisted analyses are **per-browser and per-device**. They survive page reloads, tab closes, and computer restarts.
  - Clicking **"Clear all data"** (with confirmation) wipes the entire IndexedDB store and resets the UI.
  - Individual analyses can also be removed one-by-one via the **[Delete]** button in the History list.
- **Incognito / Private Browsing:**
  - Private / Incognito browsing sessions utilize a temporary, isolated IndexedDB store that is wiped automatically when all private windows are closed.

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

## Asana Integration ("Assign to Asana" Flow)

Saved errors can be assigned directly to employees and projects in Asana from the **Saved Errors** side drawer.

### Environment Variables

Configure Asana credentials in your environment or via a `.env` file at the repository root or in `server/.env` (see `.env.example`):

| Variable | Description |
| :--- | :--- |
| `ASANA_PAT` | Asana Personal Access Token (PAT) used by the backend to authenticate with Asana API. |
| `ASANA_WORKSPACE` | Asana Workspace GID (numeric ID string) representing the target organization or workspace. |
| `PORT` | Optional server port (defaults to `4000`). |

> [!IMPORTANT]
> **Server-Side Security**: The `ASANA_PAT` is **strictly kept server-side** and is never passed to or exposed in the frontend browser bundle or network responses. The frontend only talks to the backend proxy endpoints. If Asana environment variables are missing, the rest of the application functions normally, while Asana routes safely return `503 Service Unavailable`.

### How to Obtain Asana Credentials

1. **Personal Access Token (`ASANA_PAT`)**:
   - Log in to your Asana account.
   - Go to the [Asana Developer App Management Console](https://app.asana.com/0/developer-console).
   - Click **+ New access token**, give it a name (e.g. `Error Log Grouper`), and copy the generated token string.
2. **Workspace GID (`ASANA_WORKSPACE`)**:
   - Query Asana's workspaces endpoint with your new token in your terminal:
     ```bash
     curl -H "Authorization: Bearer <YOUR_ASANA_PAT>" https://app.asana.com/api/1.0/workspaces
     ```
   - In the JSON response, locate your workspace's `"gid"` (e.g. `1201234567890123`). Copy this numerical string into `ASANA_WORKSPACE`.

### Asana Endpoints

The backend provides authenticated proxy routes with in-memory 5-minute caching:

- `GET /api/asana/assignees`: Returns workspace users (`{ assignees: [{ gid, name, email }] }`).
- `GET /api/asana/projects`: Returns active, non-archived workspace projects (`{ projects: [{ gid, name }] }`).
- `POST /api/asana/tasks`: Validates inputs (`name`, `assigneeGid`, `projectGid`, optional `notes`, `dueOn`) and creates an Asana task, returning `{ gid, permalink_url }`.

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
├── .env.example          # Environment variable template (ASANA_PAT, ASANA_WORKSPACE, PORT)
├── server/
│   ├── package.json      # Express, Multer, SheetJS, CORS
│   ├── index.js          # Express app + /api routes + static file fallback
│   ├── asana.js          # Asana REST API client wrapper & in-memory cache
│   └── grouper.js        # parseWorkbook() + groupErrors()
├── client/
│   ├── package.json      # React 18, Vite, Radix Select, Lucide
│   ├── vite.config.js    # Proxy /api -> http://localhost:4000
│   ├── tailwind.config.js # Tailwind configuration for shadcn/ui tokens
│   ├── postcss.config.js # PostCSS configuration (tailwindcss, autoprefixer)
│   ├── index.html        # HTML entry point (English, RTL-safe)
│   └── src/
│       ├── main.jsx      # React root mount
│       ├── App.jsx       # State management & page routing (Summary <-> DrillDown)
│       ├── api.js        # Fetch client for /api/upload
│       ├── asanaApi.js   # Fetch client for Asana endpoints (/api/asana/*)
│       ├── db.js         # Client-side IndexedDB persistence layer (idb: uploads & savedErrors)
│       ├── index.css     # Clean CSS styling (cards, tables, badges, modals, toasts, Tailwind base)
│       ├── lib/
│       │   └── utils.js  # cn() classnames merger (clsx + tailwind-merge)
│       └── components/
│           ├── ui/
│           │   └── select.jsx         # Vendored shadcn/ui Select (Radix-based, RTL-safe)
│           ├── UploadBox.jsx          # File drag & drop, mode selector, submit
│           ├── StatsCards.jsx         # Total rows, distinct groups, table rows
│           ├── HistoryList.jsx        # Persisted analysis list & actions (Open, Delete)
│           ├── SummaryTable.jsx       # Sortable summary table with click-to-drill-down
│           ├── DrillDown.jsx          # Dedicated Drill-Down page view
│           ├── SavedErrorsDrawer.jsx  # Slide-over panel for saved errors with Asana assign button
│           └── AssignDialog.jsx       # Modal dialog for assigning saved errors to Asana
├── sample-errors.xlsx    # Sample error log for quick testing
├── sample-errors.csv     # Sample CSV error log
└── README.md
```
