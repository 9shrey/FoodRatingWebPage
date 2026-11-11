import { Bookmark, Plus, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { formatRating } from '../../domain/rating'
import { cleanText, normalizeName, pluralize } from '../../domain/text'
import { useJournal } from '../../state/JournalProvider'
import { useToast } from '../../state/ToastProvider'
import { useUI } from '../../state/UIProvider'
import { useUnsavedWarning } from '../../state/useUnsavedWarning'
import { Combobox, SuggestInput, type ComboOption } from '../ui/Combobox'
import { Dialog } from '../ui/Dialog'
import { Field, FoodThumb } from '../ui/misc'
import { RatingDisplay } from '../ui/Rating'
import {
  draftToOccasion,
  emptyOccasionDraft,
  withRestaurant,
  OccasionFields,
  validateOccasionDraft,
  type DraftErrors,
  type OccasionDraft,
} from './OccasionFields'

type FoodChoice = { kind: 'existing'; id: string } | { kind: 'new' } | null

interface NewFoodDraft {
  name: string
  cuisine: string
}

/** Container: mounts the form fresh for each request so defaults (date/time) are current. */
export function LogFoodDialog() {
  const { logRequest } = useUI()
  if (!logRequest) return null
  return <LogFoodForm key={logRequest.nonce} />
}

function LogFoodForm() {
  const { summaries, byId, cuisines, repo, data } = useJournal()
  const { logRequest, closeLog, confirm, openFood } = useUI()
  const toast = useToast()

  const initialFood = logRequest?.foodId && byId.has(logRequest.foodId) ? logRequest.foodId : null
  const [query, setQuery] = useState(logRequest?.name ?? '')
  const [choice, setChoice] = useState<FoodChoice>(initialFood ? { kind: 'existing', id: initialFood } : null)
  const [newFood, setNewFood] = useState<NewFoodDraft>({ name: '', cuisine: '' })
  const [wantToTry, setWantToTry] = useState(false)
  const [draft, setDraft] = useState<OccasionDraft>(() => {
    const d = emptyOccasionDraft()
    const place = logRequest?.place
    if (place) return { ...d, restaurant: place.restaurant, lat: place.lat, lng: place.lng, location: place.location, pinSource: 'manual' as const }
    return initialFood ? withRestaurant(d, byId.get(initialFood)?.occasions[0]?.restaurant ?? '', data.occasions) : d
  })
  const [errors, setErrors] = useState<DraftErrors & { food?: string }>({})
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = choice?.kind === 'existing' ? byId.get(choice.id) : undefined

  useUnsavedWarning(touched)

  const foodOptions = useMemo<ComboOption<string>[]>(
    () =>
      [...summaries]
        .sort((a, b) => b.timesEaten - a.timesEaten || a.food.name.localeCompare(b.food.name))
        .map((s) => ({
          key: s.food.id,
          label: s.food.name,
          value: s.food.id,
          meta: (
            <>
              {[s.food.cuisine, s.timesEaten ? `${s.timesEaten}×` : 'want to try', s.avgRating != null ? formatRating(s.avgRating) : null]
                .filter(Boolean)
                .join(', ')}
            </>
          ),
        })),
    [summaries],
  )

  const exactMatch = useMemo(
    () => summaries.find((s) => normalizeName(s.food.name) === normalizeName(query)),
    [summaries, query],
  )

  const createOption: ComboOption<string> | null =
    cleanText(query) && !exactMatch ? { key: '__create__', label: `Create “${cleanText(query)}”`, value: '__create__' } : null

  const update = (patch: Partial<OccasionDraft>) => {
    setTouched(true)
    setDraft((d) => ({ ...d, ...patch }))
  }

  const pickExisting = (id: string) => {
    setTouched(true)
    setChoice({ kind: 'existing', id })
    setWantToTry(false)
    setErrors((e) => ({ ...e, food: undefined }))
    const last = byId.get(id)?.occasions[0]?.restaurant
    setDraft((d) => (d.restaurant ? d : withRestaurant(d, last ?? '', data.occasions)))
  }

  const pickNew = (name: string) => {
    setTouched(true)
    setChoice({ kind: 'new' })
    setNewFood((f) => ({ ...f, name: cleanText(name) }))
    setErrors((e) => ({ ...e, food: undefined }))
  }

  const requestClose = async () => {
    if (saving) return
    if (touched) {
      const ok = await confirm({
        title: 'Discard this entry?',
        message: 'What you’ve entered so far won’t be saved.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        danger: true,
      })
      if (!ok) return
    }
    closeLog()
  }

  const save = async (another = false) => {
    const errs: DraftErrors & { food?: string } = wantToTry ? {} : validateOccasionDraft(draft)
    if (!choice) errs.food = 'Search for a food or create a new one.'
    if (choice?.kind === 'new' && !cleanText(newFood.name)) errs.food = 'Give the food a name.'
    if (choice?.kind === 'new' && summaries.some((s) => normalizeName(s.food.name) === normalizeName(newFood.name))) {
      errs.food = 'You already have a food with this name. Pick it from the list instead.'
    }
    setErrors(errs)
    if (Object.values(errs).some(Boolean)) return

    setSaving(true)
    let createdFoodId: string | null = null
    let savedPhotoId: string | null = null
    try {
      let foodId: string
      let foodName: string
      if (choice!.kind === 'new') {
        const f = await repo.createFood({
          name: newFood.name,
          cuisine: newFood.cuisine,
        })
        createdFoodId = f.id
        foodId = f.id
        foodName = f.name
      } else {
        foodId = choice!.id
        foodName = selected?.food.name ?? 'food'
      }

      if (!wantToTry) {
        const payload = await draftToOccasion(draft, async (url) => {
          savedPhotoId = await repo.savePhoto(url)
          return savedPhotoId
        })
        await repo.logOccasion({ ...payload, foodId })
      }

      toast.show(wantToTry ? `Added ${foodName} to your want-to-try list` : `Logged ${foodName}`, {
        action: { label: 'View', onClick: () => openFood(foodId) },
      })

      if (another) {
        setChoice(null)
        setQuery('')
        setNewFood({ name: '', cuisine: '' })
        setDraft(emptyOccasionDraft())
        setWantToTry(false)
        setTouched(false)
        setErrors({})
        searchRef.current?.focus()
      } else {
        setTouched(false)
        closeLog()
      }
    } catch (err) {
      // Roll back partial work so a failed save leaves nothing half-written.
      if (savedPhotoId) await repo.deletePhoto(savedPhotoId).catch(() => {})
      if (createdFoodId) await repo.deleteFood(createdFoodId).catch(() => {})
      toast.error(err instanceof Error ? `Couldn’t save: ${err.message}` : 'Couldn’t save this meal. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onRequestClose={requestClose}
      title={wantToTry ? 'Save a food to try' : 'Log a meal'}
      footer={
        <>
          {!wantToTry && (
            <button type="button" className="btn btn-ghost hide-mobile" onClick={() => save(true)} disabled={saving}>
              Save and log another
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn hide-mobile" onClick={requestClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => save(false)} disabled={saving}>
            {saving ? 'Saving…' : wantToTry ? 'Save to list' : 'Save meal'}
            <kbd className="hide-mobile">⌘↵</kbd>
          </button>
        </>
      }
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault()
          save(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            save(false)
          }
        }}
      >
        <div className="field">
          <label className="field-label" htmlFor="log-food">
            What did you eat?
          </label>
          {!choice && (
            <div className="input-wrap">
              <Search size={16} />
              <Combobox
                id="log-food"
                inputRef={searchRef}
                value={query}
                onChange={setQuery}
                onSelect={(o) => (o.value === '__create__' ? pickNew(query) : pickExisting(o.value))}
                options={foodOptions}
                createOption={createOption}
                placeholder={summaries.length ? 'Search your foods or type a new one' : 'Type the name of a dish'}
                autoFocus
                invalid={!!errors.food}
                openOnFocus={summaries.length > 0}
              />
            </div>
          )}
          {errors.food && (
            <span className="field-error" role="alert">
              {errors.food}
            </span>
          )}

          {selected && (
            <div className="picked">
              <FoodThumb name={selected.food.name} photoId={selected.coverPhotoId} size={44} />
              <div className="picked-main">
                <strong>{selected.food.name}</strong>
                <span className="muted">
                  {selected.food.cuisine || 'No cuisine set'}
                  {' — '}
                  {selected.timesEaten ? `eaten ${pluralize(selected.timesEaten, 'time')}` : 'not tried yet'}
                </span>
              </div>
              {selected.avgRating != null && <RatingDisplay value={selected.avgRating} size="sm" showPips={false} />}
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setChoice(null)
                  setQuery(selected.food.name)
                  window.setTimeout(() => searchRef.current?.focus(), 0)
                }}
              >
                Change
              </button>
            </div>
          )}

          {choice?.kind === 'new' && (
            <div className="new-food">
              <div className="new-food-head">
                <span className="chip chip-accent">
                  <Plus size={12} /> New food
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    setChoice(null)
                    setQuery(newFood.name)
                    window.setTimeout(() => searchRef.current?.focus(), 0)
                  }}
                >
                  Search instead
                </button>
              </div>
              <Field label="Name" htmlFor="nf-name">
                <input
                  id="nf-name"
                  className="input"
                  value={newFood.name}
                  onChange={(e) => setNewFood((f) => ({ ...f, name: e.target.value }))}
                />
              </Field>
              <Field label="Cuisine" htmlFor="nf-cuisine">
                <SuggestInput
                  id="nf-cuisine"
                  value={newFood.cuisine}
                  onChange={(v) => setNewFood((f) => ({ ...f, cuisine: v }))}
                  suggestions={cuisines}
                  placeholder="e.g. Japanese"
                  autoFocus
                />
              </Field>
              <label className="check">
                <input type="checkbox" checked={wantToTry} onChange={(e) => setWantToTry(e.target.checked)} />
                <Bookmark size={14} /> I haven’t eaten it yet — save it to my want-to-try list
              </label>
            </div>
          )}
        </div>

        {!wantToTry && (
          <OccasionFields draft={draft} onChange={update} errors={errors} recentPlaces={selected?.restaurants ?? []} />
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
