// מייצר את src/data/aliyaLengths.js — לכל פרשה (וכל צירוף של פרשיות מחוברות):
//   ALIYA_LENGTHS — מספר הפסוקים בכל עלייה (לבורר פסוק העצירה)
//   LEYNING       — ספר, תחילת וסוף הקריאה, ותחילת כל עלייה ("פרק:פסוק")
// מקור: @hebcal/leyning, קריאה מלאה של שבת.
// הרצה: npm i --no-save @hebcal/leyning && node scripts/gen-aliya-lengths.mjs
import { getLeyningForParsha } from '@hebcal/leyning'
import { parshiot } from '@hebcal/core'
import { writeFileSync } from 'fs'

const COMBINED = [
  ['Vayakhel', 'Pekudei'], ['Tazria', 'Metzora'], ['Achrei Mot', 'Kedoshim'], ['Behar', 'Bechukotai'],
  ['Chukat', 'Balak'], ['Matot', 'Masei'], ['Nitzavim', 'Vayeilech'],
]
const cv = s => s.split(' ').pop()   // "Genesis 6:9" → "6:9"

const lengths = {}, leyning = {}
for (const p of [...parshiot.map(x => [x]), ['Vezot Haberakhah'], ...COMBINED]) {
  const key = p.join('-')
  const k = getLeyningForParsha(p).fullkriyah
  const al = [1, 2, 3, 4, 5, 6, 7].map(i => k[i])
  if (p.length === 1) lengths[key] = al.map(a => a?.v || 0)
  leyning[key] = { book: al[0].k, start: cv(al[0].b), end: cv(al[6].e), aliyot: al.map(a => cv(a.b)) }
}
const obj = o => Object.entries(o).map(([p, v]) => `  ${JSON.stringify(p)}: ${JSON.stringify(v)},`).join('\n')
writeFileSync(new URL('../src/data/aliyaLengths.js', import.meta.url),
  `// נוצר אוטומטית ע"י scripts/gen-aliya-lengths.mjs (מקור: @hebcal/leyning) — לא לערוך ידנית\n` +
  `export const ALIYA_LENGTHS = {\n${obj(lengths)}\n}\n\n` +
  `export const LEYNING = {\n${obj(leyning)}\n}\n`)
console.log(Object.keys(leyning).length, 'readings')
