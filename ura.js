let yourName, friendName, chatCode, roomId;
let messagesDiv;

function joinChat() {
  yourName = document.getElementById('yourName').value.trim();
  friendName = document.getElementById('friendName').value.trim();
  chatCode = document.getElementById('chatCode').value.trim();

  if (!yourName || !friendName || !chatCode) {
    alert("الرجاء تعبئة جميع الحقول.");
    return;
  }

  // توليد معرف الغرفة (مشفر بطريقة بسيطة)
  roomId = btoa(yourName + friendName + chatCode);

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('chat-screen').style.display = 'block';

  document.getElementById('you').innerText = yourName;
  document.getElementById('friend').innerText = friendName;
  messagesDiv = document.getElementById('messages');

  loadMessages();
}

function sendMessage() {
  const input = document.getElementById('messageInput');
  const msg = input.value.trim();
  if (!msg) return;

  const message = {
    name: yourName,
    text: msg,
    time: new Date().toLocaleTimeString()
  };

  const saved = localStorage.getItem(roomId);
  let chat = saved ? JSON.parse(saved) : [];
  chat.push(message);
  localStorage.setItem(roomId, JSON.stringify(chat));

  input.value = "";
  loadMessages();
}

function loadMessages() {
  const saved = localStorage.getItem(roomId);
  let chat = saved ? JSON.parse(saved) : [];

  messagesDiv.innerHTML = "";
  chat.forEach(m => {
    const div = document.createElement('div');
    div.className = 'message';
    div.innerText = `${m.name} (${m.time}):\n${m.text}`;
    messagesDiv.appendChild(div);
  });

  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// تحديث المحادثة تلقائياً كل 3 ثواني
setInterval(() => {
  if (roomId) loadMessages();
}, 3000);
