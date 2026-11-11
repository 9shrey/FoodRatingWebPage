import { MapPin, Plus, RefreshCw, Search, ShieldCheck, Utensils, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState, FavMark, FoodThumb } from '../components/ui/misc'
import { RatingDisplay } from '../components/ui/Rating'
import { backupAdvice } from '../domain/backup'
import { dayNickname, formatDay, relativeDays, toLocalDate } from '../domain/dates'
import { buildDiary, logAgainCandidates, suggestMeals, weekSummary, type DiaryDay, type DiaryEntry } from '../domain/journal'
import { isHomeCooking, pluralize } from '../domain/text'
import { MEAL_LABELS, mealForHour, priceSymbol } from '../domain/types'
import { PageSkeleton } from '../layout/PageSkeleton'
import { LocalCopyBanner } from '../layout/LocalCopyBanner'
import { SampleBanner } from '../layout/SampleBanner'
import { cloudEnabled } from '../storage'
import { saveBackupFile, snoozeBackupReminder, useBackupState } from '../state/backup'
import { useJournal } from '../state/JournalProvider'
import { useToast } from '../state/ToastProvider'
import { useUI } from '../state/UIProvider'

const DAYS_PER_PAGE = 30

export function JournalPage() {
  const { summaries, status, data, repo, hasSample } = useJournal()
  const { openLog } = useUI()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [shownDays, setShownDays] = useState(DAYS_PER_PAGE)

  const today = toLocalDate()
  const meal = mealForHour(new Date().getHours())
  const mealWord = MEAL_LABELS[meal].toLowerCase()

  const diary = useMemo(() => buildDiary(summaries, query), [summaries, query])
  const week = useMemo(() => weekSummary(summaries, today), [summaries, today])

  if (status === 'loading') return <PageSkeleton />

  if (data.foods.length === 0) {
    return (
      <div className="page">
        <EmptyState
          icon={<Utensils size={22} />}
          title="Start your food journal"
          actions={
            <>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => openLog()}>
                <Plus size={16} /> Log your first meal
              </button>
              <button
                type="button"
                className="btn btn-lg"
                onClick={() =>
                  repo
                    .loadSampleData()
                    .then(() => toast.show('Sample data loaded. Remove it any time from the banner or the Data menu.'))
                    .catch(() => toast.error('Couldn’t load the sample data.'))
                }
              >
                Explore with sample data
              </button>
            </>
          }
        >
          Log what you eat and rate it out of 5 stars. Your journal turns into a diary of meals, a catalogue of every dish, and ideas for what to
          eat next.
        </EmptyState>
      </div>
    )
  }

  const loggedToday = diary[0]?.date === today
  const visible = diary.slice(0, shownDays)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Journal</h1>
          <p className="muted page-sub">
            {formatDay(today)}.{' '}
            {week.meals
              ? `${pluralize(week.meals, 'meal')} in the last 7 days${week.newFoods ? `, ${week.newFoods} of them new to you` : ''}.`
              : 'Nothing logged in the last 7 days.'}
          </p>
        </div>
      </header>

      <LocalCopyBanner />
      {hasSample && <SampleBanner />}
      <BackupReminder />

      <div className="journal">
        <aside className="journal-side">
          <NextMeal mealWord={mealWord} />
          <LogAgain />
        </aside>

        <section className="journal-main" aria-label="Diary">
          <div className="input-wrap journal-search">
            <Search size={16} />
            <input
              type="search"
              className="input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShownDays(DAYS_PER_PAGE)
              }}
              placeholder="Search meals by food, place or notes"
              aria-label="Search meals"
            />
            {query && (
              <button type="button" className="icon-btn icon-btn-sm search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>

          {!query && !loggedToday && (
            <div className="day">
              <h2 className="day-head">
                Today <span className="day-date">{formatDay(today)}</span>
              </h2>
              <button type="button" className="day-empty" onClick={() => openLog()}>
                <Plus size={16} aria-hidden /> Nothing logged yet. Log {mealWord}
              </button>
            </div>
          )}

          {visible.map((d) => (
            <Day key={d.date} day={d} today={today} />
          ))}

          {diary.length === 0 &&
            (query ? (
              <EmptyState compact title="No meals match">
                Nothing in your diary mentions “{query}”. Try a dish, a restaurant or a word from your notes.
              </EmptyState>
            ) : (
              <p className="muted day-note">Foods on your want-to-try list show up here once you’ve eaten them.</p>
            ))}

          {diary.length > shownDays && (
            <button type="button" className="btn journal-more" onClick={() => setShownDays((n) => n + DAYS_PER_PAGE)}>
              Show earlier meals
            </button>
          )}
        </section>
      </div>
    </div>
  )
}

function Day({ day, today }: { day: DiaryDay; today: string }) {
  const nick = dayNickname(day.date, today)
  return (
    <div className="day">
      <h2 className="day-head">
        {nick ?? formatDay(day.date, today)}
        {nick && <span className="day-date">{formatDay(day.date, today)}</span>}
      </h2>
      <ul className="m-list">
        {day.entries.map((e) => (
          <Entry key={e.occasion.id} entry={e} />
        ))}
      </ul>
    </div>
  )
}

function Entry({ entry }: { entry: DiaryEntry }) {
  const { openFood } = useUI()
  const { occasion: o, food } = entry
  const place = o.restaurant ? (isHomeCooking(o.restaurant) ? 'Home-cooked' : o.restaurant) : ''
  const facts = [o.mealType ? MEAL_LABELS[o.mealType] : '', place, priceSymbol(o.price)].filter(Boolean)
  return (
    <li className="m-item entry">
      <button type="button" className="m-hit" onClick={() => openFood(food.id)} aria-label={`Open ${food.name}`} />
      <FoodThumb name={food.name} photoId={o.photoId} size={48} />
      <div className="entry-main">
        <div className="entry-name">
          <span className="truncate">{food.name}</span>
          {food.favourite && <FavMark size={13} />}
          {entry.firstTime && <span className="chip chip-accent entry-first">First time</span>}
          {food.isSample && <span className="chip chip-sample">Sample</span>}
        </div>
        {facts.length > 0 && <div className="entry-facts muted">{facts.join(', ')}</div>}
        {o.notes && <div className="entry-notes">{o.notes}</div>}
      </div>
      <RatingDisplay value={o.rating} size="sm" showPips={false} />
    </li>
  )
}

/** One idea for the next meal, with a button to step to the next idea. */
function NextMeal({ mealWord }: { mealWord: string }) {
  const { summaries } = useJournal()
  const { openLog, openFood } = useUI()
  const [index, setIndex] = useState(0)
  const today = toLocalDate()
  const ideas = useMemo(() => suggestMeals(summaries, mealForHour(new Date().getHours()), today), [summaries, today])
  if (!ideas.length) return null
  const idea = ideas[index % ideas.length]
  const s = idea.summary
  const untried = s.timesEaten === 0
  return (
    <section className="panel next" aria-labelledby="next-title">
      <h2 id="next-title" className="side-title">
        An idea for {mealWord}
      </h2>
      <button type="button" className="next-food" onClick={() => openFood(s.food.id)}>
        <FoodThumb name={s.food.name} photoId={s.coverPhotoId} size={72} rounded />
        <span className="next-text">
          <span className="next-name">{s.food.name}</span>
          <span className="muted next-cuisine">{s.food.cuisine || (untried ? 'Not tried yet' : 'No cuisine set')}</span>
        </span>
      </button>
      <p className="next-reason" aria-live="polite">
        {idea.reason}
      </p>
      <div className="next-actions">
        <button type="button" className="btn btn-primary" onClick={() => openLog({ foodId: s.food.id })}>
          <Plus size={15} /> Log it
        </button>
        {ideas.length > 1 && (
          <button type="button" className="btn" onClick={() => setIndex((i) => i + 1)}>
            <RefreshCw size={14} /> Another idea
          </button>
        )}
      </div>
    </section>
  )
}

/** The foods you eat most around this time of day, one tap from the log form. */
function LogAgain() {
  const { summaries } = useJournal()
  const { openLog } = useUI()
  const today = toLocalDate()
  const items = useMemo(() => logAgainCandidates(summaries, mealForHour(new Date().getHours()), today), [summaries, today])
  if (!items.length) return null
  return (
    <section className="panel again" aria-labelledby="again-title">
      <h2 id="again-title" className="side-title">
        Log again
      </h2>
      <ul className="again-list">
        {items.map((s) => (
          <li key={s.food.id}>
            <button type="button" className="again-row" onClick={() => openLog({ foodId: s.food.id })} aria-label={`Log ${s.food.name} again`}>
              <FoodThumb name={s.food.name} photoId={s.coverPhotoId} size={32} rounded />
              <span className="again-text">
                <span className="again-name truncate">{s.food.name}</span>
                <span className="faint again-sub truncate">
                  {s.topRestaurant && !isHomeCooking(s.topRestaurant) && (
                    <>
                      <MapPin size={11} aria-hidden /> {s.topRestaurant},{' '}
                    </>
                  )}
                  {relativeDays(s.lastEaten, today)}
                </span>
              </span>
              <Plus size={16} className="again-plus" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Shown when meals exist that no backup file has seen. */
function BackupReminder() {
  const { repo, ownMeals } = useJournal()
  const toast = useToast()
  const state = useBackupState()
  const advice = backupAdvice(state, ownMeals)
  // Synced journals live in the account; the file reminder is for local-only mode.
  if (!advice.due || cloudEnabled) return null
  const save = () =>
    saveBackupFile(repo, ownMeals)
      .then(() => toast.show('Backup saved to your downloads'))
      .catch(() => toast.error('Backup failed. Try again.'))
  return (
    <div className="banner banner-info" role="note">
      <ShieldCheck size={16} aria-hidden />
      <span>
        {state.at ? (
          <>
            <strong>{pluralize(advice.unsaved, 'meal')} since your last backup</strong>, {relativeDays(state.at.slice(0, 10))}.
          </>
        ) : (
          <>
            <strong>Your {pluralize(advice.unsaved, 'meal')} live only in this browser.</strong> Clearing site data would erase them.
          </>
        )}{' '}
        A backup is one file you can import again later.
      </span>
      <span className="banner-actions">
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => snoozeBackupReminder()}>
          Remind me next week
        </button>
        <button type="button" className="btn btn-sm" onClick={save}>
          Save backup
        </button>
      </span>
    </div>
  )
}
