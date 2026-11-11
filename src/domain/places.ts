import { averageRating } from './rating'
import { compareOccasionsDesc } from './summarize'
import { isHomeCooking, normalizeName } from './text'
import type { Food, ID, Occasion } from './types'

export interface LatLng {
  lat: number
  lng: number
}

export interface PlaceFood {
  foodId: ID
  name: string
  avgRating: number | null
  count: number
}

/** A pinned spot on the map: every meal eaten at one restaurant (or one unnamed spot). */
export interface Place extends LatLng {
  key: string
  name: string
  location: string
  isHome: boolean
  visits: number
  avgRating: number | null
  ratedCount: number
  lastDate: string
  /** Most recent meal photo taken here */
  photoId: ID | null
  /** Best rated first, then most eaten */
  foods: PlaceFood[]
}

/** Two meals with the same restaurant name closer than this are the same place. */
const SAME_PLACE_METRES = 300

export function hasCoords(o: Pick<Occasion, 'lat' | 'lng'>): o is { lat: number; lng: number } {
  return typeof o.lat === 'number' && typeof o.lng === 'number' && Number.isFinite(o.lat) && Number.isFinite(o.lng)
}

/** Great-circle distance in metres. */
export function distanceMetres(a: LatLng, b: LatLng): number {
  const R = 6_371_000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function formatDistance(m: number): string {
  if (m < 50) return 'Here'
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  if (m < 10_000) return `${(m / 1000).toFixed(1)} km`
  return `${Math.round(m / 1000)} km`
}

/** Group every pinned meal into places. Meals without a pin are left out. */
export function buildPlaces(foods: Food[], occasions: Occasion[]): Place[] {
  const foodName = new Map(foods.map((f) => [f.id, f.name]))
  const groups: { name: string; norm: string; anchor: LatLng; list: Occasion[] }[] = []

  for (const o of [...occasions].filter(hasCoords).sort(compareOccasionsDesc)) {
    const pt = { lat: o.lat as number, lng: o.lng as number }
    const norm = normalizeName(o.restaurant)
    const g = groups.find((g) => g.norm === norm && distanceMetres(g.anchor, pt) < (norm ? SAME_PLACE_METRES : 30))
    if (g) g.list.push(o)
    else groups.push({ name: o.restaurant.trim(), norm, anchor: pt, list: [o] })
  }

  return groups.map((g) => {
    const ratings = g.list.map((o) => o.rating).filter((r): r is number => r != null)
    const byFood = new Map<ID, Occasion[]>()
    for (const o of g.list) byFood.set(o.foodId, [...(byFood.get(o.foodId) ?? []), o])
    const placeFoods: PlaceFood[] = [...byFood].map(([foodId, list]) => ({
      foodId,
      name: foodName.get(foodId) ?? 'Unknown food',
      avgRating: averageRating(list.map((o) => o.rating).filter((r): r is number => r != null)),
      count: list.length,
    }))
    placeFoods.sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1) || b.count - a.count)
    return {
      key: `${g.norm || 'pin'}@${g.anchor.lat.toFixed(5)},${g.anchor.lng.toFixed(5)}`,
      name: g.name || g.list.find((o) => o.location)?.location || 'Unnamed spot',
      location: g.list.find((o) => o.location)?.location ?? '',
      isHome: isHomeCooking(g.name),
      lat: g.anchor.lat,
      lng: g.anchor.lng,
      visits: new Set(g.list.map((o) => o.date)).size,
      avgRating: averageRating(ratings),
      ratedCount: ratings.length,
      lastDate: g.list[0].date,
      photoId: g.list.find((o) => o.photoId)?.photoId ?? null,
      foods: placeFoods,
    }
  })
}

/** The latest pin used for a restaurant name, to prefill new meals logged there. */
export function lastPinFor(occasions: Occasion[], restaurant: string): (LatLng & { location: string }) | null {
  const norm = normalizeName(restaurant)
  if (!norm) return null
  let best: Occasion | null = null
  for (const o of occasions) {
    if (hasCoords(o) && normalizeName(o.restaurant) === norm && (!best || compareOccasionsDesc(o, best) < 0)) best = o
  }
  return best ? { lat: best.lat as number, lng: best.lng as number, location: best.location } : null
}

/** Number of distinct restaurants (not home) that have meals but no pin yet. */
export function unpinnedRestaurantCount(occasions: Occasion[]): number {
  const pinned = new Set(occasions.filter(hasCoords).map((o) => normalizeName(o.restaurant)))
  const all = new Set(occasions.filter((o) => o.restaurant && !isHomeCooking(o.restaurant)).map((o) => normalizeName(o.restaurant)))
  let n = 0
  for (const r of all) if (!pinned.has(r)) n++
  return n
}
