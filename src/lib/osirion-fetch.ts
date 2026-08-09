const API = 'https://fnapi.osirion.gg/v1';
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_BYTES = 15_000_000;
const DEFAULT_RETRIES = 2;
const MAX_ENTRIES = 500;

export type OsirionTournamentResponse = { success?: boolean; tournaments: OsirionEvent[] };
export type OsirionLeaderboardResponse = { leaderboard: OsirionLeaderboard };
export type OsirionEvent = {
  eventId: string;
  displayData?: Record<string, unknown>;
  eventWindows: OsirionWindow[];
};
export type OsirionWindow = {
  eventWindowId?: string;
  beginTime: string;
  endTime: string;
  round?: number;
  matchCap?: number | null;
  playlistId?: string;
  scoreLocations: OsirionScoreLocation[];
};
export type OsirionScoreLocation = {
  leaderboardEventId: string;
  leaderboardEventWindowId: string;
  isMain?: boolean;
  scoringRules?: unknown[];
  payoutTables?: unknown[];
};
export type OsirionLeaderboard = {
  totalPages: number;
  updatedAt?: string;
  entries: OsirionEntry[];
};
export type OsirionEntry = {
  teamId?: string | null;
  rank: number;
  pointsEarned: number;
  percentile?: number | null;
  players: { accountId?: string | null; username?: string | null; flagToken?: string | null }[];
  sessionHistory?: { sessionId?: string | null; endTime?: string | null; trackedStats?: Record<string, number> }[];
};

type Limits = { timeoutMs?: number; maxBytes?: number; retries?: number };
type Validator<T> = (value: unknown) => value is T;

const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max = 10_000) => typeof value === 'string' && value.length > 0 && value.length <= max;
const optionalText = (value: unknown, max = 10_000) => value == null || (typeof value === 'string' && value.length <= max);
const number = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown, min: number, max: number) => Number.isInteger(value) && number(value, min, max);
const date = (value: unknown) => text(value, 100) && Number.isFinite(Date.parse(value as string));
const httpsUrl = (value: unknown) => {
  if (value == null || value === '') return true;
  if (!text(value, 2_048)) return false;
  try { return new URL(value as string).protocol === 'https:'; } catch { return false; }
};
const boundedJson = (value: unknown, depth = 0): boolean => {
  if (depth > 8) return false;
  if (value == null || typeof value === 'boolean') return true;
  if (typeof value === 'string') return value.length <= 10_000;
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1_000_000_000_000;
  if (Array.isArray(value)) return value.length <= 1_000 && value.every(item => boundedJson(item, depth + 1));
  return object(value) && Object.keys(value).length <= 200
    && Object.entries(value).every(([key, item]) => key.length <= 200 && boundedJson(item, depth + 1));
};

const validDisplay = (value: unknown) => value == null || object(value)
  && ['longFormatTitle', 'titleLine1', 'titleLine2', 'detailsDescription', 'flavorDescription'].every(key => optionalText(value[key]))
  && ['playlistTileImage', 'loadingScreenImage'].every(key => httpsUrl(value[key]));
const validLocation = (value: unknown): value is OsirionScoreLocation => object(value)
  && text(value.leaderboardEventId, 300) && text(value.leaderboardEventWindowId, 300)
  && (value.isMain == null || typeof value.isMain === 'boolean')
  && (value.scoringRules == null || Array.isArray(value.scoringRules) && value.scoringRules.length <= 500 && boundedJson(value.scoringRules))
  && (value.payoutTables == null || Array.isArray(value.payoutTables) && value.payoutTables.length <= 500 && boundedJson(value.payoutTables));
const validWindow = (value: unknown): value is OsirionWindow => object(value)
  && optionalText(value.eventWindowId, 300) && date(value.beginTime) && date(value.endTime)
  && Date.parse(value.beginTime as string) <= Date.parse(value.endTime as string)
  && (value.round == null || integer(value.round, 0, 100))
  && (value.matchCap == null || integer(value.matchCap, 0, 100))
  && optionalText(value.playlistId, 300)
  && Array.isArray(value.scoreLocations) && value.scoreLocations.length <= 20 && value.scoreLocations.every(validLocation);
const validEvent = (value: unknown): value is OsirionEvent => object(value)
  && text(value.eventId, 300) && validDisplay(value.displayData)
  && Array.isArray(value.eventWindows) && value.eventWindows.length <= 500 && value.eventWindows.every(validWindow);

export const isTournamentResponse: Validator<OsirionTournamentResponse> = (value): value is OsirionTournamentResponse => object(value)
  && (value.success == null || typeof value.success === 'boolean')
  && Array.isArray(value.tournaments) && value.tournaments.length <= 2_000
  && value.tournaments.every(validEvent)
  && value.tournaments.reduce((total, event) => total + event.eventWindows.length, 0) <= 20_000;

const validStats = (value: unknown): value is Record<string, number> => object(value)
  && Object.keys(value).length <= 100
  && Object.entries(value).every(([key, item]) => key.length <= 100 && number(item, -1_000_000_000, 1_000_000_000));
const validSession = (value: unknown) => object(value)
  && optionalText(value.sessionId, 300) && (value.endTime == null || date(value.endTime))
  && (value.trackedStats == null || validStats(value.trackedStats));
const validPlayer = (value: unknown) => object(value)
  && optionalText(value.accountId, 300) && optionalText(value.username, 300) && optionalText(value.flagToken, 100);
const validEntry = (value: unknown): value is OsirionEntry => object(value)
  && optionalText(value.teamId, 1_500) && integer(value.rank, 1, 1_000_000)
  && number(value.pointsEarned, -1_000_000, 1_000_000_000)
  && (value.percentile == null || number(value.percentile, 0, 100))
  && Array.isArray(value.players) && value.players.length <= 4 && value.players.every(validPlayer)
  && (value.sessionHistory == null || Array.isArray(value.sessionHistory) && value.sessionHistory.length <= 100 && value.sessionHistory.every(validSession));

export const isLeaderboardResponse: Validator<OsirionLeaderboardResponse> = (value): value is OsirionLeaderboardResponse => object(value)
  && object(value.leaderboard) && integer(value.leaderboard.totalPages, 0, 1_000)
  && (value.leaderboard.updatedAt == null || date(value.leaderboard.updatedAt))
  && Array.isArray(value.leaderboard.entries) && value.leaderboard.entries.length <= MAX_ENTRIES
  && value.leaderboard.entries.every(validEntry);

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const retryDelay = (response: Response | null, attempt: number) => {
  const seconds = Number(response?.headers.get('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1_000, 5_000) : 250 * 2 ** attempt;
};

async function boundedText(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error('Osirion response exceeds byte limit');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new Error('Osirion response exceeds byte limit'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function fetchOsirionJson<T>(path: string, validate: Validator<T>, init: RequestInit = {}, limits: Limits = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid Osirion path');
  const timeoutMs = limits.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = limits.maxBytes ?? DEFAULT_MAX_BYTES;
  const retries = limits.retries ?? DEFAULT_RETRIES;
  if (!integer(timeoutMs, 1, 60_000) || !integer(maxBytes, 1, 20_000_000) || !integer(retries, 0, 3)) throw new Error('Invalid Osirion limits');

  for (let attempt = 0; attempt <= retries; attempt++) {
    let response: Response | null = null;
    try {
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
      response = await fetch(`${API}${path}`, { ...init, signal });
      if (!response.ok) {
        if (attempt < retries && (response.status === 429 || response.status >= 500)) { await wait(retryDelay(response, attempt)); continue; }
        throw new Error(`Osirion request failed (${response.status})`);
      }
      const body = await boundedText(response, maxBytes);
      let value: unknown;
      try { value = JSON.parse(body); } catch { throw new Error('Osirion returned invalid JSON'); }
      if (!validate(value)) throw new Error('Osirion returned an invalid schema');
      return value;
    } catch (error) {
      if (init.signal?.aborted || attempt >= retries || error instanceof Error && /byte limit|invalid JSON|invalid schema|request failed \(4/.test(error.message)) throw error;
      await wait(retryDelay(response, attempt));
    }
  }
  throw new Error('Osirion request failed');
}
