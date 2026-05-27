import { describe, it, expect, vi, beforeEach } from 'vitest'

const calls = { sendText: vi.fn(async () => 'WA1'), settingsUpsert: vi.fn(), outboundCreate: vi.fn(), events: [] as unknown[] }

vi.mock('@/lib/green-api/client', () => ({ sendText: (...a: unknown[]) => calls.sendText(...a) }))
vi.mock('@/lib/db', () => ({
  prisma: {
    task: {
      findMany: vi.fn()
        .mockResolvedValueOnce([{ id: 'a', title: 'היום-1' }]) // today
        .mockResolvedValueOnce([{ id: 'b', title: 'איחור-1' }]), // overdue
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({
      outboundMessage: { create: (...a: unknown[]) => calls.outboundCreate(...a) },
      settings: { upsert: (...a: unknown[]) => calls.settingsUpsert(...a) },
      taskEvent: { create: async ({ data }: { data: unknown }) => { calls.events.push(data) } },
    })),
  },
}))

import { runDailyDigest } from '@/lib/whatsapp/digest-service'

const cfg = {
  idInstance: '1', tokenInstance: 't', apiUrl: 'u', ownerChatId: 'x@c.us',
  digestTimezone: 'Asia/Jerusalem',
} as never

describe('runDailyDigest', () => {
  beforeEach(() => { calls.events = []; vi.clearAllMocks() })

  it('sends, persists snapshot + outbound + SYSTEM events', async () => {
    const res = await runDailyDigest(cfg, new Date('2026-05-19T06:00:00Z'))
    expect(res).toEqual({ sent: true, count: 2 })
    expect(calls.sendText).toHaveBeenCalledOnce()
    expect(calls.settingsUpsert).toHaveBeenCalledOnce()
    expect(calls.outboundCreate).toHaveBeenCalledOnce()
    expect(calls.events).toHaveLength(2)
    expect((calls.events[0] as { actor: string }).actor).toBe('SYSTEM')
    expect((calls.events[0] as { type: string }).type).toBe('REMINDER_SENT')
  })
})
