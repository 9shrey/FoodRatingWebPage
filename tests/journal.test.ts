import { describe, expect, it } from 'vitest'
import { backupAdvice, NO_BACKUP } from '../src/domain/backup'
import { buildDiary, logAgainCandidates, suggestMeals, weekSummary } from '../src/domain/journal'
import { summarizeAll } from '../src/domain/summarize'
import type { Food, Occasion } from '../src/domain/types'

const T = '2026-01-01T00:00:00.000Z'
const food = (id: string, name: string, extra: Partial<Food> = {}): Food => ({
  id, name, cuisine: 'Indian', description: '', favourite: false, createdAt: T, updatedAt: T, ...extra,
})
let n = 0
const occ = (foodId: string, date: string, rating: number | null, extra: Partial<Occasion> = {}): Occasion => ({
  id: `o${++n}`, foodId, restaurant: 'Bawarchi', date, rating, notes: '', photoId: null, price: null, mealType: null,
  location: '', custom: {}, createdAt: T, updatedAt: T, ...extra,
})

const TODAY = '2026-03-20'
const foods = [food('a', 'Biryani'), food('b', 'Ramen'), food('c', 'Laksa'), food('d', 'Dosa')]
const occasions = [
  occ('a', '2026-01-05', 4.5, { mealType: 'dinner' }),
  occ('a', '2026-02-10', 4.5, { mealType: 'dinner', notes: 'Extra raita' }),
  occ('b', '2026-03-18', 4, { mealType: 'lunch', restaurant: 'Ippudo' }),
  occ('b', '2026-03-18', 3, { mealType: 'dinner', restaurant: 'Home' }),
  occ('d', '2026-03-01', 2, { mealType: 'breakfast' }),
]
const summaries = summarizeAll(foods, occasions)

describe('diary', () => {
  it('groups meals by day, newest first, dinner before lunch', () => {
    const diary = buildDiary(summaries)
    expect(diary.map((d) => d.date)).toEqual(['2026-03-18', '2026-03-01', '2026-02-10', '2026-01-05'])
    expect(diary[0].entries.map((e) => e.occasion.mealType)).toEqual(['dinner', 'lunch'])
  })
  it('marks the first time a food was eaten', () => {
    const diary = buildDiary(summaries)
    expect(diary.find((d) => d.date === '2026-01-05')!.entries[0].firstTime).toBe(true)
    expect(diary.find((d) => d.date === '2026-02-10')!.entries[0].firstTime).toBe(false)
  })
  it('searches food, place and notes, and leaves out want-to-try foods', () => {
    expect(buildDiary(summaries, 'ippudo')).toHaveLength(1)
    expect(buildDiary(summaries, 'raita')[0].date).toBe('2026-02-10')
    expect(buildDiary(summaries, 'laksa')).toHaveLength(0)
  })
  it('summarises the last seven days', () => {
    expect(weekSummary(summaries, TODAY)).toEqual({ meals: 2, newFoods: 1 })
  })
})

describe('what to eat next', () => {
  it('suggests well-rated food not eaten for a week, and the want-to-try list', () => {
    const names = suggestMeals(summaries, 'dinner', TODAY).map((s) => s.summary.food.name)
    expect(names).toEqual(['Biryani', 'Laksa'])
  })
  it('skips food eaten this week or rated below 3.5', () => {
    const names = suggestMeals(summaries, 'dinner', TODAY).map((s) => s.summary.food.name)
    expect(names).not.toContain('Ramen')
    expect(names).not.toContain('Dosa')
  })
  it('explains each suggestion', () => {
    const [first] = suggestMeals(summaries, 'dinner', TODAY)
    expect(first.reason).toContain('4.5')
    expect(first.reason).toContain('Bawarchi')
  })
  it('offers repeat foods for one-tap logging, not ones already logged today', () => {
    expect(logAgainCandidates(summaries, 'dinner', TODAY).map((s) => s.food.name)).toEqual(['Biryani', 'Ramen'])
    expect(logAgainCandidates(summaries, 'dinner', '2026-03-18').map((s) => s.food.name)).toEqual(['Biryani'])
  })
})

describe('backup reminder', () => {
  const now = new Date('2026-03-20T12:00:00Z')
  it('stays quiet until there are five meals', () => {
    expect(backupAdvice(NO_BACKUP, 4, now).due).toBe(false)
    expect(backupAdvice(NO_BACKUP, 5, now)).toMatchObject({ due: true, unsaved: 5, daysSince: null })
  })
  it('is not due after a recent backup, even with new meals', () => {
    const state = { at: '2026-03-10T12:00:00Z', meals: 5, snoozedUntil: null }
    expect(backupAdvice(state, 40, now)).toMatchObject({ due: false, unsaved: 35, daysSince: 10 })
  })
  it('is due again when the backup is old and meals were added', () => {
    const state = { at: '2026-01-10T12:00:00Z', meals: 5, snoozedUntil: null }
    expect(backupAdvice(state, 10, now).due).toBe(true)
    expect(backupAdvice(state, 7, now).due).toBe(false)
  })
  it('respects a snooze', () => {
    expect(backupAdvice({ ...NO_BACKUP, snoozedUntil: '2026-03-25T00:00:00Z' }, 20, now).due).toBe(false)
    expect(backupAdvice({ ...NO_BACKUP, snoozedUntil: '2026-03-19T00:00:00Z' }, 20, now).due).toBe(true)
  })
})
