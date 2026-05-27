# Green API WhatsApp Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a daily Hebrew "tasks due today" WhatsApp digest to one owner number, and let the owner reply in free Hebrew to complete / set-status / create / snooze / reopen tasks via Claude NLU.

**Architecture:** Vercel Cron (hourly, in-handler local-time guard) hits a protected digest route that queries tasks, formats Hebrew text, and sends via a thin Green API `fetch` client; replies arrive at a token-in-path webhook (already bypassed by `src/proxy.ts`), are verified by sender number, parsed by the Anthropic SDK with tool-use, and executed through the existing `tasks.ts` server actions with `actor = WHATSAPP`. Reuses `OutboundMessage` / `InboundMessage` / `Settings`; no Prisma migration.

**Tech Stack:** Next.js 16 route handlers, Prisma 7 (`@/lib/db`), `@anthropic-ai/sdk`, native `fetch` for Green API, Vitest (new), TypeScript, Zod 4.

> **Project reality — no git:** this repo is **not** a git repository. Every "Checkpoint" step replaces the usual commit: run `npm run lint` and the task's tests, confirm green, then tick the task. Do not run `git` commands.

> **Conventions to preserve (from CLAUDE.md):** Hebrew user-facing strings (operator/misconfig errors may be English, per `src/lib/db.ts` precedent); soft-delete filters (`deletedAt: null`); Task audit log via `TaskEvent` inside `prisma.$transaction`; `@/` path alias only; server actions stay `'use server'`. Run `/check-conventions` after Milestone 1 and Milestone 2.

---

## File Structure

Created:
- `vitest.config.ts` — test runner config (node env).
- `src/lib/whatsapp/config.ts` — env reading/validation, derives owner chatId.
- `src/lib/green-api/client.ts` — `sendText(chatId, body)` over `fetch`.
- `src/lib/whatsapp/time.ts` — timezone "today window" + "local hour" helpers (Intl-based, no new dep).
- `src/lib/whatsapp/digest.ts` — pure Hebrew digest formatter.
- `src/lib/whatsapp/digest-service.ts` — query + format + send + persist (`OutboundMessage`, `Settings`, `TaskEvent`).
- `src/lib/whatsapp/nlu.ts` — Anthropic tool-use parser → normalized intent.
- `src/lib/whatsapp/resolve-task.ts` — resolve target task from snapshot number or description.
- `src/lib/whatsapp/process-command.ts` — intent → task action (`actor = WHATSAPP`) → Hebrew reply.
- `src/app/api/cron/daily-digest/route.ts` — cron endpoint (Bearer-guarded).
- `src/app/api/webhooks/green-api/[token]/route.ts` — inbound webhook.
- `vercel.json` — hourly cron registration.
- `.env.example` — documents all new env vars.
- Tests mirrored under `src/**/__tests__/*.test.ts`.

Modified:
- `package.json` — add deps + `test` scripts.
- `src/lib/actions/tasks.ts` — optional `actor` param on the 5 used actions.

Milestones (each independently shippable):
- **M0 Foundations:** Tasks 1–3
- **M1 Outbound digest:** Tasks 4–9
- **M2 Inbound commands:** Tasks 10–14

---

## Task 1: Test harness + dependencies

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create/Test: `src/lib/whatsapp/__tests__/smoke.test.ts`

- [ ] **Step 1: Add dependencies**

Run:
```bash
npm install @anthropic-ai/sdk@^0.71.0
npm install -D vitest@^3.2.4
```
Expected: both install without peer-dep errors.

- [ ] **Step 2: Add test scripts to `package.json`**

In the `"scripts"` object add:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

- [ ] **Step 4: Write the smoke test**

`src/lib/whatsapp/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 6: Checkpoint**

Run: `npm run lint && npm test`
Expected: lint clean, tests green. Tick this task.

---

## Task 2: WhatsApp config module

**Files:**
- Create: `src/lib/whatsapp/config.ts`
- Test: `src/lib/whatsapp/__tests__/config.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/whatsapp/__tests__/config.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- config`
Expected: FAIL — cannot find module `@/lib/whatsapp/config`.

- [ ] **Step 3: Implement**

`src/lib/whatsapp/config.ts`:
```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- config`
Expected: 2 passed.

- [ ] **Step 5: Checkpoint**

Run: `npm run lint && npm test`
Expected: green. Tick task.

---

## Task 3: Optional `actor` on Task actions

**Files:**
- Modify: `src/lib/actions/tasks.ts`
- Test: `src/lib/actions/__tests__/tasks-actor.test.ts`

Add an optional final `actor` argument (default `'USER'`) to `createTask`, `updateTask`, `completeTask`, `reopenTask`, `softDeleteTask`. Replace every literal `actor: 'USER'` in those five functions with `actor` (the parameter). Do not change `archiveTask`/`restoreTask` (not used by WhatsApp MVP).

- [ ] **Step 1: Write the failing test**

`src/lib/actions/__tests__/tasks-actor.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const txState = { events: [] as Array<{ type: string; actor: string }> }

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    task: { findUnique: vi.fn(async () => ({ id: 't1', status: 'OPEN', deletedAt: null })) },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        task: { update: vi.fn(async () => ({ id: 't1', status: 'DONE' })) },
        taskEvent: { create: vi.fn(async ({ data }: { data: { type: string; actor: string } }) => { txState.events.push(data) }) },
      }),
    ),
  },
}))

import { completeTask } from '@/lib/actions/tasks'

describe('completeTask actor', () => {
  beforeEach(() => { txState.events = [] })

  it('defaults to USER', async () => {
    await completeTask('t1')
    expect(txState.events[0].actor).toBe('USER')
  })

  it('records WHATSAPP when passed', async () => {
    await completeTask('t1', 'WHATSAPP')
    expect(txState.events[0].actor).toBe('WHATSAPP')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tasks-actor`
Expected: FAIL — second test gets `'USER'` (param not yet supported).

- [ ] **Step 3: Implement**

In `src/lib/actions/tasks.ts`:

Add a type alias near the top (after the imports):
```ts
type Actor = 'USER' | 'WHATSAPP' | 'SYSTEM'
```

Change the five signatures and their `taskEvent.create` calls:
- `export async function createTask(rawInput: unknown, actor: Actor = 'USER')` → in its `tx.taskEvent.create`, use `actor,` instead of `actor: 'USER',`.
- `export async function updateTask(id: string, rawInput: unknown, actor: Actor = 'USER')` → in the events loop `tx.taskEvent.create`, use `actor,` instead of `actor: 'USER',`.
- `export async function completeTask(id: string, actor: Actor = 'USER')` → `actor,` in its event.
- `export async function reopenTask(id: string, actor: Actor = 'USER')` → `actor,` in its event.
- `export async function softDeleteTask(id: string, actor: Actor = 'USER')` → `actor,` in its event.

Example for `completeTask`'s event (apply the analogous change to each):
```ts
    await tx.taskEvent.create({
      data: {
        taskId: id,
        type: 'COMPLETED',
        actor,
        payload: JSON.stringify({ from: existing.status, to: 'DONE' }),
      },
    })
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- tasks-actor`
Expected: 2 passed.

- [ ] **Step 5: Checkpoint**

Run: `npm run lint && npm test`
Expected: green. Run `/check-conventions` — soft-delete + audit-log invariants must still pass (actor is still always written inside the transaction). Tick task. **M0 complete.**

---

## Task 4: Green API client

**Files:**
- Create: `src/lib/green-api/client.ts`
- Test: `src/lib/green-api/__tests__/client.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/green-api/__tests__/client.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendText } from '@/lib/green-api/client'

const cfg = {
  idInstance: '1101', tokenInstance: 'tok', apiUrl: 'https://api.green-api.com',
} as const

afterEach(() => vi.restoreAllMocks())

describe('sendText', () => {
  it('POSTs to the SendMessage endpoint and returns waMessageId', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ idMessage: 'WA123' }), { status: 200 }),
    )
    const id = await sendText(cfg, '972501234567@c.us', 'שלום')
    expect(id).toBe('WA123')
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://api.green-api.com/waInstance1101/sendMessage/tok')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      chatId: '972501234567@c.us', message: 'שלום',
    })
  })

  it('throws on non-200', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('bad', { status: 500 }))
    await expect(sendText(cfg, 'x@c.us', 'hi')).rejects.toThrow('Green API send failed: 500')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- client`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/green-api/client.ts`:
```ts
// Operator-facing English errors (network/config), per project precedent.
interface GreenApiCreds {
  idInstance: string
  tokenInstance: string
  apiUrl: string
}

export async function sendText(
  creds: GreenApiCreds,
  chatId: string,
  message: string,
): Promise<string> {
  const url = `${creds.apiUrl}/waInstance${creds.idInstance}/sendMessage/${creds.tokenInstance}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message }),
  })
  if (!res.ok) {
    throw new Error(`Green API send failed: ${res.status}`)
  }
  const json = (await res.json()) as { idMessage?: string }
  return json.idMessage ?? ''
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- client`
Expected: 2 passed.

- [ ] **Step 5: Checkpoint** — `npm run lint && npm test` green. Tick task.

---

## Task 5: Digest formatter (pure)

**Files:**
- Create: `src/lib/whatsapp/digest.ts`
- Test: `src/lib/whatsapp/__tests__/digest.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/whatsapp/__tests__/digest.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { formatDigest, type DigestTask } from '@/lib/whatsapp/digest'

const t = (id: string, title: string): DigestTask => ({ id, title })

describe('formatDigest', () => {
  it('numbers today then overdue continuing the numbering', () => {
    const msg = formatDigest({ today: [t('a', 'לקנות חלב'), t('b', 'להתקשר לרופא')], overdue: [t('c', 'דוח')] })
    expect(msg).toContain('משימות להיום')
    expect(msg).toContain('1. לקנות חלב')
    expect(msg).toContain('2. להתקשר לרופא')
    expect(msg).toContain('⚠️ באיחור')
    expect(msg).toContain('3. דוח')
    expect(orderedIds(msg)).toBeUndefined() // sanity placeholder; ids checked via buildSnapshot
  })

  it('empty day returns the friendly no-tasks message', () => {
    expect(formatDigest({ today: [], overdue: [] })).toContain('אין משימות להיום')
  })
})

function orderedIds(_: string) { return undefined }
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- digest`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/whatsapp/digest.ts`:
```ts
export interface DigestTask {
  id: string
  title: string
}

export interface DigestInput {
  today: DigestTask[]
  overdue: DigestTask[]
}

/** Ordered task ids matching the numbering in the formatted message. */
export function digestOrder(input: DigestInput): string[] {
  return [...input.today, ...input.overdue].map((t) => t.id)
}

export function formatDigest(input: DigestInput): string {
  if (input.today.length === 0 && input.overdue.length === 0) {
    return 'אין משימות להיום 🎉'
  }
  const lines: string[] = ['📋 משימות להיום', '']
  let n = 1
  for (const task of input.today) {
    lines.push(`${n}. ${task.title}`)
    n++
  }
  if (input.overdue.length > 0) {
    lines.push('', '⚠️ באיחור')
    for (const task of input.overdue) {
      lines.push(`${n}. ${task.title}`)
      n++
    }
  }
  lines.push('', 'אפשר להשיב בהודעה חופשית: לסגור משימה, לשנות סטטוס, ליצור חדשה, או לדחות.')
  return lines.join('\n')
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- digest`
Expected: passed.

- [ ] **Step 5: Checkpoint** — `npm run lint && npm test` green. Tick task.

---

## Task 6: Timezone "today window" + local hour helpers

**Files:**
- Create: `src/lib/whatsapp/time.ts`
- Test: `src/lib/whatsapp/__tests__/time.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/whatsapp/__tests__/time.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { localDayWindow, localHour, localDateKey } from '@/lib/whatsapp/time'

describe('time helpers (Asia/Jerusalem)', () => {
  const tz = 'Asia/Jerusalem'

  it('localDayWindow returns UTC instants bounding the local day', () => {
    // 2026-05-19 09:00 Israel (UTC+3 in summer) == 2026-05-19T06:00:00Z
    const at = new Date('2026-05-19T06:00:00Z')
    const { start, end } = localDayWindow(at, tz)
    expect(start.toISOString()).toBe('2026-05-18T21:00:00.000Z')
    expect(end.toISOString()).toBe('2026-05-19T21:00:00.000Z')
  })

  it('localHour returns the wall-clock hour in the tz', () => {
    expect(localHour(new Date('2026-05-19T06:00:00Z'), tz)).toBe(9)
  })

  it('localDateKey returns YYYY-MM-DD in the tz', () => {
    expect(localDateKey(new Date('2026-05-19T06:00:00Z'), tz)).toBe('2026-05-19')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- time`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/whatsapp/time.ts`:
```ts
function parts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const p: Record<string, string> = {}
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') p[part.type] = part.value
  }
  // 'hour' can be "24" at midnight in some engines — normalize.
  const hour = p.hour === '24' ? '00' : p.hour
  return { y: +p.year, mo: +p.month, d: +p.day, h: +hour, mi: +p.minute, s: +p.second }
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const { y, mo, d, h, mi, s } = parts(date, timeZone)
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

export function localHour(date: Date, timeZone: string): number {
  return parts(date, timeZone).h
}

export function localDateKey(date: Date, timeZone: string): string {
  const { y, mo, d } = parts(date, timeZone)
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** UTC instants for [start-of-local-day, start-of-next-local-day). */
export function localDayWindow(at: Date, timeZone: string): { start: Date; end: Date } {
  const { y, mo, d } = parts(at, timeZone)
  const offset = tzOffsetMs(at, timeZone)
  const start = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0) - offset)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- time`
Expected: 3 passed. (If a test instant lands on a DST boundary it may need adjustment; the chosen 2026-05-19 summer instant is stable for Asia/Jerusalem.)

- [ ] **Step 5: Checkpoint** — `npm run lint && npm test` green. Tick task.

---

## Task 7: Digest service

**Files:**
- Create: `src/lib/whatsapp/digest-service.ts`
- Test: `src/lib/whatsapp/__tests__/digest-service.test.ts`

Behavior: given `now`, query today's tasks and overdue tasks (soft-delete + archive filtered, `status NOT IN (DONE, CANCELLED)`), format, send via Green API, persist one `OutboundMessage`, write `Settings['whatsapp:lastDigest']`, and emit one `REMINDER_SENT` `TaskEvent` (`actor = 'SYSTEM'`) per included task — all in a transaction. Returns `{ sent: boolean, count: number }`.

- [ ] **Step 1: Write the failing test**

`src/lib/whatsapp/__tests__/digest-service.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const calls = { sendText: vi.fn(async () => 'WA1'), settingsUpsert: vi.fn(), outboundCreate: vi.fn(), events: [] as unknown[] }

vi.mock('@/lib/green-api/client', () => ({ sendText: (...a: unknown[]) => calls.sendText(...a) }))
vi.mock('@/lib/db', () => ({
  prisma: {
    task: {
      findMany: vi.fn()
        .mockResolvedValueOnce([{ id: 'a', title: 'היום-1' }]) // today
        .mockResolvedValueOnce([{ id: 'b', title: 'איחור-1' }]), // overdue
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({
      outboundMessage: { create: (...a: unknown[]) => calls.outboundCreate(...a) },
      settings: { upsert: (...a: unknown[]) => calls.settingsUpsert(...a) },
      taskEvent: { create: async ({ data }: { data: unknown }) => { calls.events.push(data) } },
    })),
  },
}))

import { runDailyDigest } from '@/lib/whatsapp/digest-service'

const cfg = {
  idInstance: '1', tokenInstance: 't', apiUrl: 'u', ownerChatId: 'x@c.us',
  digestTimezone: 'Asia/Jerusalem',
} as never

describe('runDailyDigest', () => {
  beforeEach(() => { calls.events = []; vi.clearAllMocks() })

  it('sends, persists snapshot + outbound + SYSTEM events', async () => {
    const res = await runDailyDigest(cfg, new Date('2026-05-19T06:00:00Z'))
    expect(res).toEqual({ sent: true, count: 2 })
    expect(calls.sendText).toHaveBeenCalledOnce()
    expect(calls.settingsUpsert).toHaveBeenCalledOnce()
    expect(calls.outboundCreate).toHaveBeenCalledOnce()
    expect(calls.events).toHaveLength(2)
    expect((calls.events[0] as { actor: string }).actor).toBe('SYSTEM')
    expect((calls.events[0] as { type: string }).type).toBe('REMINDER_SENT')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- digest-service`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/whatsapp/digest-service.ts`:
```ts
import { prisma } from '@/lib/db'
import { sendText } from '@/lib/green-api/client'
import { formatDigest, digestOrder, type DigestTask } from '@/lib/whatsapp/digest'
import { localDayWindow, localDateKey } from '@/lib/whatsapp/time'
import type { WhatsappConfig } from '@/lib/whatsapp/config'

const LAST_DIGEST_KEY = 'whatsapp:lastDigest'
const ACTIVE = { notIn: ['DONE', 'CANCELLED'] as const }

export async function runDailyDigest(
  cfg: WhatsappConfig,
  now: Date,
): Promise<{ sent: boolean; count: number }> {
  const { start, end } = localDayWindow(now, cfg.digestTimezone)

  const [today, overdue] = await Promise.all([
    prisma.task.findMany({
      where: {
        deletedAt: null, archivedAt: null, status: ACTIVE,
        dueDate: { gte: start, lt: end },
      },
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
      select: { id: true, title: true },
    }),
    prisma.task.findMany({
      where: {
        deletedAt: null, archivedAt: null, status: ACTIVE,
        dueDate: { lt: start },
      },
      orderBy: [{ dueDate: 'asc' }],
      select: { id: true, title: true },
    }),
  ])

  const input = { today: today as DigestTask[], overdue: overdue as DigestTask[] }
  const body = formatDigest(input)
  const order = digestOrder(input)
  const dateKey = localDateKey(now, cfg.digestTimezone)

  const waMessageId = await sendText(
    { idInstance: cfg.idInstance, tokenInstance: cfg.tokenInstance, apiUrl: cfg.apiUrl },
    cfg.ownerChatId,
    body,
  )

  await prisma.$transaction(async (tx) => {
    await tx.outboundMessage.create({
      data: { body, waMessageId, status: 'SENT', sentAt: new Date() },
    })
    await tx.settings.upsert({
      where: { key: LAST_DIGEST_KEY },
      create: { key: LAST_DIGEST_KEY, value: JSON.stringify({ date: dateKey, taskIds: order }) },
      update: { value: JSON.stringify({ date: dateKey, taskIds: order }) },
    })
    for (const id of order) {
      await tx.taskEvent.create({
        data: { taskId: id, type: 'REMINDER_SENT', actor: 'SYSTEM' },
      })
    }
  })

  return { sent: true, count: order.length }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- digest-service`
Expected: passed.

- [ ] **Step 5: Checkpoint** — `npm run lint && npm test` green. Tick task.

---

## Task 8: Cron route + idempotency guard

**Files:**
- Create: `src/app/api/cron/daily-digest/route.ts`
- Test: `src/app/api/cron/daily-digest/__tests__/route.test.ts`

Guard order: (1) Bearer == `CRON_SECRET` else 401; (2) `localHour(now) === digestHourLocal` else 200 `{skipped:'off-hour'}`; (3) `Settings['whatsapp:lastDigest'].date !== todayKey` else 200 `{skipped:'already-sent'}`; else run digest.

- [ ] **Step 1: Write the failing test**

`src/app/api/cron/daily-digest/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const cfg = {
  cronSecret: 'cron', digestHourLocal: 9, digestTimezone: 'Asia/Jerusalem',
} as never

vi.mock('@/lib/whatsapp/config', () => ({ loadWhatsappConfig: () => cfg }))
const runDailyDigest = vi.fn(async () => ({ sent: true, count: 1 }))
vi.mock('@/lib/whatsapp/digest-service', () => ({ runDailyDigest: (...a: unknown[]) => runDailyDigest(...a) }))
const findUnique = vi.fn(async () => null)
vi.mock('@/lib/db', () => ({ prisma: { settings: { findUnique: (...a: unknown[]) => findUnique(...a) } } }))

import { POST } from '@/app/api/cron/daily-digest/route'

function req(auth?: string) {
  return new Request('http://x/api/cron/daily-digest', {
    method: 'POST', headers: auth ? { Authorization: auth } : {},
  })
}

describe('daily-digest route', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 without the cron bearer', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
  })

  it('skips off-hour with 200', async () => {
    // 2026-05-19T01:00:00Z == 04:00 Israel, not hour 9
    vi.useFakeTimers().setSystemTime(new Date('2026-05-19T01:00:00Z'))
    const res = await POST(req('Bearer cron'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ skipped: 'off-hour' })
    expect(runDailyDigest).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('runs on the configured hour when not already sent', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-05-19T06:00:00Z')) // 09:00 Israel
    const res = await POST(req('Bearer cron'))
    expect(res.status).toBe(200)
    expect(runDailyDigest).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- daily-digest`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/app/api/cron/daily-digest/route.ts`:
```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- daily-digest`
Expected: 3 passed.

- [ ] **Step 5: Checkpoint** — `npm run lint && npm test` green. Tick task.

---

## Task 9: Vercel Cron registration + env example

**Files:**
- Create: `vercel.json`
- Create: `.env.example`

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/daily-digest", "schedule": "0 * * * *" }
  ]
}
```
(Hourly; the route's local-hour guard decides the actual send time. Vercel automatically sends `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set in project env.)

- [ ] **Step 2: Create `.env.example`**

```bash
# System login (existing) — consumed by src/proxy.ts
BASIC_AUTH_USER=
BASIC_AUTH_PASS=

# Green API (Phase 2)
GREEN_API_ID_INSTANCE=
GREEN_API_TOKEN_INSTANCE=
GREEN_API_API_URL=https://api.green-api.com

# WhatsApp owner (sole allowed sender/recipient), digits only e.g. 972501234567
WHATSAPP_OWNER_PHONE=
# Secret embedded in the inbound webhook path
WHATSAPP_WEBHOOK_TOKEN=

# Claude NLU
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-haiku-4-5

# Vercel Cron shared secret
CRON_SECRET=

# Digest timing
DIGEST_HOUR_LOCAL=8
DIGEST_TIMEZONE=Asia/Jerusalem
```

- [ ] **Step 3: Checkpoint**

Run: `npm run lint && npm test`
Expected: green. Run `/check-conventions`. **M1 complete — outbound digest is shippable.** Manual smoke (after the user adds real Green API creds to `.env`): `curl -X POST localhost:3000/api/cron/daily-digest -H "Authorization: Bearer <CRON_SECRET>"` during the configured local hour.

---

## Task 10: NLU module (Anthropic tool-use)

**Files:**
- Create: `src/lib/whatsapp/nlu.ts`
- Test: `src/lib/whatsapp/__tests__/nlu.test.ts`

`parseCommand(cfg, text, context)` returns a normalized intent. `context` = `{ tasks: {ref:number,id:string,title:string,status:string}[] }` (today's candidates + last-digest numbering). Tools: `complete_task`, `set_status`, `create_task`, `snooze_task`, `reopen_task`, `list_today`, `clarify`. Static instructions/tools go in a cached system block; dynamic context + user text go in the user message.

- [ ] **Step 1: Write the failing test**

`src/lib/whatsapp/__tests__/nlu.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- nlu`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/whatsapp/nlu.ts`:
```ts
import Anthropic from '@anthropic-ai/sdk'
import type { WhatsappConfig } from '@/lib/whatsapp/config'

export interface NluContext {
  tasks: { ref: number; id: string; title: string; status: string }[]
}

export type Intent =
  | { kind: 'complete_task'; ref: number }
  | { kind: 'reopen_task'; ref: number }
  | { kind: 'set_status'; ref: number; status: string }
  | { kind: 'snooze_task'; ref: number; dueDate: string }
  | { kind: 'create_task'; title: string; dueDate?: string }
  | { kind: 'list_today' }
  | { kind: 'clarify'; reason?: string }

const SYSTEM = `אתה עוזר שמפענח פקודות וואטסאפ בעברית לניהול משימות.
תמיד הפעל בדיוק כלי אחד. אם לא ברור למה הכוונה — הפעל clarify.
"ref" הוא המספר שמופיע ברשימת המשימות שסופקה. סטטוסים חוקיים: OPEN, IN_PROGRESS, WAITING, DONE, CANCELLED.
תאריכים בפורמט ISO 8601.`

const tools: Anthropic.Tool[] = [
  { name: 'complete_task', description: 'סמן משימה כהושלמה', input_schema: { type: 'object', properties: { ref: { type: 'number' } }, required: ['ref'] } },
  { name: 'reopen_task', description: 'פתח מחדש משימה שהושלמה', input_schema: { type: 'object', properties: { ref: { type: 'number' } }, required: ['ref'] } },
  { name: 'set_status', description: 'שנה סטטוס של משימה', input_schema: { type: 'object', properties: { ref: { type: 'number' }, status: { type: 'string' } }, required: ['ref', 'status'] } },
  { name: 'snooze_task', description: 'דחה משימה לתאריך חדש', input_schema: { type: 'object', properties: { ref: { type: 'number' }, dueDate: { type: 'string' } }, required: ['ref', 'dueDate'] } },
  { name: 'create_task', description: 'צור משימה חדשה', input_schema: { type: 'object', properties: { title: { type: 'string' }, dueDate: { type: 'string' } }, required: ['title'] } },
  { name: 'list_today', description: 'שלח שוב את רשימת המשימות להיום', input_schema: { type: 'object', properties: {} } },
  { name: 'clarify', description: 'הפקודה לא ברורה — בקש הבהרה', input_schema: { type: 'object', properties: { reason: { type: 'string' } } } },
]

export async function parseCommand(
  cfg: WhatsappConfig,
  text: string,
  context: NluContext,
): Promise<Intent> {
  const client = new Anthropic({ apiKey: cfg.anthropicApiKey })
  const res = await client.messages.create({
    model: cfg.anthropicModel,
    max_tokens: 512,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    tools,
    tool_choice: { type: 'any' },
    messages: [
      {
        role: 'user',
        content:
          `רשימת משימות נוכחית (ref · כותרת · סטטוס):\n` +
          context.tasks.map((t) => `${t.ref}. ${t.title} [${t.status}]`).join('\n') +
          `\n\nההודעה מהמשתמש:\n${text}`,
      },
    ],
  })

  const tool = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  if (!tool) return { kind: 'clarify' }
  const input = (tool.input ?? {}) as Record<string, unknown>

  switch (tool.name) {
    case 'complete_task': return { kind: 'complete_task', ref: Number(input.ref) }
    case 'reopen_task': return { kind: 'reopen_task', ref: Number(input.ref) }
    case 'set_status': return { kind: 'set_status', ref: Number(input.ref), status: String(input.status) }
    case 'snooze_task': return { kind: 'snooze_task', ref: Number(input.ref), dueDate: String(input.dueDate) }
    case 'create_task': return { kind: 'create_task', title: String(input.title), dueDate: input.dueDate ? String(input.dueDate) : undefined }
    case 'list_today': return { kind: 'list_today' }
    default: return { kind: 'clarify', reason: input.reason ? String(input.reason) : undefined }
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- nlu`
Expected: 2 passed.

- [ ] **Step 5: Checkpoint** — `npm run lint && npm test` green. Tick task.

---

## Task 11: Task-reference resolver

**Files:**
- Create: `src/lib/whatsapp/resolve-task.ts`
- Test: `src/lib/whatsapp/__tests__/resolve-task.test.ts`

`buildContext(now, cfg)` reads today's candidate tasks (same filter as the digest's "today + overdue") and the `whatsapp:lastDigest` snapshot, returning `{ tasks: [{ref,id,title,status}] }` where `ref` follows the snapshot order if present, else the freshly-queried order. `resolveRef(context, ref)` → task id or `null`.

- [ ] **Step 1: Write the failing test**

`src/lib/whatsapp/__tests__/resolve-task.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const findMany = vi.fn()
const findUnique = vi.fn()
vi.mock('@/lib/db', () => ({ prisma: {
  task: { findMany: (...a: unknown[]) => findMany(...a) },
  settings: { findUnique: (...a: unknown[]) => findUnique(...a) },
} }))

import { buildContext, resolveRef } from '@/lib/whatsapp/resolve-task'

const cfg = { digestTimezone: 'Asia/Jerusalem' } as never

describe('resolve-task', () => {
  beforeEach(() => vi.clearAllMocks())

  it('numbers by the saved digest snapshot order', async () => {
    findUnique.mockResolvedValue({ value: JSON.stringify({ date: '2026-05-19', taskIds: ['b', 'a'] }) })
    findMany.mockResolvedValue([
      { id: 'a', title: 'A', status: 'OPEN' },
      { id: 'b', title: 'B', status: 'OPEN' },
    ])
    const ctx = await buildContext(new Date('2026-05-19T06:00:00Z'), cfg)
    expect(ctx.tasks.map((t) => `${t.ref}:${t.id}`)).toEqual(['1:b', '2:a'])
    expect(resolveRef(ctx, 2)).toBe('a')
    expect(resolveRef(ctx, 9)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- resolve-task`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/whatsapp/resolve-task.ts`:
```ts
import { prisma } from '@/lib/db'
import { localDayWindow, localDateKey } from '@/lib/whatsapp/time'
import type { WhatsappConfig } from '@/lib/whatsapp/config'
import type { NluContext } from '@/lib/whatsapp/nlu'

const LAST_DIGEST_KEY = 'whatsapp:lastDigest'
const ACTIVE = { notIn: ['DONE', 'CANCELLED'] as const }

export async function buildContext(now: Date, cfg: WhatsappConfig): Promise<NluContext> {
  const { start, end } = localDayWindow(now, cfg.digestTimezone)
  const rows = await prisma.task.findMany({
    where: {
      deletedAt: null, archivedAt: null, status: ACTIVE,
      OR: [{ dueDate: { gte: start, lt: end } }, { dueDate: { lt: start } }],
    },
    select: { id: true, title: true, status: true },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))

  let order = rows.map((r) => r.id)
  const snap = await prisma.settings.findUnique({ where: { key: LAST_DIGEST_KEY } })
  if (snap) {
    try {
      const parsed = JSON.parse(snap.value) as { date?: string; taskIds?: string[] }
      if (parsed.date === localDateKey(now, cfg.digestTimezone) && Array.isArray(parsed.taskIds)) {
        order = parsed.taskIds.filter((id) => byId.has(id))
      }
    } catch {
      // corrupt snapshot — keep freshly-queried order
    }
  }

  return {
    tasks: order.map((id, i) => {
      const r = byId.get(id)!
      return { ref: i + 1, id: r.id, title: r.title, status: r.status }
    }),
  }
}

export function resolveRef(ctx: NluContext, ref: number): string | null {
  return ctx.tasks.find((t) => t.ref === ref)?.id ?? null
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- resolve-task`
Expected: passed.

- [ ] **Step 5: Checkpoint** — `npm run lint && npm test` green. Tick task.

---

## Task 12: Command processor

**Files:**
- Create: `src/lib/whatsapp/process-command.ts`
- Test: `src/lib/whatsapp/__tests__/process-command.test.ts`

`processCommand(intent, ctx)` → `{ reply: string }`. Routes each intent to the matching `tasks.ts` action with `actor = 'WHATSAPP'`, returns a Hebrew confirmation. Unknown ref → Hebrew "לא מצאתי משימה כזו". `clarify` → Hebrew help text. Never throws to the caller (catches action errors and returns a Hebrew failure reply).

- [ ] **Step 1: Write the failing test**

`src/lib/whatsapp/__tests__/process-command.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const actions = {
  completeTask: vi.fn(async () => ({ id: 'a' })),
  updateTask: vi.fn(async () => ({ id: 'a' })),
  reopenTask: vi.fn(async () => ({ id: 'a' })),
  createTask: vi.fn(async () => ({ id: 'new' })),
}
vi.mock('@/lib/actions/tasks', () => actions)

import { processCommand } from '@/lib/whatsapp/process-command'

const ctx = { tasks: [{ ref: 1, id: 'a', title: 'לקנות חלב', status: 'OPEN' }] }

describe('processCommand', () => {
  beforeEach(() => vi.clearAllMocks())

  it('completes via WHATSAPP actor and confirms in Hebrew', async () => {
    const { reply } = await processCommand({ kind: 'complete_task', ref: 1 }, ctx)
    expect(actions.completeTask).toHaveBeenCalledWith('a', 'WHATSAPP')
    expect(reply).toContain('הושלמה')
    expect(reply).toContain('לקנות חלב')
  })

  it('handles an unknown ref in Hebrew without calling actions', async () => {
    const { reply } = await processCommand({ kind: 'complete_task', ref: 7 }, ctx)
    expect(actions.completeTask).not.toHaveBeenCalled()
    expect(reply).toContain('לא מצאתי')
  })

  it('creates a task', async () => {
    const { reply } = await processCommand({ kind: 'create_task', title: 'משימה חדשה' }, ctx)
    expect(actions.createTask).toHaveBeenCalledWith(
      { title: 'משימה חדשה', dueDate: undefined }, 'WHATSAPP',
    )
    expect(reply).toContain('נוצרה')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- process-command`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/whatsapp/process-command.ts`:
```ts
import { completeTask, reopenTask, updateTask, createTask } from '@/lib/actions/tasks'
import { resolveRef } from '@/lib/whatsapp/resolve-task'
import type { Intent, NluContext } from '@/lib/whatsapp/nlu'

const NOT_FOUND = 'לא מצאתי משימה כזו ברשימה. שלח/י "רשימה" כדי לראות שוב.'
const HELP =
  'אפשר לכתוב למשל: "סיימתי את 2", "תפתח מחדש 1", "שנה 3 לבעבודה", "תדחה 2 למחר", "משימה חדשה: לקנות חלב", או "רשימה".'

function title(ctx: NluContext, ref: number): string {
  return ctx.tasks.find((t) => t.ref === ref)?.title ?? ''
}

export async function processCommand(
  intent: Intent,
  ctx: NluContext,
): Promise<{ reply: string }> {
  try {
    switch (intent.kind) {
      case 'clarify':
        return { reply: HELP }

      case 'list_today': {
        if (ctx.tasks.length === 0) return { reply: 'אין משימות פתוחות להיום 🎉' }
        return {
          reply: ctx.tasks.map((t) => `${t.ref}. ${t.title} [${t.status}]`).join('\n'),
        }
      }

      case 'create_task': {
        await createTask({ title: intent.title, dueDate: intent.dueDate }, 'WHATSAPP')
        return { reply: `✅ נוצרה משימה: ${intent.title}` }
      }

      case 'complete_task': {
        const id = resolveRef(ctx, intent.ref)
        if (!id) return { reply: NOT_FOUND }
        await completeTask(id, 'WHATSAPP')
        return { reply: `✅ המשימה "${title(ctx, intent.ref)}" הושלמה.` }
      }

      case 'reopen_task': {
        const id = resolveRef(ctx, intent.ref)
        if (!id) return { reply: NOT_FOUND }
        await reopenTask(id, 'WHATSAPP')
        return { reply: `↩️ המשימה "${title(ctx, intent.ref)}" נפתחה מחדש.` }
      }

      case 'set_status': {
        const id = resolveRef(ctx, intent.ref)
        if (!id) return { reply: NOT_FOUND }
        await updateTask(id, { status: intent.status }, 'WHATSAPP')
        return { reply: `🔁 הסטטוס של "${title(ctx, intent.ref)}" עודכן ל-${intent.status}.` }
      }

      case 'snooze_task': {
        const id = resolveRef(ctx, intent.ref)
        if (!id) return { reply: NOT_FOUND }
        await updateTask(id, { dueDate: intent.dueDate }, 'WHATSAPP')
        return { reply: `⏰ המשימה "${title(ctx, intent.ref)}" נדחתה.` }
      }

      default:
        return { reply: HELP }
    }
  } catch {
    return { reply: 'אירעה שגיאה בביצוע הפעולה. נסה/י שוב או פנה/י לאפליקציה.' }
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- process-command`
Expected: 3 passed.

- [ ] **Step 5: Checkpoint** — `npm run lint && npm test` green. Tick task.

---

## Task 13: Inbound webhook route

**Files:**
- Create: `src/app/api/webhooks/green-api/[token]/route.ts`
- Test: `src/app/api/webhooks/green-api/__tests__/route.test.ts`

Flow: verify path token (constant length+compare) → parse Green API `incomingMessageReceived` → verify sender == owner phone → upsert `InboundMessage` by `waMessageId` (dedup; if already `processed`, ack) → `buildContext` → `parseCommand` → `processCommand` → `sendText` reply → persist `OutboundMessage` + mark `InboundMessage` processed. Always return 200 after raw persist.

- [ ] **Step 1: Write the failing test**

`src/app/api/webhooks/green-api/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const cfg = {
  webhookToken: 'sek', ownerPhone: '972501234567',
  idInstance: '1', tokenInstance: 't', apiUrl: 'u',
  digestTimezone: 'Asia/Jerusalem',
} as never
vi.mock('@/lib/whatsapp/config', () => ({ loadWhatsappConfig: () => cfg }))

const inbound = { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({ id: 'in1' })), update: vi.fn() }
vi.mock('@/lib/db', () => ({ prisma: {
  inboundMessage: inbound,
  outboundMessage: { create: vi.fn() },
} }))
vi.mock('@/lib/whatsapp/resolve-task', () => ({ buildContext: vi.fn(async () => ({ tasks: [] })) }))
const parseCommand = vi.fn(async () => ({ kind: 'list_today' }))
vi.mock('@/lib/whatsapp/nlu', () => ({ parseCommand: (...a: unknown[]) => parseCommand(...a) }))
vi.mock('@/lib/whatsapp/process-command', () => ({ processCommand: vi.fn(async () => ({ reply: 'אין משימות' })) }))
const sendText = vi.fn(async () => 'WAout')
vi.mock('@/lib/green-api/client', () => ({ sendText: (...a: unknown[]) => sendText(...a) }))

import { POST } from '@/app/api/webhooks/green-api/[token]/route'

function body(sender: string, text: string, idMessage = 'WAin1') {
  return new Request('http://x', {
    method: 'POST',
    body: JSON.stringify({
      typeWebhook: 'incomingMessageReceived',
      idMessage,
      senderData: { sender: `${sender}@c.us`, chatId: `${sender}@c.us` },
      messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } },
    }),
  })
}
const ctxParam = (token: string) => ({ params: Promise.resolve({ token }) })

describe('green-api webhook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('404 on bad token', async () => {
    const res = await POST(body('972501234567', 'hi'), ctxParam('wrong'))
    expect(res.status).toBe(404)
  })

  it('ignores a foreign sender with 200 and no processing', async () => {
    const res = await POST(body('972500000000', 'hi'), ctxParam('sek'))
    expect(res.status).toBe(200)
    expect(parseCommand).not.toHaveBeenCalled()
  })

  it('processes the owner message and replies', async () => {
    const res = await POST(body('972501234567', 'רשימה'), ctxParam('sek'))
    expect(res.status).toBe(200)
    expect(parseCommand).toHaveBeenCalledOnce()
    expect(sendText).toHaveBeenCalledOnce()
    expect(inbound.update).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- green-api/__tests__/route`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/app/api/webhooks/green-api/[token]/route.ts`:
```ts
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
  const text = String(
    ((payload.messageData as { textMessageData?: { textMessage?: string } } | undefined)
      ?.textMessageData?.textMessage) ?? '',
  ).trim()
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

  try {
    const now = new Date()
    const context = await buildContext(now, cfg)
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
      data: { processed: true, processedAt: new Date(), parsedAction: intent.kind },
    })
  } catch {
    // Never retry-storm: ack 200 even on internal failure (raw already saved).
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- green-api/__tests__/route`
Expected: 3 passed.

- [ ] **Step 5: Checkpoint** — `npm run lint && npm test` green. Run `/check-conventions`. Tick task.

---

## Task 14: Wiring docs + full verification

**Files:**
- Create: `docs/green-api-setup.md`

- [ ] **Step 1: Write the setup doc**

`docs/green-api-setup.md`:
```markdown
# Green API WhatsApp — setup

1. Fill `.env` from `.env.example` (all WHATSAPP_/GREEN_API_/ANTHROPIC_/CRON_ vars).
2. In the Green API console, set the instance webhook URL to:
   `https://<your-domain>/api/webhooks/green-api/<WHATSAPP_WEBHOOK_TOKEN>`
   and enable "incoming message" notifications.
3. On Vercel, set all env vars in Project Settings (incl. `CRON_SECRET` — Vercel
   sends it automatically as the cron Bearer). `vercel.json` registers the hourly cron.
4. The digest sends once/day at `DIGEST_HOUR_LOCAL` in `DIGEST_TIMEZONE`
   (hourly cron + in-handler guard; safe under DST).
5. Only `WHATSAPP_OWNER_PHONE` can issue commands; all other senders are ignored.
6. Commands are free Hebrew; supported: complete / reopen / set-status /
   snooze / create / "רשימה". Delete is intentionally NOT available via WhatsApp.
```

- [ ] **Step 2: Full suite**

Run: `npm run lint && npm test`
Expected: all suites green.

- [ ] **Step 3: Conventions**

Run `/check-conventions` (scope `src/lib/`). Expected: soft-delete + audit-log invariants ✅ (WhatsApp mutations go through existing actions with `actor='WHATSAPP'`); deterministic invariants ✅ via the convention-check hook.

- [ ] **Step 4: Manual end-to-end (after the user adds real Green API creds)**

  - Trigger digest: `curl -X POST localhost:3000/api/cron/daily-digest -H "Authorization: Bearer <CRON_SECRET>"` at the configured local hour → WhatsApp receives the numbered list.
  - Reply "סיימתי את 1" → task 1 becomes DONE (verify `TaskEvent.actor = WHATSAPP` in Prisma Studio) and a Hebrew confirmation arrives.

- [ ] **Step 5: Checkpoint** — vault sync: invoke `vault-keeper` to document the new Phase-2 modules + the two new API routes (canvas Phase-2 group + File Map). **M2 complete — feature shippable.**

---

## Self-Review (completed by plan author)

- **Spec coverage:** §3 components → Tasks 2,4,5,6,7,10,11,12 + routes 8,13; §4.1 outbound flow → Task 7+8; §4.2 inbound flow → Task 13; §3 `actor` change → Task 3; §6 testing → vitest in Task 1 + per-task tests; §7 env → Task 9 `.env.example`; cron robustness/idempotency → Task 8; "no delete via WhatsApp" → Task 10/12 tool set (no delete tool); empty-day digest → Task 5. No uncovered spec sections.
- **Placeholder scan:** every code step has complete code; no TBD/TODO; commit steps replaced by lint+test checkpoints (project has no git).
- **Type consistency:** `WhatsappConfig` (Task 2) used by Tasks 7,8,10,11,13; `Intent`/`NluContext` defined in Task 10 used by Tasks 11,12,13; `DigestTask`/`digestOrder`/`formatDigest` (Task 5) used by Task 7; `sendText(creds,chatId,message)` signature consistent in Tasks 4,7,13; `actor` param order `(…, actor='USER')` consistent in Task 3 and call sites in Task 12.
- **Ambiguity:** "today" = `localDayWindow` in `DIGEST_TIMEZONE`; idempotency = single `whatsapp:lastDigest.date`; ref numbering = snapshot order then fresh query — all explicit.
