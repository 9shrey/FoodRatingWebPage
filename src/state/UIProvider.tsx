import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Dialog } from '../components/ui/Dialog'

interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
}

export interface LogRequest {
  foodId?: string
  /** Prefill the food search with this text (new food) */
  name?: string
  /** Prefill where it was eaten (from the map) */
  place?: { restaurant: string; lat: number; lng: number; location: string }
  /** Set on open so each request mounts a fresh form */
  nonce?: number
}

interface UIApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  openLog: (req?: LogRequest) => void
  closeLog: () => void
  logRequest: LogRequest | null
  /** Open the detail panel for a food (stored in the URL so Back closes it). */
  openFood: (id: string) => void
  closeFood: () => void
  openFoodId: string | null
}

const UIContext = createContext<UIApi | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)
  const [logRequest, setLogRequest] = useState<LogRequest | null>(null)
  const [params, setParams] = useSearchParams()
  const openFoodId = params.get('food')

  const confirm = useCallback((opts: ConfirmOptions) => {
    setConfirmState(opts)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = (v: boolean) => {
    resolver.current?.(v)
    resolver.current = null
    setConfirmState(null)
  }

  const openFood = useCallback(
    (id: string) =>
      setParams((p) => {
        const next = new URLSearchParams(p)
        next.set('food', id)
        return next
      }),
    [setParams],
  )
  const closeFood = useCallback(
    () =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p)
          next.delete('food')
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  const api: UIApi = {
    confirm,
    openLog: (req = {}) => setLogRequest({ ...req, nonce: Date.now() }),
    closeLog: () => setLogRequest(null),
    logRequest,
    openFood,
    closeFood,
    openFoodId,
  }

  return (
    <UIContext.Provider value={api}>
      {children}
      <Dialog
        open={!!confirmState}
        variant="small"
        onRequestClose={() => settle(false)}
        title={confirmState?.title ?? ''}
        footer={
          <>
            <button type="button" className="btn" onClick={() => settle(false)}>
              {confirmState?.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              className={`btn ${confirmState?.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => settle(true)}
              data-autofocus
            >
              {confirmState?.confirmLabel}
            </button>
          </>
        }
      >
        <div className="muted" style={{ lineHeight: 1.55 }}>
          {confirmState?.message}
        </div>
      </Dialog>
    </UIContext.Provider>
  )
}

export function useUI(): UIApi {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside UIProvider')
  return ctx
}
