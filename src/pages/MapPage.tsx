import { ArrowLeft, LocateFixed, MapPin, Navigation, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addBaseLayer, L, meIcon, placeIcon } from '../components/map/leaflet'
import { RatingDisplay } from '../components/ui/Rating'
import { formatDate, relativeDays } from '../domain/dates'
import { currentPosition } from '../domain/geocode'
import { buildPlaces, distanceMetres, formatDistance, unpinnedRestaurantCount, type LatLng, type Place } from '../domain/places'
import { formatRating } from '../domain/rating'
import { normalizeName, pluralize } from '../domain/text'
import { useJournal } from '../state/JournalProvider'
import { loadPhoto } from '../state/usePhoto'
import { useToast } from '../state/ToastProvider'
import { useUI } from '../state/UIProvider'

const RADII = [500, 1000, 2000, 5000] as const

export function MapPage() {
  const { data, status } = useJournal()
  const { openFood, openLog } = useUI()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const places = useMemo(() => buildPlaces(data.foods, data.occasions), [data])
  const unpinned = useMemo(() => unpinnedRestaurantCount(data.occasions), [data.occasions])

  const [me, setMe] = useState<(LatLng & { accuracy: number }) | null>(null)
  const [locating, setLocating] = useState(false)
  const [radius, setRadius] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [photos, setPhotos] = useState<Map<string, string>>(new Map())

  const selectedKey = params.get('place')
  const selected = places.find((p) => p.key === selectedKey) ?? null

  const select = useCallback(
    (key: string | null) =>
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev)
          if (key) n.set('place', key)
          else n.delete('place')
          n.delete('at')
          n.delete('name')
          return n
        },
        { replace: !!selectedKey === !!key },
      ),
    [setParams, selectedKey],
  )

  // Deep link from a meal: /map?at=lat,lng&name=… selects the matching place.
  useEffect(() => {
    const at = params.get('at')
    if (!at || !places.length) return
    const [lat, lng] = at.split(',').map(Number)
    const name = normalizeName(params.get('name') ?? '')
    const near = places
      .map((p) => ({ p, d: distanceMetres(p, { lat, lng }) + (normalizeName(p.name) === name ? 0 : 200) }))
      .sort((a, b) => a.d - b.d)[0]
    if (near && near.d < 500) select(near.p.key)
  }, [params, places, select])

  // Load cover photos for the marker bubbles.
  useEffect(() => {
    let live = true
    const ids = places.map((p) => p.photoId).filter((id): id is string => !!id && !photos.has(id))
    if (!ids.length) return
    Promise.all(ids.map(async (id) => [id, await loadPhoto(id)] as const)).then((pairs) => {
      if (!live) return
      setPhotos((prev) => {
        const next = new Map(prev)
        for (const [id, url] of pairs) if (url) next.set(id, url)
        return next
      })
    })
    return () => {
      live = false
    }
  }, [places, photos])

  const locate = useCallback(
    async (quiet = false) => {
      setLocating(true)
      try {
        const pos = await currentPosition()
        setMe(pos)
        setRadius((r) => r ?? 2000)
        return pos
      } catch (err) {
        if (!quiet) toast.error(err instanceof Error ? err.message : 'Couldn’t find your location.')
        return null
      } finally {
        setLocating(false)
      }
    },
    [toast],
  )

  // If location is already allowed, show "near me" straight away.
  useEffect(() => {
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((p) => {
        if (p.state === 'granted') locate(true)
      })
      .catch(() => {})
  }, [locate])

  const withDistance = useMemo(
    () => places.map((p) => ({ place: p, dist: me ? distanceMetres(me, p) : null })),
    [places, me],
  )

  const listed = useMemo(() => {
    const q = normalizeName(query)
    let rows = withDistance
    if (q) rows = rows.filter(({ place }) => normalizeName(`${place.name} ${place.location} ${place.foods.map((f) => f.name).join(' ')}`).includes(q))
    if (me && radius) rows = rows.filter((r) => r.dist! <= radius)
    return [...rows].sort((a, b) =>
      me ? a.dist! - b.dist! : b.place.lastDate.localeCompare(a.place.lastDate) || b.place.visits - a.place.visits,
    )
  }, [withDistance, query, me, radius])

  /* ---------- Leaflet ---------- */
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef<L.LayerGroup | null>(null)
  const meLayer = useRef<L.LayerGroup | null>(null)
  const fitted = useRef(false)

  useEffect(() => {
    if (!mapEl.current) return
    const m = L.map(mapEl.current, { zoomControl: false, worldCopyJump: true }).setView([30, 0], 2)
    addBaseLayer(m)
    L.control.zoom({ position: 'bottomright' }).addTo(m)
    markers.current = L.layerGroup().addTo(m)
    meLayer.current = L.layerGroup().addTo(m)
    map.current = m
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(mapEl.current)
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
      fitted.current = false
    }
  }, [])

  // Place markers.
  useEffect(() => {
    const layer = markers.current
    if (!layer) return
    layer.clearLayers()
    const shown = new Set(listed.map((r) => r.place.key))
    for (const p of places) {
      const isSel = p.key === selectedKey
      const mk = L.marker([p.lat, p.lng], {
        icon: placeIcon({ rating: p.avgRating, photo: p.photoId ? photos.get(p.photoId) : null, visits: p.visits, selected: isSel, name: p.name }),
        title: p.name,
        keyboard: true,
        opacity: shown.has(p.key) || isSel ? 1 : 0.35,
        zIndexOffset: isSel ? 1000 : p.visits,
        riseOnHover: true,
      })
      mk.bindTooltip(p.name, { direction: 'top', offset: [0, -22], className: 'pm-tip' })
      mk.on('click', () => select(p.key))
      layer.addLayer(mk)
    }
  }, [places, listed, photos, selectedKey, select])

  // First view: fit everything you've eaten at.
  useEffect(() => {
    const m = map.current
    if (!m || fitted.current || !places.length || selectedKey || params.get('at')) return
    fitted.current = true
    m.fitBounds(L.latLngBounds(places.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 15 })
  }, [places, selectedKey, params])

  // Your location.
  useEffect(() => {
    const layer = meLayer.current
    const m = map.current
    if (!layer || !m || !me) return
    layer.clearLayers()
    L.circle([me.lat, me.lng], { radius: Math.min(me.accuracy, 300), className: 'pm-accuracy', interactive: false }).addTo(layer)
    if (radius) L.circle([me.lat, me.lng], { radius, className: 'pm-radius', interactive: false }).addTo(layer)
    L.marker([me.lat, me.lng], { icon: meIcon, title: 'You are here', keyboard: false, zIndexOffset: 2000 }).addTo(layer)
  }, [me, radius])

  const flyToMe = useCallback(() => {
    const m = map.current
    if (!m || !me) return
    fitted.current = true
    const bounds = L.latLng(me.lat, me.lng).toBounds((radius ?? 1000) * 2)
    m.flyToBounds(bounds, { padding: [24, 24], duration: 0.6 })
  }, [me, radius])

  useEffect(() => {
    if (me && !selectedKey) flyToMe()
    // Only when location or radius changes, not when selection clears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, radius])

  // Selected place.
  useEffect(() => {
    const m = map.current
    if (!m || !selected) return
    fitted.current = true
    m.flyTo([selected.lat, selected.lng], Math.max(m.getZoom(), 15), { duration: 0.6 })
  }, [selected])

  const nearestDist = selected && me ? distanceMetres(me, selected) : null

  return (
    <div className="map-page">
      <aside className="map-side" aria-label="Places you’ve eaten">
        {selected ? (
          <PlaceDetail
            place={selected}
            distance={nearestDist}
            photo={selected.photoId ? photos.get(selected.photoId) : undefined}
            onBack={() => select(null)}
            onFood={openFood}
            onLog={() => openLog({ place: { restaurant: selected.isHome ? 'Home' : selected.name, lat: selected.lat, lng: selected.lng, location: selected.location } })}
          />
        ) : (
          <>
            <header className="map-head">
              <div>
                <h1>Map</h1>
                <p className="faint map-sub">
                  {places.length
                    ? `${pluralize(places.length, 'place')} you’ve eaten at`
                    : status === 'loading'
                      ? 'Loading…'
                      : 'Nothing pinned yet'}
                </p>
              </div>
              <button type="button" className={`btn ${me ? '' : 'btn-primary'}`} onClick={() => (me ? flyToMe() : locate())} disabled={locating}>
                <LocateFixed size={16} /> {locating ? 'Locating…' : 'Near me'}
              </button>
            </header>

            {me && (
              <div className="chip-row map-radius" role="group" aria-label="Distance from you">
                {RADII.map((r) => (
                  <button key={r} type="button" className="chip chip-toggle" aria-pressed={radius === r} onClick={() => setRadius(r)}>
                    {r < 1000 ? `${r} m` : `${r / 1000} km`}
                  </button>
                ))}
                <button type="button" className="chip chip-toggle" aria-pressed={radius == null} onClick={() => setRadius(null)}>
                  Any distance
                </button>
              </div>
            )}

            {places.length > 4 && (
              <label className="map-search">
                <Search size={15} aria-hidden />
                <input className="input-plain" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter places or dishes" aria-label="Filter places or dishes" />
              </label>
            )}

            <ul className="place-list" role="list">
              {listed.map(({ place, dist }) => (
                <li key={place.key}>
                  <button type="button" className="place-row" onClick={() => select(place.key)}>
                    <span className="place-bubble" aria-hidden>
                      {place.photoId && photos.get(place.photoId) ? <img src={photos.get(place.photoId)} alt="" /> : formatRating(place.avgRating) || '–'}
                    </span>
                    <span className="place-row-main">
                      <strong>{place.name}</strong>
                      <span className="faint">
                        {[dist != null ? formatDistance(dist) : null, `${pluralize(place.visits, 'visit')}`, place.foods[0]?.name].filter(Boolean).join(', ')}
                      </span>
                    </span>
                    {/* The bubble already shows the rating unless it holds a photo. */}
                    {place.photoId && photos.get(place.photoId) && <RatingDisplay value={place.avgRating} size="sm" showPips={false} />}
                  </button>
                </li>
              ))}
            </ul>

            {places.length > 0 && listed.length === 0 && (
              <p className="muted map-note">
                {me && radius ? (
                  <>
                    Nowhere you’ve eaten within {radius < 1000 ? `${radius} m` : `${radius / 1000} km`}.{' '}
                    <button type="button" className="link-btn" onClick={() => setRadius(RADII.find((r) => r > radius) ?? null)}>
                      Look further
                    </button>
                  </>
                ) : (
                  'No places match.'
                )}
              </p>
            )}

            {!places.length && status === 'ready' && (
              <div className="map-note">
                <MapPin size={20} className="faint" aria-hidden />
                <p className="muted">
                  Pin where you ate when you log a meal: tap <strong>I’m here now</strong> or <strong>Find on map</strong> under “Where”. Every pinned meal shows up here.
                </p>
              </div>
            )}
            {unpinned > 0 && (
              <p className="faint map-note map-note-sm">
                {pluralize(unpinned, 'restaurant')} in your journal {unpinned === 1 ? 'has' : 'have'} no pin yet. Edit a meal there to add one.
              </p>
            )}
          </>
        )}
      </aside>
      <div className="map-canvas" ref={mapEl} role="region" aria-label="Map of places you’ve eaten" />
    </div>
  )
}

function PlaceDetail({
  place,
  distance,
  photo,
  onBack,
  onFood,
  onLog,
}: {
  place: Place
  distance: number | null
  photo?: string
  onBack: () => void
  onFood: (id: string) => void
  onLog: () => void
}) {
  const dirs = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`
  return (
    <div className="place-detail">
      <button type="button" className="btn btn-sm btn-ghost place-back" onClick={onBack}>
        <ArrowLeft size={15} /> All places
      </button>
      {photo && <img className="place-photo" src={photo} alt={`Food at ${place.name}`} />}
      <h2>{place.name}</h2>
      <p className="faint">{[place.location, distance != null ? `${formatDistance(distance)} away` : null].filter(Boolean).join(', ')}</p>
      <div className="place-stats">
        <div>
          <RatingDisplay value={place.avgRating} />
          <span className="faint">average</span>
        </div>
        <div>
          <strong className="num">{place.visits}</strong>
          <span className="faint">{place.visits === 1 ? 'visit' : 'visits'}</span>
        </div>
        <div>
          <strong>{relativeDays(place.lastDate)}</strong>
          <span className="faint" title={formatDate(place.lastDate)}>
            last time
          </span>
        </div>
      </div>
      <div className="place-actions">
        <button type="button" className="btn btn-primary" onClick={onLog}>
          <Plus size={16} /> Log a meal here
        </button>
        {!place.isHome && (
          <a className="btn" href={dirs} target="_blank" rel="noreferrer">
            <Navigation size={15} /> Directions
          </a>
        )}
      </div>
      <h3 className="place-foods-head">What you’ve had here</h3>
      <ul className="place-foods" role="list">
        {place.foods.map((f) => (
          <li key={f.foodId}>
            <button type="button" className="place-food" onClick={() => onFood(f.foodId)}>
              <span className="place-food-name">{f.name}</span>
              <span className="faint num">{f.count}×</span>
              <RatingDisplay value={f.avgRating} size="sm" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
