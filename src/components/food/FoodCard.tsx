import { relativeDays } from '../../domain/dates'
import { pluralize } from '../../domain/text'
import type { FoodSummary } from '../../domain/types'
import { useJournal } from '../../state/JournalProvider'
import { useToast } from '../../state/ToastProvider'
import { useUI } from '../../state/UIProvider'
import { FavouriteButton, FoodThumb } from '../ui/misc'
import { RatingDisplay } from '../ui/Rating'

/** Visual food card used by the gallery, favourites and discover views. */
export function FoodCard({ s, note }: { s: FoodSummary; note?: string }) {
  const { openFood } = useUI()
  const { repo } = useJournal()
  const toast = useToast()
  const f = s.food
  return (
    <article className="card">
      <button type="button" className="card-hit" onClick={() => openFood(f.id)} aria-label={`Open ${f.name}`} />
      <FoodThumb name={f.name} photoId={s.coverPhotoId} className="card-img" />
      <div className="card-fav">
        <FavouriteButton
          active={f.favourite}
          name={f.name}
          size={16}
          onToggle={() =>
            repo
              .updateFood(f.id, { favourite: !f.favourite })
              .then(() => toast.show(f.favourite ? `Removed ${f.name} from favourites` : `Added ${f.name} to favourites`))
              .catch(() => toast.error('Couldn’t update favourites.'))
          }
        />
      </div>
      <div className="card-body">
        <h3 className="card-title">
          {f.name}
          {f.isSample && <span className="chip chip-sample">Sample</span>}
        </h3>
        <div className="card-sub muted">{f.cuisine || 'No cuisine set'}</div>
        <div className="card-foot">
          <RatingDisplay value={s.avgRating} size="sm" />
          <span className="muted num">{s.timesEaten ? pluralize(s.timesEaten, 'time') : 'Want to try'}</span>
        </div>
        {note !== undefined ? (
          <div className="card-note faint">{note}</div>
        ) : (
          s.lastEaten && <div className="card-note faint">Last eaten {relativeDays(s.lastEaten)}</div>
        )}
      </div>
    </article>
  )
}

export function FoodGrid({ items, noteFor }: { items: FoodSummary[]; noteFor?: (s: FoodSummary) => string }) {
  return (
    <div className="grid">
      {items.map((s) => (
        <FoodCard key={s.food.id} s={s} note={noteFor?.(s)} />
      ))}
    </div>
  )
}
