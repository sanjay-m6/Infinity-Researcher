const RECENT_SEARCHES_STORAGE_KEY = "rps_recent_searches";
const MAX_RECENT_SEARCHES = 6;

/**
 * Retrieves stored search history from localStorage.
 */
export function getRecentSearches(): string[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((q) => typeof q === "string" && q.trim().length > 0).slice(0, MAX_RECENT_SEARCHES);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Appends a new query to recent searches, avoiding duplicates and trimming whitespace.
 */
export function addRecentSearch(query: string): string[] {
  const clean = query.trim();
  // Avoid saving single characters, passwords, or excessively long payloads
  if (!clean || clean.length < 2 || clean.length > 100) {
    return getRecentSearches();
  }

  try {
    const existing = getRecentSearches();
    const updated = [clean, ...existing.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(
      0,
      MAX_RECENT_SEARCHES
    );
    localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Clears all stored search history.
 */
export function clearRecentSearches(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
  } catch {
    // Graceful fallback
  }
}

