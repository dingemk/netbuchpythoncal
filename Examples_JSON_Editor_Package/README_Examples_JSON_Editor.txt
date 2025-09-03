Examples JSON Editor (Tkinter)
==============================
Dateien in diesem ZIP:
- examples_json_editor_v2.py   -> Der Editor (Python 3, Tkinter)
- examples.json                -> Beispiel-Datei
- README_Examples_JSON_Editor.txt

Start:
    python3 examples_json_editor_v2.py

Hinweis (macOS):
- Wenn beim Öffnen per Doppelklick nichts passiert, starte den Editor aus dem Terminal.
- Für Tkinter muss Python mit Tk-Unterstützung installiert sein (bei Homebrew-Python: `brew install python-tk@3.x`).

JSON-Format (Beispiel):
{
  "examples": [
    { "file": "python/math/fibonacci.py", "name": "Fibonacci", "image": "assets/fib.png", "runtime": "python" },
    { "file": "micropython/led_blink.py", "name": "LED Blink", "runtime": "micropython" }
  ]
}
