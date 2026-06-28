function initApp() {
  // --- ANTI-TRUNCATION FALLBACK ---
  // Forcefully inject or populate missing pieces
  let inputTab = document.getElementById('tab-input');
  if (!inputTab) {
    inputTab = document.createElement('div');
    inputTab.id = 'tab-input';
    inputTab.className = 'tab-content p-5 pt-10 bg-[#f4f7fb] min-h-screen pb-24';
    inputTab.style.display = 'none';
    document.body.appendChild(inputTab);
  }
  if (inputTab.innerHTML.trim() === '') {
    inputTab.innerHTML = `
      <h2 class="text-3xl font-bold mb-6 text-gray-800">Input Data Observasi</h2>
      <form id="dynamic-form"></form>
    `;
  }

  let setupTab = document.getElementById('tab-setup');
  if (!setupTab) {
    setupTab = document.createElement('div');
    setupTab.id = 'tab-setup';
    setupTab.className = 'tab-content p-6 pt-12 bg-white min-h-screen pb-24';
    setupTab.style.display = 'none';
    document.body.appendChild(setupTab);
  }
  if (setupTab.innerHTML.trim() === '') {
    setupTab.innerHTML = `
      <div class="mb-6 border-b pb-4">
         <h2 class="text-2xl font-bold text-gray-800">Setup Penelitian</h2>
         <p class="text-gray-500 text-sm">Kelola Variabel Dasar dan Indikator Parameter sesuai kebutuhan Anda.</p>
      </div>
      
      <!-- 1. SETUP VARIABEL -->
      <h3 class="font-bold text-gray-700 text-sm mb-2 uppercase tracking-wider">1. Setup Variabel Dasar</h3>
      <form id="form-setup-var" class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-2 flex flex-row gap-3 items-end">
        <div class="flex-1">
           <label class="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Nama Variabel</label>
           <input type="text" id="new-var-name" placeholder="Cth: Nama..." class="w-full p-2.5 text-xs rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" required>
        </div>
        <div class="w-1/3">
           <label class="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Tipe</label>
           <select id="new-var-type" class="w-full p-2.5 text-xs rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none">
             <option value="text">Teks</option>
             <option value="number">Angka</option>
           </select>
        </div>
        <button type="submit" class="bg-blue-600 text-white p-2.5 px-4 rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm transition-all duration-300"><i class="fas fa-plus"></i></button>
      </form>
      <div id="variable-list" class="bg-transparent mb-8"></div>

      <!-- 2. SETUP PARAMETER -->
      <h3 class="font-bold text-gray-700 text-sm mb-2 uppercase tracking-wider">2. Setup Parameter Ukur</h3>
      <form id="form-setup-param" class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-2 flex flex-row gap-3 items-end">
        <div class="flex-1">
           <label class="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Nama Parameter</label>
           <input type="text" id="new-param-name" placeholder="Cth: Suhu..." class="w-full p-2.5 text-xs rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" required>
        </div>
        <div class="w-1/3">
           <label class="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Tipe</label>
           <select id="new-param-type" class="w-full p-2.5 text-xs rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none">
             <option value="text">Teks</option>
             <option value="number">Angka</option>
             <option value="foto">Foto</option>
           </select>
        </div>
        <button type="submit" class="bg-green-600 text-white p-2.5 px-4 rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm transition-all duration-300"><i class="fas fa-plus"></i></button>
      </form>
      <div id="parameter-list" class="bg-transparent mb-8"></div>

      <!-- 3. SETUP SATUAN -->
      <h3 class="font-bold text-gray-700 text-sm mb-2 uppercase tracking-wider">3. Setup Satuan (Unit)</h3>
      <form id="form-setup-satuan" class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-2 flex flex-row gap-3 items-end">
        <div class="flex-1">
           <label class="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Nama Satuan</label>
           <input type="text" id="new-satuan-name" placeholder="Cth: Kg, Cm, Celcius..." class="w-full p-2.5 text-xs rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 outline-none" required>
        </div>
        <button type="submit" class="bg-purple-600 text-white p-2.5 px-4 rounded-lg text-xs font-bold hover:bg-purple-700 shadow-sm transition-all duration-300"><i class="fas fa-plus"></i></button>
      </form>
      <div id="satuan-list" class="bg-transparent mb-8"></div>

      <!-- 4. SETUP KATEGORI -->
      <h3 class="font-bold text-gray-700 text-sm mb-2 uppercase tracking-wider">4. Setup Kategori</h3>
      <form id="form-setup-kategori" class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-2 flex flex-row gap-3 items-end">
        <div class="flex-1">
           <label class="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Nama Kategori</label>
           <input type="text" id="new-kategori-name" placeholder="Cth: Balita, Remaja..." class="w-full p-2.5 text-xs rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 outline-none" required>
        </div>
        <button type="submit" class="bg-orange-600 text-white p-2.5 px-4 rounded-lg text-xs font-bold hover:bg-orange-700 shadow-sm transition-all duration-300"><i class="fas fa-plus"></i></button>
      </form>
      <div id="kategori-list" class="bg-transparent mb-8"></div>

      <!-- 5. SETUP RUMUS -->
      <h3 class="font-bold text-gray-700 text-sm mb-2 uppercase tracking-wider">5. Setup Rumus / Perhitungan</h3>
      <p class="text-[10px] text-gray-500 mb-2">💡 Tips: Ketik Nama Variabel persis seperti aslinya di dalam formula (misal: <code class="bg-gray-100 px-1">Berat / (Tinggi * Tinggi)</code>).</p>
      <form id="form-setup-rumus" class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-2 flex flex-row gap-3 items-end">
        <div class="w-1/3">
           <label class="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Nama</label>
           <input type="text" id="new-rumus-name" placeholder="Cth: BMI" class="w-full p-2.5 text-xs rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" required>
        </div>
        <div class="flex-1">
           <label class="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Formula</label>
           <input type="text" id="new-rumus-formula" placeholder="Cth: Berat / (Tinggi * Tinggi)" class="w-full p-2.5 text-xs rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" required>
        </div>
        <button type="submit" class="bg-teal-600 text-white p-2.5 px-4 rounded-lg text-xs font-bold hover:bg-teal-700 shadow-sm transition-all duration-300"><i class="fas fa-plus"></i></button>
      </form>
      <div id="rumus-list" class="bg-transparent mb-4"></div>
    `;
  }

  let dataTab = document.getElementById('tab-data');
  if (!dataTab) {
    dataTab = document.createElement('div');
    dataTab.id = 'tab-data';
    dataTab.className = 'tab-content p-6 pt-12 overflow-x-auto min-h-screen pb-24';
    dataTab.style.display = 'none';
    document.body.appendChild(dataTab);
  }
  if (dataTab.innerHTML.trim() === '') {
    dataTab.innerHTML = `
      <h2 class="text-2xl font-bold mb-4">Hasil & Ekspor</h2>
      <div class="bg-white p-4 rounded-xl shadow mb-4">
         <div id="data-table-container" class="overflow-x-auto mb-4"></div>
         <div class="flex gap-2">
            <button data-action="print" class="flex-1 bg-blue-600 text-white p-3 rounded-lg font-bold shadow hover:bg-blue-700"><i class="fas fa-file-pdf"></i> PDF</button>
            <button data-action="clear" class="flex-1 bg-red-600 text-white p-3 rounded-lg font-bold shadow hover:bg-red-700"><i class="fas fa-trash"></i> Hapus Data</button>
         </div>
      </div>
    `;
  }

  // FORCEFULLY REPLACE ANY EXISTING NAV TO GUARANTEE CORRECT DATA-TAB BINDINGS
  const existingNavs = document.querySelectorAll('nav');
  existingNavs.forEach(n => n.remove());
  
  const nav = document.createElement('nav');
  nav.className = 'fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md flex justify-around p-3 border-t shadow-[0_-10px_20px_rgba(0,0,0,0.1)] z-[9999]';
  nav.innerHTML = `
    <button data-tab="tab-home" class="flex flex-col items-center text-gray-500 hover:text-blue-600 w-full py-1"><i class="fas fa-home text-xl mb-1 pointer-events-none"></i><span class="text-[10px] font-bold pointer-events-none">Beranda</span></button>
    <button data-tab="tab-setup" class="flex flex-col items-center text-gray-500 hover:text-blue-600 w-full py-1"><i class="fas fa-cog text-xl mb-1 pointer-events-none"></i><span class="text-[10px] font-bold pointer-events-none">Setup</span></button>
    <button data-tab="tab-input" class="flex flex-col items-center text-gray-500 hover:text-blue-600 w-full py-1"><i class="fas fa-plus text-xl mb-1 pointer-events-none"></i><span class="text-[10px] font-bold pointer-events-none">Input</span></button>
    <button data-tab="tab-data" class="flex flex-col items-center text-gray-500 hover:text-blue-600 w-full py-1"><i class="fas fa-table text-xl mb-1 pointer-events-none"></i><span class="text-[10px] font-bold pointer-events-none">Data</span></button>
  `;
  document.body.appendChild(nav);
  // --- END ANTI-TRUNCATION FALLBACK ---

  let defaultVars = window.APP_VARIABLES || [];
  let defaultParams = window.APP_PARAMETERS || [];
  
  let variables = [];
  let parameters = [];
  let satuans = [];
  let kategoris = [];
  let rumuses = [];
  let records = [];
  
  try {
    let parsedVars = JSON.parse(localStorage.getItem('app_variables_v3'));
    let parsedParams = JSON.parse(localStorage.getItem('app_parameters_v3'));
    let parsedSatuans = JSON.parse(localStorage.getItem('app_satuans_v3'));
    let parsedKategoris = JSON.parse(localStorage.getItem('app_kategoris_v3'));
    let parsedRumuses = JSON.parse(localStorage.getItem('app_rumuses_v3'));
    let parsedRecords = JSON.parse(localStorage.getItem('app_records_v3'));
    variables = Array.isArray(parsedVars) ? parsedVars : defaultVars;
    parameters = Array.isArray(parsedParams) ? parsedParams : defaultParams;
    satuans = Array.isArray(parsedSatuans) ? parsedSatuans : [];
    kategoris = Array.isArray(parsedKategoris) ? parsedKategoris : [];
    rumuses = Array.isArray(parsedRumuses) ? parsedRumuses : [];
    records = Array.isArray(parsedRecords) ? parsedRecords : [];
  } catch(e) {
    variables = defaultVars;
    parameters = defaultParams;
    satuans = [];
    kategoris = [];
    rumuses = [];
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

    const satuanList = document.getElementById('satuan-list');
    if(satuanList) satuanList.innerHTML = satuans.map((v, i) => `<div class="p-2 border-b flex justify-between items-center bg-gray-50 mb-1 rounded"><span class="font-medium text-gray-700 text-sm">${v.label}</span><button type="button" data-delete-satuan="${i}" class="text-red-500 hover:text-red-700"><i class="fas fa-trash pointer-events-none"></i></button></div>`).join('');

    const kategoriList = document.getElementById('kategori-list');
    if(kategoriList) kategoriList.innerHTML = kategoris.map((v, i) => `<div class="p-2 border-b flex justify-between items-center bg-gray-50 mb-1 rounded"><span class="font-medium text-gray-700 text-sm">${v.label}</span><button type="button" data-delete-kategori="${i}" class="text-red-500 hover:text-red-700"><i class="fas fa-trash pointer-events-none"></i></button></div>`).join('');

    const rumusList = document.getElementById('rumus-list');
    if(rumusList) rumusList.innerHTML = rumuses.map((v, i) => `<div class="p-2 border-b flex justify-between items-center bg-gray-50 mb-1 rounded"><span class="font-medium text-gray-700 text-sm">${v.name} <span class="text-xs text-gray-400">(${v.formula})</span></span><button type="button" data-delete-rumus="${i}" class="text-red-500 hover:text-red-700"><i class="fas fa-trash pointer-events-none"></i></button></div>`).join('');
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
    const allFields = [...variables, ...parameters, ...rumuses.map(r => ({id: 'rumus_' + r.id, label: r.name}))];
    
    let html = '<table class="w-full text-left text-sm border-collapse"><thead><tr class="bg-gray-100 border-b">';
    allFields.forEach(v => html += `<th class="p-2 border-r whitespace-nowrap">${v.label}</th>`);
    html += '</tr></thead><tbody>';
    records.forEach(row => {
       html += '<tr class="border-b hover:bg-gray-50">';
       allFields.forEach(v => html += `<td class="p-2 border-r">${row[v.id] !== undefined ? row[v.id] : '-'}</td>`);
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

  function addSatuan(event) {
    event.preventDefault();
    const name = document.getElementById('new-satuan-name').value;
    if(!name) return;
    satuans.push({ id: 'satuan_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_'), label: name });
    localStorage.setItem('app_satuans_v3', JSON.stringify(satuans));
    document.getElementById('new-satuan-name').value = '';
    renderSetup();
  }

  function addKategori(event) {
    event.preventDefault();
    const name = document.getElementById('new-kategori-name').value;
    if(!name) return;
    kategoris.push({ id: 'kategori_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_'), label: name });
    localStorage.setItem('app_kategoris_v3', JSON.stringify(kategoris));
    document.getElementById('new-kategori-name').value = '';
    renderSetup();
  }

  function addRumus(event) {
    event.preventDefault();
    const name = document.getElementById('new-rumus-name').value;
    const formula = document.getElementById('new-rumus-formula').value;
    if(!name || !formula) return;
    rumuses.push({ id: 'rumus_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_'), name: name, formula: formula });
    localStorage.setItem('app_rumuses_v3', JSON.stringify(rumuses));
    document.getElementById('new-rumus-name').value = '';
    document.getElementById('new-rumus-formula').value = '';
    renderSetup();
    renderTable();
  }

  function deleteSatuan(index) {
    satuans.splice(index, 1);
    localStorage.setItem('app_satuans_v3', JSON.stringify(satuans));
    renderSetup();
  }

  function deleteKategori(index) {
    kategoris.splice(index, 1);
    localStorage.setItem('app_kategoris_v3', JSON.stringify(kategoris));
    renderSetup();
  }

  function deleteRumus(index) {
    rumuses.splice(index, 1);
    localStorage.setItem('app_rumuses_v3', JSON.stringify(rumuses));
    renderSetup();
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
    
    // Evaluate Formulas
    rumuses.forEach(r => {
       let expression = r.formula;
       // Replace variables by their exact label
       allFields.forEach(v => {
          // if label is "Berat", we replace "Berat" in formula with its numeric value
          let val = parseFloat(row[v.id]) || 0;
          // Escape label for regex
          let labelEscaped = v.label.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          let regex = new RegExp('\\b' + labelEscaped + '\\b', 'gi');
          expression = expression.replace(regex, val);
       });
       
       try {
          // Prevent dangerous evaluation
          if (/[a-zA-Z]/.test(expression.replace(/[Math|abs|sqrt|pow|round|floor|ceil|sin|cos|tan]/gi, ''))) {
             throw new Error('Invalid characters in formula');
          }
          let result = eval(expression);
          // Round to 2 decimal places if it's a number with decimals
          if (!isNaN(result) && result % 1 !== 0) result = result.toFixed(2);
          row['rumus_' + r.id] = result;
       } catch(e) {
          row['rumus_' + r.id] = 'Error';
       }
    });

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
        const target = e.target.closest('button, [data-tab], [data-action], [data-delete-var], [data-delete-param], [data-delete-satuan], [data-delete-kategori], [data-delete-rumus]');
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
        } else if(target.hasAttribute('data-delete-satuan')) {
           deleteSatuan(parseInt(target.getAttribute('data-delete-satuan')));
        } else if(target.hasAttribute('data-delete-kategori')) {
           deleteKategori(parseInt(target.getAttribute('data-delete-kategori')));
        } else if(target.hasAttribute('data-delete-rumus')) {
           deleteRumus(parseInt(target.getAttribute('data-delete-rumus')));
        }
      });
      
      document.body.addEventListener('submit', function(e) {
        if(e.target.id === 'form-setup-var') addVariable(e);
        if(e.target.id === 'form-setup-param') addParameter(e);
        if(e.target.id === 'form-setup-satuan') addSatuan(e);
        if(e.target.id === 'form-setup-kategori') addKategori(e);
        if(e.target.id === 'form-setup-rumus') addRumus(e);
      });
      
      function renderSetupMenu() {
        const container = document.getElementById('setup-menu-list');
        if(!container) return;
        const menus = [
          { title: 'Variabel', desc: 'Kelola daftar variabel observasi', icon: 'fa-font', color: 'blue', action: "showTab('tab-setup')" },
          { title: 'Parameter', desc: 'Atur parameter penelitian', icon: 'fa-sliders-h', color: 'green', action: "showTab('tab-setup')" },
          { title: 'Satuan', desc: 'Kelola satuan pengukuran', icon: 'fa-ruler', color: 'purple', action: "showTab('tab-setup')" },
          { title: 'Kategori', desc: 'Kelola kategori atau klasifikasi data', icon: 'fa-hashtag', color: 'orange', action: "showTab('tab-setup')" },
          { title: 'Rumus / Perhitungan', desc: 'Atur rumus dan perhitungan otomatis', icon: 'fa-calculator', color: 'teal', action: "showTab('tab-setup')" }
        ];
        container.innerHTML = menus.map(m => `
          <div class="p-3 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition" onclick="${m.action}">
             <div class="w-10 h-10 rounded-lg bg-${m.color}-50 flex items-center justify-center text-${m.color}-500">
                <i class="fas ${m.icon} text-lg"></i>
             </div>
             <div class="flex-1">
                <h4 class="text-sm font-bold text-gray-800">${m.title}</h4>
                <p class="text-[10px] text-gray-500">${m.desc}</p>
             </div>
             <i class="fas fa-chevron-right text-gray-400 text-xs"></i>
          </div>
        `).join('');
      }
      
      renderSetupMenu();
}

// Wait for DOM to be fully loaded before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
