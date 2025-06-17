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
    delBtn.textContent = "✖";
    delBtn.title = "حذف الصديق";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if(confirm(`هل تريد حذف الصديق "${name}" وجميع محادثاته؟`)){
        delete contacts[name];
        localStorage.setItem("contacts", JSON.stringify(contacts));
        if(currentContact === name) {
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
  });
}

function openChat(name) {
  currentContact = name;
  document.getElementById("chatWith").textContent = "الدردشة مع: " + name;
  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = "";

  (contacts[name]?.messages || []).forEach((msg, idx) => {
    addMessageToDom(msg.from === "me" ? "أنت" : "الطرف الآخر", msg.text, idx);
  });
}

function addMessageToDom(sender, text, msgIndex, isImage = false) {
  const messagesDiv = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "message";

  div.title = "اضغط مرتين لحذف الرسالة";
  div.ondblclick = () => {
    if(confirm("هل تريد حذف هذه الرسالة؟")){
      contacts[currentContact].messages.splice(msgIndex, 1);
      localStorage.setItem("contacts", JSON.stringify(contacts));
      openChat(currentContact);
    }
  };

  if (isImage) {
    div.innerHTML = `<strong>${sender}:</strong><br><img src="${text}" alt="صورة مرسلة"/>`;
  } else {
    div.textContent = `${sender}: ${text}`;
  }

  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function sendMessage() {
  const input = document.getElementById("messageInput");
  const msg = input.value.trim();

  if (!msg && !selectedImageData) return;
  if (!currentChannel || currentChannel.readyState !== "open") return alert("لا يوجد اتصال مفتوح");

  if(selectedImageData){
    currentChannel.send(JSON.stringify({ type: "image", data: selectedImageData }));
    addMessageToDom("أنت", selectedImageData, contacts[currentContact].messages.length, true);
    contacts[currentContact].messages.push({ from: "me", text: selectedImageData, isImage: true });
    selectedImageData = null;
    document.getElementById("imageInput").value = "";
  }

  if(msg){
    currentChannel.send(msg);
    addMessageToDom("أنت", msg, contacts[currentContact].messages.length);
    contacts[currentContact].messages.push({ from: "me", text: msg });
  }

  localStorage.setItem("contacts", JSON.stringify(contacts));
  input.value = "";
}

let selectedImageData = null;
document.getElementById("imageInput").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    selectedImageData = event.target.result;
  };
  reader.readAsDataURL(file);
});

async function createOffer() {
  if(!currentContact){
    return alert("اختر صديقًا أولاً!");
  }
  if(currentConnection){
    currentConnection.close();
  }

  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  const dc = pc.createDataChannel("chat");

  dc.onopen = () => console.log("Channel Opened");
  dc.onmessage = (e) => {
    let msgData;
    try {
      msgData = JSON.parse(e.data);
    } catch {
      msgData = e.data;
    }

    if(typeof msgData === "object" && msgData.type === "image"){
      addMessageToDom("الطرف الآخر", msgData.data, contacts[currentContact].messages.length, true);
      contacts[currentContact].messages.push({ from: "other", text: msgData.data, isImage: true });
    } else {
      addMessageToDom("الطرف الآخر", e.data, contacts[currentContact].messages.length);
      contacts[currentContact].messages.push({ from: "other", text: e.data });
    }
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

  if(!contacts[currentContact]) contacts[currentContact] = { messages: [] };
  localStorage.setItem("contacts", JSON.stringify(contacts));
}

async function startAnswer(offer, name) {
  if(currentConnection){
    currentConnection.close();
  }

  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

  pc.ondatachannel = (e) => {
    currentChannel = e.channel;
    currentChannel.onmessage = (e) => {
      let msgData;
      try {
        msgData = JSON.parse(e.data);
      } catch {
        msgData = e.data;
      }

      if(typeof msgData === "object" && msgData.type === "image"){
        addMessageToDom("الطرف الآخر", msgData.data, contacts[name].messages.length, true);
        contacts[name].messages.push({ from: "other", text: msgData.data, isImage: true });
      } else {
        addMessageToDom("الطرف الآخر", e.data, contacts[name].messages.length);
        contacts[name].messages.push({ from: "other", text: e.data });
      }
      localStorage.setItem("contacts", JSON.stringify(contacts));
    };
  };

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  currentConnection = pc;
  contacts[name] = contacts[name] || { messages: [] };
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

    await new Promise(res => setTimeout(res, 1000));

    const finalAnswer = JSON.stringify(tempConnection.localDescription);

    await navigator.clipboard.writeText(finalAnswer);
    alert("تم نسخ الـ Answer بنجاح ✅");

    tempConnection.close();
  } catch (error) {
    alert("حدث خطأ أثناء إنشاء الـ Answer: " + error.message);
  }
}
