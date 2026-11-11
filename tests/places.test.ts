import { describe, expect, it } from 'vitest'
import { buildPlaces, distanceMetres, formatDistance, lastPinFor, unpinnedRestaurantCount } from '../src/domain/places'
import { validateImport } from '../src/domain/schemas'
import type { Food, Occasion } from '../src/domain/types'
import { buildSampleData } from '../src/storage/sampleData'

const T = '2026-01-01T00:00:00.000Z'
const food = (id: string, name: string): Food => ({
  id, name, cuisine: '', description: '', favourite: false, createdAt: T, updatedAt: T,
})
let n = 0
const occ = (foodId: string, date: string, rating: number | null, restaurant: string, lat?: number, lng?: number): Occasion => ({
  id: `o${++n}`, foodId, restaurant, date, rating, notes: '', photoId: null, price: null, mealType: null,
  location: '', custom: {}, createdAt: T, updatedAt: T, lat, lng,
})

const SOHO = { lat: 51.513, lng: -0.131 }

describe('places', () => {
  it('measures distance', () => {
    // Soho → London Bridge is roughly 3 km.
    const d = distanceMetres(SOHO, { lat: 51.505, lng: -0.0865 })
    expect(d).toBeGreaterThan(2900)
    expect(d).toBeLessThan(3400)
    expect(formatDistance(20)).toBe('Here')
    expect(formatDistance(340)).toBe('340 m')
    expect(formatDistance(2345)).toBe('2.3 km')
  })

  it('groups pinned meals by restaurant, splitting far-apart branches', () => {
    const foods = [food('a', 'Ramen'), food('b', 'Gyoza')]
    const occasions = [
      occ('a', '2026-01-02', 9, 'Ippudo', 51.517, -0.1205),
      occ('b', '2026-01-03', 7, 'ippudo', 51.5171, -0.1206), // same branch, different case
      occ('a', '2026-01-04', 8, 'Ippudo', 51.5, -0.02), // another branch, km away
      occ('a', '2026-01-05', 6, 'Nowhere'), // unpinned, ignored
    ]
    const places = buildPlaces(foods, occasions)
    expect(places).toHaveLength(2)
    const central = places.find((p) => p.lat > 51.51)!
    expect(central.visits).toBe(2)
    expect(central.avgRating).toBe(8)
    expect(central.foods.map((f) => f.name)).toEqual(['Ramen', 'Gyoza'])
  })

  it('reuses the latest pin for a restaurant', () => {
    const occasions = [occ('a', '2026-01-01', 8, 'Kiln', 1, 1), occ('a', '2026-02-01', 8, 'Kiln', 2, 2), occ('a', '2026-03-01', 8, 'Kiln')]
    expect(lastPinFor(occasions, 'kiln')).toMatchObject({ lat: 2, lng: 2 })
    expect(lastPinFor(occasions, 'Other')).toBeNull()
  })

  it('counts restaurants with no pin, ignoring home', () => {
    const occasions = [occ('a', '2026-01-01', 8, 'Kiln', 1, 1), occ('a', '2026-01-01', 8, 'Padella'), occ('a', '2026-01-01', 8, 'Home')]
    expect(unpinnedRestaurantCount(occasions)).toBe(1)
  })

  it('sample data has pins and old exports without pins still import', () => {
    const sample = buildSampleData('2026-06-01')
    expect(buildPlaces(sample.foods, sample.occasions).length).toBeGreaterThan(15)
    const legacy = { format: 'food-journal', version: 1, exportedAt: T, foods: [food('a', 'X')], occasions: [{ ...occ('a', '2026-01-01', 8, 'Y'), lat: undefined, lng: undefined }] }
    expect(validateImport(JSON.parse(JSON.stringify(legacy))).ok).toBe(true)
  })
})
