---
title: File Map
aliases:
  - מפת קבצים
tags:
  - index
  - reference
---

# 🗺️ File Map

אינדקס מלא לקוד הפרויקט. כל note ב-vault מצביעה לקובץ דרך הנתיב היחסי לשורש הריפו.

## src/app

| נתיב | תפקיד | Note |
|---|---|---|
| `src/app/layout.tsx` | RTL layout, Heebo font, AppShell wrapper | — |
| `src/app/page.tsx` | redirect ל-`/all` | — |
| `src/app/(views)/all/page.tsx` | תצוגת כל המשימות | [[All]] |
| `src/app/(views)/inbox/page.tsx` | placeholder ל-Inbox | [[Inbox]] |
| `src/app/(views)/today/page.tsx` | placeholder ל-היום | [[Today]] |
| `src/app/(views)/week/page.tsx` | placeholder ל-שבוע | [[Week]] |
| `src/app/api/cron/daily-digest/route.ts` | Phase 2 — endpoint דייג'סט יומי (Bearer `CRON_SECRET`) | — |
| `src/app/api/cron/reminders/route.ts` | Phase 2 — sweep תזכורות פרואקטיביות כל 5 דקות (Bearer `CRON_SECRET`) | [[Reminder]] |
| `src/app/api/webhooks/green-api/[token]/route.ts` | Phase 2 — webhook נכנס (טוקן בנתיב + אימות שולח; עוקף Basic Auth דרך `proxy.ts`). Wave C: מזהה quotedMessage→focused task דרך `OutboundMessage.findFirst` ומזין `focusedTaskId` ל-buildContext | [[OutboundMessage]] |

> [!note] Route Group
> `(views)` הוא [route group](https://nextjs.org/docs/app/building-your-application/routing/route-groups) של Next.js — לא מופיע ב-URL. כל הראוטים נטענים ישירות תחת `/`.

## src/lib

| נתיב | תפקיד | Note |
|---|---|---|
| `src/lib/db.ts` | Prisma singleton (default Postgres driver, no adapter) | [[Tech Stack#Prisma]] |
| `src/lib/utils.ts` | `cn()` של shadcn (clsx + tailwind-merge) | — |
| `src/lib/actions/tasks.ts` | 7 actions; 5 קיבלו param אופציונלי `actor: Actor = 'USER'` (Phase 2 — WhatsApp רושם `actor: 'WHATSAPP'`). Helpers פנימיים `syncAtTimeReminder` / `cancelPendingReminders` מסנכרנים [[Reminder]] בכל transaction (create/update/complete/reopen/archive/softDelete) | [[Server Actions Pattern]] · [[Reminder]] |
| `src/lib/actions/projects.ts` | 4 actions: create / update / archive / softDelete | [[Server Actions Pattern]] |
| `src/lib/actions/tags.ts` | `addTaskTag` / `removeTaskTag` (auto-create חסרות) — נקראים מ-WhatsApp NLU | [[Tag]] · [[TaskTag]] |
| `src/lib/validators/task.ts` | Zod schemas + STATUS/PRIORITY labels & colors | [[Task]] |
| `src/lib/validators/project.ts` | Zod schema + color palette | [[Project]] |

## src/lib — Phase 2 (Green API WhatsApp)

| נתיב | תפקיד | Note |
|---|---|---|
| `src/lib/green-api/client.ts` | `sendText(creds, chatId, message)` — transport ל-Green API (fetch) | — |
| `src/lib/whatsapp/config.ts` | טעינת/אימות env (operator errors באנגלית); גוזר `ownerChatId` | — |
| `src/lib/whatsapp/time.ts` | חלון יום מקומי / שעה מקומית לפי IANA tz (Intl) | — |
| `src/lib/whatsapp/digest.ts` | פורמטר עברי טהור לדייג'סט (היום + ⚠️ באיחור) | — |
| `src/lib/whatsapp/digest-service.ts` | שאילתה + שליחה + persist (`OutboundMessage`, `Settings`, `REMINDER_SENT`/SYSTEM) | — |
| `src/lib/whatsapp/reminder-service.ts` | `runReminderSweep()` — שולח כל Reminder עם `status=SCHEDULED ∧ scheduledFor≤now`; persist `OutboundMessage(taskId,reminderId)` + `REMINDER_SENT`/SYSTEM; מסמן `CANCELLED` אם המשימה DONE/archived/deleted | [[Reminder]] |
| `src/lib/whatsapp/nlu.ts` | פענוח פקודה חופשית — Claude tool-use → `Intent`. 15 כלים: complete/reopen/set_status/set_priority/snooze/delete + set_project/add_tag/remove_tag + create_task/create_project + list_today/list_week/list_inbox + clarify | — |
| `src/lib/whatsapp/resolve-task.ts` | `buildContext(now, cfg, focusedTaskId?)` — בונה NluContext (tasks/focusedTaskId/projects/tags). Promotes focused task ל-ref=1 (Wave C). `resolveRef` ממיר ref→id | — |
| `src/lib/whatsapp/process-command.ts` | `Intent` → task action (`actor: 'WHATSAPP'`) → תשובה עברית. כולל list_week/list_inbox עם prisma queries ישירות | — |
| `src/test/server-only.stub.ts` | stub ל-`server-only` תחת Vitest (alias ב-`vitest.config.ts`) | — |

## src/components

| תיקייה | תפקיד |
|---|---|
| `src/components/layout/` | `AppShell` — sidebar + main grid |
| `src/components/sidebar/` | `Sidebar` — nav + projects list |
| `src/components/views/` | `TaskList`, `StatusFilter` |
| `src/components/tasks/` | `TaskCreateDialog`, `TaskEditDialog`, `TaskForm`, `TaskRow` |
| `src/components/projects/` | `ProjectCreateDialog` |
| `src/components/ui/` | shadcn primitives (button, dialog, popover, ...) — לא מתועד פרטנית |

## prisma

| נתיב | תפקיד |
|---|---|
| `prisma/schema.prisma` | סכמה מלאה — 9 מודלים, כולל Phase 2 (provider: PostgreSQL) |
| `prisma.config.ts` | Prisma 7 config (יציאה ל-`src/generated/prisma/`) |
| `prisma/migrations/` | Schema migrations (PostgreSQL) |

## src/generated/prisma

> [!warning] גנרי
> נוצר אוטומטית ע"י `prisma generate` (רץ ב-`postinstall`). אין לערוך ידנית. ראה [[Tech Stack#Prisma]] להסבר על הנתיב המותאם.

## auth & infra

| נתיב | תפקיד | Note |
|---|---|---|
| `src/proxy.ts` | Next.js 16 middleware — Basic Auth single-user (עוקף `/api/webhooks/`) | [[Authentication]] |
| `next.config.ts` | קונפיג Next | — |
| `eslint.config.mjs` | ESLint 9 flat config (מתעלם מ-`.claude/**`, `docs/**`) | — |
| `vitest.config.ts` | Vitest — alias `@`+stub ל-`server-only` | — |
| `vercel.json` | Phase 2 — Vercel Cron: יומי 05:00 UTC → `/api/cron/daily-digest`, יומי 06:00 UTC → `/api/cron/reminders` (Hobby plan: daily only) | [[Reminder]] |
| `docs/green-api-setup.md` | Phase 2 — מדריך הקמת Green API/WhatsApp | — |

## .claude

| נתיב | תפקיד | Note |
|---|---|---|
| `.claude/launch.json` | preview servers (Next dev + Prisma Studio) | — |
| `.claude/settings.json` | hooks config (PostToolUse + Stop) | [[Vault Sync Hook]] · [[Convention Check Hook]] |
| `.claude/hooks/vault-sync-reminder.js` | PostToolUse hook | [[Vault Sync Hook]] |
| `.claude/hooks/convention-check.js` | Stop hook — 3 invariants דטרמיניסטיים | [[Convention Check Hook]] |
| `.claude/commands/check-conventions.md` | command `/check-conventions` | [[convention-reviewer]] |
| `.claude/agents/server-action-builder.md` | subagent | [[server-action-builder]] |
| `.claude/agents/prisma-model-architect.md` | subagent | [[prisma-model-architect]] |
| `.claude/agents/view-builder.md` | subagent | [[view-builder]] |
| `.claude/agents/convention-reviewer.md` | subagent | [[convention-reviewer]] |
| `.claude/agents/vault-keeper.md` | subagent | [[vault-keeper]] |
| `.claude/skills/` | 5 סקילז של Obsidian (kepano) | — |

ראה גם: [[Home]] · [[Architecture.canvas|Architecture]]
