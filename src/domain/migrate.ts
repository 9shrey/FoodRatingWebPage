import { normalizeRating } from './rating'
import { mealForHour, type MealType, type PriceTier } from './types'

/**
 * Converts records saved by the first version of the app (ratings out of 10,
 * numeric prices, free-form meal types, time, category/tags/ingredients,
 * "would eat again") to the current, slimmer shape.
 */

type Raw = Record<string, unknown>

/** Old prices were plain numbers in rupees. */
export function priceToTier(price: unknown): PriceTier | null {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null
  if (price <= 200) return 1
  if (price <= 600) return 2
  return 3
}

const OLD_MEALS: Record<string, MealType | null> = {
  breakfast: 'breakfast',
  brunch: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  'late night': 'dinner',
}

function migrateMeal(mealType: unknown, time: unknown): MealType | null {
  if (typeof mealType === 'string' && OLD_MEALS[mealType]) return OLD_MEALS[mealType]
  if (typeof time === 'string' && /^\d{2}:\d{2}$/.test(time)) return mealForHour(Number(time.slice(0, 2)))
  return null
}

export function migrateFoodV1<T extends Raw>(food: T): T {
  const { category: _c, tags: _t, ingredients: _i, ...rest } = food
  return rest as unknown as T
}

export function migrateOccasionV1<T extends Raw>(o: T): T {
  const { time, wouldEatAgain: _w, ...rest } = o
  const rating = typeof o.rating === 'number' ? normalizeRating(o.rating / 2) : null
  return {
    ...rest,
    rating,
    price: priceToTier(o.price),
    mealType: migrateMeal(o.mealType, time),
  } as unknown as T
}
