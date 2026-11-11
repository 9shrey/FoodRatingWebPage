import { Check, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Dialog } from '../components/ui/Dialog'
import { relativeDays } from '../domain/dates'
import { useToast } from '../state/ToastProvider'
import { supabase } from '../storage'

export interface AccessRequest {
  email: string
  name: string
  note: string
  status: 'pending' | 'approved' | 'denied'
  created_at: string
}

/** Pending and past access requests, for admins. */
export function useAccessRequests(enabled: boolean) {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const reload = useCallback(async () => {
    if (!supabase || !enabled) return
    const { data, error } = await supabase.rpc('list_access_requests')
    if (!error && data) setRequests(data as AccessRequest[])
  }, [enabled])
  useEffect(() => {
    reload()
  }, [reload])
  return { requests, reload, pending: requests.filter((r) => r.status === 'pending').length }
}

export function AccessRequestsDialog({
  open,
  onClose,
  requests,
  reload,
}: {
  open: boolean
  onClose: () => void
  requests: AccessRequest[]
  reload: () => Promise<void>
}) {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (open) reload()
  }, [open, reload])

  const decide = async (r: AccessRequest, approve: boolean) => {
    setBusy(r.email)
    const { error } = await supabase!.rpc('decide_access', { p_email: r.email, p_approve: approve })
    setBusy(null)
    if (error) toast.error('Couldn’t update the request.')
    else {
      toast.show(approve ? `Approved ${r.email}. They can sign in now.` : `Denied ${r.email}`)
      await reload()
    }
  }

  return (
    <Dialog open={open} onRequestClose={onClose} title="Access requests">
      {requests.length === 0 ? (
        <p className="muted">No requests yet. When someone asks for access from the sign-in screen, it shows up here.</p>
      ) : (
        <ul className="plain-list access-list">
          {requests.map((r) => (
            <li key={r.email} className="access-row">
              <div className="access-who">
                <strong>{r.name || r.email}</strong>
                {r.name && <span className="muted">{r.email}</span>}
                {r.note && <p className="access-note">{r.note}</p>}
                <span className="muted access-meta">
                  Asked {relativeDays(r.created_at.slice(0, 10))}
                  {r.status !== 'pending' && ` · ${r.status}`}
                </span>
              </div>
              <div className="access-actions">
                {r.status !== 'approved' && (
                  <button type="button" className="btn btn-primary" onClick={() => decide(r, true)} disabled={busy === r.email}>
                    <Check size={15} /> Approve
                  </button>
                )}
                {r.status !== 'denied' && (
                  <button type="button" className="btn" onClick={() => decide(r, false)} disabled={busy === r.email}>
                    <X size={15} /> {r.status === 'approved' ? 'Revoke' : 'Deny'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
