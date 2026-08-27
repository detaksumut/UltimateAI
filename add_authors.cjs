const fs = require('fs');
const path = 'src/infrastructure/server/server.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Inject CSS classes
const cssMarker = `.logs-text { text-align: left; }`;
const newCss = `.logs-text { text-align: left; }

    /* SINTA Authors Directory Styles */
    .authors-layout {
      display: grid;
      grid-template-columns: 2.2fr 1fr;
      gap: 24px;
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
      align-items: start;
    }
    .authors-main {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }
    .authors-filter-bar {
      background: white;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0,0,0,0.02);
    }
    .filter-input-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      text-align: left;
    }
    .filter-input-group label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .filter-input {
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 11px;
      color: var(--text);
      outline: none;
      background: white;
    }
    .filter-select {
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 11px;
      color: var(--text);
      outline: none;
      background: white;
    }
    
    /* Author Card */
    .author-card {
      background: white;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      display: grid;
      grid-template-columns: 100px 1fr;
      gap: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.02);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      text-align: left;
    }
    .author-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.05);
    }
    .author-avatar-box {
      width: 100px;
      height: 120px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: #f3f4f6;
    }
    .author-avatar-box img {
      width: 100px;
      height: 120px;
      object-fit: cover;
    }
    .author-details {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .author-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .author-identity {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .author-name-verified {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .author-name-verified h3 {
      font-size: 14px;
      font-weight: 700;
      color: var(--primary);
      margin: 0;
    }
    .verified-badge {
      color: #10b981;
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }
    .author-institution {
      font-size: 10px;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .author-sinta-id {
      font-size: 9px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .id-flag {
      width: 12px;
      height: 8px;
      border: 1px solid #e5e7eb;
    }
    
    .author-subjects {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .subject-tag {
      background: #f3f4f6;
      color: #4b5563;
      font-size: 8px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 20px;
    }
    
    .author-metrics-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      border-top: 1px solid var(--border);
      padding-top: 12px;
    }
    .metric-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .metric-item-label {
      font-size: 8px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
    }
    .metric-item-val {
      font-size: 11px;
      font-weight: 600;
      color: var(--text);
    }
    
    /* Author Scores Row */
    .author-scores-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      background: #f9fafb;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid var(--border);
      flex-shrink: 0;
    }
    .score-card-item {
      text-align: center;
    }
    .score-card-val {
      font-size: 13px;
      font-weight: 700;
      color: var(--secondary);
    }
    .score-card-lbl {
      font-size: 8px;
      color: var(--text-muted);
      white-space: nowrap;
    }
    
    /* Sidebar stats layout */
    .authors-sidebar {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .insight-btn {
      width: 100%;
      background: #f59e0b;
      color: white;
      border: none;
      padding: 10px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      margin-top: 8px;
      transition: background 0.2s;
    }
    .insight-btn:hover {
      background: #d97706;
    }
    
    .academic-rank-card {
      background: white;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.02);
      text-align: center;
    }
    .academic-rank-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--primary);
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    
    /* Donut chart styles */
    .donut-chart-container {
      position: relative;
      width: 130px;
      height: 130px;
      margin: 0 auto;
    }
    .donut-chart-center {
      position: absolute;
      top: 52%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 10px;
      font-weight: 700;
      color: var(--text);
      text-align: center;
    }
    .donut-legend {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-top: 16px;
      text-align: left;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 9px;
      color: var(--text-muted);
    }
    .legend-color {
      width: 8px;
      height: 8px;
      border-radius: 2px;
      flex-shrink: 0;
    }
`;
code = code.replace(cssMarker, newCss);

// 2. Inject Nav Link
const navLinksMarker = `<div class="nav-links">
        <a class="nav-link active" onclick="switchPreviewPage('public')">Portal Home</a>
        <a class="nav-link" onclick="switchPreviewPage('dashboard')">Editorial Board</a>`;
const newNavLinks = `<div class="nav-links">
        <a class="nav-link active" onclick="switchPreviewPage('public')">Portal Home</a>
        <a class="nav-link" onclick="switchPreviewPage('authors')">Authors Directory</a>
        <a class="nav-link" onclick="switchPreviewPage('dashboard')">Editorial Board</a>`;
code = code.replace(navLinksMarker, newNavLinks);

// 3. Inject subpage-authors HTML block
const subpageMarker = `    <!-- SUBPAGE 3B: EDITORIAL / WORKSPACE DASHBOARD -->`;
const authorsHtml = `    <!-- SUBPAGE 3D: AUTHORS DIRECTORY (SINTA-style) -->
    <div id="subpage-authors" class="subpage" style="display: none;">
      <div class="authors-layout">
        
        <!-- LEFT COLUMN: AUTHORS LIST & FILTERS -->
        <div class="authors-main">
          <div class="authors-filter-bar">
            <div class="filter-input-group">
              <label for="searchAuthorsInput">Search Authors</label>
              <input type="text" id="searchAuthorsInput" class="filter-input" placeholder="Search by name, affiliation, or subjects..." oninput="renderAuthors()" />
            </div>
            <div class="filter-input-group" style="max-width: 150px;">
              <label for="sortAuthorsSelect">Sort by</label>
              <select id="sortAuthorsSelect" class="filter-select" onchange="renderAuthors()">
                <option value="sinta-3yr" selected>Sinta Score 3Yr</option>
                <option value="sinta-overall">Sinta Score Overall</option>
              </select>
            </div>
          </div>
          
          <!-- Authors list container -->
          <div id="authorsListContainer" style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Rendered dynamically -->
          </div>
        </div>
        
        <!-- RIGHT COLUMN: SIDEBAR STATS & CHARTS -->
        <div class="authors-sidebar">
          
          <div class="sidebar-card">
            <div class="sidebar-card-header">Get More with SINTA Insight</div>
            <div class="sidebar-card-header orange" onclick="alert('Mengalihkan ke halaman Insight SINTA...')">Go to Insight</div>
            <div class="sidebar-card-body">
              <div class="donut-chart-container">
                <svg width="100%" height="100%" viewBox="0 0 42 42" class="donut">
                  <circle class="donut-hole" cx="21" cy="21" r="15.91549430918954" fill="#fff"></circle>
                  <circle class="donut-ring" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#e5e7eb" stroke-width="3"></circle>
                  
                  <!-- Lektor (35%) -->
                  <circle class="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#0ea5e9" stroke-width="3" stroke-dasharray="35 65" stroke-dashoffset="25"></circle>
                  <!-- Lektor Kepala (20%) -->
                  <circle class="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#a78bfa" stroke-width="3" stroke-dasharray="20 80" stroke-dashoffset="90"></circle>
                  <!-- Asisten Ahli (25%) -->
                  <circle class="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#38bdf8" stroke-width="3" stroke-dasharray="25 75" stroke-dashoffset="70"></circle>
                  <!-- Profesor (10%) -->
                  <circle class="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#f59e0b" stroke-width="3" stroke-dasharray="10 90" stroke-dashoffset="45"></circle>
                </svg>
                <div class="donut-chart-center">
                  <div style="font-size:12px; font-weight:bold;">332.504</div>
                  <div style="font-size:8px; color:var(--text-muted); font-weight:normal;">Total Authors</div>
                </div>
              </div>
              <div class="donut-legend">
                <div class="legend-item"><span class="legend-color" style="background:#0ea5e9;"></span>Lektor (114k)</div>
                <div class="legend-item"><span class="legend-color" style="background:#a78bfa;"></span>L. Kepala (30k)</div>
                <div class="legend-item"><span class="legend-color" style="background:#38bdf8;"></span>A. Ahli (71k)</div>
                <div class="legend-item"><span class="legend-color" style="background:#f59e0b;"></span>Profesor (10k)</div>
              </div>
            </div>
          </div>

          <div class="sidebar-card">
            <div class="sidebar-card-body">
              <table class="stats-table">
                <thead>
                  <tr>
                    <th>Stats</th>
                    <th>Authors</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="text-align:left; color:var(--text-muted);">Verified Accounts</td>
                    <td>145,282</td>
                  </tr>
                  <tr>
                    <td style="text-align:left; color:var(--text-muted);">Affiliations Linked</td>
                    <td>5,551</td>
                  </tr>
                  <tr>
                    <td style="text-align:left; color:var(--text-muted);">Total Publications</td>
                    <td>2,192,829</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div> <!-- End of authors-sidebar -->
      </div> <!-- End of authors-layout -->
    </div>
    
    <!-- SUBPAGE 3B: EDITORIAL / WORKSPACE DASHBOARD -->`;
code = code.replace(subpageMarker, authorsHtml);

// 4. Update switchPreviewPage JS function
const switchPreviewPageMarker = `    function switchPreviewPage(subpage) {
      document.getElementById('subpage-public').style.display = 'none';
      document.getElementById('subpage-dashboard').style.display = 'none';
      document.getElementById('subpage-ai').style.display = 'none';
      document.getElementById('subpage-' + subpage).style.display = 'block';
    }`;
const newSwitchPreviewPage = `    function switchPreviewPage(subpage) {
      document.getElementById('subpage-public').style.display = 'none';
      document.getElementById('subpage-dashboard').style.display = 'none';
      document.getElementById('subpage-ai').style.display = 'none';
      if (document.getElementById('subpage-authors')) {
        document.getElementById('subpage-authors').style.display = 'none';
      }
      document.getElementById('subpage-' + subpage).style.display = 'block';
      
      // Update active nav link
      document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
      const activeLink = Array.from(document.querySelectorAll('.nav-link')).find(el => el.getAttribute('onclick').includes(subpage));
      if (activeLink) activeLink.classList.add('active');
    }`;
code = code.replace(switchPreviewPageMarker, newSwitchPreviewPage);

// 5. Inject Authors Data, renderAuthors method, and renderApp call hook
const authorsData = `    const authors = [
      {
        name: "Prof. Rahadian Zainul, M.Si",
        verified: true,
        institution: "Universitas Negeri Padang",
        department: "Pendidikan Kimia (S2)",
        sintaId: "5980662",
        score3yr: "2,683",
        scoreOverall: "12,662",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100&h=120",
        subjects: ["Chemistry", "Bioinformatics", "Computational Chemistry", "Technology in Education"],
        scopusHIndex: 25,
        gsHIndex: 38
      },
      {
        name: "Prof. Dr. Bens Pardamean",
        verified: true,
        institution: "Universitas Bina Nusantara",
        department: "Teknik Informatika (S2)",
        sintaId: "6043909",
        score3yr: "2,520",
        scoreOverall: "21,880",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=100&h=120",
        subjects: ["Bioinformatics", "Informatics Computing", "Educational Technology"],
        scopusHIndex: 38,
        gsHIndex: 45
      },
      {
        name: "Dr. Untung Rahardja, M.T.I",
        verified: true,
        institution: "Universitas Raharja",
        department: "Bisnis Digital (S1)",
        sintaId: "5999873",
        score3yr: "2,300",
        scoreOverall: "18,500",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100&h=120",
        subjects: ["Blockchain", "Artificial Intelligence", "Business Intelligence", "IT Management"],
        scopusHIndex: 35,
        gsHIndex: 67
      }
    ];

    function renderAuthors() {
      const container = document.getElementById('authorsListContainer');
      if (!container) return;
      
      const searchQuery = document.getElementById('searchAuthorsInput').value.toLowerCase();
      const sortVal = document.getElementById('sortAuthorsSelect').value;
      
      let filtered = [...authors];
      if (searchQuery) {
        filtered = filtered.filter(a => 
          a.name.toLowerCase().includes(searchQuery) || 
          a.institution.toLowerCase().includes(searchQuery) ||
          a.subjects.some(s => s.toLowerCase().includes(searchQuery))
        );
      }
      
      if (sortVal === 'sinta-3yr') {
        filtered.sort((x, y) => parseFloat(y.score3yr.replace(/,/g, '')) - parseFloat(x.score3yr.replace(/,/g, '')));
      } else {
        filtered.sort((x, y) => parseFloat(y.scoreOverall.replace(/,/g, '')) - parseFloat(x.scoreOverall.replace(/,/g, '')));
      }
      
      container.innerHTML = '';
      if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted); font-size: 11px;">Tidak ada penulis yang cocok dengan pencarian Anda.</div>';
        return;
      }
      
      filtered.forEach(a => {
        const subjectsHtml = a.subjects.map(s => '<span class="subject-tag">' + s + '</span>').join('');
        container.innerHTML += '<div class="author-card">' +
          '<div class="author-avatar-box">' +
            '<img src="' + a.avatar + '" alt="' + a.name + '" onerror="this.src=\\'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100&h=120\\'"/>' +
          '</div>' +
          '<div class="author-details">' +
            '<div class="author-header-row">' +
              '<div class="author-identity">' +
                '<div class="author-name-verified">' +
                  '<h3>' + a.name + '</h3>' +
                  '<svg class="verified-badge" viewBox="0 0 20 20" fill="currentColor" style="width:14px; height:14px; color:#10b981;">' +
                    '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4.13-5.69z" clip-rule="evenodd" />' +
                  '</svg>' +
                '</div>' +
                '<div class="author-institution">' + a.institution + ' - ' + a.department + '</div>' +
                '<div class="author-sinta-id">' +
                  '<img class="id-flag" src="https://upload.wikimedia.org/wikipedia/commons/9/9f/Flag_of_Indonesia.svg" alt="Indonesia Flag" style="width:12px; height:8px; border:1px solid #e5e7eb;"/>' +
                  '<span>SINTA ID : ' + a.sintaId + '</span>' +
                '</div>' +
              '</div>' +
              '<div class="author-scores-grid">' +
                '<div class="score-card-item">' +
                  '<div class="score-card-val">' + a.score3yr + '</div>' +
                  '<div class="score-card-lbl">Sinta 3Yr</div>' +
                '</div>' +
                '<div class="score-card-item">' +
                  '<div class="score-card-val">' + a.scoreOverall + '</div>' +
                  '<div class="score-card-lbl">Sinta Overall</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="author-subjects" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">' + subjectsHtml + '</div>' +
            '<div class="author-metrics-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px; border-top:1px solid var(--border); padding-top:10px; margin-top:10px;">' +
              '<div class="metric-item">' +
                '<span style="font-size:8px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Scopus H-Index</span>' +
                '<span style="font-size:11px; font-weight:600; color:var(--text);">' + a.scopusHIndex + '</span>' +
              '</div>' +
              '<div class="metric-item">' +
                '<span style="font-size:8px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Google Scholar H-Index</span>' +
                '<span style="font-size:11px; font-weight:600; color:var(--text);">' + a.gsHIndex + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      });
    }

`;
const renderAppMarker = `    // STATE ACTION: Render Dashboard UI
    function renderApp() {`;
code = code.replace(renderAppMarker, authorsData + renderAppMarker);

const renderAppEndMarker = `      if (editorQueue) {
        editorQueue.innerHTML = '';
        manuscripts.forEach(ms => {
          let badgeClass = 'review';
          if (ms.status === 'Submission') badgeClass = 'submission';
          if (ms.status === 'In Review') badgeClass = 'review';
          if (ms.status === 'Published') badgeClass = 'published';

          let actionsHtml = '';
          if (ms.status === 'Submission') {
            actionsHtml = '<div style="margin-top:8px;">' +
              '<select id="selectReviewer-' + ms.id + '" style="padding:4px; font-size:10px; border:1px solid var(--border); border-radius:4px; margin-right:8px;">' +
              '<option value="Dr. Budi Santoso">Dr. Budi Santoso</option>' +
              '<option value="Prof. Jane Doe">Prof. Jane Doe</option>' +
              '</select>' +
              '<button class="ms-btn edit" onclick="editorAssignReviewer(' + ms.id + ')">Assign Reviewer</button>' +
              '</div>';
          } else if (ms.status === 'Reviewed') {
            actionsHtml = '<div style="margin-top:8px; padding:8px; background:var(--neutral); border-radius:4px; border:1px dashed var(--border);">' +
              '<strong style="font-size:10px; color:var(--primary);">Review Result from ' + ms.reviewer + ':</strong>' +
              '<p style="font-size:10px; margin-top:4px;">Originality: ' + ms.scoreOriginality + ' | Methodology: ' + ms.scoreMethodology + '</p>' +
              '<p style="font-size:10px; margin-top:4px;"><em>"' + ms.reviewerComments + '"</em></p>' +
              '<div style="margin-top:8px;">' +
              '<button class="ms-btn publish" onclick="editorAcceptManuscript(' + ms.id + ')">Accept Manuscript (Generate DOI)</button>' +
              '</div></div>';
          } else if (ms.status === 'Accepted') {
            actionsHtml = '<div style="margin-top:8px;">' +
              '<button class="ms-btn publish" onclick="editorPublishManuscript(' + ms.id + ')">Publish to Public (SINTA Garuda)</button>' +
              '</div>';
          }

          editorQueue.innerHTML += '<div class="ms-card">' +
            '<span class="ms-badge ' + badgeClass + '">' + ms.status + '</span>' +
            '<h4 class="ms-title">' + ms.title + '</h4>' +
            actionsHtml +
            '</div>';
        });
      }
    }`;
const newRenderAppEnd = `      if (editorQueue) {
        editorQueue.innerHTML = '';
        manuscripts.forEach(ms => {
          let badgeClass = 'review';
          if (ms.status === 'Submission') badgeClass = 'submission';
          if (ms.status === 'In Review') badgeClass = 'review';
          if (ms.status === 'Published') badgeClass = 'published';

          let actionsHtml = '';
          if (ms.status === 'Submission') {
            actionsHtml = '<div style="margin-top:8px;">' +
              '<select id="selectReviewer-' + ms.id + '" style="padding:4px; font-size:10px; border:1px solid var(--border); border-radius:4px; margin-right:8px;">' +
              '<option value="Dr. Budi Santoso">Dr. Budi Santoso</option>' +
              '<option value="Prof. Jane Doe">Prof. Jane Doe</option>' +
              '</select>' +
              '<button class="ms-btn edit" onclick="editorAssignReviewer(' + ms.id + ')">Assign Reviewer</button>' +
              '</div>';
          } else if (ms.status === 'Reviewed') {
            actionsHtml = '<div style="margin-top:8px; padding:8px; background:var(--neutral); border-radius:4px; border:1px dashed var(--border);">' +
              '<strong style="font-size:10px; color:var(--primary);">Review Result from ' + ms.reviewer + ':</strong>' +
              '<p style="font-size:10px; margin-top:4px;">Originality: ' + ms.scoreOriginality + ' | Methodology: ' + ms.scoreMethodology + '</p>' +
              '<p style="font-size:10px; margin-top:4px;"><em>"' + ms.reviewerComments + '"</em></p>' +
              '<div style="margin-top:8px;">' +
              '<button class="ms-btn publish" onclick="editorAcceptManuscript(' + ms.id + ')">Accept Manuscript (Generate DOI)</button>' +
              '</div></div>';
          } else if (ms.status === 'Accepted') {
            actionsHtml = '<div style="margin-top:8px;">' +
              '<button class="ms-btn publish" onclick="editorPublishManuscript(' + ms.id + ')">Publish to Public (SINTA Garuda)</button>' +
              '</div>';
          }

          editorQueue.innerHTML += '<div class="ms-card">' +
            '<span class="ms-badge ' + badgeClass + '">' + ms.status + '</span>' +
            '<h4 class="ms-title">' + ms.title + '</h4>' +
            actionsHtml +
            '</div>';
        });
      }
      renderAuthors();
    }`;
code = code.replace(renderAppEndMarker, newRenderAppEnd);

fs.writeFileSync(path, code, 'utf8');
console.log('Authors tab added successfully with clean string concatenation!');
