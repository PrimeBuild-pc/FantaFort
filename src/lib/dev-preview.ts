/** Local-only walkthrough. Production builds never turn this on. */
export const DEV_PREVIEW_USER_ID = '00000000-0000-4000-8000-0000000000a1';
export const DEV_PREVIEW_RIVAL_ID = '00000000-0000-4000-8000-0000000000a2';
export const DEV_PREVIEW_LEAGUE_ID = '00000000-0000-4000-8000-0000000000b1';
const STORAGE_KEY = 'fantafort-dev-preview';

export function devPreviewRequested(): boolean {
  return process.env.NODE_ENV === 'development'
    && typeof window !== 'undefined'
    && window.sessionStorage.getItem(STORAGE_KEY) === '1';
}

export function enableDevPreview(): void {
  if (process.env.NODE_ENV !== 'development') return;
  window.sessionStorage.setItem(STORAGE_KEY, '1');
}

export function clearDevPreview(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
