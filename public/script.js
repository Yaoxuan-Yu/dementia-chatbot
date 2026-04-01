const API_URL = "https://us-central1-ai-humanity-g3.cloudfunctions.net/chatbot";

const firebaseConfig = {
  apiKey: "AIzaSyBkcFma_F3MqKqNgmRyj9k_XO0XLAmL60o",
  authDomain: "ai-humanity-g3.firebaseapp.com",
  projectId: "ai-humanity-g3",
  storageBucket: "ai-humanity-g3.firebasestorage.app",
  messagingSenderId: "42108703629",
  appId: "1:42108703629:web:ac1f6113b086fc316ba3c4",
  measurementId: "G-ZHEYJ9QMG5"
};

if (typeof firebase !== "undefined") {
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
}

let auth = firebase.auth();
let currentChipsContainer = null;
let chatHistory = [];
let allChats = JSON.parse(localStorage.getItem("allChats")) || [];
let currentChatId = null;

// ========================== INIT
document.addEventListener("DOMContentLoaded", () => {
  loadLastChat();
  renderHistoryButtons();

  auth.onAuthStateChanged(user => {
    if (!user) { window.location.href = "login.html"; return; }
    document.getElementById("user-name").textContent = user.email.split("@")[0];
  });

  const input = document.getElementById("user-input");
  input?.addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
  });

  document.getElementById("sidebarToggle")?.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    renderHistoryButtons();
  });

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    auth.signOut().then(() => window.location.href = "login.html");
  });
});

// ========================== CHAT HISTORY
function loadLastChat() {
  if (allChats.length > 0) {
    currentChatId = allChats[0].id;
    chatHistory = [...allChats[0].messages];
  } else chatHistory = [];
  refreshChatUI();
}

function saveCurrentChat() {
  if (chatHistory.length === 0) return;
  const exist = allChats.find(c => c.id === currentChatId);
  if (exist) exist.messages = chatHistory;
  else {
    currentChatId = "chat_" + Date.now();
    allChats.unshift({
      id: currentChatId,
      title: "Chat " + (allChats.length + 1),
      messages: chatHistory
    });
  }
  localStorage.setItem("allChats", JSON.stringify(allChats));
  renderHistoryButtons();
}

function newChat() {
  saveCurrentChat();
  chatHistory = [];
  currentChatId = null;
  localStorage.removeItem("dialogflowSessionId");
  refreshChatUI();
}

function loadChat(chatId) {
  saveCurrentChat();
  const chat = allChats.find(c => c.id === chatId);
  if (chat) {
    currentChatId = chat.id;
    chatHistory = [...chat.messages];
    refreshChatUI();
  }
}
function renderHistoryButtons() {
  const list = document.getElementById("history-list");
  const sidebar = document.getElementById("sidebar");
  if (!list || !sidebar) return;

  list.innerHTML = "";

  if (sidebar.classList.contains("collapsed")) {
    return;
  }

  allChats.forEach((chat) => {
    // ✅ CHANGE: Use DIV instead of BUTTON — fixes space forever
    const item = document.createElement("div");
    item.className = `chat-history-btn ${currentChatId === chat.id ? "active" : ""}`;
    item.style.cursor = "pointer";

    // Title
    const titleSpan = document.createElement("span");
    titleSpan.className = "chat-title-text";
    titleSpan.textContent = chat.title;
    titleSpan.title = chat.title;

    // Icons
    const actions = document.createElement("div");
    actions.className = "d-flex gap-2";

    // EDIT ICON
    const edit = document.createElement("i");
    edit.className = "bi bi-pencil";
    edit.style.fontSize = "11px";
    edit.onclick = (e) => {
      e.stopPropagation();

      const input = document.createElement("input");
      input.value = chat.title;
      input.style.fontSize = "12px";
      input.style.padding = "2px 4px";
      input.style.width = "90px";
      input.style.borderRadius = "4px";
      input.style.border = "1px solid #ccc";

      item.innerHTML = "";
      item.appendChild(input);
      input.focus();

      const saveTitle = () => {
        let final = input.value.trim();
        if (final.split(" ").length > 5) {
          final = final.split(" ").slice(0, 5).join(" ");
        }
        chat.title = final || chat.title;
        localStorage.setItem("allChats", JSON.stringify(allChats));
        renderHistoryButtons();
      };

      input.onkeydown = (e) => {
        if (e.key === "Enter") saveTitle();
      };
      input.onblur = saveTitle;
    };

    // DELETE ICON
    const del = document.createElement("i");
    del.className = "bi bi-trash";
    del.style.fontSize = "11px";
    del.onclick = (e) => {
      e.stopPropagation();
      if (!confirm("Delete this chat?")) return;

      allChats = allChats.filter(c => c.id !== chat.id);
      localStorage.setItem("allChats", JSON.stringify(allChats));

      if (currentChatId === chat.id) {
        chatHistory = [];
        currentChatId = null;
        refreshChatUI();
      }
      renderHistoryButtons();
    };

    actions.append(edit, del);
    item.append(titleSpan, actions);
    item.onclick = () => loadChat(chat.id);
    list.appendChild(item);
  });
}

function refreshChatUI() {
  const chatBox = document.getElementById("chat-box");
  chatBox.innerHTML = "";
  removeChips();
  chatHistory.forEach(msg => addMessage(msg.text, msg.sender));
  renderHistoryButtons();
  scrollToBottom();
}

// ========================== TYPING
function addTyping() {
  removeTyping();
  const wrap = document.createElement("div");
  wrap.className = "bot-message-wrapper typing";
  const img = document.createElement("img");
  img.src = "assets/avatar.png";
  img.className = "avatar";
  const bubble = document.createElement("div");
  bubble.className = "bot-bubble";
  bubble.innerHTML = `<span></span><span></span><span></span>`;
  wrap.appendChild(img);
  wrap.appendChild(bubble);
  document.getElementById("chat-box").appendChild(wrap);
  scrollToBottom();
}

function removeTyping() {
  document.querySelectorAll(".typing").forEach(el => el.remove());
}

// ========================== SEND MESSAGE
async function sendMessage(textOverride = null) {
  const input = document.getElementById("user-input");
  const text = textOverride || input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  chatHistory.push({ sender: "user", text });
  saveCurrentChat();
  input.value = "";
  removeChips();
  addTyping();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        sessionId: localStorage.getItem("dialogflowSessionId") || generateSessionId()
      })
    });

    const data = await res.json();
    removeTyping();
    const reply = data.reply || data.fulfillmentText || data.text || "";

    if (reply.trim()) {
      addMessage(reply, "bot");
      chatHistory.push({ sender: "bot", text: reply });
      saveCurrentChat();
    }
    if (data.chips?.length) addChips(data.chips);
  } catch (err) {
    removeTyping();
  }
}

function generateSessionId() {
  const id = Math.random().toString(36).slice(2);
  localStorage.setItem("dialogflowSessionId", id);
  return id;
}

// ========================== ADD MESSAGE
function addMessage(text, sender) {
  const chatBox = document.getElementById("chat-box");
  if (sender === "bot") {
    const wrapper = document.createElement("div");
    wrapper.className = "bot-message-wrapper";
    const img = document.createElement("img");
    img.src = "assets/avatar.png";
    img.className = "avatar";
    const bubble = document.createElement("div");
    bubble.className = "bot-bubble";
    bubble.textContent = text;
    wrapper.appendChild(img);
    wrapper.appendChild(bubble);
    chatBox.appendChild(wrapper);
  } else {
    const msg = document.createElement("div");
    msg.className = "user";
    msg.textContent = text;
    chatBox.appendChild(msg);
  }
  scrollToBottom();
}

// ========================== CHIPS
function addChips(chips) {
  removeChips();
  const container = document.createElement("div");
  container.className = "chips";
  chips.forEach(text => {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.onclick = () => sendMessage(text);
    container.appendChild(btn);
  });
  currentChipsContainer = container;
  document.getElementById("chat-box").appendChild(container);
  scrollToBottom();
}

function removeChips() {
  if (currentChipsContainer) {
    currentChipsContainer.remove();
    currentChipsContainer = null;
  }
}

// ========================== AUTO SCROLL TO BOTTOM (PERFECT)
function scrollToBottom() {
  const box = document.getElementById("chat-box");
  setTimeout(() => {
    box.scrollTop = box.scrollHeight;
  }, 10);
}

// ========================== CHIP EVENT HANDLER 
async function sendChipEvent(chip) {
  // If the chip has an event, trigger it in Dialogflow
  if (chip.event) {
    addMessage(chip.text, "user"); // Show chip text as user message
    chatHistory.push({ sender: "user", text: chip.text });
    saveCurrentChat();
    removeChips();
    addTyping();

    try {
      // Call API with EVENT instead of plain text
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: chip.event, // SEND THE EVENT TO DIALOGFLOW
          sessionId: localStorage.getItem("dialogflowSessionId") || generateSessionId()
        })
      });

      const data = await res.json();
      removeTyping();
      const reply = data.reply || data.fulfillmentText || data.text || "";

      if (reply.trim()) {
        addMessage(reply, "bot");
        chatHistory.push({ sender: "bot", text: reply });
        saveCurrentChat();
      }
      if (data.chips?.length) addChips(data.chips);
    } catch (err) {
      removeTyping();
      console.error("Chip event error:", err);
    }
  }
}