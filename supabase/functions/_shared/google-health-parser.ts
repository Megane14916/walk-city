function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stepCount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string" || !/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseDailySteps(payload: unknown): number {
  if (!isObject(payload) || !Array.isArray(payload.rollupDataPoints)) {
    throw new Error("INVALID_GOOGLE_HEALTH_RESPONSE");
  }
  let total = 0;
  for (const point of payload.rollupDataPoints) {
    if (!isObject(point)) throw new Error("INVALID_GOOGLE_HEALTH_RESPONSE");
    if (point.steps === undefined) continue;
    if (!isObject(point.steps)) throw new Error("INVALID_GOOGLE_HEALTH_RESPONSE");
    const count = stepCount(point.steps.countSum);
    if (count === null || total > Number.MAX_SAFE_INTEGER - count) {
      throw new Error("INVALID_GOOGLE_HEALTH_RESPONSE");
    }
    total += count;
  }
  return total;
}

