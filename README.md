# stream-overlay-system

Remote overlay control system for Twitch/YouTube streams. Provides a password-protected mod UI to draw, place text/shapes, and manage media uploads, plus a lightweight overlay display for OBS Browser Sources.

## Features
- Password-protected mod control UI per streamer
- Drawing tools: brush, text, rectangles, circles, eraser; edit mode
- Upload and manage images/videos
- Realtime updates via Socket.IO
- Simple OBS integration via Browser Source

## Setup
1. `npm install`
2. `npm start`

Server runs on `http://localhost:5004`.

## Configuration
- Set streamer IDs and passwords in `server.js` (the `PASSWORDS` object).
- Change the port in `server.js` (the `PORT` constant).

## Usage
- Mod UI: `http://localhost:5004/<streamerId>/modoverlay`
- Overlay display: `http://localhost:5004/<streamerId>/overlay-display`

In OBS, add a Browser Source pointing to the overlay display URL.

## API
- `POST /api/auth` (body: `streamerId`, `password`)
- `POST /api/upload/:streamerId` (multipart `mediaFile`)
- `GET /api/media/:streamerId`
- `DELETE /api/media/:streamerId/:filename`
