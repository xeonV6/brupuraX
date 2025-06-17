let contacts = JSON.parse(localStorage.getItem("contacts")) || {};
let currentConnection = null;
let currentChannel = null;
let currentContact = null;

updateContactList();

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
    li.textContent = name;
    li.onclick = () => openChat(name);

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "حذف";
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

async function createOffer() {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  const dc = pc.createDataChannel("chat");

  dc.onopen = () => console.log("Channel Opened");
  dc.onmessage = (e) => {
    addMessage("الطرف الآخر", e.data);
    contacts[currentContact].messages.push({ from: "other", text: e.data });
    localStorage.setItem("contacts", JSON.stringify(contacts));
  };

  pc.onicecandidate = (e) => {
    if (!e.candidate) {
      document.getElementById("generatedOffer").value = JSON.stringify(pc.localDescription);
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  currentConnection = pc;
  currentChannel = dc;
}

async function startAnswer(offer, name) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

  pc.ondatachannel = (e) => {
    currentChannel = e.channel;
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
  contacts[name] = { offer: JSON.stringify(offer), messages: [] };
  localStorage.setItem("contacts", JSON.stringify(contacts));
  updateContactList();

  setTimeout(() => {
    document.getElementById("generatedOffer").value = JSON.stringify(pc.localDescription);
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

function copyGeneratedOffer() {
  const offer = document.getElementById("generatedOffer").value;
  if (offer) {
    navigator.clipboard.writeText(offer).then(() => {
      alert("تم النسخ ✅");
    });
  }
}

// إضافة هذه الدالة لنسخ الـ Answer مباشرة عند لصق الـ Offer والضغط على الزر
async function copyAnswerFromOffer() {
  const offerText = document.getElementById("contactOffer").value.trim();
  if (!offerText) {
    alert("الرجاء لصق الـ Offer أولاً.");
    return;
  }

  try {
    const offerDesc = new RTCSessionDescription(JSON.parse(offerText));
    const tempConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    await tempConnection.setRemoteDescription(offerDesc);
    const answer = await tempConnection.createAnswer();
    await tempConnection.setLocalDescription(answer);

    // انتظر بعض الوقت لجمع ICE candidates (اختياري)
    await new Promise(res => setTimeout(res, 1000));

    const finalAnswer = JSON.stringify(tempConnection.localDescription);

    await navigator.clipboard.writeText(finalAnswer);
    alert("تم نسخ الـ Answer بنجاح ✅");

    tempConnection.close();
  } catch (error) {
    alert("حدث خطأ أثناء إنشاء الـ Answer: " + error.message);
  }
}
