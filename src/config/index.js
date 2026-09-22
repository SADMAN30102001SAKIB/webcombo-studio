import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

function findChromeExecutable() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const potentialPaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe')
      : null,
    process.env.PROGRAMFILES
      ? path.join(process.env.PROGRAMFILES, 'Google\\Chrome\\Application\\chrome.exe')
      : null,
    process.env['PROGRAMFILES(X86)']
      ? path.join(process.env['PROGRAMFILES(X86)'], 'Google\\Chrome\\Application\\chrome.exe')
      : null
  ].filter(Boolean);

  for (const p of potentialPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return undefined;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  rootDir,
  uploadsDir: path.resolve(rootDir, 'uploads'),
  downloadDir: path.resolve(rootDir, 'downloads'),
  publicDir: path.resolve(rootDir, 'public'),
  url: process.env.VOCAL_REMOVER_URL || 'https://vocalremover.org',
  chromePath: findChromeExecutable(),
  headless: process.env.HEADLESS !== 'false',
  processingTimeout: parseInt(process.env.PROCESSING_TIMEOUT || '60000', 10),
  downloadTrack: process.env.DOWNLOAD_TRACK || 'vocal',
  maxFileSize: 100 * 1024 * 1024,
  slowedReverbUrl: process.env.SLOWED_REVERB_URL || 'https://slowedreverb.com'
};

export default config;
