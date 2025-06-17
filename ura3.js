let contacts = JSON.parse(localStorage.getItem("contacts")) || {};
let currentConnection = null;
let currentChannel = null;
let currentContact = null;

restoreConnections();

updateContactList();

function restoreConnections() {
  // نحاول نعيد فتح الاتصال مع كل جهة محفوظة
  Object.keys(contacts).forEach(name => {
    // لو عندنا offer محفوظ نقدر نحاول نبدأ جواب answer تلقائي
    if (contacts[name].offer) {
      try {
        const offer = JSON.parse(contacts[name].offer);
        startAnswer(offer, name);
      } catch {
        // لو في خطأ ما نعمل شيء
      }
    }
  });
}

function addContact() {
  const name = document.getElementById("contactName").value.trim();
  const signalText = document.getElementById("contactSignal").value.trim();

  if (!name || !signalText) {
    return alert("يرجى إدخال الاسم والإشارة.");
  }

  try {
    const parsed = JSON.parse(signalText);

    if (parsed.type === "offer") {
      startAnswer(parsed, name);
    } else if (parsed.type === "answer") {
      finishConnection(parsed, name);
    } else {
      alert("البيانات غير صالحة.");
    }
  } catch (e) {
    alert("صيغة غير صالحة.");
  }
}

function updateContactList() {
  const list = document.getElementById("contactList");
  list.innerHTML = "";

  Object.keys(contacts).forEach(name => {
    const li = document.createElement("li");

    // إضافة علامة خضراء اذا الشخص "أونلاين" - بناء على حالة الاتصال
    const isOnline = contacts[name].connected ? "🟢 " : "🔴 ";
    li.textContent = isOnline + name;
    li.onclick = () => openChat(name);

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "🗑️";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      delete contacts[name];
      localStorage.setItem("contacts", JSON.stringify(contacts));
      updateContactList();
    };

    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

function openChat(name) {
  currentContact = name;
  document.getElementById("chatWith").textContent = "الدردشة مع: " + name;
  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = "";

  (contacts[name]?.messages || []).forEach(msg => {
    addMessage(msg.from === "me" ? "أنت" : "الطرف الآخر", msg.text);
  });
}

function sendMessage() {
  const input = document.getElementById("messageInput");
  const msg = input.value.trim();

  if (!msg || !currentChannel || currentChannel.readyState !== "open") return;

  currentChannel.send(msg);
  addMessage("أنت", msg);
  contacts[currentContact].messages.push({ from: "me", text: msg });
  localStorage.setItem("contacts", JSON.stringify(contacts));
  input.value = "";
}

function addMessage(sender, text) {
  const div = document.createElement("div");
  div.textContent = `${sender}: ${text}`;
  document.getElementById("messages").appendChild(div);
}

function deleteMessages() {
  if (currentContact) {
    contacts[currentContact].messages = [];
    localStorage.setItem("contacts", JSON.stringify(contacts));
    document.getElementById("messages").innerHTML = "";
  }
}

async function createOffer() {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  const dc = pc.createDataChannel("chat");

  dc.onopen = () => {
    console.log("Channel Opened");
    if (currentContact) {
      contacts[currentContact].connected = true;
      localStorage.setItem("contacts", JSON.stringify(contacts));
      updateContactList();
    }
  };

  dc.onclose = () => {
    if (currentContact) {
      contacts[currentContact].connected = false;
      localStorage.setItem("contacts", JSON.stringify(contacts));
      updateContactList();
    }
  };

  dc.onmessage = (e) => {
    addMessage("الطرف الآخر", e.data);
    contacts[currentContact]?.messages.push({ from: "other", text: e.data });
    localStorage.setItem("contacts", JSON.stringify(contacts));
  };

  pc.onicecandidate = (e) => {
    if (!e.candidate) {
      document.getElementById("signalBox").textContent = JSON.stringify(pc.localDescription);
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  currentConnection = pc;
  currentChannel = dc;

  if (currentContact) {
    contacts[currentContact] = contacts[currentContact] || { messages: [] };
    contacts[currentContact].offer = JSON.stringify(offer);
    contacts[currentContact].connected = false;
    localStorage.setItem("contacts", JSON.stringify(contacts));
    updateContactList();
  }
}

async function startAnswer(offer, name) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

  pc.ondatachannel = (e) => {
    currentChannel = e.channel;

    currentChannel.onopen = () => {
      contacts[name].connected = true;
      localStorage.setItem("contacts", JSON.stringify(contacts));
      updateContactList();
    };

    currentChannel.onclose = () => {
      contacts[name].connected = false;
      localStorage.setItem("contacts", JSON.stringify(contacts));
      updateContactList();
    };

    currentChannel.onmessage = (e) => {
      addMessage("الطرف الآخر", e.data);
      contacts[name].messages.push({ from: "other", text: e.data });
      localStorage.setItem("contacts", JSON.stringify(contacts));
    };
  };

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  currentConnection = pc;
  contacts[name] = contacts[name] || { messages: [] };
  contacts[name].offer = JSON.stringify(offer);
  contacts[name].connected = false;
  localStorage.setItem("contacts", JSON.stringify(contacts));
  updateContactList();

  setTimeout(() => {
    document.getElementById("signalBox").textContent = JSON.stringify(pc.localDescription);
    alert("تم إنشاء Answer، انسخه وأرسله للطرف الآخر.");
  }, 500);
}

async function finishConnection(answer, name) {
  if (!currentConnection) return alert("لا يوجد اتصال جاري");

  await currentConnection.setRemoteDescription(new RTCSessionDescription(answer));
  contacts[name] = contacts[name] || { messages: [] };
  localStorage.setItem("contacts", JSON.stringify(contacts));
  updateContactList();
  alert("تم إكمال الاتصال!");
}

// نسخ الإشارة
function copySignal() {
  const signal = document.getElementById("signalBox").textContent;
  if (signal) {
    navigator.clipboard.writeText(signal).then(() => alert("تم النسخ ✅"));
  }
}

// لصق الإشارة
function pasteSignal() {
  navigator.clipboard.readText().then(text => {
    document.getElementById("contactSignal").value = text;
  });
}

// إظهار التعليمات
function showInstructions() {
  document.getElementById("instructions").classList.remove("hidden");
}

function hideInstructions() {
  document.getElementById("instructions").classList.add("hidden");
}

// مكالمة صوتية
async function startCall() {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        document.getElementById("signalBox").textContent = JSON.stringify(pc.localDescription);
      }
    };

    currentConnection = pc;
  } catch (err) {
    alert("تعذر بدء المكالمة الصوتية: " + err.message);
  }
}
