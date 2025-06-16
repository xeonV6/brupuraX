let currentConnection = null;
let currentChannel = null;
let currentContact = null;

// تحميل الأصدقاء من التخزين
let contacts = JSON.parse(localStorage.getItem("contacts")) || {};
updateContactList();

// إضافة صديق جديد
function addContact() {
  const name = document.getElementById("contactName").value.trim();
  const offer = document.getElementById("contactOffer").value.trim();
  if (!name || !offer) return alert("يرجى إدخال الاسم والعرض.");

  contacts[name] = {
    offer: offer,
    messages: []
  };

  localStorage.setItem("contacts", JSON.stringify(contacts));
  updateContactList();
  document.getElementById("contactName").value = "";
  document.getElementById("contactOffer").value = "";
}

// تحديث القائمة اليمنى
function updateContactList() {
  const list = document.getElementById("contactList");
  list.innerHTML = "";
  for (let name in contacts) {
    const li = document.createElement("li");
    li.textContent = name;
    li.onclick = () => connectTo(name);
    list.appendChild(li);
  }
}

// الاتصال بشخص
async function connectTo(name) {
  if (currentConnection) {
    currentConnection.close();
    currentChannel = null;
  }

  currentContact = name;
  document.getElementById("chatWith").textContent = "الدردشة مع: " + name;
  document.getElementById("messages").innerHTML = "";

  const contact = contacts[name];
  const offerDesc = new RTCSessionDescription(JSON.parse(contact.offer));
  currentConnection = new RTCPeerConnection();

  currentConnection.ondatachannel = (event) => {
    currentChannel = event.channel;
    currentChannel.onmessage = (e) => {
      addMessage("الطرف الآخر", e.data);
      contact.messages.push({ from: "other", text: e.data });
      localStorage.setItem("contacts", JSON.stringify(contacts));
    };
  };

  await currentConnection.setRemoteDescription(offerDesc);
  const answer = await currentConnection.createAnswer();
  await currentConnection.setLocalDescription(answer);

  currentConnection.onicecandidate = (event) => {
    if (event.candidate === null) {
      alert("تم الاتصال مع " + name + " ✅");
    }
  };

  // استرجاع المحادثة
  if (contact.messages) {
    contact.messages.forEach(msg => {
      addMessage(msg.from === "me" ? "أنت" : "الطرف الآخر", msg.text);
    });
  }
}

// إرسال رسالة
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

// عرض الرسالة على الشاشة
function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.textContent = `${sender}: ${text}`;
  document.getElementById("messages").appendChild(msg);
}

let localConnectionForOffer;

async function createOffer() {
  localConnectionForOffer = new RTCPeerConnection();
  const dataChannel = localConnectionForOffer.createDataChannel("chat");

  const offer = await localConnectionForOffer.createOffer();
  await localConnectionForOffer.setLocalDescription(offer);

  localConnectionForOffer.onicecandidate = (event) => {
    if (!event.candidate) {
      document.getElementById("generatedOffer").value = JSON.stringify(localConnectionForOffer.localDescription);
    }
  };
}

let connection;
let dataChannel;

async function createOffer() {
  connection = new RTCPeerConnection();
  dataChannel = connection.createDataChannel("chat");

  dataChannel.onopen = () => console.log("Channel Opened");
  dataChannel.onmessage = (e) => {
    console.log("Received:", e.data);
  };

  connection.onicecandidate = (event) => {
    if (!event.candidate) {
      document.getElementById("generatedOffer").value = JSON.stringify(connection.localDescription);
    }
  };

  const offer = await connection.createOffer();
  await connection.setLocalDescription(offer);
}

function copyGeneratedOffer() {
  const offer = document.getElementById("generatedOffer").value;
  if (offer) {
    navigator.clipboard.writeText(offer).then(() => {
      alert("تم نسخ الـ Offer");
    });
  }
}
