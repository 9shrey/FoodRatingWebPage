import { Compass, Plus } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { FoodGrid } from '../components/food/FoodCard'
import { EmptyState } from '../components/ui/misc'
import { PageSkeleton } from '../layout/PageSkeleton'
import {
  notEatenRecently,
  recentlyAdded,
  revisitSuggestions,
  topRated,
  triedOnce,
  wantToTry,
} from '../domain/analytics'
import { formatDateShort, relativeDays } from '../domain/dates'
import type { FoodSummary } from '../domain/types'
import { useJournal } from '../state/JournalProvider'
import { useUI } from '../state/UIProvider'

function Shelf({
  title,
  hint,
  items,
  noteFor,
  empty,
  limit = 8,
}: {
  title: string
  hint?: string
  items: FoodSummary[]
  noteFor?: (s: FoodSummary) => string
  empty: ReactNode
  limit?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? items : items.slice(0, limit)
  return (
    <section className="section shelf">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {hint && <p className="faint shelf-hint">{hint}</p>}
        </div>
        {items.length > limit && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'Show fewer' : `Show all ${items.length}`}
          </button>
        )}
      </div>
      {items.length ? <FoodGrid items={shown} noteFor={noteFor} /> : <p className="muted panel panel-pad">{empty}</p>}
    </section>
  )
}

export function DiscoverPage() {
  const { summaries, status } = useJournal()
  const { openLog } = useUI()
  const lists = useMemo(
    () => ({
      revisit: revisitSuggestions(summaries),
      want: wantToTry(summaries),
      added: recentlyAdded(summaries, 8),
      favs: summaries
        .filter((s) => s.food.favourite)
        .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.timesEaten - a.timesEaten),
      once: triedOnce(summaries),
      stale: notEatenRecently(summaries, 90),
      top: topRated(summaries, 8),
    }),
    [summaries],
  )
  if (status === 'loading') return <PageSkeleton />
  if (!summaries.length) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Discover</h1>
        </header>
        <EmptyState
          icon={<Compass size={22} />}
          title="Discover grows with your journal"
          actions={
            <button type="button" className="btn btn-primary btn-lg" onClick={() => openLog()}>
              <Plus size={16} /> Log a meal
            </button>
          }
        >
          Favourites, foods you haven’t had in a while and your want-to-try list all appear here.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Discover</h1>
          <p className="muted page-sub">What to eat next, and what you might have forgotten about.</p>
        </div>
      </header>
      <Shelf
        title="Worth revisiting"
        hint="Rated 4 or higher and not eaten for at least a month"
        items={lists.revisit}
        noteFor={(s) => `Last eaten ${relativeDays(s.lastEaten)}`}
        empty="Nothing yet — highly rated foods you haven’t had for a month will show up here."
      />
      <Shelf
        title={lists.favs.length ? `Your favourites (${lists.favs.length})` : 'Your favourites'}
        hint="Your call, whatever the rating says"
        items={lists.favs}
        noteFor={(s) => (s.lastEaten ? `Last eaten ${relativeDays(s.lastEaten)}` : 'Not tried yet')}
        empty="Tap the heart on any food to keep it here."
      />
      <Shelf
        title="Want to try"
        hint="Foods saved but not eaten yet"
        items={lists.want}
        noteFor={(s) => `Saved ${formatDateShort(s.food.createdAt.slice(0, 10))}`}
        empty={
          <>
            Save dishes you want to try: in <strong>Log food</strong>, create a new food and tick “I haven’t eaten it yet”.
          </>
        }
      />
      <Shelf title="Recently added" items={lists.added} noteFor={(s) => `Added ${formatDateShort(s.food.createdAt.slice(0, 10))}`} empty="Nothing added yet." />
      <Shelf
        title="Tried only once"
        hint="Best rated first — maybe one deserves a second go"
        items={lists.once}
        noteFor={(s) => `Once, ${relativeDays(s.lastEaten)}`}
        empty="You’ve had everything at least twice."
      />
      <Shelf
        title="Not eaten recently"
        hint="Nothing in the last 90 days"
        items={lists.stale}
        noteFor={(s) => `Last eaten ${relativeDays(s.lastEaten)}`}
        empty="You’ve had everything in the last three months."
      />
      <Shelf title="Highest rated" items={lists.top} empty="Rate a meal to start this list." />
    </div>
  )
}
