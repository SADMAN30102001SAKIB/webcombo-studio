import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import config from "../config/index.js";

puppeteer.use(StealthPlugin());

export async function launchStealthBrowser(options = {}) {
  const launchArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-first-run",
    "--no-zygote",
    "--disable-blink-features=AutomationControlled",
    "--window-size=1920,1080",
  ];

  const executablePath =
    options.executablePath ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    (fs.existsSync("/usr/bin/chromium")
      ? "/usr/bin/chromium"
      : fs.existsSync("/usr/bin/chromium-browser")
        ? "/usr/bin/chromium-browser"
        : undefined);

  return puppeteer.launch({
    headless:
      options.headless !== undefined ? options.headless : config.headless,
    defaultViewport: { width: 1920, height: 1080 },
    args: launchArgs,
    ...(executablePath ? { executablePath } : {}),
    ...options,
  });
}

export async function setupPageDownloads(
  page,
  downloadPath = config.downloadDir,
) {
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }

  const client = await page.createCDPSession();

  try {
    await client.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath,
      eventsEnabled: true,
    });
  } catch {}

  try {
    await client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath,
    });
  } catch {}

  return client;
}
