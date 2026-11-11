import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { formatRating } from '../../domain/rating'

export { L }

/** OpenStreetMap tiles (free, no key). CSS softens them so the pins carry the colour. */
export function addBaseLayer(map: L.Map) {
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Round "bubble" marker: the latest photo from that place, or its average rating. */
export function placeIcon(opts: { rating: number | null; photo?: string | null; visits: number; selected?: boolean; name: string }) {
  const size = Math.min(52, 34 + Math.round(Math.log2(opts.visits + 1) * 5)) + (opts.selected ? 8 : 0)
  const label = opts.rating != null ? formatRating(opts.rating) : '–'
  const inner = opts.photo
    ? `<img src="${esc(opts.photo)}" alt="" /><span class="pm-badge">${label}</span>`
    : `<span class="pm-score">${label}</span>`
  return L.divIcon({
    className: '',
    html: `<div class="pm${opts.selected ? ' pm-selected' : ''}${opts.photo ? ' pm-photo' : ''}" style="--pm:${size}px" aria-label="${esc(opts.name)}">${inner}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export const pinIcon = L.divIcon({
  className: '',
  html: '<div class="pm-drop"></div>',
  iconSize: [26, 34],
  iconAnchor: [13, 32],
})

export const meIcon = L.divIcon({
  className: '',
  html: '<div class="pm-me"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})
