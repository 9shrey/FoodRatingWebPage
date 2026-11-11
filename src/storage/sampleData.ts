import { addDays, toLocalDate } from '../domain/dates'
import { normalizeRating } from '../domain/rating'
import type { Food, MealType, Occasion, PriceTier } from '../domain/types'

/**
 * Development sample data. Every record is flagged `isSample` so the app can label
 * it clearly and remove it in one click. Dates are relative to today so analytics
 * always have recent activity to show.
 */

interface SampleFood {
  name: string
  cuisine: string
  description?: string
  favourite?: boolean
  /** typical rating, out of 5 */
  base: number
  /** number of times eaten (0 = want to try) */
  times: number
  places: string[]
  meal: MealType
  /** price tier, 0 for want-to-try foods */
  price: 0 | PriceTier
}

const FOODS: SampleFood[] = [
  { name: 'Chicken biryani', cuisine: 'Indian', favourite: true, base: 4.4, times: 12, places: ['Bawarchi', 'Dishoom', 'Home'], meal: 'dinner', price: 3, description: 'Hyderabadi dum style, layered and sealed.' },
  { name: 'Masala dosa', cuisine: 'Indian', favourite: true, base: 4.3, times: 6, places: ['Saravana Bhavan'], meal: 'breakfast', price: 2 },
  { name: 'Butter chicken', cuisine: 'Indian', base: 4, times: 5, places: ['Dishoom', 'Tandoor House'], meal: 'dinner', price: 3 },
  { name: 'Pani puri', cuisine: 'Indian', favourite: true, base: 4.5, times: 4, places: ['Chaat Corner'], meal: 'lunch', price: 1 },
  { name: 'Gulab jamun', cuisine: 'Indian', base: 4.2, times: 3, places: ['Tandoor House', 'Home'], meal: 'dinner', price: 1 },
  { name: 'Tonkotsu ramen', cuisine: 'Japanese', favourite: true, base: 4.5, times: 7, places: ['Ippudo', 'Kanada-Ya'], meal: 'dinner', price: 3 },
  { name: 'Salmon nigiri', cuisine: 'Japanese', base: 4.35, times: 4, places: ['Sushi Sora'], meal: 'lunch', price: 2 },
  { name: 'Chicken katsu curry', cuisine: 'Japanese', base: 3.8, times: 5, places: ['Wagamama', 'Kanada-Ya'], meal: 'lunch', price: 3 },
  { name: 'Matcha soft serve', cuisine: 'Japanese', base: 4.45, times: 2, places: ['Tsujiri'], meal: 'dinner', price: 1 },
  { name: 'Okonomiyaki', cuisine: 'Japanese', base: 3.95, times: 1, places: ['Abeno'], meal: 'dinner', price: 3 },
  { name: 'Pad kra pao', cuisine: 'Thai', favourite: true, base: 4.25, times: 5, places: ['Som Saa', 'Kiln'], meal: 'lunch', price: 2 },
  { name: 'Green curry', cuisine: 'Thai', base: 3.9, times: 3, places: ['Som Saa'], meal: 'dinner', price: 3 },
  { name: 'Mango sticky rice', cuisine: 'Thai', base: 4.3, times: 2, places: ['Kiln'], meal: 'dinner', price: 2 },
  { name: 'Margherita pizza', cuisine: 'Italian', base: 4.05, times: 6, places: ['Franco Manca', 'Pizza Pilgrims'], meal: 'dinner', price: 2 },
  { name: 'Cacio e pepe', cuisine: 'Italian', base: 4.15, times: 2, places: ['Padella'], meal: 'dinner', price: 2 },
  { name: 'Tiramisu', cuisine: 'Italian', base: 4.1, times: 3, places: ['Padella', 'Home'], meal: 'dinner', price: 2 },
  { name: 'Al pastor tacos', cuisine: 'Mexican', base: 4.2, times: 3, places: ['El Pastor'], meal: 'dinner', price: 2 },
  { name: 'Churros', cuisine: 'Spanish', base: 3.7, times: 2, places: ['Borough Market'], meal: 'lunch', price: 1 },
  { name: 'Xiaolongbao', cuisine: 'Chinese', favourite: true, base: 4.45, times: 4, places: ['Din Tai Fung'], meal: 'lunch', price: 2 },
  { name: 'Dan dan noodles', cuisine: 'Chinese', base: 4.1, times: 3, places: ['Barshu'], meal: 'lunch', price: 2 },
  { name: 'Bibimbap', cuisine: 'Korean', base: 3.85, times: 2, places: ['Bibimbap Soho'], meal: 'lunch', price: 2 },
  { name: 'Korean fried chicken', cuisine: 'Korean', base: 3.6, times: 3, places: ['Bonchon'], meal: 'dinner', price: 2 },
  { name: 'Pho bo', cuisine: 'Vietnamese', base: 4, times: 3, places: ['Pho Viet'], meal: 'lunch', price: 2 },
  { name: 'Falafel wrap', cuisine: 'Middle Eastern', base: 3.5, times: 4, places: ['Hoxton Beach', 'Borough Market'], meal: 'lunch', price: 2 },
  { name: 'Shakshuka', cuisine: 'Middle Eastern', base: 3.75, times: 2, places: ['Ottolenghi', 'Home'], meal: 'breakfast', price: 2 },
  { name: 'Salted caramel brownie', cuisine: 'American', base: 4, times: 2, places: ['Gail’s'], meal: 'lunch', price: 1 },
  { name: 'Smash burger', cuisine: 'American', base: 3.65, times: 4, places: ['Bleecker', 'Five Guys'], meal: 'dinner', price: 2 },
  { name: 'Crisps & dip', cuisine: 'British', base: 2.75, times: 3, places: ['Home'], meal: 'lunch', price: 1 },
  { name: 'Sausage roll', cuisine: 'British', base: 3.1, times: 3, places: ['Greggs'], meal: 'lunch', price: 1 },
  { name: 'Injera with misir wat', cuisine: 'Ethiopian', base: 0, times: 0, places: [], meal: 'dinner', price: 0 },
  { name: 'Khachapuri', cuisine: 'Georgian', base: 0, times: 0, places: [], meal: 'lunch', price: 0 },
  { name: 'Laksa', cuisine: 'Malaysian', base: 0, times: 0, places: [], meal: 'lunch', price: 0 },
]

/** Small deterministic PRNG so sample data is stable between loads. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const NOTES = [
  'Better than last time.',
  'Generous portion.',
  'A little too salty today.',
  'Shared with friends.',
  'Perfect on a cold evening.',
  'Would order the same again.',
  '',
  '',
  '',
]

/** Approximate London coordinates so the sample map has something on it. */
const PINS: Record<string, [number, number, string]> = {
  Dishoom: [51.5124, -0.1269, 'Covent Garden, London'],
  Bawarchi: [51.556, -0.2797, 'Wembley, London'],
  'Saravana Bhavan': [51.539, 0.051, 'East Ham, London'],
  'Tandoor House': [51.5205, -0.17, 'Marylebone, London'],
  'Chaat Corner': [51.5125, -0.379, 'Southall, London'],
  Ippudo: [51.517, -0.1205, 'Holborn, London'],
  'Kanada-Ya': [51.5154, -0.1275, 'St Giles, London'],
  'Sushi Sora': [51.5145, -0.144, 'Mayfair, London'],
  Wagamama: [51.5103, -0.134, 'Soho, London'],
  Tsujiri: [51.5115, -0.131, 'Chinatown, London'],
  Abeno: [51.5185, -0.125, 'Bloomsbury, London'],
  'Som Saa': [51.5185, -0.073, 'Spitalfields, London'],
  Kiln: [51.512, -0.135, 'Soho, London'],
  'Franco Manca': [51.462, -0.114, 'Brixton, London'],
  'Pizza Pilgrims': [51.514, -0.136, 'Soho, London'],
  Padella: [51.5052, -0.0905, 'Borough, London'],
  'El Pastor': [51.505, -0.0885, 'London Bridge, London'],
  'Borough Market': [51.5055, -0.091, 'Borough, London'],
  'Din Tai Fung': [51.5115, -0.122, 'Covent Garden, London'],
  Barshu: [51.513, -0.131, 'Soho, London'],
  'Bibimbap Soho': [51.515, -0.133, 'Soho, London'],
  Bonchon: [51.51, -0.128, 'Leicester Square, London'],
  'Pho Viet': [51.525, -0.087, 'Shoreditch, London'],
  'Hoxton Beach': [51.5265, -0.079, 'Hoxton, London'],
  Ottolenghi: [51.537, -0.103, 'Islington, London'],
  'Gail’s': [51.522, -0.158, 'Marylebone, London'],
  Bleecker: [51.5175, -0.079, 'Spitalfields, London'],
  'Five Guys': [51.511, -0.125, 'Covent Garden, London'],
  Greggs: [51.5155, -0.1415, 'Oxford Circus, London'],
}

export function buildSampleData(today = toLocalDate()): { foods: Food[]; occasions: Occasion[] } {
  const rand = rng(42)
  const foods: Food[] = []
  const occasions: Occasion[] = []
  let n = 0

  FOODS.forEach((f, i) => {
    const foodId = `sample-food-${i + 1}`
    // Spread first tries over the last ~14 months; later list items skew more recent.
    const firstOffset = Math.round(20 + rand() * 400)
    const createdDate = f.times ? addDays(today, -firstOffset) : addDays(today, -Math.round(rand() * 40))
    foods.push({
      id: foodId,
      name: f.name,
      cuisine: f.cuisine,
      description: f.description ?? '',
      favourite: !!f.favourite,
      createdAt: `${createdDate}T12:00:00.000Z`,
      updatedAt: `${createdDate}T12:00:00.000Z`,
      isSample: true,
    })

    for (let k = 0; k < f.times; k++) {
      // First occasion on the first-try date, the rest spread towards today.
      const offset = k === 0 ? firstOffset : Math.round(firstOffset * (1 - k / f.times) * (0.6 + rand() * 0.4))
      const date = addDays(today, -Math.max(0, offset))
      const noise = (rand() - 0.5) * 0.8
      const rating = normalizeRating(f.base + noise)
      n++
      const restaurant = f.places[Math.floor(rand() * f.places.length)] ?? ''
      const pin = PINS[restaurant]
      occasions.push({
        id: `sample-occ-${n}`,
        foodId,
        restaurant,
        date,
        rating: rand() < 0.06 ? null : rating,
        notes: NOTES[Math.floor(rand() * NOTES.length)],
        photoId: null,
        price: f.price || null,
        mealType: f.meal,
        location: pin?.[2] ?? '',
        lat: pin?.[0] ?? null,
        lng: pin?.[1] ?? null,
        custom: {},
        createdAt: `${date}T12:00:00.000Z`,
        updatedAt: `${date}T12:00:00.000Z`,
        isSample: true,
      })
    }
  })
  return { foods, occasions }
}
