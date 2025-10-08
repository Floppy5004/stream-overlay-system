// app.js - TEXT-TOOL KOMPLETT FIX
document.addEventListener('DOMContentLoaded', () => {
    const socket = io({ autoConnect: false });
    let streamerId = '';
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const canvasWrapper = document.getElementById('canvas-wrapper');

    let currentAppMode = 'draw', currentTool = 'brush', currentColor = '#FF0000', currentBrushSize = 10;
    let isDrawing = false, startPos = { x: 0, y: 0 };
    const brushSizes = [2, 5, 10, 20, 40], textSizes = [24, 36, 48, 72, 96];

    function initialize() {
        const pathParts = window.location.pathname.split('/');
        streamerId = pathParts.length > 2 ? pathParts[1].toLowerCase() : '';
        if (streamerId) document.getElementById('streamer-name').textContent = pathParts[1];
        document.getElementById('password-submit').addEventListener('click', handleAuth);
        document.getElementById('password-input').addEventListener('keyup', (e) => e.key === 'Enter' && handleAuth());
    }

    async function handleAuth() {
        const password = document.getElementById('password-input').value;
        if (!password || !streamerId) return;
        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ streamerId, password })
            });
            if (response.ok) {
                document.getElementById('auth-wall').classList.add('hidden');
                document.getElementById('main-content').classList.remove('hidden');
                socket.connect();
                socket.emit('join', streamerId);
                setupApplication();
            } else {
                document.getElementById('auth-error').textContent = 'Falsches Passwort.';
            }
        } catch (error) {
            document.getElementById('auth-error').textContent = 'Ein Fehler ist aufgetreten.';
        }
    }

    function setupApplication() {
        socket.on('overlay_status', (data) => {
            document.getElementById('obs-status-light').classList.toggle('connected', data.connected);
        });
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        setupControlEvents(); loadMediaList(); setupDragAndDrop(); updateBrushPreview(); setAppMode('draw');
    }

    function setupControlEvents() {
        document.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', (e) => setAppMode(e.currentTarget.dataset.mode)));
        document.querySelectorAll('.tool').forEach(b => b.addEventListener('click', (e) => {
            document.querySelector('.tool.active').classList.remove('active');
            e.currentTarget.classList.add('active');
            currentTool = e.currentTarget.dataset.tool;
            document.getElementById('text-options').classList.toggle('hidden', currentTool !== 'text');
            updateBrushPreview();
        }));
        document.getElementById('color-picker').addEventListener('input', (e) => currentColor = e.target.value);
        document.getElementById('brush-size').addEventListener('input', updateBrushPreview);
        canvas.addEventListener('mousedown', startAction);
        canvas.addEventListener('mousemove', drawAction);
        canvas.addEventListener('mouseup', stopAction);
        canvas.addEventListener('mouseout', () => isDrawing = false);
        document.getElementById('show-canvas-btn').addEventListener('click', sendSceneData);
        document.getElementById('hide-canvas-btn').addEventListener('click', () => socket.emit('clear_scene'));
        document.getElementById('clear-canvas-btn').addEventListener('click', () => { ctx.clearRect(0, 0, canvas.width, canvas.height); canvasWrapper.querySelectorAll('.media-on-canvas').forEach(el => el.remove()); });
        document.getElementById('upload-btn').addEventListener('click', uploadMedia);
    }

    function updateBrushPreview() {
        const sliderVal = document.getElementById('brush-size').value - 1;
        currentBrushSize = (currentTool === 'text' ? textSizes : brushSizes)[sliderVal];
        document.getElementById('brush-preview').textContent = `${currentBrushSize}px`;
    }

    const getMousePos = (e) => ({ x: (e.clientX - canvas.getBoundingClientRect().left) / canvas.clientWidth * 1920, y: (e.clientY - canvas.getBoundingClientRect().top) / canvas.clientHeight * 1080 });

    function startAction(e) {
        if (currentAppMode !== 'draw') return;
        startPos = getMousePos(e);
        if (currentTool === 'text') {
            createTextInput(startPos.x, startPos.y);
            return;
        }
        isDrawing = true;
    }

    function drawAction(e) {
        if (!isDrawing || ['rect', 'circle', 'text'].includes(currentTool)) return;
        const currentPos = getMousePos(e);
        ctx.strokeStyle = currentColor; ctx.lineWidth = currentBrushSize;
        if (currentTool === 'brush') {
            ctx.beginPath(); ctx.moveTo(startPos.x, startPos.y); ctx.lineTo(currentPos.x, currentPos.y); ctx.stroke();
            startPos = currentPos;
        } else if (currentTool === 'eraser') {
            ctx.clearRect(currentPos.x - currentBrushSize / 2, currentPos.y - currentBrushSize / 2, currentBrushSize, currentBrushSize);
        }
    }

    function stopAction(e) {
        if (!isDrawing) return;
        isDrawing = false;
        const endPos = getMousePos(e);
        ctx.strokeStyle = currentColor; ctx.lineWidth = currentBrushSize;
        if (currentTool === 'rect') {
            ctx.strokeRect(startPos.x, startPos.y, endPos.x - startPos.x, endPos.y - startPos.y);
        } else if (currentTool === 'circle') {
            const radius = Math.sqrt(Math.pow(endPos.x - startPos.x, 2) + Math.pow(endPos.y - startPos.y, 2));
            ctx.beginPath(); ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI); ctx.stroke();
        }
    }

    function createTextInput(x, y) {
        const existingInput = document.getElementById('text-input-overlay');
        if (existingInput && existingInput.parentNode) existingInput.remove();

        const input = document.createElement('textarea');
        input.id = 'text-input-overlay';
        input.placeholder = 'Text eingeben (STRG+Enter = Fertig, ESC = Abbrechen)';
        const rect = canvasWrapper.getBoundingClientRect();
        const leftPos = (x / 1920) * rect.width;
        const topPos = (y / 1080) * rect.height;

        Object.assign(input.style, {
            position: 'absolute',
            left: `${leftPos}px`,
            top: `${topPos}px`,
            width: '300px',
            minHeight: '50px',
            background: 'rgba(20,20,40,0.95)',
            color: currentColor,
            border: '3px solid #00FFFF',
            borderRadius: '4px',
            padding: '8px',
            fontSize: '18px',
            fontFamily: document.getElementById('font-family').value,
            resize: 'both',
            zIndex: '1000',
            outline: 'none'
        });

        canvasWrapper.appendChild(input);
        setTimeout(() => input.focus(), 50);

        const finishText = () => {
            const text = input.value.trim();
            if (text) {
                ctx.font = `${currentBrushSize}px ${input.style.fontFamily}`;
                ctx.fillStyle = currentColor;
                ctx.textBaseline = 'top';
                const lines = text.split('\n');
                lines.forEach((line, i) => {
                    ctx.fillText(line, x, y + (i * currentBrushSize * 1.2));
                });
            }
            if (input.parentNode) input.remove();
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (input.parentNode) input.remove();
            } else if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                finishText();
            }
        });

        setTimeout(() => {
            input.addEventListener('blur', finishText);
        }, 200);
    }

    function sendSceneData() {
        const media = Array.from(document.querySelectorAll('.media-on-canvas')).map(el => ({
            src: el.dataset.src,
            isVideo: el.dataset.isVideo === 'true',
            x: el.offsetLeft,
            y: el.offsetTop,
            width: el.offsetWidth,
            height: el.offsetHeight
        }));
        const sceneData = {
            canvasImage: canvas.toDataURL(),
            media,
            wrapperWidth: canvasWrapper.clientWidth,
            wrapperHeight: canvasWrapper.clientHeight
        };
        socket.emit('update_scene', sceneData);
        const btn = document.getElementById('show-canvas-btn');
        btn.textContent = '✓ Gesendet!';
        setTimeout(() => btn.textContent = '📤 Einblenden', 1500);
    }

    function setAppMode(mode) {
        currentAppMode = mode;
        canvas.style.pointerEvents = mode === 'draw' ? 'auto' : 'none';
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.mode-btn[data-mode="${mode}"]`).classList.add('active');
    }

    async function loadMediaList() {
        const response = await fetch(`/api/media/${streamerId}`);
        const files = await response.json();
        const mediaList = document.getElementById('media-list');
        mediaList.innerHTML = '';
        files.forEach(file => {
            const isVideo = file.endsWith('.mp4') || file.endsWith('.webm');
            const src = `/uploads/${streamerId}/${file}`;
            const item = document.createElement('div');
            item.className = 'media-item';
            item.innerHTML = `<img class="preview" src="${isVideo ? 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolygon%20points%3D%225%203%2019%2012%205%2021%205%203%22%3E%3C%2Fpolygon%3E%3C%2Fsvg%3E' : src}" draggable="true"><span class="filename">${file}</span><button class="delete-btn">Löschen</button>`;
            item.querySelector('.preview').addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', JSON.stringify({ src, isVideo })));
            item.querySelector('.delete-btn').addEventListener('click', async () => {
                if (confirm(`"${file}" löschen?`)) {
                    await fetch(`/api/media/${streamerId}/${file}`, { method: 'DELETE' });
                    loadMediaList();
                }
            });
            mediaList.appendChild(item);
        });
    }

    function setupDragAndDrop() {
        canvasWrapper.addEventListener('dragover', (e) => e.preventDefault());
        canvasWrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const rect = canvasWrapper.getBoundingClientRect();
            addMediaToCanvas(data.src, data.isVideo, e.clientX - rect.left, e.clientY - rect.top);
            setAppMode('edit');
        });
    }

    function addMediaToCanvas(src, isVideo, x, y) {
        const mediaWrapper = document.createElement('div');
        mediaWrapper.className = 'media-on-canvas';
        mediaWrapper.dataset.src = src;
        mediaWrapper.dataset.isVideo = isVideo;
        const mediaElement = isVideo ? document.createElement('video') : document.createElement('img');
        mediaElement.src = src;
        if (isVideo) Object.assign(mediaElement, { autoplay: true, loop: true, muted: false });
        mediaElement.onload = mediaElement.onloadedmetadata = () => {
            const aspectRatio = (mediaElement.videoWidth || mediaElement.naturalWidth) / (mediaElement.videoHeight || mediaElement.naturalHeight);
            const defaultWidth = 320;
            Object.assign(mediaWrapper.style, {
                width: `${defaultWidth}px`,
                height: `${defaultWidth / aspectRatio}px`,
                left: `${x - defaultWidth / 2}px`,
                top: `${y - (defaultWidth / aspectRatio) / 2}px`
            });
        };
        makeInteractive(mediaWrapper, mediaElement);
        canvasWrapper.appendChild(mediaWrapper);
    }

    function makeInteractive(wrapper, media) {
        const controls = document.createElement('div');
        controls.className = 'element-controls';
        const deleteHandle = document.createElement('div');
        deleteHandle.className = 'delete-handle';
        deleteHandle.textContent = 'X';
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        controls.appendChild(deleteHandle);
        controls.appendChild(resizeHandle);
        if (media.tagName === 'VIDEO') {
            const playPauseBtn = document.createElement('button');
            playPauseBtn.className = 'play-pause-btn';
            playPauseBtn.textContent = '❚❚';
            playPauseBtn.onclick = (e) => {
                e.stopPropagation();
                if (media.paused) {
                    media.play();
                    playPauseBtn.textContent = '❚❚';
                } else {
                    media.pause();
                    playPauseBtn.textContent = '►';
                }
            };
            controls.appendChild(playPauseBtn);
        }
        wrapper.appendChild(media);
        wrapper.appendChild(controls);
        deleteHandle.onclick = (e) => {
            e.stopPropagation();
            if (media.tagName === 'VIDEO') media.pause();
            wrapper.remove();
        };
        wrapper.addEventListener('mousedown', (e) => {
            if (currentAppMode !== 'edit' || e.target.closest('.element-controls *')) return;
            e.preventDefault();
            let pos3 = e.clientX,
                pos4 = e.clientY;
            document.onmousemove = (ev) => {
                let pos1 = pos3 - ev.clientX,
                    pos2 = pos4 - ev.clientY;
                pos3 = ev.clientX;
                pos4 = ev.clientY;
                wrapper.style.top = `${wrapper.offsetTop - pos2}px`;
                wrapper.style.left = `${wrapper.offsetLeft - pos1}px`;
            };
            document.onmouseup = () => {
                document.onmousemove = null;
                document.onmouseup = null;
            };
        });
        resizeHandle.addEventListener('mousedown', (e) => {
            if (currentAppMode !== 'edit') return;
            e.preventDefault();
            e.stopPropagation();
            let startX = e.clientX,
                startWidth = wrapper.offsetWidth,
                startHeight = wrapper.offsetHeight;
            document.onmousemove = (ev) => {
                const newWidth = startWidth + ev.clientX - startX;
                wrapper.style.width = `${newWidth}px`;
                wrapper.style.height = `${newWidth / (startWidth / startHeight)}px`;
            };
            document.onmouseup = () => {
                document.onmousemove = null;
                document.onmouseup = null;
            };
        });
    }

    async function uploadMedia() {
        const file = document.getElementById('media-file-input').files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('mediaFile', file);
        await fetch(`/api/upload/${streamerId}`, { method: 'POST', body: formData });
        loadMediaList();
    }

    initialize();
});
