/** Per-browser unsaved drafts for new documents (survive a reload). */
export function readStoredDraft<T>(key: string, isValid: (value: T) => boolean): T | null {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as T) : null;
    return parsed && isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredDraft(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: the draft just isn't kept.
  }
}

export function clearStoredDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage unavailable; nothing to clear.
  }
}
