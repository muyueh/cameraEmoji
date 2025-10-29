const video = document.getElementById('video');
const statusBanner = document.getElementById('status');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const emotionPill = document.getElementById('emotionPill');
const emotionLabel = document.getElementById('emotionLabel');
const emotionEmoji = document.getElementById('emotionEmoji');

let currentStream = null;
let detectionActive = false;
let detectionFrameId = null;
let modelsLoaded = false;
let modelsLoadingPromise = null;

const MODEL_URL = './weights';

const EXPRESSION_EMOJI = {
  neutral: '😐',
  happy: '😊',
  sad: '😢',
  angry: '😠',
  fearful: '😨',
  disgusted: '🤢',
  surprised: '😲'
};

function setStatus(message, { hidden = false, isError = false } = {}) {
  if (!statusBanner) {
    return;
  }

  statusBanner.textContent = message;
  statusBanner.classList.toggle('hidden', hidden);
  statusBanner.classList.toggle('error', isError);
}

function resetEmotionPill() {
  if (!emotionLabel || !emotionEmoji) {
    return;
  }

  emotionEmoji.textContent = '😊';
  emotionLabel.textContent = 'Waiting for face…';
  emotionPill?.classList.remove('missing');
}

function updateEmotion(expression, confidence) {
  if (!emotionLabel || !emotionEmoji) {
    return;
  }

  if (!expression) {
    emotionEmoji.textContent = '👀';
    emotionLabel.textContent = 'No face detected';
    emotionPill?.classList.add('missing');
    return;
  }

  const emoji = EXPRESSION_EMOJI[expression] ?? '🙂';
  const percent =
    typeof confidence === 'number' ? Math.round(confidence * 100) : null;
  emotionEmoji.textContent = emoji;
  emotionLabel.textContent = percent
    ? `${expression[0].toUpperCase()}${expression.slice(1)} · ${percent}%`
    : `${expression[0].toUpperCase()}${expression.slice(1)}`;
  emotionPill?.classList.remove('missing');
}

function ensureFaceApiAvailable() {
  if (typeof faceapi === 'undefined') {
    setStatus('The expression library failed to load. Make sure vendor/face-api.min.js is available and reload the page.', {
      hidden: false,
      isError: true
    });
    return false;
  }

  return true;
}

async function loadModels() {
  if (modelsLoaded) {
    return;
  }

  if (!modelsLoadingPromise) {
    modelsLoadingPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]);
  }

  await modelsLoadingPromise;
  modelsLoaded = true;
}

function stopEmotionDetection() {
  detectionActive = false;

  if (detectionFrameId) {
    cancelAnimationFrame(detectionFrameId);
    detectionFrameId = null;
  }

  resetEmotionPill();
}

function scheduleNextDetectionFrame() {
  if (!detectionActive) {
    return;
  }

  detectionFrameId = requestAnimationFrame(analyzeFrame);
}

function getTopExpression(expressions) {
  let bestLabel = null;
  let bestScore = 0;

  for (const [label, score] of Object.entries(expressions)) {
    if (score > bestScore) {
      bestLabel = label;
      bestScore = score;
    }
  }

  return bestLabel ? { label: bestLabel, score: bestScore } : null;
}

async function analyzeFrame() {
  if (!detectionActive || !modelsLoaded) {
    return;
  }

  if (video.paused || video.ended || !currentStream) {
    stopEmotionDetection();
    return;
  }

  try {
    const detection = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.6 })
      )
      .withFaceExpressions();

    if (detection?.expressions) {
      const topExpression = getTopExpression(detection.expressions);
      if (topExpression) {
        updateEmotion(topExpression.label, topExpression.score);
      } else {
        updateEmotion(null, null);
      }
    } else {
      updateEmotion(null, null);
    }
  } catch (error) {
    console.error('Expression analysis failed.', error);
    updateEmotion(null, null);
  }

  scheduleNextDetectionFrame();
}

async function startEmotionDetection() {
  if (detectionActive || !currentStream) {
    return;
  }

  if (!ensureFaceApiAvailable()) {
    return;
  }

  detectionActive = true;
  setStatus('Loading expression model…', { hidden: false, isError: false });

  try {
    await loadModels();
    setStatus('', { hidden: true });
    scheduleNextDetectionFrame();
  } catch (error) {
    console.error('Failed to load face-api.js models.', error);
    setStatus('Could not load the expression model. Try reloading the page.', {
      hidden: false,
      isError: true
    });
    modelsLoadingPromise = null;
    stopEmotionDetection();
  }
}

function ensureMediaDevicesSupport() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
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
    return;
  }

  if (!ensureMediaDevicesSupport()) {
    return;
  }

  setStatus('Requesting camera access…', { hidden: false, isError: false });
  startButton.disabled = true;
  resetEmotionPill();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false
    });

    currentStream = stream;
    video.srcObject = stream;
    stopButton.disabled = false;
    await video.play();
    startEmotionDetection();
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
    return;
  }

  currentStream.getTracks().forEach((track) => track.stop());
  currentStream = null;
  video.srcObject = null;

  setStatus('Camera stopped. Press “Start camera” to resume.', {
    hidden: false,
    isError: false
  });

  stopButton.disabled = true;
  startButton.disabled = false;
  stopEmotionDetection();
}

video.addEventListener('playing', () => {
  setStatus('', { hidden: true });
});

startButton.addEventListener('click', () => {
  startCamera();
});

stopButton.addEventListener('click', () => {
  stopCamera();
});

// Attempt to start the camera automatically on load.
startCamera();
