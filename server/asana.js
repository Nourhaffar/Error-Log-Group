import fs from "fs";
import path from "path";

// Attempt to load .env from workspace root if available
if (typeof process.loadEnvFile === "function") {
  const rootEnv = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(rootEnv)) {
    try {
      process.loadEnvFile(rootEnv);
    } catch {
      // Ignore if cannot load
    }
  }
}

const ASANA_BASE_URL = "https://app.asana.com/api/1.0";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

/**
 * Returns whether Asana integration is configured with required environment variables.
 * @returns {boolean}
 */
export function isAsanaConfigured() {
  return Boolean(process.env.ASANA_PAT && process.env.ASANA_WORKSPACE);
}

// Log warning at module load if env vars are missing, without crashing the server
if (!isAsanaConfigured()) {
  console.warn("⚠️ Warning: ASANA_PAT or ASANA_WORKSPACE is not set. Asana API routes will return 503 until configured.");
}

/**
 * Retrieves cached data if still valid within 5-minute TTL.
 * @param {"assignees"|"projects"} key
 */
function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Sets data in the cache with the current timestamp.
 * @param {"assignees"|"projects"} key
 * @param {any} data
 */
function setCached(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Clears the in-memory cache (useful for testing).
 */
export function clearAsanaCache() {
  cache.clear();
}

/**
 * Wrapper around global fetch for Asana REST API calls.
 * Never logs the PAT or full request bodies.
 *
 * @param {string} endpoint
 * @param {RequestInit} [options]
 * @returns {Promise<any>} Response `data` field
 */
async function asanaFetch(endpoint, options = {}) {
  const pat = process.env.ASANA_PAT;
  const workspace = process.env.ASANA_WORKSPACE;

  if (!pat || !workspace) {
    const err = new Error("Asana configuration missing: ASANA_PAT and ASANA_WORKSPACE are required");
    err.status = 503;
    throw err;
  }

  const url = `${ASANA_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      const authErr = new Error("Asana authentication failed — check ASANA_PAT");
      authErr.status = 502;
      throw authErr;
    }

    let errorMsg = `Asana API error (${response.status})`;
    try {
      const errBody = await response.json();
      if (errBody && Array.isArray(errBody.errors) && errBody.errors.length > 0 && errBody.errors[0]?.message) {
        errorMsg = errBody.errors[0].message;
      }
    } catch {
      // Non-JSON response fallback to status
    }

    const apiErr = new Error(errorMsg);
    apiErr.status = 502;
    throw apiErr;
  }

  const json = await response.json();
  return json.data;
}

/**
 * Lists workspace users/assignees (name, email, gid).
 * Caches results in memory for 5 minutes.
 *
 * @returns {Promise<Array<{ gid: string, name: string, email?: string }>>}
 */
export async function listAssignees() {
  const cached = getCached("assignees");
  if (cached) {
    return cached;
  }

  const workspace = process.env.ASANA_WORKSPACE;
  const data = await asanaFetch(
    `/users?workspace=${encodeURIComponent(workspace)}&opt_fields=name,email`
  );

  setCached("assignees", data);
  return data;
}

/**
 * Lists workspace projects (name, archived, gid).
 * Caches results in memory for 5 minutes.
 *
 * @returns {Promise<Array<{ gid: string, name: string, archived: boolean }>>}
 */
export async function listProjects() {
  const cached = getCached("projects");
  if (cached) {
    return cached;
  }

  const workspace = process.env.ASANA_WORKSPACE;
  const data = await asanaFetch(
    `/projects?workspace=${encodeURIComponent(workspace)}&opt_fields=name,archived`
  );

  setCached("projects", data);
  return data;
}

/**
 * Creates a new task in Asana.
 *
 * @param {Object} params
 * @param {string} params.name - Task title (required)
 * @param {string} [params.notes] - Task notes/description
 * @param {string} params.assigneeGid - User GID (required)
 * @param {string} params.projectGid - Project GID (required)
 * @param {string} [params.dueOn] - Due date YYYY-MM-DD
 * @returns {Promise<{ gid: string, name: string, permalink_url: string }>}
 */
export async function createTask({ name, notes, assigneeGid, projectGid, dueOn }) {
  const workspace = process.env.ASANA_WORKSPACE;

  const dataPayload = {
    workspace,
    name,
    notes: notes || undefined,
    assignee: assigneeGid,
    projects: [projectGid],
    due_on: dueOn || undefined,
  };

  // Omit undefined keys (don't send null/empty strings)
  Object.keys(dataPayload).forEach((key) => {
    if (
      dataPayload[key] === undefined ||
      dataPayload[key] === null ||
      dataPayload[key] === ""
    ) {
      delete dataPayload[key];
    }
  });

  const data = await asanaFetch("/tasks?opt_fields=gid,name,permalink_url", {
    method: "POST",
    body: JSON.stringify({ data: dataPayload }),
  });

  return data;
}
