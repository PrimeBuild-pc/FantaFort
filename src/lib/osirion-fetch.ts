const API = 'https://fnapi.osirion.gg/v1';
const TIMEOUT_MS = 8000;

export const fetchOsirion = (path: string, init: RequestInit = {}) =>
  fetch(`${API}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
