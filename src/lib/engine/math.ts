// Small numeric helpers shared across the engine.

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
