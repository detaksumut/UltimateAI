const DAY_MS = 86_400_000;
const BROKER_GRACE_MS = 4 * 60 * 60 * 1000;

function toMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function lastSundayUtc(year, monthIndex, hour = 1) {
  const date = new Date(Date.UTC(year, monthIndex + 1, 0, hour, 0, 0, 0));
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.getTime();
}

export function isEuSummerTime(value = Date.now()) {
  const ms = toMs(value);
  if (!Number.isFinite(ms)) return false;
  const year = new Date(ms).getUTCFullYear();
  return ms >= lastSundayUtc(year, 2) && ms < lastSundayUtc(year, 9);
}

export function getMarketSession(now = Date.now()) {
  const ms = toMs(now);
  const date = new Date(Number.isFinite(ms) ? ms : Date.now());
  const day = date.getUTCDay();
  const closeHourUtc = isEuSummerTime(date.getTime()) ? 21 : 22;
  const marketClosed = day === 6
    || (day === 0 && date.getUTCHours() < closeHourUtc)
    || (day === 5 && date.getUTCHours() >= closeHourUtc);
  const todayClose = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    closeHourUtc,
    0,
    0,
    0,
  );
  const daysSinceFriday = (day - 5 + 7) % 7;
  return {
    marketClosed,
    reason: marketClosed ? 'WEEKEND' : 'OPEN',
    closeHourUtc,
    lastCloseAt: marketClosed ? todayClose - daysSinceFriday * DAY_MS : null,
  };
}

export function resolveMarketAwareFreshness({
  ageMs,
  maxAgeMs,
  lastCandleAt,
  now = Date.now(),
} = {}) {
  const age = Number(ageMs);
  const maxAge = Number(maxAgeMs);
  if (Number.isFinite(age) && Number.isFinite(maxAge) && age <= maxAge) {
    return { status: 'FRESH', marketClosed: false, sessionNote: null };
  }

  const session = getMarketSession(now);
  if (!session.marketClosed || session.lastCloseAt == null) {
    return {
      status: 'STALE',
      marketClosed: session.marketClosed === true,
      sessionNote: null,
    };
  }

  const candleMs = toMs(lastCandleAt);
  const lowerBound = session.lastCloseAt - (Number.isFinite(maxAge) ? maxAge : 0) - BROKER_GRACE_MS;
  const upperBound = session.lastCloseAt + BROKER_GRACE_MS;
  const fromLastSession = Number.isFinite(candleMs)
    && candleMs >= lowerBound
    && candleMs <= upperBound;

  return {
    status: fromLastSession ? 'FRESH' : 'STALE',
    marketClosed: true,
    marketClosedAt: new Date(session.lastCloseAt).toISOString(),
    sessionNote: fromLastSession
      ? 'Market tutup (weekend). Candle terakhir sesi Jumat tetap dipakai; tidak ada candle baru.'
      : 'Market tutup (weekend) tetapi candle terakhir bukan dari sesi terakhir; data ditolak.',
  };
}
