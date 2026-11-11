import type { LatLng } from './places'

/**
 * Place search and "what's here" lookups via OpenStreetMap Nominatim.
 * Free, no key; their policy asks for low volume (about 1 request/second),
 * so these only run on explicit user actions.
 */
const BASE = 'https://nominatim.openstreetmap.org'

export interface GeoResult extends LatLng {
  name: string
  /** Short "area, city" label */
  area: string
  full: string
}

interface NominatimItem {
  lat: string
  lon: string
  name?: string
  display_name: string
  address?: Record<string, string>
}

function areaFrom(a: Record<string, string> | undefined): string {
  if (!a) return ''
  const local = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? a.village ?? a.town
  const city = a.city ?? a.town ?? a.county ?? a.state
  return [local, city].filter((v, i, arr) => v && arr.indexOf(v) === i).join(', ')
}

function toResult(i: NominatimItem): GeoResult {
  return {
    lat: Number(i.lat),
    lng: Number(i.lon),
    name: i.name || i.display_name.split(',')[0],
    area: areaFrom(i.address),
    full: i.display_name,
  }
}

export async function searchPlaces(query: string, near?: LatLng | null, signal?: AbortSignal): Promise<GeoResult[]> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', limit: '6' })
  if (near) {
    // Prefer results around the user without excluding the rest of the world.
    const d = 0.3
    params.set('viewbox', [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(','))
  }
  const res = await fetch(`${BASE}/search?${params}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('Place search is unavailable right now.')
  return ((await res.json()) as NominatimItem[]).map(toResult)
}

export async function reverseLookup(pt: LatLng, signal?: AbortSignal): Promise<GeoResult | null> {
  const params = new URLSearchParams({ lat: String(pt.lat), lon: String(pt.lng), format: 'jsonv2', addressdetails: '1', zoom: '18' })
  try {
    const res = await fetch(`${BASE}/reverse?${params}`, { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const item = (await res.json()) as NominatimItem & { error?: string }
    return item.error ? null : toResult(item)
  } catch {
    return null
  }
}

/** Browser geolocation as a promise, with friendly errors. */
export function currentPosition(): Promise<LatLng & { accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('This browser can’t share your location.'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Location access is blocked. Allow it for this site in your browser settings.'
              : 'Couldn’t find your location. Try again in a moment.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    )
  })
}
