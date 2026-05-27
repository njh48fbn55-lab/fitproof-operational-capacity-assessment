export function scoreToGaugeRotation(score: number | null | undefined) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return null;
  const clamped = Math.max(0, Math.min(100, Number(score)));
  return -90 + (clamped / 100) * 180;
}
