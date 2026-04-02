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
let lastShownDate = null;
let firstWelcomeReady = false;

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
    const sidebar = document.getElementById("sidebar");
    sidebar?.classList.toggle("collapsed");
    renderHistoryButtons();
  });

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    auth.signOut().then(() => window.location.href = "login.html");
  });
});

function loadLastChat() {
  if (allChats.length > 0) {
    currentChatId = allChats[0].id;
    chatHistory = [...allChats[0].messages];
  } else chatHistory = [];
  refreshChatUI();
  setTimeout(() => {
    document.getElementById("user-input").disabled = false; },150);
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
  firstWelcomeReady = false;
  document.getElementById("user-input").disabled = true;
  console.log("newChat triggered");
  saveCurrentChat();
  chatHistory = [];
  currentChatId = null;
  localStorage.removeItem("dialogflowSessionId");
  lastShownDate = null;
  refreshChatUI();
  setTimeout(async () => {
    console.log("setTimeout triggerWelcome called");
    await triggerWelcome().catch(err => console.error("triggerWelcome in newChat error: ", err));
  }, 100);
  document.getElementById("user-input").disabled = true;
}

function loadChat(chatId) {
  firstWelcomeReady = false;
  document.getElementById("user-input").disabled = false;
  saveCurrentChat();
  const chat = allChats.find(c => c.id === chatId);
  if (chat) {
    currentChatId = chat.id;
    chatHistory = [...chat.messages];
    lastShownDate = null;
    refreshChatUI();
  }
}

function renderHistoryButtons() {
  const list = document.getElementById("history-list");
  const sidebar = document.getElementById("sidebar");
  if (!list || !sidebar) return;
  list.innerHTML = "";
  if (sidebar.classList.contains("collapsed")) return;

  allChats.forEach((chat) => {
    const item = document.createElement("div");
    item.className = `chat-history-btn ${currentChatId === chat.id ? "active" : ""}`;
    const titleSpan = document.createElement("span");
    titleSpan.className = "chat-title-text";
    titleSpan.textContent = chat.title;
    titleSpan.title = chat.title;
    const actions = document.createElement("div");
    actions.className = "d-flex gap-3 flex-shrink-0";

    const edit = document.createElement("i");
    edit.className = "bi bi-pencil";
    edit.style.fontSize = "18px";
    edit.onclick = (e) => {
      e.stopPropagation();
      const input = document.createElement("input");
      input.value = chat.title;
      input.style.fontSize = "12px";
      input.style.padding = "2px 4px";
      input.style.width = "90px";
      input.style.borderRadius = "4px";
      input.style.border = "1px solid #ccc";
      input.style.whiteSpace = "pre-wrap";
      item.innerHTML = "";
      item.appendChild(input);
      input.focus();
      input.select();
      const saveTitle = () => {
        let final = input.value;
        chat.title = final.trim() === "" ? chat.title : final;
        localStorage.setItem("allChats", JSON.stringify(allChats));
        renderHistoryButtons();
      };
      input.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveTitle();
        }
      };
      input.onblur = saveTitle;
    };

    const del = document.createElement("i");
    del.className = "bi bi-trash";
    del.style.fontSize = "18px";
    del.onclick = (e) => {
      e.stopPropagation();
      if (!confirm("Delete this chat?")) return;
      allChats = allChats.filter(c => c.id !== chat.id);
      localStorage.setItem("allChats", JSON.stringify(allChats));
      if (currentChatId === chat.id) { chatHistory = []; currentChatId = null; refreshChatUI(); }
      renderHistoryButtons();
    };

    actions.append(edit, del);
    item.append(titleSpan, actions);
    item.onclick = () => loadChat(chat.id);
    list.appendChild(item);
  });
}

function refreshChatUI() {
  console.log("refreshChatUI triggered");
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return;

  chatBox.innerHTML = "";
  lastShownDate = null;

  chatHistory.forEach(msg => {
    addMessage(msg.text, msg.sender, msg.timestamp, msg.richContent);
  });

  // ✅ 修复：自动恢复未点击的整组 chips
  const lastBotMsg = [...chatHistory].reverse().find(m => m.sender === "bot" && m.savedChips);
  if (lastBotMsg && lastBotMsg.savedChips?.length > 0) {
    addChips(lastBotMsg.savedChips);
    console.log("✅ 自动恢复 Chips:", lastBotMsg.savedChips);
  }

  renderHistoryButtons();
  scrollToBottom();
}

function addTyping() {
  removeTyping();
  const wrap = document.createElement("div");
  wrap.className = "bot-message-wrapper typing";
  const img = document.createElement("img");
  img.src = "assets/avatar.png";
  img.className = "avatar";
  const bubble = document.createElement("div");
  bubble.className = "bot-bubble";
  bubble.innerHTML = `<div class="typing">
    <span></span><span></span><span></span>
  </div>`;
  wrap.appendChild(img);
  wrap.appendChild(bubble);
  document.getElementById("chat-box").appendChild(wrap);
  scrollToBottom();
}

function removeTyping() {
  document.querySelectorAll(".typing").forEach(el => el.remove());
}

async function triggerWelcome() {
  const hiddenText = "Hi";
  try {
    removeChips();
    addTyping();
    const sessionId = localStorage.getItem("dialogflowSessionId") || generateSessionId();
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: hiddenText, sessionId })
    });
    const data = await res.json();
    removeTyping();
    const reply = data.reply || "";

    let chips = [];
    if (data.richContent) {
      data.richContent.forEach(row => {
        row.forEach(item => {
          if (item.type === "chips" && item.options) {
            chips = item.options.map(o => o.text || "").filter(Boolean);
          }
        });
      });
    }

    if (reply.trim()) {
      const botTs = new Date().toISOString();
      addMessage(reply, "bot", botTs, data.richContent);
      
      // ✅ 修复：Welcome 消息也保存 chips
      chatHistory.push({
        sender: "bot",
        text: reply,
        timestamp: botTs,
        richContent: data.richContent,
        savedChips: chips
      });
      saveCurrentChat();
    }

    if (chips.length) addChips(chips);
    if (data.richContent) renderRichContent(data.richContent);
  } catch (err) {
    console.error("welcome error", err);
  }
}

async function sendMessage(textOverride = null) {
  console.log("🚀 ========== sendMessage START ==========");
  const input = document.getElementById("user-input");
  const text = textOverride || input.value.trim();
  if (!text) { console.log("❌ 文字为空"); return; }

  const timestamp = new Date().toISOString();
  addMessage(text, "user", timestamp);
  chatHistory.push({ sender: "user", text, timestamp });
  saveCurrentChat();
  input.value = "";
  removeChips();
  document.getElementById("user-input").disabled = true;
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
    document.getElementById("user-input").disabled = false;
    const reply = data.reply || "";

    // ✅ 修复：先解析 chips，再存消息！！
    let chips = [];
    if (data.richContent) {
      data.richContent.forEach(row => {
        row.forEach(item => {
          if (item.type === "chips" && item.options) {
            chips = item.options.map(o => o.text || "").filter(Boolean);
          }
        });
      });
    }

    if (reply || data.richContent) {
      const botTs = new Date().toISOString();
      addMessage(reply, "bot", botTs, data.richContent);

      // ✅ 修复：chips 解析完才保存，顺序正确！
      chatHistory.push({
        sender: "bot",
        text: reply,
        timestamp: botTs,
        richContent: data.richContent,
        savedChips: chips
      });
      saveCurrentChat();
    }

    if (chips.length) {
      addChips(chips);
      console.log("🍟 显示 Chips:", chips);
    }

  } catch (err) {
    removeTyping();
    console.error("❌ 报错:", err);
  }
}

function generateSessionId() {
  const id = Math.random().toString(36).slice(2);
  localStorage.setItem("dialogflowSessionId", id);
  return id;
}

function addMessage(text, sender, timestamp, richContent = null) {
  const chatBox = document.getElementById("chat-box");
  let messageBubble = null;

  if (timestamp) {
    let date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      const dateStr = date.toLocaleDateString("en-SG");
      const reminderStr = `
        <strong>[ Important Reminder ]</strong> If there is immediate severe injury or urgent health crisis:</br>
        Please contact Singapore Emergency Hotline 999 / Go to the nearest hospital. 
        Caregiver support & dementia official resources:
        <a href="https://www.dementiasociety.org.sg" target="_blank" class="notice-link">Dementia Society Singapore</a>
      `;
      if (dateStr !== lastShownDate) {
        lastShownDate = dateStr;
        const sep = document.createElement("div");
        sep.className = "chat-date-separator";
        const timeStr = date.toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short" });
        sep.innerHTML = `${timeStr}<div class="notice-small mt-3">${reminderStr}</div>`;
        chatBox.appendChild(sep);
      }
    }
  }

  if (sender === "bot") {
    const wrapper = document.createElement("div");
    wrapper.className = "bot-message-wrapper";
    const img = document.createElement("img");
    img.src = "assets/avatar.png";
    img.className = "avatar";
    const bubble = document.createElement("div");
    bubble.className = "bot-bubble";
    bubble.innerHTML = text;
    wrapper.appendChild(img);
    wrapper.appendChild(bubble);
    chatBox.appendChild(wrapper);

    if (richContent) {
      renderRichContent(richContent, bubble);
    }
  } else {
    const msg = document.createElement("div");
    msg.className = "user";
    msg.textContent = text;
    chatBox.appendChild(msg);
  }
  scrollToBottom();
}

function addChips(chips) {
  removeChips();
  const container = document.createElement("div");
  container.className = "chips";
  
  chips.forEach(text => {
    if (!text) return;
    
    const btn = document.createElement("button");
    btn.textContent = text;
    
    btn.onclick = () => {
      console.log("✅ Chip clicked:", text);
      // ✅ 点任意一个 → 整组清空
      const lastBot = [...chatHistory].reverse().find(m => m.sender === "bot");
      if (lastBot) lastBot.savedChips = null;
      saveCurrentChat();
      sendMessage(text);
    };
    
    container.appendChild(btn);
  });

  currentChipsContainer = container;
  document.getElementById("chat-box").appendChild(container);
  scrollToBottom();
  syncInputWithChips();
}

function removeChips() {
  if (currentChipsContainer) {
    currentChipsContainer.remove();
    currentChipsContainer = null;
  }
  syncInputWithChips();
}

function scrollToBottom() {
  const box = document.getElementById("chat-box");
  setTimeout(() => { box.scrollTop = box.scrollHeight; }, 10);
}

async function sendChipEvent(chip) {
  if (!chip.event) return;
  const text = chip.text?.trim() || "";
  if (!text) return;
  const ts = new Date().toISOString();
  addMessage(text, "user", ts);
  chatHistory.push({ sender: "user", text, timestamp: ts });
  saveCurrentChat();
  removeChips();
  addTyping();
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: chip.event,
        sessionId: localStorage.getItem("dialogflowSessionId") || generateSessionId()
      })
    });
    const data = await res.json();
    removeTyping();
    const reply = data.reply || "";
    let chips = [];
    if (data.richContent) {
      data.richContent.forEach(row => {
        row.forEach(item => {
          if (item.type === "chips") chips = item.options.map(o => o.text).filter(Boolean);
        });
      });
    }
    if (reply) {
      const botTs = new Date().toISOString();
      addMessage(reply, "bot", botTs, data.richContent);
      chatHistory.push({ sender: "bot", text: reply, timestamp: botTs, richContent: data.richContent, savedChips: chips });
      saveCurrentChat();
    }
    if (chips.length) addChips(chips);
  } catch (e) { removeTyping(); console.error(e); }
}

function syncInputWithChips(){
  const input = document.getElementById("user-input");
  input.disabled = !!currentChipsContainer;
}

function renderRichContent(richContent, container){
  console.log("🎨 渲染富内容:", richContent);
  if(!richContent || !Array.isArray(richContent)) return;
  richContent.forEach(block=>{
    if(!Array.isArray(block)) return;
    block.forEach(item=>{
      if(item.type==="info"){
        const div = document.createElement("div");
        div.style.background="#e3f2fd";
        div.style.padding="10px";
        div.style.borderRadius="6px";
        div.style.margin="8px 0";
        div.innerHTML = `<strong>${item.title}</strong><br>${item.subtitle}`;
        container.appendChild(div);
      }
      if(item.type==="list" && item.items){
        const wrap = document.createElement("div");
        wrap.style.border="1px solid #ccc";
        wrap.style.borderRadius="6px";
        wrap.style.margin="8px 0";
        const head = document.createElement("div");
        head.style.background="#f5f5f5";
        head.style.padding="8px";
        head.innerText = item.title;
        wrap.appendChild(head);
        item.items.forEach(it=>{
          const line = document.createElement("div");
          line.style.padding="8px";
          if(it.link){
            line.innerHTML = `<a href="${it.link}" target="newWindow">${it.title}</a><br><small>${it.subtitle}</small>`;
          }else{
            line.innerText = it.title;
          }
          wrap.appendChild(line);
        });
        container.appendChild(wrap);
      }
    });
  });
}

