import { normalizeName } from './text'
import type { FoodSummary } from './types'

export type FavouriteFilter = 'any' | 'only' | 'exclude'
export type StatusFilter = 'all' | 'tried' | 'want'

export interface FoodFilters {
  query: string
  cuisines: string[]
  restaurants: string[]
  ratingMin: number | null
  ratingMax: number | null
  /** Food has at least one occasion in this date range */
  dateFrom: string
  dateTo: string
  favourite: FavouriteFilter
  timesMin: number | null
  timesMax: number | null
  status: StatusFilter
}

export const EMPTY_FILTERS: FoodFilters = {
  query: '',
  cuisines: [],
  restaurants: [],
  ratingMin: null,
  ratingMax: null,
  dateFrom: '',
  dateTo: '',
  favourite: 'any',
  timesMin: null,
  timesMax: null,
  status: 'all',
}

/** Number of active filters, excluding the text query. */
export function countActiveFilters(f: FoodFilters): number {
  let n = 0
  if (f.cuisines.length) n++
  if (f.restaurants.length) n++
  if (f.ratingMin != null || f.ratingMax != null) n++
  if (f.dateFrom || f.dateTo) n++
  if (f.favourite !== 'any') n++
  if (f.timesMin != null || f.timesMax != null) n++
  if (f.status !== 'all') n++
  return n
}

function inSet(value: string, selected: string[]): boolean {
  if (!selected.length) return true
  const v = normalizeName(value)
  return selected.some((s) => normalizeName(s) === v)
}

/** Every search term must appear somewhere in the given pieces of text. */
export function matchesText(parts: string[], query: string): boolean {
  const terms = normalizeName(query).split(' ').filter(Boolean)
  if (!terms.length) return true
  const haystack = normalizeName(parts.join(' \n '))
  return terms.every((t) => haystack.includes(t))
}

/** Every search term must appear somewhere in the food's searchable text. */
export function matchesQuery(s: FoodSummary, query: string): boolean {
  return matchesText(
    [s.food.name, s.food.cuisine, s.food.description, s.restaurants.join(' '), s.notesText, s.occasions.map((o) => o.location).join(' ')],
    query,
  )
}

export function applyFilters(items: FoodSummary[], f: FoodFilters): FoodSummary[] {
  return items.filter((s) => {
    if (f.status === 'tried' && s.timesEaten === 0) return false
    if (f.status === 'want' && s.timesEaten > 0) return false
    if (f.favourite === 'only' && !s.food.favourite) return false
    if (f.favourite === 'exclude' && s.food.favourite) return false
    if (!inSet(s.food.cuisine, f.cuisines)) return false
    if (f.restaurants.length) {
      const wanted = new Set(f.restaurants.map(normalizeName))
      if (!s.restaurants.some((r) => wanted.has(normalizeName(r)))) return false
    }
    if (f.ratingMin != null || f.ratingMax != null) {
      if (s.avgRating == null) return false
      if (f.ratingMin != null && s.avgRating < f.ratingMin) return false
      if (f.ratingMax != null && s.avgRating > f.ratingMax) return false
    }
    if (f.timesMin != null && s.timesEaten < f.timesMin) return false
    if (f.timesMax != null && s.timesEaten > f.timesMax) return false
    if (f.dateFrom || f.dateTo) {
      const hit = s.occasions.some(
        (o) => (!f.dateFrom || o.date >= f.dateFrom) && (!f.dateTo || o.date <= f.dateTo),
      )
      if (!hit) return false
    }
    return matchesQuery(s, f.query)
  })
}
