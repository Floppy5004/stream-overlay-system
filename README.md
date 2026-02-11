# stream-overlay-system

Remote-Overlay-Steuerungssystem fuer Twitch/YouTube-Streams. Es bietet eine passwortgeschuetzte Mod-UI zum Zeichnen, Platzieren von Text/Formen und Verwalten von Medien-Uploads sowie eine schlanke Overlay-Anzeige fuer OBS-Browser-Quellen.

## Vorschau
![Screenshot Mod-UI](./assets/preview.png)
![Screenshot Overlay-Anzeige](./assets/preview-overlay.png)
![Kurzer Ablauf (GIF)](./assets/preview.gif)

## Funktionen
- Passwortgeschuetzte Mod-UI pro Streamer
- Zeichenwerkzeuge: Pinsel, Text, Rechtecke, Kreise, Radierer; inkl. Bearbeitungsmodus
- Upload und Verwaltung von Bildern/Videos
- Echtzeit-Updates ueber Socket.IO
- Einfache OBS-Integration per Browser Source

## Einrichtung
1. `npm install`
2. `npm start`

Der Server laeuft auf `http://localhost:5004`.

## Konfiguration
- Streamer-IDs und Passwoerter in `server.js` setzen (Objekt `DEFAULT_PASSWORDS`) oder ueber `PASSWORDS_JSON`.
- Port ueber `PORT` aendern (Standard: `5004`).
- Hinter Reverse Proxy (Nginx): `TRUST_PROXY=1` setzen.

Beispiel fuer Umgebungsvariablen:
`PORT=3000 PASSWORDS_JSON='{"derstrese":"2627"}' TRUST_PROXY=1 node server.js`

## Bereitstellung (Hetzner)
Dieses Repo enthaelt eine sofort nutzbare `cloud-init.yaml`, die Node.js, Nginx und PM2 installiert und TLS konfiguriert.

1. In `cloud-init.yaml` anpassen: `DOMAIN`, `EMAIL`, `STREAMER_ID`, `PASSWORDS_JSON` und optional den GitHub-User in `ssh_import_id`.
2. Hetzner-Cloud-Server (Ubuntu 24.04) erstellen und den Inhalt in cloud-init einfuegen.
3. DNS-A-Record fuer `DOMAIN` auf die Server-IP zeigen lassen.
4. Nach dem Boot Mod-UI oeffnen: `https://DOMAIN/<streamerId>/modoverlay`.
5. In OBS die Overlay-URL nutzen: `https://DOMAIN/<streamerId>/overlay-display`.

Betrieb:
- Update: `cd ~/stream-overlay-system && git pull && pm2 restart stream-overlay`
- Logs: `pm2 logs stream-overlay`

## Healthcheck und Ueberwachung
- Health-Endpunkt: `GET /health` liefert JSON mit Status, Uptime und Timestamp.
- Lokaler Check: `curl -fsS http://127.0.0.1:3000/health`
- Cloud-init installiert den systemd-Timer `overlay-healthcheck.timer`, der den Endpunkt prueft und die App bei Fehlern ueber PM2 neu startet.
- Status: `systemctl status overlay-healthcheck.timer`
- Logs: `journalctl -u overlay-healthcheck.service -n 100 --no-pager`

## Nutzung
- Mod-UI: `http://localhost:5004/<streamerId>/modoverlay`
- Overlay-Anzeige: `http://localhost:5004/<streamerId>/overlay-display`

In OBS eine Browser Source mit der Overlay-Anzeige-URL anlegen.

## Schnittstellen
- `POST /api/auth` (Body: `streamerId`, `password`)
- `POST /api/upload/:streamerId` (multipart `mediaFile`)
- `GET /api/media/:streamerId`
- `DELETE /api/media/:streamerId/:filename`


