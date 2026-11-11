import { addDays, daysBetween, formatDateShort, relativeDays, toLocalDate } from './dates'
import { matchesText } from './filters'
import { formatRating } from './rating'
import { compareOccasionsDesc } from './summarize'
import { isHomeCooking } from './text'
import type { Food, FoodSummary, MealType, Occasion } from './types'

export interface DiaryEntry {
  occasion: Occasion
  food: Food
  /** True when this was the first time the food was eaten */
  firstTime: boolean
}

export interface DiaryDay {
  date: string
  entries: DiaryEntry[]
}

/**
 * Every meal as a diary: one group per day, newest day first, and within a day
 * dinner before lunch before breakfast. `query` matches food, cuisine, place, location and notes.
 */
export function buildDiary(summaries: FoodSummary[], query = ''): DiaryDay[] {
  const entries: DiaryEntry[] = []
  for (const s of summaries) {
    for (const o of s.occasions) {
      if (query && !matchesText([s.food.name, s.food.cuisine, o.restaurant, o.location, o.notes], query)) continue
      entries.push({ occasion: o, food: s.food, firstTime: o.date === s.firstTried })
    }
  }
  entries.sort((a, b) => compareOccasionsDesc(a.occasion, b.occasion))
  const days: DiaryDay[] = []
  for (const e of entries) {
    const last = days[days.length - 1]
    if (last && last.date === e.occasion.date) last.entries.push(e)
    else days.push({ date: e.occasion.date, entries: [e] })
  }
  return days
}

export interface WeekSummary {
  meals: number
  /** Foods eaten for the first time in the window */
  newFoods: number
}

/** The last seven days including today. */
export function weekSummary(summaries: FoodSummary[], today = toLocalDate()): WeekSummary {
  const from = addDays(today, -6)
  let meals = 0
  let newFoods = 0
  for (const s of summaries) {
    meals += s.occasions.filter((o) => o.date >= from && o.date <= today).length
    if (s.firstTried && s.firstTried >= from && s.firstTried <= today) newFoods++
  }
  return { meals, newFoods }
}

/**
 * Foods worth a one-tap "log again": things you eat repeatedly, weighted towards
 * the current meal and towards recent habits. Foods already logged today are left out.
 */
export function logAgainCandidates(summaries: FoodSummary[], meal: MealType, today = toLocalDate(), limit = 6): FoodSummary[] {
  return summaries
    .filter((s) => s.timesEaten >= 2 && s.lastEaten !== today)
    .map((s) => {
      const atThisMeal = s.occasions.filter((o) => o.mealType === meal).length
      const recent = s.occasions.filter((o) => daysBetween(o.date, today) <= 60).length
      return { s, score: atThisMeal * 3 + recent * 2 + s.timesEaten }
    })
    .sort((a, b) => b.score - a.score || a.s.food.name.localeCompare(b.s.food.name))
    .slice(0, limit)
    .map((x) => x.s)
}

export interface Suggestion {
  summary: FoodSummary
  /** Why it was suggested, in plain words */
  reason: string
}

/**
 * Ideas for the next meal, best first: food you rate 3.5 or higher and haven't had
 * for at least a week, plus anything on the want-to-try list. Deterministic, so the
 * caller can step through the list.
 */
export function suggestMeals(summaries: FoodSummary[], meal: MealType, today = toLocalDate(), limit = 8): Suggestion[] {
  const scored: { suggestion: Suggestion; score: number }[] = []
  for (const s of summaries) {
    if (s.timesEaten === 0) {
      scored.push({
        score: 84,
        suggestion: { summary: s, reason: `On your want-to-try list since ${formatDateShort(s.food.createdAt.slice(0, 10), today)}.` },
      })
      continue
    }
    const avg = s.avgRating
    if (avg == null || avg < 3.5 || !s.lastEaten) continue
    const gap = daysBetween(s.lastEaten, today)
    if (gap < 7) continue
    const fitsMeal = s.occasions.some((o) => o.mealType === meal)
    const where = s.topRestaurant ? (isHomeCooking(s.topRestaurant) ? ', usually at home' : `, usually at ${s.topRestaurant}`) : ''
    scored.push({
      score: avg * 20 + Math.min(gap, 180) / 6 + (s.food.favourite ? 8 : 0) + (fitsMeal ? 10 : 0),
      suggestion: { summary: s, reason: `You rate it ${formatRating(avg)} and last had it ${relativeDays(s.lastEaten, today)}${where}.` },
    })
  }
  return scored
    .sort((a, b) => b.score - a.score || a.suggestion.summary.food.name.localeCompare(b.suggestion.summary.food.name))
    .slice(0, limit)
    .map((x) => x.suggestion)
}
