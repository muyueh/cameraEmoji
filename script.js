const video = document.getElementById('video');
const statusBanner = document.getElementById('status');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const emojiDisplay = document.getElementById('emojiDisplay');
const expressionText = document.getElementById('expressionText');

const faceapi = window.faceapi;

const EMOJI_MAP = {
  happy: '😄',
  sad: '😢',
  angry: '😠',
  surprised: '😲',
  disgusted: '🤢',
  fearful: '😨',
  neutral: '😐'
};

const EXPRESSION_LABELS = {
  happy: 'Happy',
  sad: 'Sad',
  angry: 'Angry',
  surprised: 'Surprised',
  disgusted: 'Disgusted',
  fearful: 'Fearful',
  neutral: 'Neutral'
};

const DEFAULT_EXPRESSION = 'Waiting for face…';
const DEFAULT_EMOJI = '😐';

let currentStream = null;
let detectionActive = false;
let detectionHandle = null;
let modelsPromise = null;

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
    setStatus('This browser does not support camera access.', {
      hidden: false,
      isError: true
    });
    startButton.disabled = true;
    return false;
  }

  return true;
}

async function ensureModelsLoaded() {
  if (!faceapi) {
    setStatus('Facial analysis library failed to load.', {
      hidden: false,
      isError: true
    });
    return false;
  }

  if (!modelsPromise) {
    setStatus('Loading expression model…', { hidden: false, isError: false });
    modelsPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(
        'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights'
      ),
      faceapi.nets.faceExpressionNet.loadFromUri(
        'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights'
      )
    ]);
  }

  try {
    await modelsPromise;
    return true;
  } catch (error) {
    console.error('Failed to load expression models', error);
    setStatus('Unable to load the expression models. Please refresh and try again.', {
      hidden: false,
      isError: true
    });
    return false;
  }
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

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false
    });

    currentStream = stream;
    video.srcObject = stream;
    stopButton.disabled = false;
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

  stopDetection();
  resetExpression();

  setStatus('Camera stopped. Press “Start camera” to resume.', {
    hidden: false,
    isError: false
  });

  stopButton.disabled = true;
  startButton.disabled = false;
}

function resetExpression() {
  if (emojiDisplay) {
    emojiDisplay.textContent = DEFAULT_EMOJI;
  }

  if (expressionText) {
    expressionText.textContent = DEFAULT_EXPRESSION;
  }
}

function updateExpression(expression, probability) {
  const emoji = EMOJI_MAP[expression] ?? DEFAULT_EMOJI;
  const label = EXPRESSION_LABELS[expression] ?? expression;
  const percent = Math.round(probability * 100);

  if (emojiDisplay) {
    emojiDisplay.textContent = emoji;
  }

  if (expressionText) {
    expressionText.textContent = `${label} • ${percent}% confidence`;
  }
}

function handleNoFaceDetected() {
  if (emojiDisplay) {
    emojiDisplay.textContent = DEFAULT_EMOJI;
  }

  if (expressionText) {
    expressionText.textContent = 'No face detected';
  }
}

function stopDetection() {
  detectionActive = false;

  if (detectionHandle) {
    cancelAnimationFrame(detectionHandle);
    detectionHandle = null;
  }
}

async function detectExpression() {
  if (!detectionActive || !faceapi) {
    return;
  }

  if (video.readyState < 2 || video.paused || video.ended) {
    detectionHandle = requestAnimationFrame(detectExpression);
    return;
  }

  try {
    const detection = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
      )
      .withFaceExpressions();

    if (detection?.expressions) {
      const expressions = detection.expressions;
      const best = Object.entries(expressions).reduce(
        (max, current) => (current[1] > max[1] ? current : max),
        ['neutral', 0]
      );

      updateExpression(best[0], best[1]);
    } else {
      handleNoFaceDetected();
    }
  } catch (error) {
    console.error('Expression detection failed.', error);
  }

  detectionHandle = requestAnimationFrame(detectExpression);
}

async function startDetection() {
  if (detectionActive) {
    return;
  }

  const modelsLoaded = await ensureModelsLoaded();
  if (!modelsLoaded) {
    return;
  }

  detectionActive = true;
  setStatus('', { hidden: true });
  detectExpression();
}

video.addEventListener('playing', () => {
  startDetection();
});

startButton.addEventListener('click', () => {
  startCamera();
});

stopButton.addEventListener('click', () => {
  stopCamera();
});

// Attempt to start the camera automatically on load.
startCamera();
resetExpression();
