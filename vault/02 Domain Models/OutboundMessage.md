---
title: OutboundMessage
aliases:
  - הודעה יוצאת
tags:
  - model
  - domain/whatsapp
  - phase/2
status: schema-only
phase: 2
---

# OutboundMessage

הודעת WhatsApp שיוצאת מהמערכת — בדרך כלל בעקבות [[Reminder]].

> [!warning] טרם מומש
> אין כותב/קורא בקוד. ייכתב ב-Phase 2 ע"י subagent עתידי `green-api-integrator`.

## שדות

| שדה | טיפוס | הערה |
|---|---|---|
| `id` | `String` cuid | |
| `taskId` | `String?` | FK אופציונלי ל-[[Task]] |
| `reminderId` | `String?` | FK ל-[[Reminder]] (לא enforced ב-schema, אזכור בלבד) |
| `body` | `String` | טקסט ההודעה (כולל hint לתגובה: "ענה done/snooze/delete") |
| `waMessageId` | `String?` | מזהה Green API — מקושר ל-[[InboundMessage]] לתגובות |
| `status` | `OutboundStatus` enum | `PENDING` / `SENT` / `DELIVERED` / `READ` / `FAILED` |
| `errorMessage` | `String?` | אם FAILED |
| `sentAt` / `deliveredAt` / `readAt` | `DateTime?` | timestamps לפי שינויי סטטוס |

## Indexes

```prisma
@@index([taskId])
@@index([waMessageId])           // lookup מהיר מתשובת webhook
@@index([status, createdAt])     // pending לשליחה / failed לרטריי
```

## חיבור ל-Green API

> [!todo] תכנון
> - שליחה: `POST` ל-`SendMessage` של Green API
> - על תשובת ה-API מעדכנים `waMessageId` ו-`status=SENT`
> - על webhook (`statusInstance` event) מעדכנים `DELIVERED`/`READ`
> - על שגיאה — `status=FAILED`, `errorMessage`, רושמים [[TaskEvent]] מסוג `REMINDER_SENT` (גם אם נכשל — לתיעוד)

ראה גם: [[Reminder]] · [[InboundMessage]] · [[Roadmap]]
