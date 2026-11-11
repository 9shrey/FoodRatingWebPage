const pad = (n: number) => String(n).padStart(2, '0')

/** Local date as YYYY-MM-DD */
export function toLocalDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function monthKey(date: string): string {
  return date.slice(0, 7)
}

/** Parse YYYY-MM-DD as a local date (not UTC). */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function daysBetween(a: string, b: string): number {
  const ms = parseLocalDate(b).getTime() - parseLocalDate(a).getTime()
  return Math.round(ms / 86_400_000)
}

export function addDays(date: string, days: number): string {
  const d = parseLocalDate(date)
  d.setDate(d.getDate() + days)
  return toLocalDate(d)
}

/** Last `count` month keys ending with the month of `today`, oldest first. */
export function recentMonths(count: number, today: string = toLocalDate()): string[] {
  const d = parseLocalDate(today)
  d.setDate(1)
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${m.getFullYear()}-${pad(m.getMonth() + 1)}`)
  }
  return out
}

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const shortFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' })

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return dateFmt.format(parseLocalDate(date))
}

/** Omit the year when it is the current year. */
export function formatDateShort(date: string | null | undefined, today: string = toLocalDate()): string {
  if (!date) return '—'
  if (date.slice(0, 4) === today.slice(0, 4)) return shortFmt.format(parseLocalDate(date))
  return dateFmt.format(parseLocalDate(date))
}

export function formatMonth(key: string): string {
  return monthFmt.format(parseLocalDate(`${key}-01`))
}

export function relativeDays(date: string | null, today: string = toLocalDate()): string {
  if (!date) return 'never'
  const days = daysBetween(date, today)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'} ago`
  if (days < 60) return unit(Math.round(days / 7), 'week')
  if (days < 730) return unit(Math.round(days / 30), 'month')
  return unit(Math.round(days / 365), 'year')
}

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
const dayYearFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/** Weekday and date for diary headings; the year only when it isn't this year. */
export function formatDay(date: string, today: string = toLocalDate()): string {
  return (date.slice(0, 4) === today.slice(0, 4) ? dayFmt : dayYearFmt).format(parseLocalDate(date))
}

/** "Today", "Yesterday" or null for any other day. */
export function dayNickname(date: string, today: string = toLocalDate()): string | null {
  const d = daysBetween(date, today)
  return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : null
}

const weekdayShortFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const monthShortFmt = new Intl.DateTimeFormat(undefined, { month: 'short' })

/** A date split up for the diary's date rail: day of month, short weekday, short month (with the year when it isn't this year). */
export function dayParts(date: string, today: string = toLocalDate()): { day: number; weekday: string; month: string } {
  const d = parseLocalDate(date)
  const month = monthShortFmt.format(d)
  return {
    day: d.getDate(),
    weekday: weekdayShortFmt.format(d),
    month: date.slice(0, 4) === today.slice(0, 4) ? month : `${month} ${d.getFullYear()}`,
  }
}
