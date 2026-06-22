import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';

const URL = 'https://shnayim-mikra-app.web.app';

// Mobile dimensions (portrait)
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2 };

async function run() {
  await mkdir('./public/screenshots', { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=he-IL']
  });

  const page = await browser.newPage();
  await page.setViewport(MOBILE);

  // Screenshot 1: Login / landing page with features
  console.log('📸 מצלם דף כניסה...');
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
  // Wait for splash to fade & features to animate in
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({
    path: './public/screenshots/screen1-login.png',
    type: 'png'
  });
  console.log('✅ screen1-login.png');

  // Screenshot 2: Splash screen (first 2 seconds)
  console.log('📸 מצלם מסך פתיחה...');
  const page2 = await browser.newPage();
  await page2.setViewport(MOBILE);
  await page2.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  await page2.screenshot({
    path: './public/screenshots/screen2-splash.png',
    type: 'png'
  });
  console.log('✅ screen2-splash.png');

  await browser.close();
  console.log('\n✅ Screenshots מוכנים בתיקיית public/screenshots/');
}

run().catch(e => { console.error(e); process.exit(1); });
