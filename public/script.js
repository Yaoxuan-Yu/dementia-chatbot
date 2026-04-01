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
    const sidebar = document.getElementById("sidebar");
    sidebar?.classList.toggle("collapsed");
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
  document.getElementById("user-input").disabled = true; // 禁用输入框，直到欢迎消息加载完成
  console.log("newChat triggered"); // 原有日志保留
  saveCurrentChat();
  chatHistory = [];
  currentChatId = null;
  localStorage.removeItem("dialogflowSessionId");
  lastShownDate = null;
  refreshChatUI();
  // 新增：延迟100ms调用triggerWelcome（确保refreshChatUI执行完成，避免DOM未渲染）
  setTimeout(async () => {
    console.log("setTimeout triggerWelcome called"); // 新增：确认延迟函数执行
    await triggerWelcome().catch(err => console.error("triggerWelcome in newChat error: ", err));
  }, 100);

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

    // Edit 
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
      // 允许输入空格，取消文本修剪限制
      input.style.whiteSpace = "pre-wrap";
      item.innerHTML = "";
      item.appendChild(input);
      input.focus();
      input.select(); // 选中原有内容，方便直接修改
      
      const saveTitle = () => {
        // 保留输入的所有内容（包括空格），仅空值时保留原标题
        let final = input.value;
        chat.title = final.trim() === "" ? chat.title : final;
        localStorage.setItem("allChats", JSON.stringify(allChats));
        renderHistoryButtons();
      };
      
      // 回车保存：阻止默认换行，避免输入框错位
      input.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveTitle();
        }
      };
      // 失焦保存：点击其他地方自动保存
      input.onblur = saveTitle;
    };

    // Delete
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
  console.log("refreshChatUI triggered"); // 新增日志：确认函数触发
  const chatBox = document.getElementById("chat-box");
  console.log("chatBox element: ", chatBox); // 新增：查看chat-box是否存在（关键，避免元素找不到报错）
  if (!chatBox) {
    console.error("refreshChatUI error: chat-box element not found!");
    return; // 避免后续代码报错，终止执行
  }
  chatBox.innerHTML = "";
  removeChips();
  lastShownDate = null;
  chatHistory.forEach(msg => addMessage(msg.text, msg.sender, msg.timestamp));
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

/// ========================== TRIGGER WELCOME
async function triggerWelcome() {
  const hiddenText = "Hi";
  try {
    document.getElementById("user-input").disabled = true; 

    removeChips();
    addTyping();

    const sessionId = localStorage.getItem("dialogflowSessionId") || generateSessionId();
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: hiddenText,
        sessionId: sessionId
      })
    });

    const data = await res.json();
    removeTyping();
    const reply = data.reply || data.fulfillmentText || data.text || "";

    if (reply.trim()) {
      const botTs = new Date().toISOString();
      addMessage(reply, "bot", botTs);
    }

    let chips = [];
    if (data.richContent && Array.isArray(data.richContent) && data.richContent.length > 0) {
      data.richContent.forEach(row => {
        if (Array.isArray(row)) {
          row.forEach(item => {
            if (typeof item === "object" && item.type === "chips" && Array.isArray(item.options)) {
              chips = item.options.map(opt => {
                return typeof opt === "object" && opt.text ? opt.text.trim() : "";
              }).filter(text => text);
            }
          });
        }
      });
    } else if (data.chips && Array.isArray(data.chips)) {
      chips = data.chips.map(chip => {
        return typeof chip === "object" ? (chip.text || "") : chip.toString().trim();
      }).filter(text => text);
    }

    if (chips.length) {
      addChips(chips);
    }
  } catch (err) {
    console.error("welcome error", err);
  }
}
// ========================== SEND MESSAGE
async function sendMessage(textOverride = null) {
  const input = document.getElementById("user-input");
  const text = textOverride || input.value.trim();
  if (!text) return;
  
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

    const reply = data.reply || data.fulfillmentText || data.text || "";

    if (reply.trim()) {
      const botTimestamp = new Date().toISOString();
      addMessage(reply, "bot", botTimestamp);
      chatHistory.push({ sender: "bot", text: reply, timestamp: botTimestamp });
      saveCurrentChat();
    }

    // 仅修改此处芯片解析逻辑，彻底解决[object Object]问题
    let chips = [];
    // 严格适配API返回的richContent格式（[{options: [{text: "..."}], type: "chips"}]）
    if (data.richContent && Array.isArray(data.richContent) && data.richContent.length > 0) {
      // 遍历richContent每一行，找到type为chips的项
      data.richContent.forEach(row => {
        if (Array.isArray(row)) {
          row.forEach(item => {
            // 确保item是对象、有type和options，且options是数组
            if (typeof item === "object" && item.type === "chips" && Array.isArray(item.options)) {
              // 只提取options中的text，过滤非字符串项
              chips = item.options.map(opt => {
                return typeof opt === "object" && opt.text ? opt.text.trim() : "";
              }).filter(text => text); // 过滤空字符串，避免无效芯片
            }
          });
        }
      });
    } else if (data.chips && Array.isArray(data.chips)) {
      // 兼容旧的chips格式，防止解析异常
      chips = data.chips.map(chip => {
        return typeof chip === "object" ? (chip.text || "") : chip.toString().trim();
      }).filter(text => text);
    }
    // 只有芯片数组有有效内容时才渲染
    if (chips.length) addChips(chips);

  } catch (err) {
    removeTyping();
    console.error(err);
  }
}

function generateSessionId() {
  const id = Math.random().toString(36).slice(2);
  localStorage.setItem("dialogflowSessionId", id);
  return id;
}

// ========================== ADD MESSAGE + DATE TIME (ISSUE #3)
function addMessage(text, sender, timestamp) {
  const chatBox = document.getElementById("chat-box");

  // Show date separator once per day
if (timestamp) {
  let date;

  // Firestore Timestamp
  if (typeof timestamp.toDate === "function") {
    date = timestamp.toDate();
  } 
  // already a JS Date
  else if (timestamp instanceof Date) {
    date = timestamp;
  } 
  // string / number
  else {
    date = new Date(timestamp);
  }

  if (!isNaN(date.getTime())) {
    const dateStr = date.toLocaleDateString("en-SG");

    const reminderStr = `
      <strong>[ Important Reminder ]</strong> If there is immediate severe injury or urgent health crisis:</br>
      Please contact Singapore Emergency Hotline 999 / Go to the nearest hospital. 
      Caregiver support & dementia official resources:
      <a href="https://www.dementiasociety.org.sg" target="_blank" class="notice-link">
        Dementia Society Singapore
      </a>
    `;

    if (dateStr !== lastShownDate) {
      lastShownDate = dateStr;

      const sep = document.createElement("div");
      sep.className = "chat-date-separator";

      const timeStr = date.toLocaleString("en-SG", {
        dateStyle: "medium",
        timeStyle: "short"
      });

      sep.innerHTML = `
        ${timeStr}
        <div class="notice-small mt-3">${reminderStr}</div>
      `;

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

// ========================== CHIPS（仅优化渲染逻辑，避免异常）
function addChips(chips) {
  removeChips();
  const container = document.createElement("div");
  container.className = "chips";
  // 遍历芯片数组，确保只渲染有效文本
  chips.forEach(text => {
    if (text && typeof text === "string") {
      const btn = document.createElement("button");
      btn.textContent = text;
      btn.onclick = () => sendMessage(text);
      container.appendChild(btn);
    }
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

// ========================== AUTO SCROLL
function scrollToBottom() {
  const box = document.getElementById("chat-box");
  setTimeout(() => {
    box.scrollTop = box.scrollHeight;
  }, 10);
}

// ========================== CHIP EVENT（同步优化芯片解析）
async function sendChipEvent(chip) {
  if (chip.event) {
    // 确保chip.text是有效字符串
    const chipText = typeof chip === "object" && chip.text ? chip.text.trim() : "";
    if (!chipText) return;
    
    const timestamp = new Date().toISOString();
    addMessage(chipText, "user", timestamp);
    chatHistory.push({ sender: "user", text: chipText, timestamp });
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
      const reply = data.reply || data.fulfillmentText || data.text || "";
      if (reply.trim()) {
        const botTs = new Date().toISOString();
        addMessage(reply, "bot", botTs);
        chatHistory.push({ sender: "bot", text: reply, timestamp: botTs });
        saveCurrentChat();
      }
      // 同步优化芯片解析，与sendMessage保持一致
      let chips = [];
      if (data.richContent && Array.isArray(data.richContent) && data.richContent.length > 0) {
        data.richContent.forEach(row => {
          if (Array.isArray(row)) {
            row.forEach(item => {
              if (typeof item === "object" && item.type === "chips" && Array.isArray(item.options)) {
                chips = item.options.map(opt => {
                  return typeof opt === "object" && opt.text ? opt.text.trim() : "";
                }).filter(text => text);
              }
            });
          }
        });
      } else if (data.chips && Array.isArray(data.chips)) {
        chips = data.chips.map(chipItem => {
          return typeof chipItem === "object" ? (chipItem.text || "") : chipItem.toString().trim();
        }).filter(text => text);
      }
      if (chips.length) addChips(chips);
    } catch (err) {
      removeTyping();
      console.error(err);
    }
  }
}

function syncInputWithChips(){
  const input = document.getElementById("user-input");
  input.disabled = !!currentChipsContainer; // 如果有芯片显示，禁用输入框；否则启用
}