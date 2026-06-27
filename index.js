// index.js – Front‑end logic for UltimateAI Parameter Editor
// This script wires up analysis, parameter customization, live preview, and finalisation.

// ------- Global State -------
const state = {
  analysis: null, // result from /api/analyze
  recommendedParams: [], // AI‑recommended (read‑only aside from required toggle)
  customParams: [], // user‑added parameters
};

// ------- Utility Functions -------
function saveState() {
  localStorage.setItem('ultimateai_state', JSON.stringify(state));
}
function loadState() {
  const data = localStorage.getItem('ultimateai_state');
  if (data) {
    const parsed = JSON.parse(data);
    state.analysis = parsed.analysis || null;
    state.recommendedParams = parsed.recommendedParams || [];
    state.customParams = parsed.customParams || [];
  }
}
function clearEditor() {
  document.getElementById('recommendedGrid').innerHTML = '';
  document.getElementById('customGrid').innerHTML = '';
  document.getElementById('specPreview').textContent = '';
}

// ------- Rendering Functions -------
function renderRecommended() {
  const container = document.getElementById('recommendedGrid');
  container.innerHTML = '';
  state.recommendedParams.forEach((p, i) => {
    const card = createParamCard(p, false, i, true); // read‑only flag
    container.appendChild(card);
  });
}

function renderCustom() {
  const container = document.getElementById('customGrid');
  container.innerHTML = '';
  state.customParams.forEach((p, i) => {
    const card = createParamCard(p, true, i, false);
    container.appendChild(card);
  });
}

function createParamCard(param, editable, index, isRecommended) {
  const card = document.createElement('div');
  card.className = 'param-card';
  if (isRecommended) card.classList.add('ai-badge');
  card.dataset.idx = index;

  // Name input
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Parameter name';
  nameInput.value = param.name || '';
  nameInput.disabled = !editable;
  nameInput.className = 'param-name';
  nameInput.addEventListener('input', () => {
    param.name = nameInput.value.trim();
    saveState();
    renderPreview();
  });
  card.appendChild(nameInput);

  // Type selector
  const typeSelect = document.createElement('select');
  const types = ['text', 'number', 'date', 'dropdown', 'gps', 'photo', 'video', 'audio', 'pdf', 'textarea', 'checkbox', 'radio', 'email', 'phone', 'url'];
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    if (t === param.type) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeSelect.disabled = !editable;
  typeSelect.className = 'param-type';
  typeSelect.addEventListener('change', () => {
    param.type = typeSelect.value;
    // Show/hide dropdown options textarea when needed
    if (param.type === 'dropdown') {
      optionsTA.style.display = 'block';
    } else {
      optionsTA.style.display = 'none';
    }
    saveState();
    renderPreview();
  });
  card.appendChild(typeSelect);

  // Required toggle
  const reqLabel = document.createElement('label');
  reqLabel.className = 'required-toggle';
  const reqChk = document.createElement('input');
  reqChk.type = 'checkbox';
  reqChk.checked = !!param.required;
  reqChk.disabled = !editable;
  reqChk.addEventListener('change', () => {
    param.required = reqChk.checked;
    saveState();
    renderPreview();
  });
  reqLabel.appendChild(reqChk);
  reqLabel.appendChild(document.createTextNode(' Required'));
  card.appendChild(reqLabel);

  // Dropdown options textarea (shown only for dropdown type)
  const optionsTA = document.createElement('textarea');
  optionsTA.className = 'dropdown-options';
  optionsTA.placeholder = 'Enter options, one per line';
  optionsTA.value = param.options ? param.options.join('\n') : '';
  optionsTA.style.display = param.type === 'dropdown' ? 'block' : 'none';
  optionsTA.disabled = !editable;
  optionsTA.addEventListener('input', () => {
    param.options = optionsTA.value.split('\n').map(v => v.trim()).filter(v => v);
    saveState();
    renderPreview();
  });
  card.appendChild(optionsTA);

  // Delete button (only for custom/editable cards)
  if (editable) {
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-card';
    delBtn.innerHTML = '✕';
    delBtn.title = 'Delete parameter';
    delBtn.addEventListener('click', () => {
      state.customParams.splice(index, 1);
      saveState();
      renderCustom();
      renderPreview();
    });
    card.appendChild(delBtn);
  }

  return card;
}

function renderPreview() {
  const preview = document.getElementById('specPreview');
  const spec = buildSpecification();
  preview.textContent = JSON.stringify(spec, null, 2);
}

function buildSpecification() {
  // Merge AI‑recommended (allow edits to required) with custom parameters
  const allParams = [];
  state.recommendedParams.forEach(p => allParams.push({ ...p }));
  state.customParams.forEach(p => allParams.push({ ...p }));
  return {
    researchTitle: state.analysis?.researchTitle || '',
    researchType: state.analysis?.researchType || '',
    methodology: state.analysis?.methodology || '',
    variables: state.analysis?.variables || { independent: [], dependent: [] },
    researchObjectives: state.analysis?.researchObjectives || [],
    researchQuestions: state.analysis?.researchQuestions || [],
    parameters: allParams,
    recommendedFeatures: state.analysis?.recommendedFeatures || []
  };
}

function renderSummary() {
  const container = document.getElementById('summaryContent');
  const spec = buildSpecification();
  container.textContent = JSON.stringify(spec, null, 2);
}

// ------- Event Handlers -------
document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const prompt = document.getElementById('prompt').value.trim();
  if (!prompt) return alert('Please enter a research idea.');

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    state.analysis = data;
    // Separate AI‑recommended parameters
    state.recommendedParams = (data.recommendedParameters || []).map(p => ({
      name: p.name || '',
      type: p.type?.toLowerCase() || 'text',
      required: !!p.required,
      // Preserve any pre‑filled dropdown options if present
      options: p.type === 'dropdown' && Array.isArray(p.options) ? p.options : []
    }));
    // Start with an empty custom list
    state.customParams = [];
    saveState();
    renderRecommended();
    renderCustom();
    renderPreview();
  } catch (e) {
    console.error(e);
    alert('Failed to analyze research idea. See console for details.');
  }
});

// Add new custom parameter
document.getElementById('addCustomBtn').addEventListener('click', () => {
  const newParam = { name: '', type: 'text', required: false };
  state.customParams.push(newParam);
  saveState();
  renderCustom();
  renderPreview();
});

// Finalise – show summary and hide editor
document.getElementById('finalizeBtn').addEventListener('click', () => {
  // Hide parameter sections and analysis button
  document.querySelector('.left-panel').style.display = 'none';
  document.getElementById('specSummary').style.display = 'block';
  renderSummary();
});

// Generate Research Tool placeholder – show Blueprint screen
document.getElementById('generateToolBtn').addEventListener('click', () => {
  const finalSpec = buildSpecification();
  console.log('🔧 Final Research Specification:', finalSpec);
  // Hide the summary view
  document.getElementById('specSummary').style.display = 'none';
  // Show the Tool Blueprint placeholder
  document.getElementById('toolBlueprint').style.display = 'block';
});

// ------- Initialization -------
loadState();
if (state.analysis) {
  renderRecommended();
  renderCustom();
  renderPreview();
}

// End of index.js
