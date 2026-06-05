import { useEffect, useRef } from 'react'

/* ═══════════════════════════════════════════════════════════════
   useBackGuard — תיקון מחוות "חזור" (Edge Swipe Back) ל-PWA React
   ───────────────────────────────────────────────────────────────
   הבעיה: באפליקציית React שמנהלת "מסכים" ב-state (מודאל, מסך פירוט)
   ולא בכתובת/ראוטר — מחוות החזור של אנדרואיד לא יודעת עליהם, אז היא
   יוצאת מהאפליקציה במקום לסגור את השכבה הפתוחה.

   הפתרון: "מלכודת" אחת בהיסטוריה (pushState) שתמיד דרוכה. כל מחוות
   חזור מיירטת קודם דרכנו:
     • יש שכבה פתוחה? → סוגרים את הפנימית ביותר, ומלכדים שוב.
     • אין כלום פתוח?  → יציאה טבעית (כמו שאמור להיות במסך הראשי).

   שימוש:
     useBackGuard([
       { open: !!selected, close: () => setSelected(null) }, // חיצוני
       { open: showAdd,    close: () => setShowAdd(false)  }, // פנימי (נסגר ראשון)
     ])

   הסדר במערך: חיצוני → פנימי. מחוות החזור סוגרת את **הפנימי הפתוח
   ביותר** קודם (האחרון במערך). כפתורי "סגור/חזור" שבתוך האפליקציה
   ממשיכים לעבוד כרגיל — ה-hook רק *מוסיף* יירוט לגסטורת המערכת.

   ⚠️ לא לשלב עם react-router באותו עץ — הראוטר כבר מנהל popstate.
      ל-hook הזה מיועד לאפליקציות מסך-יחיד מבוססות-state.
   ═══════════════════════════════════════════════════════════════ */
export function useBackGuard(layers) {
  // ref כדי שה-listener יקרא תמיד את מצב השכבות העדכני (בלי stale closure)
  const ref = useRef(layers)
  ref.current = layers

  useEffect(() => {
    history.pushState({ bg: 1 }, '') // מלכודת ראשונית — תמיד דרוכה

    const onPop = () => {
      const open = ref.current.filter(l => l && l.open)
      if (open.length) {
        open[open.length - 1].close()   // סוגרים את הפנימי ביותר
        history.pushState({ bg: 1 }, '') // מלכדים שוב לפעם הבאה
      } else {
        history.back()                   // אין כלום פתוח → יציאה טבעית
      }
    }

    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
}
