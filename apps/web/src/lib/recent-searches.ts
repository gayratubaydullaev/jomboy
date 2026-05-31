const RECENT_SEARCHES_KEY = 'myshop-recent-searches';
const MAX_RECENT = 5;

export function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string) {
  const q = query.trim();
  if (!q) return;
  const list = getRecentSearches().filter((s) => s !== q);
  list.unshift(q);
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // ignore quota or storage errors
  }
}
