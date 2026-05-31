export const DEFAULT_SITE_NAME = 'Oline Bozor';

/** Public marketplace name from API (server components). */
export async function getPublicSiteName(): Promise<string> {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  let apiUrl = raw.includes(',') ? raw.split(',')[0].trim() : raw;
  if (apiUrl && !/^https?:\/\//i.test(apiUrl)) apiUrl = 'https://' + apiUrl;
  try {
    const res = await fetch(`${apiUrl}/settings/public`, { next: { revalidate: 60 } });
    if (!res.ok) return DEFAULT_SITE_NAME;
    const data = (await res.json()) as { siteName?: string };
    const name = data?.siteName?.trim();
    if (name && !name.includes('{{')) return name;
  } catch {
    // use default
  }
  return DEFAULT_SITE_NAME;
}
