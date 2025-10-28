const video = document.getElementById('video');
const statusBanner = document.getElementById('status');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');

let currentStream = null;

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

  setStatus('Camera stopped. Press “Start camera” to resume.', {
    hidden: false,
    isError: false
  });

  stopButton.disabled = true;
  startButton.disabled = false;
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
