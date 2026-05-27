import { describe, it, expect } from 'vitest'
import { localDayWindow, localHour, localDateKey } from '@/lib/whatsapp/time'

describe('time helpers (Asia/Jerusalem)', () => {
  const tz = 'Asia/Jerusalem'

  it('localDayWindow returns UTC instants bounding the local day', () => {
    // 2026-05-19 09:00 Israel (UTC+3 in summer) == 2026-05-19T06:00:00Z
    const at = new Date('2026-05-19T06:00:00Z')
    const { start, end } = localDayWindow(at, tz)
    expect(start.toISOString()).toBe('2026-05-18T21:00:00.000Z')
    expect(end.toISOString()).toBe('2026-05-19T21:00:00.000Z')
  })

  it('localHour returns the wall-clock hour in the tz', () => {
    expect(localHour(new Date('2026-05-19T06:00:00Z'), tz)).toBe(9)
  })

  it('localDateKey returns YYYY-MM-DD in the tz', () => {
    expect(localDateKey(new Date('2026-05-19T06:00:00Z'), tz)).toBe('2026-05-19')
  })
})
