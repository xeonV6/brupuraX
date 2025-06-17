let peerConnection = null;
let dataChannel = null;
let currentContact = null;
let contacts = JSON.parse(localStorage.getItem("contacts")) || {};
updateContactList();

function addContact() {
  const name = document.getElementById("contactName").value.trim();
  const offer = document.getElementById("contactOffer").value.trim();
  if (!name || !offer) return alert("يرجى إدخال الاسم والعرض.");

  contacts[name] = { offer: offer, messages: [] };
  localStorage.setItem("contacts", JSON.stringify(contacts));
  updateContactList();

  document.getElementById("contactName").value = "";
  document.getElementById("contactOffer").value = "";
}

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

async function createOffer() {
  peerConnection = new RTCPeerConnection();
  dataChannel = peerConnection.createDataChannel("chat");

  dataChannel.onopen = () => console.log("القناة مفتوحة");
  dataChannel.onmessage = (e) => {
    console.log("رسالة مستلمة:", e.data);
  };

  peerConnection.onicecandidate = (event) => {
    if (!event.candidate) {
      document.getElementById("generatedOffer").value = JSON.stringify(peerConnection.localDescription);
    }
  };

  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
  } catch (err) {
    alert("خطأ في إنشاء الـ Offer: " + err.message);
  }
}

async function connectTo(name) {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
    dataChannel = null;
  }

  currentContact = name;
  document.getElementById("chatWith").textContent = "الدردشة مع: " + name;
  document.getElementById("messages").innerHTML = "";

  const contact = contacts[name];
  if (!contact || !contact.offer) {
    alert("لا يوجد عرض (Offer) لهذا الصديق.");
    return;
  }

  try {
    peerConnection = new RTCPeerConnection();

    peerConnection.ondatachannel = (event) => {
      dataChannel = event.channel;
      dataChannel.onmessage = (e) => {
        addMessage("الطرف الآخر", e.data);
        contact.messages.push({ from: "other", text: e.data });
        localStorage.setItem("contacts", JSON.stringify(contacts));
      };
    };

    const offerDesc = new RTCSessionDescription(JSON.parse(contact.offer));
    await peerConnection.setRemoteDescription(offerDesc);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        alert("تم الاتصال مع " + name + " ✅");
      }
    };

    // استرجاع المحادثة السابقة
    if (contact.messages) {
      contact.messages.forEach(msg => {
        addMessage(msg.from === "me" ? "أنت" : "الطرف الآخر", msg.text);
      });
    }
  } catch (err) {
    alert("خطأ في الاتصال: " + err.message);
  }
}

function sendMessage() {
  const input = document.getElementById("messageInput");
  const msg = input.value.trim();
  if (!msg || !dataChannel || dataChannel.readyState !== "open") return;

  dataChannel.send(msg);
  addMessage("أنت", msg);

  if (currentContact) {
    contacts[currentContact].messages.push({ from: "me", text: msg });
    localStorage.setItem("contacts", JSON.stringify(contacts));
  }
  input.value = "";
}

function addMessage(sender, text) {
  const messagesDiv = document.getElementById("messages");
  const msgDiv = document.createElement("div");
  msgDiv.textContent = `${sender}: ${text}`;
  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function copyGeneratedOffer() {
  const offer = document.getElementById("generatedOffer").value;
  if (!offer) return alert("لا يوجد Offer لنسخه.");
  navigator.clipboard.writeText(offer).then(() => {
    alert("تم نسخ الـ Offer ✅");
  }).catch(() => {
    alert("فشل نسخ الـ Offer.");
  });
}
