import Dexie, { liveQuery, type Table } from 'dexie'
import { migrateFoodV1, migrateOccasionV1 } from '../domain/migrate'
import { EXPORT_FORMAT, EXPORT_VERSION, type JournalExport } from '../domain/schemas'
import { cleanText, newId, normalizeName } from '../domain/text'
import type { Food, FoodInput, ID, JournalData, Occasion, OccasionInput, Photo } from '../domain/types'
import type { DeletedSnapshot, ImportMode, ImportResult, JournalRepository } from './repository'
import { buildSampleData } from './sampleData'

class JournalDB extends Dexie {
  foods!: Table<Food, ID>
  occasions!: Table<Occasion, ID>
  photos!: Table<Photo, ID>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      foods: 'id, name, cuisine, category, favourite, createdAt, isSample',
      occasions: 'id, foodId, date, restaurant, rating, isSample',
      photos: 'id, isSample',
    })
    // v2: ratings out of 5, price tiers, breakfast/lunch/dinner only; drops time,
    // category, tags, ingredients and "would eat again".
    this.version(2)
      .stores({
        foods: 'id, name, cuisine, favourite, createdAt, isSample',
        occasions: 'id, foodId, date, restaurant, rating, isSample',
        photos: 'id, isSample',
      })
      .upgrade(async (tx) => {
        await tx.table('foods').toCollection().modify((f, ref) => {
          ref.value = migrateFoodV1(f)
        })
        await tx.table('occasions').toCollection().modify((o, ref) => {
          ref.value = migrateOccasionV1(o)
        })
      })
  }
}

const now = () => new Date().toISOString()

export class DexieJournalRepository implements JournalRepository {
  private db: JournalDB

  constructor(name = 'food-journal') {
    this.db = new JournalDB(name)
  }

  subscribe(listener: (data: JournalData) => void, onError: (err: unknown) => void) {
    const sub = liveQuery(async () => {
      const [foods, occasions] = await Promise.all([this.db.foods.toArray(), this.db.occasions.toArray()])
      return { foods, occasions }
    }).subscribe({ next: listener, error: onError })
    return () => sub.unsubscribe()
  }

  async createFood(input: FoodInput): Promise<Food> {
    const t = now()
    const food: Food = {
      id: newId(),
      name: cleanText(input.name),
      cuisine: cleanText(input.cuisine ?? ''),
      description: input.description?.trim() ?? '',
      favourite: input.favourite ?? false,
      createdAt: t,
      updatedAt: t,
    }
    if (!food.name) throw new Error('A food needs a name.')
    await this.db.foods.add(food)
    return food
  }

  async updateFood(id: ID, patch: Partial<Omit<Food, 'id' | 'createdAt'>>) {
    const clean = { ...patch }
    if (clean.name !== undefined) {
      clean.name = cleanText(clean.name)
      if (!clean.name) throw new Error('A food needs a name.')
    }
    if (clean.cuisine !== undefined) clean.cuisine = cleanText(clean.cuisine)
    const n = await this.db.foods.update(id, { ...clean, updatedAt: now() })
    if (!n) throw new Error('That food no longer exists.')
  }

  async deleteFood(id: ID) {
    return this.deleteFoods([id])
  }

  async deleteFoods(ids: ID[]): Promise<DeletedSnapshot> {
    return this.db.transaction('rw', this.db.foods, this.db.occasions, this.db.photos, async () => {
      const foods = (await this.db.foods.bulkGet(ids)).filter((f): f is Food => !!f)
      const occasions = await this.db.occasions.where('foodId').anyOf(ids).toArray()
      const photoIds = occasions.map((o) => o.photoId).filter((p): p is string => !!p)
      const photos = (await this.db.photos.bulkGet(photoIds)).filter((p): p is Photo => !!p)
      await this.db.photos.bulkDelete(photoIds)
      await this.db.occasions.bulkDelete(occasions.map((o) => o.id))
      await this.db.foods.bulkDelete(ids)
      return { foods, occasions, photos }
    })
  }

  async logOccasion(input: OccasionInput): Promise<Occasion> {
    const t = now()
    const occasion: Occasion = {
      ...input,
      restaurant: cleanText(input.restaurant),
      location: cleanText(input.location),
      id: newId(),
      createdAt: t,
      updatedAt: t,
    }
    await this.db.transaction('rw', this.db.foods, this.db.occasions, async () => {
      const food = await this.db.foods.get(input.foodId)
      if (!food) throw new Error('That food no longer exists.')
      await this.db.occasions.add(occasion)
    })
    return occasion
  }

  async updateOccasion(id: ID, patch: Partial<Omit<Occasion, 'id' | 'createdAt' | 'foodId'>>) {
    const clean = { ...patch }
    if (clean.restaurant !== undefined) clean.restaurant = cleanText(clean.restaurant)
    await this.db.transaction('rw', this.db.occasions, this.db.photos, async () => {
      const prev = await this.db.occasions.get(id)
      if (!prev) throw new Error('That meal no longer exists.')
      await this.db.occasions.update(id, { ...clean, updatedAt: now() })
      // Clean up a replaced or removed photo.
      if ('photoId' in clean && prev.photoId && prev.photoId !== clean.photoId) {
        await this.db.photos.delete(prev.photoId)
      }
    })
  }

  async deleteOccasion(id: ID): Promise<DeletedSnapshot> {
    return this.db.transaction('rw', this.db.occasions, this.db.photos, async () => {
      const o = await this.db.occasions.get(id)
      if (!o) return { foods: [], occasions: [], photos: [] }
      const photo = o.photoId ? await this.db.photos.get(o.photoId) : undefined
      if (o.photoId) await this.db.photos.delete(o.photoId)
      await this.db.occasions.delete(id)
      return { foods: [], occasions: [o], photos: photo ? [photo] : [] }
    })
  }

  async restore(s: DeletedSnapshot) {
    await this.db.transaction('rw', this.db.foods, this.db.occasions, this.db.photos, async () => {
      await this.db.foods.bulkPut(s.foods)
      await this.db.photos.bulkPut(s.photos)
      await this.db.occasions.bulkPut(s.occasions)
    })
  }

  async savePhoto(dataUrl: string): Promise<ID> {
    const id = newId()
    await this.db.photos.add({ id, dataUrl, createdAt: now() })
    return id
  }

  getPhoto(id: ID) {
    return this.db.photos.get(id)
  }

  async deletePhoto(id: ID) {
    await this.db.photos.delete(id)
  }

  async exportAll(): Promise<JournalExport> {
    const [foods, occasions, photos] = await Promise.all([
      this.db.foods.toArray(),
      this.db.occasions.toArray(),
      this.db.photos.toArray(),
    ])
    return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: now(), foods, occasions, photos }
  }

  async importAll(data: JournalExport, mode: ImportMode): Promise<ImportResult> {
    await this.db.transaction('rw', this.db.foods, this.db.occasions, this.db.photos, async () => {
      if (mode === 'replace') {
        await Promise.all([this.db.foods.clear(), this.db.occasions.clear(), this.db.photos.clear()])
      }
      await this.db.foods.bulkPut(data.foods)
      await this.db.photos.bulkPut(data.photos)
      await this.db.occasions.bulkPut(data.occasions)
    })
    return { foods: data.foods.length, occasions: data.occasions.length, photos: data.photos.length }
  }

  async hasSampleData() {
    return (await this.db.foods.filter((f) => !!f.isSample).count()) > 0
  }

  async loadSampleData() {
    const sample = buildSampleData()
    await this.db.transaction('rw', this.db.foods, this.db.occasions, async () => {
      // Skip sample foods that share a name with one of the user's own foods.
      const existing = new Set((await this.db.foods.filter((f) => !f.isSample).toArray()).map((f) => normalizeName(f.name)))
      const foods = sample.foods.filter((f) => !existing.has(normalizeName(f.name)))
      const ids = new Set(foods.map((f) => f.id))
      await this.db.foods.bulkPut(foods)
      await this.db.occasions.bulkPut(sample.occasions.filter((o) => ids.has(o.foodId)))
    })
  }

  /** Removes sample foods and sample occasions. Returns the number of foods removed. */
  async removeSampleData(): Promise<number> {
    return this.db.transaction('rw', this.db.foods, this.db.occasions, this.db.photos, async () => {
      const foods = await this.db.foods.filter((f) => !!f.isSample).toArray()
      const ids = foods.map((f) => f.id)
      // Real meals the user logged against a sample food keep that food (as a real one).
      const realOnSample = await this.db.occasions
        .where('foodId')
        .anyOf(ids)
        .filter((o) => !o.isSample)
        .toArray()
      const keep = new Set(realOnSample.map((o) => o.foodId))
      const sampleOcc = await this.db.occasions.filter((o) => !!o.isSample).toArray()
      const photoIds = sampleOcc.map((o) => o.photoId).filter((p): p is string => !!p)
      await this.db.photos.bulkDelete(photoIds)
      await this.db.occasions.bulkDelete(sampleOcc.map((o) => o.id))
      const remove = ids.filter((id) => !keep.has(id))
      await this.db.foods.bulkDelete(remove)
      for (const id of keep) await this.db.foods.update(id, { isSample: false })
      return remove.length
    })
  }

  async clearAll() {
    await this.db.transaction('rw', this.db.foods, this.db.occasions, this.db.photos, async () => {
      await Promise.all([this.db.foods.clear(), this.db.occasions.clear(), this.db.photos.clear()])
    })
  }
}
