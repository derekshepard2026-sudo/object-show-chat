const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Datastore = require('@seald-io/nedb');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 }); // Soporte para archivos grandes (APKs, ZIPs)

// Crear carpetas de almacenamiento si no existen
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Bases de datos locales (NeDB)
const usersDB = new Datastore({ filename: 'users.db', autoload: true });
const messagesDB = new Datastore({ filename: 'messages.db', autoload: true });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuración de subida de archivos (Galería, GIFs, Banners, APKs, ZIPs)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// RUTA: Subir archivos/media
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió archivo' });
  res.json({ url: '/uploads/' + req.file.filename, filename: req.file.originalname });
});

// RUTA: Registro de usuario
app.post('/api/register', (req, res) => {
  const { username, displayName, password } = req.body;
  const cleanUsername = username.toLowerCase().replace('@', '');

  usersDB.findOne({ username: cleanUsername }, (err, existing) => {
    if (existing) return res.status(400).json({ error: 'El @username ya existe' });

    const newUser = {
      username: cleanUsername,
      displayName: displayName || cleanUsername,
      password,
      avatar: '/bfdi_default.png',
      banner: '',
      nitro: true,
      status: 'online'
    };

    usersDB.insert(newUser, (err, doc) => {
      res.json({ success: true, user: doc });
    });
  });
});

// RUTA: Inicio de Sesión
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const cleanUsername = username.toLowerCase().replace('@', '');

  usersDB.findOne({ username: cleanUsername, password }, (err, user) => {
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });
    res.json({ success: true, user });
  });
});

// Socket.io (Mensajería en Tiempo Real)
io.on('connection', (socket) => {
  socket.on('user_online', (username) => {
    socket.username = username;
    io.emit('status_change', { username, status: 'online' });
  });

  socket.on('send_chat_message', (data) => {
    const msgData = {
      sender: data.sender,
      receiver: data.receiver,
      text: data.text || '',
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      timestamp: new Date()
    };
    messagesDB.insert(msgData, (err, saved) => {
      io.emit('new_chat_message', saved);
    });
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      io.emit('status_change', { username: socket.username, status: 'offline' });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Object Show CHAT activo en puerto ${PORT}`));

