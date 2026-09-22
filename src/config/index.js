import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../");

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  rootDir,
  uploadsDir: path.resolve(rootDir, "uploads"),
  downloadDir: path.resolve(rootDir, "downloads"),
  publicDir: path.resolve(rootDir, "public"),
  url: process.env.VOCAL_REMOVER_URL || "https://vocalremover.org",
  headless: process.env.HEADLESS !== "false",
  processingTimeout: parseInt(process.env.PROCESSING_TIMEOUT || "240000", 10),
  downloadTrack: process.env.DOWNLOAD_TRACK || "vocal",
  maxFileSize: 100 * 1024 * 1024,
  slowedReverbUrl: process.env.SLOWED_REVERB_URL || "https://slowedreverb.com",
};

export default config;
