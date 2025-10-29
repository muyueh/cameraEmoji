# Camera Emoji

Camera Emoji now pairs the live webcam preview with lightweight, in-browser emotion detection powered by [`face-api.js`](https://github.com/justadudewhohacks/face-api.js). The app asks for camera access, streams the video feed, and overlays the most confident facial expression label and emoji.

## Live demo

When published with GitHub Pages the site will be available at `https://<your-username>.github.io/cameraEmoji/`.

## Development

1. Serve the project locally with any static file server (for example, `npx serve .`).
2. Open the page in your browser.
3. Grant the tab permission to use your webcam when prompted.
4. Wait for the expression model to finish loading (status banner disappears once ready).
5. Keep your face inside the frame to see the detected expression update in real time.

If your browser blocks the webcam, check its site permissions and try again.

## Mirroring face-api.js locally

The project now ships with a helper script that mirrors the browser bundle and
required weight files so you can run everything from local assets instead of
the jsDelivr CDN.

```bash
node scripts/mirror-face-api.js
```

Running the script downloads `vendor/face-api.min.js` and the manifests and
shards required for the Tiny Face Detector and Face Expression models into the
`weights/` directory. Commit those files or keep them in place locally so the UI
can start without any external network access.
