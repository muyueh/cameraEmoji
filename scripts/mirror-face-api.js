#!/usr/bin/env node
/**
 * Download face-api.js browser bundle and required model weights so the app can
 * operate completely from local assets. Mirrors the CDN structure used by the
 * face-api.js examples server.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2';
const LIB_DEST = path.join(__dirname, '..', 'vendor', 'face-api.min.js');
const WEIGHTS_DIR = path.join(__dirname, '..', 'weights');
const MANIFESTS = [
  'tiny_face_detector_model-weights_manifest.json',
  'face_expression_model-weights_manifest.json'
];

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    ensureDirSync(path.dirname(destination));

    const file = fs.createWriteStream(destination);
    const request = https.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      }
    });

    request.on('response', response => {
      if (response.statusCode !== 200) {
        file.close(() => fs.unlink(destination, () => {}));
        reject(new Error(`Request failed for ${url} with status ${response.statusCode}`));
        response.resume();
        return;
      }

      response.pipe(file);
    });

    request.on('error', error => {
      file.close(() => fs.unlink(destination, () => {}));
      reject(error);
    });

    file.on('finish', () => file.close(resolve));
    file.on('error', error => {
      file.close(() => fs.unlink(destination, () => {}));
      reject(error);
    });
  });
}

async function downloadManifestAndShards(manifestName) {
  const manifestUrl = `${CDN_BASE}/weights/${manifestName}`;
  const manifestPath = path.join(WEIGHTS_DIR, manifestName);
  console.log(`Fetching manifest: ${manifestUrl}`);
  await download(manifestUrl, manifestPath);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const shardPaths = manifest.weights?.flatMap(weight => weight.paths) ?? [];

  for (const shard of shardPaths) {
    const shardUrl = `${CDN_BASE}/weights/${shard}`;
    const shardDest = path.join(WEIGHTS_DIR, shard);
    console.log(`Fetching shard: ${shardUrl}`);
    await download(shardUrl, shardDest);
  }
}

async function main() {
  ensureDirSync(path.dirname(LIB_DEST));
  ensureDirSync(WEIGHTS_DIR);

  console.log('Downloading face-api.js browser bundle…');
  await download(`${CDN_BASE}/dist/face-api.min.js`, LIB_DEST);

  for (const manifestName of MANIFESTS) {
    await downloadManifestAndShards(manifestName);
  }

  console.log('All assets downloaded successfully.');
}

main().catch(error => {
  console.error('Failed to mirror face-api.js assets.');
  console.error(error.message ?? error);
  process.exitCode = 1;
});
