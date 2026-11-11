import { useSyncExternalStore } from 'react'
import { NO_BACKUP, type BackupState } from '../domain/backup'
import { toLocalDate } from '../domain/dates'
import type { JournalExport } from '../domain/schemas'
import type { JournalRepository } from '../storage'

const KEY = 'fj:backup'
const listeners = new Set<() => void>()

function read(): BackupState {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...NO_BACKUP, ...(JSON.parse(raw) as Partial<BackupState>) } : NO_BACKUP
  } catch {
    return NO_BACKUP
  }
}

let current = read()

function write(next: BackupState) {
  current = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable: remember for this session only */
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** When the journal was last backed up. Shared by the data menu and the reminder. */
export function useBackupState(): BackupState {
  return useSyncExternalStore(subscribe, () => current)
}

export function snoozeBackupReminder(days = 7) {
  write({ ...current, snoozedUntil: new Date(Date.now() + days * 86_400_000).toISOString() })
}

export function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Download the whole journal as JSON and remember that it happened. */
export async function saveBackupFile(repo: JournalRepository, ownMeals: number): Promise<JournalExport> {
  const payload = await repo.exportAll()
  downloadFile(`food-journal-${toLocalDate()}.json`, JSON.stringify(payload, null, 2), 'application/json')
  write({ at: new Date().toISOString(), meals: ownMeals, snoozedUntil: null })
  return payload
}
