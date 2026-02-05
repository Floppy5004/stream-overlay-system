const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 5004;
const PASSWORDS = { 'derstrese': '2627' };

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'public', 'uploads', req.params.streamerId.toLowerCase());
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'))
});
const upload = multer({ storage });

app.post('/api/auth', (req, res) => res.sendStatus(PASSWORDS[req.body.streamerId.toLowerCase()] === req.body.password ? 200 : 401));
app.post('/api/upload/:streamerId', upload.single('mediaFile'), (req, res) => res.sendStatus(200));
app.get('/api/media/:streamerId', (req, res) => {
    const dir = path.join(__dirname, 'public', 'uploads', req.params.streamerId.toLowerCase());
    fs.readdir(dir, (err, files) => res.json(err ? [] : files));
});
app.delete('/api/media/:streamerId/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'uploads', req.params.streamerId.toLowerCase(), req.params.filename);
    fs.unlink(filePath, (err) => res.sendStatus(err ? 500 : 200));
});

app.get('/:streamerId/modoverlay', (req, res) => res.sendFile(path.join(__dirname, 'public', 'mod', 'index.html')));
app.get('/:streamerId/overlay-display', (req, res) => res.sendFile(path.join(__dirname, 'public', 'overlay', 'index.html')));

io.on('connection', (socket) => {
    console.log('Neue Verbindung:', socket.id);
    
    socket.on('join', (roomName) => {
        const room = roomName.toLowerCase();
        socket.join(room);
        console.log(`Socket ${socket.id} joined room: ${room}`);
        console.log('Clients in room:', io.sockets.adapter.rooms.get(room));
    });

    socket.on('overlay_ready', () => {
        const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
        console.log(`Overlay ready in rooms:`, rooms);
        rooms.forEach(room => {
            socket.to(room).emit('overlay_status', { connected: true });
            console.log(`Sent overlay_status to room ${room}`);
        });
    });
    
    socket.on('update_scene', (data) => {
        const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
        console.log(`Sending scene to rooms:`, rooms);
        rooms.forEach(room => {
            socket.to(room).emit('render_scene', data);
            console.log(`Sent render_scene to room ${room}`);
        });
    });
    
    socket.on('clear_scene', () => {
        const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
        console.log(`Clearing scene in rooms:`, rooms);
        rooms.forEach(room => {
            socket.to(room).emit('clear_scene');
        });
    });
    
    socket.on('disconnect', () => {
        console.log('Verbindung getrennt:', socket.id);
    });
});

server.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
