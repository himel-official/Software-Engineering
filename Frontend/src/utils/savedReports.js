const STORAGE_KEY = "safevoice.reports";

/**
 * Access keys are stored on the reporter's own device so they can track a
 * report later without ever revealing their identity to the server.
 */
export function listSavedReports() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReport(entry) {
  const reports = listSavedReports().filter(
    (item) => item.reference_number !== entry.reference_number
  );
  reports.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  return reports;
}

export function getAccessKey(referenceNumber) {
  const match = listSavedReports().find(
    (item) => item.reference_number === referenceNumber
  );
  return match?.access_key ?? null;
}

export function removeReport(referenceNumber) {
  const reports = listSavedReports().filter(
    (item) => item.reference_number !== referenceNumber
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}
