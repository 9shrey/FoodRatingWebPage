import { describe, expect, it } from 'vitest'
import { computeOverview, cuisineStats, monthlyTimeline, ratingDistribution, restaurantStats, topRated } from '../src/domain/analytics'
import { toCsv } from '../src/domain/csv'
import { applyFilters, EMPTY_FILTERS } from '../src/domain/filters'
import { generateInsights } from '../src/domain/insights'
import { averageRating, formatRating, isValidRating, normalizeRating } from '../src/domain/rating'
import { validateImport } from '../src/domain/schemas'
import { summarizeAll } from '../src/domain/summarize'
import type { Food, Occasion } from '../src/domain/types'
import { buildSampleData } from '../src/storage/sampleData'

const T = '2026-01-01T00:00:00.000Z'
const food = (id: string, name: string, cuisine: string, extra: Partial<Food> = {}): Food => ({
  id, name, cuisine, description: '', favourite: false, createdAt: T, updatedAt: T, ...extra,
})
let n = 0
const occ = (foodId: string, date: string, rating: number | null, restaurant = 'Place', extra: Partial<Occasion> = {}): Occasion => ({
  id: `o${++n}`, foodId, restaurant, date, rating, notes: '', photoId: null, price: null, mealType: null,
  location: '', custom: {}, createdAt: T, updatedAt: T, ...extra,
})

describe('rating', () => {
  it('validates half stars between 0.5 and 5', () => {
    expect(isValidRating(3.5)).toBe(true)
    expect(isValidRating(5)).toBe(true)
    expect(isValidRating(0)).toBe(false)
    expect(isValidRating(3.25)).toBe(false)
    expect(isValidRating(5.5)).toBe(false)
  })
  it('normalizes and formats', () => {
    expect(normalizeRating(3.3)).toBe(3.5)
    expect(normalizeRating(12)).toBe(5)
    expect(formatRating(4)).toBe('4.0')
    expect(formatRating(null)).toBe('—')
  })
  it('averages ignoring unrated', () => {
    expect(averageRating([4, null, 4.5])).toBe(4.25)
    expect(averageRating([null])).toBeNull()
  })
})

describe('summaries', () => {
  const foods = [food('a', 'Biryani', 'Indian'), food('b', 'Ramen', 'Japanese'), food('c', 'Laksa', 'Malaysian')]
  const occasions = [
    occ('a', '2026-01-05', 4, 'Bawarchi'),
    occ('a', '2026-02-10', 4.5, 'Bawarchi'),
    occ('a', '2026-03-01', null, 'Home'),
    occ('b', '2026-02-01', 3.5, 'Ippudo'),
  ]
  const s = summarizeAll(foods, occasions)
  const biryani = s.find((x) => x.food.id === 'a')!

  it('derives rating and counts from occasions', () => {
    expect(biryani.timesEaten).toBe(3)
    expect(biryani.avgRating).toBe(4.25)
    expect(biryani.ratedCount).toBe(2)
    expect(biryani.firstTried).toBe('2026-01-05')
    expect(biryani.lastEaten).toBe('2026-03-01')
    expect(biryani.topRestaurant).toBe('Bawarchi')
    expect(biryani.latestRating).toBe(4.5)
  })

  it('distinguishes unique foods from occasions', () => {
    const o = computeOverview(s, '2026-03-15')
    expect(o.uniqueFoodsTried).toBe(2)
    expect(o.occasions).toBe(4)
    expect(o.wantToTry).toBe(1)
    expect(o.restaurantsVisited).toBe(2) // Home excluded
    expect(o.cuisinesExplored).toBe(2)
    expect(o.newFoodsThisMonth).toBe(0)
    expect(o.avgFoodRating).toBe(3.88) // mean of 4.25 and 3.5
  })

  it('groups cuisines and restaurants', () => {
    const c = cuisineStats(s)
    expect(c.find((x) => x.name === 'Indian')).toMatchObject({ uniqueFoods: 1, occasions: 3, avgRating: 4.25 })
    const r = restaurantStats(s)
    expect(r.map((x) => x.name)).toEqual(['Bawarchi', 'Ippudo'])
    expect(r[0]).toMatchObject({ visits: 2, uniqueFoods: 1 })
  })

  it('ranks top rated and distribution', () => {
    expect(topRated(s).map((x) => x.food.name)).toEqual(['Biryani', 'Ramen'])
    const d = ratingDistribution(occasions.map((o) => o.rating))
    expect(d[7].count).toBe(1) // 4 stars
    expect(d[8].count).toBe(1) // 4.5 stars
    expect(d.reduce((a, b) => a + b.count, 0)).toBe(3)
  })

  it('builds a monthly timeline', () => {
    const t = monthlyTimeline(s, 3, '2026-03-15')
    expect(t.map((p) => p.month)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(t[0]).toMatchObject({ newFoods: 1, occasions: 1 })
    expect(t[1]).toMatchObject({ newFoods: 1, occasions: 2 })
  })

  it('filters by text, rating, restaurant, status', () => {
    expect(applyFilters(s, { ...EMPTY_FILTERS, query: 'bawar' }).length).toBe(1)
    expect(applyFilters(s, { ...EMPTY_FILTERS, ratingMin: 4 }).map((x) => x.food.id)).toEqual(['a'])
    expect(applyFilters(s, { ...EMPTY_FILTERS, restaurants: ['ippudo'] }).map((x) => x.food.id)).toEqual(['b'])
    expect(applyFilters(s, { ...EMPTY_FILTERS, status: 'want' }).map((x) => x.food.id)).toEqual(['c'])
    expect(applyFilters(s, { ...EMPTY_FILTERS, dateFrom: '2026-02-05', dateTo: '2026-02-28' }).map((x) => x.food.id)).toEqual(['a'])
    expect(applyFilters(s, { ...EMPTY_FILTERS, timesMin: 2 }).map((x) => x.food.id)).toEqual(['a'])
  })

  it('produces no insights from thin data', () => {
    expect(generateInsights(s)).toEqual([])
  })
})

describe('insights on sample data', () => {
  const { foods, occasions } = buildSampleData('2026-11-11')
  const s = summarizeAll(foods, occasions)
  it('generates grounded insights', () => {
    const ins = generateInsights(s)
    expect(ins.length).toBeGreaterThan(2)
    const most = ins.find((i) => i.id === 'most-eaten')!
    expect(most.text).toContain('chicken biryani 12 times')
  })
})

describe('import validation and csv', () => {
  const { foods, occasions } = buildSampleData('2026-11-11')
  it('accepts a valid export and rejects junk', () => {
    const ok = validateImport({ format: 'food-journal', version: 2, exportedAt: T, foods, occasions, photos: [] })
    expect(ok.ok).toBe(true)
    expect(validateImport({ hello: 1 }).ok).toBe(false)
    const bad = validateImport({ format: 'food-journal', version: 2, exportedAt: T, foods, occasions: [{ ...occasions[0], rating: 6 }], photos: [] })
    expect(bad.ok).toBe(false)
  })
  it('upgrades a version 1 export', () => {
    const oldFood = { ...food('f', 'Dosa', 'Indian'), category: 'Breakfast', tags: ['crispy'], ingredients: ['rice'] }
    const oldOcc = { ...occ('f', '2026-01-01', null), rating: 7, time: '09:00', price: 350, mealType: 'snack', wouldEatAgain: true }
    const r = validateImport({ format: 'food-journal', version: 1, exportedAt: T, foods: [oldFood], occasions: [oldOcc], photos: [] })
    expect(r.ok).toBe(true)
    expect(r.data!.foods[0]).not.toHaveProperty('tags')
    expect(r.data!.occasions[0]).toMatchObject({ rating: 3.5, price: 2, mealType: 'breakfast' })
    expect(r.data!.occasions[0]).not.toHaveProperty('time')
    expect(r.data!.occasions[0]).not.toHaveProperty('wouldEatAgain')
  })
  it('drops orphan occasions with a warning', () => {
    const r = validateImport({ format: 'food-journal', version: 2, exportedAt: T, foods: [], occasions: [occasions[0]], photos: [] })
    expect(r.ok).toBe(true)
    expect(r.data!.occasions.length).toBe(0)
    expect(r.warnings.length).toBe(1)
  })
  it('writes one CSV row per occasion plus never-eaten foods', () => {
    const csv = toCsv([food('x', 'Pie, "apple"', 'British'), food('y', 'Soup', 'French')], [occ('x', '2026-01-01', 3.5), occ('x', '2026-01-02', 4)])
    const lines = csv.split('\r\n')
    expect(lines.length).toBe(4)
    expect(lines[1]).toContain('"Pie, ""apple"""')
  })
})
