# Camera Emoji

Camera Emoji now pairs the live webcam preview with lightweight, in-browser emotion detection powered by [`face-api.js`](https://github.com/justadudewhohacks/face-api.js). The app asks for camera access, streams the video feed, and overlays the most confident facial expression label and emoji.

## Live demo

When published with GitHub Pages the site will be available at `https://<your-username>.github.io/cameraEmoji/`.

## Development

1. Serve the project locally with any static file server (for example, `npx serve .`).
2. Open the page in your browser.
3. Grant the tab permission to use your webcam when prompted.
4. Wait for the expression model to finish loading (the pill shows a sandglass while warming up).
5. Keep your face inside the frame to see the detected expression update in real time with a matching emoji.

If your browser blocks the webcam, check its site permissions and try again. The expression model files are fetched from the jsDelivr CDN, so you also need a network connection when the page loads for the first time.
