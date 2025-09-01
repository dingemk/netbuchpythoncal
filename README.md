# Calliope 2 MicroPython IDE

Eine vollständige Web-basierte IDE für den Calliope 2, die MicroPython-Code direkt in HEX-Dateien einbettet.

## Features

- **Code-Editor**: Monaco Editor mit Syntax-Highlighting
- **HEX-Generator**: Betten von MicroPython-Code in Firmware-Dateien
- **Serielle Verbindung**: Direkte Code-Übertragung über Web Serial API
- **Turtle-Grafik**: Visuelle Ausgabe für Python-Programme
- **Pyodide**: Python-Ausführung im Browser

## Installation

1. Repository klonen:
```bash
git clone https://github.com/dingemk/calliopepython.git
cd calliopepython
```

2. Lokalen Server starten:
```bash
python3 -m http.server 8000
```

3. Im Browser öffnen: `http://localhost:8000`

## Verwendung

1. **Code eingeben** im Editor
2. **HEX-Datei erstellen** mit "⬇️ main.hex herunterladen"
3. **Auf Calliope 2 hochladen** oder **seriell übertragen**

## Dateien

- `index.html` - Haupt-IDE
- `calliope.hex.js` - HEX-Code-Generator
- `calliope.serial.js` - Serielle Verbindung
- `styles.css` - Styling
- `scripts.js` - Zusätzliche Funktionen

## Lizenz

Open Source - frei verwendbar
