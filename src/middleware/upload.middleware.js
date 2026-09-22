import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import config from '../config/index.js';

export async function saveUploadedAudio(file) {
  if (!file || typeof file === 'string') {
    throw new Error('No audio file provided.');
  }

  const validExts = /\.(mp3|wav|ogg|flac|m4a|aac)$/i;
  const isAudioMime = file.type ? file.type.startsWith('audio/') : false;
  const hasValidExt = validExts.test(file.name);

  if (!isAudioMime && !hasValidExt) {
    throw new Error('Invalid file type. Only audio files (MP3, WAV, FLAC, M4A, OGG) are permitted.');
  }

  if (file.size > config.maxFileSize) {
    throw new Error(`File exceeds maximum size limit of ${Math.round(config.maxFileSize / 1024 / 1024)}MB.`);
  }

  if (!fs.existsSync(config.uploadsDir)) {
    fs.mkdirSync(config.uploadsDir, { recursive: true });
  }

  const ext = path.extname(file.name) || '.mp3';
  const safeName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  const filePath = path.join(config.uploadsDir, safeName);

  const arrayBuffer = await file.arrayBuffer();
  await fs.promises.writeFile(filePath, Buffer.from(arrayBuffer));

  return {
    originalName: file.name,
    fileName: safeName,
    filePath,
    size: file.size
  };
}
