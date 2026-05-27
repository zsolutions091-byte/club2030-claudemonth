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
| `src/app/api/webhooks/green-api/[token]/route.ts` | Phase 2 — webhook נכנס (טוקן בנתיב + אימות שולח; עוקף Basic Auth דרך `proxy.ts`) | — |

> [!note] Route Group
> `(views)` הוא [route group](https://nextjs.org/docs/app/building-your-application/routing/route-groups) של Next.js — לא מופיע ב-URL. כל הראוטים נטענים ישירות תחת `/`.

## src/lib

| נתיב | תפקיד | Note |
|---|---|---|
| `src/lib/db.ts` | Prisma singleton + adapter `@prisma/adapter-better-sqlite3` | [[Tech Stack#Prisma]] |
| `src/lib/utils.ts` | `cn()` של shadcn (clsx + tailwind-merge) | — |
| `src/lib/actions/tasks.ts` | 7 actions; 5 קיבלו param אופציונלי `actor: Actor = 'USER'` (Phase 2 — WhatsApp רושם `actor: 'WHATSAPP'`) | [[Server Actions Pattern]] |
| `src/lib/actions/projects.ts` | 4 actions: create / update / archive / softDelete | [[Server Actions Pattern]] |
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
| `src/lib/whatsapp/nlu.ts` | פענוח פקודה חופשית — Claude tool-use → `Intent` | — |
| `src/lib/whatsapp/resolve-task.ts` | מספר/snapshot → task id (`buildContext`/`resolveRef`) | — |
| `src/lib/whatsapp/process-command.ts` | `Intent` → task action (`actor: 'WHATSAPP'`) → תשובה עברית | — |
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
| `prisma/schema.prisma` | סכמה מלאה — 9 מודלים, כולל Phase 2 |
| `prisma.config.ts` | Prisma 7 config (יציאה ל-`src/generated/prisma/`) |
| `dev.db` | SQLite מקומי (gitignored) |

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
| `vercel.json` | Phase 2 — Vercel Cron שעתי → `/api/cron/daily-digest` | — |
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
