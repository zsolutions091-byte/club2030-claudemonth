# Green API WhatsApp Integration — Design Spec

- **Date:** 2026-05-19
- **Status:** Approved (design), pending implementation plan
- **Project:** club2030-claudemonth (Phase 2)
- **Scope:** Daily outbound "tasks due today" digest to a single WhatsApp number, plus inbound free-language command parsing (complete / set status / create / snooze / reopen) via the Claude API.

> Note: this repository is **not** a git repo, so this spec is saved but not committed (consistent with the project's existing "not a git repo" reality, e.g. the `convention-check` Stop hook).

## 1. Goals & Non-Goals

### Goals
- Once per day, send the project owner (a single phone number) a Hebrew, numbered list of tasks due today, with overdue tasks in a separate marked section.
- Let the owner reply in free natural Hebrew to: complete a task, change a task's status, create a task, snooze (postpone `dueDate`), reopen a task, and ask for today's list on demand.
- Connect the existing `OutboundMessage` / `InboundMessage` / `Settings` models and the existing `/api/webhooks/` bypass in `src/proxy.ts`.
- Preserve all project invariants: soft delete, Task audit log (`TaskEvent`), Hebrew strings, `@/` path alias, server-action mutation path.

### Non-Goals (YAGNI / out of scope for this slice)
- Hard delete of tasks via WhatsApp (excluded for safety — app only).
- Per-task reminders using the `Reminder` model (`BEFORE_DUE` / `AT_TIME`). The `Reminder` model is intentionally left unused here; the daily digest is **not** per-task.
- Outbound media/attachments, group chats, multi-user.
- Automatic retry/queue for failed sends (logged as `FAILED`, no auto-retry in MVP).
- A background job queue for inbound processing (synchronous is sufficient at single-user volume).

## 2. Decisions (locked with the user)

| Decision | Choice |
|---|---|
| Green API account | Owner already has a connected instance (`idInstance` + `apiTokenInstance`). API key to be added to `.env` later by the user. |
| Production host / scheduler | Vercel + Vercel Cron. |
| Inbound command understanding | Free natural language via the Claude API (Anthropic SDK), using tool-use. |
| Webhook security | Secret token in the URL path **and** sender-number verification. |
| NLU output shape | Claude **tool-use** (typed function calling). |
| Task reference resolution | **Hybrid** — Claude receives today's task list + the last digest snapshot; resolves by number or description. |
| Webhook processing | **Synchronous** (no queue). |
| Cron timing robustness | **Hourly** Vercel Cron + an in-handler local-time/idempotency guard (DST-proof). |
| Code structure | Follows the documented Phase-2 agents: `green-api-integrator`, `reminder-scheduler-designer`. |
| Digest contents | Tasks due **today** + a separate `⚠️ באיחור` (overdue) section. |
| Destructive commands via WhatsApp | Excluded from MVP (no delete). |

## 3. Architecture & Components

New code:

- `src/lib/green-api/client.ts` — HTTP client for Green API. `sendText(chatId, body)`. Reads `GREEN_API_ID_INSTANCE`, `GREEN_API_TOKEN_INSTANCE`, `GREEN_API_API_URL`. Operator-facing English errors only (per project convention for misconfig).
- `src/lib/whatsapp/nlu.ts` — wraps the Anthropic SDK. System prompt + tool schema, prompt caching on the static system/tool block. Model: Haiku (cheap/fast for command parsing). Returns a normalized intent (one of the tool calls) or a `clarify` request.
- `src/lib/whatsapp/process-command.ts` — takes a normalized intent, resolves the target task (number from last digest snapshot, or description against today's candidates), invokes the relevant task action with `actor = WHATSAPP`, and builds the Hebrew confirmation reply.
- `src/lib/whatsapp/digest.ts` — pure function: `(tasks) => Hebrew numbered message string`. Separately formats the "today" block and the `⚠️ באיחור` block. No I/O.
- `src/app/api/cron/daily-digest/route.ts` — Next.js 16 route handler. Guarded by `Authorization: Bearer ${CRON_SECRET}`.
- `src/app/api/webhooks/green-api/[token]/route.ts` — Next.js 16 dynamic route handler. `proxy.ts` already bypasses `/api/webhooks/`.
- `vercel.json` — Vercel Cron registration, hourly.

Changed existing code:

- `src/lib/actions/tasks.ts` — add an **optional** `actor` parameter (default `'USER'`) to the Task mutation actions so WhatsApp-originated mutations record `TaskEvent` with `actor = WHATSAPP`. This is the minimal change that preserves the audit-log contract; no new pattern is introduced. (Server-action-builder territory.)

Reused models (no schema migration required):

- `OutboundMessage` — every sent message (digest + replies). `taskId` nullable → used as null for the digest.
- `InboundMessage` — every received message; `waMessageId @unique` provides dedup/idempotency.
- `Settings` — single key `whatsapp:lastDigest` stores JSON `{ date: "YYYY-MM-DD", taskIds: string[] }` (ordered). It serves both purposes: numeric task references *and* cron idempotency (the `date` field is the "already sent today" marker). No second key.
- `Reminder` — **not used** by this feature (documented deliberate choice).
- `TaskEvent` — digest send → `REMINDER_SENT` (`actor = SYSTEM`); inbound mutations → existing event types with `actor = WHATSAPP`.

## 4. Data Flow

### 4.1 Outbound daily digest
1. Vercel Cron hits `POST/GET /api/cron/daily-digest` every hour.
2. Guard: (a) `Authorization: Bearer ${CRON_SECRET}` matches (constant-time); (b) current local time in `DIGEST_TIMEZONE` has hour == `DIGEST_HOUR_LOCAL`; (c) no digest already sent for today's local date (checked via the `Settings` snapshot date). If any guard fails → return `200` and do nothing.
3. Query tasks: `dueDate` within today's local-day window (computed in `DIGEST_TIMEZONE`), `status ∉ {DONE, CANCELLED}`, `deletedAt = null`, `archivedAt = null`. Separately query overdue: `dueDate < start-of-today-local`, same filters.
4. Format Hebrew numbered message via `digest.ts` (today block + `⚠️ באיחור` block). Ordered task ids captured. **Empty day:** if there are no tasks today and none overdue, still send a short Hebrew "אין משימות להיום 🎉" message (confirms the system is alive) and write the snapshot with `taskIds: []`.
5. Send via Green API `sendText(ownerChatId, body)`.
6. Persist `OutboundMessage` (`status = SENT`, `waMessageId`, `taskId = null`). On failure: `status = FAILED` + `errorMessage`.
7. Write `Settings['whatsapp:lastDigest'] = { date, taskIds }`. Emit `TaskEvent(REMINDER_SENT, actor = SYSTEM)` per included task.

### 4.2 Inbound command
1. WhatsApp message → Green API → `POST /api/webhooks/green-api/<token>`.
2. Verify path `<token>` == `WHATSAPP_WEBHOOK_TOKEN` (constant-time). Mismatch → `404`.
3. Parse Green API webhook (`typeWebhook: incomingMessageReceived`). Extract sender number and message text.
4. Verify sender == `WHATSAPP_OWNER_PHONE`. Mismatch → persist nothing sensitive, return `200`, ignore.
5. Persist `InboundMessage` (`rawWebhook`, `body`, `waMessageId`). If `waMessageId` already exists/processed → return `200` (idempotent), stop.
6. NLU: call Claude (tool-use) with context = today's candidate tasks + the `whatsapp:lastDigest` snapshot mapping. Tools: `complete_task`, `set_status`, `create_task`, `snooze_task`, `reopen_task`, `list_today`, `clarify`.
7. Resolve the target task (by number from snapshot, or by description against candidates). Ambiguous/unknown → reply in Hebrew asking to clarify; no mutation.
8. Execute via the corresponding task action with `actor = WHATSAPP` (existing `prisma.$transaction` + `TaskEvent`).
9. Send Hebrew confirmation via Green API. Persist `OutboundMessage`. Update `InboundMessage` (`processed = true`, `parsedAction`, `matchedTaskId`).
10. Always return `200` quickly to avoid Green API retry storms (after the raw message is persisted).

## 5. Error Handling & Security

- Green API send failure → `OutboundMessage.status = FAILED` + `errorMessage`; cron returns `200`; no auto-retry in MVP. Failures are visible via stored `OutboundMessage` rows.
- Webhook always returns `200` fast once the raw inbound is persisted; NLU/ambiguity → Hebrew clarification reply, never a silent mutation.
- Idempotency: cron guarded by the `Settings` snapshot date; webhook guarded by `InboundMessage.waMessageId @unique`.
- Security layers: path token (constant-time compare) + sender allowlist (single number) + `CRON_SECRET` bearer for the cron endpoint. Unknown sender → no mutation, no information disclosure.
- Hebrew user-facing strings; operator/misconfig errors (missing env) may be English per existing project convention (`src/lib/db.ts` precedent).

## 6. Testing

The project currently has no test infrastructure. Add a minimal **vitest** setup covering the pure/iso­latable units:

- `digest.ts` formatter (pure) — today + overdue sections, empty state, numbering.
- NLU mapping (`nlu.ts`) with the Anthropic SDK mocked — text → expected tool call.
- `process-command.ts` with task actions mocked — intent → correct action + Hebrew reply; ambiguity → clarify.
- Green API client with `fetch` mocked.
- Webhook route: token mismatch → 404; wrong sender → 200 + ignore; valid → `InboundMessage` + `TaskEvent(actor = WHATSAPP)` + `OutboundMessage`.
- Cron route: guard logic (bad secret, wrong hour, already-sent-today) and the happy path.

## 7. New Environment Variables (`.env`)

| Var | Purpose | Default |
|---|---|---|
| `GREEN_API_ID_INSTANCE` | Green API instance id | — (user adds later) |
| `GREEN_API_TOKEN_INSTANCE` | Green API API token | — (user adds later) |
| `GREEN_API_API_URL` | Green API base URL | `https://api.green-api.com` |
| `WHATSAPP_OWNER_PHONE` | Sole allowed sender / recipient, digits only (e.g. `9725XXXXXXXX`) | — |
| `WHATSAPP_WEBHOOK_TOKEN` | Secret token embedded in the webhook path | — |
| `ANTHROPIC_API_KEY` | Claude API key for NLU | — |
| `CRON_SECRET` | Bearer secret Vercel Cron sends to the digest endpoint | — |
| `DIGEST_HOUR_LOCAL` | Local hour to send the digest | `8` |
| `DIGEST_TIMEZONE` | IANA timezone for "today" + send-time | `Asia/Jerusalem` |

Existing, unchanged: `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` (system login, consumed by `src/proxy.ts`).

## 8. Open Items for Implementation Planning

- Exact Green API endpoint shapes (`sendMessage`) and webhook payload fields — confirm against Green API docs during implementation.
- Exact Claude tool-use schema and system prompt wording (Hebrew), including prompt caching boundaries.
- Whether `actor` is threaded as a parameter on each `tasks.ts` action vs a small shared internal helper — decide in the plan (minimal-diff preferred).
- vitest wiring into the Next.js 16 / Prisma 7 project (config, test DB strategy).
