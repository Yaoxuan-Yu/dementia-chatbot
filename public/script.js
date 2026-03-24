const API_URL = "https://us-central1-ai-humanity-g3.cloudfunctions.net/chatbot";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBkcFma_F3MqKqNgmRyj9k_XO0XLAmL60o",
  authDomain: "ai-humanity-g3.firebaseapp.com",
  projectId: "ai-humanity-g3",
  storageBucket: "ai-humanity-g3.firebasestorage.app",
  messagingSenderId: "42108703629",
  appId: "1:42108703629:web:ac1f6113b086fc316ba3c4",
  measurementId: "G-ZHEYJ9QMG5"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
let currentChipsContainer = null;

document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const email = user.email || "";
    const username = email.split("@")[0];

    const nameEl = document.getElementById("user-name");

    if (nameEl) {
      nameEl.textContent = username;
    }
    console.log("USER:", user);
  });
});

// ENTER KEY
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("user-input")
    .addEventListener("keypress", e => {
      if (e.key === "Enter") sendMessage();
    });
});

async function sendMessage() {
  const input = document.getElementById("user-input");
  const text = input.value.trim();
  if (!text) return;

  removeChips();
  addMessage(text, "user");
  input.value = "";

  const typing = showTyping();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();

    removeTyping(typing);

    if (data.reply) addMessage(data.reply, "bot");
    if (data.chips?.length) addChips(data.chips);

  } catch {
    removeTyping(typing);
    addMessage("Error connecting to chatbot.", "bot");
  }
}

// MESSAGE RENDER
function addMessage(text, sender) {
  const chatBox = document.getElementById("chat-box");

  if (sender === "bot") {
    const wrapper = document.createElement("div");
    wrapper.className = "bot-message-wrapper";

    wrapper.innerHTML = `
      <img src="https://cdn-icons-png.flaticon.com/512/4712/4712027.png" class="avatar">
      <div class="bot-bubble">${text}</div>
    `;

    chatBox.appendChild(wrapper);

  } else {
    const msg = document.createElement("div");
    msg.className = "user";
    msg.innerText = text;
    chatBox.appendChild(msg);
  }

  scrollToBottom();
}

// CHIPS
function addChips(chips) {
  const chatBox = document.getElementById("chat-box");

  const container = document.createElement("div");
  container.className = "chips";

  chips.forEach(text => {
    const btn = document.createElement("button");
    btn.innerText = text;

    btn.onclick = () => {
      btn.classList.add("clicked");
      removeChips();
      document.getElementById("user-input").value = text;
      sendMessage();
    };

    container.appendChild(btn);
  });

  currentChipsContainer = container;
  chatBox.appendChild(container);
  scrollToBottom();
}

function removeChips() {
  if (currentChipsContainer) {
    currentChipsContainer.remove();
    currentChipsContainer = null;
  }
}

// TYPING
function showTyping() {
  const chatBox = document.getElementById("chat-box");

  const typing = document.createElement("div");
  typing.className = "bot-message-wrapper typing";

  typing.innerHTML = `
    <img src="https://cdn-icons-png.flaticon.com/512/4712/4712027.png" class="avatar">
    <div class="bot-bubble">
      <span></span><span></span><span></span>
    </div>
  `;

  chatBox.appendChild(typing);
  scrollToBottom();

  return typing;
}

function removeTyping(el) {
  if (el) el.remove();
}

// SCROLL
function scrollToBottom() {
  const chatBox = document.getElementById("chat-box");
  chatBox.scrollTo({
    top: chatBox.scrollHeight,
    behavior: "smooth"
  });
}

// RESET
function newChat() {
  document.getElementById("chat-box").innerHTML = "";
}

// SIDEBAR TOGGLE
document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("sidebarToggle");

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });
});

// LOGOUT
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logout-btn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      auth.signOut()
        .then(() => {
          window.location.href = "login.html";
        })
        .catch(err => {
          console.error("Logout error:", err);
        });
    });
  }
});