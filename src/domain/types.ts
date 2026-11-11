/**
 * Core data model.
 *
 * A Food is a dish that can be eaten many times. An Occasion is one experience of
 * eating it. Everything numeric about a food (rating, times eaten, first/last date)
 * is derived from its occasions — never stored on the food itself.
 */

export type ID = string

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_LABELS: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }

/** Price tier: 1 = cheap (₹), 2 = medium (₹₹), 3 = expensive (₹₹₹) */
export const PRICE_TIERS = [1, 2, 3] as const
export type PriceTier = (typeof PRICE_TIERS)[number]

export const PRICE_LABELS: Record<PriceTier, string> = { 1: 'Cheap', 2: 'Medium', 3: 'Expensive' }

export function priceSymbol(tier: PriceTier | null | undefined): string {
  return tier ? '₹'.repeat(tier) : ''
}

/** Guess the meal from a time of day: before 11 breakfast, before 16 lunch, else dinner. */
export function mealForHour(hour: number): MealType {
  return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : 'dinner'
}

export interface Food {
  id: ID
  name: string
  cuisine: string
  description: string
  favourite: boolean
  /** ISO timestamp */
  createdAt: string
  /** ISO timestamp */
  updatedAt: string
  /** Development sample data, removable in one click */
  isSample?: boolean
}

export interface Occasion {
  id: ID
  foodId: ID
  /** Empty string means unknown. "Home" style names count as home cooking. */
  restaurant: string
  /** Local date, YYYY-MM-DD */
  date: string
  /** 0.5–5 stars in 0.5 steps, or null when not rated */
  rating: number | null
  notes: string
  photoId: ID | null
  price: PriceTier | null
  mealType: MealType | null
  location: string
  /** Map pin for where it was eaten. Missing on meals logged before maps existed. */
  lat?: number | null
  lng?: number | null
  custom: Record<string, string>
  createdAt: string
  updatedAt: string
  isSample?: boolean
}

export interface Photo {
  id: ID
  /** Compressed JPEG/WebP data URL */
  dataUrl: string
  createdAt: string
  isSample?: boolean
}

/** A food plus everything derived from its occasions. */
export interface FoodSummary {
  food: Food
  /** Newest first */
  occasions: Occasion[]
  avgRating: number | null
  ratedCount: number
  bestRating: number | null
  latestRating: number | null
  timesEaten: number
  firstTried: string | null
  lastEaten: string | null
  /** Distinct restaurant names, most frequent first */
  restaurants: string[]
  topRestaurant: string | null
  /** Most recent occasion photo */
  coverPhotoId: ID | null
  /** Concatenated notes for searching */
  notesText: string
}

export interface JournalData {
  foods: Food[]
  occasions: Occasion[]
}

export type FoodInput = Pick<Food, 'name' | 'cuisine'> & Partial<Pick<Food, 'description' | 'favourite'>>

export type OccasionInput = Omit<Occasion, 'id' | 'createdAt' | 'updatedAt' | 'isSample'>

export const DEFAULT_CUISINES = [
  'Indian',
  'Japanese',
  'Chinese',
  'Thai',
  'Korean',
  'Vietnamese',
  'Italian',
  'French',
  'Mexican',
  'Middle Eastern',
  'Mediterranean',
  'American',
  'British',
  'Spanish',
  'Greek',
  'Turkish',
  'Lebanese',
  'Ethiopian',
  'Malaysian',
  'Indonesian',
]
