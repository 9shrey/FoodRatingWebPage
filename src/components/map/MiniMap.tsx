import { useEffect, useRef } from 'react'
import { addBaseLayer, L, pinIcon } from './leaflet'

/** Small map with a draggable pin, used in the meal form. */
export default function MiniMap({ lat, lng, onMove }: { lat: number; lng: number; onMove: (lat: number, lng: number) => void }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: 'center' }).setView([lat, lng], 16)
    addBaseLayer(m)
    L.control.zoom({ position: 'topright' }).addTo(m)
    const mk = L.marker([lat, lng], { icon: pinIcon, draggable: true, keyboard: true, title: 'Meal location' }).addTo(m)
    mk.on('dragend', () => {
      const p = mk.getLatLng()
      onMoveRef.current(Math.round(p.lat * 1e6) / 1e6, Math.round(p.lng * 1e6) / 1e6)
    })
    map.current = m
    marker.current = mk
    // The dialog may still be animating open; re-measure once it settles.
    const t = setTimeout(() => m.invalidateSize(), 250)
    return () => {
      clearTimeout(t)
      m.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const mk = marker.current
    if (!mk || !map.current) return
    const cur = mk.getLatLng()
    if (cur.lat !== lat || cur.lng !== lng) {
      mk.setLatLng([lat, lng])
      map.current.setView([lat, lng], Math.max(map.current.getZoom(), 15))
    }
  }, [lat, lng])

  return <div ref={el} className="mini-map" />
}
