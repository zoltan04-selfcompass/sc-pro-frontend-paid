// app.js — Self-Compass UI (caret stays visible, slow placeholder rotation)

let threadId = localStorage.getItem("sc_thread_id") || null;
const log = document.getElementById('log');
const form = document.getElementById('form');
const t = document.getElementById('t');
const sendBtn = document.getElementById('send');

// Focus on load so the caret blinks immediately
window.addEventListener("DOMContentLoaded", () => {
  t.focus();
});

// Calm placeholder rotation (every 10s)
const placeholders = [
  "Write a few words here… or more…",
  "What matters most now?"
];
let phIndex = 0;
setInterval(() => {
  phIndex = (phIndex + 1) % placeholders.length;
  t.setAttribute("placeholder", placeholders[phIndex]);
}, 10000);

function esc(s) {
  return s.replace(/[&<>\"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;'
  }[c]));
}

function now() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function bubble(role, html) {
  const row = document.createElement('div');
  row.className = 'row ' + (role === 'user' ? 'you' : 'bot');
  const b = document.createElement('div');
  b.className = 'bubble';
  b.innerHTML = html;
  row.appendChild(b);
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
  return b; // for live updates
}

function typing(on) {
  let el = document.getElementById('typing');
  if (on) {
    if (el) return;
    el = document.createElement('div');
    el.id = 'typing';
    el.className = 'row bot';
    el.innerHTML = '<div class="bubble"><span class="typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span></div>';
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  } else if (el) {
    el.remove();
  }
}

async function ensureThread() {
  if (threadId && threadId.startsWith('thread_')) return threadId;
  const r = await fetch('/start', { method: 'POST' });
  const j = await r.json();
  if (!j.thread_id) throw new Error(j.error || 'Thread hiba');
  threadId = j.thread_id;
  localStorage.setItem('sc_thread_id', threadId);
  return threadId;
}

// ✅ Do NOT disable the textarea (that hides the caret).
//    Use readOnly to block typing while keeping focus visible.
function setBusy(on) {
  sendBtn.disabled = on;
  t.readOnly = on;           // keeps caret; prevents input while busy
  // t.disabled = on;        // ❌ do not use; it removes focus/caret
}

bubble(
  'assistant',
  'Welcome. How are you, really? <span class="meta">(You can write in any language. No right or wrong — just share what feels true for you.)</span>'
);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = t.value.trim();
  if (!q) return;

  bubble('user', esc(q) + '<div class="meta">Te • ' + now() + '</div>');
  t.value = '';
  setBusy(true);
  t.focus(); // keep caret for the next message

  try {
    await streamChat(q);
  } catch (err) {
    console.error('[streamChat error]', err);
    bubble('assistant', '<span class="meta">Hiba: ' + esc(err?.message || String(err)) + '</span>');
  } finally {
    setBusy(false);
    t.focus(); // guarantee caret returns even on errors
  }
});

async function streamChat(text) {
  await ensureThread();
  const runBody = { assistant_id: "asst_syDHzWQ9i5vVnvBZccZR2Lzn" };

  const live = bubble('assistant', '<span class="typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>');

  const resp = await fetch('/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ thread_id: threadId, content: text, run_body: runBody })
  });

  if (!resp.ok || !resp.body) {
    live.innerHTML = '<span class="meta">Hiba a stream indításakor.</span>';
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let collected = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event = 'message', data = '';
      for (const ln of frame.split('\n')) {
        if (ln.startsWith('event:')) event = ln.slice(6).trim();
        else if (ln.startsWith('data:')) data += ln.slice(5).trim();
      }
      if (event === 'error') {
        let msg = 'stream error';
        try { msg = JSON.parse(data)?.message || msg; } catch {}
        live.innerHTML = '<span class="meta">Hiba: ' + esc(msg) + '</span>';
        return;
      }
      try {
        const j = JSON.parse(data);
        if (event === 'thread.message.delta' && j?.delta) {
          for (const c of (j.delta.content || [])) {
            if (c?.text?.value) collected += c.text.value;
          }
        } else if (event === 'thread.run.completed') {
          break;
        }
        live.innerHTML = esc(collected).replace(/\n/g, '<br>');
      } catch {}
    }
  }

  live.innerHTML = esc(collected || 'Nincs válasz.').replace(/\n/g, '<br>');
  live.innerHTML += '<div class="meta">Self-Compass AI Coach • ' + now() + '</div>';
}

// Enter = send, Shift+Enter = new line
t.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});
