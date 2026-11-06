export type RangeChoice = 'last24Hours' | 'previousWeek' | 'sinceLastCatchUp'

export interface TimeWindow {
  start: Date
  end: Date
}

export function localWeekStart(locale: string): number {
  // Intl reports Monday as 1 and Sunday as 7. Date.getDay uses Sunday as 0.
  const localized = new Intl.Locale(locale) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number }
    weekInfo?: { firstDay: number }
  }
  const info = localized.getWeekInfo?.() ?? localized.weekInfo
  if (!info) throw new Error('This browser cannot determine the locale calendar week.')
  return info.firstDay % 7
}

export function previousCalendarWeek(now: Date, locale: string): TimeWindow {
  const firstDay = localWeekStart(locale)
  const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const daysSinceWeekStart = (thisWeekStart.getDay() - firstDay + 7) % 7
  thisWeekStart.setDate(thisWeekStart.getDate() - daysSinceWeekStart)

  const previousWeekStart = new Date(thisWeekStart)
  previousWeekStart.setDate(previousWeekStart.getDate() - 7)

  return { start: previousWeekStart, end: thisWeekStart }
}

export function getTimeWindow(
  choice: RangeChoice,
  now: Date,
  locale: string,
  lastCompletedAt: Date | null,
): TimeWindow | null {
  if (choice === 'last24Hours') {
    return { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now }
  }

  if (choice === 'previousWeek') {
    return previousCalendarWeek(now, locale)
  }

  return lastCompletedAt ? { start: lastCompletedAt, end: now } : null
}

export function isInWindow(occurredAt: string, window: TimeWindow): boolean {
  const time = Date.parse(occurredAt)
  return Number.isFinite(time) && time >= window.start.getTime() && time < window.end.getTime()
}

export function formatWindow(window: TimeWindow, locale: string): string {
  const date = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
  const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' })
  return `${date.format(window.start)} ${time.format(window.start)} – ${date.format(window.end)} ${time.format(window.end)}`
}
