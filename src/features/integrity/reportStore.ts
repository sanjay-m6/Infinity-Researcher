import { UnifiedIntegrityReport } from "./types";

const INTEGRITY_REPORTS_STORAGE_KEY = "rps_integrity_reports_v1";

/**
 * Loads all saved integrity reports from local storage.
 */
export function loadSavedReportsFromStorage(): UnifiedIntegrityReport[] {
  try {
    const raw = localStorage.getItem(INTEGRITY_REPORTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed to load integrity reports from storage:", err);
    return [];
  }
}

/**
 * Saves or updates an integrity report in local storage.
 */
export function saveReportToStorage(report: UnifiedIntegrityReport): void {
  try {
    const existing = loadSavedReportsFromStorage();
    const filtered = existing.filter((r) => r.id !== report.id);
    const updated = [report, ...filtered].slice(0, 50); // Keep last 50 reports
    localStorage.setItem(INTEGRITY_REPORTS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to save integrity report to storage:", err);
  }
}

/**
 * Retrieves a single report by ID.
 */
export function getReportById(id: string): UnifiedIntegrityReport | null {
  const reports = loadSavedReportsFromStorage();
  return reports.find((r) => r.id === id) || null;
}

/**
 * Deletes a report by ID.
 */
export function deleteReportFromStorage(id: string): void {
  try {
    const existing = loadSavedReportsFromStorage();
    const updated = existing.filter((r) => r.id !== id);
    localStorage.setItem(INTEGRITY_REPORTS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to delete integrity report from storage:", err);
  }
}

/**
 * Updates review status for a specific finding inside a report.
 */
export function updateFindingReviewStatus(
  reportId: string,
  findingId: string,
  isReviewed: boolean,
  notes?: string
): UnifiedIntegrityReport | null {
  const reports = loadSavedReportsFromStorage();
  const report = reports.find((r) => r.id === reportId);
  if (!report) return null;

  report.findings = report.findings.map((f) => {
    if (f.id === findingId) {
      return {
        ...f,
        isReviewed,
        status: isReviewed ? "reviewed" : f.status === "reviewed" ? "concern" : f.status,
        reviewedAt: isReviewed ? new Date().toISOString() : null,
        reviewerNotes: notes !== undefined ? notes : f.reviewerNotes,
      };
    }
    return f;
  });

  // Re-compute dimension unreviewed counts
  Object.keys(report.dimensions).forEach((dimKey) => {
    const dim = dimKey as keyof typeof report.dimensions;
    const dimFindings = report.findings.filter((f) => f.dimension === dim);
    report.dimensions[dim].unreviewedCount = dimFindings.filter(
      (f) => !f.isReviewed
    ).length;
  });

  saveReportToStorage(report);
  return report;
}
