import { NextResponse } from 'next/server'
import { loadWhatsappConfig } from '@/lib/whatsapp/config'
import { prisma } from '@/lib/db'
import { buildContext } from '@/lib/whatsapp/resolve-task'
import { parseCommand } from '@/lib/whatsapp/nlu'
import { processCommand } from '@/lib/whatsapp/process-command'
import { sendText } from '@/lib/green-api/client'

export const dynamic = 'force-dynamic'

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

interface MessageData {
  typeMessage?: string
  textMessageData?: { textMessage?: string }
  extendedTextMessageData?: { text?: string }
  quotedMessage?: { stanzaId?: string; idMessage?: string }
}

function extractText(md: MessageData | undefined): string {
  const direct = md?.textMessageData?.textMessage
  if (direct && direct.trim().length > 0) return direct.trim()
  const ext = md?.extendedTextMessageData?.text
  return (ext ?? '').trim()
}

function extractQuotedWaId(md: MessageData | undefined): string | null {
  const q = md?.quotedMessage
  if (!q) return null
  return (q.stanzaId || q.idMessage || '').trim() || null
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const cfg = loadWhatsappConfig()
  const { token } = await ctx.params
  if (!safeEqual(token, cfg.webhookToken)) {
    return new NextResponse('Not found', { status: 404 })
  }

  let payload: Record<string, unknown>
  try {
    payload = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: true }) // ignore malformed
  }

  if (payload.typeWebhook !== 'incomingMessageReceived') {
    return NextResponse.json({ ok: true }) // status/ack webhooks — ignore
  }

  const sender = String(
    (payload.senderData as { sender?: string } | undefined)?.sender ?? '',
  )
  const senderPhone = sender.replace(/@c\.us$/, '').replace(/\D/g, '')
  const messageData = payload.messageData as MessageData | undefined
  const text = extractText(messageData)
  const quotedWaId = extractQuotedWaId(messageData)
  const waMessageId = String(payload.idMessage ?? '')

  // Foreign sender → silently ignore (no info disclosure, no persistence).
  if (senderPhone !== cfg.ownerPhone) {
    return NextResponse.json({ ok: true })
  }

  // Dedup / persist raw.
  const existing = waMessageId
    ? await prisma.inboundMessage.findUnique({ where: { waMessageId } })
    : null
  if (existing?.processed) {
    return NextResponse.json({ ok: true })
  }
  const inbound =
    existing ??
    (await prisma.inboundMessage.create({
      data: {
        waMessageId: waMessageId || null,
        body: text,
        rawWebhook: JSON.stringify(payload),
      },
    }))

  // Resolve quoted-reply → focused task (Wave C).
  let focusedTaskId: string | null = null
  if (quotedWaId) {
    const out = await prisma.outboundMessage.findFirst({
      where: { waMessageId: quotedWaId },
      select: { taskId: true },
    })
    focusedTaskId = out?.taskId ?? null
  }

  try {
    const now = new Date()
    const context = await buildContext(now, cfg, focusedTaskId)
    const intent = await parseCommand(cfg, text, context)
    const { reply } = await processCommand(intent, context)

    const outId = await sendText(
      { idInstance: cfg.idInstance, tokenInstance: cfg.tokenInstance, apiUrl: cfg.apiUrl },
      `${cfg.ownerPhone}@c.us`,
      reply,
    )
    await prisma.outboundMessage.create({
      data: { body: reply, waMessageId: outId, status: 'SENT', sentAt: new Date() },
    })
    await prisma.inboundMessage.update({
      where: { id: inbound.id },
      data: {
        processed: true,
        processedAt: new Date(),
        parsedAction: intent.kind,
        matchedTaskId: focusedTaskId,
      },
    })
  } catch {
    // Never retry-storm: ack 200 even on internal failure (raw already saved).
  }

  return NextResponse.json({ ok: true })
}
