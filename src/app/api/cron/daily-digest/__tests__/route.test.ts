import { describe, it, expect, vi, beforeEach } from 'vitest'

const cfg = {
  cronSecret: 'cron', digestHourLocal: 9, digestTimezone: 'Asia/Jerusalem',
} as never

vi.mock('@/lib/whatsapp/config', () => ({ loadWhatsappConfig: () => cfg }))
const runDailyDigest = vi.fn(async () => ({ sent: true, count: 1 }))
vi.mock('@/lib/whatsapp/digest-service', () => ({ runDailyDigest: (...a: unknown[]) => runDailyDigest(...a) }))
const findUnique = vi.fn(async () => null)
vi.mock('@/lib/db', () => ({ prisma: { settings: { findUnique: (...a: unknown[]) => findUnique(...a) } } }))

import { POST } from '@/app/api/cron/daily-digest/route'

function req(auth?: string) {
  return new Request('http://x/api/cron/daily-digest', {
    method: 'POST', headers: auth ? { Authorization: auth } : {},
  })
}

describe('daily-digest route', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 without the cron bearer', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
  })

  it('skips off-hour with 200', async () => {
    // 2026-05-19T01:00:00Z == 04:00 Israel, not hour 9
    vi.useFakeTimers().setSystemTime(new Date('2026-05-19T01:00:00Z'))
    const res = await POST(req('Bearer cron'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ skipped: 'off-hour' })
    expect(runDailyDigest).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('runs on the configured hour when not already sent', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-05-19T06:00:00Z')) // 09:00 Israel
    const res = await POST(req('Bearer cron'))
    expect(res.status).toBe(200)
    expect(runDailyDigest).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})
