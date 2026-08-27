const fs = require('fs');

const path = 'src/infrastructure/server/server.ts';
let content = fs.readFileSync(path, 'utf8');

// The clean HTML structure we want
const cleanHtml = `    <!-- SUBPAGE 3A: PUBLIC HOME (SINTA-style) -->
    <div id="subpage-public" class="subpage">
      <div class="desktop-layout">
        
        <!-- MAIN CONTENT (LEFT COLUMN) -->
        <div class="desktop-main">
          
          <div class="public-hero">
            <div class="sinta-logo-box">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V3a1 1 0 0 1 1-1h15v20H5a1 1 0 0 1-1-1z"/></svg>
            </div>
            <h1 id="previewHeroTitle">Ultimate Journal Enterprise</h1>
            <div class="sinta-location" id="previewHeroPublisher">MITRA EDUKASI DAN PUBLIKASI</div>
            <div class="sinta-issn">P-ISSN: <span id="previewHeroIssn">2774-328X</span></div>
          </div>
          
          <div class="metrics-grid">
            <div class="metric-card"><div class="metric-value">5.46</div><div class="metric-label">Impact</div></div>
            <div class="metric-card"><div class="metric-value">272</div><div class="metric-label">Citations</div></div>
            <div class="metric-card"><div class="metric-value" id="previewSintaValue">Sinta 2</div><div class="metric-label">Accreditation</div></div>
          </div>
          
          <div class="links-row">
            <a href="#" class="sinta-link">Scholar</a>
            <a href="#" class="sinta-link">Garuda</a>
            <a href="#" class="sinta-link">Website</a>
          </div>

          <!-- PUBLIC INNER TABS -->
          <div class="sinta-tabs" style="margin-top:6px;">
            <div class="sinta-tab active" id="pubtab-home" onclick="switchPublicTab('home')">Home</div>
            <div class="sinta-tab" id="pubtab-board" onclick="switchPublicTab('board')">Dewan Redaksi</div>
            <div class="sinta-tab" id="pubtab-scope" onclick="switchPublicTab('scope')">Scope</div>
            <div class="sinta-tab" id="pubtab-archives" onclick="switchPublicTab('archives')">Jurnal Terbit</div>
          </div>

          <!-- Public Section: Home Profile (SINTA profile) -->
          <div id="pubsection-home" class="public-section-content">
            <div class="accred-history">
              <div class="accred-history-title">History Accreditation</div>
              <div class="timeline-bar">
                <span class="timeline-year">2022</span>
                <span class="timeline-year">2023</span>
                <span class="timeline-year">2024</span>
                <span class="timeline-year">2025</span>
                <span class="timeline-year">2026</span>
              </div>
            </div>

            <div style="background:var(--neutral); padding:8px 16px; font-size:9px; font-weight:700; text-transform:uppercase; color:var(--text-muted); text-align:left;">Garuda Articles</div>
            <div class="articles-list" style="padding: 0; gap: 0;">
              <div class="sinta-article">
                <a class="sinta-article-title">Efektivitas Implementasi Manajemen Pendidikan dalam Meningkatkan Mutu Layanan di Taman Kanak-Kanak</a>
                <div class="sinta-article-publisher">Jurnal Ilmu Pendidikan dan Pembelajaran Vol. 4 No. 2 (2026): April 2026 114-122</div>
                <div class="sinta-badges-row">
                  <span class="sinta-badge-item">2026</span>
                  <span class="sinta-badge-item" style="color:#2563eb;">DOI: 10.35799/jipp.4.2.122</span>
                  <span class="sinta-badge-item orange" class="prvSintaBadgeText">Accred : Sinta 2</span>
                </div>
              </div>
              <div class="sinta-article">
                <a class="sinta-article-title">Enhancing Cognitive, Performance Skills, and Affective Competencies through Case-Based Learning among Midwifery Students: A Scoping Review</a>
                <div class="sinta-article-publisher">Jurnal Ilmu Pendidikan dan Pembelajaran Vol. 4 No. 2 (2026): April 2026 102-113</div>
                <div class="sinta-badges-row">
                  <span class="sinta-badge-item">2026</span>
                  <span class="sinta-badge-item" style="color:#2563eb;">DOI: 10.35799/jipp.4.2.102</span>
                  <span class="sinta-badge-item orange" class="prvSintaBadgeText">Accred : Sinta 2</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Public Section: Editorial Board (Dewan Redaksi) -->
          <div id="pubsection-board" class="public-section-content" style="display:none;">
            <div class="info-section">
              <h3 class="section-title" style="margin-left:0; padding-left:0;">Dewan Redaksi (Editorial Board)</h3>
              <div class="info-list-item">
                <h4>Editor in Chief</h4>
                <p>Prof. Dr. Ahmad Dahlan, M.Pd (Universitas Pendidikan Indonesia)<br/>ORCID iD: <a href="#" style="color:#a6ce39;">0000-0002-1825-0097</a></p>
              </div>
            </div>
          </div>

          <!-- Public Section: Scope (Scope Jurnal) -->
          <div id="pubsection-scope" class="public-section-content" style="display:none;">
            <div class="info-section">
              <h3 class="section-title" style="margin-left:0; padding-left:0;">Focus & Scope Jurnal</h3>
              <div class="info-list-item">
                <h4>1. Ilmu Ekonomi dan Bisnis</h4>
                <p>Teori ekonomi makro/mikro, manajemen pemasaran, manajemen keuangan, perilaku organisasi, strategi bisnis.</p>
              </div>
              <div class="info-list-item">
                <h4>2. Ilmu Akuntansi</h4>
                <p>Akuntansi keuangan, auditing, perpajakan, akuntansi manajemen, sistem informasi akuntansi, etika profesi akuntansi.</p>
              </div>
              <div class="info-list-item">
                <h4>3. Ilmu Pertanian dan Bisnis (Agribisnis)</h4>
                <p>Manajemen agribisnis, ekonomi pertanian, teknologi pertanian, manajemen rantai pasok pangan, sosiologi pedesaan.</p>
              </div>
              <div class="info-list-item">
                <h4>4. Ilmu Kesehatan</h4>
                <p>Kesehatan masyarakat, epidemiologi, administrasi & kebijakan kesehatan, gizi masyarakat, promosi kesehatan.</p>
              </div>
              <div class="info-list-item">
                <h4>5. Ilmu Kedokteran</h4>
                <p>Kedokteran klinis, biomedis, teknologi kedokteran, farmakologi klinis, manajemen pelayanan medis.</p>
              </div>
              <div class="info-list-item">
                <h4>6. Ilmu Pemerintahan</h4>
                <p>Tata kelola pemerintahan, kebijakan publik, administrasi negara, otonomi daerah, birokrasi pemerintahan.</p>
              </div>
            </div>
          </div>

          <!-- Public Section: Archives (Jurnal Terbit) -->
          <div id="pubsection-archives" class="public-section-content" style="display:none;">
            <div class="info-section">
              <h3 class="section-title" style="margin-left:0; padding-left:0;">Arsip Jurnal (Archives)</h3>
              <div class="info-list-item">
                <h4>Vol. 4 No. 2 (2026): Edisi April</h4>
                <p>Status: Diterbitkan secara resmi dengan SINTA 2.</p>
              </div>
            </div>
          </div>
          
        </div> <!-- End of desktop-main -->
        
        <!-- SIDEBAR CONTENT (RIGHT COLUMN) -->
        <div class="desktop-sidebar">
          
          <div class="sidebar-card">
            <div class="sidebar-card-header">Get More with SINTA Insight</div>
            <div class="sidebar-card-header orange" onclick="alert('Mengalihkan ke halaman Insight SINTA...')">Go to Insight</div>
            <div class="sidebar-card-body">
              <div style="font-size:10px; text-align:center; color:var(--text-muted); margin-bottom:8px;">Citation Per Year By Google Scholar</div>
              <div class="bar-chart">
                <div style="width:10%; height:5%;" class="bar"></div>
                <div style="width:10%; height:12%;" class="bar"></div>
                <div style="width:10%; height:45%;" class="bar"></div>
                <div style="width:10%; height:100%;" class="bar"></div>
                <div style="width:10%; height:20%;" class="bar"></div>
              </div>
              <div class="bar-label-container">
                <span>2022</span><span>2023</span><span>2024</span><span>2025</span><span>2026</span>
              </div>
            </div>
          </div>

          <div class="sidebar-card">
            <div class="sidebar-card-body">
              <div style="font-size:10px; text-align:center; color:var(--text-muted); margin-bottom:12px;">Journal By Google Scholar</div>
              <table class="stats-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>All</th>
                    <th>Since 2021</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="text-align:left; color:var(--text-muted);">Citation</td>
                    <td>272</td>
                    <td>272</td>
                  </tr>
                  <tr>
                    <td style="text-align:left; color:var(--text-muted);">h-index</td>
                    <td>9</td>
                    <td>9</td>
                  </tr>
                  <tr>
                    <td style="text-align:left; color:var(--text-muted);">i10-index</td>
                    <td>8</td>
                    <td>8</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div> <!-- End of desktop-sidebar -->
      </div> <!-- End of desktop-layout -->
    </div>`;

// Now we find where SUBPAGE 3A starts and where SUBPAGE 3B starts, and replace everything in between.
const startIndex = content.indexOf('<!-- SUBPAGE 3A: PUBLIC HOME (SINTA-style) -->');
const endIndex = content.indexOf('<!-- SUBPAGE 3B: EDITORIAL / WORKSPACE DASHBOARD -->');

if (startIndex !== -1 && endIndex !== -1) {
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex);
    const newContent = before + cleanHtml + '\n    \n    ' + after;
    
    // Also, make sure .public-hero has border-radius 16px!
    let finalContent = newContent.replace(
      'padding: 30px 16px 60px 16px;', 
      'padding: 30px 16px 60px 16px; border-radius: 16px;'
    );
    
    fs.writeFileSync(path, finalContent, 'utf8');
    console.log('Successfully replaced the messy HTML block with a clean structure!');
} else {
    console.log('Could not find the start or end index!');
}
