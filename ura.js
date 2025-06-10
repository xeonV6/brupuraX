let localConnection;
let remoteConnection;
let dataChannel;

async function createConnection() {
  localConnection = new RTCPeerConnection();
  dataChannel = localConnection.createDataChannel("chat");

  dataChannel.onmessage = (event) => {
    const msg = document.createElement('div');
    msg.textContent = "الطرف الآخر: " + event.data;
    document.getElementById('messages').appendChild(msg);
  };

  const offer = await localConnection.createOffer();
  await localConnection.setLocalDescription(offer);

  localConnection.onicecandidate = (event) => {
    if (event.candidate === null) {
      document.getElementById("offer").value = JSON.stringify(localConnection.localDescription);
    }
  };
}

async function setAnswer() {
  const answerText = document.getElementById("answer").value;
  const remoteDesc = new RTCSessionDescription(JSON.parse(answerText));
  await localConnection.setRemoteDescription(remoteDesc);
}

async function receiveOffer(offerText) {
  remoteConnection = new RTCPeerConnection();

  remoteConnection.ondatachannel = (event) => {
    const receiveChannel = event.channel;
    receiveChannel.onmessage = (e) => {
      const msg = document.createElement('div');
      msg.textContent = "الطرف الآخر: " + e.data;
      document.getElementById('messages').appendChild(msg);
    };
    dataChannel = receiveChannel;
  };

  const desc = new RTCSessionDescription(JSON.parse(offerText));
  await remoteConnection.setRemoteDescription(desc);

  const answer = await remoteConnection.createAnswer();
  await remoteConnection.setLocalDescription(answer);

  remoteConnection.onicecandidate = (event) => {
    if (event.candidate === null) {
      document.getElementById("offer").value = JSON.stringify(remoteConnection.localDescription);
    }
  };
}

function receiveManualOffer() {
  const offerText = document.getElementById("answer").value;
  receiveOffer(offerText);
}

function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input.value;
  if (message && dataChannel && dataChannel.readyState === "open") {
    dataChannel.send(message);
    const msg = document.createElement('div');
    msg.textContent = "أنت: " + message;
    document.getElementById('messages').appendChild(msg);
    input.value = "";
  }
}
