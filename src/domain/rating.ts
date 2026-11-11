export const RATING_MAX = 5
export const RATING_STEP = 0.5

/** Snap any number to a valid rating (0.5–5 in 0.5 steps). */
export function normalizeRating(value: number): number {
  const snapped = Math.round(value / RATING_STEP) * RATING_STEP
  return Math.min(RATING_MAX, Math.max(RATING_STEP, snapped))
}

export function isValidRating(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= RATING_STEP &&
    value <= RATING_MAX &&
    Math.abs(value / RATING_STEP - Math.round(value / RATING_STEP)) < 1e-9
  )
}

/** Mean of the non-null ratings, rounded to 2dp for stable comparisons. */
export function averageRating(ratings: (number | null | undefined)[]): number | null {
  const valid = ratings.filter((r): r is number => typeof r === 'number')
  if (valid.length === 0) return null
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length
  return Math.round(mean * 100) / 100
}

/** Ratings always show one decimal: 4 → "4.0", 3.75 → "3.8". */
export function formatRating(value: number | null | undefined): string {
  if (value == null) return '—'
  return (Math.round(value * 10) / 10).toFixed(1)
}

export function ratingLabel(value: number | null): string {
  if (value == null) return 'Not rated'
  if (value >= 5) return 'All-time great'
  if (value >= 4.5) return 'Excellent'
  if (value >= 4) return 'Very good'
  if (value >= 3.5) return 'Good'
  if (value >= 2.5) return 'Fine'
  if (value >= 1.5) return 'Disappointing'
  return 'Avoid'
}
