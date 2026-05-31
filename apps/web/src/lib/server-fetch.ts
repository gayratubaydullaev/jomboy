const DEFAULT_REVALIDATE_SEC = 60;

/** Server-side fetch with ISR; returns null when API is unreachable (e.g. CI build). */
export async function fetchJsonOrNull<T>(
  url: string,
  revalidateSec = DEFAULT_REVALIDATE_SEC,
): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: revalidateSec } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  let url = raw.includes(',') ? raw.split(',')[0].trim() : raw;
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url.replace(/\/$/, '');
}

/** Pre-render top product IDs for ISR (empty when API is down at build time). */
export async function generateTopProductIds(limit = 50): Promise<{ id: string }[]> {
  const page = await fetchJsonOrNull<{ data?: { id: string }[] }>(
    `${getApiBaseUrl()}/products?limit=${limit}&sortBy=createdAt&sortOrder=desc`,
    3600,
  );
  return (page?.data ?? []).map((p) => ({ id: p.id }));
}
