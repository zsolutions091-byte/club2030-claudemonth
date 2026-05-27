---
title: TaskEvent
aliases:
  - אירוע משימה
  - audit
tags:
  - model
  - domain/audit
  - phase/1
status: active
phase: 1
---

# TaskEvent

לוג immutable של כל שינוי ב-[[Task]]. הלב של [[Audit Log]].

> [!info] קובץ
> `prisma/schema.prisma` (TaskEvent model)  ·  נכתב אוטומטית ע"י כל action ב-`src/lib/actions/tasks.ts`

> [!important] חוק ברזל
> כל mutation על Task יוצרת לפחות event אחד, בתוך אותה `prisma.$transaction`. אין שינוי ב-Task ללא event מקביל.

## שדות

| שדה | טיפוס | הערה |
|---|---|---|
| `id` | `String` cuid | |
| `taskId` | `String` | FK ל-[[Task]], `onDelete: Cascade` |
| `type` | `EventType` enum | ראה [[#סוגי אירועים]] |
| `actor` | `EventActor` enum | `USER` / `SYSTEM` / `WHATSAPP` |
| `payload` | `String?` | JSON-stringified — diff, from/to, וכו' |
| `note` | `String?` | טקסט חופשי (אופציונלי) |
| `createdAt` | `DateTime` | |

## סוגי אירועים

```ts
enum EventType {
  CREATED          // יצירה
  UPDATED          // שינוי שדה ב-LOGGED_FIELDS
  STATUS_CHANGED   // status השתנה (נפרד מ-UPDATED)
  COMPLETED        // status → DONE דרך completeTask
  REOPENED         // DONE → OPEN דרך reopenTask
  ARCHIVED         // archivedAt הוגדר
  DELETED          // deletedAt הוגדר
  RESTORED         // archivedAt → null
  SNOOZED          // (Phase 2) דחיית reminder
  REMINDER_SENT    // (Phase 2) OutboundMessage נשלחה
  REPLY_RECEIVED   // (Phase 2) InboundMessage התקבלה
  COMMENT          // (Phase 2) הערת משתמש
}
```

## פורמט payload לפי סוג

> [!example] CREATED
> ```json
> { "initial": { "title": "...", "status": "OPEN", ... } }
> ```

> [!example] UPDATED — אחד per שדה ששונה
> ```json
> { "field": "dueDate", "from": "2026-05-10T00:00:00Z", "to": "2026-05-12T00:00:00Z" }
> ```

> [!example] STATUS_CHANGED
> ```json
> { "field": "status", "from": "OPEN", "to": "IN_PROGRESS" }
> ```

> [!example] COMPLETED / REOPENED
> ```json
> { "from": "OPEN", "to": "DONE" }
> ```

## Index

```prisma
@@index([taskId, createdAt])  // שליפת היסטוריה לפי משימה, מסודרת
```

## למה immutable?

> [!quote]
> אין `update`/`delete` על TaskEvent. אם משהו השתנה — רושמים event חדש. זה מאפשר reconstruction מלא של מסלול משימה ובהמשך feed פעילות וויזואלי.

## עובדים עם TaskEvent

> [!todo] קריאה — עוד לא מומש ב-UI
> תכונת "היסטוריה" של משימה (drawer/popover) תיבנה ב-Sprint 3.

ראה גם: [[Task]] · [[Audit Log]] · [[Server Actions Pattern]]
