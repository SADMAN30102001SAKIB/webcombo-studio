#!/usr/bin/env node
import path from 'path';
import config from './src/config/index.js';
import { separateAudio } from './src/services/stem.service.js';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node cli.js <audio-file-path> [vocal|music|both]

Examples:
  node cli.js song.mp3
  node cli.js "C:\\Music\\track.wav" vocal
  node cli.js backing.mp3 music
  `);
  process.exit(0);
}

const targetFile = args[0] || config.defaultAudioFile;
const targetTrack = args[1] || config.downloadTrack || 'vocal';

if (!targetFile) {
  console.error('Error: Please provide an audio file path.');
  console.error('Usage: node cli.js <audio-file-path> [vocal|music|both]');
  process.exit(1);
}

console.log(`\nStarting separation for: ${path.resolve(targetFile)}`);
console.log(`Target stem: ${targetTrack.toUpperCase()}\n`);

separateAudio(targetFile, targetTrack, (evt) => {
  const stepLabel = evt.step ? `[${evt.step.toUpperCase()}]` : '[INFO]';
  console.log(`${stepLabel} ${evt.message}`);
})
  .then((result) => {
    console.log(`\nComplete: ${result}\n`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`\nFailed: ${err.message}\n`);
    process.exit(1);
  });
