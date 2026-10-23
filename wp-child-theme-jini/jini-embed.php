<?php
/**
 * JINI AI Inline Chat Panel - HTML Structure untuk WordPress Child Theme Newspaper
 * 
 * Penempatan: Sisipkan di header.php child theme setelah tag </nav>
 * Atau load via shortcode [jini_ai_panel] di widget atau footer.php
 * 
 * Catatan: CSS di-load oleh functions.php melalui wp_head
 *          JavaScript di-load oleh functions.php melalui wp_footer
 *          API_BASE default: http://127.0.0.1:20200 (localhost)
 *          Ganti ke HTTPS publik setelah backend diterbitkan
 */
?>
<div id="jini-chat-inline">
    <div id="jini-chat-panel-inline">
        <div id="jini-panel-header-inline">
            <div id="jini-panel-title-inline">
                <div id="jini-panel-icon-inline">J</div>
                <span>JINI AI</span>
            </div>
        </div>
        <div id="jini-messages-inline"></div>
        <div id="jini-input-area-inline">
            <input type="text" id="jini-input-inline" placeholder="Ketik pertanyaan Anda..." autocomplete="off">
            <button id="jini-send-btn-inline" aria-label="Kirim pesan">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
            </button>
        </div>
    </div>
</div>