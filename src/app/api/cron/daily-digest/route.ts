import { NextResponse } from 'next/server'
import { loadWhatsappConfig } from '@/lib/whatsapp/config'
import { runDailyDigest } from '@/lib/whatsapp/digest-service'
import { localHour, localDateKey } from '@/lib/whatsapp/time'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const LAST_DIGEST_KEY = 'whatsapp:lastDigest'

export async function POST(req: Request) {
  const cfg = loadWhatsappConfig()

  if (req.headers.get('authorization') !== `Bearer ${cfg.cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const now = new Date()
  if (localHour(now, cfg.digestTimezone) !== cfg.digestHourLocal) {
    return NextResponse.json({ skipped: 'off-hour' })
  }

  const todayKey = localDateKey(now, cfg.digestTimezone)
  const row = await prisma.settings.findUnique({ where: { key: LAST_DIGEST_KEY } })
  if (row) {
    try {
      if ((JSON.parse(row.value) as { date?: string }).date === todayKey) {
        return NextResponse.json({ skipped: 'already-sent' })
      }
    } catch {
      // corrupt snapshot — fall through and re-send
    }
  }

  const result = await runDailyDigest(cfg, now)
  return NextResponse.json(result)
}

// Vercel Cron may issue GET; accept both.
export const GET = POST
