# שניים מקרא ואחד תרגום

אפליקציית PWA לקריאת שניים מקרא ואחד תרגום — React + Vite, מתארחת ב־Firebase Hosting בפרויקט `shnayim-mikra-app`.

| | |
|---|---|
| קוד האפליקציה | `src/main.jsx`, `src/index.css` |
| נקודת הכניסה של Vite | `index.html` (בשורש) |
| קבצים סטטיים (מניפסט, SW, אייקונים, מדיניות פרטיות) | `public/` |
| פלט הבנייה (לא נשמר בגיט) | `dist/` |
| הגרסה הישנה (React דרך CDN + Babel) — לעיון בלבד | `backup-original/legacy-index.html` |

## פיתוח

```bash
npm ci
npm run dev       # שרת פיתוח
npm run build     # בנייה ל-dist/
```

## פריסה

הפרודקשן נפרס מהמאגר הזה (ענף `main`). כל שינוי עובר דרך GitHub, ורק אחר כך נפרס:

```bash
git pull
npm ci
npx firebase-tools login       # פעם אחת במחשב
npx firebase-tools deploy --only hosting
```

`deploy` מריץ `npm run build` לבד. הגרסה שבאתר החי צריכה להיות זהה ל־`main` ב־GitHub.

כתובת: https://shnayim-mikra-app.web.app

## שחזור אחרי פריסה שגויה

מסוף Firebase → Hosting → Release history → שלוש נקודות על השחרור הקודם → **Rollback**.

https://console.firebase.google.com/project/shnayim-mikra-app/hosting/sites

## מקור הטקסט

[ספריא](https://www.sefaria.org) · CC BY-NC
