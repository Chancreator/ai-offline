// ---------- Boot sequence (cosmetic, then reveals the real app) ----------
const bootLines = [
  "checking device…",
  "no server required",
  "model runs locally in this browser",
  "starting…",
];

function typeBoot() {
  return new Promise((resolve) => {
    const el = document.getElementById("boot-lines");
    let i = 0, char = 0, out = "";
    function step() {
      if (i >= bootLines.length) { resolve(); return; }
      const line = bootLines[i];
      if (char <= line.length) {
        out = bootLines.slice(0, i).join("\n") + (i > 0 ? "\n" : "") + line.slice(0, char);
        el.textContent = out + "▌";
        char++;
        setTimeout(step, 14);
      } else {
        i++; char = 0;
        setTimeout(step, 120);
      }
    }
    step();
  });
}

async function boot() {
  await typeBoot();
  await new Promise(r => setTimeout(r, 250));
  document.getElementById("boot").hidden = true;
  document.getElementById("app").hidden = false;
}

// ---------- Service worker (caches the app shell for offline use) ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ---------- Connection signal indicator ----------
const signalDot = document.getElementById("signal-dot");
const signalLabel = document.getElementById("signal-label");
function setSignal(state, label) {
  signalDot.className = "signal-dot " + state;
  signalLabel.textContent = label;
}
function refreshNetworkSignal() {
  if (navigator.onLine) setSignal("online", "online");
  else setSignal("offline-error", "no connection");
}
window.addEventListener("online", refreshNetworkSignal);
window.addEventListener("offline", refreshNetworkSignal);

// ---------- Elements ----------
const modelSelect = document.getElementById("model-select");
const loadBtn = document.getElementById("load-btn");
const progressWrap = document.getElementById("progress-wrap");
const progressFill = document.getElementById("progress-fill");
const progressLabel = document.getElementById("progress-label");
const gpuHint = document.getElementById("gpu-hint");
const chatEl = document.getElementById("chat");
const composer = document.getElementById("composer");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const setupRail = document.getElementById("setup-rail");

// Small models chosen to keep the download and memory footprint workable on phones.
const MODELS = [
  { id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", label: "Qwen2.5 0.5B — smallest, fastest, ~0.4GB" },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", label: "Llama 3.2 1B — good balance, ~0.8GB" },
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", label: "Qwen2.5 1.5B — stronger, slower, ~1.1GB" },
];

function addSystemMessage(text) {
  const div = document.createElement("div");
  div.className = "msg system";
  div.textContent = text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.textContent = text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

// ---------- Model init ----------
let engine = null;
let history = [];

async function init() {
  await boot();
  refreshNetworkSignal();

  MODELS.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.label;
    modelSelect.appendChild(opt);
  });

  const hasWebGPU = "gpu" in navigator;
  if (!hasWebGPU) {
    gpuHint.textContent =
      "This browser doesn't support WebGPU, so it can't run the model on-device. " +
      "On a phone, try the latest Chrome (Android) or Safari 17.4+ (iOS).";
    loadBtn.disabled = true;
    addSystemMessage("On-device AI isn't available in this browser yet.");
    return;
  }

  gpuHint.textContent =
    "First load downloads the model once (needs a connection). " +
    "After that, everything runs on this device — no connection needed.";

  loadBtn.addEventListener("click", loadModel);
}

async function loadModel() {
  loadBtn.disabled = true;
  modelSelect.disabled = true;
  progressWrap.hidden = false;
  addSystemMessage("Downloading and initializing model — this only happens once per model.");

  try {
    const webllm = await import("https://esm.run/@mlc-ai/web-llm");
    engine = new webllm.MLCEngine();

    engine.setInitProgressCallback((report) => {
      const pct = Math.round((report.progress || 0) * 100);
      progressFill.style.width = pct + "%";
      progressLabel.textContent = pct + "%";
    });

    const selectedModel = modelSelect.value;
    await engine.reload(selectedModel);

    progressWrap.hidden = true;
    setupRail.hidden = true;
    setSignal("on-device", "running on device");
    addSystemMessage("Model ready. Everything from here runs locally — try turning on airplane mode.");
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  } catch (err) {
    console.error(err);
    addSystemMessage("Couldn't load the model: " + (err?.message || err));
    loadBtn.disabled = false;
    modelSelect.disabled = false;
    progressWrap.hidden = true;
  }
}

// ---------- Chat ----------
composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !engine) return;

  addMessage("user", text);
  history.push({ role: "user", content: text });
  input.value = "";
  input.style.height = "auto";
  sendBtn.disabled = true;
  input.disabled = true;

  const assistantEl = addMessage("assistant", "");
  let full = "";

  try {
    const stream = await engine.chat.completions.create({
      messages: history,
      stream: true,
      temperature: 0.7,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || "";
      full += delta;
      assistantEl.textContent = full;
      chatEl.scrollTop = chatEl.scrollHeight;
    }
    history.push({ role: "assistant", content: full });
  } catch (err) {
    console.error(err);
    assistantEl.textContent = "Error generating a response: " + (err?.message || err);
  } finally {
    sendBtn.disabled = false;
    input.disabled = false;
    input.focus();
  }
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 120) + "px";
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    composer.requestSubmit();
  }
});

init();
