# Stream Overlay System

Ein vollständiges Stream-Overlay-System für Twitch/YouTube mit OBS-Integration.

## Features

- ✅ Zeichnen auf einer Leinwand (Pinsel, Radierer, Rechteck, Kreis)
- ✅ Text-Tool mit verschiedenen Schriftarten und Größen
- ✅ Bild- und Video-Upload mit Drag & Drop
- ✅ Live-Übertragung zur OBS Browser-Quelle
- ✅ Socket.io für Echtzeit-Kommunikation
- ✅ Multi-Streamer Support (jeder Streamer hat eigenen Workspace)
- ✅ Passwortschutz pro Streamer
- ✅ HTTPS mit Let's Encrypt SSL
- ✅ Nginx Reverse Proxy
- ✅ Systemd Service für Autostart

## Automatische Installation (Hetzner Cloud)

### Voraussetzungen
- Hetzner Cloud Account
- Domain mit DNS-Zugriff
- A-Record für deine Domain zeigt auf Server-IP

### Installation

1. **DNS konfigurieren:**
   - Erstelle A-Record: overlay.deinedomain.de → DEINE-SERVER-IP
   - Warte 5-10 Minuten bis DNS propagiert ist

2. **Server erstellen:**
   - Gehe zu Hetzner Cloud Console
   - Server hinzufügen
   - Image: Ubuntu 24.04
   - Server-Typ: CX22 oder besser (2 vCPU, 4GB RAM)
   - Cloud-init: Kopiere den Inhalt von cloud-init.yml
   - WICHTIG: Ersetze DEINE_DOMAIN, DEINE_EMAIL, STREAMER_NAME, STREAMER_PASSWORD
   - Server erstellen

3. **Warten (ca. 5-10 Minuten):**
   - Das Setup läuft automatisch
   - Fortschritt via SSH: tail -f /var/log/cloud-init-output.log

4. **Testen:**
   - Mod-Interface: https://overlay.deinedomain.de/STREAMER_NAME/Modoverlay
   - OBS Browser-Quelle: https://overlay.deinedomain.de/STREAMER_NAME/overlay-display

## OBS Einrichtung

Browser-Quelle hinzufügen:
- URL: https://overlay.deinedomain.de/STREAMER_NAME/overlay-display
- Breite: 1920, Höhe: 1080

## Weitere Streamer hinzufügen

Bearbeite /opt/stream-overlay/data/passwords.json und erstelle Upload-Ordner.

## Technologie

- Backend: Node.js + Express + Socket.io
- Frontend: Vanilla JavaScript + Canvas API
- Proxy: Nginx mit SSL (Let's Encrypt)
- Process Manager: Systemd

## Lizenz

MIT
