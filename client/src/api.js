/**
 * Uploads an error log file to the server and returns grouped results.
 *
 * @param {File} file - Excel or CSV file
 * @param {"normalized"|"message"|"fingerprint"} groupBy - Grouping strategy
 * @returns {Promise<{ total: number, distinct: number, groupBy: string, summary: Array<Object>, groups: Object }>}
 */
export async function uploadFile(file, groupBy = "normalized") {
  const formData = new FormData();
  formData.append("file", file);

  const url = `/api/upload?groupBy=${encodeURIComponent(groupBy)}`;
  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = `Upload failed with status ${response.status}`;
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
