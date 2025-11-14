# Camera Emoji

Camera Emoji now pairs a live webcam preview with in-browser facial expression analysis. The app reads your current mood and mirrors it with a matching emoji overlay on the video feed.

## Live demo

When published with GitHub Pages the site will be available at `https://<your-username>.github.io/cameraEmoji/`.

## Development

1. Serve the project locally with any static file server (for example, `npx serve .`).
2. Open the page in your browser.
3. Grant the tab permission to use your webcam when prompted.
4. Wait for the expression model to finish loading (status message disappears).
5. Watch the emoji overlay react to your expressions in real time.

If your browser blocks the webcam, check its site permissions and try again. All analysis happens on-device using [face-api.js](https://github.com/justadudewhohacks/face-api.js).
