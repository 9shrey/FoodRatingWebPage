import { X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  /** Called on Esc, backdrop click or the close button. The caller decides whether to close. */
  onRequestClose: () => void
  title: ReactNode
  variant?: 'center' | 'side' | 'small'
  children: ReactNode
  footer?: ReactNode
  headerExtra?: ReactNode
  labelledBy?: string
  className?: string
}

/** Native <dialog> (focus trap, Esc, top layer) with our own close handling. */
export function Dialog({ open, onRequestClose, title, variant = 'center', children, footer, headerExtra, className = '' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const closeRef = useRef(onRequestClose)
  useLayoutEffect(() => {
    closeRef.current = onRequestClose
  })
  const restoreFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      restoreFocus.current = document.activeElement as HTMLElement | null
      el.showModal()
      // React's autoFocus runs before showModal, so focus the marked field afterwards.
      const target = el.querySelector<HTMLElement>('[data-autofocus]')
      if (target) target.focus()
      else el.focus()
    } else if (!open && el.open) {
      el.close()
      restoreFocus.current?.focus?.()
    }
  }, [open])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onCancel = (e: Event) => {
      e.preventDefault()
      closeRef.current()
    }
    // A click whose target is the <dialog> itself landed on the backdrop.
    let downOnBackdrop = false
    const onDown = (e: PointerEvent) => {
      downOnBackdrop = e.target === el
    }
    const onClick = (e: MouseEvent) => {
      if (e.target === el && downOnBackdrop) closeRef.current()
    }
    el.addEventListener('cancel', onCancel)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('click', onClick)
    return () => {
      el.removeEventListener('cancel', onCancel)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('click', onClick)
    }
  }, [])

  const variantClass = variant === 'side' ? 'dlg-side' : variant === 'small' ? 'dlg-center dlg-small' : 'dlg-center'

  return (
    <dialog ref={ref} tabIndex={-1} className={`dlg ${variantClass} ${className}`} aria-label={typeof title === 'string' ? title : undefined}>
      {open && (
        <>
          <div className="sheet-grip" aria-hidden />
          <div className="dlg-head">
            {typeof title === 'string' ? <h2>{title}</h2> : title}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {headerExtra}
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => closeRef.current()}>
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="dlg-body">{children}</div>
          {footer && <div className="dlg-foot">{footer}</div>}
        </>
      )}
    </dialog>
  )
}
