function parts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const p: Record<string, string> = {}
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') p[part.type] = part.value
  }
  // 'hour' can be "24" at midnight in some engines — normalize.
  const hour = p.hour === '24' ? '00' : p.hour
  return { y: +p.year, mo: +p.month, d: +p.day, h: +hour, mi: +p.minute, s: +p.second }
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const { y, mo, d, h, mi, s } = parts(date, timeZone)
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

export function localHour(date: Date, timeZone: string): number {
  return parts(date, timeZone).h
}

export function localDateKey(date: Date, timeZone: string): string {
  const { y, mo, d } = parts(date, timeZone)
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** UTC instants for [start-of-local-day, start-of-next-local-day). */
export function localDayWindow(at: Date, timeZone: string): { start: Date; end: Date } {
  const { y, mo, d } = parts(at, timeZone)
  const offset = tzOffsetMs(at, timeZone)
  const start = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0) - offset)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}
