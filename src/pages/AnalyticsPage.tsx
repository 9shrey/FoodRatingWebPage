import { BarChart3, Lightbulb, Plus } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState, FavMark, FoodThumb } from '../components/ui/misc'
import { PageSkeleton } from '../layout/PageSkeleton'
import { RatingDisplay } from '../components/ui/Rating'
import {
  computeOverview,
  cuisineStats,
  MIN_RATED_FOR_AVERAGE,
  monthlyTimeline,
  mostEaten,
  rankByRating,
  ratingDistribution,
  recentlyDiscoveredFavourites,
  recentlyEaten,
  recentlyRevisitedFavourites,
  restaurantStats,
  topRated,
  triedOnce,
  type GroupStat,
} from '../domain/analytics'
import { formatDateShort, formatMonth, relativeDays } from '../domain/dates'
import { generateInsights } from '../domain/insights'
import { formatRating } from '../domain/rating'
import { pluralize } from '../domain/text'
import type { FoodSummary } from '../domain/types'
import { useJournal } from '../state/JournalProvider'
import { useUI } from '../state/UIProvider'
import { useIsMobile } from '../state/usePersistentState'

const BAR = '#6b2d7b'
const GRID = '#ece6f1'
const AXIS = { fontSize: 12, fill: '#6e5f74' }

export function AnalyticsPage() {
  const { summaries, status } = useJournal()
  const { openLog } = useUI()
  const tried = useMemo(() => summaries.filter((s) => s.timesEaten > 0), [summaries])

  if (status === 'loading') return <PageSkeleton />
  if (!tried.length) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Analytics</h1>
        </header>
        <EmptyState
          icon={<BarChart3 size={22} />}
          title="Nothing to analyse yet"
          actions={
            <button type="button" className="btn btn-primary btn-lg" onClick={() => openLog()}>
              <Plus size={16} /> Log a meal
            </button>
          }
        >
          Once you’ve logged a few meals, this page shows your favourite foods, cuisines, restaurants and how your tastes change over time.
        </EmptyState>
      </div>
    )
  }
  return <Analytics summaries={summaries} />
}

function Analytics({ summaries }: { summaries: FoodSummary[] }) {
  const overview = useMemo(() => computeOverview(summaries), [summaries])
  const insights = useMemo(() => generateInsights(summaries), [summaries])
  const cuisines = useMemo(() => cuisineStats(summaries), [summaries])
  const restaurants = useMemo(() => restaurantStats(summaries), [summaries])
  const timeline = useMemo(() => monthlyTimeline(summaries, 12), [summaries])
  const [distMode, setDistMode] = useState<'meals' | 'foods'>('meals')
  const distribution = useMemo(
    () =>
      ratingDistribution(
        distMode === 'meals' ? summaries.flatMap((s) => s.occasions.map((o) => o.rating)) : summaries.map((s) => s.avgRating),
      ),
    [summaries, distMode],
  )
  const ratedCount = distribution.reduce((n, b) => n + b.count, 0)

  return (
    <div className="page analytics">
      <header className="page-head">
        <div>
          <h1>Analytics</h1>
          <p className="muted page-sub">Patterns from {pluralize(overview.occasions, 'logged meal')}. Unique foods and meals are counted separately.</p>
        </div>
      </header>

      <section aria-labelledby="ov" className="section">
        <h2 id="ov" className="sr-only">
          Overview
        </h2>
        <div className="stats">
          <Stat label="Unique foods tried" value={overview.uniqueFoodsTried} sub={overview.wantToTry ? `${overview.wantToTry} more on your list` : undefined} />
          <Stat label="Meals logged" value={overview.occasions} sub={`${(overview.occasions / Math.max(1, overview.uniqueFoodsTried)).toFixed(1)} per food`} />
          <Stat
            label="Average food rating"
            value={formatRating(overview.avgFoodRating)}
            sub={overview.ratedFoods ? `across ${pluralize(overview.ratedFoods, 'rated food')}` : 'no ratings yet'}
          />
          <Stat label="Restaurants visited" value={overview.restaurantsVisited} sub="home cooking excluded" />
          <Stat label="Cuisines explored" value={overview.cuisinesExplored} />
          <Stat label="New foods this month" value={overview.newFoodsThisMonth} />
        </div>
      </section>

      <section aria-labelledby="ins" className="section">
        <div className="section-head">
          <h2 id="ins">What your journal says</h2>
        </div>
        {insights.length ? (
          <ul className="insights">
            {insights.map((i) => (
              <li key={i.id} className="insight">
                <Lightbulb size={16} aria-hidden />
                <div>
                  <p>{i.text}</p>
                  <p className="faint">{i.evidence}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted panel panel-pad">
            Not enough data for reliable observations yet. Insights appear once there are at least {3} rated meals in a group being compared — for example, two cuisines with three rated meals each.
          </p>
        )}
      </section>

      <section aria-labelledby="fav" className="section">
        <div className="section-head">
          <h2 id="fav">Favourite foods</h2>
        </div>
        <div className="quad">
          <RankList title="Highest rated" items={topRated(summaries, 5)} value={(s) => <RatingDisplay value={s.avgRating} size="sm" />} />
          <RankList title="Most eaten" items={mostEaten(summaries, 5)} value={(s) => <span className="num">{s.timesEaten}×</span>} />
          <RankList
            title="Personal favourites"
            items={summaries.filter((s) => s.food.favourite).sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0)).slice(0, 5)}
            value={(s) => <RatingDisplay value={s.avgRating} size="sm" showPips={false} />}
            empty="Tap the heart on any food to mark it as a favourite."
          />
          <RankList
            title="Recently discovered favourites"
            hint="First tried in the last 90 days, favourited or rated 8.5+"
            items={recentlyDiscoveredFavourites(summaries, 90, undefined, 5)}
            value={(s) => <span className="muted">{formatDateShort(s.firstTried)}</span>}
            empty="No new favourites in the last 90 days."
          />
        </div>
      </section>

      <section aria-labelledby="dist" className="section">
        <div className="section-head">
          <h2 id="dist">Rating distribution</h2>
          <div className="segmented" role="radiogroup" aria-label="Count">
            <button type="button" role="radio" aria-checked={distMode === 'meals'} onClick={() => setDistMode('meals')}>
              Meals
            </button>
            <button type="button" role="radio" aria-checked={distMode === 'foods'} onClick={() => setDistMode('foods')}>
              Foods
            </button>
          </div>
        </div>
        <div className="panel panel-pad">
          <p className="muted chart-cap">
            {distMode === 'meals' ? `Every rated meal (${ratedCount})` : `Each food’s average rating (${ratedCount} foods)`}, in half stars.
          </p>
          <ChartBox height={200} label="Rating distribution">
            <BarChart data={distribution} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: '#f5f0f8' }} content={<ChartTip format={(p) => `${p.label} ★: ${p.value} ${distMode}`} />} />
              <Bar dataKey="count" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ChartBox>
        </div>
      </section>

      <CuisineSection cuisines={cuisines} />
      <RestaurantSection restaurants={restaurants} />

      <section aria-labelledby="disc" className="section">
        <div className="section-head">
          <h2 id="disc">Food discovery</h2>
        </div>
        <div className="duo">
          <div className="panel panel-pad">
            <h3>New foods each month</h3>
            <p className="muted chart-cap">Foods tried for the first time, last 12 months</p>
            <ChartBox height={180} label="New foods each month">
              <BarChart data={timeline} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="month" tickFormatter={formatMonth} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={12} />
                <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f5f0f8' }} content={<ChartTip format={(p) => `${formatMonth(String(p.label))}: ${pluralize(Number(p.value), 'new food')}`} />} />
                <Bar dataKey="newFoods" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ChartBox>
          </div>
          <div className="panel panel-pad">
            <h3>Meals logged each month</h3>
            <p className="muted chart-cap">Every eating occasion, last 12 months</p>
            <ChartBox height={180} label="Meals logged each month">
              <BarChart data={timeline} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="month" tickFormatter={formatMonth} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={12} />
                <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f5f0f8' }} content={<ChartTip format={(p) => `${formatMonth(String(p.label))}: ${pluralize(Number(p.value), 'meal')}`} />} />
                <Bar dataKey="occasions" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ChartBox>
          </div>
        </div>
        <div className="trio">
          <RankList title="Recently tried" items={recentlyEaten(summaries, 6)} value={(s) => <span className="muted">{relativeDays(s.lastEaten)}</span>} />
          <RankList
            title="Not tried again"
            hint="Eaten only once"
            items={triedOnce(summaries).slice(0, 6)}
            value={(s) => <RatingDisplay value={s.avgRating} size="sm" showPips={false} />}
            empty="You’ve had everything at least twice."
          />
          <RankList
            title="Recently revisited favourites"
            hint="Favourites eaten again in the last 60 days"
            items={recentlyRevisitedFavourites(summaries, 60, undefined, 6)}
            value={(s) => <span className="muted">{relativeDays(s.lastEaten)}</span>}
            empty="No favourites revisited in the last 60 days."
          />
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-value num">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub faint">{sub}</div>}
    </div>
  )
}

function ChartBox({ height, label, children }: { height: number; label: string; children: React.ReactElement }) {
  return (
    <div style={{ width: '100%', height }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

type TipPayload = { label?: unknown; value: unknown }
function ChartTip({ active, payload, label, format }: { active?: boolean; payload?: { value: unknown }[]; label?: unknown; format: (p: TipPayload) => string }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tip">{format({ label, value: payload[0].value })}</div>
}

function RankList({
  title,
  hint,
  items,
  value,
  empty = 'Not enough data yet.',
}: {
  title: string
  hint?: string
  items: FoodSummary[]
  value: (s: FoodSummary) => ReactNode
  empty?: string
}) {
  const { openFood } = useUI()
  return (
    <div className="panel rank">
      <div className="rank-head">
        <h3>{title}</h3>
        {hint && <p className="faint">{hint}</p>}
      </div>
      {items.length === 0 ? (
        <p className="muted rank-empty">{empty}</p>
      ) : (
        <ol className="rank-list">
          {items.map((s) => (
            <li key={s.food.id}>
              <button type="button" className="rank-row" onClick={() => openFood(s.food.id)}>
                <FoodThumb name={s.food.name} photoId={s.coverPhotoId} size={28} />
                <span className="rank-name">
                  <span className="truncate">{s.food.name}</span>
                  {s.food.favourite && <FavMark size={12} />}
                </span>
                <span className="rank-val">{value(s)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function GroupTable({
  rows,
  kind,
  firstCol,
}: {
  rows: GroupStat[]
  kind: 'cuisine' | 'restaurant'
  firstCol: string
}) {
  const navigate = useNavigate()
  return (
    <div className="table-wrap table-compact">
      <table className="table">
        <thead>
          <tr>
            <th>{firstCol}</th>
            <th className="th-right">{kind === 'restaurant' ? 'Visits' : 'Meals'}</th>
            <th className="th-right">Unique foods</th>
            <th>Avg rating</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} onClick={() => navigate(`/foods?${kind}=${encodeURIComponent(r.name)}`)} title={`Show ${r.name} foods`}>
              <td>
                <a
                  href={`/?${kind}=${encodeURIComponent(r.name)}`}
                  className="cell-name-link"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    navigate(`/foods?${kind}=${encodeURIComponent(r.name)}`)
                  }}
                >
                  {r.name}
                </a>
              </td>
              <td className="td-right num">{kind === 'restaurant' ? r.visits : r.occasions}</td>
              <td className="td-right num">{r.uniqueFoods}</td>
              <td>
                {r.ratedCount >= MIN_RATED_FOR_AVERAGE ? (
                  <RatingDisplay value={r.avgRating} size="sm" />
                ) : (
                  <span className="faint" title={`Shown after ${MIN_RATED_FOR_AVERAGE} rated meals`}>
                    {r.ratedCount ? `${formatRating(r.avgRating)} from 1 rating` : 'Not rated'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CuisineSection({ cuisines }: { cuisines: GroupStat[] }) {
  const [metric, setMetric] = useState<'occasions' | 'uniqueFoods' | 'avgRating'>('occasions')
  const isMobile = useIsMobile()
  const chartData = useMemo(() => {
    const base = metric === 'avgRating' ? rankByRating(cuisines) : [...cuisines].sort((a, b) => b[metric] - a[metric])
    return base.slice(0, 8).map((c) => ({ name: c.name, value: metric === 'avgRating' ? c.avgRating : c[metric] }))
  }, [cuisines, metric])
  const best = rankByRating(cuisines)[0]
  const labelFor = { occasions: 'meals', uniqueFoods: 'unique dishes', avgRating: 'average rating' }[metric]

  return (
    <section aria-labelledby="cui" className="section">
      <div className="section-head">
        <h2 id="cui">Cuisines</h2>
        <div className="segmented" role="radiogroup" aria-label="Cuisine metric">
          {(
            [
              ['occasions', 'Most eaten'],
              ['uniqueFoods', 'Unique dishes'],
              ['avgRating', 'Highest rated'],
            ] as const
          ).map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={metric === v} onClick={() => setMetric(v)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="duo duo-chart">
        <div className="panel panel-pad">
          <p className="muted chart-cap">
            Top {chartData.length} by {labelFor}
            {metric === 'avgRating' && ` (cuisines with ${MIN_RATED_FOR_AVERAGE}+ rated meals)`}
            {best && metric !== 'avgRating' && `. Best rated: ${best.name} at ${formatRating(best.avgRating)}`}
          </p>
          {chartData.length ? (
            <ChartBox height={Math.max(140, chartData.length * 34)} label={`Cuisines by ${labelFor}`}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" hide domain={metric === 'avgRating' ? [0, 5] : [0, 'auto']} />
                <YAxis type="category" dataKey="name" width={isMobile ? 96 : 120} tick={{ ...AXIS, fill: '#45304c' }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f5f0f8' }} content={<ChartTip format={(p) => `${metric === 'avgRating' ? formatRating(Number(p.value)) : p.value} ${labelFor}`} />} />
                <Bar
                  dataKey="value"
                  fill={BAR}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                  label={{ position: 'right', fontSize: 12, fill: '#45304c', formatter: (v: unknown) => (metric === 'avgRating' ? formatRating(Number(v)) : String(v)) }}
                />
              </BarChart>
            </ChartBox>
          ) : (
            <p className="muted">Rate a few more meals to compare cuisines.</p>
          )}
        </div>
        <GroupTable rows={cuisines} kind="cuisine" firstCol="Cuisine" />
      </div>
    </section>
  )
}

function RestaurantSection({ restaurants }: { restaurants: GroupStat[] }) {
  const [order, setOrder] = useState<'visits' | 'rating'>('visits')
  const rows = order === 'visits' ? restaurants : [...rankByRating(restaurants), ...restaurants.filter((r) => r.ratedCount < MIN_RATED_FOR_AVERAGE)]
  return (
    <section aria-labelledby="res" className="section">
      <div className="section-head">
        <h2 id="res">Restaurants</h2>
        <div className="segmented" role="radiogroup" aria-label="Restaurant order">
          <button type="button" role="radio" aria-checked={order === 'visits'} onClick={() => setOrder('visits')}>
            Most visited
          </button>
          <button type="button" role="radio" aria-checked={order === 'rating'} onClick={() => setOrder('rating')}>
            Highest rated
          </button>
        </div>
      </div>
      {restaurants.length ? (
        <>
          <p className="muted chart-cap">
            A visit is a day you ate there. Averages need {MIN_RATED_FOR_AVERAGE}+ rated meals. Click a row to see its foods.
          </p>
          <GroupTable rows={rows.slice(0, 15)} kind="restaurant" firstCol="Restaurant" />
        </>
      ) : (
        <p className="muted panel panel-pad">Add a restaurant when you log a meal to see restaurant analytics.</p>
      )}
    </section>
  )
}
