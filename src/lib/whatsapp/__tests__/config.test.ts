import { describe, it, expect } from 'vitest'
import { loadWhatsappConfig } from '@/lib/whatsapp/config'

const base = {
  GREEN_API_ID_INSTANCE: '1101',
  GREEN_API_TOKEN_INSTANCE: 'tok',
  WHATSAPP_OWNER_PHONE: '972501234567',
  WHATSAPP_WEBHOOK_TOKEN: 'secret',
  ANTHROPIC_API_KEY: 'sk-ant',
  CRON_SECRET: 'cron',
}

describe('loadWhatsappConfig', () => {
  it('derives chatId and applies defaults', () => {
    const c = loadWhatsappConfig(base)
    expect(c.ownerChatId).toBe('972501234567@c.us')
    expect(c.apiUrl).toBe('https://api.green-api.com')
    expect(c.digestHourLocal).toBe(8)
    expect(c.digestTimezone).toBe('Asia/Jerusalem')
  })

  it('throws an operator error when a required var is missing', () => {
    expect(() => loadWhatsappConfig({ ...base, GREEN_API_ID_INSTANCE: '' }))
      .toThrow('GREEN_API_ID_INSTANCE')
  })
})
