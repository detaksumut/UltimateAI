function initApp() {
  let defaultVars = window.APP_VARIABLES || [];
  let defaultParams = window.APP_PARAMETERS || [];
  
  let variables = [];
  let parameters = [];
  let records = [];
  
  try {
    let parsedVars = JSON.parse(localStorage.getItem('app_variables_v3'));
    let parsedParams = JSON.parse(localStorage.getItem('app_parameters_v3'));
    let parsedRecords = JSON.parse(localStorage.getItem('app_records_v3'));
    variables = Array.isArray(parsedVars) ? parsedVars : defaultVars;
    parameters = Array.isArray(parsedParams) ? parsedParams : defaultParams;
    records = Array.isArray(parsedRecords) ? parsedRecords : [];
  } catch(e) {
    variables = defaultVars;
    parameters = defaultParams;
    records = [];
  }

  function showTab(tabId) {
    const tabs = ['tab-home', 'tab-input', 'tab-setup', 'tab-data'];
    tabs.forEach(id => {
      const el = document.getElementById(id);
      if(el) el.style.display = 'none';
    });
    const selected = document.getElementById(tabId);
    if(selected) selected.style.display = 'block';
    window.scrollTo(0, 0);
  }

  function renderSetup() {
    const varList = document.getElementById('variable-list');
    if(varList) varList.innerHTML = variables.map((v, i) => `<div class="p-2 border-b flex justify-between items-center bg-gray-50 mb-1 rounded"><span class="font-medium text-gray-700 text-sm">${v.label} <span class="text-xs text-gray-400">(${v.type})</span></span><button type="button" data-delete-var="${i}" class="text-red-500 hover:text-red-700"><i class="fas fa-trash pointer-events-none"></i></button></div>`).join('');
    
    const paramList = document.getElementById('parameter-list');
    if(paramList) paramList.innerHTML = parameters.map((v, i) => `<div class="p-2 border-b flex justify-between items-center bg-gray-50 mb-1 rounded"><span class="font-medium text-gray-700 text-sm">${v.label} <span class="text-xs text-gray-400">(${v.type})</span></span><button type="button" data-delete-param="${i}" class="text-red-500 hover:text-red-700"><i class="fas fa-trash pointer-events-none"></i></button></div>`).join('');
  }

  function renderForm() {
    const form = document.getElementById('dynamic-form');
    if(!form) return;
    
    if(variables.length === 0 && parameters.length === 0) {
      form.innerHTML = `
        <div class="text-center p-6 bg-gray-50 rounded-xl border border-dashed border-gray-300 mb-5">
          <i class="fas fa-clipboard-list text-3xl text-gray-300 mb-3"></i>
          <p class="text-sm text-gray-500 font-medium">Belum ada Variabel atau Parameter.</p>
          <p class="text-xs text-gray-400 mt-1">Silakan tambahkan melalui menu <b>Setup</b> terlebih dahulu.</p>
        </div>
        <button type="button" disabled class="w-full bg-gray-300 text-white p-4 rounded-xl font-bold cursor-not-allowed">Simpan Data</button>
      `;
      return;
    }

    let html = '';
    if(variables.length > 0) {
      html += '<h3 class="text-sm font-bold text-gray-500 uppercase mb-3 border-b pb-1">Data Variabel</h3>';
      html += variables.map(v => `
        <div class="mb-4">
          <label class="block text-sm font-semibold mb-2 text-gray-700">${v.label}</label>
          <input type="${v.type === 'foto' ? 'file' : v.type}" id="input_${v.id}" accept="${v.type === 'foto' ? 'image/*' : ''}" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required>
        </div>
      `).join('');
    }
    
    if(parameters.length > 0) {
      html += '<h3 class="text-sm font-bold text-gray-500 uppercase mt-5 mb-3 border-b pb-1">Indikator Parameter</h3>';
      html += parameters.map(v => `
        <div class="mb-4">
          <label class="block text-sm font-semibold mb-2 text-gray-700">${v.label}</label>
          <input type="${v.type === 'foto' ? 'file' : v.type}" id="input_${v.id}" accept="${v.type === 'foto' ? 'image/*' : ''}" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" required>
        </div>
      `).join('');
    }

    html += '<button type="button" data-action="save" class="w-full bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition mt-2">Simpan Data</button>';
    form.innerHTML = html;
  }

  function renderTable() {
    const container = document.getElementById('data-table-container');
    if(!container) return;
    if(records.length === 0) {
       container.innerHTML = '<p class="text-gray-500 text-sm">Belum ada data.</p>';
       return;
    }
    const allFields = [...variables, ...parameters];
    
    let html = '<table class="w-full text-left text-sm border-collapse"><thead><tr class="bg-gray-100 border-b">';
    allFields.forEach(v => html += `<th class="p-2 border-r whitespace-nowrap">${v.label}</th>`);
    html += '</tr></thead><tbody>';
    records.forEach(row => {
       html += '<tr class="border-b hover:bg-gray-50">';
       allFields.forEach(v => html += `<td class="p-2 border-r">${row[v.id] || '-'}</td>`);
       html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  function addVariable(event) {
    event.preventDefault();
    const name = document.getElementById('new-var-name').value;
    const type = document.getElementById('new-var-type').value;
    if(!name) return;
    variables.push({ id: 'var_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_'), label: name, type: type });
    localStorage.setItem('app_variables_v3', JSON.stringify(variables));
    document.getElementById('new-var-name').value = '';
    renderSetup();
    renderForm();
    renderTable();
  }

  function addParameter(event) {
    event.preventDefault();
    const name = document.getElementById('new-param-name').value;
    const type = document.getElementById('new-param-type').value;
    if(!name) return;
    parameters.push({ id: 'param_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_'), label: name, type: type });
    localStorage.setItem('app_parameters_v3', JSON.stringify(parameters));
    document.getElementById('new-param-name').value = '';
    renderSetup();
    renderForm();
    renderTable();
  }

  function deleteVar(index) {
    variables.splice(index, 1);
    localStorage.setItem('app_variables_v3', JSON.stringify(variables));
    renderSetup();
    renderForm();
    renderTable();
  }

  function deleteParam(index) {
    parameters.splice(index, 1);
    localStorage.setItem('app_parameters_v3', JSON.stringify(parameters));
    renderSetup();
    renderForm();
    renderTable();
  }

  function saveData() {
    let row = {};
    let valid = true;
    const allFields = [...variables, ...parameters];
    allFields.forEach(v => {
       const el = document.getElementById('input_' + v.id);
       if(el && el.value) {
          row[v.id] = v.type === 'foto' ? '[File Gambar]' : el.value;
          el.value = '';
       } else {
          valid = false;
       }
    });
    if(!valid) return alert('Lengkapi semua kolom!');
    records.push(row);
    localStorage.setItem('app_records_v3', JSON.stringify(records));
    renderTable();
    alert('Data Tersimpan!');
    showTab('tab-data');
  }

  function clearData() {
    if(confirm('Hapus semua data?')) {
       records = [];
       localStorage.setItem('app_records_v3', JSON.stringify(records));
       renderTable();
    }
  }

  renderSetup();
  renderForm();
  renderTable();
  
      // Event Delegation
      document.body.addEventListener('click', function(e) {
        const target = e.target.closest('button, [data-tab], [data-action], [data-delete-var], [data-delete-param]');
        if(!target) return;
        
        if(target.hasAttribute('data-tab')) {
           showTab(target.getAttribute('data-tab'));
        } else if(target.hasAttribute('data-action')) {
           const action = target.getAttribute('data-action');
           if(action === 'save') saveData();
           if(action === 'print') window.print();
           if(action === 'clear') clearData();
        } else if(target.hasAttribute('data-delete-var')) {
           deleteVar(parseInt(target.getAttribute('data-delete-var')));
        } else if(target.hasAttribute('data-delete-param')) {
           deleteParam(parseInt(target.getAttribute('data-delete-param')));
        }
      });
      
      document.body.addEventListener('submit', function(e) {
        if(e.target.id === 'form-setup-var') addVariable(e);
        if(e.target.id === 'form-setup-param') addParameter(e);
      });
}

// Automatically execute on script load since we assume it's placed at the end of body.
initApp();
