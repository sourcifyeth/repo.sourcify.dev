// Contracts that this browser opened from the home page search. Stored in localStorage only.

export interface RecentSearch {
  address: string;
  chainId: string;
}

const STORAGE_KEY = "sourcify-repo:recent-searches";
const MAX_RECENT_SEARCHES = 5;

export function getRecentSearches(): RecentSearch[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item?.address === "string" && typeof item?.chainId === "string")
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

/** Puts the search first. Removes an older entry for the same contract. */
export function addRecentSearch(search: RecentSearch): RecentSearch[] {
  const isSame = (item: RecentSearch) =>
    item.chainId === search.chainId && item.address.toLowerCase() === search.address.toLowerCase();
  const next = [search, ...getRecentSearches().filter((item) => !isSame(item))].slice(0, MAX_RECENT_SEARCHES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be blocked (private mode). Recent searches are only a convenience.
  }
  return next;
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // See above
  }
}
