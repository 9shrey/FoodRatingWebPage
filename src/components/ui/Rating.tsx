import { Minus, Plus, X } from 'lucide-react'
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { formatRating, ratingLabel, RATING_MAX, RATING_STEP } from '../../domain/rating'

/** Fill fraction (0, 0.5 or 1) of star `i` (0-based) for a rating. */
function starFill(rating: number, i: number): number {
  return Math.max(0, Math.min(1, rating - i))
}

const STAR_PATH = 'M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96z'

/** One star; `fill` 0.5 draws the left half. */
function Star({ fill }: { fill: number }) {
  return (
    <span className="star">
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d={STAR_PATH} />
      </svg>
      {fill > 0 && (
        <svg viewBox="0 0 24 24" aria-hidden className="star-fill" style={{ clipPath: `inset(0 ${100 - fill * 100}% 0 0)` }}>
          <path d={STAR_PATH} />
        </svg>
      )}
    </span>
  )
}

/**
 * The signature rating display: a tabular number next to five stars.
 * Used everywhere a rating appears so scores read the same across the app.
 */
export function RatingDisplay({
  value,
  size = 'md',
  showPips = true,
  title,
}: {
  value: number | null
  size?: 'sm' | 'md' | 'lg'
  /** Show the stars next to the number */
  showPips?: boolean
  title?: string
}) {
  const label = value == null ? 'Not rated' : `${formatRating(value)} out of 5 stars`
  return (
    <span className={`rating rating-${size} ${value == null ? 'rating-none' : ''}`} title={title ?? label} aria-label={label} role="img">
      <span className="rating-num" aria-hidden>
        {showPips ? formatRating(value) : value == null ? '—' : `★ ${formatRating(value)}`}
      </span>
      {showPips && (
        <span className="stars" aria-hidden>
          {Array.from({ length: RATING_MAX }, (_, i) => (
            <Star key={i} fill={value == null ? 0 : starFill(value, i)} />
          ))}
        </span>
      )}
    </span>
  )
}

/**
 * Rating input: five stars, tap the left half of a star for a half star and the right half for a whole one.
 * Drag across to scrub. Keyboard: arrows ±½, Page Up/Down ±1, Home/End, 1–5, Delete clears.
 */
export function RatingInput({
  value,
  onChange,
  id,
  allowClear = true,
}: {
  value: number | null
  onChange: (v: number | null) => void
  id?: string
  allowClear?: boolean
}) {
  const track = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const fromPointer = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect()
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width - 0.01)
    const raw = (x / rect.width) * RATING_MAX
    // Round up to the next half step so tapping inside a cell's half selects it.
    return Math.max(RATING_STEP, Math.ceil(raw / RATING_STEP) * RATING_STEP)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    track.current?.setPointerCapture(e.pointerId)
    onChange(fromPointer(e.clientX))
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) onChange(fromPointer(e.clientX))
  }
  const onPointerUp = () => {
    dragging.current = false
  }

  const step = (delta: number) => {
    const base = value ?? (delta > 0 ? 0 : RATING_MAX + RATING_STEP)
    onChange(Math.min(RATING_MAX, Math.max(RATING_STEP, base + delta)))
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const map: Record<string, () => void> = {
      ArrowRight: () => step(RATING_STEP),
      ArrowUp: () => step(RATING_STEP),
      ArrowLeft: () => step(-RATING_STEP),
      ArrowDown: () => step(-RATING_STEP),
      PageUp: () => step(1),
      PageDown: () => step(-1),
      Home: () => onChange(RATING_STEP),
      End: () => onChange(RATING_MAX),
      Delete: () => allowClear && onChange(null),
      Backspace: () => allowClear && onChange(null),
    }
    if (map[e.key]) {
      e.preventDefault()
      map[e.key]()
    } else if (/^[1-5]$/.test(e.key)) {
      e.preventDefault()
      onChange(Number(e.key))
    }
  }

  return (
    <div className="rating-input">
      <div className="rating-input-row">
        <div
          ref={track}
          id={id}
          className="rating-track"
          role="slider"
          tabIndex={0}
          aria-label="Rating out of 5 stars"
          aria-valuemin={0.5}
          aria-valuemax={RATING_MAX}
          aria-valuenow={value ?? undefined}
          aria-valuetext={value == null ? 'Not rated' : `${formatRating(value)} out of 5 stars, ${ratingLabel(value)}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        >
          {Array.from({ length: RATING_MAX }, (_, i) => (
            <Star key={i} fill={value == null ? 0 : starFill(value, i)} />
          ))}
        </div>
        <div className="rating-readout" aria-hidden>
          <strong>{formatRating(value)}</strong>
          <span>{ratingLabel(value)}</span>
        </div>
      </div>
      <div className="rating-steppers">
        <button type="button" className="btn btn-sm" onClick={() => step(-RATING_STEP)} aria-label="Lower by half a star" data-tip="−½">
          <Minus size={14} />
        </button>
        <button type="button" className="btn btn-sm" onClick={() => step(RATING_STEP)} aria-label="Raise by half a star" data-tip="+½">
          <Plus size={14} />
        </button>
        {allowClear && value != null && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange(null)}>
            <X size={14} /> Clear rating
          </button>
        )}
      </div>
    </div>
  )
}
