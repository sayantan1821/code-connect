const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const chat = require('./routes/api/chat');
const message = require('./routes/api/message');
const app = express();
const cors = require('cors');
require('dotenv').config();

connectDB();

app.use(express.json());
app.options('/products/:id', cors())
app.use('/api/users', require('./routes/api/users'));
app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/profile', require('./routes/api/profile'));
app.use('/api/posts', require('./routes/api/posts'));
app.use('/api/chat', chat);
app.use('/api/message', message);
app.use('/', (req, res) => {
  res.send('API is running');
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('client/build'));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}

const PORT = process.env.PORT || 1821;

const server = app.listen(PORT, () =>
  console.log(`Server started on port ${PORT}`)
);
const io = require('socket.io')(server, {
  pingTimeout: 60000,
  // cors: {
  //   origin: '*'
  //   // methods:"*"
  //   // credentials: true,
  // }
  cors: {
    origin: "http://localhost:1821",
    methods: ["GET", "POST"]
  }
});
io.on('connection', (socket) => {
  console.log('Connected to socket.io');
  socket.on('setup', (userData) => {
    socket.join(userData._id);
    socket.emit('connected');
  });

  socket.on('join chat', (room) => {
    socket.join(room);
    console.log('User Joined Room: ' + room);
  });
  socket.on('typing', (room) => socket.in(room).emit('typing'));
  socket.on('stop typing', (room) => socket.in(room).emit('stop typing'));

  socket.on('new message', (newMessageRecieved) => {
    var chat = newMessageRecieved.chat;

    if (!chat.users) return console.log('chat.users not defined');

    chat.users.forEach((user) => {
      if (user._id == newMessageRecieved.sender._id) return;

      socket.in(user._id).emit('message recieved', newMessageRecieved);
    });
  });

  socket.off('setup', () => {
    console.log('USER DISCONNECTED');
    socket.leave(userData._id);
  });
});
