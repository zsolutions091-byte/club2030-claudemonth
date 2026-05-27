# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

מערכת ניהול משימות אישית (single-user). בשלב מאוחר יותר תחובר ל-Green API לשליחת תזכורות בוואטסאפ על משימות פתוחות.

הריפו: https://github.com/zsolutions091-byte/club2030-claudemonth

ה-UI בעברית — הודעות שגיאה ב-server actions גם הן בעברית (ראה `throw new Error('המשימה לא נמצאה')`). אל תתרגם לאנגלית.

## Tech Stack

- **Next.js 16.2** (App Router + Turbopack) — **לא** Next.js 14
- **React 19**
- **Prisma 7** עם adapter `@prisma/adapter-better-sqlite3`
- **SQLite** (`dev.db`)
- **Tailwind CSS 4** + **shadcn/ui** + **Base UI**
- **Zod** + **react-hook-form** לטפסים
- בעתיד: **Green API** ל-WhatsApp

> ⚠️ `AGENTS.md` מזהיר במפורש: "This is NOT the Next.js you know". לפני שינויי API/routing — קרא את `node_modules/next/dist/docs/`.

## Commands

```bash
npm run dev          # שרת פיתוח (port 3000 בדיפולט)
npm run build        # בילד פרודקשן
npm run lint         # ESLint
npm run db:migrate   # prisma migrate dev — מיגרציה חדשה
npm run db:studio    # Prisma Studio (port 5555)
npm run db:generate  # רגנרוט הקליינט (רץ אוטומטית ב-postinstall)
```

קונפיגורציה ל-preview servers ב-`.claude/launch.json`.

## Architecture

### Server Actions Pattern

כל הכתיבה ל-DB עוברת דרך **Next.js server actions** ב-`src/lib/actions/`. אין REST API.

**כל action חייב:**
1. לקרוא ל-Zod validator מ-`src/lib/validators/` (לעולם לא לסמוך על input)
2. לעטוף את העדכון ב-`prisma.$transaction` שכולל גם יצירת `TaskEvent` (audit log) — אין שינוי בלי event
3. לקרוא ל-`revalidatePath('/all')` לפני שמחזירים

לוג השדות שמייצרים `UPDATED` event מוגדר ב-`tasks.ts:LOGGED_FIELDS`. שינוי `status` יוצר `STATUS_CHANGED` נפרד (לא `UPDATED`) — PRD §4.10.

### Prisma Client — נתיב מותאם

הקליינט מיוצר ל-`src/generated/prisma/` (לא `@prisma/client` רגיל), ה-instance המשותף ב-`src/lib/db.ts` משתמש ב-`PrismaBetterSqlite3` adapter. תמיד `import { prisma } from '@/lib/db'`.

### Soft Delete

ל-`Task`, `Project`, `Tag` יש `deletedAt`. **אסור** למחוק רשומות פיזית — תמיד עדכון `deletedAt`. כל query חייב לסנן `deletedAt: null`.

### Authentication

`src/proxy.ts` (Next.js 16 — מה שהיה `middleware.ts`) מיישם Basic Auth single-user מול `BASIC_AUTH_USER`/`BASIC_AUTH_PASS` ב-`.env`. נתיבי `/api/webhooks/*` עוברים bypass עבור webhooks של Green API (Phase 2).

### Path Alias

`@/*` → `./src/*` (`tsconfig.json`).

## Repository Layout

- `src/app/(views)/` — 4 ראוטים: `all`, `inbox`, `today`, `week` ב-route group (לא מופיע ב-URL)
- `src/app/page.tsx` — redirect ל-`/all`
- `src/lib/actions/` — server actions (tasks, projects)
- `src/lib/validators/` — Zod schemas (task, project)
- `src/components/ui/` — shadcn primitives
- `prisma/schema.prisma` — סכמה מלאה כולל מודלי Phase 2 (Reminder, OutboundMessage, InboundMessage)
- `vault/` — תיעוד הפרויקט בפורמט **Obsidian** (markdown + canvas, עם wikilinks/Mermaid/callouts). לא חלק מהאפליקציה — תיעוד בלבד. ==ה-vault הוא mirror מלא של הפרויקט==: כולל סקציה `05 Automation/` שמתעדת את הסוכנים וה-hook עצמם.

## `.claude/`

- `.claude/launch.json` — Next.js dev + Prisma Studio
- `.claude/skills/` — 5 skills של Obsidian (`obsidian-markdown`, `obsidian-bases`, `obsidian-cli`, `json-canvas`, `defuddle`) לעבודה על ה-vault. רלוונטיים כמעט רק ל-`vault-keeper`; ברוב הסשנים (Next.js/Prisma) הם רעש הקשר.
- `.claude/commands/` — `/check-conventions` (מריץ `convention-reviewer` עם scope לקבצים האחרונים ב-`src/lib/`)

### `.claude/agents/`

חמישה subagents ייעודיים. כל אחד מצומצם לאחריות מוגדרת — אל תבקש מסוכן אחד לעשות את העבודה של אחר. ה-`description` של כל סוכן מקוצר לדוגמה אחת מייצגת (חיסכון הקשר קבוע בכל סשן):

| Agent | תפקיד | מתי להפעיל |
|---|---|---|
| `server-action-builder` | בונה action חדש ב-`src/lib/actions/` עם כל ה-Patterns | "תוסיף action ש..." / mutation חדשה |
| `prisma-model-architect` | End-to-end למודל חדש: schema + migration + validator + action stubs + vault note | "תוסיף מודל..." / טבלה חדשה |
| `view-builder` | בונה דף read-only ב-`src/app/(views)/` — Server Component, קריאות Prisma מקבילות עם פילטר soft-delete, סריאליזציית `Date`→ISO, shell עברית RTL | "תבנה את תצוגת..." / דף route חדש |
| `convention-reviewer` | Code review **סמנטי** — 2 invariants עיקריים (soft delete, audit log). 3 הדטרמיניסטיים (Hebrew errors, `'use server'`, path alias) מסוננים מראש ע"י `convention-check` hook | אחרי כל feature שנוגעת ב-`src/lib/` |
| `vault-keeper` | מעדכן את `vault/` (notes, canvas, File Map) כשמשהו ארכיטקטוני משתנה | אחרי `prisma-model-architect` / `view-builder` / שינוי schema / רכיב חדש |

**Chaining**: ב-Claude Code subagents לא קוראים זה לזה ישירות — ה-main Claude מתאם. הכלל: אחרי `prisma-model-architect` או `view-builder` תמיד להפעיל `vault-keeper` (עדכון canvas + File Map). אחרי שינוי ב-`src/lib/actions/` מומלץ `convention-reviewer` (או `/check-conventions`).

### Vault Sync Hook

`.claude/settings.json` + `.claude/hooks/vault-sync-reminder.js` — hook ב-PostToolUse שנורה אחרי Write/Edit על קבצים ארכיטקטוניים (`src/lib/actions/`, `src/lib/validators/`, `src/app/**/page.tsx`, `src/components/` ללא `ui/`, `prisma/schema.prisma`, וגם `.claude/agents/`, `.claude/hooks/`, `.claude/settings.json` עצמו). שותל `additionalContext` שמזכיר ל-Claude להפעיל `vault-keeper`. תיעוד מלא: [vault/05 Automation/Vault Sync Hook.md](vault/05%20Automation/Vault%20Sync%20Hook.md).

### Convention Check Hook

`.claude/hooks/convention-check.js` — hook ב-**Stop** (advisory, לא חוסם) שסורק סטטית את `src/lib/actions/` ו-`src/lib/validators/` ומדווח על הפרות של 3 ה-invariants הדטרמיניסטיים: `'use server'` (שורה 1), path alias (אין import יחסי), והודעות שגיאה בעברית. הפרויקט **אינו git repo** — הסריקה סטטית, לא `git diff`. זה מייתר ספינינג של `convention-reviewer` עבור הבדיקות המכניות; הסוכן מתמקד ב-2 ה-invariants הסמנטיים. רשום ופעיל ב-`.claude/settings.json` תחת `Stop` (אושר ע"י המשתמש).

### Context Hygiene — שרתי MCP

לפרויקט אין `.mcp.json`. שרתי ה-MCP הרבים שנטענים כל סשן (Airtable, Canva, Make.com, Gmail, Zoom, Drive, Supabase, computer-use, playwright וכו') מגיעים מ-connectors גלובליים — **לא רלוונטיים** לאפליקציית SQLite/Next.js מקומית single-user. אין מתג כיבוי ב-scope של הפרויקט; מומלץ שהמשתמש יכבה connectors לא-בשימוש בהגדרות Claude הגלובליות כדי להקטין עומס הקשר.

## Future Agents (Phase 2)

ייכתבו כשנגיע ל-Phase 2 (Green API integration). תיעוד-בלבד כרגע:

- **`green-api-integrator`** — לקוח HTTP ל-Green API, webhook handlers תחת `/api/webhooks/green-api/`, אימות חתימות, פיענוח פקודות תשובה (`done`/`snooze`/`delete`), מיפוי ל-`OutboundMessage`/`InboundMessage`. מכיר את ה-bypass ב-`src/proxy.ts`.
- **`reminder-scheduler-designer`** — worker שסורק `Reminder` לפי `scheduledFor`, יוצר `OutboundMessage`, ומתחבר ל-`green-api-integrator`. החלטה פתוחה: Vercel cron / `node-cron` / queue חיצוני.
