import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function renderIcons() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });

  const svgContent = fs.readFileSync('icons/icon.svg', 'utf8');
  const sizes = [16, 32, 48, 128];

  for (const size of sizes) {
    const page = await browser.newPage();
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
            svg { width: 100%; height: 100%; display: block; }
          </style>
        </head>
        <body>${svgContent}</body>
      </html>
    `);
    await page.screenshot({
      path: `icons/icon${size}.png`,
      omitBackground: true
    });
    console.log(`Rendered icon${size}.png (${size}x${size})`);
    await page.close();
  }

  await browser.close();
  console.log('All icons generated successfully!');
}

renderIcons().catch(err => {
  console.error(err);
  process.exit(1);
});
