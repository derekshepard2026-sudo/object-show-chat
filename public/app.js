const socket = io();
let currentUser = JSON.parse(localStorage.getItem('osc_user')) || null;
let activeFriend = null;

// Auto-Login si ya existe la sesión
if (currentUser) {
  initApp();
}

function register() {
  const displayName = document.getElementById('reg-display').value;
  const username = document.getElementById('reg-user').value;
  const password = document.getElementById('reg-pass').value;

  fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, username, password })
  }).then(res => res.json()).then(data => {
    if (data.error) return alert(data.error);
    currentUser = data.user;
    localStorage.setItem('osc_user', JSON.stringify(currentUser));
    initApp();
  });
}

function login() {
  const username = document.getElementById('reg-user').value;
  const password = document.getElementById('reg-pass').value;

  fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  }).then(res => res.json()).then(data => {
    if (data.error) return alert(data.error);
    currentUser = data.user;
    localStorage.setItem('osc_user', JSON.stringify(currentUser));
    initApp();
  });
}

function initApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('my-display').innerText = currentUser.displayName;
  document.getElementById('my-tag').innerText = '@' + currentUser.username;
  document.getElementById('my-avatar').src = currentUser.avatar || '/bfdi_default.png';

  socket.emit('user_online', currentUser.username);
}

function triggerUpload(id) { document.getElementById(id).click(); }

function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);

  fetch('/api/upload', { method: 'POST', body: formData })
    .then(res => res.json())
    .then(data => {
      currentUser.avatar = data.url;
      document.getElementById('my-avatar').src = data.url;
      localStorage.setItem('osc_user', JSON.stringify(currentUser));
      playBfdiSound();
    });
}

function addFriend() {
  const targetTag = document.getElementById('friend-search').value.toLowerCase().replace('@', '');
  if (!targetTag) return;
  
  const container = document.getElementById('friends-list');
  const div = document.createElement('div');
  div.className = 'friend-item';
  div.innerHTML = `<b>@${targetTag}</b>`;
  div.onclick = () => selectFriend(targetTag);
  container.appendChild(div);
  document.getElementById('friend-search').value = '';
}

function selectFriend(tag) {
  activeFriend = tag;
  document.getElementById('active-chat-header').innerText = 'Chat con @' + tag;
  document.getElementById('messages-container').innerHTML = '';
}

function sendMessage() {
  const input = document.getElementById('message-text');
  if (!input.value || !activeFriend) return;

  socket.emit('send_chat_message', {
    sender: currentUser.username,
    receiver: activeFriend,
    text: input.value
  });
  input.value = '';
  playBfdiSound();
}

function sendFile(input) {
  const file = input.files[0];
  if (!file || !activeFriend) return;

  const formData = new FormData();
  formData.append('file', file);

  fetch('/api/upload', { method: 'POST', body: formData })
    .then(res => res.json())
    .then(data => {
      socket.emit('send_chat_message', {
        sender: currentUser.username,
        receiver: activeFriend,
        fileUrl: data.url,
        fileName: data.filename
      });
      playBfdiSound();
    });
}

socket.on('new_chat_message', (msg) => {
  if (msg.sender === currentUser.username || msg.sender === activeFriend) {
    const container = document.getElementById('messages-container');
    const div = document.createElement('div');
    div.className = `message ${msg.sender === currentUser.username ? 'mine' : ''}`;
    
    if (msg.text) div.innerText = msg.text;
    if (msg.fileUrl) {
      if (msg.fileUrl.match(/\.(jpeg|jpg|gif|png)$/i)) {
        div.innerHTML += `<br><img src="${msg.fileUrl}">`;
      } else {
        div.innerHTML += `<br><a href="${msg.fileUrl}" download target="_blank" style="color:yellow;">💾 Descargar Archivo: ${msg.fileName}</a>`;
      }
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }
});

function openSettings() { document.getElementById('settings-modal').style.display = 'flex'; }
function closeSettings() { document.getElementById('settings-modal').style.display = 'none'; }
function switchAccount() {
  localStorage.removeItem('osc_user');
  location.reload();
}

function playBfdiSound() {
  const sound = document.getElementById('bfdi-sound');
  if(sound) { sound.currentTime = 0; sound.play().catch(()=>{}); }
}

