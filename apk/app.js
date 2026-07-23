// CPU-only build for the wrapped Android app (no WebGPU inside Android WebView,
// so this uses transformers.js running on WASM instead of WebLLM).

const bootLines = [
  "checking device…",
  "no server required",
  "model runs locally on this device",
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

// CPU-friendly models only — no WebGPU available inside the Android WebView,
// so these are chosen to be small enough for interactive-ish speed on WASM.
const MODELS = [
  { id: "onnx-community/Qwen2.5-0.5B-Instruct", label: "Qwen2.5 0.5B (CPU) — recommended" },
  { id: "onnx-community/Qwen2.5-1.5B-Instruct", label: "Qwen2.5 1.5B (CPU) — slower, stronger" },
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

let generator = null;
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

  gpuHint.textContent =
    "This build runs the model on the CPU (no GPU acceleration inside the app), " +
    "so replies are slower than the browser version but still fully on-device. " +
    "First load downloads the model once — needs a connection for that step only.";

  loadBtn.addEventListener("click", loadModel);
}

async function loadModel() {
  loadBtn.disabled = true;
  modelSelect.disabled = true;
  progressWrap.hidden = false;
  addSystemMessage("Downloading and initializing model — this only happens once per model.");

  try {
    const { pipeline } = await import("https://esm.run/@huggingface/transformers");

    const seen = {};
    generator = await pipeline("text-generation", modelSelect.value, {
      dtype: "q4",
      progress_callback: (p) => {
        if (p.status === "progress" && typeof p.progress === "number") {
          seen[p.file] = p.progress;
          const vals = Object.values(seen);
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          const pct = Math.round(avg);
          progressFill.style.width = pct + "%";
          progressLabel.textContent = pct + "%";
        }
      },
    });

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

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !generator) return;

  addMessage("user", text);
  history.push({ role: "user", content: text });
  input.value = "";
  input.style.height = "auto";
  sendBtn.disabled = true;
  input.disabled = true;

  const assistantEl = addMessage("assistant", "…");

  try {
    const output = await generator(history, { max_new_tokens: 256, temperature: 0.7, do_sample: true });
    const turns = output[0].generated_text;
    const reply = turns[turns.length - 1].content;
    assistantEl.textContent = reply;
    history.push({ role: "assistant", content: reply });
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
