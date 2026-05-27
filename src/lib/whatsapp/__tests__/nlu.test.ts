import { describe, it, expect, vi } from 'vitest'

const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { create } },
}))

import { parseCommand } from '@/lib/whatsapp/nlu'

const cfg = { anthropicApiKey: 'k', anthropicModel: 'claude-haiku-4-5' } as never
const ctx = { tasks: [{ ref: 1, id: 'a', title: 'לקנות חלב', status: 'OPEN' }] }

describe('parseCommand', () => {
  it('maps a tool_use block to a normalized intent', async () => {
    create.mockResolvedValue({
      content: [{ type: 'tool_use', name: 'complete_task', input: { ref: 1 } }],
    })
    const intent = await parseCommand(cfg, 'סיימתי את הראשונה', ctx)
    expect(intent).toEqual({ kind: 'complete_task', ref: 1 })
  })

  it('falls back to clarify when no tool is used', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: 'לא הבנתי' }] })
    const intent = await parseCommand(cfg, '???', ctx)
    expect(intent.kind).toBe('clarify')
  })
})
