// ✅ ENHANCED app.js with Enter-to-send + bubble fade-in
const form = document.querySelector("form");
const input = form.querySelector("textarea");
const messages = document.querySelector("#messages");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = input.value.trim();
  if (!content) return;

  input.value = "";
  input.disabled = true;
  messages.innerHTML += `<div class="bubble user">${content}</div>`;

  const threadId = localStorage.getItem("threadId") || undefined;
  const startRes = await fetch("/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thread_id: threadId }),
  });
  const { thread_id } = await startRes.json();
  localStorage.setItem("threadId", thread_id);

  const streamRes = await fetch("/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, thread_id }),
  });

  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let botMsg = document.createElement("div");
  botMsg.className = "bubble bot fade";
  messages.appendChild(botMsg);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    botMsg.textContent += decoder.decode(value, { stream: true });
    messages.scrollTop = messages.scrollHeight;
  }

  input.disabled = false;
  input.focus();
});

// ✅ Allow Enter to send, Shift+Enter for newline
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});
