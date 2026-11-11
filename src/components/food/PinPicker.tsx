import { LocateFixed, MapPin, Search, X } from 'lucide-react'
import { lazy, Suspense, useRef, useState } from 'react'
import { currentPosition, reverseLookup, searchPlaces, type GeoResult } from '../../domain/geocode'
import { isHomeCooking } from '../../domain/text'
import { useToast } from '../../state/ToastProvider'
import type { OccasionDraft } from './OccasionFields'

const MiniMap = lazy(() => import('../map/MiniMap'))

interface Props {
  draft: OccasionDraft
  onChange: (patch: Partial<OccasionDraft>) => void
}

/** Pin a meal to a spot on the map: current location, place search, or drag the pin. */
export function PinPicker({ draft, onChange }: Props) {
  const toast = useToast()
  const [locating, setLocating] = useState(false)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const pinned = draft.lat != null && draft.lng != null

  const useMyLocation = async () => {
    setLocating(true)
    try {
      const pos = await currentPosition()
      onChange({ lat: pos.lat, lng: pos.lng, pinSource: 'manual' })
      setSearching(false)
      if (!draft.location) {
        const here = await reverseLookup(pos)
        if (here?.area) onChange({ location: here.area })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t find your location.')
    } finally {
      setLocating(false)
    }
  }

  const openSearch = () => {
    const name = isHomeCooking(draft.restaurant) ? '' : draft.restaurant
    setQuery([name, draft.location].filter(Boolean).join(', '))
    setResults(null)
    setSearching(true)
  }

  const runSearch = async () => {
    const q = query.trim()
    if (!q) return
    abort.current?.abort()
    abort.current = new AbortController()
    setBusy(true)
    try {
      const near = pinned ? { lat: draft.lat as number, lng: draft.lng as number } : null
      setResults(await searchPlaces(q, near, abort.current.signal))
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast.error(err instanceof Error ? err.message : 'Search failed.')
    } finally {
      setBusy(false)
    }
  }

  const pick = (r: GeoResult) => {
    onChange({
      lat: r.lat,
      lng: r.lng,
      pinSource: 'manual',
      location: draft.location || r.area,
      ...(draft.restaurant ? {} : { restaurant: r.name }),
    })
    setSearching(false)
    setResults(null)
  }

  return (
    <div className="pin-picker">
      {pinned && (
        <div className="pin-preview">
          <Suspense fallback={<div className="mini-map" />}>
            <MiniMap
              lat={draft.lat as number}
              lng={draft.lng as number}
              onMove={(lat, lng) => onChange({ lat, lng, pinSource: 'manual' })}
            />
          </Suspense>
          <div className="pin-preview-bar">
            <MapPin size={14} aria-hidden />
            <span className="pin-preview-text">
              {draft.pinSource === 'auto' ? 'Pinned from your last visit' : 'Pinned'}
              {draft.location && <span className="faint">, {draft.location}</span>}
            </span>
            <span className="faint pin-hint hide-mobile">Drag the pin to adjust</span>
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              aria-label="Remove map pin"
              data-tip="Remove pin"
              onClick={() => onChange({ lat: null, lng: null, pinSource: null })}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {searching ? (
        <div className="pin-search">
          <div className="pin-search-row">
            <input
              className="input"
              value={query}
              placeholder="Restaurant name and area"
              aria-label="Search for a place"
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  runSearch()
                }
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  setSearching(false)
                }
              }}
            />
            <button type="button" className="btn" onClick={runSearch} disabled={busy || !query.trim()}>
              {busy ? 'Searching…' : 'Search'}
            </button>
            <button type="button" className="icon-btn" aria-label="Close search" onClick={() => setSearching(false)}>
              <X size={16} />
            </button>
          </div>
          {results && (
            <ul className="pin-results" role="list">
              {results.length === 0 && <li className="faint pin-empty">No places found. Try adding the area or city.</li>}
              {results.map((r) => (
                <li key={`${r.lat},${r.lng}`}>
                  <button type="button" className="pin-result" onClick={() => pick(r)}>
                    <MapPin size={14} aria-hidden />
                    <span>
                      <strong>{r.name}</strong>
                      <span className="faint pin-result-full">{r.full}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="chip-row">
          <button type="button" className="chip chip-toggle" onClick={useMyLocation} disabled={locating}>
            <LocateFixed size={13} /> {locating ? 'Finding you…' : pinned ? 'Use my location instead' : 'I’m here now'}
          </button>
          <button type="button" className="chip chip-toggle" onClick={openSearch}>
            <Search size={13} /> {pinned ? 'Search again' : 'Find on map'}
          </button>
        </div>
      )}
    </div>
  )
}
