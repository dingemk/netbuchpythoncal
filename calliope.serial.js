// ================== Calliope Serial API ==================
// Vollständige Datei: calliope.serial.js
// - Robustes Open/Close
// - Einzeilige Execs (ohne Paste) für Diagnose
// - Paste-Mode zeilenweise (CRLF) mit Delay für große Blöcke
// - Upload speichert nach /flash und root, führt sichtbar aus (exec)
// - Kompatibel mit MicroPython v1.9.2 (kein importlib benötigt)
// - Auto-Reconnect nach Firmware-Reset (HEX-Flash), via expectReset(timeoutMs)

(function () {
  const S = {
    port: null, reader: null, writer: null, dec: null, enc: null, outEl: null, _pipes: null,
    expectResetUntil: 0, reconnectInProgress: false,
    lastInfo: null,     // << neu: { usbVendorId, usbProductId }
    lineBuf: "", listeners: new Set(),
  };

  // ---- Utils ----
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const CTRL = { C: "\x03", D: "\x04", E: "\x05", B: "\x02" }; // C=Stop, D=EOF, E=Paste, B=Friendly


  // Gebündeltes Logging (keine Buchstabenflut)
  let __buf = "", __t = null;
  function uiLog(chunk) {
    __buf += String(chunk).replace(/\r/g, "");
    if (__t) return;
    __t = setTimeout(() => {
      const s = __buf; __buf = ""; __t = null;
      if (!S.outEl) return console.log("[serial]", s);
      S.outEl.innerHTML += s.replace(/\n/g, "<br>");
      S.outEl.scrollTop = S.outEl.scrollHeight;
    }, 25);
  }

  // --- Reset-/Reconnect-Logik ---
function expectReset(timeoutMs = 20000) { // 20s Fenster
  S.expectResetUntil = Date.now() + Math.max(0, timeoutMs|0);
}

  // Versuch, nach einem erwarteten Reset automatisch wieder zu verbinden.
// Voraussetzungen:
// - S.expectResetUntil: Zeitstempel (ms) bis wann ein Reset erwartet wird
// - S.lastInfo: { usbVendorId, usbProductId } des zuletzt verbundenen Ports
// - _openGivenPort(port): öffnet den Port + baut Streams/Reader/Writer auf
async function tryAutoReconnect() {
  if (S.reconnectInProgress) return;
  S.reconnectInProgress = true;

  const deadline = Date.now() + 20000; // bis zu 20s versuchen
  while (Date.now() < deadline && Date.now() < S.expectResetUntil) {
    try {
      const ports = await navigator.serial.getPorts();

      // Bevorzugt exakt denselben Port (VID/PID) wie zuvor
      const match = ports.find(p => {
        try {
          const i = p.getInfo?.();
          return S.lastInfo && i &&
                 i.usbVendorId  === S.lastInfo.usbVendorId &&
                 i.usbProductId === S.lastInfo.usbProductId;
        } catch { return false; }
      }) || ports[0]; // Fallback: nimm den ersten bekannten Port

      if (match) {
        await _openGivenPort(match);
        uiLog("🔁 Wieder verbunden.");
        S.reconnectInProgress = false;
        return;
      }
    } catch {
      // ignorieren und weiterprobieren
    }
    await sleep(600); // kurze Pause vor dem nächsten Versuch
  }

  uiLog("⌛️ Automatisches Reconnect nicht gelungen. Bitte „Verbinden“ klicken.");
  S.reconnectInProgress = false;
}

async function _openGivenPort(port) {
  await port.open({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: "none", flowControl: "none" });

  S.dec = new TextDecoderStream();
  S.enc = new TextEncoderStream();

  const pipeIn  = port.readable.pipeTo(S.dec.writable).catch(()=>{});
  const pipeOut = S.enc.readable.pipeTo(port.writable).catch(()=>{});
  S._pipes = [pipeIn, pipeOut];

  S.writer = S.enc.writable.getWriter();
  S.port   = port;

  // Merke VID/PID für's Matching
  S.lastInfo = (typeof port.getInfo === "function") ? port.getInfo() : null;

  await _startReadLoop();
  await S.writer.write("\x03\x03\r\n"); // Prompt „anstupsen“
}

  // ---- Read-Loop ----
  async function _startReadLoop() {
    try { await S.reader?.cancel(); } catch { }
    try { S.reader?.releaseLock?.(); } catch { }
    S.reader = S.dec.readable.getReader();
    (async () => {
      try {
        while (true) {
          const { value, done } = await S.reader.read();
          if (done) break;
          if (value) {
            uiLog(value);               // in UI
            S.lineBuf += value;         // zum Zeilen-Dispatch sammeln
            let idx;
            while ((idx = S.lineBuf.indexOf('\n')) >= 0) {
              const line = S.lineBuf.slice(0, idx).replace(/\r$/, '');
              S.lineBuf = S.lineBuf.slice(idx + 1);
              for (const fn of S.listeners) {
                try { fn(line); } catch { }
              }
            }
          }
        }
      } catch (e) {
        // ignore
      }
    })();
  }

  // ---- Open / Close ----
  async function openSerial() {
    if (!("serial" in navigator)) {
      alert("Web Serial wird hier nicht unterstützt. Nutze Chrome/Edge über HTTPS oder http://localhost.");
      return;
    }
    if (S.port && S.writer) {
      uiLog("✅ Port bereits offen");
      return;
    }

    try {
      // Schon freigegebene Ports (kein Picker)
      let port = null;
      try {
        const granted = await navigator.serial.getPorts();
        if (granted && granted.length) port = granted[0];
      } catch (e) {
        console.warn("getPorts() schlug fehl:", e);
      }

      if (!port) {
        // Muss aus einem Click-Handler aufgerufen werden (User-Gesture!)
        port = await navigator.serial.requestPort(/* { filters:[{ usbVendorId: 0x0D28 }] } */);
      }

      await port.open({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: "none", flowControl: "none" });

      // Streams
      S.dec = new TextDecoderStream();
      S.enc = new TextEncoderStream();
      const pipeIn = port.readable.pipeTo(S.dec.writable).catch(() => { });
      const pipeOut = S.enc.readable.pipeTo(port.writable).catch(() => { });
      S._pipes = [pipeIn, pipeOut];

      S.writer = S.enc.writable.getWriter();
      S.port = port;

      // Disconnect-Events beobachten (z.B. Kabel ziehen / Reset nach Flash)
      navigator.serial.addEventListener?.("disconnect", (e) => {
        if (S.port && e?.target !== S.port) return; // anderes Gerät
        const wasExpected = Date.now() < S.expectResetUntil;
        if (wasExpected) {
          uiLog("\n⚡️ Gerät startet neu (HEX geflasht) …");
        } else {
          uiLog("\n🔌 Gerät getrennt.");
        }
        // sauber schließen
        closeSerial().catch(() => { });
        // Bei erwartetem Reset: automatisch wieder verbinden
        if (wasExpected) {
          tryAutoReconnect();
        }
      });

      await _startReadLoop();
      uiLog("✅ Serielle Verbindung geöffnet (115200). Drücke ggf. Reset für REPL-Banner.");

      if (expectReset) {
        // warte nach Reset und versuche erneut zu verbinden
        setTimeout(() => {
          if (!S.writer) {
            uiLog("↻ Versuche nach Reset erneut zu verbinden …");
            openSerial(false).catch(err => uiLog("❌ Reconnect fehlgeschlagen: " + err));
          }
        }, 6000); // 6s warten nach Flash
      }
    }
    catch (e) {
      uiLog("❌ Port konnte nicht geöffnet werden: " + (e?.message || e));
      throw e;
    }
  }

  async function closeSerial() {
    try { await S.reader?.cancel(); } catch { }
    try { S.reader?.releaseLock?.(); } catch { }
    try { await S.writer?.close(); } catch { }
    try { S.writer?.releaseLock?.(); } catch { }
    if (S._pipes) {
      for (const p of S._pipes) { try { await p; } catch { } }
    }
    try { await S.port?.close(); } catch { }
    S.port = S.reader = S.writer = null;
    S.dec = S.enc = null;
    S._pipes = null;
    uiLog("🔌 Serielle Verbindung geschlossen.");
  }

  // ---- Einzeilige Execs (ohne Paste) für REPL-sichere Befehle ----
  async function sendLine(s, delay = 30) {
    if (!S.writer) throw new Error("Serial nicht offen. Erst verbinden.");
    await S.writer.write(String(s) + "\r\n");
    await sleep(delay);
  }
  async function execLines(lines, delay = 30) {
    for (const ln of lines) await sendLine(ln, delay);
  }

  // ---- Paste-Mode (zeilenweise, CRLF, kleine Delays) für große Blöcke ----
  async function pasteExec(code) {
    if (!S.writer) throw new Error("Serial nicht offen. Erst verbinden.");

    // In den freundlichen REPL & Paste-Mode
    await S.writer.write(CTRL.C + CTRL.C);
    await sleep(40);
    await S.writer.write(CTRL.B);
    await sleep(40);
    await S.writer.write(CTRL.E);
    await sleep(40);

    const lines = String(code)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n");

    for (const line of lines) {
      await S.writer.write(line + "\r\n"); // CRLF pro Zeile
      await sleep(10); // MicroPython (nRF51) ist langsam
    }
    await S.writer.write(CTRL.D); // finish paste
    await sleep(40);
  }

  // ---- Diagnose-Helfer ----
  async function listFiles() {
    await execLines([
      `import os`,
      `print("FILES_ROOT:", os.listdir())`,
      `try: print("FILES_FLASH:", os.listdir("/flash"))`,
      `except Exception as e: print("FILES_FLASH_ERR:", e)`,
    ]);
  }

  async function showMainPy() {
    await execLines([
      `print("--- main.py head ---")`,
      `try: print(open("/flash/main.py","r").read()[:400])`,
      `except Exception as e1: print("FLASH_READ_ERR:", e1)`,
      `try: print(open("main.py","r").read()[:400])`,
      `except Exception as e2: print("ROOT_READ_ERR:", e2)`,
      `print("--- end ---")`,
    ]);
  }

  // MicroPython 1.9.2 hat kein importlib → exec(...) nutzen (als Paste-Block!)
  async function runMainModule() {
    const py = [
      "try:",
      "    exec(open('/flash/main.py').read(), globals())",
      "except Exception as e1:",
      "    try:",
      "        exec(open('main.py').read(), globals())",
      "    except Exception as e2:",
      "        print('RUN_ERR:', e1, e2)"
    ].join("\n");
    await pasteExec(py);
  }

  async function rebootSoft() {
    await execLines([`import machine`, `machine.soft_reset()`], 40);
  }

  // ---- Upload ----
  async function uploadMainPyViaSerialFromEditor() {
    try {
      const code = (window.editor?.getValue?.() || "").toString();
      if (!code) {
        uiLog("⚠️ Kein Code im Editor.");
        return;
      }
      await uploadMainPyViaSerial(code);
    } catch (e) {
      uiLog("❌ Upload (Editor) fehlgeschlagen: " + (e?.message || e));
    }
  }

  async function uploadMainPyViaSerial(code) {
    try {
      if (!S.writer) await openSerial();

      // Code vorbereiten (BOM raus, ''' escapen, Newline am Ende)
      const safe = (s) => String(s).replace(/^\uFEFF/, "").replace(/'''/g, "''\\'");
      const body = safe(code) + (/\n$/.test(code) ? "" : "\n");

      // Schreiben an /flash und root
      uiLog("⎘ (Paste) Schreibe main.py …");
      await execLines([
        `import os`,
        `_c = r'''${body}'''`,
        `wrote=False`,
        `try: open('/flash/main.py','w').write(_c); print('WROTE:/flash/main.py'); wrote=True`,
        `except Exception as e: print('WRITE_FLASH_ERR:', e)`,
        `try: open('main.py','w').write(_c); print('WROTE:root main.py')`,
        `except Exception as e: print('WRITE_ROOT_ERR:', e)`,
        `try: os.sync()`,
        `except: pass`,
      ]);

      // Sichtbar ausführen (Fehler werden angezeigt)
      uiLog("▶️ Starte main.py sichtbar …");
      await runMainModule();
      uiLog("✅ main.py gespeichert & ausgeführt. Für Autostart ggf. Reset drücken.");
    } catch (e) {
      uiLog("❌ Upload fehlgeschlagen: " + (e?.message || e));
      throw e;
    }
  }

  // Öffnet den zuerst bereits freigegebenen Port (ohne requestPort / ohne Dialog).
// Rückgabewert: true = geöffnet, false = kein freigegebener Port gefunden
async function tryOpenGranted() {
  if (!('serial' in navigator)) return false;
  try {
    const ports = await navigator.serial.getPorts();
    if (ports && ports.length) {
      await _openGivenPort(ports[0]); // nutzt deine vorhandene Helper-Funktion
      uiLog("🔁 Wieder verbunden (granted port).");
      return true;
    }
  } catch (e) { /* ignorieren, später erneut versuchen */ }
  return false;
}

  // ---- Public API ----
  window.CalliopeSerial = {
    init({ editor, outEl }) {
      S.editor = editor;
      S.outEl = outEl;
      uiLog("ℹ️ CalliopeSerial bereit.");
    },
    openSerial,
    closeSerial,
    // Diagnose & Tools
    sendLine,
    execLines,
    pasteExec,
    listFiles,
    showMainPy,
    runMainModule,
    rebootSoft,
    // Upload
    uploadMainPyViaSerialFromEditor,
    uploadMainPyViaSerial,
    // Reset/Auto-Reconnect
    expectReset,
    // Zeilen-Events (optional)
    onData(fn) { S.listeners.add(fn); },
    offData(fn) { S.listeners.delete(fn); },
    tryOpenGranted
  };
})();