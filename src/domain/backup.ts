/** What we remember about the last full (JSON) backup. Kept in localStorage, not in the journal. */
export interface BackupState {
  /** ISO timestamp of the last JSON export, or null if never */
  at: string | null
  /** How many of your own meals existed at that export */
  meals: number
  /** ISO timestamp until which the reminder stays hidden */
  snoozedUntil: string | null
}

export const NO_BACKUP: BackupState = { at: null, meals: 0, snoozedUntil: null }

/** Meals logged before the first reminder, and between later ones. */
export const BACKUP_MIN_MEALS = 5
export const BACKUP_MAX_AGE_DAYS = 30

export interface BackupAdvice {
  due: boolean
  /** Meals not covered by any backup */
  unsaved: number
  daysSince: number | null
}

/**
 * A backup is due when there are at least five meals no backup has seen and either
 * there has never been a backup or the last one is over 30 days old.
 */
export function backupAdvice(state: BackupState, ownMeals: number, now: Date = new Date()): BackupAdvice {
  const daysSince = state.at ? Math.floor((now.getTime() - new Date(state.at).getTime()) / 86_400_000) : null
  const unsaved = Math.max(0, ownMeals - (state.at ? state.meals : 0))
  const snoozed = !!state.snoozedUntil && new Date(state.snoozedUntil).getTime() > now.getTime()
  const stale = daysSince == null || daysSince >= BACKUP_MAX_AGE_DAYS
  return { due: !snoozed && stale && unsaved >= BACKUP_MIN_MEALS, unsaved, daysSince }
}
