import { fileURLToPath } from 'url';
import path from 'path';

export { config } from './src/config/index.js';
export { separateAudio, stemService } from './src/services/stem.service.js';
export { jobService } from './src/services/job.service.js';
export { launchStealthBrowser, setupPageDownloads } from './src/services/browser.service.js';
export { waitForDownloadCompletion } from './src/services/download.service.js';

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  import('./cli.js');
}
