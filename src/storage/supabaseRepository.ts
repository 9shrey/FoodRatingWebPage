import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { EXPORT_FORMAT, EXPORT_VERSION, type JournalExport } from '../domain/schemas'
import { cleanText, newId, normalizeName } from '../domain/text'
import type { Food, FoodInput, ID, JournalData, Occasion, OccasionInput, Photo } from '../domain/types'
import type { DeletedSnapshot, ImportMode, ImportResult, JournalRepository } from './repository'
import { buildSampleData } from './sampleData'

const now = () => new Date().toISOString()
const PAGE = 1000
const BUCKET = 'photos'

type Table = 'foods' | 'occasions'

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',', 2)
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg'
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/**
 * Journal stored in Supabase (Postgres + Storage), scoped to the signed-in user by RLS.
 * Keeps an in-memory copy of all rows so the UI reads synchronously, and refreshes it
 * on realtime changes and when the tab regains focus.
 */
export class SupabaseJournalRepository implements JournalRepository {
  private foods = new Map<ID, Food>()
  private occasions = new Map<ID, Occasion>()
  private listeners = new Set<(d: JournalData) => void>()
  private channel: RealtimeChannel | null = null
  private refetchTimer: ReturnType<typeof setTimeout> | null = null
  private sb: SupabaseClient

  constructor(sb: SupabaseClient) {
    this.sb = sb
  }

  // ---- reading -------------------------------------------------------------

  private async userId(): Promise<string> {
    const { data } = await this.sb.auth.getSession()
    const id = data.session?.user.id
    if (!id) throw new Error('You’re signed out. Sign in again to save changes.')
    return id
  }

  private async fetchTable<T>(table: Table): Promise<T[]> {
    const out: T[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.sb
        .from(table)
        .select('data')
        .order('id')
        .range(from, from + PAGE - 1)
      if (error) throw error
      out.push(...data.map((r) => r.data as T))
      if (data.length < PAGE) return out
    }
  }

  private async refetch() {
    const [foods, occasions] = await Promise.all([this.fetchTable<Food>('foods'), this.fetchTable<Occasion>('occasions')])
    this.foods = new Map(foods.map((f) => [f.id, f]))
    this.occasions = new Map(occasions.map((o) => [o.id, o]))
    this.emit()
  }

  private snapshot(): JournalData {
    return { foods: [...this.foods.values()], occasions: [...this.occasions.values()] }
  }

  private emit() {
    const d = this.snapshot()
    this.listeners.forEach((l) => l(d))
  }

  /** Debounced refetch so a burst of realtime events causes one reload. */
  private scheduleRefetch(onError?: (err: unknown) => void) {
    if (this.refetchTimer) clearTimeout(this.refetchTimer)
    this.refetchTimer = setTimeout(() => {
      this.refetch().catch((e) => onError?.(e))
    }, 400)
  }

  subscribe(listener: (data: JournalData) => void, onError: (err: unknown) => void) {
    this.listeners.add(listener)
    this.refetch().catch(onError)

    if (!this.channel) {
      this.channel = this.sb
        .channel('journal')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'foods' }, () => this.scheduleRefetch())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'occasions' }, () => this.scheduleRefetch())
        .subscribe()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') this.scheduleRefetch()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      this.listeners.delete(listener)
      document.removeEventListener('visibilitychange', onVisible)
      if (this.listeners.size === 0 && this.channel) {
        void this.sb.removeChannel(this.channel)
        this.channel = null
      }
    }
  }

  // ---- low-level writes ------------------------------------------------------

  private async upsert(table: Table, rows: (Food | Occasion)[]) {
    if (!rows.length) return
    const uid = await this.userId()
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r) => ({ user_id: uid, id: r.id, data: r, updated_at: now() }))
      const { error } = await this.sb.from(table).upsert(chunk, { onConflict: 'user_id,id' })
      if (error) throw error
    }
  }

  private async remove(table: Table, ids: ID[]) {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await this.sb.from(table).delete().in('id', ids.slice(i, i + 200))
      if (error) throw error
    }
  }

  private async putFoods(foods: Food[]) {
    await this.upsert('foods', foods)
    foods.forEach((f) => this.foods.set(f.id, f))
  }

  private async putOccasions(occasions: Occasion[]) {
    await this.upsert('occasions', occasions)
    occasions.forEach((o) => this.occasions.set(o.id, o))
  }

  private async dropFoods(ids: ID[]) {
    await this.remove('foods', ids)
    ids.forEach((id) => this.foods.delete(id))
  }

  private async dropOccasions(ids: ID[]) {
    await this.remove('occasions', ids)
    ids.forEach((id) => this.occasions.delete(id))
  }

  private async photoPath(id: ID) {
    return `${await this.userId()}/${id}`
  }

  private async putPhotos(photos: Photo[]) {
    for (const p of photos) {
      const { error } = await this.sb.storage
        .from(BUCKET)
        .upload(await this.photoPath(p.id), dataUrlToBlob(p.dataUrl), { upsert: true })
      if (error) throw error
    }
  }

  private async dropPhotos(ids: ID[]) {
    if (!ids.length) return
    const paths = await Promise.all(ids.map((id) => this.photoPath(id)))
    const { error } = await this.sb.storage.from(BUCKET).remove(paths)
    if (error) throw error
  }

  // ---- JournalRepository -----------------------------------------------------

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
    await this.putFoods([food])
    this.emit()
    return food
  }

  async updateFood(id: ID, patch: Partial<Omit<Food, 'id' | 'createdAt'>>) {
    const prev = this.foods.get(id)
    if (!prev) throw new Error('That food no longer exists.')
    const clean = { ...patch }
    if (clean.name !== undefined) {
      clean.name = cleanText(clean.name)
      if (!clean.name) throw new Error('A food needs a name.')
    }
    if (clean.cuisine !== undefined) clean.cuisine = cleanText(clean.cuisine)
    await this.putFoods([{ ...prev, ...clean, updatedAt: now() }])
    this.emit()
  }

  deleteFood(id: ID) {
    return this.deleteFoods([id])
  }

  async deleteFoods(ids: ID[]): Promise<DeletedSnapshot> {
    const idSet = new Set(ids)
    const foods = ids.map((id) => this.foods.get(id)).filter((f): f is Food => !!f)
    const occasions = [...this.occasions.values()].filter((o) => idSet.has(o.foodId))
    const photoIds = occasions.map((o) => o.photoId).filter((p): p is string => !!p)
    // Keep photos for undo before deleting them.
    const photos = (await Promise.all(photoIds.map((p) => this.getPhoto(p)))).filter((p): p is Photo => !!p)
    await this.dropOccasions(occasions.map((o) => o.id))
    await this.dropFoods(ids)
    await this.dropPhotos(photoIds).catch(() => {})
    this.emit()
    return { foods, occasions, photos }
  }

  async logOccasion(input: OccasionInput): Promise<Occasion> {
    if (!this.foods.has(input.foodId)) throw new Error('That food no longer exists.')
    const t = now()
    const occasion: Occasion = {
      ...input,
      restaurant: cleanText(input.restaurant),
      location: cleanText(input.location),
      id: newId(),
      createdAt: t,
      updatedAt: t,
    }
    await this.putOccasions([occasion])
    this.emit()
    return occasion
  }

  async updateOccasion(id: ID, patch: Partial<Omit<Occasion, 'id' | 'createdAt' | 'foodId'>>) {
    const prev = this.occasions.get(id)
    if (!prev) throw new Error('That meal no longer exists.')
    const clean = { ...patch }
    if (clean.restaurant !== undefined) clean.restaurant = cleanText(clean.restaurant)
    await this.putOccasions([{ ...prev, ...clean, updatedAt: now() }])
    if ('photoId' in clean && prev.photoId && prev.photoId !== clean.photoId) {
      await this.dropPhotos([prev.photoId]).catch(() => {})
    }
    this.emit()
  }

  async deleteOccasion(id: ID): Promise<DeletedSnapshot> {
    const o = this.occasions.get(id)
    if (!o) return { foods: [], occasions: [], photos: [] }
    const photo = o.photoId ? await this.getPhoto(o.photoId) : undefined
    await this.dropOccasions([id])
    if (o.photoId) await this.dropPhotos([o.photoId]).catch(() => {})
    this.emit()
    return { foods: [], occasions: [o], photos: photo ? [photo] : [] }
  }

  async restore(s: DeletedSnapshot) {
    await this.putPhotos(s.photos)
    await this.putFoods(s.foods)
    await this.putOccasions(s.occasions)
    this.emit()
  }

  async savePhoto(dataUrl: string): Promise<ID> {
    const id = newId()
    await this.putPhotos([{ id, dataUrl, createdAt: now() }])
    return id
  }

  async getPhoto(id: ID): Promise<Photo | undefined> {
    const { data, error } = await this.sb.storage.from(BUCKET).download(await this.photoPath(id))
    if (error || !data) return undefined
    return { id, dataUrl: await blobToDataUrl(data), createdAt: now() }
  }

  async deletePhoto(id: ID) {
    await this.dropPhotos([id])
  }

  async exportAll(): Promise<JournalExport> {
    await this.refetch()
    const { foods, occasions } = this.snapshot()
    const ids = [...new Set(occasions.map((o) => o.photoId).filter((p): p is string => !!p))]
    const photos = (await Promise.all(ids.map((id) => this.getPhoto(id)))).filter((p): p is Photo => !!p)
    return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: now(), foods, occasions, photos }
  }

  async importAll(data: JournalExport, mode: ImportMode): Promise<ImportResult> {
    if (mode === 'replace') await this.clearAll()
    await this.putPhotos(data.photos)
    await this.putFoods(data.foods)
    await this.putOccasions(data.occasions)
    this.emit()
    return { foods: data.foods.length, occasions: data.occasions.length, photos: data.photos.length }
  }

  async hasSampleData() {
    return [...this.foods.values()].some((f) => !!f.isSample)
  }

  async loadSampleData() {
    const sample = buildSampleData()
    const existing = new Set([...this.foods.values()].filter((f) => !f.isSample).map((f) => normalizeName(f.name)))
    const foods = sample.foods.filter((f) => !existing.has(normalizeName(f.name)))
    const ids = new Set(foods.map((f) => f.id))
    await this.putFoods(foods)
    await this.putOccasions(sample.occasions.filter((o) => ids.has(o.foodId)))
    this.emit()
  }

  async removeSampleData(): Promise<number> {
    const sampleFoods = [...this.foods.values()].filter((f) => !!f.isSample)
    const sampleIds = new Set(sampleFoods.map((f) => f.id))
    const all = [...this.occasions.values()]
    // Real meals logged against a sample food keep that food (as a real one).
    const keep = new Set(all.filter((o) => !o.isSample && sampleIds.has(o.foodId)).map((o) => o.foodId))
    const sampleOcc = all.filter((o) => !!o.isSample)
    const photoIds = sampleOcc.map((o) => o.photoId).filter((p): p is string => !!p)
    await this.dropOccasions(sampleOcc.map((o) => o.id))
    const remove = [...sampleIds].filter((id) => !keep.has(id))
    await this.dropFoods(remove)
    await this.putFoods(
      [...keep].map((id) => ({ ...this.foods.get(id)!, isSample: false })),
    )
    await this.dropPhotos(photoIds).catch(() => {})
    this.emit()
    return remove.length
  }

  async clearAll() {
    const photoIds = [...this.occasions.values()].map((o) => o.photoId).filter((p): p is string => !!p)
    const uid = await this.userId()
    const a = await this.sb.from('occasions').delete().eq('user_id', uid)
    if (a.error) throw a.error
    const b = await this.sb.from('foods').delete().eq('user_id', uid)
    if (b.error) throw b.error
    this.foods.clear()
    this.occasions.clear()
    await this.dropPhotos(photoIds).catch(() => {})
    this.emit()
  }
}
