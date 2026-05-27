---
title: Home
aliases:
  - Index
  - דף הבית
tags:
  - index
cssclasses:
  - home
---

# 🏠 משימות — Vault

תיעוד חי של [club2030-claudemonth](https://github.com/zsolutions091-byte/club2030-claudemonth) — מערכת ניהול משימות אישית (single-user) שתחובר בעתיד ל-Green API לשליחת תזכורות וואטסאפ.

> [!info] איך לנווט
> ה-vault הוא mirror של הקוד. כל note מצביעה לקוד אמיתי דרך נתיב יחסי. שינוי ארכיטקטוני בקוד ⇒ עדכון ה-note המתאימה (ראה [[Vault Sync Hook]]).

## תרשים ארכיטקטורה

![[Architecture.canvas]]

## מפת ניווט

> [!abstract] Overview
> - [[Project Overview]] — מה המערכת עושה ומה המגבלות
> - [[Tech Stack]] — Next.js 16 / React 19 / Prisma 7 / PostgreSQL (Neon)
> - [[Conventions]] — חוקי הכתיבה (RTL, עברית, soft delete)
> - [[Roadmap]] — Phase 1 (single user) ↔ Phase 2 (WhatsApp)
> - [[File Map]] — אינדקס לכל קובץ קוד משמעותי

> [!example] Domain Models
> - [[Task]] · [[TaskEvent]] · [[Project]] · [[Tag]] · [[TaskTag]]
> - [[Reminder]] · [[OutboundMessage]] · [[InboundMessage]] · [[Settings]]

> [!example] Views
> - [[All]] (הכל) · [[Inbox]] (תיבת נכנסים) · [[Today]] (היום) · [[Week]] (השבוע)

> [!tip] Patterns
> - [[Server Actions Pattern]] — איך נכתבת כל mutation
> - [[Soft Delete]] — `deletedAt` בלבד, לעולם לא DELETE פיזי
> - [[Audit Log]] — `TaskEvent` על כל שינוי
> - [[Authentication]] — Basic Auth ב-`proxy.ts`
> - [[Hebrew Errors]] — הודעות שרת בעברית בלבד

> [!todo] Automation
> - [[Subagents]] — 4 ה-subagents שמתחזקים את הקוד
> - [[Vault Sync Hook]] — `PostToolUse` שמזכיר לעדכן את ה-vault

## חיפוש חי

```base
filters:
  and:
    - file.inFolder("02 Domain Models")

views:
  - type: cards
    name: "Domain Models"
    order:
      - file.name
```

## סטטוס

> [!success] Phase 1 — בעבודה
> Single-user, 4 ראוטים, schema מלאה כולל מודלי Phase 2 שעדיין לא מחוברים.

> [!warning] Phase 2 — מתוכנן
> Green API integration, `Reminder` scheduler, webhook handlers. ראה [[Roadmap]].
