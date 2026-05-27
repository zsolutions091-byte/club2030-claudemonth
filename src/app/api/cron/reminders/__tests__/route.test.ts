import { describe, it, expect, vi, beforeEach } from 'vitest'

const cfg = { cronSecret: 'cron-shared-secret' } as never

vi.mock('@/lib/whatsapp/config', () => ({ loadWhatsappConfig: () => cfg }))
const runReminderSweep = vi.fn(async () => ({ sent: 2, failed: 0, skipped: 1 }))
vi.mock('@/lib/whatsapp/reminder-service', () => ({
  runReminderSweep: (...a: unknown[]) => runReminderSweep(...a),
}))

import { POST } from '@/app/api/cron/reminders/route'

function req(auth?: string) {
  return new Request('http://x/api/cron/reminders', {
    method: 'POST',
    headers: auth ? { Authorization: auth } : {},
  })
}

describe('reminders cron route', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 without the cron bearer', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect(runReminderSweep).not.toHaveBeenCalled()
  })

  it('401 with wrong secret', async () => {
    const res = await POST(req('Bearer wrong'))
    expect(res.status).toBe(401)
    expect(runReminderSweep).not.toHaveBeenCalled()
  })

  it('runs sweep and returns counts when authorized', async () => {
    const res = await POST(req('Bearer cron-shared-secret'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 2, failed: 0, skipped: 1 })
    expect(runReminderSweep).toHaveBeenCalledOnce()
  })
})
