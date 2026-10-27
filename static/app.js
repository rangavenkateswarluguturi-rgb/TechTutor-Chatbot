const MAX_ATTACHMENT_BYTES = 256 * 1024;
const MAX_ATTACHMENTS = 5;
const UNSUPPORTED_FILE_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "png", "jpg",
  "jpeg", "gif", "bmp", "webp", "tif", "tiff", "zip", "rar", "7z",
  "exe", "dll", "mp3", "mp4", "wav", "mov"
]);
const state = { subject: "AI/ML", level: "Beginner", model: "", chatId: null, sending: false, toastTimer: null, attachments: [] };
const elements = {
  welcome: document.querySelector("#welcome"), messages: document.querySelector("#messages"),
  form: document.querySelector("#chat-form"), input: document.querySelector("#message-input"),
  send: document.querySelector("#send-button"), typing: document.querySelector("#typing-indicator"),
  history: document.querySelector("#history-list"), model: document.querySelector("#model-select"),
  toast: document.querySelector("#toast"), sidebar: document.querySelector("#sidebar"),
  fileInput: document.querySelector("#file-input"), attachmentList: document.querySelector("#attachment-list"),
  contextPanel: document.querySelector("#context-panel"), backdrop: document.querySelector("#mobile-backdrop")
};

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || `Request failed (${response.status}).`);
    error.details = result;
    throw error;
  }
  return result;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 5000);
}

function updateContext() {
  document.querySelector("#selected-subject").lastChild.textContent = ` ${state.subject}`;
  document.querySelector("#context-subject").textContent = state.subject;
  document.querySelector("#context-level").textContent = state.level;
  document.querySelector("#context-model").textContent = state.model || "No model selected";
  document.querySelector("#theme-toggle span:last-child").textContent =
    document.documentElement.dataset.theme === "dark" ? "Light mode" : "Dark mode";
}

function updateOverlay() {
  const isMobile = window.matchMedia("(max-width: 1020px)").matches;
  const isOpen = elements.sidebar.classList.contains("open")
    || (isMobile && elements.contextPanel.classList.contains("open"));
  elements.backdrop.hidden = !isOpen;
  elements.backdrop.classList.toggle("visible", isOpen);
}

function closeMobilePanels() {
  elements.sidebar.classList.remove("open");
  elements.contextPanel.classList.remove("open");
  updateOverlay();
}

function addMessage(role, content, attachments = []) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  const avatar = document.createElement("span");
  avatar.className = "message-avatar";
  avatar.textContent = role === "assistant" ? "✳" : "Y";
  const body = document.createElement("div");
  body.className = "message-body";
  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = role === "assistant" ? "TECHTUTOR AI" : "YOU";
  if (role === "assistant") {
    const copyButton = document.createElement("button");
    copyButton.className = "copy-answer";
    copyButton.type = "button";
    copyButton.textContent = "Copy answer";
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(content);
        copyButton.textContent = "Copied";
        setTimeout(() => { copyButton.textContent = "Copy answer"; }, 1500);
      } catch {
        showToast("Couldn't copy automatically. Select the answer and copy it instead.");
      }
    });
    label.append(copyButton);
  }
  const text = document.createElement("div");
  text.className = "message-content";
  text.innerHTML = renderMarkdown(content);
  body.append(label, text);
  if (attachments.length) {
    const attachmentLabels = document.createElement("div");
    attachmentLabels.className = "message-attachments";
    attachments.forEach((name) => {
      const chip = document.createElement("span");
      chip.textContent = name;
      attachmentLabels.append(chip);
    });
    body.append(attachmentLabels);
  }
  article.append(avatar, body);
  elements.messages.append(article);
  article.querySelectorAll("pre").forEach((block) => {
    const button = document.createElement("button");
    button.className = "copy-code";
    button.type = "button";
    button.textContent = "Copy";
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(block.querySelector("code").textContent);
        button.textContent = "Copied!";
        setTimeout(() => { button.textContent = "Copy"; }, 1500);
      } catch {
        showToast("Couldn't copy automatically. Select the code and copy it instead.");
      }
    });
    block.append(button);
  });
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function highlightCode(escaped) {
  return escaped.replace(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:const|let|var|function|return|if|else|for|while|class|def|import|from|print|SELECT|FROM|WHERE|CREATE|TABLE|public|static|void|int|String|new|async|await|true|false|null|None|True|False|self)\b)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_$][\w$]*(?=\s*\())/g,
    (match, string, keyword, number, callable) => {
      if (string) return `<span class="syntax-string">${string}</span>`;
      if (keyword) return `<span class="syntax-keyword">${keyword}</span>`;
      if (number) return `<span class="syntax-number">${number}</span>`;
      if (callable) return `<span class="syntax-function">${callable}</span>`;
      return match;
    }
  );
}

function inlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return html;
}

function renderMarkdown(markdown) {
  const codeBlocks = [];
  let source = markdown.replace(/```([\w+#.-]*)[ \t]*\n([\s\S]*?)```/g, (_match, language, code) => {
    const index = codeBlocks.length;
    const safeLanguage = escapeHtml(language || "code");
    codeBlocks.push(`<pre><div class="code-language">${safeLanguage}</div><code>${highlightCode(escapeHtml(code.replace(/\n$/, "")))}</code></pre>`);
    return `\u0000CODE${index}\u0000`;
  });
  let html = "";
  let paragraph = [];
  let listType = "";
  const flushParagraph = () => {
    if (paragraph.length) html += `<p>${paragraph.map((line) => inlineMarkdown(line)).join("<br>")}</p>`;
    paragraph = [];
  };
  const closeList = () => { if (listType) html += `</${listType}>`; listType = ""; };
  for (const line of source.split(/\r?\n/)) {
    const heading = line.match(/^(#{1,4})\s+(.+)/);
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)/);
    if (/^\u0000CODE\d+\u0000$/.test(line)) {
      flushParagraph(); closeList();
      const index = Number(line.match(/\d+/)[0]);
      html += codeBlocks[index];
    } else if (heading) {
      flushParagraph(); closeList();
      const level = Math.min(heading[1].length + 1, 5);
      html += `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`;
    } else if (bullet || numbered) {
      flushParagraph();
      const nextType = numbered ? "ol" : "ul";
      if (listType !== nextType) { closeList(); html += `<${nextType}>`; listType = nextType; }
      html += `<li>${inlineMarkdown((bullet || numbered)[1])}</li>`;
    } else if (!line.trim()) {
      flushParagraph(); closeList();
    } else {
      closeList(); paragraph.push(line);
    }
  }
  flushParagraph(); closeList();
  return html;
}

function resetConversation() {
  state.chatId = null;
  state.attachments = [];
  elements.messages.replaceChildren();
  elements.welcome.hidden = false;
  document.querySelector("#workspace-title").textContent = "New conversation";
  document.querySelectorAll(".history-item").forEach((item) => {
    item.classList.remove("current");
    item.removeAttribute("aria-current");
  });
  renderAttachments();
  elements.input.focus();
}

async function refreshHistory() {
  try {
    const chats = await api("/chats");
    elements.history.replaceChildren();
    for (const chat of chats) {
      const button = document.createElement("button");
      button.className = `history-item${chat.id === state.chatId ? " current" : ""}`;
      if (chat.id === state.chatId) button.setAttribute("aria-current", "page");
      button.textContent = chat.title;
      button.title = chat.title;
      button.addEventListener("click", () => loadChat(chat.id));
      elements.history.append(button);
      if (chat.id === state.chatId) {
        document.querySelector("#workspace-title").textContent = chat.title;
      }
    }
    if (chats.length) {
      const clear = document.createElement("button");
      clear.className = "clear-history";
      clear.textContent = "Clear all conversations";
      clear.addEventListener("click", clearHistory);
      elements.history.append(clear);
    } else {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "Your conversations will appear here.";
      elements.history.append(empty);
    }
  } catch (error) { showToast(error.message); }
}

async function loadChat(chatId) {
  try {
    const data = await api(`/chats/${chatId}`);
    state.chatId = data.chat.id;
    document.querySelector("#workspace-title").textContent = data.chat.title;
    elements.messages.replaceChildren();
    elements.welcome.hidden = true;
    data.messages.forEach((message) => addMessage(message.role, message.content));
    document.querySelectorAll(".history-item").forEach((item) => item.classList.remove("current"));
    const selected = [...document.querySelectorAll(".history-item")].find((item) => item.textContent === data.chat.title);
    if (selected) {
      selected.classList.add("current");
      selected.setAttribute("aria-current", "page");
    }
    closeMobilePanels();
    elements.input.focus();
  } catch (error) { showToast(error.message); }
}

async function clearHistory() {
  if (!window.confirm("Delete all saved conversations? This cannot be undone.")) return;
  try {
    await api("/chats", { method: "DELETE" });
    resetConversation();
    await refreshHistory();
  } catch (error) { showToast(error.message); }
}

function renderAttachments() {
  elements.attachmentList.replaceChildren();
  state.attachments.forEach((file, index) => {
    const chip = document.createElement("div");
    chip.className = "attachment-chip";
    const name = document.createElement("span");
    name.textContent = file.name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${file.name}`);
    remove.addEventListener("click", () => {
      state.attachments.splice(index, 1);
      renderAttachments();
    });
    chip.append(name, remove);
    elements.attachmentList.append(chip);
  });
  elements.attachmentList.hidden = state.attachments.length === 0;
}

async function sendMessage(message, attachments) {
  if (state.sending || !message.trim()) return;
  state.sending = true;
  elements.send.disabled = true;
  elements.welcome.hidden = true;
  addMessage("user", message, attachments.map((file) => file.name));
  elements.typing.hidden = false;
  try {
    const result = await api("/chat", {
      method: "POST",
      body: JSON.stringify({
        message, chat_id: state.chatId, subject: state.subject,
        level: state.level, model: state.model, attachments
      })
    });
    state.chatId = result.chat_id;
    addMessage("assistant", result.answer);
    state.attachments = [];
    renderAttachments();
    await refreshHistory();
  } catch (error) {
    if (error.details && error.details.chat_id) state.chatId = error.details.chat_id;
    addMessage("assistant", `**I couldn't send your message.**\n\n${error.message}`);
    if (error.message.includes("Cannot connect to Ollama")) {
      showToast("Start Ollama from the Start menu, or open a terminal and run `ollama serve`.");
    } else {
      showToast(error.message);
    }
    await refreshHistory();
  } finally {
    state.sending = false;
    elements.send.disabled = false;
    elements.typing.hidden = true;
    elements.input.focus();
  }
}

async function initialise() {
  try {
    const [models, preferences] = await Promise.all([api("/models"), api("/preferences")]);
    elements.model.replaceChildren();
    if (!models.models.length) {
      elements.model.add(new Option("No models installed", ""));
      const status = document.querySelector("#model-status");
      status.classList.add("disconnected");
      status.lastElementChild.textContent = "No local models installed";
      document.querySelector("#context-model-status").textContent = "Install a model with Ollama";
      showToast("No Ollama models are installed. Run `ollama pull llama3.2` in a terminal.");
    } else {
      models.models.forEach((model) => elements.model.add(new Option(model, model)));
      state.model = models.model || models.models[0];
      elements.model.value = state.model;
      const status = document.querySelector("#model-status");
      status.classList.add("connected");
      status.classList.remove("disconnected");
      status.lastElementChild.textContent = "Ollama is ready";
      document.querySelector("#context-model-status").textContent = "Available on this device";
    }
    document.documentElement.dataset.theme = preferences.theme;
    state.level = preferences.level;
    document.querySelectorAll(".level-button").forEach((button) => {
      button.classList.toggle("selected", button.dataset.level === state.level);
      button.setAttribute("aria-pressed", String(button.dataset.level === state.level));
    });
    updateContext();
  } catch (error) {
    elements.model.replaceChildren(new Option("Ollama unavailable", ""));
    const status = document.querySelector("#model-status");
    status.classList.add("disconnected");
    status.lastElementChild.textContent = "Ollama unavailable";
    document.querySelector("#context-model-status").textContent = "Check that Ollama is running";
    updateContext();
    showToast(error.message);
  }
  await refreshHistory();
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = elements.input.value.trim();
  if (!message) return;
  const attachments = [...state.attachments];
  elements.input.value = "";
  elements.input.style.height = "auto";
  sendMessage(message, attachments);
});
document.querySelector("#attach-button").addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", async () => {
  const chosenFiles = [...elements.fileInput.files];
  elements.fileInput.value = "";
  if (state.attachments.length + chosenFiles.length > MAX_ATTACHMENTS) {
    showToast(`Attach no more than ${MAX_ATTACHMENTS} files at a time.`);
    return;
  }
  try {
    const newAttachments = [];
    for (const file of chosenFiles) {
      const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
      if (UNSUPPORTED_FILE_EXTENSIONS.has(extension)) {
        throw new Error(`${file.name} is not supported yet. Attach a text-based file instead.`);
      }
      if ([...state.attachments, ...newAttachments].some((attachment) => attachment.name === file.name)) {
        throw new Error(`${file.name} is already attached.`);
      }
      const totalSize = [...state.attachments, ...newAttachments]
        .reduce((total, attachment) => total + attachment.size, 0);
      if (totalSize + file.size > MAX_ATTACHMENT_BYTES) {
        throw new Error("Attachments must total 256 KB or less.");
      }
      let content;
      try {
        content = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      } catch {
        throw new Error(`${file.name} is a binary or unsupported-encoding file. Attach a text-readable file instead.`);
      }
      if (content.includes("\u0000")) {
        throw new Error(`${file.name} is a binary file. Attach a text-readable file instead.`);
      }
      newAttachments.push({ name: file.name, content, size: file.size });
    }
    state.attachments.push(...newAttachments);
    renderAttachments();
  } catch (error) {
    showToast(error.message);
  }
});
elements.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    elements.form.requestSubmit();
  }
});
elements.input.addEventListener("input", () => {
  elements.input.style.height = "auto";
  elements.input.style.height = `${Math.min(elements.input.scrollHeight, 160)}px`;
});
document.querySelectorAll(".subject-card").forEach((button) => button.addEventListener("click", () => {
  state.subject = button.dataset.subject;
  document.querySelectorAll(".subject-card").forEach((card) => {
    card.classList.toggle("active", card === button);
    card.setAttribute("aria-pressed", String(card === button));
  });
  updateContext();
  elements.input.focus();
}));
document.querySelectorAll(".starter-card").forEach((button) => button.addEventListener("click", () => {
  elements.input.value = button.dataset.prompt;
  elements.input.dispatchEvent(new Event("input", { bubbles: true }));
  elements.input.focus();
}));
document.querySelectorAll(".level-button").forEach((button) => button.addEventListener("click", async () => {
  state.level = button.dataset.level;
  document.querySelectorAll(".level-button").forEach((item) => {
    item.classList.toggle("selected", item === button);
    item.setAttribute("aria-pressed", String(item === button));
  });
  updateContext();
  try { await api("/preferences", { method: "PUT", body: JSON.stringify({ level: state.level }) }); }
  catch (error) { showToast(error.message); }
}));
elements.model.addEventListener("change", async () => {
  if (!elements.model.value) return;
  try {
    await api("/preferences", { method: "PUT", body: JSON.stringify({ model: elements.model.value }) });
    state.model = elements.model.value;
    updateContext();
  } catch (error) { showToast(error.message); }
});
document.querySelector("#theme-toggle").addEventListener("click", async () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  updateContext();
  try { await api("/preferences", { method: "PUT", body: JSON.stringify({ theme }) }); }
  catch (error) { showToast(error.message); }
});
document.querySelector("#new-chat").addEventListener("click", () => {
  resetConversation();
  closeMobilePanels();
  refreshHistory();
});
document.querySelector("#mobile-menu").addEventListener("click", () => {
  elements.contextPanel.classList.remove("open");
  elements.sidebar.classList.toggle("open");
  updateOverlay();
});
document.querySelector("#collapse-sidebar").addEventListener("click", () => {
  const isCollapsed = elements.sidebar.classList.toggle("collapsed");
  const button = document.querySelector("#collapse-sidebar");
  button.setAttribute("aria-label", isCollapsed ? "Expand workspace navigation" : "Collapse workspace navigation");
  button.title = isCollapsed ? "Expand navigation" : "Collapse navigation";
});
document.querySelector("#context-toggle").addEventListener("click", () => {
  const isMobile = window.matchMedia("(max-width: 1020px)").matches;
  if (isMobile) {
    elements.sidebar.classList.remove("open");
    elements.contextPanel.classList.toggle("open");
    updateOverlay();
    return;
  }
  const isCollapsed = elements.contextPanel.classList.toggle("collapsed");
  document.querySelector("#context-toggle").setAttribute("aria-expanded", String(!isCollapsed));
});
document.querySelector("#mobile-context").addEventListener("click", () => {
  elements.sidebar.classList.remove("open");
  elements.contextPanel.classList.add("open");
  updateOverlay();
});
document.querySelector("#close-context").addEventListener("click", () => {
  elements.contextPanel.classList.remove("open");
  if (window.matchMedia("(max-width: 1020px)").matches) {
    updateOverlay();
  } else {
    elements.contextPanel.classList.add("collapsed");
    document.querySelector("#context-toggle").setAttribute("aria-expanded", "false");
  }
});
elements.backdrop.addEventListener("click", closeMobilePanels);
window.addEventListener("resize", updateOverlay);
initialise();
