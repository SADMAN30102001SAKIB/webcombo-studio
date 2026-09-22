import fs from 'fs';
import path from 'path';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function getDirectorySnapshot(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
    return [];
  }
  return fs.readdirSync(directoryPath);
}

export async function waitForDownloadCompletion(
  downloadDir,
  initialFiles = [],
  timeoutMs = 60000,
  onProgress = () => {}
) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (!fs.existsSync(downloadDir)) {
      await sleep(500);
      continue;
    }

    const currentFiles = fs.readdirSync(downloadDir);
    const newFiles = currentFiles.filter((f) => !initialFiles.includes(f));

    const isDownloading = newFiles.some((f) => f.endsWith('.crdownload'));
    const completedFiles = newFiles.filter(
      (f) => !f.endsWith('.crdownload') && !f.endsWith('.tmp') && !f.endsWith('.png')
    );

    if (isDownloading) {
      onProgress({
        step: 'downloading',
        message: 'Downloading audio stream from browser...'
      });
    }

    if (!isDownloading && completedFiles.length > 0) {
      const targetFile = path.join(downloadDir, completedFiles[0]);
      const stats = fs.statSync(targetFile);
      if (stats.size > 0) {
        return targetFile;
      }
    }

    await sleep(500);
  }

  throw new Error(`Download timed out after ${Math.round(timeoutMs / 1000)}s`);
}
