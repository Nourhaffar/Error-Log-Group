/**
 * Asana client API module for communicating with backend Asana proxy routes.
 * Follows the same error handling pattern as api.js.
 */

async function handleResponse(response, defaultErrorMsg) {
  if (!response.ok) {
    let errorMessage = `${defaultErrorMsg} (status ${response.status})`;
    try {
      const errData = await response.json();
      if (errData && errData.error) {
        errorMessage = errData.error;
      }
    } catch {
      // Non-JSON response, keep default message
    }
    throw new Error(errorMessage);
  }
  return await response.json();
}

/**
 * Fetches the list of assignees for the configured workspace.
 * @returns {Promise<{ assignees: Array<{ gid: string, name: string, email?: string }> }>}
 */
export async function getAssignees() {
  const response = await fetch("/api/asana/assignees");
  return await handleResponse(response, "Failed to fetch assignees");
}

/**
 * Fetches the list of active, non-archived projects for the configured workspace.
 * @returns {Promise<{ projects: Array<{ gid: string, name: string }> }>}
 */
export async function getProjects() {
  const response = await fetch("/api/asana/projects");
  return await handleResponse(response, "Failed to fetch projects");
}

/**
 * Creates a task in Asana via the backend proxy.
 *
 * @param {Object} payload
 * @param {string} payload.name - Task title (required, 1..200 chars)
 * @param {string} [payload.notes] - Task notes/description
 * @param {string} payload.assigneeGid - Asana user GID
 * @param {string} payload.projectGid - Asana project GID
 * @param {string} [payload.dueOn] - Due date YYYY-MM-DD
 * @returns {Promise<{ gid: string, permalink_url: string }>}
 */
export async function createAsanaTask(payload) {
  const response = await fetch("/api/asana/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return await handleResponse(response, "Failed to create Asana task");
}
