import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendText } from '@/lib/green-api/client'

const cfg = {
  idInstance: '1101', tokenInstance: 'tok', apiUrl: 'https://api.green-api.com',
} as const

afterEach(() => vi.restoreAllMocks())

describe('sendText', () => {
  it('POSTs to the SendMessage endpoint and returns waMessageId', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ idMessage: 'WA123' }), { status: 200 }),
    )
    const id = await sendText(cfg, '972501234567@c.us', 'שלום')
    expect(id).toBe('WA123')
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://api.green-api.com/waInstance1101/sendMessage/tok')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      chatId: '972501234567@c.us', message: 'שלום',
    })
  })

  it('throws on non-200', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('bad', { status: 500 }))
    await expect(sendText(cfg, 'x@c.us', 'hi')).rejects.toThrow('Green API send failed: 500')
  })
})
