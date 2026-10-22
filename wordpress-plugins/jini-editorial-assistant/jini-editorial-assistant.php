<?php
/**
 * Plugin Name: JINI Editorial Assistant for WordPress
 * Description: Admin-only writing workspace for JINI. Generates news drafts and saves them as WordPress drafts; editorial metadata and publication remain human-controlled.
 * Version: 1.0.0
 * Author: UltimateAI
 */

if (!defined('ABSPATH')) exit;

final class JINI_Editorial_Assistant {
    const OPTION_API_BASE = 'jini_editorial_api_base';

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('add_meta_boxes', [__CLASS__, 'add_editor_metabox']);
        add_action('admin_enqueue_scripts', [__CLASS__, 'assets']);
        add_action('admin_init', [__CLASS__, 'register_settings']);
        add_action('rest_api_init', [__CLASS__, 'register_rest_routes']);
    }

    public static function menu() {
        add_menu_page(
            'JINI Editorial Assistant',
            'JINI Editorial',
            'edit_posts',
            'jini-editorial-assistant',
            [__CLASS__, 'render'],
            'dashicons-edit-page',
            25
        );
    }

    public static function add_editor_metabox() {
        foreach (['post', 'page'] as $screen) {
            add_meta_box(
                'jini-editorial-assistant',
                'JINI — Asisten Penulisan Berita',
                [__CLASS__, 'render_editor_metabox'],
                $screen,
                'normal',
                'high'
            );
        }
    }

    public static function render_editor_metabox() {
        if (!current_user_can('edit_posts')) return;
        echo '<p>Masukkan topik berita. JINI hanya menulis judul dan isi lalu menyimpannya sebagai Draft. SEO, kategori, tag, infografik, verifikasi akhir, dan publikasi bukan tugas JINI.</p>';
        echo '<textarea id="jini-editor-topic" class="widefat" rows="3" placeholder="Topik berita, fakta awal, tanggal, dan sumber yang perlu diperiksa"></textarea>';
        echo '<p><button type="button" class="button button-primary" id="jini-editor-generate">Tulis berita &amp; simpan sebagai Draft</button> <span id="jini-editor-status" role="status" aria-live="polite"></span></p>';
        echo '<div id="jini-editor-notes-wrap" hidden><strong>Catatan verifikasi:</strong><ul id="jini-editor-notes"></ul></div>';
    }

    public static function register_rest_routes() {
        register_rest_route('jini-editorial/v1', '/generate', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'proxy_generate'],
            'permission_callback' => function() { return current_user_can('edit_posts'); },
            'args' => ['topic' => ['required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_textarea_field']]
        ]);
    }

    public static function proxy_generate(WP_REST_Request $request) {
        $base = untrailingslashit((string) get_option(self::OPTION_API_BASE, ''));
        $token = defined('JINI_EDITORIAL_API_TOKEN') ? (string) JINI_EDITORIAL_API_TOKEN : '';
        $topic = trim((string) $request->get_param('topic'));
        if (!$base || !wp_http_validate_url($base) || stripos($base, 'https://') !== 0) return new WP_Error('jini_api_not_configured', 'Atur URL HTTPS JINI di halaman JINI Editorial.', ['status' => 503]);
        if (!$token) return new WP_Error('jini_api_token_missing', 'JINI_EDITORIAL_API_TOKEN belum dikonfigurasi pada wp-config.php.', ['status' => 503]);
        if ($topic === '' || strlen($topic) > 8000) return new WP_Error('jini_invalid_topic', 'Topik wajib diisi dan maksimal 8000 karakter.', ['status' => 400]);
        $response = wp_remote_post($base . '/api/jini/editorial/draft', [
            'timeout' => 90,
            'headers' => ['Content-Type' => 'application/json', 'Authorization' => 'Bearer ' . $token],
            'body' => wp_json_encode(['topic' => $topic]),
            'redirection' => 0,
            'sslverify' => true
        ]);
        if (is_wp_error($response)) return new WP_Error('jini_api_unreachable', 'Tidak dapat menghubungi backend JINI.', ['status' => 502]);
        $status = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);
        if ($status < 200 || $status >= 300 || !is_array($body) || empty($body['success']) || empty($body['article'])) return new WP_Error('jini_generation_failed', is_array($body) ? ($body['error']['message'] ?? 'JINI gagal menghasilkan naskah.') : 'Respons JINI tidak valid.', ['status' => 502]);
        return rest_ensure_response($body);
    }

    public static function register_settings() {
        register_setting('jini_editorial_settings', self::OPTION_API_BASE, [
            'type' => 'string',
            'sanitize_callback' => function($value) {
                $value = esc_url_raw(trim((string) $value));
                return untrailingslashit($value);
            },
            'default' => ''
        ]);
    }

    public static function assets($hook) {
        $is_editor_screen = in_array($hook, ['post.php', 'post-new.php'], true);
        $is_settings_screen = $hook === 'toplevel_page_jini-editorial-assistant';
        if (!$is_editor_screen && !$is_settings_screen) return;
        wp_enqueue_script('wp-api');
        wp_enqueue_script('wp-i18n');
        wp_register_script('jini-editorial-admin', false, ['wp-api'], '1.0.0', true);
        wp_enqueue_script('jini-editorial-admin');
        wp_localize_script('jini-editorial-admin', 'JINIEditorialConfig', [
            'generateUrl' => esc_url_raw(rest_url('jini-editorial/v1/generate')),
            'restUrl' => esc_url_raw(rest_url('wp/v2/posts')),
            'nonce' => wp_create_nonce('wp_rest'),
            'canCreate' => current_user_can('edit_posts'),
        ]);
        wp_add_inline_script('jini-editorial-admin', self::javascript());
        wp_register_style('jini-editorial-admin-style', false, [], '1.0.0');
        wp_enqueue_style('jini-editorial-admin-style');
        wp_add_inline_style('jini-editorial-admin-style', self::css());
    }

    public static function render() {
        if (!current_user_can('edit_posts')) wp_die(esc_html__('You are not allowed to use JINI Editorial.', 'jini-editorial'));
        ?>
        <div class="wrap jini-editorial-wrap">
          <h1>JINI Editorial Assistant</h1>
          <p>Gunakan JINI untuk menyiapkan naskah berita. JINI hanya membuat <strong>draf</strong>; SEO, kategori, tag, gambar/infografik, verifikasi akhir, dan publikasi tetap ditangani editor manusia.</p>
          <div class="jini-editorial-card">
            <h2>Konfigurasi koneksi JINI</h2>
            <form method="post" action="options.php">
              <?php settings_fields('jini_editorial_settings'); ?>
              <label for="jini-editorial-api-base"><strong>JINI API Base URL (HTTPS)</strong></label>
              <input class="regular-text code" id="jini-editorial-api-base" name="<?php echo esc_attr(self::OPTION_API_BASE); ?>" type="url" value="<?php echo esc_attr(get_option(self::OPTION_API_BASE, '')); ?>" placeholder="https://alamat-api-jini-anda" required />
              <p class="description">URL ini dipanggil server WordPress melalui HTTPS. Token akses disimpan terpisah di wp-config.php dan tidak dikirim ke browser.</p>
              <?php submit_button('Simpan koneksi'); ?>
            </form>
          </div>
          <div class="jini-editorial-card">
            <h2>Tulis berita dengan JINI</h2>
            <label for="jini-topic"><strong>Topik / instruksi berita</strong></label>
            <textarea id="jini-topic" rows="4" class="large-text" placeholder="Contoh: Susun berita faktual tentang kebijakan ekonomi terbaru. Sertakan konteks, tanggal, dan sumber yang dapat diverifikasi."></textarea>
            <p><button type="button" class="button button-primary" id="jini-generate">Buat naskah dengan JINI</button> <span id="jini-status" role="status" aria-live="polite"></span></p>
            <div id="jini-result" hidden>
              <div id="jini-editor-notes" class="notice notice-warning inline" hidden><p><strong>Catatan verifikasi untuk editor:</strong></p><ul id="jini-editor-notes-list"></ul></div>
              <label for="jini-title"><strong>Judul berita</strong></label>
              <input id="jini-title" class="large-text" type="text" maxlength="250" />
              <label for="jini-content"><strong>Isi berita (HTML)</strong></label>
              <textarea id="jini-content" rows="16" class="large-text code"></textarea>
              <p class="description">Periksa fakta, kutipan, dan sumber sebelum menyimpan. JINI tidak mengatur kategori, tag, SEO, gambar, atau status publikasi.</p>
              <button type="button" class="button button-primary" id="jini-save-draft">Simpan sebagai draf WordPress</button>
              <span id="jini-save-status" role="status" aria-live="polite"></span>
            </div>
          </div>
          <div class="jini-editorial-card">
            <h2>Pemeliharaan situs</h2>
            <p>Gunakan menu WordPress resmi untuk pemeriksaan plugin, tema, pengguna, media, dan pengaturan. JINI Editorial tidak melakukan perubahan konfigurasi situs secara otomatis. Perubahan administratif berisiko harus ditinjau dan disetujui manusia.</p>
            <p><a class="button" href="<?php echo esc_url(admin_url('site-health.php')); ?>">Buka Kesehatan Situs</a> <a class="button" href="<?php echo esc_url(admin_url('plugins.php')); ?>">Kelola Plugin</a> <a class="button" href="<?php echo esc_url(admin_url('themes.php')); ?>">Kelola Tema</a></p>
          </div>
        </div>
        <?php
    }

    private static function javascript() {
        return <<<'JS'
(function () {
  const byId = (id) => document.getElementById(id);

  // Add a JINI writing assistant directly on WordPress Add/Edit Post.
  const editorButton = byId('jini-editor-generate');
  if (editorButton) {
    editorButton.addEventListener('click', async function () {
      const topic = byId('jini-editor-topic').value.trim();
      const status = byId('jini-editor-status');
      if (!topic) { status.textContent = 'Masukkan topik atau instruksi berita.'; return; }
      editorButton.disabled = true;
      status.textContent = 'JINI sedang menyusun naskah…';
      try {
        const response = await fetch(JINIEditorialConfig.generateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': JINIEditorialConfig.nonce },
          body: JSON.stringify({ topic })
        });
        const data = await response.json();
        if (!response.ok || !data.success || !data.article) {
          throw new Error((data.error && data.error.message) || 'JINI gagal menghasilkan naskah.');
        }
        const title = data.article.title || '';
        const content = data.article.content || '';
        // Gutenberg editor: populate the active post title and body.
        if (window.wp && wp.data && wp.data.dispatch('core/editor')) {
          wp.data.dispatch('core/editor').editPost({ title: title, content: content });
        } else {
          // Classic Editor fallback.
          const titleField = document.getElementById('title');
          const contentField = document.getElementById('content');
          if (titleField) titleField.value = title;
          if (window.tinyMCE && tinyMCE.get('content') && !tinyMCE.get('content').isHidden()) {
            tinyMCE.get('content').setContent(content);
          } else if (contentField) {
            contentField.value = content;
          }
        }
        const notes = Array.isArray(data.article.editor_notes) ? data.article.editor_notes : [];
        const notesWrap = byId('jini-editor-notes-wrap');
        const notesList = byId('jini-editor-notes');
        notesList.replaceChildren();
        notes.forEach(function (note) {
          const li = document.createElement('li');
          li.textContent = String(note);
          notesList.appendChild(li);
        });
        notesWrap.hidden = notes.length === 0;
        // Save the generated article through WordPress REST as a draft, then open that saved draft.
        status.textContent = 'Naskah selesai. Menyimpan sebagai Draft…';
        const saveResponse = await fetch(JINIEditorialConfig.restUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': JINIEditorialConfig.nonce },
          body: JSON.stringify({ title: title, content: content, status: 'draft' })
        });
        const saved = await saveResponse.json();
        if (!saveResponse.ok || !saved.id || saved.status !== 'draft') {
          throw new Error((saved.message) || 'WordPress gagal menyimpan naskah sebagai Draft.');
        }
        status.textContent = 'Berhasil disimpan sebagai Draft. Membuka editor…';
        window.location.href = 'post.php?post=' + encodeURIComponent(saved.id) + '&action=edit';
      } catch (error) {
        status.textContent = 'Gagal: ' + error.message + '. Periksa koneksi HTTPS backend JINI.';
      } finally {
        editorButton.disabled = false;
      }
    });
  }

  const button = byId('jini-generate');
  if (!button) return;

  button.addEventListener('click', async function () {
    const topic = byId('jini-topic').value.trim();
    const status = byId('jini-status');
    if (!topic) { status.textContent = 'Masukkan topik atau instruksi berita.'; return; }

    button.disabled = true;
    status.textContent = 'JINI sedang menyusun naskah…';
    byId('jini-result').hidden = true;
    try {
      const response = await fetch(JINIEditorialConfig.generateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': JINIEditorialConfig.nonce },
        body: JSON.stringify({ topic })
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.article) {
        throw new Error((data.error && data.error.message) || 'JINI gagal menghasilkan naskah.');
      }
      byId('jini-title').value = data.article.title || '';
      byId('jini-content').value = data.article.content || '';
      const notesBox = byId('jini-editor-notes');
      const notesList = byId('jini-editor-notes-list');
      notesList.replaceChildren();
      (Array.isArray(data.article.editor_notes) ? data.article.editor_notes : []).forEach(function (note) {
        const item = document.createElement('li');
        item.textContent = String(note);
        notesList.appendChild(item);
      });
      notesBox.hidden = notesList.children.length === 0;
      byId('jini-result').hidden = false;
      status.textContent = 'Naskah siap ditinjau. Belum disimpan atau diterbitkan.';
    } catch (error) {
      status.textContent = 'Gagal: ' + error.message + ' Pastikan endpoint HTTPS JINI dapat dijangkau.';
    } finally {
      button.disabled = false;
    }
  });

  byId('jini-save-draft').addEventListener('click', async function () {
    const saveButton = this;
    const status = byId('jini-save-status');
    const title = byId('jini-title').value.trim();
    const content = byId('jini-content').value.trim();
    if (!title || !content) { status.textContent = 'Judul dan isi berita wajib diisi.'; return; }
    saveButton.disabled = true;
    status.textContent = 'Menyimpan draf…';
    try {
      const response = await fetch(JINIEditorialConfig.restUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': JINIEditorialConfig.nonce },
        body: JSON.stringify({ title, content, status: 'draft' })
      });
      const data = await response.json();
      if (!response.ok || !data.id) {
        throw new Error((data.message) || 'WordPress menolak penyimpanan draf.');
      }
      status.textContent = 'Draf tersimpan. ID: ' + data.id + '. ';
      const link = document.createElement('a');
      link.href = 'post.php?post=' + encodeURIComponent(data.id) + '&action=edit';
      link.textContent = 'Buka draf';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      status.appendChild(link);
    } catch (error) {
      status.textContent = 'Gagal menyimpan draf: ' + error.message;
    } finally {
      saveButton.disabled = false;
    }
  });
})();
JS;
    }

    private static function css() {
        return '.jini-editorial-wrap{max-width:1100px}.jini-editorial-card{background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:20px;margin:18px 0}.jini-editorial-card label{display:block;margin:14px 0 6px}.jini-editorial-card textarea{max-width:100%}#jini-status,#jini-save-status{margin-left:10px}';
    }
}
JINI_Editorial_Assistant::init();
