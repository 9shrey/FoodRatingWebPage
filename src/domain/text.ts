/** Normalise a name for duplicate detection and grouping. */
export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Trim and collapse whitespace, keep the user's casing. */
export function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/** Split a comma separated string into unique, trimmed values. */
export function splitList(value: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of value.split(',')) {
    const v = cleanText(part)
    if (v && !seen.has(normalizeName(v))) {
      seen.add(normalizeName(v))
      out.push(v)
    }
  }
  return out
}

const HOME_NAMES = new Set(['home', 'homemade', 'home cooked', 'home-cooked', 'my kitchen'])

export function isHomeCooking(restaurant: string): boolean {
  return HOME_NAMES.has(normalizeName(restaurant))
}

/** Distinct values (by normalised name), keeping the most common spelling, sorted by frequency. */
export function distinctByFrequency(values: string[]): string[] {
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>()
  for (const raw of values) {
    const v = cleanText(raw)
    if (!v) continue
    const key = normalizeName(v)
    const g = groups.get(key) ?? { count: 0, spellings: new Map() }
    g.count++
    g.spellings.set(v, (g.spellings.get(v) ?? 0) + 1)
    groups.set(key, g)
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .map((g) => [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0])
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
