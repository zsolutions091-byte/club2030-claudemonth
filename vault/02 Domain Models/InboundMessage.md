---
title: InboundMessage
aliases:
  - הודעה נכנסת
tags:
  - model
  - domain/whatsapp
  - phase/2
status: schema-only
phase: 2
---

# InboundMessage

הודעת WhatsApp נכנסת — תגובת המשתמש לתזכורת ([[OutboundMessage]]).

> [!warning] טרם מומש
> אין webhook handler עדיין. הנתיב `/api/webhooks/green-api/` עובר bypass ב-[[Authentication|`proxy.ts`]] לקראת זה.

## שדות

| שדה | טיפוס | הערה |
|---|---|---|
| `id` | `String` cuid | |
| `waMessageId` | `String?` | `@unique` — מונע double-processing של אותה הודעה |
| `body` | `String` | מה המשתמש כתב ("done", "snooze 1h", ...) |
| `rawWebhook` | `String` | JSON-stringified של כל ה-payload — לדיבוג |
| `matchedTaskId` | `String?` | משימה שזוהתה בתגובה (דרך quoted message או קונטקסט) |
| `parsedAction` | `String?` | `done` / `snooze` / `delete` / null אם לא זוהה |
| `processed` | `Boolean` | האם המערכת כבר עיבדה |
| `processedAt` | `DateTime?` | |

## פקודות מתוכננות

> [!example] שפה פשוטה
> | תגובה | פעולה |
> |---|---|
> | `done` / `✓` / `סיימתי` | `completeTask(matchedTaskId)` |
> | `snooze` / `דחה` | `updateTask` עם dueDate חדש (default +1 שעה) |
> | `snooze 2h` / `דחה 3 ימים` | parsing בסיסי של duration |
> | `delete` / `מחק` | `softDeleteTask(matchedTaskId)` |

## Indexes

```prisma
@@index([processed, createdAt])  // queue של "טרם עובדו"
@@index([matchedTaskId])
```

## נקודות פתוחות

> [!question]
> 1. כמה זמן לשמור `rawWebhook`? (השדה גדול ללא retention policy)
> 2. אם `parsedAction` הוא null (לא הצלחנו לפענח) — לשלוח שאלה חוזרת? להתעלם? לרשום [[TaskEvent]] עם type=`COMMENT`?
> 3. ה-`@unique` על `waMessageId` עוזר ל-idempotency של webhooks — וריפיקציה כפולה צריכה להיכשל בשקט.

ראה גם: [[OutboundMessage]] · [[Reminder]] · [[Authentication]] · [[Roadmap]]
