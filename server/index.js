require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const authRouter = require('./routes/auth');
const SocketHandler = require('./game/SocketHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 5000
});

app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));
app.use('/shared', express.static(path.join(__dirname, '../shared')));
app.use('/api/auth', authRouter);

new SocketHandler(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
======================================
  RuneWord Chronicle Server
  Port: ${PORT}
  http://localhost:${PORT}
======================================
  `);
});
