// app.js - Client-seitige Logik für das Mod-Webinterface
// =======================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- Globale Variablen und Konstanten ---
    const socket = io();
    let streamerId = ''; // Wird aus der URL extrahiert

    // Authentifizierung
    const authWall = document.getElementById('auth-wall');
    const passwordInput = document.getElementById('password-input');
    const passwordSubmit = document.getElementById('password-submit');
    const authError = document.getElementById('auth-error');
    const mainContent = document.getElementById('main-content');

    // Canvas & Zeichenlogik
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const brushSizes = [2, 5, 10, 20, 40]; // Pixelwerte für die 5 Stufen
    let isDrawing = false;
    let isLiveDrawing = false;
    let currentTool = 'brush';
    let currentColor = '#FF0000';
    let currentBrushSize = 10;
    let lastPos = { x: 0, y: 0 };
    let history = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
    let historyStep = 0;

    // UI-Elemente
    const colorPicker = document.getElementById('color-picker');
    const brushSizeSlider = document.getElementById('brush-size');
    const brushPreview = document.getElementById('brush-preview');
    const liveDrawingToggle = document.getElementById('live-drawing-toggle');
    const showCanvasBtn = document.getElementById('show-canvas-btn');
    const hideCanvasBtn = document.getElementById('hide-canvas-btn');
    const clearCanvasBtn = document.getElementById('clear-canvas-btn');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');

    // Medien-Upload
    const mediaFileInput = document.getElementById('media-file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadProgress = document.getElementById('upload-progress');
    const mediaList = document.getElementById('media-list');

    // --- Initialisierung ---
    function initialize() {
        extractStreamerId();
        setupAuthListeners();
    }

    function extractStreamerId() {
        const pathParts = window.location.pathname.split('/');
        // Annahme: URL ist /StreamerName/Modoverlay
        if (pathParts.length > 2) {
            const potentialId = pathParts[1].toLowerCase();
            streamerId = potentialId;
            document.getElementById('streamer-name').textContent = pathParts[1];
        } else {
            console.error("Streamer-ID konnte nicht aus der URL extrahiert werden.");
            alert("Fehler: Streamer-ID nicht in URL gefunden!");
        }
    }
    
    // --- Authentifizierung ---
    function setupAuthListeners() {
        passwordSubmit.addEventListener('click', handleAuth);
        passwordInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') handleAuth();
        });
    }

    async function handleAuth() {
        const password = passwordInput.value;
        if (!password) {
            authError.textContent = 'Bitte Passwort eingeben.';
            return;
        }

        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ streamerId, password }),
            });

            const result = await response.json();
            if (result.success) {
                authWall.classList.add('hidden');
                mainContent.classList.remove('hidden');
                setupApplication();
            } else {
                authError.textContent = 'Falsches Passwort.';
                passwordInput.value = '';
            }
        } catch (error) {
            authError.textContent = 'Ein Fehler ist aufgetreten.';
            console.error('Auth-Fehler:', error);
        }
    }
    
    // --- Hauptanwendung nach erfolgreicher Anmeldung ---
    function setupApplication() {
        setupWebSocket();
        setupCanvas();
        setupControlEvents();
        loadMediaList();
    }

    // --- WebSocket-Verbindung ---
    function setupWebSocket() {
        socket.on('connect', () => {
            console.log('Verbunden mit dem WebSocket-Server!');
            socket.emit('joinRoom', streamerId);
        });
        
        socket.on('overlay:status', (data) => {
            const statusLight = document.getElementById('obs-status-light');
            if (data.connected) {
                statusLight.classList.remove('disconnected');
                statusLight.classList.add('connected');
                statusLight.title = 'Verbindung zur OBS Browser-Quelle ist aktiv.';
            } else {
                statusLight.classList.remove('connected');
                statusLight.classList.add('disconnected');
                statusLight.title = 'Keine Verbindung zur OBS Browser-Quelle.';
            }
        });
    }

    // --- Canvas-Logik ---
    function setupCanvas() {
        // Skalierung für hochauflösende Displays korrigieren (optional, aber empfohlen)
        const scale = window.devicePixelRatio;
        canvas.width = 1920;
        canvas.height = 1080;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }

    function getMousePos(canvasEl, evt) {
        const rect = canvasEl.getBoundingClientRect();
        return {
            x: (evt.clientX - rect.left) / rect.width * canvasEl.width,
            y: (evt.clientY - rect.top) / rect.height * canvasEl.height
        };
    }
    
    function startDrawing(e) {
        isDrawing = true;
        lastPos = getMousePos(canvas, e);

        // Bei Formen wie Kreis und Rechteck: Speichere Startpunkt
        if (['circle', 'filled-circle', 'rect', 'filled-rect', 'line'].includes(currentTool)) {
            // Temporäres Canvas zum Anzeigen der Vorschau
            // In dieser Version wird aus Einfachheitsgründen direkt gezeichnet
        }
    }

    function stopDrawing(e) {
        if (!isDrawing) return;
        isDrawing = false;
        
        // Finales Zeichnen für Formen
        draw(e);

        saveHistory();
    }
    
    // Throttling für Live-Zeichnen
    const throttledDraw = throttle(draw, 1000 / 60); // Max 60 FPS

    function draw(e) {
        if (!isDrawing) return;
        
        const currentPos = getMousePos(canvas, e);
        const data = {
            from: lastPos,
            to: currentPos,
            color: currentColor,
            size: currentBrushSize,
            tool: currentTool,
            streamerId: streamerId
        };

        if (isLiveDrawing) {
            socket.emit('live:stroke', data);
        }
        
        executeDraw(data);
        lastPos = currentPos;
    }

    function executeDraw(data) {
        ctx.strokeStyle = data.color;
        ctx.fillStyle = data.color;
        ctx.lineWidth = data.size;

        switch (data.tool) {
            case 'brush':
                ctx.beginPath();
                ctx.moveTo(data.from.x, data.from.y);
                ctx.lineTo(data.to.x, data.to.y);
                ctx.stroke();
                break;
            case 'eraser':
                ctx.clearRect(data.to.x - data.size/2, data.to.y - data.size/2, data.size, data.size);
                break;
            // Weitere Werkzeuge hier...
        }
    }
    
    function saveHistory() {
        history = history.slice(0, historyStep + 1);
        history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        historyStep++;
        updateUndoRedoButtons();
    }

    function undo() {
        if (historyStep > 0) {
            historyStep--;
            ctx.putImageData(history[historyStep], 0, 0);
             if(isLiveDrawing) sendFullCanvasUpdate();
            updateUndoRedoButtons();
        }
    }

    function redo() {
        if (historyStep < history.length - 1) {
            historyStep++;
            ctx.putImageData(history[historyStep], 0, 0);
            if(isLiveDrawing) sendFullCanvasUpdate();
            updateUndoRedoButtons();
        }
    }
    
    function sendFullCanvasUpdate() {
        socket.emit('live:start', { streamerId }); // signalisiert ein "reset"
        socket.emit('canvas:show', {
            streamerId: streamerId,
            imageData: canvas.toDataURL()
        });
    }

    function updateUndoRedoButtons() {
        undoBtn.disabled = historyStep === 0;
        redoBtn.disabled = historyStep === history.length - 1;
    }


    // --- Event-Listener für Steuerelemente ---
    function setupControlEvents() {
        // Werkzeugauswahl
        document.querySelectorAll('.tool').forEach(button => {
            button.addEventListener('click', () => {
                document.querySelector('.tool.active').classList.remove('active');
                button.classList.add('active');
                currentTool = button.dataset.tool;
            });
        });

        // Farbauswahl
        colorPicker.addEventListener('input', (e) => currentColor = e.target.value);

        // Pinseldicke
        brushSizeSlider.addEventListener('input', (e) => {
            currentBrushSize = brushSizes[e.target.value - 1];
            brushPreview.textContent = `${currentBrushSize}px`;
        });

        // Canvas Events
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', () => isDrawing = false);
        canvas.addEventListener('mousemove', (e) => {
            if (isLiveDrawing) {
                throttledDraw(e);
            } else {
                draw(e);
            }
        });

        // Aktionen
        showCanvasBtn.addEventListener('click', () => {
            socket.emit('canvas:show', {
                streamerId: streamerId,
                imageData: canvas.toDataURL() // Sendet das Bild als Base64-String
            });
        });

        hideCanvasBtn.addEventListener('click', () => {
            socket.emit('canvas:hide', { streamerId: streamerId });
        });
        
        liveDrawingToggle.addEventListener('change', (e) => {
            isLiveDrawing = e.target.checked;
            showCanvasBtn.disabled = isLiveDrawing;
            if (isLiveDrawing) {
                // Sende den aktuellen Stand, um zu starten
                socket.emit('live:start', { streamerId });
                socket.emit('canvas:show', {
                     streamerId: streamerId,
                     imageData: canvas.toDataURL()
                });
            } else {
                socket.emit('live:stop', { streamerId });
            }
        });
        
        clearCanvasBtn.addEventListener('click', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            saveHistory();
            if (isLiveDrawing) {
                 socket.emit('live:clear', { streamerId });
            }
        });

        undoBtn.addEventListener('click', undo);
        redoBtn.addEventListener('click', redo);
        updateUndoRedoButtons(); // Initialer Status
        
        // Medien-Upload
        uploadBtn.addEventListener('click', handleUpload);
    }
    
    // --- Medien-Verwaltung ---
    async function handleUpload() {
        const file = mediaFileInput.files[0];
        if (!file) {
            alert('Bitte eine Datei auswählen.');
            return;
        }

        const formData = new FormData();
        formData.append('mediaFile', file);

        uploadProgress.classList.remove('hidden');
        
        try {
             const response = await fetch(`/api/upload/${streamerId}`, {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if(result.success) {
                loadMediaList(); // Liste neu laden, um die neue Datei anzuzeigen
            } else {
                alert(`Upload fehlgeschlagen: ${result.message}`);
            }
        } catch (error) {
            console.error('Upload-Fehler:', error);
            alert('Ein Netzwerkfehler ist aufgetreten.');
        } finally {
             uploadProgress.classList.add('hidden');
             mediaFileInput.value = ''; // Input zurücksetzen
        }
    }

    async function loadMediaList() {
        try {
            const response = await fetch(`/api/media/${streamerId}`);
            const files = await response.json();
            
            mediaList.innerHTML = ''; // Liste leeren
            files.forEach(file => {
                const isVideo = file.endsWith('.mp4') || file.endsWith('.webm');
                
                const item = document.createElement('div');
                item.className = 'media-item';
                
                const previewSrc = `/${streamerId.toLowerCase()}/${file}`;
                
                item.innerHTML = `
                    ${isVideo ? `<video class="preview" src="/uploads/${streamerId}/${file}" muted></video>` : `<img class="preview" src="/uploads/${streamerId}/${file}">`}
                    <span class="filename">${file}</span>
                    <div class="actions">
                        <button class="show-btn">Einblenden</button>
                        <button class="hide-btn">Ausblenden</button>
                        <button class="delete-btn">Löschen</button>
                    </div>
                `;
                
                item.querySelector('.show-btn').addEventListener('click', () => {
                    socket.emit('media:show', {
                        streamerId: streamerId,
                        type: isVideo ? 'video' : 'image',
                        src: `/uploads/${streamerId}/${file}`
                    });
                });
                
                item.querySelector('.hide-btn').addEventListener('click', () => {
                     socket.emit('media:hide', { streamerId: streamerId });
                });
                
                item.querySelector('.delete-btn').addEventListener('click', () => deleteMedia(file));

                mediaList.appendChild(item);
            });
        } catch (error) {
            console.error('Fehler beim Laden der Medienliste:', error);
        }
    }
    
    async function deleteMedia(filename) {
        if (!confirm(`Soll die Datei "${filename}" wirklich gelöscht werden?`)) {
            return;
        }
        try {
            const response = await fetch(`/api/media/${streamerId}/${filename}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                loadMediaList(); // Liste aktualisieren
            } else {
                alert('Datei konnte nicht gelöscht werden.');
            }
        } catch (error) {
            console.error('Fehler beim Löschen:', error);
        }
    }


    // --- Hilfsfunktionen ---
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }


    // --- Anwendung starten ---
    initialize();
});