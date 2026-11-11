import { z } from 'zod'
import { migrateFoodV1, migrateOccasionV1 } from './migrate'
import { isValidRating } from './rating'
import { MEAL_TYPES } from './types'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-03-14')

export const foodSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'Give the food a name').max(120, 'Keep the name under 120 characters'),
  cuisine: z.string().trim().max(60).default(''),
  description: z.string().max(2000).default(''),
  favourite: z.boolean().default(false),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  isSample: z.boolean().optional(),
})

export const ratingSchema = z
  .number()
  .nullable()
  .refine((v) => v == null || isValidRating(v), 'Ratings go from 0.5 to 5 stars in half steps')

export const occasionSchema = z.object({
  id: z.string().min(1),
  foodId: z.string().min(1),
  restaurant: z.string().trim().max(120).default(''),
  date: isoDate,
  rating: ratingSchema.default(null),
  notes: z.string().max(5000).default(''),
  photoId: z.string().nullable().default(null),
  price: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().default(null),
  mealType: z.enum(MEAL_TYPES).nullable().default(null),
  location: z.string().max(200).default(''),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  custom: z.record(z.string(), z.string()).default({}),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  isSample: z.boolean().optional(),
})

export const photoSchema = z.object({
  id: z.string().min(1),
  dataUrl: z.string().startsWith('data:image/', 'Photos must be image data URLs'),
  createdAt: z.string().min(1),
  isSample: z.boolean().optional(),
})

export const EXPORT_FORMAT = 'food-journal'
export const EXPORT_VERSION = 2

export const exportSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.number().int().min(1).max(EXPORT_VERSION),
  exportedAt: z.string(),
  foods: z.array(foodSchema),
  occasions: z.array(occasionSchema),
  photos: z.array(photoSchema).default([]),
})

export type JournalExport = z.infer<typeof exportSchema>

export interface ImportCheck {
  ok: boolean
  data?: JournalExport
  errors: string[]
  warnings: string[]
}

/** Bring a version 1 export (ratings out of 10, numeric prices…) up to date. */
function upgradeExport(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const r = raw as { version?: unknown; foods?: unknown; occasions?: unknown }
  if (r.version !== 1) return raw
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : v)
  const foods = list(r.foods)
  const occasions = list(r.occasions)
  return {
    ...r,
    version: EXPORT_VERSION,
    foods: Array.isArray(foods) ? foods.map(migrateFoodV1) : foods,
    occasions: Array.isArray(occasions) ? occasions.map(migrateOccasionV1) : occasions,
  }
}

/** Validate an import payload and check referential integrity. */
export function validateImport(raw: unknown): ImportCheck {
  const parsed = exportSchema.safeParse(upgradeExport(raw))
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 6).map((i) => `${i.path.join('.') || 'file'}: ${i.message}`)
    if (raw && typeof raw === 'object' && (raw as { format?: unknown }).format !== EXPORT_FORMAT) {
      return { ok: false, errors: ['This file isn’t a Food Journal export.'], warnings: [] }
    }
    return { ok: false, errors, warnings: [] }
  }
  const data = parsed.data
  const warnings: string[] = []
  const foodIds = new Set(data.foods.map((f) => f.id))
  const orphans = data.occasions.filter((o) => !foodIds.has(o.foodId))
  if (orphans.length) {
    warnings.push(`${orphans.length} meal(s) refer to foods that aren’t in the file and will be skipped.`)
    data.occasions = data.occasions.filter((o) => foodIds.has(o.foodId))
  }
  const photoIds = new Set(data.photos.map((p) => p.id))
  let missingPhotos = 0
  for (const o of data.occasions) {
    if (o.photoId && !photoIds.has(o.photoId)) {
      o.photoId = null
      missingPhotos++
    }
  }
  if (missingPhotos) warnings.push(`${missingPhotos} photo reference(s) were missing and have been cleared.`)
  return { ok: true, data, errors: [], warnings }
}
