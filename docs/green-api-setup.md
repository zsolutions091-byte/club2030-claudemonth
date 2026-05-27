# Green API WhatsApp — setup

1. Fill `.env` from `.env.example` (all `WHATSAPP_*` / `GREEN_API_*` / `ANTHROPIC_*` / `CRON_SECRET` vars).
2. In the Green API console, set the instance webhook URL to:
   `https://<your-domain>/api/webhooks/green-api/<WHATSAPP_WEBHOOK_TOKEN>`
   and enable "incoming message" notifications.
3. On Vercel, set all env vars in Project Settings (incl. `CRON_SECRET` — Vercel
   sends it automatically as the cron `Authorization: Bearer`). `vercel.json`
   registers the hourly cron `/api/cron/daily-digest`.
4. The digest sends once/day at `DIGEST_HOUR_LOCAL` in `DIGEST_TIMEZONE`
   (hourly cron + an in-handler local-hour + already-sent-today guard, so it is
   safe under DST and never double-sends).
5. Only `WHATSAPP_OWNER_PHONE` can issue commands; all other senders are
   silently ignored (200, no processing, no data stored).
6. Commands are free Hebrew, parsed by Claude (`ANTHROPIC_MODEL`). Supported:
   complete / reopen / set-status / snooze / create / "רשימה". Delete is
   intentionally NOT available via WhatsApp (app only).
7. WhatsApp-originated mutations go through the existing task server actions and
   are recorded in the `TaskEvent` audit log with `actor = 'WHATSAPP'`; the
   daily digest records `REMINDER_SENT` events with `actor = 'SYSTEM'`.

## Manual end-to-end check (after real Green API creds are in `.env`)

- Trigger the digest at the configured local hour:
  `curl -X POST https://<domain>/api/cron/daily-digest -H "Authorization: Bearer <CRON_SECRET>"`
  → WhatsApp receives the numbered Hebrew list.
- Reply `סיימתי את 1` → task #1 becomes `DONE`; verify in Prisma Studio that the
  `TaskEvent` has `actor = WHATSAPP`; a Hebrew confirmation arrives on WhatsApp.

## Architecture (implemented)

- `src/lib/green-api/client.ts` — Green API `sendText` transport.
- `src/lib/whatsapp/config.ts` — env loading/validation.
- `src/lib/whatsapp/time.ts` — timezone day-window / local-hour helpers.
- `src/lib/whatsapp/digest.ts` — pure Hebrew digest formatter.
- `src/lib/whatsapp/digest-service.ts` — query + send + persist digest.
- `src/lib/whatsapp/nlu.ts` — Claude tool-use command parser.
- `src/lib/whatsapp/resolve-task.ts` — number/snapshot → task id.
- `src/lib/whatsapp/process-command.ts` — intent → task action → Hebrew reply.
- `src/app/api/cron/daily-digest/route.ts` — Vercel-Cron digest endpoint.
- `src/app/api/webhooks/green-api/[token]/route.ts` — inbound webhook.
- `vercel.json` — hourly cron registration.

Spec: `docs/superpowers/specs/2026-05-19-green-api-whatsapp-design.md`.
Plan: `docs/superpowers/plans/2026-05-19-green-api-whatsapp.md`.
