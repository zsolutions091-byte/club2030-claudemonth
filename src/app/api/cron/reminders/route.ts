import { NextResponse } from 'next/server'
import { loadWhatsappConfig } from '@/lib/whatsapp/config'
import { runReminderSweep } from '@/lib/whatsapp/reminder-service'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const cfg = loadWhatsappConfig()

  if (req.headers.get('authorization') !== `Bearer ${cfg.cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const result = await runReminderSweep(cfg, new Date())
  return NextResponse.json(result)
}

// Vercel Cron may issue GET; accept both.
export const GET = POST
