import fs from "fs";
import path from "path";
import config from "../config/index.js";
import { launchStealthBrowser, setupPageDownloads } from "./browser.service.js";
import {
  getDirectorySnapshot,
  waitForDownloadCompletion,
} from "./download.service.js";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function safeUnlink(filePath, retries = 5, delay = 500) {
  if (!filePath) return;
  for (let i = 0; i < retries; i++) {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      return;
    } catch {
      await sleep(delay);
    }
  }
}

export async function separateAudio(
  inputAudioPath,
  trackType = config.downloadTrack || "vocal",
  onProgress = () => {},
) {
  const resolvedInputPath = path.resolve(inputAudioPath);
  const targetTrack = (trackType || "vocal").toLowerCase();

  if (!fs.existsSync(resolvedInputPath)) {
    const errMsg = `Input audio file not found at: ${resolvedInputPath}`;
    onProgress({ step: "error", message: errMsg });
    throw new Error(errMsg);
  }

  if (!fs.existsSync(config.downloadDir)) {
    fs.mkdirSync(config.downloadDir, { recursive: true });
  }
  const initialFiles = getDirectorySnapshot(config.downloadDir);

  console.log(`[VocalRemover] Starting separation for: ${resolvedInputPath}`);
  console.log(`[VocalRemover] Target track: ${targetTrack.toUpperCase()}`);
  console.log(`[VocalRemover] Download directory: ${config.downloadDir}`);

  onProgress({
    step: "starting",
    message: "Launching browser engine with anti-detection stealth...",
    track: targetTrack,
  });

  let browser = null;
  let page = null;

  try {
    browser = await launchStealthBrowser();
    page = await browser.newPage();
    await setupPageDownloads(page, config.downloadDir);

    onProgress({
      step: "navigating",
      message: `Connecting to ${config.url}...`,
    });
    console.log(`[VocalRemover] Navigating to ${config.url}...`);
    await page.goto(config.url, { waitUntil: "networkidle2", timeout: 60000 });

    onProgress({
      step: "uploading",
      message: "Uploading audio to AI processing engine...",
    });
    console.log("[VocalRemover] Locating file upload element...");
    const fileInput = await page.$('input[type="file"]');

    if (!fileInput) {
      console.log("[VocalRemover] Waiting for file chooser trigger...");
      const [fileChooser] = await Promise.all([
        page.waitForFileChooser({ timeout: 15000 }),
        page.evaluate(() => {
          const btn = Array.from(
            document.querySelectorAll('button, a, div[role="button"]'),
          ).find(el => /browse/i.test(el.textContent || ""));
          if (btn) btn.click();
        }),
      ]);
      await fileChooser.accept([resolvedInputPath]);
    } else {
      console.log(
        "[VocalRemover] Uploading audio file directly to input element...",
      );
      await fileInput.uploadFile(resolvedInputPath);
    }

    console.log(
      "[VocalRemover] File uploaded. Checking for server response...",
    );
    await sleep(2000);

    const uploadStatus = await page.evaluate(() => {
      const text = document.body ? document.body.innerText || "" : "";
      if (/too many requests/i.test(text) || /try again later/i.test(text)) {
        return {
          error: "RATE_LIMIT",
          message:
            "Too many requests from your IP address. VocalRemover free tier limit reached.",
        };
      }
      if (
        /network (problem|error)/i.test(text) ||
        /check your internet connection/i.test(text) ||
        /connection (problem|error|lost|failed)/i.test(text)
      ) {
        return {
          error: "NETWORK_ERROR",
          message:
            'VocalRemover reported a network error: "Network error occurred, check your internet connection."',
        };
      }
      if (
        /failed to upload/i.test(text) ||
        /upload (error|failed|problem)/i.test(text)
      ) {
        return {
          error: "UPLOAD_ERROR",
          message:
            "VocalRemover audio upload failed. Please check the file and try again.",
        };
      }
      const alertEls = Array.from(
        document.querySelectorAll(
          '[role="alert"], .alert, .toast, .notice, .notification, .warning',
        ),
      );
      for (const el of alertEls) {
        const alertText = (el.textContent || "").trim();
        if (/network/i.test(alertText)) {
          return {
            error: "NETWORK_ERROR",
            message: `VocalRemover network warning: ${alertText}`,
          };
        }
        if (/error|fail/i.test(alertText)) {
          return {
            error: "SITE_ERROR",
            message: `VocalRemover warning: ${alertText}`,
          };
        }
      }
      return null;
    });

    if (uploadStatus && uploadStatus.error) {
      onProgress({
        step: "error",
        errorType: uploadStatus.error,
        message: uploadStatus.message,
      });
      throw new Error(`[VocalRemover] ${uploadStatus.message}`);
    }

    onProgress({
      step: "processing",
      message:
        "AI stem separation algorithm is working. Analyzing frequencies and vocals (~30-60s)...",
    });
    console.log(
      "[VocalRemover] Waiting for AI audio processing to complete...",
    );

    const waitResult = await page.waitForFunction(
      () => {
        const text = document.body ? document.body.innerText || "" : "";
        if (/too many requests/i.test(text) || /try again later/i.test(text)) {
          return {
            status: "error",
            errorType: "RATE_LIMIT",
            message:
              "Too many requests from your IP address. VocalRemover free tier daily limit reached.",
          };
        }
        if (
          /network (problem|error)/i.test(text) ||
          /check your internet connection/i.test(text) ||
          /connection (problem|error|lost|failed)/i.test(text)
        ) {
          return {
            status: "error",
            errorType: "NETWORK_ERROR",
            message:
              'VocalRemover reported a network error: "Network error occurred, check your internet connection."',
          };
        }
        if (
          /failed to upload/i.test(text) ||
          /upload (error|failed|problem)/i.test(text)
        ) {
          return {
            status: "error",
            errorType: "UPLOAD_ERROR",
            message: "VocalRemover failed to receive audio file. Please retry.",
          };
        }
        const alertEls = Array.from(
          document.querySelectorAll(
            '[role="alert"], .alert, .toast, .notice, .notification, .warning',
          ),
        );
        for (const el of alertEls) {
          const alertText = (el.textContent || "").trim();
          if (/network/i.test(alertText)) {
            return {
              status: "error",
              errorType: "NETWORK_ERROR",
              message: `VocalRemover network warning: ${alertText}`,
            };
          }
          if (/error|fail|cannot/i.test(alertText)) {
            return {
              status: "error",
              errorType: "SITE_ERROR",
              message: `VocalRemover warning: ${alertText}`,
            };
          }
        }
        const buttons = Array.from(
          document.querySelectorAll('button, div[role="button"], a'),
        );
        const hasSave = buttons.some(
          b =>
            b.textContent &&
            b.textContent.trim().toLowerCase() === "save" &&
            b.offsetParent !== null,
        );
        if (hasSave) return { status: "ready" };
        return false;
      },
      { timeout: config.processingTimeout, polling: 1000 },
    );

    const check = await waitResult.jsonValue();
    if (check.status === "error") {
      onProgress({
        step: "error",
        errorType: check.errorType,
        message: check.message,
      });
      throw new Error(`[VocalRemover] ${check.message}`);
    }

    console.log("[VocalRemover] Processing complete! Waveforms loaded.");
    onProgress({
      step: "saving",
      message: `Separation finished! Opening Save menu to extract ${targetTrack.toUpperCase()}...`,
    });
    await sleep(1500);

    const saveBtnHandle = await page.evaluateHandle(() => {
      const buttons = Array.from(
        document.querySelectorAll('button, div[role="button"], a'),
      );
      return buttons.find(
        b =>
          b.textContent &&
          b.textContent.trim().toLowerCase() === "save" &&
          b.offsetParent !== null,
      );
    });

    const saveElement = saveBtnHandle.asElement();
    if (!saveElement) {
      throw new Error("Save button could not be located.");
    }

    await saveElement.click();

    await page.waitForSelector(".popup button", { timeout: 10000 });
    await sleep(400);

    const targetBtnHandle = await page.evaluateHandle(track => {
      const popupButtons = Array.from(
        document.querySelectorAll(".popup button"),
      );
      return popupButtons.find(b => {
        const text = (b.innerText || b.textContent || "").trim().toLowerCase();
        if (track === "vocal") {
          return (
            text === "vocal" ||
            (text.includes("vocal") &&
              !text.includes("+") &&
              !text.includes("music"))
          );
        } else if (track === "music") {
          return (
            text === "music" ||
            (text.includes("music") &&
              !text.includes("+") &&
              !text.includes("vocal"))
          );
        } else {
          return text.includes("music") && text.includes("vocal");
        }
      });
    }, targetTrack);

    const targetElement = targetBtnHandle.asElement();
    if (!targetElement) {
      throw new Error(
        `Option "${targetTrack}" could not be located in Save menu.`,
      );
    }

    await targetElement.click();

    onProgress({
      step: "downloading",
      message: `Triggered download. Saving ${targetTrack.toUpperCase()} audio file...`,
    });

    const downloadedFile = await waitForDownloadCompletion(
      config.downloadDir,
      initialFiles,
      60000,
      onProgress,
    );
    const fileName = path.basename(downloadedFile);
    console.log(
      `[VocalRemover] SUCCESS: ${targetTrack.toUpperCase()} downloaded to -> ${downloadedFile}`,
    );

    onProgress({
      step: "completed",
      message: `Successfully separated and extracted ${targetTrack.toUpperCase()} track!`,
      fileName,
      filePath: downloadedFile,
      downloadUrl: `/downloads/${encodeURIComponent(fileName)}`,
    });

    return downloadedFile;
  } catch (err) {
    let cleanMessage = err.message;
    if (err.name === "TimeoutError" || /timeout/i.test(err.message)) {
      cleanMessage =
        "VocalRemover processing timed out. The AI engine took too long or stalled. Please try again.";
    }
    console.error(`[VocalRemover] Error during automation: ${cleanMessage}`);

    if (page) {
      const errorScreenshot = path.join(
        config.downloadDir,
        "error-screenshot.png",
      );
      try {
        await page.screenshot({ path: errorScreenshot, fullPage: true });
        console.log(
          `[VocalRemover] Error screenshot saved to: ${errorScreenshot}`,
        );
      } catch {}
    }

    onProgress({
      step: "error",
      message: cleanMessage,
      screenshot: `/downloads/error-screenshot.png`,
    });

    throw new Error(cleanMessage);
  } finally {
    if (browser) {
      console.log("[VocalRemover] Closing browser session...");
      try {
        await browser.close();
      } catch {}
    }
    await safeUnlink(resolvedInputPath);
  }
}

export const stemService = {
  separateAudio,
};

export default stemService;
