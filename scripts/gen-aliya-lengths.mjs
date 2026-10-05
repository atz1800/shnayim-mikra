// מייצר את src/data/aliyaLengths.js — מספר הפסוקים בכל עלייה (קריאה מלאה, שבת).
// הרצה: npm i --no-save @hebcal/leyning && node scripts/gen-aliya-lengths.mjs
import { getLeyningForParsha } from '@hebcal/leyning'
import { parshiot } from '@hebcal/core'
import { writeFileSync } from 'fs'

const out = {}
for (const p of [...parshiot, 'Vezot Haberakhah']) {
  const k = getLeyningForParsha(p).fullkriyah
  out[p] = [1, 2, 3, 4, 5, 6, 7].map(i => k[i]?.v || 0)
}
const body = Object.entries(out).map(([p, v]) => `  ${JSON.stringify(p)}: [${v.join(',')}],`).join('\n')
writeFileSync(new URL('../src/data/aliyaLengths.js', import.meta.url),
  `// נוצר אוטומטית ע"י scripts/gen-aliya-lengths.mjs (מקור: @hebcal/leyning) — לא לערוך ידנית\nexport const ALIYA_LENGTHS = {\n${body}\n}\n`)
console.log(Object.keys(out).length, 'parshiot')
