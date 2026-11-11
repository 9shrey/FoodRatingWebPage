import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

interface PopoverProps {
  /** Render the trigger. Spread the props onto a button. */
  trigger: (props: {
    onClick: () => void
    'aria-expanded': boolean
    'aria-controls': string
    'aria-haspopup': 'true'
  }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  width?: number
}

/** Anchored panel that closes on outside click and Esc, returning focus to the trigger. */
export function Popover({ trigger, children, align = 'left', width }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        ;(wrap.current?.querySelector('[aria-haspopup]') as HTMLElement | null)?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="pop-anchor" ref={wrap}>
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-controls': id, 'aria-haspopup': 'true' })}
      {open && (
        <div id={id} className={`popover popover-${align}`} style={width ? { width } : undefined}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
