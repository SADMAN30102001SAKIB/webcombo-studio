import { Hono } from 'hono';
import {
  uploadAudio,
  streamProgress,
  processAudio,
  applyReverb,
  getStatus,
  previewAudio,
  downloadAudio,
  cleanupJob
} from '../controllers/audio.controller.js';

const api = new Hono();

api.post('/upload', uploadAudio);
api.get('/progress/:jobId', streamProgress);
api.post('/process/:jobId', processAudio);
api.post('/reverb/:jobId', applyReverb);
api.get('/status/:jobId', getStatus);
api.get('/preview/:jobId', previewAudio);
api.get('/download/:jobId', downloadAudio);
api.post('/cleanup/:jobId', cleanupJob);

export default api;
