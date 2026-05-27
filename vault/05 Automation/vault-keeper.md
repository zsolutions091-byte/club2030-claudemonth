---
title: vault-keeper
aliases:
  - שומר ה-vault
tags:
  - automation
  - claude
  - subagent
---

# 🤖 vault-keeper

> [!info] קובץ
> `.claude/agents/vault-keeper.md`

## תפקיד

מעדכן את `vault/` כשמשהו ארכיטקטוני בקוד משתנה — מודל חדש, view חדשה, רכיב משמעותי, pattern חדש, או שינוי schema. מטפל ב:

- **Notes** ב-`02 Domain Models/`, `03 Views/`, `04 Patterns/`, וכו'
- **Architecture.canvas** — הוספת nodes, סידור edges, התאמת geometry של groups
- **File Map.md** — אינדקס לקבצי קוד
- **Cross-links** — wikilinks הדדיים בין notes רלוונטיות

## מתי להפעיל

> [!example] טריגרים מפורשים
> עברית: "תעדכן את ה-vault", "תוסיף תיעוד", "תסנכרן את התיעוד"
> אנגלית: "update the vault", "sync docs", "add a note for..."

> [!important] פרואקטיבי
> 1. תמיד אחרי [[prisma-model-architect]]
> 2. אחרי הוספת view חדשה (`page.tsx` ב-route group)
> 3. אחרי שינוי ב-`src/components/` שמייצר רכיב חדש (לא ב-`ui/`)
> 4. אחרי שינוי ב-`src/proxy.ts` או הגדרות אבטחה
>
> [[Vault Sync Hook]] שותל תזכורת אוטומטית ל-main Claude.

## דוגמאות שימוש

> [!example] אחרי `prisma-model-architect` שיצר Comment
> - להוסיף node ל-Architecture.canvas בקבוצת "Domain — Phase 1"
> - לעדכן `File Map.md` עם השורה החדשה
> - לקשר `Task.md` ↔ `Comment.md` (1:N)

> [!example] route חדש `/archive`
> - ליצור `vault/03 Views/Archive.md`
> - לקשר מ-`Home.md` (תחת Views)
> - להוסיף node ל-Architecture.canvas בקבוצת Frontend

> [!example] החלטה ארכיטקטונית בשיחה
> *"החלטנו ש-Reminder Scheduler יהיה Vercel cron"* — ה-keeper מעדכן את `Reminder.md` (ב-callout `> [!info] זרימה עתידית`) ואת `Roadmap.md`.

## מה הוא לא עושה

> [!warning] לא משכפל קוד ל-vault
> ה-vault הוא הסבר, לא mirror של הקוד. הוא לא מעתיק הגדרות מלאות של פונקציה. הוא מסביר *למה*, *איך זה מתחבר*, ו*למה הצורה הזו*.

ראה גם: [[Subagents]] · [[Vault Sync Hook]] · [[Architecture.canvas|Architecture Canvas]]
