/** Deep-merge `over` onto `base` (over wins on leaf strings). */
export function deepMergeMessages<T extends Record<string, unknown>>(base: T, over: Record<string, unknown>): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [key, val] of Object.entries(over)) {
    const prev = out[key];
    if (val != null && typeof val === 'object' && !Array.isArray(val) && prev != null && typeof prev === 'object' && !Array.isArray(prev)) {
      out[key] = deepMergeMessages(prev as Record<string, unknown>, val as Record<string, unknown>);
    } else {
      out[key] = val;
    }
  }
  return out as T;
}
