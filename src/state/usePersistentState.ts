import { useEffect, useState } from 'react'

/** UI preferences stored in localStorage. Falls back to defaults if storage is unavailable. */
export function usePersistentState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`fj:${key}`)
      if (raw == null) return initial
      const parsed = JSON.parse(raw) as T
      // Shallow-merge plain objects so newly added preference keys get defaults.
      if (isPlainObject(initial) && isPlainObject(parsed)) return { ...initial, ...parsed }
      return parsed
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(`fj:${key}`, JSON.stringify(value))
    } catch {
      /* storage unavailable: keep in memory only */
    }
  }, [key, value])
  return [value, setValue]
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export const useIsMobile = () => useMediaQuery('(max-width: 767px)')
