import { cuisineStats, rankByRating, restaurantStats, topRated } from './analytics'
import { formatDate } from './dates'
import { formatRating } from './rating'
import { normalizeName, pluralize } from './text'
import type { FoodSummary } from './types'

export interface Insight {
  id: string
  text: string
  /** The numbers behind the statement, so it can be checked */
  evidence: string
}

/** Minimum rated experiences per group for a comparison insight. */
const MIN_GROUP = 3

/**
 * Generate plain-language observations from logged data.
 * Each rule has explicit data thresholds and is skipped when the data is too thin —
 * an empty list is a valid, honest result.
 */
export function generateInsights(summaries: FoodSummary[]): Insight[] {
  const tried = summaries.filter((s) => s.timesEaten > 0)
  const out: Insight[] = []

  // Highest rated cuisine — needs two comparable cuisines and a visible gap.
  const cuisines = rankByRating(cuisineStats(tried).filter((c) => c.name !== 'Unspecified'), MIN_GROUP)
  if (cuisines.length >= 2) {
    const [best, next] = cuisines
    if ((best.avgRating ?? 0) - (next.avgRating ?? 0) >= 0.1) {
      out.push({
        id: 'best-cuisine',
        text: `${best.name} cuisine has your highest average rating.`,
        evidence: `${formatRating(best.avgRating)} across ${pluralize(best.ratedCount, 'rated meal')}, ahead of ${next.name} at ${formatRating(next.avgRating)}.`,
      })
    }
  }

  // Most eaten dish.
  const most = [...tried].sort((a, b) => b.timesEaten - a.timesEaten)[0]
  if (most && most.timesEaten >= 3 && tried.length >= 5) {
    const tie = tried.filter((s) => s.timesEaten === most.timesEaten).length > 1
    out.push({
      id: 'most-eaten',
      text: `You have eaten ${most.food.name.toLowerCase()} ${most.timesEaten} times${tie ? ', tied for your most eaten' : ' — more than anything else'}.`,
      evidence: `First tried ${formatDate(most.firstTried)}, last eaten ${formatDate(most.lastEaten)}.`,
    })
  }

  // Top five rated foods dominated by one cuisine.
  const top5 = topRated(tried, 5)
  if (top5.length === 5) {
    const counts = new Map<string, { name: string; n: number }>()
    for (const s of top5) {
      if (!s.food.cuisine) continue
      const key = normalizeName(s.food.cuisine)
      const c = counts.get(key) ?? { name: s.food.cuisine, n: 0 }
      c.n++
      counts.set(key, c)
    }
    const lead = [...counts.values()].sort((a, b) => b.n - a.n)[0]
    if (lead && lead.n >= 3) {
      out.push({
        id: 'top5-cuisine',
        text: `Your top five rated foods are predominantly ${lead.name}.`,
        evidence: `${lead.n} of 5: ${top5.filter((s) => normalizeName(s.food.cuisine) === normalizeName(lead.name)).map((s) => s.food.name).join(', ')}.`,
      })
    }
  }

  // Most reliable restaurant.
  const places = rankByRating(restaurantStats(tried).filter((r) => r.visits >= 3), MIN_GROUP)
  if (places.length >= 1) {
    const p = places[0]
    out.push({
      id: 'best-restaurant',
      text: `${p.name} is your most consistently good restaurant.`,
      evidence: `${formatRating(p.avgRating)} average over ${pluralize(p.visits, 'visit')} and ${pluralize(p.uniqueFoods, 'dish', 'dishes')}.`,
    })
  }

  // One-and-done share.
  if (tried.length >= 8) {
    const once = tried.filter((s) => s.timesEaten === 1).length
    const pct = Math.round((once / tried.length) * 100)
    out.push({
      id: 'tried-once',
      text:
        pct >= 50
          ? `You're an explorer: ${pct}% of the foods you've tried, you've had only once.`
          : `You're a creature of habit: ${100 - pct}% of the foods you've tried, you've had more than once.`,
      evidence: `${once} of ${tried.length} foods tried exactly once.`,
    })
  }

  return out
}
