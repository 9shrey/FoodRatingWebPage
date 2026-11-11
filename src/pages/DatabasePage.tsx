import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnOrderState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Columns3,
  Heart,
  HeartOff,
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  Table2,
  Trash2,
  Utensils,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { COLUMN_LABELS, columns, DEFAULT_VISIBILITY } from '../components/database/columns'
import { ActiveFilterChips, FiltersPanel } from '../components/database/FiltersPanel'
import { FoodTable } from '../components/database/FoodTable'
import { FoodGrid } from '../components/food/FoodCard'
import { Dialog } from '../components/ui/Dialog'
import { EmptyState, FavouriteButton, FoodThumb } from '../components/ui/misc'
import { Popover } from '../components/ui/Popover'
import { RatingDisplay } from '../components/ui/Rating'
import { relativeDays } from '../domain/dates'
import { applyFilters, countActiveFilters, EMPTY_FILTERS, type FoodFilters } from '../domain/filters'
import { pluralize } from '../domain/text'
import type { FoodSummary } from '../domain/types'
import { useJournal } from '../state/JournalProvider'
import { useToast } from '../state/ToastProvider'
import { useUI } from '../state/UIProvider'
import { useIsMobile, usePersistentState } from '../state/usePersistentState'
import { SampleBanner } from '../layout/SampleBanner'

const SORT_PRESETS: { label: string; sorting: SortingState }[] = [
  { label: 'Last eaten', sorting: [{ id: 'lastEaten', desc: true }] },
  { label: 'Highest rated', sorting: [{ id: 'rating', desc: true }] },
  { label: 'Most eaten', sorting: [{ id: 'timesEaten', desc: true }] },
  { label: 'Name A–Z', sorting: [{ id: 'name', desc: false }] },
  { label: 'First tried', sorting: [{ id: 'firstTried', desc: true }] },
  { label: 'Recently added', sorting: [{ id: 'added', desc: true }] },
]

const DEFAULT_ORDER = columns.map((c) => c.id!)

export function DatabasePage() {
  const { summaries, status, data, repo, hasSample } = useJournal()
  const { openLog, confirm } = useUI()
  const toast = useToast()
  const isMobile = useIsMobile()
  const [view, setView] = usePersistentState<'table' | 'gallery'>('view', 'table')
  const [filters, setFilters] = usePersistentState<FoodFilters>('filters', EMPTY_FILTERS)
  const [sorting, setSorting] = usePersistentState<SortingState>('sorting', [{ id: 'lastEaten', desc: true }])
  const [visibility, setVisibility] = usePersistentState<VisibilityState>('columns', DEFAULT_VISIBILITY)
  const [order, setOrder] = usePersistentState<ColumnOrderState>('columnOrder', DEFAULT_ORDER)
  const [selection, setSelection] = useState<RowSelectionState>({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [params, setParams] = useSearchParams()
  const searchRef = useRef<HTMLInputElement>(null)

  // Deep links: /foods?cuisine=Japanese, ?restaurant=Ippudo, ?q=..., ?favourites=1
  useEffect(() => {
    const cuisine = params.get('cuisine')
    const restaurant = params.get('restaurant')
    const q = params.get('q')
    const fav = params.get('favourites')
    if (!cuisine && !restaurant && q == null && !fav) return
    setFilters({
      ...EMPTY_FILTERS,
      query: q ?? '',
      cuisines: cuisine ? [cuisine] : [],
      restaurants: restaurant ? [restaurant] : [],
      favourite: fav ? 'only' : 'any',
    })
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        ;['cuisine', 'restaurant', 'q', 'favourites'].forEach((k) => n.delete(k))
        return n
      },
      { replace: true },
    )
  }, [params, setParams, setFilters])

  // "/" focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !/input|textarea|select/i.test(t.tagName) && !t.isContentEditable && !document.querySelector('dialog[open]')) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filtered = useMemo(() => applyFilters(summaries, filters), [summaries, filters])
  // Keep column order valid if columns are added in a later version.
  const safeOrder = useMemo(() => [...order.filter((id) => DEFAULT_ORDER.includes(id)), ...DEFAULT_ORDER.filter((id) => !order.includes(id))], [order])

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnVisibility: visibility, columnOrder: safeOrder, rowSelection: selection },
    getRowId: (s) => s.food.id,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    onColumnOrderChange: setOrder,
    onRowSelectionChange: setSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableMultiSort: true,
    maxMultiSortColCount: 3,
  })

  const rows = table.getRowModel().rows
  const selectedIds = Object.keys(selection).filter((id) => selection[id] && filtered.some((s) => s.food.id === id))
  const activeCount = countActiveFilters(filters)
  const occasionsShown = filtered.reduce((n, s) => n + s.timesEaten, 0)

  const bulkFavourite = async (fav: boolean) => {
    try {
      await Promise.all(selectedIds.map((id) => repo.updateFood(id, { favourite: fav })))
      toast.show(fav ? `Added ${pluralize(selectedIds.length, 'food')} to favourites` : `Removed ${pluralize(selectedIds.length, 'food')} from favourites`)
      setSelection({})
    } catch {
      toast.error('Couldn’t update favourites.')
    }
  }

  const bulkDelete = async () => {
    const meals = filtered.filter((s) => selectedIds.includes(s.food.id)).reduce((n, s) => n + s.timesEaten, 0)
    const ok = await confirm({
      title: `Delete ${pluralize(selectedIds.length, 'food')}?`,
      message: `This also removes ${pluralize(meals, 'logged meal')} and their photos.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      const snap = await repo.deleteFoods(selectedIds)
      setSelection({})
      toast.show(`Deleted ${pluralize(snap.foods.length, 'food')}`, { action: { label: 'Undo', onClick: () => repo.restore(snap) } })
    } catch {
      toast.error('Couldn’t delete those foods.')
    }
  }

  const sortLabel = SORT_PRESETS.find((p) => JSON.stringify(p.sorting) === JSON.stringify(sorting))?.label ?? (sorting.length ? 'Custom sort' : 'Unsorted')
  const effectiveView = view

  if (status === 'loading') return <DatabaseSkeleton />

  if (data.foods.length === 0) {
    return (
      <div className="page">
        <EmptyState
          icon={<Utensils size={22} />}
          title="Start your food journal"
          actions={
            <>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => openLog()}>
                <Plus size={16} /> Log your first meal
              </button>
              <button
                type="button"
                className="btn btn-lg"
                onClick={() => repo.loadSampleData().then(() => toast.show('Sample data loaded. Remove it any time from the banner or the Data menu.'))}
              >
                Explore with sample data
              </button>
            </>
          }
        >
          Log what you eat, rate it out of 5 stars, and this becomes your personal food catalogue — searchable, sortable and full of patterns.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="page page-wide">
      <header className="page-head">
        <div>
          <h1>Foods</h1>
          <p className="muted page-sub">
            {pluralize(filtered.length, 'food')} from {pluralize(occasionsShown, 'meal')}
            {filtered.length !== summaries.length && <> (of {summaries.length})</>}
          </p>
        </div>
      </header>

      {hasSample && <SampleBanner />}

      <div className="toolbar" role="toolbar" aria-label="Database tools">
        <div className="input-wrap toolbar-search">
          <Search size={16} />
          <input
            ref={searchRef}
            className="input"
            type="search"
            placeholder="Search foods, places, notes…"
            aria-label="Search"
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
          />
          {filters.query && (
            <button type="button" className="icon-btn icon-btn-sm search-clear" aria-label="Clear search" onClick={() => setFilters({ ...filters, query: '' })}>
              <X size={14} />
            </button>
          )}
          {!filters.query && !isMobile && <kbd className="search-kbd">/</kbd>}
        </div>

        {isMobile ? (
          <button type="button" className={`btn ${activeCount ? 'is-active' : ''}`} onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal size={15} /> Filters {activeCount > 0 && <span className="count">{activeCount}</span>}
          </button>
        ) : (
          <Popover
            width={600}
            trigger={(p) => (
              <button type="button" className={`btn ${activeCount ? 'is-active' : ''}`} {...p}>
                <SlidersHorizontal size={15} /> Filters {activeCount > 0 && <span className="count">{activeCount}</span>}
              </button>
            )}
          >
            {() => <FiltersPanel filters={filters} onChange={setFilters} />}
          </Popover>
        )}

        <Popover
          trigger={(p) => (
            <button type="button" className="btn" {...p} aria-label={`Sort: ${sortLabel}`} data-tip={isMobile ? undefined : 'Shift-click column headers for multi-sort'}>
              <ArrowUpDown size={15} /> <span className="hide-mobile">{sortLabel}</span>
              <span className="show-mobile">Sort</span>
            </button>
          )}
        >
          {(close) => (
            <div role="menu" aria-label="Sort by">
              {SORT_PRESETS.map((p) => {
                const active = JSON.stringify(p.sorting) === JSON.stringify(sorting)
                return (
                  <button
                    key={p.label}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    className="menu-item"
                    onClick={() => {
                      setSorting(p.sorting)
                      close()
                    }}
                  >
                    <span style={{ width: 16 }}>{active && <Check size={15} />}</span>
                    {p.label}
                  </button>
                )
              })}
              {sorting.length > 0 && (
                <>
                  <div className="menu-sep" />
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => setSorting(sorting.map((s) => ({ ...s, desc: !s.desc })))}
                  >
                    {sorting[0].desc ? <ArrowUp size={15} /> : <ArrowDown size={15} />} Reverse order
                  </button>
                </>
              )}
            </div>
          )}
        </Popover>

        {effectiveView === 'table' && !isMobile && (
          <Popover
            align="right"
            width={260}
            trigger={(p) => (
              <button type="button" className="btn" {...p} data-tip="Show, hide and reorder columns">
                <Columns3 size={15} /> Columns
              </button>
            )}
          >
            {() => <ColumnsMenu table={table} onReset={() => { setVisibility(DEFAULT_VISIBILITY); setOrder(DEFAULT_ORDER) }} />}
          </Popover>
        )}

        <div className="toolbar-spacer" />

        <div className="segmented" role="group" aria-label="View">
          <button type="button" aria-pressed={effectiveView === 'table'} onClick={() => setView('table')} data-tip={isMobile ? undefined : 'Table'} aria-label={isMobile ? 'List view' : 'Table view'}>
            {isMobile ? <List size={15} /> : <Table2 size={15} />}
            <span className="hide-mobile">Table</span>
          </button>
          <button type="button" aria-pressed={effectiveView === 'gallery'} onClick={() => setView('gallery')} data-tip={isMobile ? undefined : 'Gallery'} aria-label="Gallery view">
            <LayoutGrid size={15} />
            <span className="hide-mobile">Gallery</span>
          </button>
        </div>
      </div>

      <ActiveFilterChips filters={filters} onChange={setFilters} />

      {selectedIds.length > 0 && effectiveView === 'table' && !isMobile && (
        <div className="bulk-bar" role="region" aria-label="Bulk actions">
          <strong>{pluralize(selectedIds.length, 'food')} selected</strong>
          <button type="button" className="btn btn-sm" onClick={() => bulkFavourite(true)}>
            <Heart size={14} /> Favourite
          </button>
          <button type="button" className="btn btn-sm" onClick={() => bulkFavourite(false)}>
            <HeartOff size={14} /> Unfavourite
          </button>
          <button type="button" className="btn btn-sm btn-danger-quiet" onClick={bulkDelete}>
            <Trash2 size={14} /> Delete
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSelection({})}>
            Clear selection
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          compact
          icon={<Search size={20} />}
          title="No foods match"
          actions={
            <>
              <button type="button" className="btn" onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear search and filters
              </button>
              {filters.query.trim() && (
                <button type="button" className="btn btn-primary" onClick={() => openLog({ name: filters.query.trim() })}>
                  <Plus size={15} /> Log “{filters.query.trim()}”
                </button>
              )}
            </>
          }
        >
          {activeCount ? `Nothing fits ${pluralize(activeCount, 'active filter')}${filters.query ? ' and your search' : ''}.` : 'Nothing matches your search.'}
        </EmptyState>
      ) : effectiveView === 'gallery' ? (
        <FoodGrid items={rows.map((r) => r.original)} />
      ) : isMobile ? (
        <MobileList items={rows.map((r) => r.original)} />
      ) : (
        <FoodTable table={table} />
      )}

      <Dialog open={filtersOpen} onRequestClose={() => setFiltersOpen(false)} title="Filters" footer={<button type="button" className="btn btn-primary" onClick={() => setFiltersOpen(false)}>Show {pluralize(filtered.length, 'food')}</button>}>
        <FiltersPanel filters={filters} onChange={setFilters} />
      </Dialog>
    </div>
  )
}

function ColumnsMenu({ table, onReset }: { table: ReturnType<typeof useReactTable<FoodSummary>>; onReset: () => void }) {
  const cols = table.getAllLeafColumns().filter((c) => c.id !== 'select')
  const order = table.getState().columnOrder
  const move = (id: string, dir: -1 | 1) => {
    const next = [...order]
    const i = next.indexOf(id)
    // Skip over the fixed select column.
    let j = i + dir
    while (next[j] === 'select') j += dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    table.setColumnOrder(next)
  }
  const sorted = [...cols].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
  return (
    <div>
      <div className="menu-label">Show and reorder columns</div>
      <ul className="col-list">
        {sorted.map((c, i) => (
          <li key={c.id}>
            <label className="check">
              <input type="checkbox" checked={c.getIsVisible()} disabled={!c.getCanHide()} onChange={c.getToggleVisibilityHandler()} />
              {COLUMN_LABELS[c.id] ?? c.id}
            </label>
            <span className="col-move">
              <button type="button" className="icon-btn icon-btn-sm" aria-label={`Move ${COLUMN_LABELS[c.id]} up`} disabled={i === 0} onClick={() => move(c.id, -1)}>
                <ArrowUp size={13} />
              </button>
              <button type="button" className="icon-btn icon-btn-sm" aria-label={`Move ${COLUMN_LABELS[c.id]} down`} disabled={i === sorted.length - 1} onClick={() => move(c.id, 1)}>
                <ArrowDown size={13} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="menu-sep" />
      <button type="button" className="menu-item" onClick={onReset}>
        Reset columns
      </button>
    </div>
  )
}

function MobileList({ items }: { items: FoodSummary[] }) {
  const { openFood } = useUI()
  const { repo } = useJournal()
  return (
    <ul className="m-list">
      {items.map((s) => (
        <li key={s.food.id} className="m-item">
          <button type="button" className="m-hit" onClick={() => openFood(s.food.id)} aria-label={`Open ${s.food.name}`} />
          <FoodThumb name={s.food.name} photoId={s.coverPhotoId} size={48} />
          <div className="m-main">
            <div className="m-name">
              {s.food.name}
              {s.food.isSample && <span className="chip chip-sample">Sample</span>}
            </div>
            <div className="m-sub muted">
              {[s.food.cuisine, s.topRestaurant].filter(Boolean).join(', ') || 'No details yet'}
            </div>
            <div className="m-sub faint">{s.timesEaten ? `${pluralize(s.timesEaten, 'time')}, last ${relativeDays(s.lastEaten)}` : 'Want to try'}</div>
          </div>
          <div className="m-side">
            <RatingDisplay value={s.avgRating} size="sm" showPips={false} />
            <FavouriteButton active={s.food.favourite} name={s.food.name} size={17} onToggle={() => repo.updateFood(s.food.id, { favourite: !s.food.favourite })} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function DatabaseSkeleton() {
  return (
    <div className="page page-wide" aria-busy="true" aria-label="Loading your journal">
      <div className="skeleton" style={{ width: 220, height: 30, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 36, marginBottom: 16 }} />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 44, marginBottom: 6, opacity: 1 - i * 0.1 }} />
      ))}
    </div>
  )
}
