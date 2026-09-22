import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import config from '../config/index.js';

puppeteer.use(StealthPlugin());

export async function launchStealthBrowser(options = {}) {
  const launchArgs = [
    '--start-maximized',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1920,1080'
  ];

  return puppeteer.launch({
    headless: options.headless !== undefined ? options.headless : config.headless,
    executablePath: config.chromePath && fs.existsSync(config.chromePath) ? config.chromePath : undefined,
    defaultViewport: { width: 1920, height: 1080 },
    args: launchArgs,
    ...options
  });
}

export async function setupPageDownloads(page, downloadPath = config.downloadDir) {
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }

  const client = await page.createCDPSession();

  try {
    await client.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath,
      eventsEnabled: true
    });
  } catch {}

  try {
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath
    });
  } catch {}

  return client;
}
