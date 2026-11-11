import { Bookmark, MapPin, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { hasCoords } from '../../domain/places'
import { averageRating, formatRating } from '../../domain/rating'
import { formatDate, formatDateShort, relativeDays } from '../../domain/dates'
import { cleanText, distinctByFrequency, normalizeName, pluralize } from '../../domain/text'
import { MEAL_LABELS, priceSymbol, type FoodSummary, type Occasion } from '../../domain/types'
import { useJournal } from '../../state/JournalProvider'
import { useToast } from '../../state/ToastProvider'
import { useUI } from '../../state/UIProvider'
import { usePhoto } from '../../state/usePhoto'
import { useUnsavedWarning } from '../../state/useUnsavedWarning'
import { SuggestInput } from '../ui/Combobox'
import { Dialog } from '../ui/Dialog'
import { EmptyState, FavouriteButton, Field, FoodThumb } from '../ui/misc'
import { Popover } from '../ui/Popover'
import { RatingDisplay } from '../ui/Rating'
import {
  draftFromOccasion,
  draftToOccasion,
  OccasionFields,
  validateOccasionDraft,
  type DraftErrors,
  type OccasionDraft,
} from './OccasionFields'

export function FoodDetailPanel() {
  const { openFoodId, closeFood } = useUI()
  const { byId, status } = useJournal()
  const summary = openFoodId ? byId.get(openFoodId) : undefined

  // A link to a food that no longer exists: quietly drop the param.
  useEffect(() => {
    if (status === 'ready' && openFoodId && !summary) closeFood()
  }, [status, openFoodId, summary, closeFood])

  if (!summary) return null
  return <FoodDetail key={summary.food.id} summary={summary} />
}

interface FoodDraft {
  name: string
  cuisine: string
  description: string
}

const toDraft = (s: FoodSummary): FoodDraft => ({
  name: s.food.name,
  cuisine: s.food.cuisine,
  description: s.food.description,
})

function FoodDetail({ summary }: { summary: FoodSummary }) {
  const { repo, summaries, cuisines } = useJournal()
  const { closeFood, confirm, openLog } = useUI()
  const toast = useToast()
  const { food } = summary
  const [draft, setDraft] = useState<FoodDraft>(() => toDraft(summary))
  const [nameError, setNameError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Occasion | null>(null)
  const [saving, setSaving] = useState(false)
  const cover = usePhoto(summary.coverPhotoId)

  const base = toDraft(summary)
  const dirty = JSON.stringify(base) !== JSON.stringify(draft)
  useUnsavedWarning(dirty)

  const requestClose = async () => {
    if (dirty) {
      const ok = await confirm({
        title: 'Discard your changes?',
        message: `Your edits to ${food.name} haven’t been saved.`,
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        danger: true,
      })
      if (!ok) return
    }
    closeFood()
  }

  const saveDetails = async () => {
    const name = cleanText(draft.name)
    if (!name) return setNameError('Give the food a name.')
    const clash = summaries.find((s) => s.food.id !== food.id && normalizeName(s.food.name) === normalizeName(name))
    if (clash) return setNameError(`You already have “${clash.food.name}”.`)
    setNameError(null)
    setSaving(true)
    try {
      await repo.updateFood(food.id, { ...draft, name, description: draft.description.trim() })
      toast.show('Changes saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t save changes.')
    } finally {
      setSaving(false)
    }
  }

  const toggleFav = async () => {
    try {
      await repo.updateFood(food.id, { favourite: !food.favourite })
      toast.show(food.favourite ? `Removed ${food.name} from favourites` : `Added ${food.name} to favourites`)
    } catch {
      toast.error('Couldn’t update favourites.')
    }
  }

  const deleteFood = async () => {
    const ok = await confirm({
      title: `Delete ${food.name}?`,
      message: summary.timesEaten
        ? `This removes the food and all ${pluralize(summary.timesEaten, 'logged meal')}, including their photos and notes.`
        : 'This removes the food from your journal.',
      confirmLabel: 'Delete food',
      danger: true,
    })
    if (!ok) return
    try {
      const snap = await repo.deleteFood(food.id)
      closeFood()
      toast.show(`Deleted ${food.name}`, {
        action: { label: 'Undo', onClick: () => repo.restore(snap).then(() => toast.show('Restored')) },
      })
    } catch {
      toast.error('Couldn’t delete this food.')
    }
  }

  const deleteOccasion = async (o: Occasion) => {
    const ok = await confirm({
      title: 'Delete this meal?',
      message: `The ${formatDate(o.date)} entry${o.restaurant ? ` at ${o.restaurant}` : ''} will be removed. The food stays in your journal.`,
      confirmLabel: 'Delete meal',
      danger: true,
    })
    if (!ok) return
    try {
      const snap = await repo.deleteOccasion(o.id)
      toast.show('Meal deleted', { action: { label: 'Undo', onClick: () => repo.restore(snap) } })
    } catch {
      toast.error('Couldn’t delete this meal.')
    }
  }

  const byPlace = useMemo(() => {
    const names = distinctByFrequency(summary.occasions.map((o) => o.restaurant))
    return names.map((n) => {
      const list = summary.occasions.filter((o) => normalizeName(o.restaurant) === normalizeName(n))
      return { name: n, count: list.length, avg: averageRating(list.map((o) => o.rating)) }
    })
  }, [summary.occasions])

  return (
    <>
      <Dialog
        open
        variant="side"
        onRequestClose={requestClose}
        title={
          <div className="detail-title">
            <h2>{food.name}</h2>
            {food.isSample && <span className="chip chip-sample">Sample</span>}
          </div>
        }
        headerExtra={
          <>
            <FavouriteButton active={food.favourite} onToggle={toggleFav} name={food.name} />
            <Popover
              align="right"
              trigger={(p) => (
                <button type="button" className="icon-btn" aria-label="More actions" {...p}>
                  <MoreHorizontal size={18} />
                </button>
              )}
            >
              {(close) => (
                <button
                  type="button"
                  className="menu-item danger"
                  onClick={() => {
                    close()
                    deleteFood()
                  }}
                >
                  <Trash2 size={15} /> Delete food
                </button>
              )}
            </Popover>
          </>
        }
        footer={
          dirty ? (
            <>
              <span className="muted" style={{ fontSize: 13 }}>
                Unsaved changes
              </span>
              <span className="spacer" />
              <button type="button" className="btn" onClick={() => setDraft(base)}>
                Revert
              </button>
              <button type="button" className="btn btn-primary" onClick={saveDetails} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          ) : undefined
        }
      >
        <div className="detail">
          <section className="detail-hero">
            {cover ? (
              <img className="detail-cover" src={cover} alt={`${food.name}, most recent photo`} />
            ) : (
              <FoodThumb name={food.name} photoId={null} size={72} />
            )}
            <div className="detail-score">
              <RatingDisplay value={summary.avgRating} size="lg" />
              <span className="muted">
                {summary.ratedCount
                  ? `Average of ${pluralize(summary.ratedCount, 'rated meal')}`
                  : summary.timesEaten
                    ? 'No ratings yet'
                    : 'On your want-to-try list'}
              </span>
            </div>
          </section>

          <dl className="stat-strip">
            <div>
              <dt>Times eaten</dt>
              <dd className="num">{summary.timesEaten}</dd>
            </div>
            <div>
              <dt>First tried</dt>
              <dd>{formatDateShort(summary.firstTried)}</dd>
            </div>
            <div>
              <dt>Last eaten</dt>
              <dd title={summary.lastEaten ? formatDate(summary.lastEaten) : undefined}>{relativeDays(summary.lastEaten)}</dd>
            </div>
            <div>
              <dt>Best</dt>
              <dd className="num">{formatRating(summary.bestRating)}</dd>
            </div>
          </dl>

          <button type="button" className="btn btn-primary btn-lg detail-log" onClick={() => openLog({ foodId: food.id })}>
            <Plus size={16} /> {summary.timesEaten ? 'Log it again' : 'Log first time'}
          </button>

          <section className="detail-section">
            <h3>Meals</h3>
            {summary.occasions.length === 0 ? (
              <EmptyState compact icon={<Bookmark size={20} />} title="Not tried yet">
                Log it when you have it, and your rating and notes will show up here.
              </EmptyState>
            ) : (
              <ul className="occ-list">
                {summary.occasions.map((o) => (
                  <OccasionRow key={o.id} o={o} onEdit={() => setEditing(o)} onDelete={() => deleteOccasion(o)} />
                ))}
              </ul>
            )}
          </section>

          {byPlace.length > 1 && (
            <section className="detail-section">
              <h3>By place</h3>
              <ul className="place-list">
                {byPlace.map((p) => (
                  <li key={p.name}>
                    <span>{p.name}</span>
                    <span className="muted num">{p.count}×</span>
                    <RatingDisplay value={p.avg} size="sm" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="detail-section">
            <h3>Details</h3>
            <div className="form-stack">
              <Field label="Name" error={nameError} htmlFor="fd-name">
                <input
                  id="fd-name"
                  className="input"
                  value={draft.name}
                  aria-invalid={!!nameError || undefined}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </Field>
              <Field label="Cuisine" htmlFor="fd-cuisine">
                <SuggestInput id="fd-cuisine" value={draft.cuisine} onChange={(v) => setDraft((d) => ({ ...d, cuisine: v }))} suggestions={cuisines} />
              </Field>
              <Field label="Description" htmlFor="fd-desc">
                <textarea
                  id="fd-desc"
                  className="textarea"
                  value={draft.description}
                  placeholder="What is it? How is it usually made or served?"
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                />
              </Field>
              <p className="faint" style={{ fontSize: 12 }}>
                Added {formatDate(food.createdAt.slice(0, 10))}
              </p>
            </div>
          </section>
        </div>
      </Dialog>
      {editing && <EditOccasionDialog occasion={editing} foodName={food.name} onClose={() => setEditing(null)} />}
    </>
  )
}

function OccasionRow({ o, onEdit, onDelete }: { o: Occasion; onEdit: () => void; onDelete: () => void }) {
  const photo = usePhoto(o.photoId)
  const pinned = hasCoords(o)
  const meta = [o.mealType ? MEAL_LABELS[o.mealType] : null, priceSymbol(o.price), pinned ? null : o.location].filter(Boolean)
  const mapHref = pinned ? `/map?${new URLSearchParams({ at: `${o.lat},${o.lng}`, name: o.restaurant })}` : null
  return (
    <li className="occ">
      <div className="occ-main">
        <div className="occ-top">
          <strong>{formatDate(o.date)}</strong>
          {mapHref ? (
            <Link to={mapHref} className="occ-place" data-tip="Show on map">
              <MapPin size={13} aria-hidden />
              {[o.restaurant, o.location].filter(Boolean).join(', ') || 'Pinned spot'}
            </Link>
          ) : (
            <span className="muted">{o.restaurant || 'Unknown place'}</span>
          )}
          <span className="occ-rating">
            <RatingDisplay value={o.rating} size="sm" />
          </span>
        </div>
        {meta.length > 0 && <div className="occ-meta faint">{meta.join(', ')}</div>}
        {o.notes && <p className="occ-notes">{o.notes}</p>}
      </div>
      {photo && <img className="occ-photo" src={photo} alt={`Photo from ${formatDate(o.date)}`} loading="lazy" />}
      <div className="occ-actions">
        <button type="button" className="icon-btn icon-btn-sm" aria-label={`Edit meal on ${formatDate(o.date)}`} data-tip="Edit" onClick={onEdit}>
          <Pencil size={14} />
        </button>
        <button type="button" className="icon-btn icon-btn-sm" aria-label={`Delete meal on ${formatDate(o.date)}`} data-tip="Delete" onClick={onDelete}>
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  )
}

function EditOccasionDialog({ occasion, foodName, onClose }: { occasion: Occasion; foodName: string; onClose: () => void }) {
  const { repo, byId } = useJournal()
  const { confirm } = useUI()
  const toast = useToast()
  const [initial] = useState(() => draftFromOccasion(occasion))
  const [draft, setDraft] = useState<OccasionDraft>(initial)
  const [errors, setErrors] = useState<DraftErrors>({})
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(initial) !== JSON.stringify(draft)
  useUnsavedWarning(dirty)

  const requestClose = async () => {
    if (dirty && !(await confirm({ title: 'Discard your changes?', message: 'Your edits to this meal haven’t been saved.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', danger: true }))) return
    onClose()
  }

  const save = async () => {
    const e = validateOccasionDraft(draft)
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    let newPhoto: string | null = null
    try {
      const payload = await draftToOccasion(draft, async (url) => (newPhoto = await repo.savePhoto(url)))
      await repo.updateOccasion(occasion.id, payload)
      toast.show('Meal updated')
      onClose()
    } catch (err) {
      if (newPhoto) await repo.deletePhoto(newPhoto).catch(() => {})
      toast.error(err instanceof Error ? err.message : 'Couldn’t save this meal.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onRequestClose={requestClose}
      title={
        <div>
          <h2>Edit meal</h2>
          <span className="muted" style={{ fontSize: 13 }}>
            {foodName}
          </span>
        </div>
      }
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn hide-mobile" onClick={requestClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save meal'}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <OccasionFields
          draft={draft}
          onChange={(p) => setDraft((d) => ({ ...d, ...p }))}
          errors={errors}
          recentPlaces={byId.get(occasion.foodId)?.restaurants ?? []}
          detailsOpenByDefault
        />
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

