console.log('OVERLAY.JS STARTET');
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM GELADEN');
    const socket = io();
    const container = document.getElementById('scene-container');
    const pathParts = window.location.pathname.split('/');
    const streamerId = pathParts[1].toLowerCase();
    
    console.log('StreamerID:', streamerId);
    console.log('Joining room:', streamerId);
    
    socket.emit('join', streamerId);
    
    socket.on('connect', () => {
        console.log('SOCKET VERBUNDEN!');
        socket.emit('overlay_ready');
    });
    
    socket.on('render_scene', (data) => {
        console.log('EMPFANGE SZENE:', data);
        container.innerHTML = '';
        const canvasImage = document.createElement('img');
        canvasImage.src = data.canvasImage;
        canvasImage.style.position = 'absolute';
        canvasImage.style.width = '1920px';
        canvasImage.style.height = '1080px';
        container.appendChild(canvasImage);

        if (data.media) {
            data.media.forEach(item => {
                const element = item.isVideo ? document.createElement('video') : document.createElement('img');
                element.src = item.src;
                if (item.isVideo) {
                    element.autoplay = true;
                    element.loop = true;
                    element.muted = false;
                    element.playsInline = true;
                    if (item.volume !== undefined) {
                        element.volume = item.volume;
                    }
                }
                const scaleX = 1920 / data.wrapperWidth;
                const scaleY = 1080 / data.wrapperHeight;
                element.style.position = 'absolute';
                element.style.left = (item.x * scaleX) + 'px';
                element.style.top = (item.y * scaleY) + 'px';
                element.style.width = (item.width * scaleX) + 'px';
                element.style.height = (item.height * scaleY) + 'px';
                container.appendChild(element);
            });
        }
    });

    socket.on('clear_scene', () => {
        console.log('LÖSCHE SZENE');
        container.innerHTML = '';
    });
});
