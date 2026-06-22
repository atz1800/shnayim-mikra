import sharp from 'sharp'

const bg = Buffer.from(`<svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1024" y2="500" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="45%" stop-color="#1a56db"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#g)"/>
  <circle cx="180" cy="80"  r="220" fill="rgba(255,255,255,0.04)"/>
  <circle cx="870" cy="420" r="260" fill="rgba(255,255,255,0.04)"/>
  <circle cx="512" cy="250" r="340" fill="rgba(255,255,255,0.025)"/>
</svg>`)

const icon = await sharp('./public/icon-512.png').resize(220, 220).toBuffer()

await sharp(bg)
  .composite([{ input: icon, top: 140, left: 402, blend: 'over' }])
  .jpeg({ quality: 95 })
  .toFile('./public/feature-graphic.jpg')

console.log('✅ feature-graphic.jpg נוצר בתיקיית public/')
