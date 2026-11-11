import { Camera, ChevronDown, Home, ImagePlus, Trash2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { toLocalDate } from '../../domain/dates'
import { lastPinFor } from '../../domain/places'
import {
  MEAL_LABELS,
  MEAL_TYPES,
  mealForHour,
  PRICE_LABELS,
  PRICE_TIERS,
  priceSymbol,
  type MealType,
  type Occasion,
  type OccasionInput,
  type PriceTier,
} from '../../domain/types'
import { useJournal } from '../../state/JournalProvider'
import { compressImage, usePhoto } from '../../state/usePhoto'
import { useToast } from '../../state/ToastProvider'
import { SuggestInput } from '../ui/Combobox'
import { RatingInput } from '../ui/Rating'
import { Field } from '../ui/misc'
import { PinPicker } from './PinPicker'

export type PhotoDraft = { kind: 'none' } | { kind: 'existing'; id: string } | { kind: 'new'; dataUrl: string }

export interface OccasionDraft {
  restaurant: string
  date: string
  rating: number | null
  notes: string
  price: PriceTier | null
  mealType: MealType | null
  location: string
  lat: number | null
  lng: number | null
  /** 'auto' = copied from an earlier meal at the same restaurant, so it follows restaurant changes */
  pinSource: 'auto' | 'manual' | null
  photo: PhotoDraft
}

/**
 * Apply a restaurant change, copying the pin from the last meal logged there
 * unless the user pinned this meal by hand.
 */
export function withRestaurant(d: OccasionDraft, restaurant: string, occasions: Occasion[]): OccasionDraft {
  const next = { ...d, restaurant }
  if (d.pinSource === 'manual') return next
  const pin = lastPinFor(occasions, restaurant)
  if (pin) return { ...next, lat: pin.lat, lng: pin.lng, pinSource: 'auto', location: d.location || pin.location }
  if (d.pinSource === 'auto') return { ...next, lat: null, lng: null, pinSource: null }
  return next
}

export function emptyOccasionDraft(): OccasionDraft {
  const now = new Date()
  return {
    restaurant: '',
    date: toLocalDate(now),
    rating: null,
    notes: '',
    price: null,
    mealType: mealForHour(now.getHours()),
    location: '',
    lat: null,
    lng: null,
    pinSource: null,
    photo: { kind: 'none' },
  }
}

export function draftFromOccasion(o: Occasion): OccasionDraft {
  return {
    restaurant: o.restaurant,
    date: o.date,
    rating: o.rating,
    notes: o.notes,
    price: o.price,
    mealType: o.mealType,
    location: o.location,
    lat: o.lat ?? null,
    lng: o.lng ?? null,
    pinSource: o.lat != null && o.lng != null ? 'manual' : null,
    photo: o.photoId ? { kind: 'existing', id: o.photoId } : { kind: 'none' },
  }
}

export type DraftErrors = Partial<Record<'date', string>>

export function validateOccasionDraft(d: OccasionDraft): DraftErrors {
  const e: DraftErrors = {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) e.date = 'Choose a date.'
  else if (d.date > toLocalDate()) e.date = 'That date is in the future.'
  return e
}

/** Persist the draft's photo if needed and build the occasion payload (minus foodId). */
export async function draftToOccasion(
  d: OccasionDraft,
  savePhoto: (dataUrl: string) => Promise<string>,
): Promise<Omit<OccasionInput, 'foodId'>> {
  let photoId: string | null = null
  if (d.photo.kind === 'existing') photoId = d.photo.id
  if (d.photo.kind === 'new') photoId = await savePhoto(d.photo.dataUrl)
  return {
    restaurant: d.restaurant.trim(),
    date: d.date,
    rating: d.rating,
    notes: d.notes.trim(),
    price: d.price,
    mealType: d.mealType,
    location: d.location.trim(),
    lat: d.lat,
    lng: d.lng,
    photoId,
    custom: {},
  }
}

interface Props {
  draft: OccasionDraft
  onChange: (patch: Partial<OccasionDraft>) => void
  errors: DraftErrors
  /** Restaurants this food has been eaten at, shown as one-tap chips */
  recentPlaces?: string[]
  detailsOpenByDefault?: boolean
}

export function OccasionFields({ draft, onChange, errors, recentPlaces = [], detailsOpenByDefault = false }: Props) {
  const { restaurants, data } = useJournal()
  const setRestaurant = (v: string) => {
    const next = withRestaurant(draft, v, data.occasions)
    onChange({ restaurant: v, lat: next.lat, lng: next.lng, pinSource: next.pinSource, location: next.location })
  }
  const id = useId()
  const [showMore, setShowMore] = useState(
    detailsOpenByDefault ||
      !!(draft.notes || draft.location || draft.photo.kind !== 'none'),
  )

  return (
    <div className="form-stack">
      <Field label="Where" hint="Restaurant, shop or home" htmlFor={`${id}-place`}>
        <SuggestInput
          id={`${id}-place`}
          value={draft.restaurant}
          onChange={setRestaurant}
          suggestions={restaurants}
          placeholder="e.g. Dishoom"
        />
        <div className="chip-row">
          <button
            type="button"
            className="chip chip-toggle"
            aria-pressed={draft.restaurant === 'Home'}
            onClick={() => setRestaurant(draft.restaurant === 'Home' ? '' : 'Home')}
          >
            <Home size={13} /> Home-cooked
          </button>
          {recentPlaces
            .filter((p) => p !== 'Home')
            .slice(0, 3)
            .map((p) => (
              <button
                key={p}
                type="button"
                className="chip chip-toggle"
                aria-pressed={draft.restaurant === p}
                onClick={() => setRestaurant(p)}
              >
                {p}
              </button>
            ))}
        </div>
        <PinPicker draft={draft} onChange={onChange} />
      </Field>

      <div className="form-row form-row-keep">
        <Field label="Date" error={errors.date} htmlFor={`${id}-date`}>
          <input
            id={`${id}-date`}
            type="date"
            className="input"
            value={draft.date}
            max={toLocalDate()}
            aria-invalid={!!errors.date || undefined}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </Field>
        <div className="field">
          <span className="field-label">Meal</span>
          <div className="segmented" role="radiogroup" aria-label="Meal">
            {MEAL_TYPES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={draft.mealType === m}
                onClick={() => onChange({ mealType: draft.mealType === m ? null : m })}
              >
                {MEAL_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Field label="Rating" hint="Tap the left half of a star for a half star" htmlFor={`${id}-rating`}>
        <RatingInput id={`${id}-rating`} value={draft.rating} onChange={(rating) => onChange({ rating })} />
      </Field>

      <div className="field">
        <span className="field-label">Price</span>
        <div className="segmented" role="radiogroup" aria-label="Price">
          {PRICE_TIERS.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={draft.price === t}
              title={PRICE_LABELS[t]}
              aria-label={`${PRICE_LABELS[t]} (${priceSymbol(t)})`}
              onClick={() => onChange({ price: draft.price === t ? null : t })}
            >
              {priceSymbol(t)}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="disclosure" aria-expanded={showMore} onClick={() => setShowMore((s) => !s)}>
        <ChevronDown size={16} />
        {showMore ? 'Fewer details' : 'Notes, photo and location'}
      </button>

      {showMore && (
        <div className="form-stack">
          <Field label="Notes" htmlFor={`${id}-notes`}>
            <textarea
              id={`${id}-notes`}
              className="textarea"
              value={draft.notes}
              placeholder="What stood out? Anything to remember next time?"
              onChange={(e) => onChange({ notes: e.target.value })}
            />
          </Field>

          <PhotoPicker photo={draft.photo} onChange={(photo) => onChange({ photo })} />

          <Field label="Location" hint="Optional" htmlFor={`${id}-loc`}>
            <input
              id={`${id}-loc`}
              className="input"
              value={draft.location}
              placeholder="Neighbourhood or city"
              onChange={(e) => onChange({ location: e.target.value })}
            />
          </Field>
        </div>
      )}
    </div>
  )
}

function PhotoPicker({ photo, onChange }: { photo: PhotoDraft; onChange: (p: PhotoDraft) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const existing = usePhoto(photo.kind === 'existing' ? photo.id : null)
  const src = photo.kind === 'new' ? photo.dataUrl : existing
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      onChange({ kind: 'new', dataUrl: await compressImage(file) })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That photo couldn’t be added.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="field">
      <span className="field-label">Photo</span>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {src ? (
        <div className="photo-preview">
          <img src={src} alt="Meal photo preview" />
          <div className="photo-actions">
            <button type="button" className="btn btn-sm" onClick={() => input.current?.click()}>
              <Camera size={14} /> Replace
            </button>
            <button type="button" className="btn btn-sm btn-danger-quiet" onClick={() => onChange({ kind: 'none' })}>
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="photo-drop" onClick={() => input.current?.click()} disabled={busy}>
          <ImagePlus size={18} />
          {busy ? 'Preparing photo…' : 'Add a photo'}
        </button>
      )}
    </div>
  )
}
