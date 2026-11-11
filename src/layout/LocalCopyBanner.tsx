import { HardDriveUpload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { pluralize } from '../domain/text'
import { useJournal } from '../state/JournalProvider'
import { useToast } from '../state/ToastProvider'
import { cloudEnabled, localRepository } from '../storage'

const DISMISS_KEY = 'fj:local-copy-dismissed'

function dismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * In cloud mode, offers to copy a journal kept in this browser (from before sign-in
 * existed) into the account. Shown until copied or dismissed.
 */
export function LocalCopyBanner() {
  const { repo, status } = useJournal()
  const toast = useToast()
  const [local, setLocal] = useState<{ foods: number; meals: number } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!cloudEnabled || status !== 'ready' || dismissed()) return
    let alive = true
    localRepository
      .exportAll()
      .then((d) => {
        const foods = d.foods.filter((f) => !f.isSample).length
        if (alive && foods) setLocal({ foods, meals: d.occasions.filter((o) => !o.isSample).length })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [status])

  if (!local) return null

  const hide = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* hide for this session only */
    }
    setLocal(null)
  }

  const copy = async () => {
    setBusy(true)
    try {
      const d = await localRepository.exportAll()
      const r = await repo.importAll(
        { ...d, foods: d.foods.filter((f) => !f.isSample), occasions: d.occasions.filter((o) => !o.isSample) },
        'merge',
      )
      toast.show(`Copied ${pluralize(r.foods, 'food')} and ${pluralize(r.occasions, 'meal')} to your account`)
      hide()
    } catch {
      toast.error('Copy failed. Nothing in this browser was changed — try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="banner banner-info" role="note">
      <HardDriveUpload size={16} aria-hidden />
      <span>
        This browser has <strong>{pluralize(local.foods, 'food')}</strong> and {pluralize(local.meals, 'meal')} saved from before you signed in. Copy
        them to your account so they sync?
      </span>
      <span className="banner-actions">
        <button type="button" className="btn btn-sm btn-ghost" onClick={hide} disabled={busy}>
          Not now
        </button>
        <button type="button" className="btn btn-sm" onClick={copy} disabled={busy}>
          {busy ? 'Copying…' : 'Copy to account'}
        </button>
      </span>
    </div>
  )
}
