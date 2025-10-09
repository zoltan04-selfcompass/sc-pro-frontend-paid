// ✅ ENHANCED app.js — full logic + enter submit + fade-in effect
let threadId = localStorage.getItem("sc_thread_id") || null;
const log = document.getElementById('log');
const form = document.getElementById('form');
const t = document.getElementById('t');
const sendBtn = document.getElementById('send');

let currentAbort = null;

window.addEventListener("DOMContentLoaded", () => { t.focus(); });

const placeholders = ["Write a few words here… or more…", "What matters most now?"];
let phIndex = 0;
setInterval(() => {
  phIndex = (phIndex + 1) % placeholders.length;
  t.setAttribute("placeholder", placeholders[phIndex]);
}, 10000);

function esc(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }
function now() { const d = new Date(); return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

function bubble(role, html) {
  const row = document.createElement('div');
  row.className = 'row ' + (role === 'user' ? 'you' : 'bot');
  const b = document.createElement('div');
  b.className = 'bubble';
  if (role === 'assistant') b.classList.add('fade'); // ✅ fade-in for bot bubbles
  b.innerHTML = html;
  row.appendChild(b); log.appendChild(row); log.scrollTop = log.scrollHeight;
  return b;
}

function typing(on) {
  let el = document.getElementById('typing');
  if (on) {
    if (el) return;
    el = document.createElement('div');
    el.id = 'typing';
    el.className = 'row bot';
    el.innerHTML = '<div class="bubble"><span class="typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span></div>';
    log.appendChild(el); log.scrollTop = log.scrollHeight;
  } else if (el) el.remove();
}

async function ensureThread() {
  if (threadId && threadId.startsWith('thread_')) return threadId;
  const r = await fetch('/start', { method: 'POST' });
  const j = await r.json();
  if (!j.thread_id) throw new Error(j.error || 'Thread create failed');
  threadId = j.thread_id; localStorage.setItem('sc_thread_id', threadId);
  return threadId;
}

function setBusy(on) { sendBtn.disabled = on; t.readOnly = on; }

bubble('assistant', 'Welcome. How are you, really? <span class="meta">(You can write in any language. No right or wrong — just share what feels true for you.)</span>');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = t.value.trim();
  if (!q) return;

  if (currentAbort) { try { currentAbort.abort(); } catch {} currentAbort = null; }

  bubble('user', esc(q) + '<div class="meta">You • ' + now() + '</div>');
  t.value = ''; setBusy(true); t.focus();

  try { await streamChat(q); }
  catch (err) {
    console.error('[streamChat error]', err);
    bubble('assistant', '<span class="meta">Error: ' + esc(err?.message || String(err)) + '</span>');
  } finally { setBusy(false); t.focus(); }
});

// ✅ Enter = küldés, Shift+Enter = új sor
form.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

async function streamChat(text) {
  await ensureThread();
  const live = bubble('assistant', '<span class="typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>');

  currentAbort = new AbortController();
  const resp = await fetch('/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ thread_id: threadId, content: text }),
    signal: currentAbort.signal
  });

  if (!resp.ok || !resp.body) {
    live.innerHTML = '<span class="meta">Stream failed to start.</span>'; return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = ''; let collected = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, idx); buf = buf.slice(idx + 2);
      let event = 'message', data = '';
      for (const ln of frame.split('\n')) {
        if (ln.startsWith('event:')) event = ln.slice(6).trim();
        else if (ln.startsWith('data:')) data += ln.slice(5).trim();
      }
      if (event === 'delta') {
        try {
          const j = JSON.parse(data);
          if (j?.text) {
            collected += j.text;
            live.innerHTML = esc(collected).replace(/\n/g, '<br>');
          }
        } catch {}
      } else if (event === 'error') {
        let msg = 'stream error'; try { msg = JSON.parse(data)?.message || msg; } catch {}
        live.innerHTML = '<span class="meta">Error: ' + esc(msg) + '</span>'; return;
      } else if (event === 'done') {
        live.innerHTML = esc(collected || 'No response.').replace(/\n/g, '<br>');
        live.innerHTML += '<div class="meta">Self-Compass AI Coach • ' + now() + '</div>';
      }
    }
  }
}
