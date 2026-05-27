---
title: Settings
aliases:
  - הגדרות
tags:
  - model
  - domain/settings
  - phase/1
status: schema-only
phase: 1
---

# Settings

טבלת key-value להגדרות מערכת. מודל פתוח לעתיד.

> [!info] קובץ
> `prisma/schema.prisma` (Settings model)

> [!warning] טרם בשימוש
> ה-schema קיים אבל אין קוד שכותב/קורא ממנו. נועד ל-Phase 2 — למשל מספר טלפון של המשתמש ל-WhatsApp, שעת שליחה דיפולטיבית של digest יומי, וכו'.

## סכמה

```prisma
model Settings {
  key       String   @id    // PK הוא ה-key עצמו
  value     String           // תמיד מחרוזת — JSON-encoded לפי הצורך
  updatedAt DateTime @updatedAt
}
```

## Keys מתוכננים (Phase 2)

> [!example] שמות מוצעים
> | key | value | תפקיד |
> |---|---|---|
> | `whatsapp.phone` | `"972501234567"` | מספר היעד לתזכורות |
> | `whatsapp.greenApiInstance` | `"1101000000"` | מזהה instance של Green API |
> | `digest.dailyTime` | `"08:00"` | מתי לשלוח [[Reminder]] מסוג `DAILY_DIGEST` |
> | `digest.timezone` | `"Asia/Jerusalem"` | אזור זמן לחישוב |

> [!tip] מבנה ערך
> `value` תמיד `String`. אם צריך structure (למשל אובייקט) — `JSON.stringify` בכתיבה ו-`JSON.parse` בקריאה. עדיף לשמור flat keys.

> [!warning] סודות לא כאן
> מפתח ה-API של Green לא הולך ל-`Settings` — הוא ב-`.env` בלבד.

ראה גם: [[Roadmap]]
