/* ========================
   CONFIG
======================== */
const API_BASE = "http://localhost:8080"; // <- Springboard base URL
// Expected backend endpoints (adjust if yours differ):
// POST   /chat                      {prompt} -> {reply, chatId?}
// GET    /chats                     -> [{id, title, ts}]
// GET    /chats/{id}                -> [{role, content, ts}]
// GET    /apis                      -> [{id, name, description, likes}]
// POST   /apis/{id}/like            -> {likes}
// (Optional) websockets/stream not used here

/* ========================
   DOM HOOKS
======================== */
const historyList = document.getElementById("historyList");
const messagesEl   = document.getElementById("messages");
const chatForm     = document.getElementById("chatForm");
const userInput    = document.getElementById("userInput");
const sendBtn      = document.getElementById("sendBtn");
const newChatBtn   = document.getElementById("newChatBtn");
const apiListEl    = document.getElementById("apiList");
const refreshApisBtn = document.getElementById("refreshApisBtn");
const messageTemplate = document.getElementById("messageTemplate");

/* ========================
   STATE
======================== */
let currentChatId = null;           // server chat id, optional
let localChats = JSON.parse(localStorage.getItem("sb_chats") || "[]"); // basic local cache

/* ========================
   UTIL
======================== */
function nowTs(){ return new Date().toISOString(); }
function saveLocal(){
  localStorage.setItem("sb_chats", JSON.stringify(localChats));
}
function addLocalMessage(chatId, role, content){
  let chat = localChats.find(c=>c.id===chatId);
  if(!chat){
    // Determine the next chat number
    const chatNumber = localChats.length + 1;
    chat = { 
        id: chatId, 
        title: `Chat ${chatNumber}`, 
        ts: nowTs(), 
        messages: [] 
    };
    localChats.unshift(chat);
}

  chat.messages.push({ role, content, ts: nowTs() });
  chat.ts = nowTs();
  // Title is first user message truncated
  if(chat.messages.length===1 && role==="user"){
    chat.title = content.slice(0, 40) + (content.length>40 ? "…" : "");
  }
  saveLocal();
}
function renderHistory(){
  historyList.innerHTML = "";
  localChats
    .slice()
    .sort((a,b)=> new Date(b.ts) - new Date(a.ts))
    .forEach(c=>{
      const btn = document.createElement("button");
      btn.className = "history-item" + (c.id===currentChatId ? " active":"");
      btn.textContent = c.title || "Chat";
      btn.onclick = ()=> loadChat(c.id);
      historyList.appendChild(btn);
    });
}
function clearMessages(){
  messagesEl.innerHTML = "";
}
function appendMessage(role, content){
  const clone = messageTemplate.content.cloneNode(true);
  const wrapper = clone.querySelector(".message");
  const bubble  = clone.querySelector(".bubble");
  const meta    = clone.querySelector(".meta");
  wrapper.classList.add(role);
  bubble.innerHTML = content.replace(/\n/g, "<br>");
  meta.textContent = (role==="user" ? "You" : "Springboard") + " • " + new Date().toLocaleTimeString();
  messagesEl.appendChild(clone);
  messagesEl.scrollTo({top: messagesEl.scrollHeight, behavior:"smooth"});
}
function setBusy(isBusy){
  messagesEl.setAttribute("aria-busy", String(isBusy));
  sendBtn.disabled = isBusy;
}

/* ========================
   CHAT LOAD/SAVE
======================== */
function startNewChat(){
  currentChatId = "local-" + Math.random().toString(36).slice(2,8);
  addLocalMessage(currentChatId, "system", "New conversation started.");
  renderHistory();
  loadChat(currentChatId);
}
function loadChat(chatId){
  currentChatId = chatId;
  renderHistory();
  clearMessages();
  const chat = localChats.find(c=>c.id===chatId);
  if(chat){
    chat.messages.forEach(m=> appendMessage(m.role, m.content));
  }else{
    // fallback: could fetch from server if you keep server history
    appendMessage("assistant", "Loaded chat history.");
  }
}

/* ========================
   BACKEND CALLS
======================== */
// async function sendPromptToBackend(prompt){
//   const res = await fetch(`${API_BASE}/chat`, {
//     method: "POST",
//     headers: { "Content-Type":"application/json" },
//     body: JSON.stringify({ prompt, chatId: currentChatId })
//   });
//   if(!res.ok){ throw new Error(`Chat error: ${res.status}`); }
//   return res.json(); // { reply, chatId? }
// }

async function sendPromptToBackend(prompt) {
  const url = `${API_BASE}/api/search?prompt=${encodeURIComponent(prompt)}`;
  
  const res = await fetch(url, { method: "GET" });

  if (!res.ok) {
    throw new Error(`Search error: ${res.status}`);
  }

  return res.json(); // Expect { reply: [...] }
}

async function fetchApis(){
  const res = await fetch(`${API_BASE}/apis`);
  if(!res.ok){ throw new Error("Failed to load APIs"); }
  return res.json();
}
async function likeApi(apiId){
  const res = await fetch(`${API_BASE}/apis/${encodeURIComponent(apiId)}/like`, {
    method: "POST"
  });
  if(!res.ok){ throw new Error("Failed to like API"); }
  return res.json(); // {likes}
}

/* ========================
   API LIST + ACCORDION
======================== */
function renderApiPills(list){
  apiListEl.innerHTML = "";
  list.forEach(api=>{
    const pill = document.createElement("button");
    pill.className = "api-pill";
    pill.innerHTML = `<span class="name">${api.name}</span><span class="chev">▾</span>`;
    pill.onclick = ()=>{
      const open = pill.nextElementSibling?.classList.contains("api-accordion");
      // close others
      document.querySelectorAll(".api-accordion").forEach(n=> n.remove());
      if(open) return;
      const acc = document.createElement("div");
      acc.className = "api-accordion";
      acc.innerHTML = `
        <div class="api-acc-header">
          <div class="api-acc-title">${api.name}</div>
          <div class="like-row">
            <button class="like-btn ${api.liked ? "liked":""}" aria-label="Like API">
              ${api.liked ? "♥︎ Liked" : "♡ Like"}
            </button>
            <span class="like-count" aria-live="polite">${api.likes ?? 0} likes</span>
          </div>
        </div>
        <div class="api-acc-desc">${api.description || "No description."}</div>
      `;
      pill.insertAdjacentElement("afterend", acc);

      const likeBtn   = acc.querySelector(".like-btn");
      const likeCount = acc.querySelector(".like-count");
      likeBtn.onclick = async ()=>{
        likeBtn.disabled = true;
        try{
          const data = await likeApi(api.id);
          likeCount.textContent = `${data.likes} likes`;
          likeBtn.classList.add("liked");
          likeBtn.textContent = "♥︎ Liked";
          api.likes = data.likes;
          api.liked = true;
        }catch(e){
          alert("Failed to like API.");
        }finally{
          likeBtn.disabled = false;
        }
      };
    };
    apiListEl.appendChild(pill);
  });
}
async function loadApis(){
  try{
    const apis = await fetchApis();
    renderApiPills(apis);
  }catch(e){
    apiListEl.innerHTML = `<span class="muted">Welcome to SRAC</span>`;
  }
}

/* ========================
   INIT + EVENTS
======================== */
// chatForm.addEventListener("submit", async (e)=>{
//   e.preventDefault();
//   const prompt = userInput.value.trim();
//   if(!prompt) return;

//   // ensure chat
//   if(!currentChatId) startNewChat();

//   // UI append user message
//   appendMessage("user", prompt);
//   addLocalMessage(currentChatId, "user", prompt);
//   userInput.value = "";
//   setBusy(true);

//   try{
//     const data = await sendPromptToBackend(prompt); // {reply, chatId?}
//     if(data.chatId && data.chatId !== currentChatId){
//       // server assigned chat id
//       // migrate local chat id to server one
//       const chat = localChats.find(c=>c.id===currentChatId);
//       if(chat) chat.id = data.chatId;
//       currentChatId = data.chatId;
//       saveLocal();
//       renderHistory();
//     }
//     appendMessage("assistant", data.reply ?? "(no reply)");
//     addLocalMessage(currentChatId, "assistant", data.reply ?? "");
//   }catch(err){
//     appendMessage("assistant", "Sorry—something went wrong talking to Springboard.");
//   }finally{
//     setBusy(false);
//   }
// });

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const prompt = userInput.value.trim();
  if (!prompt) return;

  if (!currentChatId) startNewChat();

  appendMessage("user", prompt);
  addLocalMessage(currentChatId, "user", prompt);
  userInput.value = "";
  setBusy(true);

 try {
  const data = await sendPromptToBackend(prompt); // { reply: [...] }

  if (Array.isArray(data.reply)) {
    // Build clickable list of APIs
    const container = document.createElement("div");
    container.classList.add("api-results");

    data.reply.forEach(api => {
      // --- Create API row ---
      const apiRow = document.createElement("div");
      apiRow.classList.add("api-result");
      apiRow.innerHTML = `
        <div class="api-header">
          🔹 <strong>${api.apiName}</strong> — ${api.description}
        </div>
      `;

      // --- Hidden expanded section ---
      const expanded = document.createElement("div");
      expanded.classList.add("api-expanded");
      expanded.innerHTML = `
        <div class="api-expanded-content">
          <p><strong>${api.apiName}</strong></p>
          <p>${api.description}</p>
          <button class="like-btn">♡ Like</button>
          <span class="like-count">0 likes</span>
        </div>
      `;
      expanded.style.display = "none";

      // --- Toggle on click ---
      // apiRow.addEventListener("click", () => {
      //   const isOpen = expanded.style.display === "block";
      //   document.querySelectorAll(".api-expanded").forEach(el => el.style.display = "none");
      //   expanded.style.display = isOpen ? "none" : "block";
      // });

      apiRow.addEventListener("click", async () => {
  const isOpen = expanded.style.display === "block";

  // Close others first
  document.querySelectorAll(".api-expanded").forEach(el => el.style.display = "none");

  if (isOpen) {
    expanded.style.display = "none";
    return;
  }

  try {
    // Call backend to get details AND increment click count
    const detailRes = await fetch(`${API_BASE}/api/details/${encodeURIComponent(api.apiName)}`);
    if (!detailRes.ok) throw new Error("Failed to load API details");
    const details = await detailRes.json();

    expanded.innerHTML = `
      <div class="api-expanded-content">
        <p><strong>${details.apiName}</strong></p>
        <p>${details.description}</p>
        <button class="like-btn">♡ Like</button>
      </div>
    `;

    expanded.style.display = "block";

    // Like button handler
    const likeBtn = expanded.querySelector(".like-btn");
    likeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        likeBtn.disabled = true;
        const res = await fetch(`${API_BASE}/api/${encodeURIComponent(api.apiName)}/like`, { method: "POST" });
        // if (res.ok) {
        //   const data = await res.json();
        //   expanded.querySelector("p:nth-child(3)").textContent = `Likes: ${data.likes}`;
        //   likeBtn.textContent = "♥︎ Liked";
        //   likeBtn.classList.add("liked");
        // }
      } catch (err) {
        alert("Failed to like API.");
      } finally {
        likeBtn.disabled = false;
      }
    });

  } catch (err) {
    console.error(err);
    expanded.innerHTML = `<div class="api-expanded-content"><p>Error loading API details.</p></div>`;
    expanded.style.display = "block";
  }
});


      // --- Like button logic ---
      const likeBtn = expanded.querySelector(".like-btn");
      const likeCount = expanded.querySelector(".like-count");
      likeBtn.addEventListener("click", async (e) => {
        e.stopPropagation(); // prevent collapsing
        try {
          likeBtn.disabled = true;
          const res = await fetch(`${API_BASE}/apis/${encodeURIComponent(api.apiName)}/like`, { method: "POST" });
          if (res.ok) {
            const data = await res.json();
            likeCount.textContent = `${data.likes} likes`;
            likeBtn.textContent = "♥︎ Liked";
            likeBtn.classList.add("liked");
          }
        } catch (err) {
          console.error("Like failed", err);
          alert("Failed to like API.");
        } finally {
          likeBtn.disabled = false;
        }
      });

      container.appendChild(apiRow);
      container.appendChild(expanded);
    });

    // Append to chat
    appendMessage("assistant", "Here are your results:");
    messagesEl.appendChild(container);
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
  } else {
    appendMessage("assistant", "No API's found matching your description.");
  }
} catch (err) {
  appendMessage("assistant", "Sorry—something went wrong talking to Springboard.");
} finally {
  setBusy(false);
}

});

newChatBtn.addEventListener("click", ()=>{
  startNewChat();
});

refreshApisBtn.addEventListener("click", loadApis);

// Enter to send (already handled by form submit), Shift+Enter for newline (if you switch to textarea)
// Keeping input as single-line per your spec.

/* Boot */
(function boot(){
  // If you later expose /chats, you could hydrate from server. For now use local.
  renderHistory();
  if(localChats.length){
    loadChat(localChats[0].id);
  }else{
    startNewChat();
  }
  loadApis();
})();
