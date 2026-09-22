import fs from "fs";
import path from "path";
import config from "../config/index.js";
import { launchStealthBrowser } from "./browser.service.js";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function applySlowedReverb(
  stemAudioPath,
  options = {},
  onProgress = () => {},
) {
  const resolvedStemPath = path.resolve(stemAudioPath);

  if (!fs.existsSync(resolvedStemPath)) {
    const errMsg = `Stem audio file not found at: ${resolvedStemPath}`;
    onProgress({ step: "error", message: errMsg });
    throw new Error(errMsg);
  }

  const slowByPitch =
    options.slowByPitch !== undefined ? Boolean(options.slowByPitch) : true;
  const speed =
    options.speed !== undefined ? Number(options.speed) : slowByPitch ? -2 : 87;
  const reverbMix =
    options.reverbMix !== undefined ? Number(options.reverbMix) : 35;

  onProgress({
    step: "reverb_starting",
    message: "Launching browser engine for Slowed + Reverb processing...",
  });

  let browser = null;
  let page = null;

  try {
    browser = await launchStealthBrowser();
    page = await browser.newPage();

    onProgress({
      step: "reverb_navigating",
      message: `Connecting to ${config.slowedReverbUrl}...`,
    });

    await page.goto(config.slowedReverbUrl, {
      waitUntil: "networkidle2",
      timeout: 45000,
    });

    onProgress({
      step: "reverb_uploading",
      message: "Uploading stem audio to SlowedReverb engine...",
    });

    const fileInput = await page.$("#audio-upload");
    if (!fileInput) {
      throw new Error("Audio upload input not found on SlowedReverb engine.");
    }

    await fileInput.uploadFile(resolvedStemPath);

    await page.waitForFunction(
      () => {
        const status = document.getElementById("status");
        const text = status ? status.innerText : "";
        return text.includes("Ready to process");
      },
      { timeout: 30000 },
    );

    onProgress({
      step: "reverb_configuring",
      message: `Configuring parameters: Pitch Mode=${slowByPitch ? "ON" : "OFF"}, Speed=${speed}, Reverb=${reverbMix}%`,
    });

    await page.evaluate(
      ({ slowByPitch, speed, reverbMix }) => {
        const toggle = document.getElementById("speed-mode-toggle");
        if (toggle && toggle.checked !== slowByPitch) {
          toggle.checked = slowByPitch;
          toggle.dispatchEvent(new Event("change", { bubbles: true }));
        }

        const sliderSpeed = document.getElementById("slider-speed");
        if (sliderSpeed) {
          sliderSpeed.value = speed;
          sliderSpeed.dispatchEvent(new Event("input", { bubbles: true }));
          sliderSpeed.dispatchEvent(new Event("change", { bubbles: true }));
        }

        const sliderReverb = document.getElementById("slider-reverb");
        if (sliderReverb) {
          sliderReverb.value = reverbMix;
          sliderReverb.dispatchEvent(new Event("input", { bubbles: true }));
          sliderReverb.dispatchEvent(new Event("change", { bubbles: true }));
        }
      },
      { slowByPitch, speed, reverbMix },
    );

    await sleep(300);

    onProgress({
      step: "reverb_processing",
      message: "Applying DSP time-stretching and acoustic impulse reverb...",
    });

    await page.click("#process-btn");

    let lastStatus = "";
    const pollStart = Date.now();
    let isCompleted = false;

    while (!isCompleted && Date.now() - pollStart < 60000) {
      const currentStatus = await page.evaluate(() => {
        const statusEl = document.getElementById("status");
        const downloadLink = document.getElementById("download-mp3-link");
        return {
          statusText: statusEl ? statusEl.innerText.trim() : "",
          hasMp3: Boolean(
            downloadLink &&
            downloadLink.href &&
            downloadLink.href.startsWith("blob:"),
          ),
        };
      });

      if (currentStatus.statusText && currentStatus.statusText !== lastStatus) {
        lastStatus = currentStatus.statusText;
        onProgress({
          step: "reverb_processing",
          message: lastStatus,
        });
      }

      if (currentStatus.hasMp3 || currentStatus.statusText.includes("Done!")) {
        isCompleted = true;
        break;
      }

      if (currentStatus.statusText.includes("Error")) {
        throw new Error(
          `SlowedReverb processing failed: ${currentStatus.statusText}`,
        );
      }

      await sleep(500);
    }

    if (!isCompleted) {
      throw new Error(
        "SlowedReverb processing timed out after 60 seconds. Please try again.",
      );
    }

    onProgress({
      step: "reverb_downloading",
      message: "Extracting rendered 320kbps MP3 master track...",
    });

    const base64Data = await page.evaluate(async () => {
      const downloadLink = document.getElementById("download-mp3-link");
      if (!downloadLink || !downloadLink.href) {
        throw new Error("Download link element missing or invalid.");
      }
      const response = await fetch(downloadLink.href);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    });

    if (!fs.existsSync(config.downloadDir)) {
      fs.mkdirSync(config.downloadDir, { recursive: true });
    }

    const stemBaseName = path.basename(
      resolvedStemPath,
      path.extname(resolvedStemPath),
    );
    const outputFileName = `SlowedReverb_${stemBaseName}.mp3`;
    const outputPath = path.join(config.downloadDir, outputFileName);

    const buffer = Buffer.from(base64Data, "base64");
    await fs.promises.writeFile(outputPath, buffer);

    onProgress({
      step: "reverb_completed",
      message: "Slowed + Reverb master audio rendered successfully!",
      fileName: outputFileName,
      outputPath,
    });

    return outputPath;
  } catch (err) {
    console.error(`[SlowedReverb] Error: ${err.message}`);

    if (page) {
      try {
        const errorScreenshot = path.join(
          config.downloadDir,
          "slowed-error.png",
        );
        await page.screenshot({ path: errorScreenshot });
      } catch {}
    }

    onProgress({
      step: "error",
      message: err.message,
      screenshot: "/downloads/slowed-error.png",
    });

    throw err;
  } finally {
    if (browser) {
      await sleep(1000);
      try {
        await browser.close();
      } catch {}
    }
  }
}

export const reverbService = {
  applySlowedReverb,
};

export default reverbService;
