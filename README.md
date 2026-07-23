# Offline Chat

A phone-installable web app that runs an AI chat model entirely on-device,
in the browser, using WebGPU (via [WebLLM](https://github.com/mlc-ai/web-llm)).
There's no backend and no API key. You host the static files for free on
GitHub Pages; the model itself downloads straight to the visitor's phone
and is cached there, so after the first load it works with no connection
at all.

## How it works

- `index.html` / `style.css` / `app.js` — the chat UI.
- `app.js` loads the WebLLM library from a CDN and downloads a small
  language model directly into the browser's own cache (IndexedDB / Cache
  API) the first time someone uses the app.
- `sw.js` — a service worker that caches the app's own files (HTML/CSS/JS),
  so the interface itself loads offline too, not just the model.
- `manifest.json` — lets the browser offer "Add to Home Screen" so it opens
  like a normal app, full-screen, with its own icon.

Requirements for the *visitor's* phone: a browser with WebGPU support —
recent Chrome on Android, or Safari 17.4+ on iOS. Older browsers will show
a message explaining this instead of failing silently.

## Deploy it on GitHub Pages

1. Create a new GitHub repository (public repos get free Pages hosting).
2. Upload all the files in this folder to the repository root — commit
   them directly, or `git init && git add . && git commit -m "offline ai app" && git push`.
3. In the repo, go to **Settings → Pages**.
4. Under "Build and deployment", set **Source** to "Deploy from a branch",
   pick the `main` branch and `/ (root)` folder, then **Save**.
5. GitHub gives you a URL like `https://yourusername.github.io/your-repo/`.
   It can take a minute or two to go live the first time.

## Using it on your phone

1. Open the GitHub Pages URL in Chrome (Android) or Safari (iOS 17.4+).
2. Pick a model size and tap **Load on device** — this needs an internet
   connection, since it's downloading the model (a few hundred MB to
   ~1GB depending on which one you pick).
3. Once it says "Model ready," you can turn on airplane mode — the chat
   keeps working, since the model now lives on your device.
4. Optional: use your browser's "Add to Home Screen" (Safari: Share →
   Add to Home Screen; Chrome: menu → Add to Home screen) so it opens
   like a normal installed app.

## Notes and limits

- The model stays cached in that browser on that device. Clearing browser
  data/cache will remove it and require re-downloading.
- Bigger models are smarter but slower and use more memory — the 0.5B
  model is the safest choice for older or lower-RAM phones.
- This pattern (WebGPU + WebLLM) currently doesn't work on every mobile
  browser. If a visitor's browser doesn't support WebGPU, the app tells
  them so instead of silently failing.
- To change which models are offered, edit the `MODELS` array near the
  top of `app.js`. Any model from WebLLM's
  [supported model list](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts)
  can be swapped in by its model id.
