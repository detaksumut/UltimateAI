/**
 * JINI AI Inline Chat - JavaScript Engine
 * 
 * File ini dimuat via wp_footer child theme Newspaper.
 * Bergantung pada HTML structure dari jini-embed.php yang sudah dimuat sebelumnya.
 * 
 * API_BASE default: http://127.0.0.1:20200 (localhost)
 * Ganti ke HTTPS publik setelah backend diterbitkan.
 */

document.addEventListener('DOMContentLoaded', function() {
  // Wait for panel to be in DOM
  setTimeout(initJiniInline, 100);
});

function initJiniInline() {
  var API_BASE = (window.JINI_API_BASE || 'http://127.0.0.1:20200').replace(/\/$/, '');
  var CHAT_ENDPOINT = API_BASE + '/api/jini/chat';

  var panel = document.getElementById('jini-chat-panel-inline');
  var messagesContainer = document.getElementById('jini-messages-inline');
  var input = document.getElementById('jini-input-inline');
  var sendBtn = document.getElementById('jini-send-btn-inline');
  var welcome = document.getElementById('jini-welcome-inline');
  var emptyState = document.getElementById('jini-empty-state-inline');

  if (!panel || !messagesContainer) {
    console.warn('[JINI Inline] Panel elements not found in DOM yet');
    setTimeout(initJiniInline, 500);
    return;
  }

  var isSending = false;

  function ensureWelcomeElements() {
    if (!welcome) {
      welcome = document.createElement('div');
      welcome.id = 'jini-welcome-inline';
      welcome.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a1 1 0 0 1 1 1v5.59a1 1 0 0 1 1.61.91l2.72 1.36a1 1 0 0 1 .45 1.59l-1.36 2.72a1 1 0 0 1-1.59.45l-5.59-1.19a1 1 0 0 1-1-.91V3a1 1 0 0 1 1-1z"/><path d="M12h4m16 0h-4"/></svg><h3>Halo, saya JINI AI</h3><p>Tanya saya tentang berita nasional, hukum, ekonomi, dan topik lainnya.</p>';
      messagesContainer.appendChild(welcome);
    }
    if (!emptyState) {
      emptyState = document.createElement('div');
      emptyState.id = 'jini-empty-state-inline';
      emptyState.style.flex = '1';
      emptyState.style.display = 'flex';
      emptyState.style.flexDirection = 'column';
      emptyState.style.alignItems = 'center';
      emptyState.style.justifyContent = 'center';
      emptyState.style.color = '#9ca3af';
      messagesContainer.appendChild(emptyState);
    }
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function addMessage(text, type, sources) {
    ensureWelcomeElements();
    welcome.style.display = 'none';
    emptyState.style.display = 'none';

    var msg = document.createElement('div');
    msg.className = 'jini-message-inline ' + type;
    msg.style.marginBottom = '14px';
    msg.style.opacity = '0';
    msg.style.transition = 'opacity 0.2s ease';

    var bubble = document.createElement('div');
    bubble.style.padding = '10px 14px';
    bubble.style.borderRadius = '12px';
    bubble.style.maxWidth = '85%';
    bubble.style.wordWrap = 'break-word';
    bubble.style.fontSize = '14px';
    bubble.style.lineHeight = '1.5';

    if (type === 'user') {
      bubble.style.background = '#dc2626';
      bubble.style.color = '#ffffff';
      bubble.style.borderBottomRightRadius = '4px';
      bubble.textContent = text;
    } else {
      bubble.style.background = '#f3f4f6';
      bubble.style.color = '#1f2937';
      bubble.style.borderBottomLeftRadius = '4px';
      bubble.innerHTML = text;
    }

    msg.appendChild(bubble);
    messagesContainer.appendChild(msg);

    if (sources && sources.length > 0 && type === 'bot') {
      var srcBox = document.createElement('div');
      srcBox.style.margin = '4px 0 0 6px';
      srcBox.style.fontSize = '12px';
      srcBox.style.color = '#6b7280';
      var srcTitle = document.createElement('div');
      srcTitle.style.fontWeight = '600';
      srcTitle.style.marginBottom = '6px';
      srcTitle.style.color = '#dc2626';
      srcTitle.textContent = 'ðŸ"š Sumber referensi:';
      srcBox.appendChild(srcTitle);
      var srcList = document.createElement('ul');
      srcList.style.margin = '0';
      srcList.style.paddingLeft = '18px';
      sources.forEach(function(s) {
        var li = document.createElement('li');
        li.style.marginBottom = '4px';
        var a = document.createElement('a');
        a.href = s.url;
        a.textContent = s.title || s.url;
        a.style.color = '#dc2626';
        a.style.textDecoration = 'none';
        a.style.fontSize = '12.5px';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        li.appendChild(a);
        srcList.appendChild(li);
      });
      srcBox.appendChild(srcList);
      msg.appendChild(srcBox);
    }

    setTimeout(function() { msg.style.opacity = '1'; }, 10);
    scrollToBottom();
    return msg;
  }

  function setLoading(loading) {
    isSending = loading;
    sendBtn.disabled = loading;
    input.disabled = loading;
    if (loading) {
      sendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6a6 6 0 1 1 0 12a6 6 0 0 1 0-12z"/></svg>';
      sendBtn.style.background = '#9ca3af';
    } else {
      sendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
      sendBtn.style.background = '#dc2626';
    }
  }

  function showError(msg) {
    addMessage('âš ï¸ ' + msg, 'bot');
  }

  async function sendMessage() {
    var text = input.value.trim();
    if (!text || isSending) return;

    addMessage(text, 'user');
    input.value = '';
    input.focus();
    setLoading(true);

    var typingMsg = addMessage('JINI sedang mengetik...', 'bot');

    try {
      var response = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId: 'jini-inline', searchNews: true })
      });

      typingMsg.remove();

      if (!response.ok) throw new Error('HTTP ' + response.status);

      var data = await response.json();

      if (data.success && data.message) {
        addMessage(data.message, 'bot', data.sources || []);
      } else {
        showError(data.error && data.error.message ? data.error.message : 'Gagal mendapatkan respons dari JINI.');
      }
    } catch (err) {
      typingMsg.remove();
      console.error('[JINI Inline] Error:', err);
      showError('Tidak dapat terhubung ke JINI AI. Pastikan backend UltimateAI sedang berjalan.');
    } finally {
      setLoading(false);
    }
  }

  sendBtn.addEventListener('click', sendMessage);

  input.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  input.addEventListener('input', function() {
    sendBtn.disabled = !input.value.trim() || isSending;
  });

  ensureWelcomeElements();
}
