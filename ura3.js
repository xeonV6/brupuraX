let contacts = JSON.parse(localStorage.getItem("contacts")) || {};
let currentConnection = null;
let currentChannel = null;
let currentContact = null;

updateContactList();

function addContact() {
  const name = document.getElementById("contactName").value.trim();
  const signalText = document.getElementById("contactSignal").value.trim();

  if (!name || !signalText) return alert("يرجى إدخال الاسم والإشارة.");

  try {
    const parsed = JSON.parse(signalText);
    if (parsed.type === "offer") {
      startAnswer(parsed, name);
    } else if (parsed.type === "answer") {
      finishConnection(parsed, name);
    } else {
      alert("البيانات غير صالحة.");
    }
  } catch {
    alert("صيغة غير صالحة.");
  }
}

function updateContactList() {
  const list = document.getElementById("contactList");
  list.innerHTML = "";

  Object.keys(contacts).forEach(name => {
    const li = document.createElement("li");
    li.textContent = name;
    li.onclick = () => openChat(name);

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "✖";
    delBtn.onclick = e => {
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

  (contacts[name]?.messages || []).forEach((msg, i) => {
    const div = document.createElement("div");
    div.className = "message";
    if (msg.image) {
      const img = document.createElement("img");
      img.src = msg.image;
      div.appendChild(img);
    } else {
      div.textContent = `${msg.from === "me" ? "أنت" : "الطرف الآخر"}: ${msg.text}`;
    }
    div.ondblclick = () => {
      if (confirm("هل تريد حذف هذه الرسالة؟")) {
        contacts[name].messages.splice(i, 1);
        localStorage.setItem("contacts", JSON.stringify(contacts));
        openChat(name);
      }
    };
    messagesDiv.appendChild(div);
  });
}

function sendMessage() {
  const input = document.getElementById("messageInput");
  const msg = input.value.trim();
  if (!msg || !currentChannel || currentChannel.readyState !== "open") return;
  currentChannel.send(msg);
  contacts[currentContact].messages.push({ from: "me", text: msg });
  localStorage.setItem("contacts", JSON.stringify(contacts));
  input.value = "";
  openChat(currentContact);
}

function sendImage(event) {
  const file = event.target.files[0];
  if (!file || !currentChannel || currentChannel.readyState !== "open") return;

  const reader = new FileReader();
  reader.onload = () => {
    const dataURL = reader.result;
    currentChannel.send(JSON.stringify({ image: dataURL }));
    contacts[currentContact].messages.push({ from: "me", image: dataURL });
    localStorage.setItem("contacts", JSON.stringify(contacts));
    openChat(currentContact);
  };
  reader.readAsDataURL(file);
}

function createOffer() {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  const dc = pc.createDataChannel("chat");

  dc.onopen = () => console.log("Channel Opened");
  dc.onmessage = e => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.image) {
        contacts[currentContact].messages.push({ from: "other", image: msg.image });
      }
    } catch {
      contacts[currentContact].messages.push({ from: "other", text: e.data });
    }
    localStorage.setItem("contacts", JSON.stringify(contacts));
    openChat(currentContact);
  };

  pc.onicecandidate = e => {
    if (!e.candidate) {
      document.getElementById("generatedOffer").value = JSON.stringify(pc.localDescription);
    }
  };

  pc.createOffer().then(offer => {
    pc.setLocalDescription(offer);
    currentConnection = pc;
    currentChannel = dc;
  });
}

function startAnswer(offer, name) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

  pc.ondatachannel = e => {
    currentChannel = e.channel;
    currentChannel.onmessage = e => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.image) {
          contacts[name].messages.push({ from: "other", image: msg.image });
        }
      } catch {
        contacts[name].messages.push({ from: "other", text: e.data });
      }
      localStorage.setItem("contacts", JSON.stringify(contacts));
      openChat(name);
    };
  };

  pc.setRemoteDescription(new RTCSessionDescription(offer)).then(() => {
    pc.createAnswer().then(answer => {
      pc.setLocalDescription(answer);
      currentConnection = pc;
      contacts[name] = { offer: JSON.stringify(offer), messages: [] };
      localStorage.setItem("contacts", JSON.stringify(contacts));
      updateContactList();

      setTimeout(() => {
        document.getElementById("generatedOffer").value = JSON.stringify(pc.localDescription);
        alert("تم إنشاء Answer. انسخه وأرسله.");
      }, 800);
    });
  });
}

function finishConnection(answer, name) {
  if (!currentConnection) return alert("لا يوجد اتصال جاري");
  currentConnection.setRemoteDescription(new RTCSessionDescription(answer));
  contacts[name] = contacts[name] || { messages: [] };
  localStorage.setItem("contacts", JSON.stringify(contacts));
  updateContactList();
  alert("تم الاتصال!");
}

function copyGeneratedOffer() {
  const offer = document.getElementById("generatedOffer").value;
  if (offer) navigator.clipboard.writeText(offer).then(() => alert("تم النسخ ✅"));
}

function toggleInstructions() {
  const el = document.getElementById("instructions");
  el.style.display = el.style.display === "none" ? "block" : "none";
}
