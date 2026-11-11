import { CircleAlert, Check, X } from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface Toast {
  id: number
  message: string
  tone: 'success' | 'error' | 'info'
  action?: { label: string; onClick: () => void }
}

interface ToastApi {
  show: (message: string, opts?: { tone?: Toast['tone']; action?: Toast['action']; duration?: number }) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const show = useCallback<ToastApi['show']>(
    (message, opts = {}) => {
      const id = nextId.current++
      const toast: Toast = { id, message, tone: opts.tone ?? 'success', action: opts.action }
      setToasts((t) => [...t.slice(-2), toast])
      window.setTimeout(() => dismiss(id), opts.duration ?? (opts.action ? 10000 : 3500))
    },
    [dismiss],
  )

  const api = useRef<ToastApi>({ show, error: (m) => show(m, { tone: 'error', duration: 6000 }) })
  api.current.show = show

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            {t.tone === 'error' ? <CircleAlert size={16} aria-hidden /> : <Check size={16} aria-hidden />}
            <span className="toast-msg">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  t.action!.onClick()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="icon-btn icon-btn-sm toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
