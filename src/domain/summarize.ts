import { averageRating } from './rating'
import { distinctByFrequency } from './text'
import { MEAL_TYPES, type Food, type FoodSummary, type Occasion } from './types'

/** Newest first: by date, then meal (dinner after lunch after breakfast), then creation. */
export function compareOccasionsDesc(a: Occasion, b: Occasion): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  const am = a.mealType ? MEAL_TYPES.indexOf(a.mealType) : -1
  const bm = b.mealType ? MEAL_TYPES.indexOf(b.mealType) : -1
  if (am !== bm) return am < bm ? 1 : -1
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
}

export function summarizeFood(food: Food, occasions: Occasion[]): FoodSummary {
  const sorted = [...occasions].sort(compareOccasionsDesc)
  const ratings = sorted.map((o) => o.rating).filter((r): r is number => r != null)
  const restaurants = distinctByFrequency(sorted.map((o) => o.restaurant))
  return {
    food,
    occasions: sorted,
    avgRating: averageRating(ratings),
    ratedCount: ratings.length,
    bestRating: ratings.length ? Math.max(...ratings) : null,
    latestRating: sorted.find((o) => o.rating != null)?.rating ?? null,
    timesEaten: sorted.length,
    firstTried: sorted.length ? sorted[sorted.length - 1].date : null,
    lastEaten: sorted.length ? sorted[0].date : null,
    restaurants,
    topRestaurant: restaurants[0] ?? null,
    coverPhotoId: sorted.find((o) => o.photoId)?.photoId ?? null,
    notesText: sorted.map((o) => o.notes).filter(Boolean).join(' \n '),
  }
}

/** Build summaries for every food in one pass over the occasions. */
export function summarizeAll(foods: Food[], occasions: Occasion[]): FoodSummary[] {
  const byFood = new Map<string, Occasion[]>()
  for (const o of occasions) {
    const list = byFood.get(o.foodId)
    if (list) list.push(o)
    else byFood.set(o.foodId, [o])
  }
  return foods.map((f) => summarizeFood(f, byFood.get(f.id) ?? []))
}
