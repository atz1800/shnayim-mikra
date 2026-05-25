/**
 * רשימת הפרויקטים לתיק העבודות.
 *
 * כדי להוסיף פרויקט חדש, הוסף אובייקט לרשימה הזו.
 *
 * שדות:
 *   id       – מזהה ייחודי (אותיות קטנות, ללא רווחים)
 *   title    – שם הפרויקט
 *   desc     – תיאור קצר (2-3 משפטים)
 *   emoji    – אמוג'י שמוצג כשאין תמונה
 *   image    – נתיב לתמונת סקרין (אפשרי: null)
 *   link     – URL לאפליקציה / אתר החי
 *   tags     – מערך טכנולוגיות
 *   category – "app" | "web" | "tool"
 *   year     – שנה
 */

export const PROJECTS = [
  {
    id: "shnayim-mikra",
    title: "שניים מקרא ואחד תרגום",
    desc: "אפליקציית PWA לקריאת פרשת השבוע לפי מנהג שניים מקרא ואחד תרגום. כולל מעקב אחרי התקדמות, התחברות עם גוגל וסנכרון בין מכשירים.",
    emoji: "📖",
    image: null,
    link: "https://shnayim-mikra-app.web.app",
    tags: ["React", "Firebase", "PWA", "Hebcal"],
    category: "app",
    year: "2025"
  },
  {
    id: "shas-tracker",
    title: "מעקב ש\"ס",
    desc: "אפליקציה למעקב אחרי לימוד הש\"ס. מסמן דפים שנלמדו, מציג התקדמות חזותית לפי מסכתות, ועוזר לשמור על קצב קבוע.",
    emoji: "📖",
    image: null,
    link: "https://atz1800.github.io/shas-tracker/",
    tags: ["JavaScript", "HTML", "CSS", "LocalStorage"],
    category: "app",
    year: "2025"
  },
  {
    id: "niggunim",
    title: "יומן הניגונים",
    desc: "מאגר אישי לניגונים וזמירות. שומר ניגונים עם שם, מקור, דירוג ומילות מפתח — כדי שתמיד תמצא את הניגון הנכון לרגע הנכון.",
    emoji: "🎵",
    image: null,
    link: "https://atz1800.github.io/niggunim/",
    tags: ["JavaScript", "HTML", "CSS", "LocalStorage"],
    category: "app",
    year: "2025"
  },
  {
    id: "chidushei-torah",
    title: "חידושי תורה",
    desc: "מחברת דיגיטלית לרישום חידושי תורה. כותב, מארגן ומחפש בחידושים שלך לפי פרשה, נושא או מקור — הכל במקום אחד.",
    emoji: "💡",
    image: null,
    link: "https://atz1800.github.io/chidushei-torah/",
    tags: ["JavaScript", "HTML", "CSS", "LocalStorage"],
    category: "app",
    year: "2025"
  },
  {
    id: "midrash-rabbah-tracker",
    title: "מעקב מדרש רבה",
    desc: "כלי מעקב ייעודי ללימוד מדרש רבה. מסמן פרשיות שנלמדו, מציג אחוז השלמה לכל ספר ועוזר לסיים את כל המדרש בצורה מסודרת.",
    emoji: "📚",
    image: null,
    link: "https://atz1800.github.io/midrash-rabbah-tracker/",
    tags: ["JavaScript", "HTML", "CSS", "LocalStorage"],
    category: "app",
    year: "2025"
  },
  {
    id: "sipurei-chaim",
    title: "סיפורי חיים",
    desc: "אפליקציה לתיעוד סיפורים אישיים ומשפחתיים. כותב, שומר ומגיש את הסיפורים בצורה יפה — כי כל משפחה ראויה שהסיפורים שלה יישמרו.",
    emoji: "📝",
    image: null,
    link: "https://atz1800.github.io/sipurei-chaim/",
    tags: ["JavaScript", "HTML", "CSS", "LocalStorage"],
    category: "app",
    year: "2025"
  },
  {
    id: "dream-journal",
    title: "יומן חלומות",
    desc: "יומן דיגיטלי לרישום חלומות. מתעד חלומות עם תאריך, תגיות ורגשות, ועוזר לזהות דפוסים חוזרים לאורך זמן.",
    emoji: "🌙",
    image: null,
    link: "https://dream-journal-aa25d.web.app/",
    tags: ["React", "Firebase", "PWA"],
    category: "app",
    year: "2025"
  }
  {
    id: "piaseczner",
    title: "אתר הפיאסצ'נה",
    desc: "אתר מידע ותוכן על האדמו\"ר מפיאסצ'נה, הרב קלונימוס קלמן שפירא הי\"ד. מרכז תורות, סיפורים ומידע על חייו ומורשתו.",
    emoji: "✡️",
    image: null,
    link: "https://piaseczner.vercel.app/",
    tags: ["Vercel", "HTML", "CSS", "JavaScript"],
    category: "web",
    year: "2025"
  },
  {
    id: "giyur-quiz",
    title: "שאלות ותשובות יהדות וגיור",
    desc: "אפליקציית חידונים ללימוד יהדות ולהכנה לגיור. מכסה הלכה, מועדים, תפילה ומסורת — בפורמט שאלה-תשובה נגיש ומהנה.",
    emoji: "🕍",
    image: null,
    link: "https://giyur-quiz.vercel.app/",
    tags: ["React", "Vercel", "JavaScript"],
    category: "app",
    year: "2025"
  },
  {
    id: "hilula-app",
    title: "אפליקציית הילולא",
    desc: "אפליקציה להילולות צדיקים. מציגה את ההילולות לפי תאריך עברי, פרטים על כל צדיק, ומאפשרת ליצור חיבור לימי הזיכרון המשמעותיים.",
    emoji: "🕯️",
    image: null,
    link: "https://hilula-app.web.app/",
    tags: ["React", "Firebase", "PWA"],
    category: "app",
    year: "2025"
  },
  {
    id: "aramaic-game",
    title: "משחק ארמית",
    desc: "משחק אינטראקטיבי ללימוד מילים בארמית. מתאים למי שמתחיל ללמוד גמרא ורוצה לרכוש אוצר מילים בצורה קלה ומהנה.",
    emoji: "🎮",
    image: null,
    link: "https://atz1800.github.io/-aramaic-game-/",
    tags: ["HTML", "CSS", "JavaScript"],
    category: "app",
    year: "2025"
  }
];
