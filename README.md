# שניים מקרא ואחד תרגום

אפליקציית PWA לקריאת שניים מקרא ואחד תרגום. קובץ יחיד — `index.html` — מתארח ב־Firebase Hosting בפרויקט `shnayim-mikra-app`.

---

## ⚠️ אזהרה — המאגר הזה אינו מסונכרן עם הפרודקשן

**נכון ל־2 בספטמבר 2026, הקוד בענף `main` ישן מהגרסה החיה בכחודש וחצי.**

| | |
|---|---|
| קומיט אחרון ב־`main` לפני האזהרה הזו | 19 במאי 2026 |
| פריסה אחרונה לפרודקשן | 7 ביולי 2026 (שחרור `1b2685`) |

הפריסות לפרודקשן נעשו מתיקייה מקומית שמעולם לא נדחפה ל־GitHub. כתוצאה מכך, `main` **חסר** תכונות שקיימות באתר החי — בהן פרשיות מחוברות (נצבים־וילך וכו׳) ושינויי עיצוב.

### אל תפרוס מהמאגר הזה

```
# ❌ אל תריץ את זה עד שהפרודקשן יסונכרן לכאן
firebase deploy --only hosting
```

פריסה מ־`main` **תדרוס את האתר החי בקוד ישן**. זה כבר קרה פעם אחת ותוקן ב־Rollback דרך מסוף Firebase.

### לפני כל פריסה עתידית

1. ודא שהמקור בפרודקשן נדחף לכאן, ושהעץ המקומי מעודכן מול `origin/main`
2. רק אז פרוס

### איך לסנכרן (מהתיקייה שממנה פורסים בפועל)

```bash
git init                      # אם התיקייה עדיין לא מנוהלת ב-git
git remote add origin https://github.com/atz1800/shnayim-mikra.git
git add -A
git commit -m "sync: production source"
git push -u origin main --force-with-lease
```

מרגע שהסנכרון בוצע — מחק את הסעיף הזה מה־README.

---

## פריסה

```bash
npx firebase-tools login
npx firebase-tools deploy --only hosting
```

כתובת: https://shnayim-mikra-app.web.app

## שחזור אחרי פריסה שגויה

מסוף Firebase → Hosting → Release history → שלוש נקודות על השחרור הקודם → **Rollback**.

https://console.firebase.google.com/project/shnayim-mikra-app/hosting/sites

## מקור הטקסט

[ספריא](https://www.sefaria.org) · CC BY-NC
