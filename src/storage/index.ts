import { DexieJournalRepository } from './dexieRepository'
import type { JournalRepository } from './repository'
import { supabase } from './supabaseClient'
import { SupabaseJournalRepository } from './supabaseRepository'

export type { JournalRepository, DeletedSnapshot, ImportMode, ImportResult } from './repository'
export { cloudEnabled, supabase } from './supabaseClient'

/** The journal kept in this browser (IndexedDB). Used directly in local-only mode. */
export const localRepository = new DexieJournalRepository()

/**
 * The app's single repository instance: the signed-in user's Supabase journal when
 * VITE_SUPABASE_URL and a key are set at build time, otherwise this browser's storage.
 */
export const repository: JournalRepository = supabase ? new SupabaseJournalRepository(supabase) : localRepository
