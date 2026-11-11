import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { DexieJournalRepository } from '../src/storage/dexieRepository'
import type { JournalData } from '../src/domain/types'

const base = { restaurant: 'Bawarchi', date: '2026-11-01', rating: 4, notes: '', photoId: null, price: null, mealType: null, location: '', custom: {} }

function snapshot(repo: DexieJournalRepository): Promise<JournalData> {
  return new Promise((resolve, reject) => {
    const unsub = repo.subscribe((d) => { unsub(); resolve(d) }, reject)
  })
}

describe('DexieJournalRepository', () => {
  it('creates, logs, edits, deletes and restores', async () => {
    const repo = new DexieJournalRepository('t1')
    const f = await repo.createFood({ name: '  Chicken   biryani ', cuisine: 'Indian' })
    expect(f.name).toBe('Chicken biryani')
    await repo.logOccasion({ ...base, foodId: f.id })
    const o2 = await repo.logOccasion({ ...base, foodId: f.id, rating: 4.5 })
    let d = await snapshot(repo)
    expect(d.occasions.length).toBe(2)

    await repo.updateOccasion(o2.id, { rating: 5 })
    await repo.updateFood(f.id, { favourite: true })
    d = await snapshot(repo)
    expect(d.occasions.find((o) => o.id === o2.id)!.rating).toBe(5)
    expect(d.foods[0].favourite).toBe(true)

    const photoId = await repo.savePhoto('data:image/jpeg;base64,AAAA')
    await repo.updateOccasion(o2.id, { photoId })
    const snap = await repo.deleteFood(f.id)
    expect(snap.occasions.length).toBe(2)
    expect(snap.photos.length).toBe(1)
    d = await snapshot(repo)
    expect(d.foods.length).toBe(0)
    expect(d.occasions.length).toBe(0)

    await repo.restore(snap)
    d = await snapshot(repo)
    expect(d.foods.length).toBe(1)
    expect(d.occasions.length).toBe(2)
    expect(await repo.getPhoto(photoId)).toBeTruthy()
  })

  it('round-trips export/import and removes sample data only', async () => {
    const repo = new DexieJournalRepository('t2')
    await repo.loadSampleData()
    const mine = await repo.createFood({ name: 'My dish', cuisine: '' })
    await repo.logOccasion({ ...base, foodId: mine.id })
    // a real meal logged against a sample food keeps that food
    const before = await snapshot(repo)
    const sampleFood = before.foods.find((f) => f.isSample)!
    await repo.logOccasion({ ...base, foodId: sampleFood.id })

    const exported = await repo.exportAll()
    const copy = new DexieJournalRepository('t3')
    await copy.importAll(JSON.parse(JSON.stringify(exported)), 'replace')
    const c = await snapshot(copy)
    expect(c.foods.length).toBe(before.foods.length)

    expect(await repo.hasSampleData()).toBe(true)
    await repo.removeSampleData()
    const after = await snapshot(repo)
    expect(after.foods.map((f) => f.name).sort()).toEqual(['My dish', sampleFood.name].sort())
    expect(after.occasions.length).toBe(2)
    expect(after.foods.every((f) => !f.isSample)).toBe(true)
  })
})
