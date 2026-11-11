import { RotateCcw } from 'lucide-react'
import { useMemo } from 'react'
import { countActiveFilters, EMPTY_FILTERS, type FoodFilters } from '../../domain/filters'
import { formatRating } from '../../domain/rating'
import { distinctByFrequency, normalizeName } from '../../domain/text'
import { useJournal } from '../../state/JournalProvider'

const RATING_OPTIONS = Array.from({ length: 10 }, (_, i) => (i + 1) / 2)

function toggle(list: string[], v: string): string[] {
  return list.some((x) => normalizeName(x) === normalizeName(v)) ? list.filter((x) => normalizeName(x) !== normalizeName(v)) : [...list, v]
}

function ChipGroup({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  if (!options.length) return null
  return (
    <fieldset className="filter-group">
      <legend>{label}</legend>
      <div className="chip-row chip-row-scroll">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className="chip chip-toggle"
            aria-pressed={selected.some((s) => normalizeName(s) === normalizeName(o))}
            onClick={() => onChange(toggle(selected, o))}
          >
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function FiltersPanel({ filters, onChange }: { filters: FoodFilters; onChange: (f: FoodFilters) => void }) {
  const { data } = useJournal()
  const set = (patch: Partial<FoodFilters>) => onChange({ ...filters, ...patch })
  // Only offer values that exist in the journal.
  const cuisines = useMemo(() => distinctByFrequency(data.foods.map((f) => f.cuisine)), [data.foods])
  const restaurants = useMemo(() => distinctByFrequency(data.occasions.map((o) => o.restaurant)), [data.occasions])
  const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.floor(Number(v))))

  return (
    <div className="filters">
      <div className="filters-grid">
        <fieldset className="filter-group">
          <legend>Show</legend>
          <div className="segmented segmented-block" role="radiogroup" aria-label="Status">
            {(
              [
                ['all', 'All'],
                ['tried', 'Tried'],
                ['want', 'Want to try'],
              ] as const
            ).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={filters.status === v} onClick={() => set({ status: v })}>
                {l}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="filter-group">
          <legend>Favourites</legend>
          <div className="segmented segmented-block" role="radiogroup" aria-label="Favourites">
            {(
              [
                ['any', 'Any'],
                ['only', 'Only'],
                ['exclude', 'Hide'],
              ] as const
            ).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={filters.favourite === v} onClick={() => set({ favourite: v })}>
                {l}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="filter-group">
          <legend>Average rating</legend>
          <div className="range-row">
            <select className="select" aria-label="Minimum rating" value={filters.ratingMin ?? ''} onChange={(e) => set({ ratingMin: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Any</option>
              {RATING_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {formatRating(r)}
                </option>
              ))}
            </select>
            <span className="muted">to</span>
            <select className="select" aria-label="Maximum rating" value={filters.ratingMax ?? ''} onChange={(e) => set({ ratingMax: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Any</option>
              {RATING_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {formatRating(r)}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
        <fieldset className="filter-group">
          <legend>Times eaten</legend>
          <div className="range-row">
            <input className="input" type="number" min={0} inputMode="numeric" placeholder="Min" aria-label="Minimum times eaten" value={filters.timesMin ?? ''} onChange={(e) => set({ timesMin: num(e.target.value) })} />
            <span className="muted">to</span>
            <input className="input" type="number" min={0} inputMode="numeric" placeholder="Max" aria-label="Maximum times eaten" value={filters.timesMax ?? ''} onChange={(e) => set({ timesMax: num(e.target.value) })} />
          </div>
        </fieldset>
        <fieldset className="filter-group filter-wide">
          <legend>Eaten between</legend>
          <div className="range-row">
            <input className="input" type="date" aria-label="From date" value={filters.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} />
            <span className="muted">and</span>
            <input className="input" type="date" aria-label="To date" value={filters.dateTo} onChange={(e) => set({ dateTo: e.target.value })} />
          </div>
        </fieldset>
      </div>
      <ChipGroup label="Cuisine" options={cuisines} selected={filters.cuisines} onChange={(cuisines) => set({ cuisines })} />
      <ChipGroup label="Restaurant" options={restaurants} selected={filters.restaurants} onChange={(restaurants) => set({ restaurants })} />
      <div className="filters-foot">
        <button type="button" className="btn btn-ghost" disabled={!countActiveFilters(filters)} onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}>
          <RotateCcw size={14} /> Reset filters
        </button>
      </div>
    </div>
  )
}

/** Removable summary chips for the active filters. */
export function ActiveFilterChips({ filters, onChange }: { filters: FoodFilters; onChange: (f: FoodFilters) => void }) {
  const chips: { key: string; label: string; clear: () => FoodFilters }[] = []
  const f = filters
  if (f.status !== 'all') chips.push({ key: 'status', label: f.status === 'tried' ? 'Tried' : 'Want to try', clear: () => ({ ...f, status: 'all' }) })
  if (f.favourite !== 'any') chips.push({ key: 'fav', label: f.favourite === 'only' ? 'Favourites' : 'Not favourites', clear: () => ({ ...f, favourite: 'any' }) })
  if (f.ratingMin != null || f.ratingMax != null)
    chips.push({ key: 'rating', label: `Rating ${f.ratingMin != null ? formatRating(f.ratingMin) : '0.5'}–${f.ratingMax != null ? formatRating(f.ratingMax) : '5'}`, clear: () => ({ ...f, ratingMin: null, ratingMax: null }) })
  if (f.timesMin != null || f.timesMax != null)
    chips.push({ key: 'times', label: `Eaten ${f.timesMin ?? 0}${f.timesMax != null ? `–${f.timesMax}` : '+'} times`, clear: () => ({ ...f, timesMin: null, timesMax: null }) })
  if (f.dateFrom || f.dateTo) chips.push({ key: 'date', label: `Eaten ${f.dateFrom || '…'} → ${f.dateTo || 'today'}`, clear: () => ({ ...f, dateFrom: '', dateTo: '' }) })
  for (const c of f.cuisines) chips.push({ key: `c-${c}`, label: c, clear: () => ({ ...f, cuisines: f.cuisines.filter((x) => x !== c) }) })
  for (const c of f.restaurants) chips.push({ key: `r-${c}`, label: `at ${c}`, clear: () => ({ ...f, restaurants: f.restaurants.filter((x) => x !== c) }) })
  if (!chips.length) return null
  return (
    <div className="active-filters" aria-label="Active filters">
      {chips.map((c) => (
        <span key={c.key} className="chip chip-accent">
          {c.label}
          <button type="button" aria-label={`Remove filter ${c.label}`} onClick={() => onChange(c.clear())}>
            ×
          </button>
        </span>
      ))}
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange({ ...EMPTY_FILTERS, query: f.query })}>
        Clear all
      </button>
    </div>
  )
}
