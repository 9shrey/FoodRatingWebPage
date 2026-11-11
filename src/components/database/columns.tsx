import type { ColumnDef } from '@tanstack/react-table'
import { Pencil } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { formatDate, formatDateShort, relativeDays } from '../../domain/dates'
import { cleanText, normalizeName } from '../../domain/text'
import { priceSymbol, PRICE_LABELS, type Food, type FoodSummary, type PriceTier } from '../../domain/types'
import { useJournal } from '../../state/JournalProvider'
import { useToast } from '../../state/ToastProvider'
import { useUI } from '../../state/UIProvider'
import { SuggestInput } from '../ui/Combobox'
import { FavouriteButton, FoodThumb } from '../ui/misc'
import { RatingDisplay } from '../ui/Rating'

/** Shared save handler for inline edits. Returns an error message or null. */
function useInlineSave() {
  const { repo, summaries } = useJournal()
  const toast = useToast()
  return async (food: Food, field: 'name' | 'cuisine', value: string): Promise<string | null> => {
    const v = cleanText(value)
    if (v === food[field]) return null
    if (field === 'name') {
      if (!v) return 'A name is required.'
      if (summaries.some((s) => s.food.id !== food.id && normalizeName(s.food.name) === normalizeName(v))) {
        return 'That name is already used.'
      }
    }
    try {
      await repo.updateFood(food.id, { [field]: v })
      toast.show(`Updated ${field}`, {
        action: { label: 'Undo', onClick: () => repo.updateFood(food.id, { [field]: food[field] }) },
      })
      return null
    } catch {
      return 'Couldn’t save.'
    }
  }
}

/**
 * Click-to-edit text cell. Enter or blur saves, Escape cancels.
 * `trigger` controls whether a single click or only the pencil starts editing.
 */
function EditableCell({
  food,
  field,
  suggestions,
  children,
  label,
}: {
  food: Food
  field: 'name' | 'cuisine'
  suggestions?: string[]
  children?: React.ReactNode
  label: string
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(food[field])
  const [error, setError] = useState<string | null>(null)
  const save = useInlineSave()
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editing) setValue(food[field])
  }, [food, field, editing])

  const commit = async () => {
    const err = await save(food, field, value)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setEditing(false)
  }
  const cancel = () => {
    setValue(food[field])
    setError(null)
    setEditing(false)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }

  if (editing) {
    return (
      <div
        ref={wrap}
        className="cell-edit"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          if (!wrap.current?.contains(e.relatedTarget as Node)) commit()
        }}
        title={error ?? undefined}
      >
        {suggestions ? (
          <SuggestInput value={value} onChange={setValue} suggestions={suggestions} autoFocus ariaLabel={label} />
        ) : (
          <input className="input" value={value} onChange={(e) => setValue(e.target.value)} autoFocus aria-label={label} aria-invalid={!!error || undefined} />
        )}
        {error && <span className="cell-error">{error}</span>}
      </div>
    )
  }

  if (field === 'name') {
    return (
      <span className="cell-name-edit">
        {children}
        <button
          type="button"
          className="icon-btn icon-btn-sm cell-pencil"
          aria-label={`Rename ${food.name}`}
          data-tip="Rename"
          onClick={(e) => {
            e.stopPropagation()
            setEditing(true)
          }}
        >
          <Pencil size={13} />
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      className="cell-editable"
      aria-label={`${label}: ${food[field] || 'empty'}. Click to edit`}
      onClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
    >
      {food[field] || <span className="faint">Add</span>}
    </button>
  )
}

function NameCell({ s }: { s: FoodSummary }) {
  const { openFood } = useUI()
  return (
    <div className="cell-name">
      <FoodThumb name={s.food.name} photoId={s.coverPhotoId} size={40} />
      <EditableCell food={s.food} field="name" label="Food name">
        <button
          type="button"
          className="cell-name-link"
          onClick={(e) => {
            e.stopPropagation()
            openFood(s.food.id)
          }}
        >
          {s.food.name}
        </button>
        {s.food.isSample && <span className="chip chip-sample">Sample</span>}
      </EditableCell>
    </div>
  )
}

function FavCell({ s }: { s: FoodSummary }) {
  const { repo } = useJournal()
  const toast = useToast()
  return (
    <FavouriteButton
      active={s.food.favourite}
      name={s.food.name}
      size={16}
      onToggle={() =>
        repo.updateFood(s.food.id, { favourite: !s.food.favourite }).catch(() => toast.error('Couldn’t update favourites.'))
      }
    />
  )
}

function CuisineCell({ s }: { s: FoodSummary }) {
  const { cuisines } = useJournal()
  return <EditableCell food={s.food} field="cuisine" suggestions={cuisines} label="Cuisine" />
}

/** Sort helper: nulls always last regardless of direction. */
const nullable = <T,>(v: T | null | undefined) => (v == null ? undefined : v)

export const COLUMN_LABELS: Record<string, string> = {
  select: 'Select',
  name: 'Food',
  restaurant: 'Restaurant',
  cuisine: 'Cuisine',
  rating: 'Rating',
  timesEaten: 'Times eaten',
  firstTried: 'First tried',
  lastEaten: 'Last eaten',
  favourite: 'Favourite',
  latestRating: 'Latest rating',
  avgPrice: 'Price',
  added: 'Added',
}

export const DEFAULT_VISIBILITY: Record<string, boolean> = { latestRating: false, avgPrice: false, added: false }

export const columns: ColumnDef<FoodSummary, unknown>[] = [
  {
    id: 'select',
    enableSorting: false,
    enableHiding: false,
    size: 44,
    header: ({ table }) => (
      <input
        type="checkbox"
        className="row-check"
        aria-label="Select all rows"
        checked={table.getIsAllRowsSelected()}
        ref={(el) => {
          if (el) el.indeterminate = table.getIsSomeRowsSelected()
        }}
        onChange={table.getToggleAllRowsSelectedHandler()}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        className="row-check"
        aria-label={`Select ${row.original.food.name}`}
        checked={row.getIsSelected()}
        onClick={(e) => e.stopPropagation()}
        onChange={row.getToggleSelectedHandler()}
      />
    ),
  },
  {
    id: 'name',
    accessorFn: (s) => s.food.name.toLowerCase(),
    header: 'Food',
    enableHiding: false,
    size: 240,
    cell: ({ row }) => <NameCell s={row.original} />,
  },
  {
    id: 'restaurant',
    accessorFn: (s) => nullable(s.topRestaurant?.toLowerCase()),
    sortUndefined: 'last',
    header: 'Restaurant',
    size: 180,
    cell: ({ row }) => {
      const s = row.original
      if (!s.topRestaurant) return <span className="faint">—</span>
      return (
        <span className="cell-restaurant" title={s.restaurants.join(', ')}>
          <span className="truncate">{s.topRestaurant}</span>
          {s.restaurants.length > 1 && <span className="faint num">+{s.restaurants.length - 1}</span>}
        </span>
      )
    },
  },
  {
    id: 'cuisine',
    accessorFn: (s) => nullable(s.food.cuisine.toLowerCase() || null),
    sortUndefined: 'last',
    header: 'Cuisine',
    size: 140,
    cell: ({ row }) => <CuisineCell s={row.original} />,
  },
  {
    id: 'rating',
    accessorFn: (s) => nullable(s.avgRating),
    sortUndefined: 'last',
    sortDescFirst: true,
    header: 'Rating',
    size: 150,
    meta: { tip: 'Average of every rated meal' },
    cell: ({ row }) => <RatingDisplay value={row.original.avgRating} />,
  },
  {
    id: 'timesEaten',
    accessorFn: (s) => s.timesEaten,
    sortDescFirst: true,
    header: 'Eaten',
    size: 80,
    meta: { align: 'right', tip: 'Number of times eaten' },
    cell: ({ row }) => <span className="num">{row.original.timesEaten || <span className="faint">0</span>}</span>,
  },
  {
    id: 'firstTried',
    accessorFn: (s) => nullable(s.firstTried),
    sortUndefined: 'last',
    sortDescFirst: true,
    header: 'First tried',
    size: 120,
    cell: ({ row }) => <span title={formatDate(row.original.firstTried)}>{formatDateShort(row.original.firstTried)}</span>,
  },
  {
    id: 'lastEaten',
    accessorFn: (s) => nullable(s.lastEaten),
    sortUndefined: 'last',
    sortDescFirst: true,
    header: 'Last eaten',
    size: 120,
    cell: ({ row }) => (
      <span title={formatDate(row.original.lastEaten)}>{row.original.lastEaten ? relativeDays(row.original.lastEaten) : <span className="faint">Not yet</span>}</span>
    ),
  },
  {
    id: 'latestRating',
    accessorFn: (s) => nullable(s.latestRating),
    sortUndefined: 'last',
    sortDescFirst: true,
    header: 'Latest rating',
    size: 120,
    cell: ({ row }) => <RatingDisplay value={row.original.latestRating} showPips={false} />,
  },
  {
    id: 'avgPrice',
    accessorFn: (s) => {
      const tiers = s.occasions.map((o) => o.price).filter((p): p is PriceTier => p != null)
      return tiers.length ? Math.round(tiers.reduce((a, b) => a + b, 0) / tiers.length) : undefined
    },
    sortUndefined: 'last',
    header: 'Price',
    size: 90,
    meta: { tip: 'Typical price' },
    cell: ({ getValue }) => {
      const v = getValue() as PriceTier | undefined
      return v == null ? <span className="faint">—</span> : <span title={PRICE_LABELS[v]}>{priceSymbol(v)}</span>
    },
  },
  {
    id: 'added',
    accessorFn: (s) => s.food.createdAt,
    sortDescFirst: true,
    header: 'Added',
    size: 110,
    cell: ({ row }) => formatDateShort(row.original.food.createdAt.slice(0, 10)),
  },
  {
    id: 'favourite',
    accessorFn: (s) => (s.food.favourite ? 1 : 0),
    sortDescFirst: true,
    header: 'Fav',
    size: 64,
    meta: { align: 'center', tip: 'Favourite' },
    cell: ({ row }) => <FavCell s={row.original} />,
  },
]

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    align?: 'left' | 'right' | 'center'
    tip?: string
  }
}
