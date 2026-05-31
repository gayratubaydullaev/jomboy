export const MAX_MESSAGE_LENGTH = 4096;

export function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatVariantOptions(options: Record<string, string> | unknown): string {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return '';
  const entries = Object.entries(options as Record<string, string>).filter(([, v]) => v != null && String(v).trim() !== '');
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
}

export function truncateForTelegram(text: string, suffix = '…'): string {
  if (text.length <= MAX_MESSAGE_LENGTH) return text;
  return text.slice(0, MAX_MESSAGE_LENGTH - suffix.length) + suffix;
}
