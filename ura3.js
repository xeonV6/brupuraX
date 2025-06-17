let currentConnection = null;
let currentChannel = null;
let currentContact = null;

let offerConnection = null;
let offerChannel = null;

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

// تحديث القائمة اليمنى مع زر حذف
function updateContactList() {
  const list = document.getElementById("contactList");
  list.innerHTML = "";
  for (let name in contacts) {
    const li = document.createElement("li");
    li.textContent = name;
    li.onclick = () => connectTo(name);

    // زر حذف
    const delBtn = document.createElement("button");
    delBtn.textContent = "حذف";
    delBtn.className = "delete-btn";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`هل أنت متأكد من حذف الصديق "${name}"؟`)) {
        delete contacts[name];
        localStorage.setItem("contacts", JSON.stringify(contacts));
        if (currentContact === name) {
          currentContact = null;
          currentConnection?.close();
          currentConnection = null;
          currentChannel = null;
          document.getElementById("chatWith").textContent = "اختر صديقًا";
          document.getElementById("messages").innerHTML = "";
        }
        updateContactList();
      }
    };

    li.appendChild(delBtn);
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

    currentChannel.onopen = () => {
      console.log("قناة البيانات مفتوحة");
    };

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
      alert("تم الاتصال مع " + name + " ✅\nانسخ الـ Answer وشاركها مع الطرف الآخر.");
      // يعرض الـ answer في مكان ما (مثلاً من خلال alert) لتنسخه
      console.log("Answer:", JSON.stringify(currentConnection.localDescription));
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
  if (!msg) return;

  if (!currentChannel || currentChannel.readyState !== "open") {
    alert("القناة غير مفتوحة أو لا يوجد اتصال.");
    return;
  }

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
async function createOffer() {
  offerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  offerChannel = offerConnection.createDataChannel("chat");

  offerChannel.onopen = () => {
    console.log("تم فتح القناة");
  };
  offerChannel.onmessage = (e) => {
    console.log("استلمت:", e.data);
  };

  offerConnection.onicecandidate = (event) => {
    if (event.candidate === null) {
      document.getElementById("generatedOffer").value = JSON.stringify(offerConnection.localDescription);
    }
  };

  offerConnection.onconnectionstatechange = () => {
    console.log("حالة الاتصال:", offerConnection.connectionState);
  };

  try {
    const offer = await offerConnection.createOffer();
    await offerConnection.setLocalDescription(offer);
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

// تطبيق الـ Answer
async function setAnswer() {
  if (!offerConnection) {
    alert("لا يوجد اتصال لإنشاء الإجابة.");
    return;
  }
  const answerText = document.getElementById("answerInput").value.trim();
  if (!answerText) {
    alert("يرجى لصق الـ Answer أولاً.");
    return;
  }

  try {
    const answerDesc = new RTCSessionDescription(JSON.parse(answerText));
    await offerConnection.setRemoteDescription(answerDesc);
    alert("تم تطبيق الإجابة بنجاح.");
  } catch (e) {
    alert("خطأ في تطبيق الإجابة: " + e);
  }
}
