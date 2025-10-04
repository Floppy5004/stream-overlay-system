// server.js - Haupt-Backend für das Remote Stream Overlay System
// =============================================================

// --- Module importieren ---
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');

// --- Konfiguration laden ---
const configPath = path.join(__dirname, 'config', 'streamers.json');
let streamersConfig = {};

function loadConfig() {
    try {
        const configFile = fs.readFileSync(configPath, 'utf8');
        streamersConfig = JSON.parse(configFile);
        console.log("Streamer-Konfiguration erfolgreich geladen.");
    } catch (error) {
        console.error("FEHLER: Konfigurationsdatei 'streamers.json' konnte nicht gelesen werden.", error);
        process.exit(1); // Beendet den Prozess, wenn die Konfiguration fehlt
    }
}
loadConfig(); // Initiales Laden

// --- Express App und Server initialisieren ---
const app = express();
const server = http.createServer(app);
const port = 3000;

// --- Socket.io initialisieren ---
const io = new Server(server, {
    cors: {
        origin: "*", // Erlaubt Verbindungen von überall
        methods: ["GET", "POST"]
    }
});

// --- Middleware ---
app.use(cors()); // CORS für alle Routen aktivieren
app.use(express.json()); // Body-Parser für JSON-Anfragen

// Statische Dateien für die Hauptseite (optional)
app.get('/', (req, res) => {
    res.send('Stream Overlay System ist online.');
});

// --- Dynamische Routen basierend auf streamers.json erstellen ---
function setupStreamerRoutes() {
    streamersConfig.streamers.forEach(streamer => {
        const modPath = path.join(__dirname, 'public', 'mod');
        const overlayPath = path.join(__dirname, 'public', 'overlay');
        const uploadPath = path.join(__dirname, streamer.uploadDir);

        // Sicherstellen, dass der Upload-Ordner existiert
        if (!fs.existsSync(uploadPath)) {
            console.log(`Erstelle Upload-Verzeichnis für ${streamer.name}: ${uploadPath}`);
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        // Mod-Interface Route
        app.use(streamer.modUrl, express.static(modPath));
        console.log(`Mod-Interface für ${streamer.name} unter ${streamer.modUrl} registriert.`);

        // Overlay-Display Route
        app.use(streamer.overlayUrl, express.static(overlayPath));
        console.log(`Overlay für ${streamer.name} unter ${streamer.overlayUrl} registriert.`);

        // Route, um hochgeladene Medien bereitzustellen
        app.use(`/${streamer.uploadDir}`, express.static(path.join(__dirname, streamer.uploadDir)));
        console.log(`Medien-Route für ${streamer.name} unter /${streamer.uploadDir} registriert.`);
    });
}

setupStreamerRoutes();

// --- API-Endpunkte ---

// Passwort-Überprüfung
app.post('/api/auth', (req, res) => {
    const { streamerId, password } = req.body;
    const streamer = streamersConfig.streamers.find(s => s.id === streamerId);

    if (streamer && password === streamer.password) {
        res.status(200).json({ success: true, message: 'Authentifizierung erfolgreich.' });
    } else {
        res.status(401).json({ success: false, message: 'Ungültiges Passwort oder Streamer-ID.' });
    }
});

// Liste der Medien für einen Streamer abrufen
app.get('/api/media/:streamerId', (req, res) => {
    const streamer = streamersConfig.streamers.find(s => s.id === req.params.streamerId);
    if (!streamer) {
        return res.status(404).send('Streamer nicht gefunden.');
    }

    const uploadPath = path.join(__dirname, streamer.uploadDir);
    fs.readdir(uploadPath, (err, files) => {
        if (err) {
            console.error("Fehler beim Lesen des Medienverzeichnisses:", err);
            return res.status(500).json([]);
        }
        res.json(files.filter(file => !file.startsWith('.'))); // Versteckte Dateien ignorieren
    });
});

// Medien löschen
app.delete('/api/media/:streamerId/:filename', (req, res) => {
    const { streamerId, filename } = req.params;
    const streamer = streamersConfig.streamers.find(s => s.id === streamerId);
    if (!streamer) {
        return res.status(404).send('Streamer nicht gefunden.');
    }

    const filePath = path.join(__dirname, streamer.uploadDir, filename);

    // Sicherheitscheck, um Path Traversal zu verhindern
    if (!filePath.startsWith(path.join(__dirname, streamer.uploadDir))) {
        return res.status(403).send('Ungültiger Dateipfad.');
    }

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error(`Fehler beim Löschen der Datei ${filename}:`, err);
            return res.status(500).send('Datei konnte nicht gelöscht werden.');
        }
        res.status(200).send('Datei erfolgreich gelöscht.');
    });
});


// --- Multer für Datei-Uploads konfigurieren ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const streamerId = req.params.streamerId;
        const streamer = streamersConfig.streamers.find(s => s.id === streamerId);
        if (streamer) {
            const destPath = path.join(__dirname, streamer.uploadDir);
            cb(null, destPath);
        } else {
            cb(new Error('Streamer nicht gefunden!'), false);
        }
    },
    filename: function (req, file, cb) {
        // Bereinige den Dateinamen von Sonderzeichen
        const safeFilename = file.originalname.replace(/[^a-zA-Z0-9-._]/g, '_');
        cb(null, Date.now() + '-' + safeFilename);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50 MB Limit
    },
    fileFilter: function (req, file, cb) {
        // Erlaubte Dateitypen
        const filetypes = /jpeg|jpg|png|gif|mp4|webm/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Fehler: Nur Bilder (PNG, JPG, GIF) und Videos (MP4, WEBM) sind erlaubt!"));
    }
}).single('mediaFile'); // 'mediaFile' ist der Name des input-Feldes im HTML-Formular

// Upload-Endpunkt
app.post('/api/upload/:streamerId', (req, res) => {
    upload(req, res, function (err) {
        if (err) {
            console.error("Upload-Fehler:", err.message);
            return res.status(400).json({ success: false, message: err.message });
        }
        res.status(200).json({ success: true, message: 'Datei erfolgreich hochgeladen.', filename: req.file.filename });
    });
});


// --- WebSocket (Socket.io) Logik ---
io.on('connection', (socket) => {
    console.log(`Ein Client hat sich verbunden: ${socket.id}`);

    // Einem Raum beitreten (basierend auf der Streamer-ID)
    socket.on('joinRoom', (streamerId) => {
        socket.join(streamerId);
        console.log(`Socket ${socket.id} ist dem Raum '${streamerId}' beigetreten.`);
        
        // Benachrichtige die Mods, dass das Overlay verbunden ist
        // `to(streamerId)` sendet an alle im Raum, auch den Absender.
        // `socket.to(streamerId)` sendet an alle außer den Absender.
        io.to(streamerId).emit('overlay:status', { connected: true });
    });

    // Events vom Mod-Interface empfangen und an das Overlay im selben Raum weiterleiten
    const forwardEvents = [
        'canvas:show', 'canvas:hide',
        'live:start', 'live:stroke', 'live:stop', 'live:clear',
        'media:show', 'media:hide'
    ];

    forwardEvents.forEach(eventName => {
        socket.on(eventName, (data) => {
            // Daten enthalten die streamerId, um an den richtigen Raum zu senden
            if (data && data.streamerId) {
                console.log(`Event '${eventName}' für Raum '${data.streamerId}' empfangen.`);
                // Sende das Event an alle anderen Clients im Raum
                socket.to(data.streamerId).emit(eventName, data);
            }
        });
    });

    socket.on('disconnecting', () => {
        // Beim Disconnect prüfen, ob der Socket in einem Raum war (als Overlay)
        // rooms ist ein Set, das die Socket-ID und alle beigetretenen Räume enthält.
        const rooms = Object.keys(socket.rooms);
        rooms.forEach(room => {
            if (room !== socket.id) {
                 // Benachrichtige die Mods, dass das Overlay getrennt wurde
                io.to(room).emit('overlay:status', { connected: false });
                console.log(`Overlay aus Raum ${room} hat die Verbindung getrennt.`);
            }
        });
    });

    socket.on('disconnect', () => {
        console.log(`Client hat die Verbindung getrennt: ${socket.id}`);
    });
});


// --- Server starten ---
server.listen(port, () => {
    console.log(`Overlay Server läuft auf http://localhost:${port}`);
});