// app.js - Client-seitige Logik für die OBS Browser-Quelle
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    let streamerId = '';

    // UI-Elemente
    const canvas = document.getElementById('display-canvas');
    const ctx = canvas.getContext('2d');
    const mediaContainer = document.getElementById('media-container');
    const displayImage = document.getElementById('display-image');
    const displayVideo = document.getElementById('display-video');

    function initialize() {
        extractStreamerId();
        setupWebSocket();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }

    function extractStreamerId() {
        const pathParts = window.location.pathname.split('/');
        // Annahme: URL ist /StreamerName/overlay-display
        if (pathParts.length > 2) {
             streamerId = pathParts[1].toLowerCase();
        } else {
            console.error("Streamer-ID konnte nicht aus der URL extrahiert werden.");
        }
    }

    function setupWebSocket() {
        socket.on('connect', () => {
            console.log('Overlay verbunden. Trete Raum bei:', streamerId);
            socket.emit('joinRoom', streamerId);
        });

        // Alle Elemente ausblenden
        function hideAll() {
            canvas.classList.add('hidden');
            mediaContainer.classList.add('hidden');
            displayImage.classList.add('hidden');
            displayVideo.classList.add('hidden');
            displayVideo.pause();
            displayVideo.src = '';
        }

        // --- Canvas-Events ---
        socket.on('canvas:show', (data) => {
            hideAll();
            const image = new Image();
            image.onload = function() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(image, 0, 0);
            };
            image.src = data.imageData;
            canvas.classList.remove('hidden');
        });
        
        socket.on('canvas:hide', () => {
            canvas.classList.add('hidden');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        });

        // --- Live-Zeichnen-Events ---
        socket.on('live:start', () => {
            hideAll();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.classList.remove('hidden');
        });

        socket.on('live:stroke', (data) => {
            ctx.strokeStyle = data.color;
            ctx.lineWidth = data.size;
            
            if (data.tool === 'eraser') {
                ctx.clearRect(data.to.x - data.size/2, data.to.y - data.size/2, data.size, data.size);
            } else {
                 ctx.beginPath();
                 ctx.moveTo(data.from.x, data.from.y);
                 ctx.lineTo(data.to.x, data.to.y);
                 ctx.stroke();
            }
        });

        socket.on('live:stop', () => {
            // Nichts zu tun, bleibt einfach sichtbar
        });

        socket.on('live:clear', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        });

        // --- Medien-Events ---
        socket.on('media:show', (data) => {
            hideAll();
            mediaContainer.classList.remove('hidden');

            if (data.type === 'image') {
                displayImage.src = data.src;
                displayImage.classList.remove('hidden');
            } else if (data.type === 'video') {
                displayVideo.src = data.src;
                displayVideo.classList.remove('hidden');
                displayVideo.play().catch(e => console.error("Video Autoplay wurde blockiert:", e));
            }
        });

        socket.on('media:hide', () => {
            hideAll();
        });
    }

    initialize();
});