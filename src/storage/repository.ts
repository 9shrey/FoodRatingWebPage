import type { JournalExport } from '../domain/schemas'
import type { Food, FoodInput, ID, JournalData, Occasion, OccasionInput, Photo } from '../domain/types'

/** Everything removed by a delete, so it can be restored (undo). */
export interface DeletedSnapshot {
  foods: Food[]
  occasions: Occasion[]
  photos: Photo[]
}

export type ImportMode = 'merge' | 'replace'

export interface ImportResult {
  foods: number
  occasions: number
  photos: number
}

/**
 * Storage boundary. The UI only talks to this interface, so a cloud-synced
 * implementation can replace the IndexedDB one without touching components.
 */
export interface JournalRepository {
  /** Subscribe to all foods and occasions. Called immediately and on every change. */
  subscribe(listener: (data: JournalData) => void, onError: (err: unknown) => void): () => void

  createFood(input: FoodInput): Promise<Food>
  updateFood(id: ID, patch: Partial<Omit<Food, 'id' | 'createdAt'>>): Promise<void>
  /** Deletes the food with all its occasions and their photos. */
  deleteFood(id: ID): Promise<DeletedSnapshot>
  /** Deletes several foods (and their occasions and photos) in one transaction. */
  deleteFoods(ids: ID[]): Promise<DeletedSnapshot>

  logOccasion(input: OccasionInput): Promise<Occasion>
  updateOccasion(id: ID, patch: Partial<Omit<Occasion, 'id' | 'createdAt' | 'foodId'>>): Promise<void>
  deleteOccasion(id: ID): Promise<DeletedSnapshot>

  /** Put back records removed by a delete. */
  restore(snapshot: DeletedSnapshot): Promise<void>

  savePhoto(dataUrl: string): Promise<ID>
  getPhoto(id: ID): Promise<Photo | undefined>
  deletePhoto(id: ID): Promise<void>

  exportAll(): Promise<JournalExport>
  importAll(data: JournalExport, mode: ImportMode): Promise<ImportResult>

  hasSampleData(): Promise<boolean>
  loadSampleData(): Promise<void>
  removeSampleData(): Promise<number>
  clearAll(): Promise<void>
}
