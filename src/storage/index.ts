import { DexieJournalRepository } from './dexieRepository'
import type { JournalRepository } from './repository'

export type { JournalRepository, DeletedSnapshot, ImportMode, ImportResult } from './repository'

/** The app's single repository instance. Swap this for a synced implementation later. */
export const repository: JournalRepository = new DexieJournalRepository()
