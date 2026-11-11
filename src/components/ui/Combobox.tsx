import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { normalizeName } from '../../domain/text'

export interface ComboOption<T = string> {
  key: string
  label: string
  value: T
  meta?: ReactNode
}

interface ComboboxProps<T> {
  value: string
  onChange: (text: string) => void
  /** Called when an option is chosen (click or Enter) */
  onSelect: (option: ComboOption<T>) => void
  options: ComboOption<T>[]
  placeholder?: string
  id?: string
  autoFocus?: boolean
  /** Extra row at the end, e.g. "Create “x”" */
  createOption?: ComboOption<T> | null
  maxOptions?: number
  invalid?: boolean
  inputClassName?: string
  /** Show suggestions on focus even when empty */
  openOnFocus?: boolean
  inputRef?: React.Ref<HTMLInputElement>
  ariaLabel?: string
}

/** Highlight the matched part of a label. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

/** Filter options: prefix matches first, then substring matches. */
export function rankOptions<T>(options: ComboOption<T>[], query: string): ComboOption<T>[] {
  const q = normalizeName(query)
  if (!q) return options
  const starts: ComboOption<T>[] = []
  const contains: ComboOption<T>[] = []
  for (const o of options) {
    const l = normalizeName(o.label)
    if (l.startsWith(q) || l.split(' ').some((w) => w.startsWith(q))) starts.push(o)
    else if (l.includes(q)) contains.push(o)
  }
  return [...starts, ...contains]
}

/** Accessible autocomplete input (ARIA 1.2 combobox pattern). */
export function Combobox<T>({
  value,
  onChange,
  onSelect,
  options,
  placeholder,
  id,
  autoFocus,
  createOption,
  maxOptions = 8,
  invalid,
  inputClassName = 'input',
  openOnFocus = true,
  inputRef,
  ariaLabel,
}: ComboboxProps<T>) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const blurTimer = useRef<number | undefined>(undefined)

  const shown = useMemo(() => {
    const ranked = rankOptions(options, value).slice(0, maxOptions)
    return createOption ? [...ranked, createOption] : ranked
  }, [options, value, maxOptions, createOption])

  const visible = open && shown.length > 0 && (openOnFocus || value.trim().length > 0)

  const choose = (o: ComboOption<T>) => {
    onSelect(o)
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(shown.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter' && visible && shown[active]) {
      e.preventDefault()
      choose(shown[active])
    } else if (e.key === 'Escape' && visible) {
      // Close the list without closing the surrounding dialog.
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className="combo">
      <input
        ref={inputRef}
        id={id}
        className={inputClassName}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        data-autofocus={autoFocus || undefined}
        autoComplete="off"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={visible ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          onChange(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => {
          window.clearTimeout(blurTimer.current)
          setOpen(true)
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 120)
        }}
        onKeyDown={onKeyDown}
      />
      {visible && (
        <ul className="combo-list" id={listId} role="listbox">
          {shown.map((o, i) => (
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`combo-opt ${createOption && o.key === createOption.key ? 'combo-create' : ''}`}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
              onPointerEnter={() => setActive(i)}
            >
              <span>
                {createOption && o.key === createOption.key ? o.label : <Highlight text={o.label} query={value} />}
              </span>
              {o.meta && <span className="meta">{o.meta}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Free-text input with suggestions (cuisine, category, restaurant). */
export function SuggestInput({
  value,
  onChange,
  suggestions,
  ...rest
}: {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  placeholder?: string
  id?: string
  autoFocus?: boolean
  ariaLabel?: string
}) {
  const options = useMemo(
    () =>
      suggestions
        .filter((s) => normalizeName(s) !== normalizeName(value))
        .map((s) => ({ key: s, label: s, value: s })),
    [suggestions, value],
  )
  return <Combobox value={value} onChange={onChange} onSelect={(o) => onChange(o.value)} options={options} {...rest} />
}
