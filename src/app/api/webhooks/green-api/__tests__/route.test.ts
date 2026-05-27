import { describe, it, expect, vi, beforeEach } from 'vitest'

const cfg = {
  webhookToken: 'sek', ownerPhone: '972501234567',
  idInstance: '1', tokenInstance: 't', apiUrl: 'u',
  digestTimezone: 'Asia/Jerusalem',
} as never
vi.mock('@/lib/whatsapp/config', () => ({ loadWhatsappConfig: () => cfg }))

const inbound = { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({ id: 'in1' })), update: vi.fn() }
const outboundCreate = vi.fn()
const outboundFindFirst = vi.fn(async () => null)
vi.mock('@/lib/db', () => ({ prisma: {
  inboundMessage: {
    findUnique: (...a: unknown[]) => inbound.findUnique(...a),
    create: (...a: unknown[]) => inbound.create(...a),
    update: (...a: unknown[]) => inbound.update(...a),
  },
  outboundMessage: {
    create: (...a: unknown[]) => outboundCreate(...a),
    findFirst: (...a: unknown[]) => outboundFindFirst(...a),
  },
} }))
const buildContext = vi.fn(async () => ({ tasks: [], focusedTaskId: null, projects: [], tags: [] }))
vi.mock('@/lib/whatsapp/resolve-task', () => ({ buildContext: (...a: unknown[]) => buildContext(...a) }))
const parseCommand = vi.fn(async () => ({ kind: 'list_today' }))
vi.mock('@/lib/whatsapp/nlu', () => ({ parseCommand: (...a: unknown[]) => parseCommand(...a) }))
vi.mock('@/lib/whatsapp/process-command', () => ({ processCommand: vi.fn(async () => ({ reply: 'אין משימות' })) }))
const sendText = vi.fn(async () => 'WAout')
vi.mock('@/lib/green-api/client', () => ({ sendText: (...a: unknown[]) => sendText(...a) }))

import { POST } from '@/app/api/webhooks/green-api/[token]/route'

function body(sender: string, text: string, idMessage = 'WAin1') {
  return new Request('http://x', {
    method: 'POST',
    body: JSON.stringify({
      typeWebhook: 'incomingMessageReceived',
      idMessage,
      senderData: { sender: `${sender}@c.us`, chatId: `${sender}@c.us` },
      messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } },
    }),
  })
}

function quotedBody(sender: string, text: string, quotedWaId: string, idMessage = 'WAin2') {
  return new Request('http://x', {
    method: 'POST',
    body: JSON.stringify({
      typeWebhook: 'incomingMessageReceived',
      idMessage,
      senderData: { sender: `${sender}@c.us`, chatId: `${sender}@c.us` },
      messageData: {
        typeMessage: 'quotedMessage',
        extendedTextMessageData: { text },
        quotedMessage: { stanzaId: quotedWaId },
      },
    }),
  })
}

const ctxParam = (token: string) => ({ params: Promise.resolve({ token }) })

describe('green-api webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    outboundFindFirst.mockResolvedValue(null)
    buildContext.mockResolvedValue({ tasks: [], focusedTaskId: null, projects: [], tags: [] })
  })

  it('404 on bad token', async () => {
    const res = await POST(body('972501234567', 'hi'), ctxParam('wrong'))
    expect(res.status).toBe(404)
  })

  it('ignores a foreign sender with 200 and no processing', async () => {
    const res = await POST(body('972500000000', 'hi'), ctxParam('sek'))
    expect(res.status).toBe(200)
    expect(parseCommand).not.toHaveBeenCalled()
  })

  it('processes the owner message and replies', async () => {
    const res = await POST(body('972501234567', 'רשימה'), ctxParam('sek'))
    expect(res.status).toBe(200)
    expect(parseCommand).toHaveBeenCalledOnce()
    expect(sendText).toHaveBeenCalledOnce()
    expect(inbound.update).toHaveBeenCalledOnce()
  })

  it('resolves a quoted reply to a focused task and threads it into buildContext', async () => {
    outboundFindFirst.mockResolvedValue({ taskId: 'task-X' })
    const res = await POST(
      quotedBody('972501234567', 'סיימתי', 'WA-OUT-7'),
      ctxParam('sek'),
    )
    expect(res.status).toBe(200)
    expect(outboundFindFirst).toHaveBeenCalledWith({
      where: { waMessageId: 'WA-OUT-7' },
      select: { taskId: true },
    })
    // Third arg to buildContext is the focusedTaskId.
    expect(buildContext.mock.calls[0]?.[2]).toBe('task-X')
    // matchedTaskId is persisted on the inbound row.
    expect(inbound.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ matchedTaskId: 'task-X' }),
    }))
  })
})
