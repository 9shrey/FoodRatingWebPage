import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { summarizeAll } from '../domain/summarize'
import { distinctByFrequency } from '../domain/text'
import { DEFAULT_CUISINES, type FoodSummary, type JournalData } from '../domain/types'
import { cloudEnabled, repository, type JournalRepository } from '../storage'

export type LoadState = 'loading' | 'ready' | 'error'

interface JournalContextValue {
  status: LoadState
  error: string | null
  data: JournalData
  summaries: FoodSummary[]
  byId: Map<string, FoodSummary>
  /** Autocomplete sources, most used first */
  restaurants: string[]
  cuisines: string[]
  hasSample: boolean
  /** Meals you logged yourself (sample data excluded) */
  ownMeals: number
  repo: JournalRepository
}

const JournalContext = createContext<JournalContextValue | null>(null)

const EMPTY: JournalData = { foods: [], occasions: [] }

function mergeSuggestions(used: string[], defaults: string[]): string[] {
  const seen = new Set(used.map((u) => u.toLowerCase()))
  return [...used, ...defaults.filter((d) => !seen.has(d.toLowerCase()))]
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<JournalData>(EMPTY)
  const [status, setStatus] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      repository.subscribe(
        (d) => {
          setData(d)
          setStatus('ready')
          setError(null)
        },
        (err) => {
          console.error(err)
          setStatus('error')
          setError(
            cloudEnabled
              ? 'Your journal couldn’t be loaded from your account. Check your connection.'
              : err instanceof Error && /indexeddb|database|quota/i.test(err.message)
              ? 'Your browser blocked local storage. Private windows and some privacy settings do this.'
              : 'Your journal couldn’t be loaded from this browser’s storage.',
          )
        },
      ),
    [],
  )

  // Once there is real data, ask the browser not to evict it under storage pressure.
  const hasOwnData = data.foods.some((f) => !f.isSample)
  useEffect(() => {
    if (hasOwnData) navigator.storage?.persist?.().catch(() => {})
  }, [hasOwnData])

  const value = useMemo<JournalContextValue>(() => {
    const summaries = summarizeAll(data.foods, data.occasions)
    return {
      status,
      error,
      data,
      summaries,
      byId: new Map(summaries.map((s) => [s.food.id, s])),
      restaurants: distinctByFrequency(data.occasions.map((o) => o.restaurant)),
      cuisines: mergeSuggestions(distinctByFrequency(data.foods.map((f) => f.cuisine)), DEFAULT_CUISINES),
      hasSample: data.foods.some((f) => f.isSample),
      ownMeals: data.occasions.filter((o) => !o.isSample).length,
      repo: repository,
    }
  }, [data, status, error])

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
}

export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext)
  if (!ctx) throw new Error('useJournal must be used inside JournalProvider')
  return ctx
}
