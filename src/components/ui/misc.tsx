import { Heart } from 'lucide-react'
import type { ReactNode } from 'react'
import { normalizeName } from '../../domain/text'
import { usePhoto } from '../../state/usePhoto'

export function FavouriteButton({
  active,
  onToggle,
  name,
  size = 18,
}: {
  active: boolean
  onToggle: () => void
  name: string
  size?: number
}) {
  return (
    <button
      type="button"
      className="fav-btn"
      aria-pressed={active}
      aria-label={active ? `Remove ${name} from favourites` : `Add ${name} to favourites`}
      data-tip={active ? 'Favourite' : 'Add to favourites'}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <Heart size={size} />
    </button>
  )
}

export function FavMark({ size = 14 }: { size?: number }) {
  return <Heart size={size} className="fav-mark" aria-label="Favourite" role="img" />
}

/** Porcelain glazes for photo-less foods ([tablecloth, rim]), picked deterministically from the name. */
const GLAZES: [string, string][] = [
  ['#e6edfa', '#1d4aa6'],
  ['#e9eef3', '#3d5a7a'],
  ['#fbf1d9', '#a26a00'],
  ['#fbe7e4', '#b23a31'],
  ['#e5f0ea', '#2f6b4f'],
  ['#ece9f6', '#2c4fb8'],
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w))
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** Food image: the photo if there is one, otherwise a monogrammed plate seen from above. */
export function FoodThumb({
  name,
  photoId,
  size,
  className = '',
  rounded,
}: {
  name: string
  photoId: string | null
  size?: number
  className?: string
  rounded?: boolean
}) {
  const photo = usePhoto(photoId)
  const [bg, ink] = GLAZES[hash(normalizeName(name)) % GLAZES.length]
  const style = {
    ...(size ? { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.34)) } : {}),
    ...(rounded ? { borderRadius: '50%' } : {}),
    '--thumb-bg': bg,
    '--thumb-ink': ink,
  } as React.CSSProperties
  return (
    <div className={`thumb ${photo ? '' : 'thumb-mono'} ${className}`} style={style} aria-hidden>
      {photo ? <img src={photo} alt="" loading="lazy" /> : <span className="thumb-initials">{initials(name)}</span>}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  children,
  actions,
  compact,
}: {
  icon?: ReactNode
  title: string
  children?: ReactNode
  actions?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={`empty ${compact ? 'empty-compact' : ''}`}>
      {icon && <div className="empty-icon">{icon}</div>}
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  )
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className = '',
}: {
  label: string
  hint?: string
  error?: string | null
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`field ${className}`}>
      <label className="field-label" htmlFor={htmlFor}>
        <span>{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </label>
      {children}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
