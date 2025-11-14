# Local face-api.js assets

This directory is intentionally kept in the repository so you can optionally host
face-api.js and its model weights locally. The optional assets are listed in
`.gitignore`, so you can download them for local testing without accidentally
committing the large binary blobs that the classroom environment rejects.

If you want to serve the assets from disk instead of the CDN fallback used by the
app, download the following files from the face-api.js v0.22.2 release and place
them next to this README:

- `face-api.min.js`
- `models/face_expression_model-weights_manifest.json`
- `models/face_expression_model-shard1`
- `models/tiny_face_detector_model-weights_manifest.json`
- `models/tiny_face_detector_model-shard1`

You can grab them via `curl`:

```sh
curl -L https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js \
  -o vendor/face-api/face-api.min.js

curl -L https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/face_expression_model-weights_manifest.json \
  -o vendor/face-api/models/face_expression_model-weights_manifest.json
curl -L https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/face_expression_model-shard1 \
  -o vendor/face-api/models/face_expression_model-shard1

curl -L https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/tiny_face_detector_model-weights_manifest.json \
  -o vendor/face-api/models/tiny_face_detector_model-weights_manifest.json
curl -L https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/tiny_face_detector_model-shard1 \
  -o vendor/face-api/models/tiny_face_detector_model-shard1
```

The app will automatically detect the presence of these files and prefer them
over the CDN when available.
