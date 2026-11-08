/** Retry-After is a minimum delay. A 429 alone says nothing about quota type. */
export function providerRetry(error, now = Date.now()) {
  const status = Number(error?.httpStatus ?? error?.status);
  if (status !== 429) return null;
  const value = error.retryAfter ?? error.headers?.get?.('retry-after') ?? error.headers?.['retry-after'];
  const seconds = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  const date = typeof value === 'string' ? Date.parse(value) : NaN;
  const delay = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : Number.isFinite(date) ? Math.max(0, date - now) : 15 * 60_000;
  return { status: 'deferred', reason: 'provider-rate-limited', httpStatus: 429,
    retryAt: new Date(now + delay).toISOString(), limitType: 'unknown', published: false };
}
