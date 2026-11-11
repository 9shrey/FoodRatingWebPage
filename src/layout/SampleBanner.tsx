import { FlaskConical } from 'lucide-react'
import { useJournal } from '../state/JournalProvider'
import { useToast } from '../state/ToastProvider'
import { useUI } from '../state/UIProvider'

export function SampleBanner() {
  const { repo } = useJournal()
  const { confirm } = useUI()
  const toast = useToast()
  const remove = async () => {
    const ok = await confirm({
      title: 'Remove sample data?',
      message: 'All sample foods and meals will be deleted. Anything you logged yourself stays.',
      confirmLabel: 'Remove sample data',
      danger: true,
    })
    if (!ok) return
    try {
      const n = await repo.removeSampleData()
      toast.show(`Removed ${n} sample foods`)
    } catch {
      toast.error('Couldn’t remove the sample data.')
    }
  }
  return (
    <div className="banner" role="note">
      <FlaskConical size={16} aria-hidden />
      <span>
        Showing <strong>sample data</strong> alongside your own entries. Sample foods are labelled.
      </span>
      <button type="button" className="btn btn-sm" onClick={remove}>
        Remove sample data
      </button>
    </div>
  )
}
