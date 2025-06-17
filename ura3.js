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
  currentConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  currentConnection.ondatachannel = (event) => {
    currentChannel = event.channel;
    currentChannel.onmessage = (e) => {
      addMessage("الطرف الآخر", e.data);
      contact.messages.push({ from: "other", text: e.data });
      localStorage.setItem("contacts", JSON.stringify(contacts));
    };
    currentChannel.onopen = () => console.log("قناة البيانات مفتوحة");
  };

  await currentConnection.setRemoteDescription(offerDesc);
  const answer = await currentConnection.createAnswer();
  await currentConnection.setLocalDescription(answer);

  currentConnection.onicecandidate = (event) => {
    console.log("onicecandidate:", event.candidate);
    if (event.candidate === null) {
      alert("تم الاتصال مع " + name + " ✅");
    }
  };

  currentConnection.onconnectionstatechange = () => {
    console.log("حالة الاتصال:", currentConnection.connectionState);
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

// إنشاء Offer
let offerConnection;
let offerChannel;

async function createOffer() {
  offerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  offerChannel = offerConnection.createDataChannel("chat");

  offerChannel.onopen = () => console.log("تم فتح القناة");
  offerChannel.onmessage = (e) => console.log("استلمت:", e.data);

  offerConnection.onicecandidate = (event) => {
    console.log("onicecandidate fired:", event.candidate);
    if (event.candidate === null) {
      console.log("تم الانتهاء من جمع ICE candidates");
      setTimeout(() => {
        document.getElementById("generatedOffer").value = JSON.stringify(offerConnection.localDescription);
        console.log("تم تعيين العرض في textarea");
      }, 500);
    }
  };

  offerConnection.onconnectionstatechange = () => {
    console.log("حالة الاتصال:", offerConnection.connectionState);
  };

  try {
    const offer = await offerConnection.createOffer();
    console.log("تم إنشاء العرض:", offer);
    await offerConnection.setLocalDescription(offer);
    console.log("تم تعيين العرض المحلي");
  } catch (error) {
    alert("حدث خطأ أثناء إنشاء الـ Offer: " + error);
  }
}

// نسخ الـ Offer
function copyGeneratedOffer() {
  const offer = document.getElementById("generatedOffer").value;
  if (offer) {
    navigator.clipboard.writeText(offer).then(() => {
      alert("تم نسخ الـ Offer ✅");
    });
  }
}
