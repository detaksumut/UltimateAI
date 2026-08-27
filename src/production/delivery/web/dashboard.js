/* ─── Config ──────────────────────────────────────────────────────────────── */
const API = "http://localhost:3099/api/v1";
const SSE_URL = "http://localhost:3099/events";

/* ─── State ───────────────────────────────────────────────────────────────── */
let activePanel = "generate";
let lastRequestId = null;
let sseSource = null;

/* ─── Router ──────────────────────────────────────────────────────────────── */
function showPanel(name) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(`panel-${name}`)?.classList.add("active");
  document.getElementById(`nav-${name}`)?.classList.add("active");
  activePanel = name;
  // Auto-load data for panels
  if (name === "requests")     loadRequests();
  if (name === "metrics")      loadMetrics();
  if (name === "capabilities") loadCapabilities();
  if (name === "policies")     loadPolicies();
  if (name === "health")       loadHealth();
}

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => showPanel(item.dataset.panel));
});

/* ─── API helpers ────────────────────────────────────────────────────────── */
async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", "X-API-Key": "ultimateai-dev-key" }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  return res.json();
}

/* ─── Version info ───────────────────────────────────────────────────────── */
async function loadVersionInfo() {
  try {
    const data = await api("GET", "/health");
    const v = data.version ?? {};
    document.getElementById("version-info").textContent = `API ${v.api ?? "v1"} · Phase ${v.phase ?? "H"}`;
    const s = data.status ?? "unknown";
    const hb = document.getElementById("health-badge");
    hb.textContent = `● ${s}`;
    hb.className = `health-badge status-${s}`;
  } catch { /* offline */ }
}

/* ─── GENERATE PANEL ────────────────────────────────────────────────────── */
document.getElementById("btn-generate").addEventListener("click", async () => {
  const nl = document.getElementById("gen-input").value.trim();
  if (!nl) { alert("Please describe what you want to build."); return; }

  const priority = document.getElementById("gen-priority").value;
  const previewOnly = document.getElementById("gen-preview-only").checked;

  setSpinner(true, "Initializing pipeline…");
  document.getElementById("gen-result").classList.add("hidden");

  try {
    let result;
    if (previewOnly) {
      setSpinner(true, "Analyzing requirement (preview mode)…");
      result = await api("POST", "/preview", { naturalLanguage: nl });
      renderPreviewResult(result);
    } else {
      // Simulate progress messages via SSE
      setSpinner(true, "Running full pipeline…");
      result = await api("POST", "/generate", { naturalLanguage: nl, priority });
      lastRequestId = result.requestId;
      renderGenerateResult(result);
    }
  } catch (err) {
    setSpinner(false);
    alert("Error: " + err.message);
  }
  setSpinner(false);
});

function setSpinner(show, msg = "") {
  const spin = document.getElementById("gen-spinner");
  const btn  = document.getElementById("btn-generate");
  if (show) {
    spin.classList.remove("hidden");
    document.getElementById("gen-spinner-msg").textContent = msg;
    btn.disabled = true;
  } else {
    spin.classList.add("hidden");
    btn.disabled = false;
  }
}

function renderGenerateResult(r) {
  const card = document.getElementById("gen-result");
  card.classList.remove("hidden");

  // Badge
  const badge = document.getElementById("result-badge");
  badge.textContent = r.status;
  badge.className = "badge " + (r.status ?? "").toLowerCase();

  document.getElementById("result-cert").textContent = r.certificateId ?? "";

  // KV grid
  const grid = document.getElementById("result-grid");
  grid.innerHTML = "";
  const kvs = [
    ["Request ID", r.requestId ? r.requestId.substring(0, 20) + "…" : "—"],
    ["Artifacts",  r.artifactCount ?? 0],
    ["Repairs",    r.repairCount ?? 0],
    ["Duration",   `${r.trace?.totalDurationMs ?? 0}ms`],
    ["Steps",      r.trace?.steps?.length ?? 0],
    ["Cached",     r.cached ? "Yes" : "No"]
  ];
  kvs.forEach(([label, value]) => {
    grid.innerHTML += `<div class="result-kv">
      <div class="result-kv-label">${label}</div>
      <div class="result-kv-value">${value}</div>
    </div>`;
  });

  // Explanation
  const exp = r.explanation;
  if (exp?.pattern) {
    const eb = document.getElementById("result-explanation");
    eb.innerHTML = `<div class="explanation-title">Decision Explanation</div>` +
      renderReasons("Pattern", exp.pattern) +
      renderReasons("Database", exp.database) +
      renderReasons("Deployment", exp.deployment);
  }
}

function renderPreviewResult(r) {
  const card = document.getElementById("gen-result");
  card.classList.remove("hidden");
  const badge = document.getElementById("result-badge");
  badge.textContent = "PREVIEW";
  badge.className = "badge partial";
  document.getElementById("result-cert").textContent = "Preview — no artifacts generated";
  const grid = document.getElementById("result-grid");
  grid.innerHTML = "";
  const svc = r.architecture?.services ?? [];
  [
    ["Pattern",   r.explanation?.pattern?.selected ?? "—"],
    ["Database",  r.explanation?.database?.selected ?? "—"],
    ["Services",  svc.length],
    ["Est. Artifacts", r.estimatedArtifactCount ?? 0]
  ].forEach(([label, value]) => {
    grid.innerHTML += `<div class="result-kv">
      <div class="result-kv-label">${label}</div>
      <div class="result-kv-value">${value}</div>
    </div>`;
  });
}

function renderReasons(label, block) {
  if (!block) return "";
  const reasons = (block.reasons ?? []).map(r => {
    const cls = { policy: "src-policy", "knowledge-base": "src-kb", requirement: "src-req" }[r.source] ?? "src-default";
    return `<div class="reason-row">
      <span class="reason-source ${cls}">${r.source}</span>
      <span class="reason-detail">${r.detail}</span>
    </div>`;
  }).join("");
  return `<div style="margin-bottom:10px">
    <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;font-weight:600">${label}: <strong style="color:var(--text-primary)">${block.selected}</strong></div>
    ${reasons}
  </div>`;
}

/* ─── REQUESTS PANEL ────────────────────────────────────────────────────── */
async function loadRequests() {
  try {
    const data = await api("GET", "/requests");
    const tbody = document.getElementById("requests-body");
    if (!Array.isArray(data) || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-dim);padding:24px">No requests yet</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(r => `
      <tr>
        <td class="mono" style="font-size:11px">${r.requestId}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${r.attempt}</td>
        <td style="font-size:11px">${new Date(r.updatedAt).toLocaleTimeString()}</td>
      </tr>`).join("");
  } catch { }
}

document.getElementById("btn-refresh-requests").addEventListener("click", loadRequests);

function statusBadge(s) {
  const map = { completed: "success", failed: "failed", cancelled: "cancelled", running: "partial", queued: "partial" };
  const cls = map[s] ?? "";
  return `<span class="badge ${cls}" style="font-size:10px">${s}</span>`;
}

/* ─── METRICS PANEL ──────────────────────────────────────────────────────── */
async function loadMetrics() {
  try {
    const m = await api("GET", "/metrics");
    const grid = document.getElementById("metrics-grid");
    const rate = ((m.successRate ?? 0) * 100).toFixed(1);
    const items = [
      { label: "Total Requests", value: m.totalRequests ?? 0, cls: "metric-accent" },
      { label: "Success", value: m.successCount ?? 0, cls: "metric-green" },
      { label: "Failed", value: m.failedCount ?? 0, cls: "metric-red" },
      { label: "Cancelled", value: m.cancelledCount ?? 0, cls: "" },
      { label: "Success Rate", value: `${rate}%`, cls: rate >= 80 ? "metric-green" : "metric-yellow" },
      { label: "Avg Duration", value: `${m.averageDurationMs ?? 0}ms`, cls: "metric-accent" },
      { label: "Total Repairs", value: m.totalRepairs ?? 0, cls: "metric-yellow" },
      { label: "Retries", value: m.retryCount ?? 0, cls: "" },
      { label: "Timeouts", value: m.timeoutCount ?? 0, cls: "metric-red" }
    ];
    grid.innerHTML = items.map(i => `
      <div class="metric-card">
        <div class="metric-label">${i.label}</div>
        <div class="metric-value ${i.cls}">${i.value}</div>
      </div>`).join("");
  } catch { }
}

document.getElementById("btn-refresh-metrics").addEventListener("click", loadMetrics);

/* ─── TRACE PANEL ────────────────────────────────────────────────────────── */
document.getElementById("btn-load-trace").addEventListener("click", loadTrace);
document.getElementById("trace-id-input").addEventListener("keydown", e => {
  if (e.key === "Enter") loadTrace();
});

async function loadTrace() {
  const id = document.getElementById("trace-id-input").value.trim();
  if (!id) return;
  try {
    const trace = await api("GET", `/trace/${id}`);
    const tl = document.getElementById("trace-timeline");
    if (trace.error) {
      tl.innerHTML = `<div style="color:var(--red);padding:16px">${trace.error}</div>`;
      return;
    }
    tl.innerHTML = (trace.steps ?? []).map(s => `
      <div class="trace-step">
        <div class="step-dot ${s.status}"></div>
        <div class="step-name">${s.stepName}</div>
        <div class="step-duration">${s.durationMs}ms</div>
        <div style="font-size:10px;color:var(--text-dim)">${s.status}</div>
      </div>`).join("");
  } catch { }
}

/* ─── ACTIVITY PANEL (SSE) ───────────────────────────────────────────────── */
function initSSE() {
  const statusEl = document.getElementById("sse-status");
  const feed = document.getElementById("activity-feed");

  function connect() {
    sseSource = new EventSource(SSE_URL);

    sseSource.onopen = () => {
      statusEl.textContent = "Connected";
      statusEl.className = "live-indicator connected";
      document.getElementById("live-dot").style.display = "inline-block";
    };

    sseSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "connected") return;
        appendActivity(data);
      } catch { }
    };

    sseSource.onerror = () => {
      statusEl.textContent = "Reconnecting…";
      statusEl.className = "live-indicator disconnected";
      document.getElementById("live-dot").style.display = "none";
      sseSource.close();
      setTimeout(connect, 3000);
    };
  }

  connect();

  document.getElementById("btn-clear-activity").addEventListener("click", () => {
    feed.innerHTML = `<div class="activity-empty">Waiting for events…</div>`;
  });
}

function appendActivity(data) {
  const feed = document.getElementById("activity-feed");
  const empty = feed.querySelector(".activity-empty");
  if (empty) empty.remove();

  const evtName = data.event ?? data.name ?? "Event";
  const cls = {
    GenerationStarted:   "ev-started",
    GenerationCompleted: "ev-completed",
    GenerationFailed:    "ev-failed",
    GenerationCancelled: "ev-cancelled",
    RequirementReady:    "ev-pipeline",
    BlueprintReady:      "ev-pipeline",
    StrategySelected:    "ev-pipeline",
    ArchitectureReady:   "ev-pipeline",
    DagReady:            "ev-pipeline",
    ArtifactsGenerated:  "ev-pipeline",
    CompositionReady:    "ev-pipeline",
    Certified:           "ev-completed",
    PipelineFailed:      "ev-failed"
  }[evtName] ?? "ev-default";

  const time = data.emittedAt ? new Date(data.emittedAt).toLocaleTimeString() : new Date().toLocaleTimeString();
  const reqId = data.requestId ? data.requestId.substring(0, 20) + "…" : "";

  const item = document.createElement("div");
  item.className = "activity-item";
  item.innerHTML = `
    <span class="activity-event ${cls}">${evtName}</span>
    <div class="activity-detail">
      <div class="activity-req">${reqId}</div>
    </div>
    <span class="activity-time">${time}</span>`;
  feed.prepend(item);

  // Keep max 50 events
  const items = feed.querySelectorAll(".activity-item");
  if (items.length > 50) items[items.length - 1].remove();
}

/* ─── CAPABILITIES PANEL ─────────────────────────────────────────────────── */
async function loadCapabilities() {
  try {
    const data = await api("GET", "/capabilities");
    const tbody = document.getElementById("cap-body");
    tbody.innerHTML = (data ?? []).map(m => `
      <tr>
        <td class="mono" style="font-size:11px">${m.generatorId}</td>
        <td>${m.displayName}</td>
        <td>${(m.produces ?? []).join(", ")}</td>
        <td>${(m.supportedPatterns ?? []).join(", ")}</td>
        <td><span class="maturity-${m.maturity}">${m.maturity}</span></td>
        <td class="mono" style="font-size:11px">${m.version}</td>
      </tr>`).join("");
  } catch { }
}

/* ─── POLICIES PANEL ─────────────────────────────────────────────────────── */
async function loadPolicies() {
  try {
    const data = await api("GET", "/policies");
    const tbody = document.getElementById("policy-body");
    tbody.innerHTML = (data ?? []).map(p => `
      <tr>
        <td class="mono" style="font-size:11px">${p.policyId}</td>
        <td>${p.name}</td>
        <td><span class="badge success" style="font-size:10px">v${p.version}</span></td>
        <td class="mono" style="font-size:11px">${p.effectiveFrom}</td>
      </tr>`).join("");
  } catch { }
}

/* ─── HEALTH PANEL ───────────────────────────────────────────────────────── */
async function loadHealth() {
  try {
    const data = await api("GET", "/health");
    const summary = document.getElementById("health-summary");
    const v = data.version ?? {};
    summary.innerHTML = `
      <span class="status-${data.status}" style="font-size:18px">●</span>
      <span class="status-${data.status}">${(data.status ?? "").toUpperCase()}</span>
      <span style="color:var(--text-dim);font-size:12px;font-weight:400;margin-left:8px">${data.summary ?? ""}</span>
      <div style="margin-left:auto;display:flex;gap:16px">
        ${Object.entries(v).map(([k,vl]) => `<span style="font-size:11px"><span style="color:var(--text-dim)">${k}:</span> <span class="mono">${vl}</span></span>`).join("")}
      </div>`;

    const tbody = document.getElementById("health-body");
    tbody.innerHTML = (data.components ?? []).map(c => {
      const sprint = c.detail?.match(/Sprint (\w+)/)?.[1] ?? "—";
      const detail = c.detail ?? "";
      return `<tr>
        <td>${c.name}</td>
        <td><span class="status-${c.status}">● ${c.status}</span></td>
        <td class="mono" style="font-size:11px">${sprint}</td>
        <td style="font-size:11px;color:var(--text-dim)">${detail}</td>
      </tr>`;
    }).join("");
  } catch { }
}

document.getElementById("btn-refresh-health").addEventListener("click", loadHealth);

/* ─── Boot ───────────────────────────────────────────────────────────────── */
(async function boot() {
  await loadVersionInfo();
  initSSE();
  loadCapabilities();   // preload for quick switch
  loadPolicies();
})();
