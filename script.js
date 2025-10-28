const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const loadingStatus = document.getElementById('loading');
const permissionStatus = document.getElementById('permission');
const emojiDisplay = document.getElementById('emoji');
const expressionText = document.getElementById('expression');
const confidenceText = document.getElementById('confidence');

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';

const expressionEmojiMap = {
  neutral: { label: 'Neutral', emoji: '😐' },
  happy: { label: 'Happy', emoji: '😀' },
  sad: { label: 'Sad', emoji: '😢' },
  angry: { label: 'Angry', emoji: '😠' },
  fearful: { label: 'Fearful', emoji: '😨' },
  disgusted: { label: 'Disgusted', emoji: '🤢' },
  surprised: { label: 'Surprised', emoji: '😮' }
};

async function loadModels() {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
  ]);
}

async function init() {
  try {
    await loadModels();
    loadingStatus.classList.add('hidden');
    await startVideo();
  } catch (error) {
    loadingStatus.textContent = 'Unable to load the face analysis models.';
    console.error(error);
  }
}

async function startVideo() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    permissionStatus.classList.add('hidden');
    video.srcObject = stream;
  } catch (error) {
    loadingStatus.classList.add('hidden');
    permissionStatus.classList.remove('hidden');
    expressionText.textContent = 'Camera access denied';
    confidenceText.textContent = '';
    console.error('Camera permission denied', error);
  }
}

video.addEventListener('loadedmetadata', () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
});

video.addEventListener('play', () => {
  const displaySize = { width: video.videoWidth, height: video.videoHeight };
  faceapi.matchDimensions(canvas, displaySize);

  const detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.5
  });

  const detectionLoop = async () => {
    if (video.paused || video.ended) {
      return;
    }

    const result = await faceapi
      .detectSingleFace(video, detectorOptions)
      .withFaceExpressions();

    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (result) {
      const resizedDetections = faceapi.resizeResults(result, displaySize);
      faceapi.draw.drawDetections(canvas, resizedDetections);

      const expressions = resizedDetections.expressions;
      const [topExpression, probability] = Object.entries(expressions).reduce(
        (best, current) => (current[1] > best[1] ? current : best),
        ['', 0]
      );

      if (topExpression && expressionEmojiMap[topExpression]) {
        const { label, emoji } = expressionEmojiMap[topExpression];
        emojiDisplay.textContent = emoji;
        emojiDisplay.style.transform = 'scale(1.08)';
        requestAnimationFrame(() => {
          emojiDisplay.style.transform = 'scale(1)';
        });
        expressionText.textContent = label;
        confidenceText.textContent = `Confidence: ${(probability * 100).toFixed(
          1
        )}%`;
      }
    } else {
      expressionText.textContent = 'Face not detected';
      confidenceText.textContent = '';
    }

    setTimeout(detectionLoop, 200);
  };

  detectionLoop();
});

init();
