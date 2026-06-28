function initApp() {
  let defaultSchema = window.APP_SCHEMA || [
    { id: 'tanggal', label: 'Tanggal Input', type: 'text' },
    { id: 'catatan', label: 'Catatan Umum', type: 'text' }
  ];
  
  let schema = [];
  let records = [];
  
  try {
    let parsedSchema = JSON.parse(localStorage.getItem('app_schema_v2'));
    let parsedRecords = JSON.parse(localStorage.getItem('app_records_v2'));
    schema = Array.isArray(parsedSchema) ? parsedSchema : defaultSchema;
    records = Array.isArray(parsedRecords) ? parsedRecords : [];
  } catch(e) {
    schema = defaultSchema;
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
    const list = document.getElementById('variable-list');
    if(list) list.innerHTML = schema.map((v, i) => `<div class="p-3 border-b flex justify-between items-center bg-gray-50 mb-1 rounded"><span class="font-medium text-gray-700">${v.label} <span class="text-xs text-gray-400">(${v.type})</span></span><button type="button" data-delete="${i}" class="text-red-500 hover:text-red-700"><i class="fas fa-trash pointer-events-none"></i></button></div>`).join('');
  }

  function renderForm() {
    const form = document.getElementById('dynamic-form');
    if(!form) return;
    form.innerHTML = schema.map(v => `
      <div class="mb-5">
        <label class="block text-sm font-semibold mb-2 text-gray-700">${v.label}</label>
        <input type="${v.type === 'foto' ? 'file' : v.type}" id="input_${v.id}" accept="${v.type === 'foto' ? 'image/*' : ''}" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" required>
      </div>
    `).join('') + '<button type="button" data-action="save" class="w-full bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition">Simpan Data</button>';
  }

  function renderTable() {
    const container = document.getElementById('data-table-container');
    if(!container) return;
    if(records.length === 0) {
       container.innerHTML = '<p class="text-gray-500 text-sm">Belum ada data.</p>';
       return;
    }
    let html = '<table class="w-full text-left text-sm border-collapse"><thead><tr class="bg-gray-100 border-b">';
    schema.forEach(v => html += `<th class="p-2 border-r">${v.label}</th>`);
    html += '</tr></thead><tbody>';
    records.forEach(row => {
       html += '<tr class="border-b hover:bg-gray-50">';
       schema.forEach(v => html += `<td class="p-2 border-r">${row[v.id] || '-'}</td>`);
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
    schema.push({ id: name.toLowerCase().replace(/[^a-z0-9]/g, '_'), label: name, type: type });
    localStorage.setItem('app_schema_v2', JSON.stringify(schema));
    document.getElementById('new-var-name').value = '';
    renderSetup();
    renderForm();
    renderTable();
    alert('Parameter ditambah!');
  }

  function deleteVar(index) {
    schema.splice(index, 1);
    localStorage.setItem('app_schema_v2', JSON.stringify(schema));
    renderSetup();
    renderForm();
    renderTable();
  }

  function saveData() {
    let row = {};
    let valid = true;
    schema.forEach(v => {
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
    localStorage.setItem('app_records_v2', JSON.stringify(records));
    renderTable();
    alert('Data Tersimpan!');
    showTab('tab-data');
  }

  function clearData() {
    if(confirm('Hapus semua data?')) {
       records = [];
       localStorage.setItem('app_records_v2', JSON.stringify(records));
       renderTable();
    }
  }

  renderSetup();
  renderForm();
  renderTable();
  
  // Event Delegation
  document.body.addEventListener('click', function(e) {
    const target = e.target;
    if(target.hasAttribute('data-tab')) {
       showTab(target.getAttribute('data-tab'));
    } else if(target.hasAttribute('data-action')) {
       const action = target.getAttribute('data-action');
       if(action === 'save') saveData();
       if(action === 'print') window.print();
       if(action === 'clear') clearData();
    } else if(target.hasAttribute('data-delete')) {
       deleteVar(parseInt(target.getAttribute('data-delete')));
    }
  });
  
  document.body.addEventListener('submit', function(e) {
    if(e.target.id === 'form-setup') addVariable(e);
  });
}

// Automatically execute on script load since we assume it's placed at the end of body.
initApp();
