import { daysBetween, monthKey, recentMonths, toLocalDate } from './dates'
import { averageRating } from './rating'
import { compareOccasionsDesc } from './summarize'
import { cleanText, isHomeCooking, normalizeName } from './text'
import type { FoodSummary, Occasion } from './types'

/** Minimum rated experiences before a group's average is shown as meaningful. */
export const MIN_RATED_FOR_AVERAGE = 2

export interface Overview {
  uniqueFoodsTried: number
  wantToTry: number
  occasions: number
  /** Mean of per-food average ratings (each food counts once) */
  avgFoodRating: number | null
  ratedFoods: number
  /** Mean of every rated experience */
  avgExperienceRating: number | null
  restaurantsVisited: number
  cuisinesExplored: number
  newFoodsThisMonth: number
  favourites: number
}

export function computeOverview(summaries: FoodSummary[], today = toLocalDate()): Overview {
  const tried = summaries.filter((s) => s.timesEaten > 0)
  const allOccasions = tried.flatMap((s) => s.occasions)
  const thisMonth = monthKey(today)
  return {
    uniqueFoodsTried: tried.length,
    wantToTry: summaries.length - tried.length,
    occasions: allOccasions.length,
    avgFoodRating: averageRating(tried.map((s) => s.avgRating)),
    ratedFoods: tried.filter((s) => s.avgRating != null).length,
    avgExperienceRating: averageRating(allOccasions.map((o) => o.rating)),
    restaurantsVisited: new Set(
      allOccasions
        .map((o) => cleanText(o.restaurant))
        .filter((r) => r && !isHomeCooking(r))
        .map(normalizeName),
    ).size,
    cuisinesExplored: new Set(tried.map((s) => normalizeName(s.food.cuisine)).filter(Boolean)).size,
    newFoodsThisMonth: tried.filter((s) => s.firstTried && monthKey(s.firstTried) === thisMonth).length,
    favourites: summaries.filter((s) => s.food.favourite).length,
  }
}

export interface GroupStat {
  name: string
  uniqueFoods: number
  occasions: number
  /** Distinct days with at least one occasion (restaurants: visits) */
  visits: number
  avgRating: number | null
  ratedCount: number
}

function groupStats(
  summaries: FoodSummary[],
  keyOf: (s: FoodSummary, o: Occasion) => string,
): GroupStat[] {
  const groups = new Map<
    string,
    { name: string; foods: Set<string>; occasions: number; days: Set<string>; ratings: number[] }
  >()
  for (const s of summaries) {
    for (const o of s.occasions) {
      const raw = cleanText(keyOf(s, o))
      if (!raw) continue
      const key = normalizeName(raw)
      const g = groups.get(key) ?? { name: raw, foods: new Set(), occasions: 0, days: new Set(), ratings: [] }
      g.foods.add(s.food.id)
      g.occasions++
      g.days.add(o.date)
      if (o.rating != null) g.ratings.push(o.rating)
      groups.set(key, g)
    }
  }
  return [...groups.values()].map((g) => ({
    name: g.name,
    uniqueFoods: g.foods.size,
    occasions: g.occasions,
    visits: g.days.size,
    avgRating: averageRating(g.ratings),
    ratedCount: g.ratings.length,
  }))
}

export function cuisineStats(summaries: FoodSummary[]): GroupStat[] {
  return groupStats(summaries, (s) => s.food.cuisine || 'Unspecified').sort(
    (a, b) => b.occasions - a.occasions || a.name.localeCompare(b.name),
  )
}

/** Restaurants only (home cooking and unknown excluded). */
export function restaurantStats(summaries: FoodSummary[]): GroupStat[] {
  return groupStats(summaries, (_s, o) => (isHomeCooking(o.restaurant) ? '' : o.restaurant)).sort(
    (a, b) => b.visits - a.visits || b.occasions - a.occasions || a.name.localeCompare(b.name),
  )
}

/** Sort groups by average rating, only including groups with enough rated experiences. */
export function rankByRating(stats: GroupStat[], minRated = MIN_RATED_FOR_AVERAGE): GroupStat[] {
  return stats
    .filter((s) => s.avgRating != null && s.ratedCount >= minRated)
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.ratedCount - a.ratedCount)
}

export interface Bucket {
  label: string
  count: number
}

/** Ratings grouped into half-star buckets: "0.5", "1", … "5". */
export function ratingDistribution(values: (number | null)[]): Bucket[] {
  const buckets = Array.from({ length: 10 }, (_, i) => ({ label: String((i + 1) / 2), count: 0 }))
  for (const v of values) {
    if (v == null) continue
    const idx = Math.min(9, Math.max(0, Math.ceil(v * 2) - 1))
    buckets[idx].count++
  }
  return buckets
}

export interface MonthPoint {
  month: string
  newFoods: number
  occasions: number
}

export function monthlyTimeline(summaries: FoodSummary[], months = 12, today = toLocalDate()): MonthPoint[] {
  const keys = recentMonths(months, today)
  const map = new Map(keys.map((k) => [k, { month: k, newFoods: 0, occasions: 0 }]))
  for (const s of summaries) {
    if (s.firstTried) {
      const p = map.get(monthKey(s.firstTried))
      if (p) p.newFoods++
    }
    for (const o of s.occasions) {
      const p = map.get(monthKey(o.date))
      if (p) p.occasions++
    }
  }
  return keys.map((k) => map.get(k)!)
}

/** Cumulative unique foods tried, by month, across the whole history. */
export function cumulativeFoods(summaries: FoodSummary[], months = 12, today = toLocalDate()): { month: string; total: number }[] {
  const keys = recentMonths(months, today)
  const firsts = summaries.map((s) => s.firstTried).filter((d): d is string => !!d)
  return keys.map((k) => ({ month: k, total: firsts.filter((d) => monthKey(d) <= k).length }))
}

/** Rank by average rating; requires at least `minRated` rated experiences. */
export function topRated(summaries: FoodSummary[], limit = 10, minRated = 1): FoodSummary[] {
  return summaries
    .filter((s) => s.avgRating != null && s.ratedCount >= minRated)
    .sort(
      (a, b) =>
        (b.avgRating ?? 0) - (a.avgRating ?? 0) ||
        b.ratedCount - a.ratedCount ||
        (b.lastEaten ?? '').localeCompare(a.lastEaten ?? ''),
    )
    .slice(0, limit)
}

export function mostEaten(summaries: FoodSummary[], limit = 10): FoodSummary[] {
  return summaries
    .filter((s) => s.timesEaten > 0)
    .sort((a, b) => b.timesEaten - a.timesEaten || (b.avgRating ?? 0) - (a.avgRating ?? 0))
    .slice(0, limit)
}

export function recentlyDiscovered(summaries: FoodSummary[], limit = 10): FoodSummary[] {
  return summaries
    .filter((s) => s.firstTried)
    .sort((a, b) => (b.firstTried ?? '').localeCompare(a.firstTried ?? ''))
    .slice(0, limit)
}

/** Favourites (or ≥ 4.5 stars) first tried within `days`. */
export function recentlyDiscoveredFavourites(summaries: FoodSummary[], days = 90, today = toLocalDate(), limit = 8): FoodSummary[] {
  return summaries
    .filter(
      (s) =>
        s.firstTried &&
        daysBetween(s.firstTried, today) <= days &&
        (s.food.favourite || (s.avgRating ?? 0) >= 4.5),
    )
    .sort((a, b) => (b.firstTried ?? '').localeCompare(a.firstTried ?? ''))
    .slice(0, limit)
}

export function recentlyEaten(summaries: FoodSummary[], limit = 10): FoodSummary[] {
  return summaries
    .filter((s) => s.lastEaten)
    .sort((a, b) => compareRecency(b, a))
    .slice(0, limit)
}

function compareRecency(a: FoodSummary, b: FoodSummary): number {
  const ao = a.occasions[0]
  const bo = b.occasions[0]
  if (!ao || !bo) return ao ? 1 : bo ? -1 : 0
  return -compareOccasionsDesc(ao, bo)
}

export function triedOnce(summaries: FoodSummary[]): FoodSummary[] {
  return summaries
    .filter((s) => s.timesEaten === 1)
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || (b.lastEaten ?? '').localeCompare(a.lastEaten ?? ''))
}

/** Favourites eaten again (2+ times) where the latest occasion is within `days`. */
export function recentlyRevisitedFavourites(summaries: FoodSummary[], days = 60, today = toLocalDate(), limit = 8): FoodSummary[] {
  return summaries
    .filter(
      (s) =>
        s.timesEaten >= 2 &&
        (s.food.favourite || (s.avgRating ?? 0) >= 4.5) &&
        s.lastEaten &&
        daysBetween(s.lastEaten, today) <= days,
    )
    .sort((a, b) => compareRecency(b, a))
    .slice(0, limit)
}

/** Tried before, but not within `days`. Best rated first. */
export function notEatenRecently(summaries: FoodSummary[], days = 90, today = toLocalDate()): FoodSummary[] {
  return summaries
    .filter((s) => s.lastEaten && daysBetween(s.lastEaten, today) > days)
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || (a.lastEaten ?? '').localeCompare(b.lastEaten ?? ''))
}

export function recentlyAdded(summaries: FoodSummary[], limit = 12): FoodSummary[] {
  return [...summaries].sort((a, b) => b.food.createdAt.localeCompare(a.food.createdAt)).slice(0, limit)
}

export function wantToTry(summaries: FoodSummary[]): FoodSummary[] {
  return summaries
    .filter((s) => s.timesEaten === 0)
    .sort((a, b) => b.food.createdAt.localeCompare(a.food.createdAt))
}

/**
 * "What should I try next": well-rated foods you haven't had in a while,
 * scored by rating and how long it's been.
 */
export function revisitSuggestions(summaries: FoodSummary[], today = toLocalDate(), limit = 6): FoodSummary[] {
  return summaries
    .filter((s) => s.lastEaten && (s.avgRating ?? 0) >= 4 && daysBetween(s.lastEaten, today) >= 30)
    .map((s) => ({ s, score: (s.avgRating ?? 0) * 20 + Math.min(daysBetween(s.lastEaten!, today), 365) / 10 + (s.food.favourite ? 10 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s)
}
