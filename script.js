const video = document.getElementById('video');
const statusBanner = document.getElementById('status');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const emojiBubble = document.getElementById('emojiBubble');

const FACE_API_LOCAL_SRC = 'vendor/face-api/face-api.min.js';
const FACE_API_CDN_SRC =
  'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const MODEL_LOCAL_BASE = 'vendor/face-api/models';
const MODEL_CDN_BASE = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';
const MODEL_MANIFESTS = [
  'tiny_face_detector_model-weights_manifest.json',
  'face_expression_model-weights_manifest.json'
];

let currentStream = null;
let detectionActive = false;
let detectionFrameHandle = null;
let modelLoadPromise = null;
let faceApiLoadPromise = null;
let resolvedModelBaseUrl = null;
let lastShownExpression = null;

console.log(
  '[cameraEmoji] App booting. faceapi loaded:',
  typeof window?.faceapi !== 'undefined'
);

function injectScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.faceApiSource = src;

    script.addEventListener('load', () => {
      resolve();
    });

    script.addEventListener('error', (event) => {
      script.remove();
      const error = new Error(`Failed to load script: ${src}`);
      error.event = event;
      reject(error);
    });

    document.head.appendChild(script);
  });
}

async function loadFaceApiLibrary() {
  if (typeof window.faceapi !== 'undefined') {
    return;
  }

  if (faceApiLoadPromise) {
    await faceApiLoadPromise;
    return;
  }

  faceApiLoadPromise = (async () => {
    try {
      console.log('[cameraEmoji] Loading face-api library from local bundle.');
      await injectScript(FACE_API_LOCAL_SRC);
      if (typeof window.faceapi === 'undefined') {
        throw new Error('faceapi global missing after loading local bundle.');
      }
      console.log('[cameraEmoji] face-api loaded from local bundle.');
      return;
    } catch (localError) {
      console.warn('[cameraEmoji] Local face-api bundle unavailable, trying CDN.', localError);
      await injectScript(FACE_API_CDN_SRC);
      if (typeof window.faceapi === 'undefined') {
        throw new Error('faceapi global missing after loading CDN bundle.');
      }
      console.log('[cameraEmoji] face-api loaded from CDN.');
    }
  })().catch((error) => {
    faceApiLoadPromise = null;
    throw error;
  });

  await faceApiLoadPromise;
}

function loadModelsFrom(baseUrl) {
  return Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(baseUrl),
    faceapi.nets.faceExpressionNet.loadFromUri(baseUrl)
  ]);
}

async function isLocalModelBundleAvailable() {
  const normalizedBase = MODEL_LOCAL_BASE.replace(/\/$/, '');
  try {
    await Promise.all(
      MODEL_MANIFESTS.map((manifest) => {
        const url = `${normalizedBase}/${manifest}`;
        return fetch(url, {
          method: 'HEAD',
          cache: 'no-store'
        }).then((response) => {
          if (!response.ok) {
            throw new Error(`Missing manifest: ${manifest}`);
          }
        });
      })
    );
    return true;
  } catch (error) {
    console.log('[cameraEmoji] Local model bundle not detected, using CDN weights.');
    return false;
  }
}

const EXPRESSION_TO_EMOJI = {
  neutral: '😐',
  happy: '😄',
  sad: '😢',
  angry: '😠',
  fearful: '😱',
  disgusted: '🤢',
  surprised: '😮'
};

function showEmoji(emoji) {
  if (!emojiBubble) {
    return;
  }

  emojiBubble.textContent = emoji;
  emojiBubble.classList.add('visible');
  emojiBubble.setAttribute('aria-hidden', 'false');
}

function hideEmoji() {
  if (!emojiBubble) {
    return;
  }

  emojiBubble.classList.remove('visible');
  emojiBubble.textContent = '';
  emojiBubble.setAttribute('aria-hidden', 'true');
}

async function ensureModelsLoaded() {
  try {
    await loadFaceApiLibrary();
  } catch (error) {
    console.error('Failed to load face-api library.', error);
    setStatus('Could not load the face-api library.', { hidden: false, isError: true });
    throw error;
  }

  if (modelLoadPromise) {
    await modelLoadPromise;
    return;
  }

  console.log('[cameraEmoji] Loading face-api models…');
  setStatus('Loading face detection models…', { hidden: false, isError: false });

  modelLoadPromise = (async () => {
    const sources = [];

    if (await isLocalModelBundleAvailable()) {
      sources.push({ baseUrl: MODEL_LOCAL_BASE, label: 'local bundle' });
    }

    sources.push({ baseUrl: MODEL_CDN_BASE, label: 'CDN' });

    let lastError = null;

    for (const source of sources) {
      try {
        console.log(
          `[cameraEmoji] Loading face-api models from ${source.label} (${source.baseUrl}).`
        );
        await loadModelsFrom(source.baseUrl);
        resolvedModelBaseUrl = source.baseUrl;
        console.log(`[cameraEmoji] Models ready (${source.label}).`);
        setStatus('', { hidden: true });
        return;
      } catch (error) {
        lastError = error;
        console.warn(
          `[cameraEmoji] Failed to load face-api models from ${source.label}.`,
          error
        );
      }
    }

    throw lastError || new Error('Unable to load face-api models from any source.');
  })().catch((error) => {
    console.error('Failed to load face-api models.', error);
    setStatus('Could not load facial expression models.', {
      hidden: false,
      isError: true
    });
    modelLoadPromise = null;
    throw error;
  });

  await modelLoadPromise;
}

function stopExpressionDetection() {
  detectionActive = false;
  if (detectionFrameHandle) {
    cancelAnimationFrame(detectionFrameHandle);
    detectionFrameHandle = null;
  }
  lastShownExpression = null;
  hideEmoji();
}

async function expressionDetectionLoop() {
  if (!detectionActive) {
    return;
  }

  if (!video || video.paused || video.ended) {
    detectionFrameHandle = requestAnimationFrame(expressionDetectionLoop);
    return;
  }

  try {
    const detection = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.6 })
      )
      .withFaceExpressions();

    if (!detection || !detection.expressions) {
      hideEmoji();
    } else {
      const [bestExpression, probability] = Object.entries(detection.expressions).reduce(
        (best, current) => {
          return current[1] > best[1] ? current : best;
        },
        ['neutral', 0]
      );

      const emoji = EXPRESSION_TO_EMOJI[bestExpression];
      if (emoji && probability >= 0.2) {
        if (lastShownExpression !== bestExpression) {
          console.log(
            `[cameraEmoji] Showing emoji for expression: ${bestExpression} (${probability.toFixed(2)})`
          );
        }
        lastShownExpression = bestExpression;
        showEmoji(emoji);
      } else {
        if (lastShownExpression !== null) {
          console.log('[cameraEmoji] Hiding emoji - low confidence or unsupported expression.');
        }
        lastShownExpression = null;
        hideEmoji();
      }
    }
  } catch (error) {
    console.error('Error while running expression detection.', error);
  }

  if (detectionActive) {
    detectionFrameHandle = requestAnimationFrame(expressionDetectionLoop);
  }
}

async function startExpressionDetection() {
  if (detectionActive) {
    console.log('[cameraEmoji] Expression detection already running.');
    return;
  }

  try {
    await ensureModelsLoaded();
  } catch (error) {
    console.warn('[cameraEmoji] Cannot start detection without models.');
    return;
  }

  detectionActive = true;
  lastShownExpression = null;
  const modelSourceDescription =
    resolvedModelBaseUrl && resolvedModelBaseUrl.startsWith('http')
      ? 'CDN models'
      : 'local models';
  console.log(
    `[cameraEmoji] Starting expression detection (${modelSourceDescription}).`
  );
  detectionFrameHandle = requestAnimationFrame(expressionDetectionLoop);
}

function setStatus(message, { hidden = false, isError = false } = {}) {
  if (!statusBanner) {
    return;
  }

  statusBanner.textContent = message;
  statusBanner.classList.toggle('hidden', hidden);
  statusBanner.classList.toggle('error', isError);
}

function ensureMediaDevicesSupport() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn('[cameraEmoji] MediaDevices API unavailable.');
    setStatus('This browser does not support camera access.', {
      hidden: false,
      isError: true
    });
    startButton.disabled = true;
    return false;
  }

  return true;
}

async function startCamera() {
  if (currentStream) {
    console.log('[cameraEmoji] startCamera called but stream already active.');
    return;
  }

  if (!ensureMediaDevicesSupport()) {
    console.log('[cameraEmoji] startCamera aborted: media devices unsupported.');
    return;
  }

  console.log('[cameraEmoji] Requesting camera access.');
  setStatus('Requesting camera access…', { hidden: false, isError: false });
  startButton.disabled = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false
    });

    currentStream = stream;
    video.srcObject = stream;
    console.log('[cameraEmoji] Camera stream started.');
    stopButton.disabled = false;

    if (!detectionActive) {
      startExpressionDetection();
    }
  } catch (error) {
    console.error('Unable to start the camera stream.', error);
    const reason =
      error?.name === 'NotAllowedError'
        ? 'Camera access was denied.'
        : 'Could not access the webcam.';

    setStatus(`${reason} Please check your browser permissions and try again.`, {
      hidden: false,
      isError: true
    });
    startButton.disabled = false;
  }
}

function stopCamera() {
  if (!currentStream) {
    console.log('[cameraEmoji] stopCamera called but no active stream.');
    return;
  }

  currentStream.getTracks().forEach((track) => track.stop());
  currentStream = null;
  video.srcObject = null;

  stopExpressionDetection();

  setStatus('Camera stopped. Press “Start camera” to resume.', {
    hidden: false,
    isError: false
  });

  console.log('[cameraEmoji] Camera stream stopped.');
  stopButton.disabled = true;
  startButton.disabled = false;
}

video.addEventListener('playing', () => {
  console.log('[cameraEmoji] Video element is playing.');
  setStatus('', { hidden: true });
  if (currentStream && !detectionActive) {
    startExpressionDetection();
  }
});

startButton.addEventListener('click', () => {
  console.log('[cameraEmoji] Start button clicked.');
  startCamera();
});

stopButton.addEventListener('click', () => {
  console.log('[cameraEmoji] Stop button clicked.');
  stopCamera();
});

// Attempt to start the camera automatically on load.
console.log('[cameraEmoji] Auto-starting camera.');
startCamera();
