const STORAGE_KEY = 'predictor_device_id';

/**
 * Returns a stable anonymous device ID.
 * Generated once using crypto.randomUUID() and persisted in localStorage.
 * This is the user's permanent identity across sessions on this device.
 */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // localStorage unavailable (private browsing some cases) — return a temporary ID.
    // This user won't have persistence, but the app won't crash.
    return crypto.randomUUID();
  }
}

export const DEVICE_ID_HEADER = 'X-Device-ID';
