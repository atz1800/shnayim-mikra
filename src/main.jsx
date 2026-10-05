import { useState, useEffect, useRef, Fragment } from 'react'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { HebrewCalendar, HDate, gematriya } from '@hebcal/core'
import { ALIYA_LENGTHS } from './data/aliyaLengths'
import DOMPurify from 'dompurify'
import { initializeApp } from 'firebase/app'
import {
  getAuth, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, onAuthStateChanged, deleteUser, reauthenticateWithPopup
} from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache, persistentSingleTabManager,
  persistentMultipleTabManager, memoryLocalCache,
  doc, setDoc, deleteDoc, onSnapshot, runTransaction
} from 'firebase/firestore'
import './index.css'
import { createRoot } from 'react-dom/client'
import { useBackGuard } from './hooks/useBackGuard'

/* ═══ FIREBASE ═══════════════════════════ */
const cfg = {
  apiKey: 'AIzaSyDo9OAFIWXOBAd5EpAmZGCAN1frh9Atals',
  authDomain: 'shnayim-mikra-app.firebaseapp.com',
  projectId: 'shnayim-mikra-app',
  storageBucket: 'shnayim-mikra-app.firebasestorage.app',
  messagingSenderId: '530516704263',
  appId: '1:530516704263:web:5fac5463497cf5ef12fea2'
}
const app = initializeApp(cfg)
const auth = getAuth(app)
const provider = new GoogleAuthProvider()
let db
try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }) }
catch { try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }) }) } catch { db = initializeFirestore(app, { localCache: memoryLocalCache() }) } }

/* כל ההתקדמות נשמרת כמחרוזת JSON אחת בשדה 'mikra-progress' (פורמט קיים — לא לשנות,
   הגרסה החיה קוראת אותו). כדי שמכשיר אחד לא ידרוס את השני, כל שינוי נשלח כפונקציה
   ומוחל בתוך טרנזקציה על המצב העדכני בענן — לא על העותק המקומי שאולי ישן. */
const PROG_FIELD = 'mikra-progress'
const userDoc = uid => doc(db, 'users', uid)
function parseProg(data) {
  try { const r = data && data[PROG_FIELD]; return r ? JSON.parse(r) : {} } catch { return {} }
}
async function fbMutate(uid, mutate, localNext) {
  try {
    await runTransaction(db, async tx => {
      const snap = await tx.get(userDoc(uid))
      const next = mutate(parseProg(snap.exists() ? snap.data() : null))
      tx.set(userDoc(uid), { [PROG_FIELD]: JSON.stringify(next) }, { merge: true })
    })
  } catch (e) {
    if (e && e.code === 'permission-denied') { console.error(e); return }
    // בלי רשת טרנזקציה נכשלת — כותבים את המצב המקומי, ו-Firestore ישלח כשיחזור חיבור
    // לא מחכים: בלי רשת ה-Promise נפתר רק כשהחיבור חוזר
    setDoc(userDoc(uid), { [PROG_FIELD]: JSON.stringify(localNext) }, { merge: true }).catch(console.error)
  }
}

const localKey = uid => `mikra-prog:${uid}`
function loadLocal(uid) { try { const l = localStorage.getItem(localKey(uid)); return l ? JSON.parse(l) : null } catch { return null } }
function saveLocal(uid, prog) { try { localStorage.setItem(localKey(uid), JSON.stringify(prog)) } catch {} }
function clearLocal(uid) { try { localStorage.removeItem(localKey(uid)); localStorage.removeItem('mikra-prog') } catch {} }
function lsGet(k) { try { return localStorage.getItem(k) } catch { return null } }
function lsSet(k, v) { try { localStorage.setItem(k, v) } catch {} }

/* מחיל עריכה על עותק עמוק ומחזיר אותו — כך אותה פונקציה רצה גם מקומית וגם בטרנזקציה */
const edit = fn => prev => { const n = JSON.parse(JSON.stringify(prev || {})); fn(n); return n }

/* טקסט מספריא מגיע כ-HTML; מסננים לפני הזרקה כדי שתוכן זדוני לא ירוץ אצלנו */
const SAFE_HTML = { ALLOWED_TAGS: ['b', 'i', 'u', 'em', 'strong', 'span', 'br', 'small', 'big', 'sup', 'sub'], ALLOWED_ATTR: ['class', 'dir'] }
const clean = html => (typeof html === 'string' && html ? DOMPurify.sanitize(html, SAFE_HTML) : '')

/* מקלדת: Enter/רווח מפעילים אלמנט עם role="button" */
const onKeyActivate = fn => e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e) } }

/* ═══ DATA ════════════════════════════════ */
const SFARIM = [
  { id: 'bereshit', name: 'בראשית', theme: 'theme-bereshit', letter: 'ב', parshiot: ['בראשית','נח','לך לך','וירא','חיי שרה','תולדות','ויצא','וישלח','וישב','מקץ','ויגש','ויחי'] },
  { id: 'shemot',   name: 'שמות',   theme: 'theme-shemot',   letter: 'ש', parshiot: ['שמות','וארא','בא','בשלח','יתרו','משפטים','תרומה','תצוה','כי תשא','ויקהל','פקודי'] },
  { id: 'vayikra',  name: 'ויקרא',  theme: 'theme-vayikra',  letter: 'ו', parshiot: ['ויקרא','צו','שמיני','תזריע','מצורע','אחרי מות','קדושים','אמור','בהר','בחוקותי'] },
  { id: 'bamidbar', name: 'במדבר',  theme: 'theme-bamidbar', letter: 'נ', parshiot: ['במדבר','נשא','בהעלותך','שלח','קרח','חוקת','בלק','פינחס','מטות','מסעי'] },
  { id: 'devarim',  name: 'דברים',  theme: 'theme-devarim',  letter: 'ד', parshiot: ['דברים','ואתחנן','עקב','ראה','שופטים','כי תצא','כי תבוא','נצבים','וילך','האזינו','וזאת הברכה'] },
]
const ALIYA_LABELS = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שביעי']
const SEFARIA = {
  'בראשית':'Parashat_Bereshit','נח':'Parashat_Noach','לך לך':'Parashat_Lech_Lecha','וירא':'Parashat_Vayera','חיי שרה':'Parashat_Chayei_Sara','תולדות':'Parashat_Toldot','ויצא':'Parashat_Vayetzei','וישלח':'Parashat_Vayishlach','וישב':'Parashat_Vayeshev','מקץ':'Parashat_Miketz','ויגש':'Parashat_Vayigash','ויחי':'Parashat_Vayechi',
  'שמות':'Parashat_Shemot','וארא':'Parashat_Vaera','בא':'Parashat_Bo','בשלח':'Parashat_Beshalach','יתרו':'Parashat_Yitro','משפטים':'Parashat_Mishpatim','תרומה':'Parashat_Terumah','תצוה':'Parashat_Tetzaveh','כי תשא':'Parashat_Ki_Tisa','ויקהל':'Parashat_Vayakhel','פקודי':'Parashat_Pekudei',
  'ויקרא':'Parashat_Vayikra','צו':'Parashat_Tzav','שמיני':'Parashat_Shemini','תזריע':'Parashat_Tazria','מצורע':'Parashat_Metzora','אחרי מות':'Parashat_Achrei_Mot','קדושים':'Parashat_Kedoshim','אמור':'Parashat_Emor','בהר':'Parashat_Behar','בחוקותי':'Parashat_Bechukotai',
  'במדבר':'Parashat_Bamidbar','נשא':'Parashat_Nasso','בהעלותך':"Parashat_Beha'alotcha",'שלח':'Parashat_Shelach','קרח':'Parashat_Korach','חוקת':'Parashat_Chukat','בלק':'Parashat_Balak','פינחס':'Parashat_Pinchas','מטות':'Parashat_Matot','מסעי':'Parashat_Masei',
  'דברים':'Parashat_Devarim','ואתחנן':'Parashat_Vaetchanan','עקב':'Parashat_Eikev','ראה':"Parashat_Re'eh",'שופטים':'Parashat_Shoftim','כי תצא':'Parashat_Ki_Teitzei','כי תבוא':'Parashat_Ki_Tavo','נצבים':'Parashat_Nitzavim','וילך':'Parashat_Vayeilech','האזינו':'Parashat_Haazinu','וזאת הברכה':'Deuteronomy.33.1-34.12',
}
const sefText = n => { const s = SEFARIA[n]; return s ? `https://www.sefaria.org.il/${s}?lang=he&aliyot=1` : null }

const ONKELOS_BOOK = { bereshit: 'Genesis', shemot: 'Exodus', vayikra: 'Leviticus', bamidbar: 'Numbers', devarim: 'Deuteronomy' }
const RASHI_BOOK   = { bereshit: 'Genesis', shemot: 'Exodus', vayikra: 'Leviticus', bamidbar: 'Numbers', devarim: 'Deuteronomy' }

const RING = {
  bereshit: { c1: '#3f6fa6', c2: '#5a86bd', glow: 'rgba(63,111,166,0.5)'   },
  shemot:   { c1: '#c5862e', c2: '#d99a45', glow: 'rgba(197,134,46,0.55)'  },
  vayikra:  { c1: '#3f8a6a', c2: '#57a584', glow: 'rgba(63,138,106,0.5)'   },
  bamidbar: { c1: '#7a68ac', c2: '#9385c0', glow: 'rgba(122,104,172,0.5)'  },
  devarim:  { c1: '#b5524e', c2: '#d99a45', glow: 'rgba(181,82,78,0.5)'   },
}

/* ═══ HELPERS ════════════════════════════ */
function getHebrewYear() { try { return new HDate(new Date()).getFullYear() } catch { return 5786 } }
function yearStr(y) { try { return gematriya(y % 1000) } catch { return String(y) } }

const _EN2HE = {
  'Bereshit':'בראשית','Noach':'נח','Lech-Lecha':'לך לך','Vayera':'וירא',
  'Chayei Sara':'חיי שרה','Toldot':'תולדות','Vayetzei':'ויצא','Vayishlach':'וישלח',
  'Vayeshev':'וישב','Miketz':'מקץ','Vayigash':'ויגש','Vayechi':'ויחי',
  'Shemot':'שמות','Vaera':'וארא','Bo':'בא','Beshalach':'בשלח',
  'Yitro':'יתרו','Mishpatim':'משפטים','Terumah':'תרומה','Tetzaveh':'תצוה',
  'Ki Tisa':'כי תשא','Vayakhel':'ויקהל','Pekudei':'פקודי',
  'Vayikra':'ויקרא','Tzav':'צו','Shemini':'שמיני','Shmini':'שמיני','Tazria':'תזריע',
  'Metzora':'מצורע','Achrei Mot':'אחרי מות','Kedoshim':'קדושים',
  'Emor':'אמור','Behar':'בהר','Bechukotai':'בחוקותי',
  'Bamidbar':'במדבר','Nasso':'נשא',"Beha'alotcha":'בהעלותך',
  "Sh'lach":'שלח','Korach':'קרח','Chukat':'חוקת','Balak':'בלק',
  'Pinchas':'פינחס','Matot':'מטות','Masei':'מסעי',
  'Devarim':'דברים','Vaetchanan':'ואתחנן','Eikev':'עקב',"Re'eh":'ראה',
  'Shoftim':'שופטים','Ki Teitzei':'כי תצא','Ki Tavo':'כי תבוא',
  'Nitzavim':'נצבים','Vayeilech':'וילך',"Ha'azinu":'האזינו',
  'Vezot Haberakhah':'וזאת הברכה'
}

/* לוח הקריאה בארץ ובחו״ל מתפצל בחלק מהשבועות — מזהים לפי אזור הזמן של המכשיר */
const IN_ISRAEL = (() => {
  try { const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; return !tz || tz === 'Asia/Jerusalem' || tz === 'Asia/Tel_Aviv' }
  catch { return true }
})()

/* מחזיר מערך שמות בעברית — שניים בשבוע של פרשיות מחוברות (ויקהל־פקודי וכו׳) — או null */
function detectParasha() {
  try {
    const ev = HebrewCalendar.calendar({ start: new Date(), end: new Date(Date.now() + 21 * 86400000), noHolidays: true, sedrot: true, il: IN_ISRAEL })
    for (const e of ev) {
      const names = (e.parsha || []).map(p => _EN2HE[p]).filter(Boolean)
      if (names.length) return names
    }
  } catch {}
  return null
}

const _HE2EN = Object.fromEntries(Object.entries(_EN2HE).filter(([en]) => en !== 'Shemini').map(([en, he]) => [he, en]))
/* מספר הפסוקים בעלייה (לבורר פסוק העצירה); 50 אם אין מידע */
function aliyaVerseCount(name, num) { return ALIYA_LENGTHS[_HE2EN[name]]?.[num - 1] || 50 }

function toHebNum(n) {
  if (n === 15) return 'טו'; if (n === 16) return 'טז'
  const ones = ['','א','ב','ג','ד','ה','ו','ז','ח','ט'], tens = ['','י','כ','ל','מ','נ','ס','ע','פ','צ']
  let r = '', x = n
  if (x >= 100) { r += ['','ק','ר','ש','ת'][Math.floor(x / 100)]; x %= 100 }
  if (x >= 10)  { r += tens[Math.floor(x / 10)]; x %= 10 }
  if (x > 0)    { r += ones[x] }
  return r
}

function aliyaDone(a)  { if (!a) return 0; return (a.r1 ? 1 : 0) + (a.r2 ? 1 : 0) + (a.tg ? 1 : 0) }
function parshaStats(prog, name) { let d = 0; for (let i = 1; i <= 7; i++) d += aliyaDone((prog[name] || {})[i]); return { done: d, total: 21 } }
function seferStats(prog, sefer) { let d = 0; for (const p of sefer.parshiot) d += parshaStats(prog, p).done; return { done: d, total: sefer.parshiot.length * 21 } }
function globalStats(prog) {
  let r1 = 0, r2 = 0, tg = 0, complete = 0, missing = 0
  for (const s of SFARIM) for (const n of s.parshiot) {
    let all = true
    for (let i = 1; i <= 7; i++) { const a = (prog[n] || {})[i] || {}; if (a.r1) r1++; if (a.r2) r2++; if (a.tg) tg++; if (!a.r1 || !a.r2 || !a.tg) all = false }
    if (all) complete++; else missing++
  }
  return { r1, r2, tg, complete, missing }
}

/* ═══ SEFARIA HELPERS ════════════════════ */
function normalizeChaps(raw) {
  if (!Array.isArray(raw) || !raw.length) return []
  return (!Array.isArray(raw[0])) ? [raw] : raw
}
function buildVerseList(heData, tgData, rsData) {
  const verses = []
  const startChap = (heData.sections && heData.sections[0]) || 1
  const heRaw = (heData.he && heData.he.length) ? heData.he : (heData.text || [])
  const heChaps = normalizeChaps(heRaw)
  const tgChaps = tgData ? normalizeChaps(tgData.he || []) : []
  const tgStart = tgData ? ((tgData.sections && tgData.sections[0]) || 1) : startChap
  const rsChaps = rsData ? normalizeChaps(rsData.he || []) : []
  const rsStart = rsData ? ((rsData.sections && rsData.sections[0]) || 1) : startChap
  heChaps.forEach((chapArr, ci) => {
    if (!Array.isArray(chapArr)) return
    const chapNum = startChap + ci
    const tgChap = tgChaps[chapNum - tgStart] || []
    const rsChap = rsChaps[chapNum - rsStart] || []
    chapArr.forEach((heText, vi) => {
      if (!heText) return
      const rs = Array.isArray(rsChap) ? (rsChap[vi] || '') : ''
      verses.push({ chap: chapNum, verse: vi + 1, key: `${chapNum}:${vi + 1}`, he: clean(heText), tg: clean(Array.isArray(tgChap) ? tgChap[vi] : ''), rs: clean(Array.isArray(rs) ? rs.join(' ') : rs) })
    })
  })
  return verses
}
function buildOnkelosRef(mainRef, seferId) {
  const book = ONKELOS_BOOK[seferId]; if (!book || !mainRef) return null
  const noBook = mainRef.replace(book + ' ', '').replace(/:/g, '.').replace(/-/g, '-')
  return `Onkelos_${book}.${noBook}`
}
function buildRashiRef(mainRef, seferId) {
  const book = RASHI_BOOK[seferId]; if (!book || !mainRef) return null
  const noBook = mainRef.replace(book + ' ', '').replace(/:/g, '.').replace(/-/g, '-')
  return `Rashi_on_${book}.${noBook}`
}

/* ═══ ONBOARDING ════════════════════════ */
const ONBOARD_STEPS = [
  { badge: '1',    bg: 'linear-gradient(135deg,#3f6fa6,#5a86bd)', label: 'קריאה ראשונה',  desc: 'לחץ כדי לסמן שקראת את העלייה פעם ראשונה' },
  { badge: '2',    bg: 'linear-gradient(135deg,#7a68ac,#9385c0)', label: 'קריאה שנייה',   desc: 'לחץ שוב לסמן קריאה שנייה — שניים מקרא' },
  { badge: 'תרג׳', bg: 'linear-gradient(135deg,#c5862e,#d99a45)', label: 'תרגום אונקלוס', desc: 'לחץ לאחר שקראת את התרגום — ואחד תרגום' },
  { badge: '📍',   bg: 'linear-gradient(135deg,#3f8a6a,#57a584)', label: 'סמנייה חכמה',   desc: 'סמן היכן עצרת — האפליקציה תחזיר אותך בדיוק לשם' },
  { badge: '📖',   bg: 'linear-gradient(135deg,#b5524e,#d99a45)', label: 'מצב קריאה',     desc: 'לחץ "קריאה" לפתוח טקסט מלא עם אונקלוס ורש"י' },
]
function OnboardingTooltip({ onDone }) {
  return (
    <motion.div className="onboard-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
      <motion.div className="onboard-box" initial={{ opacity: 0, y: 40, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 28, delay: 0.08 }}>
        <div className="onboard-title">ברוך הבא לשמו״ת 👋</div>
        <div className="onboard-sub">כך עובד לוח הסימון — שניה ואתה מבין הכל</div>
        <div className="onboard-rows">
          {ONBOARD_STEPS.map((s, i) => (
            <motion.div key={i} className="onboard-row" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 + i * 0.09, type: 'spring', stiffness: 380, damping: 30 }}>
              <div className="onboard-badge" style={{ background: s.bg }}>{s.badge}</div>
              <div className="onboard-info">
                <div className="onboard-label">{s.label}</div>
                <div className="onboard-desc">{s.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
        <motion.button className="onboard-btn" onClick={onDone} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }} whileTap={{ scale: 0.97 }}>
          הבנתי — בואו נתחיל ✓
        </motion.button>
      </motion.div>
    </motion.div>
  )
}

/* ═══ BIG DONUT RING ════════════════════ */
function BigRing({ sefer, pct, size = 90 }) {
  const R = size * 0.38, cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * R
  const offset = circ * (1 - pct / 100)
  const m = RING[sefer.id] || RING.bereshit
  const isComplete = pct === 100
  const gid = `bg-${sefer.id}`
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible', flexShrink: 0 }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2={size} y2={size} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={isComplete ? '#f6d365' : m.c1} />
          <stop offset="100%" stopColor={isComplete ? '#fda085' : m.c2} />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={size * 0.065} />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={`url(#${gid})`} strokeWidth={size * 0.072} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform={`rotate(-90 ${cx} ${cy})`}
        style={{ filter: `drop-shadow(0 0 ${isComplete ? 8 : 5}px ${isComplete ? 'rgba(246,211,101,0.8)' : m.glow})`, transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)' }} />
      {isComplete
        ? <text x={cx} y={cy + 6} textAnchor="middle" fontSize={size * 0.22} fontWeight="900" fill="#c6891a" style={{ filter: 'drop-shadow(0 0 6px rgba(246,211,101,0.9))' }}>✓</text>
        : pct > 0
          ? <text x={cx} y={cy + 5} textAnchor="middle" fontSize={size * 0.175} fontWeight="700" fill={m.c1} fontFamily="Heebo,sans-serif">{pct}%</text>
          : <text x={cx} y={cy + 7} textAnchor="middle" fontSize={size * 0.26} fontWeight="900" fill="rgba(0,0,0,0.18)" fontFamily="Frank Ruhl Libre,serif">{sefer.letter}</text>
      }
    </svg>
  )
}

/* ═══ CONCEPT CARD ══════════════════════ */
function ConceptCard() {
  return (
    <motion.div className="concept-card" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 340, damping: 30, delay: 0.1 }}>
      <div className="concept-title">לוח סימונים ייחודי יאפשר לנו לא לשכוח לעולם איפה עצרנו</div>
      <div className="concept-row">
        <div className="concept-step">
          <div className="concept-btn c1">1</div>
          <div className="concept-lbl">מקרא א׳</div>
        </div>
        <div className="concept-plus">+</div>
        <div className="concept-step">
          <div className="concept-btn c2">2</div>
          <div className="concept-lbl">מקרא ב׳</div>
        </div>
        <div className="concept-plus">+</div>
        <div className="concept-step">
          <div className="concept-btn ct">תרג׳</div>
          <div className="concept-lbl">אונקלוס</div>
        </div>
        <div className="concept-eq">=</div>
        <div className="concept-result">עלייה<br />שלמה ✓</div>
      </div>
      <div className="concept-sub">7 עליות × 54 פרשיות — מעקב מדויק לאורך כל השנה</div>
    </motion.div>
  )
}

/* ═══ QUICK CARDS ═══════════════════════ */
const resumeKey = p => (p && (p.readingStop || p.lastPos)) || null
function WeekCard({ parshiot, onOpen }) {
  const sefer = SFARIM.find(s => s.parshiot.includes(parshiot[0]))
  if (!sefer) return null
  const anim = { initial: { opacity: 0, y: -12 }, animate: { opacity: 1, y: 0 }, transition: { type: 'spring', stiffness: 360, damping: 30 } }
  if (parshiot.length > 1) {
    // פרשיות מחוברות — כל אחת נפתחת בנפרד
    return (
      <motion.div className={`week-card ${sefer.theme}`} style={{ cursor: 'default' }} {...anim}>
        <div className="qc-icon" aria-hidden="true">📅</div>
        <div className="qc-info">
          <div className="qc-label">פרשת השבוע</div>
          <div className="qc-main">{parshiot.join('־')}</div>
          <div className="qc-chips">
            {parshiot.map(p => <button key={p} className="qc-chip" onClick={() => onOpen(p, sefer.id, sefer.theme, true)}>📖 {p}</button>)}
          </div>
        </div>
      </motion.div>
    )
  }
  const open = () => onOpen(parshiot[0], sefer.id, sefer.theme, true)
  return (
    <motion.div className={`week-card ${sefer.theme}`} role="button" tabIndex={0} onClick={open} onKeyDown={onKeyActivate(open)} whileTap={{ scale: 0.97 }} {...anim}>
      <div className="qc-icon" aria-hidden="true">📅</div>
      <div className="qc-info">
        <div className="qc-label">פרשת השבוע</div>
        <div className="qc-main">{parshiot[0]}</div>
      </div>
      <div className="qc-arrow" aria-hidden="true">‹</div>
    </motion.div>
  )
}
function ResumeCard({ parasha, prog, onOpen }) {
  const sk = resumeKey(prog[parasha])
  if (!sk) return null
  const sefer = SFARIM.find(s => s.parshiot.includes(parasha))
  if (!sefer) return null
  const [c, v] = sk.split(':').map(Number)
  const open = () => onOpen(parasha, sefer.id, sefer.theme)
  return (
    <motion.div className={`resume-card ${sefer.theme}`} role="button" tabIndex={0} onClick={open} onKeyDown={onKeyActivate(open)} whileTap={{ scale: 0.97 }} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 360, damping: 30 }}>
      <div className="qc-icon" aria-hidden="true">🔖</div>
      <div className="qc-info">
        <div className="qc-label">ממשיכים מ...</div>
        <div className="qc-main">פרק {toHebNum(c)}, פסוק {toHebNum(v)}</div>
        <div className="qc-sub">פרשת {parasha}</div>
      </div>
      <div className="qc-arrow" aria-hidden="true">‹</div>
    </motion.div>
  )
}

/* ═══ SEFER CARD ════════════════════════ */
function SeferCard({ sefer, prog, isSelected, onClick, isLast }) {
  const { done, total } = seferStats(prog, sefer)
  const pct = Math.round(done / total * 100)
  const remaining = sefer.parshiot.length - sefer.parshiot.filter(n => parshaStats(prog, n).done === 21).length
  return (
    <motion.div className={`sc-card ${sefer.theme}${isSelected ? ' selected' : ''}${isLast ? ' last-card' : ''}`} role="button" tabIndex={0} aria-label={`ספר ${sefer.name}, ${pct}% הושלמו`} onClick={onClick} onKeyDown={onKeyActivate(onClick)} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
      <div className="sc-name">{sefer.name}</div>
      <BigRing sefer={sefer} pct={pct} size={isLast ? 80 : 86} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.3rem' }}>
        <span className="sc-pct-label">{pct}%</span>
        <span className="sc-sub">{remaining > 0 ? `${remaining} פרשיות נותרו` : 'הושלם! ✓'}</span>
      </div>
    </motion.div>
  )
}

/* ═══ PARASHA CARD ═══════════════════════ */
function ParshaCard({ name, theme, prog, isCurrent, onOpen, onOpenSheet }) {
  const { done, total } = parshaStats(prog, name)
  const pct = Math.round(done / total * 100)
  const isComplete = done === total, hasProg = done > 0
  return (
    <motion.div className={`p-card ${theme}${isComplete ? ' is-complete' : ''}${hasProg ? ' has-prog' : ''}`} role="button" tabIndex={0} aria-label={`פרשת ${name}, ${pct}% — פתח לוח סימון`} onClick={onOpenSheet} onKeyDown={e => { if (e.target === e.currentTarget) onKeyActivate(onOpenSheet)(e) }} whileHover={{ y: -3, boxShadow: '0 6px 20px rgba(0,0,0,0.1)' }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}>
      {isCurrent && <div className="now-chip">השבוע</div>}
      {(prog[name] || {}).readingStop && <div className="p-bookmark" aria-hidden="true">🔖</div>}
      <div className="p-name">{name}</div>
      <div className="p-dots" aria-hidden="true">
        {[1,2,3,4,5,6,7].map(i => { const d = aliyaDone((prog[name] || {})[i]); return <div key={i} className={`p-dot d${d}`} /> })}
      </div>
      <div className="p-prog" style={{ marginBottom: '.45rem' }} aria-hidden="true">
        <div className="p-prog-fill" style={{ width: `${pct}%`, background: isComplete ? 'linear-gradient(90deg,#f6d365,#fda085)' : 'var(--sg)', boxShadow: isComplete ? '0 0 8px rgba(246,211,101,0.6)' : '0 0 6px var(--sglow)' }} />
      </div>
      <div className="p-footer">
        <button className="p-sheet-btn" aria-label={`קריאת פרשת ${name}`} onClick={e => { e.stopPropagation(); onOpen() }}>📖 קריאה</button>
      </div>
    </motion.div>
  )
}

/* ═══ PARSHOT VIEW ═══════════════════════ */
function ParshotView({ sefer, prog, currentParshiot, filterMissing, onOpen, onOpenSheet, onBack }) {
  const { done, total } = seferStats(prog, sefer)
  const pct = Math.round(done / total * 100)
  const visible = filterMissing ? sefer.parshiot.filter(n => parshaStats(prog, n).done < 21) : sefer.parshiot
  return (
    <motion.div className={sefer.theme} initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }} style={{ maxWidth: 700, margin: '0 auto', padding: '0 1rem 5rem' }}>
      <div className="psv-header">
        <motion.button className="psv-back-btn" onClick={onBack} whileTap={{ scale: 0.93 }}>‹ חזרה</motion.button>
        <BigRing sefer={sefer} pct={pct} size={52} />
        <div className="psv-info">
          <h1 className="psv-name">{sefer.name}</h1>
          <div className="psv-sub">{done}/{total} · {pct}% · {sefer.parshiot.length} פרשיות</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(145px,1fr))', gap: '.6rem' }}>
        {visible.map(name => (
          <ParshaCard key={name} name={name} theme={sefer.theme} prog={prog} isCurrent={!!currentParshiot && currentParshiot.includes(name)}
            onOpen={() => onOpen(name, sefer.theme, sefer.id)}
            onOpenSheet={() => onOpenSheet(name, sefer.theme, sefer.id)} />
        ))}
      </div>
    </motion.div>
  )
}

/* ═══ ALIYA ROW ══════════════════════════ */
function AliyaRow({ name, num, label, a, onToggle, onStop }) {
  const [showPicker, setShowPicker] = useState(false)
  const lvl = aliyaDone(a)
  const VERSES = Array.from({ length: aliyaVerseCount(name, num) }, (_, i) => i + 1)
  function pickVerse(v) { onStop(name, num, toHebNum(v)); setShowPicker(false) }
  function clearStop(e) { e.stopPropagation(); onStop(name, num, ''); setShowPicker(false) }
  return (
    <div>
      <div className="aliya-row">
        <div className="aliya-idx" aria-hidden="true">{num}</div>
        <span className="aliya-name">{label}</span>
        <div className="aliya-actions">
          <motion.button className={`act-btn r1 ${a.r1 ? 'on' : 'off'}`} aria-pressed={!!a.r1} aria-label={`עליית ${label} — קריאה ראשונה`} whileTap={{ scale: 0.87 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }} onClick={() => onToggle(name, num, 'r1')}>1</motion.button>
          <motion.button className={`act-btn r2 ${a.r2 ? 'on' : 'off'}`} aria-pressed={!!a.r2} aria-label={`עליית ${label} — קריאה שנייה`} whileTap={{ scale: 0.87 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }} onClick={() => onToggle(name, num, 'r2')}>2</motion.button>
          <motion.button className={`act-btn tg ${a.tg ? 'on' : 'off'}`} aria-pressed={!!a.tg} aria-label={`עליית ${label} — תרגום`} whileTap={{ scale: 0.87 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }} onClick={() => onToggle(name, num, 'tg')}>תרג׳</motion.button>
        </div>
        <div className="stop-wrap">
          <motion.button className={`btn-stop${a.stop ? ' has-val' : ''}`} whileTap={{ scale: 0.9 }} onClick={() => setShowPicker(v => !v)} title="סמן פסוק עצירה" aria-label={a.stop ? `פסוק עצירה ${a.stop} — שנה` : `סמן פסוק עצירה בעליית ${label}`} aria-expanded={showPicker}>
            {a.stop ? `פס׳ ${a.stop}` : '📍'}
          </motion.button>
          {a.stop && <button className="btn-stop-clear" onClick={clearStop} aria-label="נקה פסוק עצירה">×</button>}
        </div>
        {lvl === 3 && <span className="aliya-check" aria-label="הושלם">✓</span>}
      </div>
      <AnimatePresence>
        {showPicker && (
          <motion.div className="verse-picker-wrap" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
            <div className="verse-picker">
              {VERSES.map(v => (
                <motion.button key={v} className={`vchip${a.stop === toHebNum(v) ? ' sel' : ''}`} aria-label={`פסוק ${toHebNum(v)}`} whileTap={{ scale: 0.85 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }} onClick={() => pickVerse(v)}>{toHebNum(v)}</motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ═══ BOTTOM SHEET ═══════════════════════ */
function BottomSheet({ name, seferId, theme, prog, onClose, onToggle, onBulk, onStop, onOpenRead }) {
  const aliyaData = prog[name] || {}
  const { done, total } = parshaStats(prog, name)
  const pct = Math.round(done / total * 100)
  function clearAll() { if (confirm(`לנקות את כל הסימונים בפרשת ${name}?`)) onBulk(name, null, false) }
  return (
    <motion.div className="bs-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div className={`bs-sheet ${theme}`} role="dialog" aria-modal="true" aria-label={`לוח סימון — פרשת ${name}`} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
        <div className="bs-handle" aria-hidden="true" />
        <div className="bs-head">
          <div style={{ flex: 1 }}><h2 className="bs-title">{name}</h2></div>
          <div className="bs-prog">
            <span className="bs-prog-n" style={{ color: pct === 100 ? '#c6891a' : 'var(--sc)' }}>{pct}%</span>
            <span className="bs-prog-l">{done}/{total}</span>
          </div>
          <div className="bs-links">
            {sefText(name) && <a className="btn-link text" href={sefText(name)} target="_blank" rel="noopener">ספריא ↗</a>}
          </div>
          <button className="btn-close" onClick={onClose} aria-label="סגירה">✕</button>
        </div>
        <div className="bs-bulk">
          <motion.button className="bulk-btn b1" whileTap={{ scale: 0.93 }} onClick={() => onBulk(name, 'r1', true)}>✓ כל 1</motion.button>
          <motion.button className="bulk-btn b2" whileTap={{ scale: 0.93 }} onClick={() => onBulk(name, 'r2', true)}>✓ כל 2</motion.button>
          <motion.button className="bulk-btn bt" whileTap={{ scale: 0.93 }} onClick={() => onBulk(name, 'tg', true)}>✓ כל תרגום</motion.button>
          <motion.button className="bulk-btn bx" whileTap={{ scale: 0.93 }} onClick={clearAll}>× נקה</motion.button>
        </div>
        <div style={{ padding: '.45rem 1.1rem .2rem', display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <motion.button className="btn-read-small" onClick={() => onOpenRead(name, seferId, theme, true)} whileTap={{ scale: 0.97 }}>📖 קריאה</motion.button>
          {(() => {
            const sk = resumeKey(prog[name])
            if (!sk) return null
            const [c, v] = sk.split(':').map(Number)
            return <motion.button className="btn-resume-small" onClick={() => onOpenRead(name, seferId, theme)} whileTap={{ scale: 0.97 }}>🔖 פרק {toHebNum(c)}, פסוק {toHebNum(v)}</motion.button>
          })()}
        </div>
        <div className="bs-body">
          {ALIYA_LABELS.map((label, idx) => {
            const num = idx + 1; const a = aliyaData[num] || {}
            return <AliyaRow key={num} name={name} num={num} label={label} a={a} onToggle={onToggle} onStop={onStop} />
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ═══ STATS STRIP ════════════════════════ */
function StatsStrip({ prog }) {
  const s = globalStats(prog)
  const pct = Math.round((s.r1 + s.r2 + s.tg) / (54 * 21) * 100)
  return (
    <div className="stats-strip">
      <div className="stat"><span className="stat-n" style={{ background: 'linear-gradient(135deg,#3f6fa6,#5a86bd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{s.r1}</span><span className="stat-l">קריאה א׳</span></div>
      <div className="stat-div" />
      <div className="stat"><span className="stat-n" style={{ background: 'linear-gradient(135deg,#7a68ac,#9385c0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{s.r2}</span><span className="stat-l">קריאה ב׳</span></div>
      <div className="stat-div" />
      <div className="stat"><span className="stat-n" style={{ background: 'linear-gradient(135deg,#c5862e,#d99a45)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{s.tg}</span><span className="stat-l">תרגום</span></div>
      <div className="stat-div" />
      <div className="stat"><span className="stat-n" style={{ background: 'linear-gradient(135deg,#3f8a6a,#57a584)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{s.complete}</span><span className="stat-l">שלמות</span></div>
      <div className="stat-div" />
      <div className="stat-bar-wrap">
        <div className="stat-bar-track"><div className="stat-bar-fill" style={{ width: `${pct}%` }} /></div>
        <div className="stat-bar-label">{pct}% מהשנה</div>
      </div>
    </div>
  )
}

/* ═══ VERSE BLOCK ════════════════════════ */
function VerseBlock({ v, mode, fontSize, isStop, onPin, extTrans, transLang }) {
  const extT = transLang ? (extTrans?.[v.key] || null) : null
  const tgText = transLang ? extT : (v.tg || null)
  const tgLabel = transLang ? transLang.toUpperCase() : 'תרג׳'
  const tgStyle = { fontSize: fontSize * 0.92, ...(transLang ? { direction: 'ltr', textAlign: 'left' } : {}) }
  const tgCls = `rv-tg${transLang ? ' rv-extrans' : ''}`
  return (
    <div className={`rv-verse${isStop ? ' is-stop' : ''}`} id={`rv-${v.key}`}>
      <div className="rv-vnum">
        <span>{isStop && <span className="rv-stop-chip">עצרתי כאן</span>}{toHebNum(v.chap)}:{toHebNum(v.verse)}</span>
        <button className={`rv-pin${isStop ? ' on' : ''}`} onClick={onPin} title="סמן עצירה" aria-label={isStop ? 'הסר סמנייה' : 'סמן עצירה כאן'} aria-pressed={isStop}>📍</button>
      </div>
      {mode === 'shnayim' ? (
        <>
          <span className="rv-read-label">א׳</span>
          <div className="rv-he" style={{ fontSize }} dangerouslySetInnerHTML={{ __html: v.he }} />
          <span className="rv-read-label b">ב׳</span>
          <div className="rv-he rv-he-second" style={{ fontSize }} dangerouslySetInnerHTML={{ __html: v.he }} />
          {tgText && <><span className="rv-read-label tg">{tgLabel}</span><div className={tgCls} style={tgStyle} dangerouslySetInnerHTML={{ __html: tgText }} /></>}
        </>
      ) : mode === 'rashi' ? (
        <>
          <div className="rv-he" style={{ fontSize, marginBottom: v.rs ? '.6rem' : 0 }} dangerouslySetInnerHTML={{ __html: v.he }} />
          {v.rs && <div className="rv-rs" style={{ fontSize: fontSize * 0.88 }} dangerouslySetInnerHTML={{ __html: v.rs }} />}
        </>
      ) : (
        <>
          <div className="rv-he" style={{ fontSize }} dangerouslySetInnerHTML={{ __html: v.he }} />
          {tgText && <div className={tgCls} style={tgStyle} dangerouslySetInnerHTML={{ __html: tgText }} />}
        </>
      )}
    </div>
  )
}

/* ═══ READING VIEW ═══════════════════════ */
function ReadingView({ name, seferId, theme, prog, onClose, onUpdateStop, onUpdateLastPos, onBulkMark, skipStop, onAddChiddush, onDeleteChiddush }) {
  const [mode, setMode] = useState('shnayim')
  const [fontSize, setFontSize] = useState(() => { const n = parseInt(lsGet('shmot-fontsize'), 10); return n >= 14 && n <= 28 ? n : 18 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [verses, setVerses] = useState([])
  const [rashiLoading, setRashiLoading] = useState(false)
  const rashiLoadedRef = useRef(false)
  const [transLang, setTransLang] = useState(null)
  const [extTrans, setExtTrans] = useState({})
  const [transLoading, setTransLoading] = useState(false)
  const [aliyahStarts, setAliyahStarts] = useState([])
  const [showChapNav, setShowChapNav] = useState(false)
  const [autoScroll, setAutoScroll] = useState(false)
  const [scrollSpeed, setScrollSpeed] = useState('slow')
  const [showChidInput, setShowChidInput] = useState(false)
  const [chidText, setChidText] = useState('')
  const chidRef = useRef(null)
  const bodyRef = useRef(null)
  const timerRef = useRef(null)
  const posRef = useRef(null)
  const stopKey = (prog[name] || {}).readingStop || null   // סמנייה ידנית (📍)
  const resumeAt = resumeKey(prog[name])                     // סמנייה ידנית, ואם אין — המקום האחרון
  // המקום האחרון נשמר בכל יציאה (כפתור, מחוות חזור, מעבר לרקע) — בלי לגעת בסמנייה הידנית
  const lastPosCb = useRef(onUpdateLastPos)
  lastPosCb.current = onUpdateLastPos
  const savePos = () => { if (posRef.current) lastPosCb.current(name, posRef.current) }

  useEffect(() => { rashiLoadedRef.current = false; load() }, [name])

  useEffect(() => {
    if (mode !== 'rashi' || rashiLoadedRef.current || loading || !verses.length) return
    rashiLoadedRef.current = true
    setRashiLoading(true);
    (async () => {
      try {
        const heRef = verses[0].chap === verses[verses.length - 1].chap
          ? `${ONKELOS_BOOK[seferId]} ${verses[0].chap}:${verses[0].verse}-${verses[verses.length - 1].verse}`
          : `${ONKELOS_BOOK[seferId]} ${verses[0].chap}:${verses[0].verse}-${verses[verses.length - 1].chap}:${verses[verses.length - 1].verse}`
        const rsRef = buildRashiRef(heRef, seferId)
        if (!rsRef) { setRashiLoading(false); return }
        const res = await fetch(`https://www.sefaria.org/api/texts/${rsRef}?lang=he`)
        if (!res.ok) { setRashiLoading(false); return }
        const rsData = await res.json()
        const rsChaps = normalizeChaps(rsData.he || [])
        const rsStart = (rsData.sections && rsData.sections[0]) || verses[0].chap
        setVerses(prev => prev.map(v => {
          const rsChap = rsChaps[v.chap - rsStart] || []
          const raw = Array.isArray(rsChap) ? rsChap[v.verse - 1] : ''
          const rs = clean(Array.isArray(raw) ? raw.join(' ') : (raw || ''))
          return { ...v, rs }
        }))
      } catch {} finally { setRashiLoading(false) }
    })()
  }, [mode, loading, verses.length])

  useEffect(() => {
    if (resumeAt && !loading && !skipStop) {
      const el = document.getElementById(`rv-${resumeAt}`)
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350)
    }
  }, [loading])

  useEffect(() => {
    const cont = bodyRef.current
    if (!cont || !verses.length) return
    function onScroll() {
      const contTop = cont.getBoundingClientRect().top
      for (const v of verses) {
        const el = document.getElementById(`rv-${v.key}`)
        if (!el) continue
        if (el.getBoundingClientRect().top - contTop > -40) { posRef.current = v.key; break }
      }
    }
    cont.addEventListener('scroll', onScroll, { passive: true })
    return () => cont.removeEventListener('scroll', onScroll)
  }, [verses])

  useEffect(() => {
    function onHide() { if (document.hidden) savePos() }
    document.addEventListener('visibilitychange', onHide)
    return () => { document.removeEventListener('visibilitychange', onHide); savePos() }
  }, [name])

  useEffect(() => {
    clearInterval(timerRef.current)
    if (!autoScroll) return
    const ms = { slow: 80, medium: 35, fast: 15 }[scrollSpeed]
    timerRef.current = setInterval(() => bodyRef.current?.scrollBy({ top: 1 }), ms)
    return () => clearInterval(timerRef.current)
  }, [autoScroll, scrollSpeed])

  useEffect(() => {
    if (!transLang) { setExtTrans({}); return }
    if (!verses.length) return
    const ref = SEFARIA[name]; if (!ref) return
    setTransLoading(true)
    const TRANS_VEN = {
      en: '',
      ru: 'Russian Torah translation, by Dmitri Slivniak, Ph.D., edited by Dr. Itzhak Streshinsky. Da Project, 2011 [ru]',
      es: 'Sefaria Community Translation [es]',
      fr: 'Bible du Rabbinat 1899 [fr]',
    }
    const ven = TRANS_VEN[transLang]
    const url = `https://www.sefaria.org/api/texts/${ref}?lang=en&aliyot=0${ven ? '&ven=' + encodeURIComponent(ven) : ''}`
    fetch(url).then(r => r.json()).then(data => {
      const chaps = normalizeChaps(data.text || [])
      const startChap = verses[0]?.chap || 1
      const map = {}
      chaps.forEach((ch, ci) => {
        const cNum = startChap + ci
        ;(Array.isArray(ch) ? ch : [ch]).forEach((txt, vi) => { if (typeof txt === 'string') map[`${cNum}:${vi + 1}`] = clean(txt.replace(/<[^>]*>/g, '')) })
      })
      setExtTrans(map)
    }).catch(() => setExtTrans({})).finally(() => setTransLoading(false))
  }, [transLang, name, verses.length])

  async function load() {
    setLoading(true); setError(null); setVerses([]); setAliyahStarts([])
    try {
      const ref = SEFARIA[name]
      if (!ref) throw new Error('לא נמצא מיפוי לפרשה זו')
      const heRes = await fetch(`https://www.sefaria.org/api/texts/${ref}?aliyot=1`)
      if (!heRes.ok) throw new Error('שגיאת רשת מספריא')
      const heData = await heRes.json()
      let tgData = null
      try {
        const tgRef = buildOnkelosRef(heData.ref, seferId)
        if (tgRef) { const r = await fetch(`https://www.sefaria.org/api/texts/${tgRef}?lang=he`); if (r.ok) tgData = await r.json() }
      } catch {}
      const list = buildVerseList(heData, tgData, null)
      if (!list.length) throw new Error('לא התקבל טקסט')
      setVerses(list)
      try {
        const alts = heData.alts
        const startChap = (heData.sections && heData.sections[0]) || 1
        if (Array.isArray(alts) && alts.length > 0) {
          const starts = []
          alts.forEach((chapArr, ci) => {
            if (!Array.isArray(chapArr)) return
            chapArr.forEach((entry, vi) => {
              if (entry !== null && entry !== undefined && typeof entry === 'object' && (entry.he || entry.en)) {
                starts.push({ num: starts.length + 1, key: `${startChap + ci}:${vi + 1}` })
              }
            })
          })
          if (starts.length > 0) setAliyahStarts(starts)
        }
      } catch {}
    } catch (e) {
      setError(e.message || 'שגיאה בטעינה')
    } finally {
      setLoading(false)
    }
  }

  function togglePin(key) { onUpdateStop(name, stopKey === key ? '' : key) }
  function jumpToStop() { const el = document.getElementById(`rv-${resumeAt}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
  function handleClose() { onClose() }   // המיקום נשמר ב-cleanup של ה-effect למעלה

  return (
    <motion.div className={`rv-overlay ${theme}`} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
      <div className="rv-header">
        <motion.button className="rv-back" onClick={handleClose} whileTap={{ scale: 0.93 }}>‹ חזרה</motion.button>
        <div className="rv-head-title">{name}</div>
        {resumeAt && <motion.button className="rv-bm-btn" onClick={jumpToStop} whileTap={{ scale: 0.93 }} aria-label={stopKey ? 'קפוץ לסמנייה' : 'קפוץ למקום האחרון'}>🔖 קפוץ</motion.button>}
        <motion.button className={`rv-ascroll${autoScroll ? ' on' : ''}`} onClick={() => setAutoScroll(v => !v)} whileTap={{ scale: 0.93 }} aria-pressed={autoScroll}>
          {autoScroll ? '⏸ עצור' : '▶ גלילה'}
        </motion.button>
      </div>
      <div className="rv-ctrl">
        <motion.button className={`rv-mode${mode === 'shnayim' ? ' on' : ''}`} aria-pressed={mode === 'shnayim'} onClick={() => setMode('shnayim')} whileTap={{ scale: 0.93 }}>שניים ואחד</motion.button>
        <motion.button className={`rv-mode${mode === 'paired' ? ' on' : ''}`} aria-pressed={mode === 'paired'} onClick={() => setMode('paired')} whileTap={{ scale: 0.93 }}>פסוק ותרגום</motion.button>
        <motion.button className={`rv-mode${mode === 'continuous' ? ' on' : ''}`} aria-pressed={mode === 'continuous'} onClick={() => setMode('continuous')} whileTap={{ scale: 0.93 }}>רצוף</motion.button>
        <motion.button className={`rv-mode${mode === 'rashi' ? ' on' : ''}`} aria-pressed={mode === 'rashi'} onClick={() => setMode('rashi')} whileTap={{ scale: 0.93 }}>רש״י</motion.button>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem', flexShrink: 0 }}>
          <span style={{ fontSize: '.58rem', color: 'var(--text3)', fontWeight: 700 }}>גודל</span>
          <button className="rv-fbtn" aria-label="הקטנת גופן" onClick={() => setFontSize(s => { const n = Math.max(14, s - 2); lsSet('shmot-fontsize', n); return n })}>−</button>
          <span className="rv-flbl" aria-live="polite">{fontSize}</span>
          <button className="rv-fbtn" aria-label="הגדלת גופן" onClick={() => setFontSize(s => { const n = Math.min(28, s + 2); lsSet('shmot-fontsize', n); return n })}>+</button>
        </div>
        <select aria-label="שפת התרגום" className={`rv-lang-sel${transLang ? ' active' : ''}`} value={transLang || ''} onChange={e => { setTransLang(e.target.value || null); setExtTrans({}) }}>
          <option value="">תרג׳</option>
          <option value="en">EN</option>
          <option value="ru">RU</option>
          <option value="es">ES*</option>
          <option value="fr">FR</option>
        </select>
        {transLoading && <span style={{ fontSize: '.6rem', color: 'var(--text3)' }}>…</span>}
      </div>
      {autoScroll && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem', padding: '.3rem 1rem', background: 'rgba(247,243,236,0.7)', borderBottom: '1px solid rgba(0,0,0,0.04)', flexShrink: 0 }}>
          <span style={{ fontSize: '.6rem', color: 'var(--text3)', fontWeight: 700 }}>מהירות:</span>
          {['slow', 'medium', 'fast'].map(s => (
            <button key={s} className={`rv-speed-btn${scrollSpeed === s ? ' on' : ''}`} aria-pressed={scrollSpeed === s} aria-label={{ slow: 'איטי', medium: 'בינוני', fast: 'מהיר' }[s]} onClick={() => setScrollSpeed(s)}>
              {s === 'slow' ? '🐢' : s === 'medium' ? '🚶' : '🏃'}
            </button>
          ))}
        </div>
      )}
      {(() => {
        const chaps = [...new Set(verses.map(v => v.chap))]
        function jumpChap(ch) {
          const first = verses.find(v => v.chap === ch)
          if (!first) return
          const el = document.getElementById(`rv-${first.key}`)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        if (aliyahStarts.length > 0) {
          return (
            <>
              <div className="rv-aliyah-nav">
                {aliyahStarts.map(a => (
                  <button key={a.num} className="rv-aliyah-nav-btn" onClick={() => {
                    const el = document.getElementById(`rv-${a.key}`)
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}>{ALIYA_LABELS[a.num - 1]}</button>
                ))}
                {chaps.length > 1 && (
                  <button className="rv-aliyah-nav-chap" onClick={() => setShowChapNav(v => !v)}>
                    {showChapNav ? '✕' : '📑 פרקים'}
                  </button>
                )}
              </div>
              {showChapNav && chaps.length > 1 && (
                <div className="rv-chap-nav">
                  {chaps.map(ch => (
                    <button key={ch} className="rv-chap-btn" onClick={() => { jumpChap(ch); setShowChapNav(false) }}>
                      פרק {toHebNum(ch)}
                    </button>
                  ))}
                </div>
              )}
            </>
          )
        }
        if (chaps.length < 2) return null
        return (
          <div className="rv-chap-nav">
            {chaps.map(ch => <button key={ch} className="rv-chap-btn" onClick={() => jumpChap(ch)}>פרק {toHebNum(ch)}</button>)}
          </div>
        )
      })()}
      <div className="rv-body" ref={bodyRef}>
        <div className="rv-inner">
          {loading && <div className="rv-loading"><div>טוען טקסט מספריא...</div></div>}
          {error && <div className="rv-error">⚠ {error}<br /><button className="rv-retry" onClick={load}>נסה שוב</button></div>}
          {!loading && !error && mode === 'rashi' && rashiLoading && <div className="rv-rashi-loading">טוען פירוש רש״י…</div>}
          {!loading && !error && mode !== 'continuous' && verses.map(v => {
            const aliyahStart = aliyahStarts.find(a => a.key === v.key)
            return (
              <Fragment key={v.key}>
                {aliyahStart && (
                  <div className="rv-aliyah-header">
                    <div className="rv-aliyah-line" />
                    <span className="rv-aliyah-label">עלייה {ALIYA_LABELS[aliyahStart.num - 1]}</span>
                    <div className="rv-aliyah-line" />
                  </div>
                )}
                <VerseBlock v={v} mode={mode} fontSize={fontSize} isStop={stopKey === v.key} onPin={() => togglePin(v.key)} extTrans={extTrans} transLang={transLang} />
              </Fragment>
            )
          })}
          {!loading && !error && mode === 'continuous' && verses.length > 0 && (
            <div dir="rtl" style={{ fontFamily: 'var(--font-torah)', fontSize, lineHeight: 2, color: 'var(--text1)' }}>
              {verses.map(v => {
                const isStop = stopKey === v.key
                const aliyahStart = aliyahStarts.find(a => a.key === v.key)
                return (
                  <Fragment key={v.key}>
                    {aliyahStart && (
                      <div className="rv-aliyah-header">
                        <div className="rv-aliyah-line" />
                        <span className="rv-aliyah-label">עלייה {ALIYA_LABELS[aliyahStart.num - 1]}</span>
                        <div className="rv-aliyah-line" />
                      </div>
                    )}
                    <div id={`rv-${v.key}`} className={`rv-cont-verse${isStop ? ' is-stop' : ''}`}>
                      <span className="rv-cont-pin" style={{ fontSize: fontSize * 0.55, color: 'var(--text3)' }}>{toHebNum(v.verse)}</span>
                      <span style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: v.he }} />
                      <button className={`rv-pin${isStop ? ' on' : ''}`} aria-label={isStop ? 'הסר סמנייה' : 'סמן עצירה כאן'} aria-pressed={isStop} onClick={() => togglePin(v.key)} style={{ flexShrink: 0, alignSelf: 'center', fontSize: fontSize * 0.7 }}>📍</button>
                    </div>
                  </Fragment>
                )
              })}
            </div>
          )}
          {!loading && !error && verses.length > 0 && (() => {
            const p = prog[name] || {}
            const allDone = f => [1,2,3,4,5,6,7].every(i => p[i]?.[f])
            const showTg = mode === 'paired' || !!transLang
            let label, field, isDone
            if (showTg) { isDone = allDone('tg'); field = 'tg'; label = isDone ? '✓ תרגום' : 'סיימתי תרגום' }
            else {
              if (!allDone('r1')) { isDone = false; field = 'r1'; label = 'סיימתי פעם א׳' }
              else if (!allDone('r2')) { isDone = false; field = 'r2'; label = 'סיימתי פעם ב׳' }
              else { isDone = true; field = 'r2'; label = '✓ שניים מקרא' }
            }
            return <button className={`rv-seiamti${isDone ? ' done' : ''}`} onClick={() => { if (!isDone && onBulkMark) onBulkMark(name, field, true) }}>{label}</button>
          })()}
          {!loading && !error && verses.length > 0 && <div className="rv-credit">מקור הטקסט: <a href="https://www.sefaria.org" target="_blank" rel="noopener">ספריא</a> · CC BY-NC</div>}
        </div>
      </div>
      {/* פאנל חידושים */}
      <AnimatePresence>
        {showChidInput && (
          <motion.div className="rv-chid-panel" initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
            <div className="rv-chid-panel-head">
              <span className="rv-chid-panel-title">💡 חידושים ושאלות — {name}</span>
              {(() => {
                const list = (prog[name] || {}).chiddushim || []
                if (!list.length) return null
                function shareAll() {
                  const txt = list.map(c => `• ${c.text}  (${c.date})`).join('\n')
                  const full = `חידושים — פרשת ${name}\n\n${txt}`
                  if (navigator.share) navigator.share({ title: `חידושים פרשת ${name}`, text: full }).catch(() => {})
                  else { navigator.clipboard?.writeText(full); alert('הועתק ללוח') }
                }
                return <button className="rv-chid-share" onClick={shareAll}>שתף ↗</button>
              })()}
            </div>
            {(() => {
              const list = (prog[name] || {}).chiddushim || []
              if (!list.length) return <div className="rv-chid-empty">עדיין אין חידושים לפרשה זו</div>
              return (
                <div className="rv-chid-list">
                  {list.map(c => (
                    <div key={c.id} className="rv-chid-item">
                      <div className="rv-chid-item-body">
                        <span className="rv-chid-date">{c.date}</span>
                        <span className="rv-chid-text">{c.text}</span>
                      </div>
                      <button className="rv-chid-del" aria-label="מחיקת החידוש" onClick={() => { if (confirm('למחוק את החידוש?')) onDeleteChiddush(name, c.id) }}>×</button>
                    </div>
                  ))}
                </div>
              )
            })()}
            <textarea ref={chidRef} aria-label="חידוש או שאלה חדשים" className="rv-chid-input" value={chidText} onChange={e => setChidText(e.target.value)} placeholder="כתוב חידוש, שאלה או מחשבה חדשה..." rows={2} />
            <div className="rv-chid-footer">
              <button className="rv-chid-save" onClick={() => { if (chidText.trim()) { onAddChiddush(name, chidText.trim()); setChidText('') } }}>+ הוסף</button>
              <button className="rv-chid-cancel" onClick={() => { setShowChidInput(false); setChidText('') }}>סגור</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button className={`rv-chid-fab${showChidInput ? ' open' : ''}`} aria-label={showChidInput ? 'סגירת חידושים' : 'חידושים ושאלות'} aria-expanded={showChidInput} onClick={() => { setShowChidInput(v => !v); setTimeout(() => chidRef.current?.focus(), 120) }} whileTap={{ scale: 0.9 }}>
        {showChidInput ? '✕' : <>💡{((prog[name] || {}).chiddushim || []).length > 0 && <span className="rv-chid-badge">{((prog[name] || {}).chiddushim || []).length}</span>}</>}
      </motion.button>
    </motion.div>
  )
}

/* ═══ APP ════════════════════════════════ */
const FEATURES = [
  { icon: '✅', text: 'סימון כל עלייה — מקרא א׳, ב׳, תרגום' },
  { icon: '📖', text: 'קריאה מסודרת עם אונקלוס' },
  { icon: '🔖', text: 'סמנייה — ממשיך מהיכן שעצרת' },
  { icon: '🌍', text: 'תרגום לאנגלית, רוסית, ספרדית' },
  { icon: '📜', text: 'פירוש רש"י משולב' },
  { icon: '⚡', text: 'גלילה אוטומטית' },
  { icon: '📊', text: 'מעקב התקדמות לכל השנה' },
  { icon: '🗓️', text: 'זיהוי פרשת השבוע אוטומטי' },
]

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [prog, setProg] = useState({})
  const [sheet, setSheet] = useState(null)
  const [selectedSefer, setSelectedSefer] = useState(null)
  const [filterMissing, setFilterMissing] = useState(false)
  const [readingView, setReadingView] = useState(null)
  const [showOnboard, setShowOnboard] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const progRef = useRef({})        // המצב העדכני, לחישוב ערכים מוחלטים בעת לחיצה
  const inFlight = useRef(0)        // כתיבות לענן שעוד לא הסתיימו
  const pendingSnap = useRef(null)  // עדכון מהענן שהגיע בזמן כתיבה — מוחל כשהיא מסתיימת
  const leaving = useRef(false)     // באמצע יציאה/מחיקה — לא לשמור עוד עדכונים מקומית
  const curYear = useRef(getHebrewYear()).current
  const curParshiot = useRef(detectParasha()).current
  const { missing } = globalStats(prog)

  // מחוות "חזור": סוגרת מסך/גיליון פתוח לפני יציאה מהאפליקציה
  useBackGuard([
    { open: !!selectedSefer, close: () => setSelectedSefer(null) },
    { open: !!sheet, close: () => setSheet(null) },
    { open: !!readingView, close: () => setReadingView(null) },
    { open: showAccount, close: () => setShowAccount(false) },
    { open: showOnboard, close: () => setShowOnboard(false) },
  ])

  // מסך הפתיחה: ציטוט מלא בפתיחה הראשונה של היום, אחר כך רק עד שהאפליקציה מוכנה
  useEffect(() => {
    if (loading) return
    const el = document.getElementById('html-splash')
    if (!el) return
    const today = new Date().toDateString()
    const firstToday = lsGet('shmot-splash-day') !== today
    lsSet('shmot-splash-day', today)
    const wait = Math.max(0, (firstToday ? 5000 : 1200) - performance.now())
    const t = setTimeout(() => { el.classList.add('sp-out'); setTimeout(() => el.remove(), 520) }, wait)
    return () => clearTimeout(t)
  }, [loading])

  // תפריט החשבון נסגר בלחיצה מחוץ לו
  useEffect(() => {
    if (!showAccount) return
    const onDown = e => { if (!e.target.closest?.('.acct-wrap')) setShowAccount(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [showAccount])

  function setAll(r) { progRef.current = r; setProg(r) }

  useEffect(() => {
    let unsub = () => {}, cancelled = false
    getRedirectResult(auth).catch(() => {}).finally(() => {
      if (cancelled) return
      unsub = onAuthStateChanged(auth, u => {
        setUser(u)
        if (u) {
          document.title = 'שמו״ת · ' + (u.displayName?.split(' ')[0] || '')
          if (!lsGet('shmot-onboarded')) setShowOnboard(true)
        } else {
          setAll({}); document.title = 'שניים מקרא ואחד תרגום'; setLoading(false)
        }
      })
    })
    return () => { cancelled = true; unsub() }
  }, [])

  // האזנה חיה למסמך המשתמש — שינוי ממכשיר אחר מגיע מיד, ולא נדרס בכתיבה הבאה
  const uid = user?.uid
  useEffect(() => {
    if (!uid) return
    const local = loadLocal(uid)
    if (local) { setAll(local); setLoading(false) }
    return onSnapshot(userDoc(uid), snap => {
      setLoading(false)
      if (leaving.current || auth.currentUser?.uid !== uid || snap.metadata.hasPendingWrites) return
      const r = parseProg(snap.exists() ? snap.data() : null)
      if (inFlight.current > 0) { pendingSnap.current = r; return }
      setAll(r); saveLocal(uid, r)
    }, e => {
      console.error(e)
      if (e.code === 'permission-denied') alert('⚠️ Firebase: אין הרשאה.')
      setLoading(false)
    })
  }, [uid])

  function doneOnboard() { lsSet('shmot-onboarded', '1'); setShowOnboard(false) }

  function doSignIn() {
    signInWithPopup(auth, provider).catch(e => { if (e.code === 'auth/popup-blocked') signInWithRedirect(auth, provider) })
  }
  function closeAll() { setShowAccount(false); setSheet(null); setReadingView(null); setSelectedSefer(null) }
  async function doSignOut() {
    const id = uid
    closeAll()
    leaving.current = true
    await signOut(auth)
    if (id) clearLocal(id)   // מכשיר משותף: לא להשאיר את ההתקדמות של המשתמש הקודם
    leaving.current = false
  }
  async function deleteAccount() {
    if (!uid) return
    if (!confirm('למחוק לצמיתות את החשבון ואת כל ההתקדמות, הסמניות והחידושים?\nלא ניתן לשחזר את הנתונים.')) return
    const id = uid
    closeAll()
    leaving.current = true
    try { await deleteDoc(userDoc(id)) }
    catch (e) { console.error(e); leaving.current = false; alert('המחיקה נכשלה. בדוק את החיבור לאינטרנט ונסה שוב.'); return }
    clearLocal(id)
    try { localStorage.removeItem('shmot-onboarded') } catch {}
    try { await deleteUser(auth.currentUser) }
    catch (e) {
      // מחיקת משתמש דורשת כניסה טרייה — מבקשים אימות מחדש, ואם לא הצליח פשוט מנתקים
      try {
        if (e.code !== 'auth/requires-recent-login') throw e
        await reauthenticateWithPopup(auth.currentUser, provider)
        await deleteUser(auth.currentUser)
      } catch { await signOut(auth).catch(() => {}) }
    }
    clearLocal(id)
    leaving.current = false
    alert('הנתונים שלך נמחקו.')
  }

  /* כל שינוי: מוחל מקומית מיד, ונשלח לענן כפונקציה שמוחלת שם על המצב העדכני */
  function apply(mutate) {
    if (!uid || leaving.current) return
    const id = uid
    const next = mutate(progRef.current)
    setAll(next); saveLocal(id, next)
    inFlight.current++
    fbMutate(id, mutate, next).finally(() => {
      if (--inFlight.current > 0 || !pendingSnap.current) return
      const r = pendingSnap.current; pendingSnap.current = null
      if (auth.currentUser?.uid === id) { setAll(r); saveLocal(id, r) }
    })
  }
  const ensure = (n, parasha, num) => { if (!n[parasha]) n[parasha] = {}; if (num && !n[parasha][num]) n[parasha][num] = {} }
  function toggleAliya(parasha, num, field) {
    const val = !progRef.current[parasha]?.[num]?.[field]   // ערך מוחלט — לא "הפוך" — כדי שיתנהג נכון גם על מצב הענן
    apply(edit(n => { ensure(n, parasha, num); n[parasha][num][field] = val }))
  }
  function bulkMark(parasha, field, value) {
    apply(edit(n => {
      ensure(n, parasha)
      // "נקה" מוחק רק את סימוני העליות — לא חידושים ולא סמניות
      for (let i = 1; i <= 7; i++) {
        if (field === null) delete n[parasha][i]
        else { if (!n[parasha][i]) n[parasha][i] = {}; n[parasha][i][field] = value }
      }
    }))
  }
  function updateStop(parasha, num, val) {
    apply(edit(n => { ensure(n, parasha, num); if (val) n[parasha][num].stop = val; else delete n[parasha][num].stop }))
  }
  function addChiddush(parasha, text) {
    const item = { id: Date.now(), text, date: new Date().toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' }) }
    apply(edit(n => { ensure(n, parasha); if (!n[parasha].chiddushim) n[parasha].chiddushim = []; if (!n[parasha].chiddushim.some(c => c.id === item.id)) n[parasha].chiddushim.unshift(item) }))
  }
  function deleteChiddush(parasha, id) {
    apply(edit(n => { if (n[parasha]?.chiddushim) n[parasha].chiddushim = n[parasha].chiddushim.filter(c => c.id !== id) }))
  }
  function updateReadingStop(parasha, key) {
    apply(edit(n => { ensure(n, parasha); if (key) n[parasha].readingStop = key; else delete n[parasha].readingStop }))
  }
  function updateLastPos(parasha, key) {
    if (!key || progRef.current[parasha]?.lastPos === key) return
    apply(edit(n => { ensure(n, parasha); n[parasha].lastPos = key }))
  }
  function openReadingView(name, seferId, theme, skipStop = false) { setSheet(null); setReadingView({ name, seferId, theme, skipStop }) }

  if (loading) return null

  if (!user) return (
    <div className="signin-bg">
      <motion.div className="signin-box" initial={{ opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
        <div className="signin-icon">שמו״ת</div>
        <div className="signin-title">שניים מקרא ואחד תרגום</div>
        <div className="signin-desc">עקוב אחר כל עליה, כל קריאה —<br />ותמיד תדע בדיוק היכן עצרת.</div>
        <div className="features-divider">מה יש כאן?</div>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <motion.div key={i} className="feat-chip" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.07, type: 'spring', stiffness: 400, damping: 28 }}>
              <span className="feat-chip-icon">{f.icon}</span>
              <span>{f.text}</span>
            </motion.div>
          ))}
        </div>
        <motion.button className="btn-google" onClick={doSignIn} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          כניסה עם Google
        </motion.button>
      </motion.div>
    </div>
  )

  return (
    <>
      <header className="app-bar">
        <div className="bar-brand">
          <div className="bar-logo">שמו״ת</div>
          <div className="bar-tagline">שניים מקרא ואחד תרגום</div>
        </div>
        <div className="bar-end">
          <span className="badge-year">{yearStr(curYear)}</span>
          <motion.button className={`btn-missing${filterMissing ? ' on' : ''}`} aria-pressed={filterMissing} aria-label={`${missing} פרשות עם חוסרים — הצג רק אותן`} onClick={() => setFilterMissing(v => !v)} whileTap={{ scale: 0.93 }}>⚠ {missing}</motion.button>
          <a className="btn-contact" href="https://forms.gle/QVmpXvtWo9TtJGk9A" target="_blank" rel="noopener">✉ צור קשר</a>
          <div className="acct-wrap">
            <button className="acct-btn" onClick={() => setShowAccount(v => !v)} aria-label="חשבון" aria-haspopup="menu" aria-expanded={showAccount}>
              {user.photoURL ? <img className="user-av" src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <span aria-hidden="true">👤</span>}
            </button>
            <AnimatePresence>
              {showAccount && (
                <motion.div className="acct-menu" role="menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
                    <div className="acct-who">{user.displayName || ''}<span>{user.email || ''}</span></div>
                    <button role="menuitem" className="acct-item" onClick={doSignOut}>↩ יציאה מהחשבון</button>
                    <a role="menuitem" className="acct-item" href="/privacy.html" target="_blank" rel="noopener">🔒 מדיניות פרטיות</a>
                    <button role="menuitem" className="acct-item danger" onClick={deleteAccount}>🗑 מחיקת החשבון והנתונים</button>
                  </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>
      <StatsStrip prog={prog} />
      <AnimatePresence mode="wait">
        {!selectedSefer ? (
          <motion.div key="sfarim" className="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
            <AnimatePresence>
              {filterMissing && (
                <motion.div className="filter-notice" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <span>מציג פרשות עם חוסרים · {missing} פרשות</span>
                  <button className="btn-icon" style={{ color: '#b5524e', width: 22, height: 22, fontSize: '.78rem' }} aria-label="הצג את כל הפרשות" onClick={() => setFilterMissing(false)}>✕</button>
                </motion.div>
              )}
            </AnimatePresence>
            <ConceptCard />
            {(() => {
              const resumeP = (curParshiot || []).find(p => resumeKey(prog[p])) || Object.keys(prog).find(p => resumeKey(prog[p]))
              const showRow = curParshiot || resumeP
              if (!showRow) return null
              return (
                <div className="quick-row">
                  {curParshiot && <WeekCard parshiot={curParshiot} onOpen={openReadingView} />}
                  {resumeP && <ResumeCard parasha={resumeP} prog={prog} onOpen={openReadingView} />}
                </div>
              )
            })()}
            <div className="sefer-grid">
              {SFARIM.map((sefer, i) => (
                <SeferCard key={sefer.id} sefer={sefer} prog={prog} isSelected={false} isLast={i === SFARIM.length - 1 && SFARIM.length % 2 === 1} onClick={() => setSelectedSefer(sefer)} />
              ))}
            </div>
          </motion.div>
        ) : (
          <ParshotView key={selectedSefer.id} sefer={selectedSefer} prog={prog} currentParshiot={curParshiot} filterMissing={filterMissing}
            onOpen={(name, theme, seferId) => openReadingView(name, seferId, theme)}
            onOpenSheet={(name, theme, seferId) => setSheet({ name, theme, seferId })}
            onBack={() => setSelectedSefer(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {sheet && <BottomSheet key="sheet" name={sheet.name} seferId={sheet.seferId} theme={sheet.theme} prog={prog} onClose={() => setSheet(null)} onToggle={toggleAliya} onBulk={bulkMark} onStop={updateStop} onOpenRead={openReadingView} />}
      </AnimatePresence>
      <AnimatePresence>
        {readingView && <ReadingView key="rv" name={readingView.name} seferId={readingView.seferId} theme={readingView.theme} prog={prog} onClose={() => setReadingView(null)} onUpdateStop={updateReadingStop} onUpdateLastPos={updateLastPos} onBulkMark={bulkMark} skipStop={readingView.skipStop} onAddChiddush={addChiddush} onDeleteChiddush={deleteChiddush} />}
      </AnimatePresence>
      <AnimatePresence>
        {showOnboard && <OnboardingTooltip key="onboard" onDone={doneOnboard} />}
      </AnimatePresence>
    </>
  )
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {})

createRoot(document.getElementById('root')).render(<MotionConfig reducedMotion="user"><App /></MotionConfig>)
