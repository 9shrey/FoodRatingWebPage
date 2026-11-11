import { summarizeAll } from './summarize'
import { priceSymbol, type Food, type Occasion } from './types'

function cell(value: unknown): string {
  if (value == null) return ''
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const HEADER = [
  'food_id',
  'food_name',
  'cuisine',
  'favourite',
  'food_avg_rating',
  'food_times_eaten',
  'description',
  'occasion_id',
  'date',
  'restaurant',
  'rating',
  'price',
  'meal_type',
  'location',
  'latitude',
  'longitude',
  'notes',
  'has_photo',
]

/**
 * One row per eating occasion, with the food's fields repeated.
 * Foods never eaten get a single row with empty occasion columns.
 */
export function toCsv(foods: Food[], occasions: Occasion[]): string {
  const rows: string[] = [HEADER.join(',')]
  for (const s of summarizeAll(foods, occasions).sort((a, b) => a.food.name.localeCompare(b.food.name))) {
    const f = s.food
    const foodCells = [
      f.id,
      f.name,
      f.cuisine,
      f.favourite ? 'yes' : 'no',
      s.avgRating ?? '',
      s.timesEaten,
      f.description,
    ]
    const list = [...s.occasions].reverse()
    if (!list.length) {
      rows.push([...foodCells, ...Array(HEADER.length - foodCells.length).fill('')].map(cell).join(','))
      continue
    }
    for (const o of list) {
      rows.push(
        [
          ...foodCells,
          o.id,
          o.date,
          o.restaurant,
          o.rating ?? '',
          priceSymbol(o.price),
          o.mealType ?? '',
          o.location,
          o.lat ?? '',
          o.lng ?? '',
          o.notes,
          o.photoId ? 'yes' : 'no',
        ]
          .map(cell)
          .join(','),
      )
    }
  }
  return rows.join('\r\n')
}
