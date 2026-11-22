import { openDB } from "idb";

const DB_NAME = "error-grouper";
const DB_VERSION = 2;

let dbPromise = null;

/**
 * Opens or upgrades the IndexedDB database for error-grouper.
 * Creates the "uploads" and "savedErrors" stores.
 */
export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("uploads")) {
          const store = db.createObjectStore("uploads", {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("uploadedAt", "uploadedAt");
        }
        if (!db.objectStoreNames.contains("savedErrors")) {
          db.createObjectStore("savedErrors", {
            keyPath: "id",
          });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Persists an upload result and its raw file (Blob) into IndexedDB.
 * Gracefully handles quota errors if rawFile cannot be saved.
 *
 * @param {Object} params
 * @param {string} params.filename
 * @param {"normalized"|"message"|"fingerprint"} params.groupBy
 * @param {Object} params.result - Backend response ({ total, distinct, summary })
 * @param {Blob|File|null} params.rawFile
 * @returns {Promise<number>} - The auto-generated record id
 */
export async function saveUpload({ filename, groupBy, result, rawFile }) {
  const db = await getDB();
  const uploadedAt = new Date().toISOString();

  const record = {
    filename,
    groupBy,
    uploadedAt,
    totalRows: result.total ?? result.totalRows ?? 0,
    distinct: result.distinct ?? 0,
    summary: result.summary ?? [],
    rawFile: rawFile || null,
  };

  try {
    const id = await db.add("uploads", record);
    return id;
  } catch (err) {
    if (record.rawFile) {
      console.warn(
        "Failed to store rawFile in IndexedDB (quota exceeded or serialization error), retrying without rawFile:",
        err
      );
      const recordWithoutFile = { ...record, rawFile: null };
      const id = await db.add("uploads", recordWithoutFile);
      return id;
    }
    throw err;
  }
}

/**
 * Returns all uploads sorted by uploadedAt DESC (newest first).
 *
 * @returns {Promise<Array<Object>>}
 */
export async function listUploads() {
  const db = await getDB();
  try {
    const records = await db.getAllFromIndex("uploads", "uploadedAt");
    return records.reverse();
  } catch (e) {
    const records = await db.getAll("uploads");
    return records.sort((a, b) => {
      const timeA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const timeB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return (b.id || 0) - (a.id || 0);
    });
  }
}

/**
 * Fetches a single upload record by its id.
 *
 * @param {number} id
 * @returns {Promise<Object|undefined>}
 */
export async function getUpload(id) {
  const db = await getDB();
  return await db.get("uploads", id);
}

/**
 * Deletes a single upload record by its id.
 *
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteUpload(id) {
  const db = await getDB();
  return await db.delete("uploads", id);
}

/**
 * Updates the savedErrors record in IndexedDB with assignedTask info.
 *
 * @param {string} id - Error identifier
 * @param {{ gid: string, permalink_url: string }} taskInfo - Asana task info
 * @returns {Promise<{ gid: string, permalink_url: string, assignedAt: string }>}
 */
export async function markErrorAssigned(id, { gid, permalink_url }) {
  const db = await getDB();
  const assignedAt = new Date().toISOString();
  const assignedTask = { gid, permalink_url, assignedAt };

  if (db.objectStoreNames.contains("savedErrors")) {
    const existing = await db.get("savedErrors", id);
    if (existing) {
      existing.assignedTask = assignedTask;
      await db.put("savedErrors", existing);
    } else {
      await db.put("savedErrors", { id, assignedTask });
    }
  }
  return assignedTask;
}

/**
 * Retrieves all assigned tasks map from the savedErrors object store.
 *
 * @returns {Promise<Record<string, { gid: string, permalink_url: string, assignedAt?: string }>>}
 */
export async function getAssignedErrors() {
  const db = await getDB();
  if (!db.objectStoreNames.contains("savedErrors")) {
    return {};
  }
  const records = await db.getAll("savedErrors");
  const assigned = {};
  for (const r of records) {
    if (r && r.id && r.assignedTask) {
      assigned[r.id] = r.assignedTask;
    }
  }
  return assigned;
}

/**
 * Saves or updates a saved error record in IndexedDB.
 *
 * @param {Object} item
 * @returns {Promise<void>}
 */
export async function saveSavedError(item) {
  const db = await getDB();
  if (db.objectStoreNames.contains("savedErrors")) {
    const existing = await db.get("savedErrors", item.id);
    await db.put("savedErrors", { ...existing, ...item });
  }
}

/**
 * Deletes a saved error record from IndexedDB.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteSavedError(id) {
  const db = await getDB();
  if (db.objectStoreNames.contains("savedErrors")) {
    await db.delete("savedErrors", id);
  }
}

/**
 * Clears the entire "uploads" and "savedErrors" object stores.
 *
 * @returns {Promise<void>}
 */
export async function clearAllData() {
  const db = await getDB();
  await db.clear("uploads");
  if (db.objectStoreNames.contains("savedErrors")) {
    await db.clear("savedErrors");
  }
}
