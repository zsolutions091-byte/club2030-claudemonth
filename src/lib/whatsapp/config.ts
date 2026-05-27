// Operator-facing config — English errors are intentional (see src/lib/db.ts precedent).
export interface WhatsappConfig {
  idInstance: string
  tokenInstance: string
  apiUrl: string
  ownerPhone: string
  ownerChatId: string
  webhookToken: string
  anthropicApiKey: string
  anthropicModel: string
  cronSecret: string
  digestHourLocal: number
  digestTimezone: string
}

function required(env: Record<string, string | undefined>, key: string): string {
  const v = env[key]
  if (!v || v.trim() === '') throw new Error(`Missing required env var: ${key}`)
  return v.trim()
}

export function loadWhatsappConfig(
  env: Record<string, string | undefined> = process.env,
): WhatsappConfig {
  const ownerPhone = required(env, 'WHATSAPP_OWNER_PHONE').replace(/\D/g, '')
  return {
    idInstance: required(env, 'GREEN_API_ID_INSTANCE'),
    tokenInstance: required(env, 'GREEN_API_TOKEN_INSTANCE'),
    apiUrl: env.GREEN_API_API_URL?.trim() || 'https://api.green-api.com',
    ownerPhone,
    ownerChatId: `${ownerPhone}@c.us`,
    webhookToken: required(env, 'WHATSAPP_WEBHOOK_TOKEN'),
    anthropicApiKey: required(env, 'ANTHROPIC_API_KEY'),
    anthropicModel: env.ANTHROPIC_MODEL?.trim() || 'claude-haiku-4-5',
    cronSecret: required(env, 'CRON_SECRET'),
    digestHourLocal: Number(env.DIGEST_HOUR_LOCAL ?? '8'),
    digestTimezone: env.DIGEST_TIMEZONE?.trim() || 'Asia/Jerusalem',
  }
}
