// ================== calliope.serial.js (vollständig, robust, editor-kompatibel) ==================
(function () {
  // --------- State ---------
  const S = window.__CalliopeSerialState ||= {
    port: null,
    reader: null,
    writer: null,
    enc: null,
    dec: null,
    readPipe: null,       // Promise von pipeTo, damit wir sie sauber beenden können
    listeners: new Set(),
    lineBuf: "",
    outEl: null,
    editor: null,
    lastInfo: null,       // { usbVendorId, usbProductId }
    opening: false,       // schützt vor parallelen open()-Aufrufen
    closingPromise: null, // garantiertes Close vor neuem Open
    expectResetUntil: 0,  // Zeitfenster für Auto-Reconnect nach Flash
  };

  // --------- Utils ---------
  const sleep = (ms)=>new Promise(r=>setTimeout(r, ms));
  function uiLog(s) {
    const el = S.outEl || document.getElementById('output');
    if (el) { el.innerHTML += String(s).replace(/\r/g,'').replace(/\n/g,'<br>') + '<br>'; el.scrollTop = el.scrollHeight; }
    else { console.log('[serial]', s); }
  }

  // --------- Garantiert alles schließen ---------
  async function ensureClosed() {
    // Falls ein Close gerade läuft: darauf warten
    if (S.closingPromise) {
      try { await S.closingPromise; } catch {}
    }
    // Nichts offen? fertig
    if (!S.port && !S.reader && !S.writer && !S.readPipe) return;

    S.closingPromise = (async () => {
      // 1) Reader stoppen
      try { await S.reader?.cancel(); } catch {}
      try { S.reader?.releaseLock?.(); } catch {}
      S.reader = null;

      // 2) pipeTo-Verbindung sauber beenden
      try { await S.readPipe; } catch {}
      S.readPipe = null;

      // 3) Writer schließen + Lock freigeben
      try { await S.writer?.close?.(); } catch {}
      try { S.writer?.releaseLock?.(); } catch {}
      S.writer = null;

      // 4) Port schließen
      try { await S.port?.close?.(); } catch {}
      S.port = null;

      // 5) kleine Pause, damit OS/CDC fertig aufräumt
      await sleep(120);
    })();

    try { await S.closingPromise; } catch {}
    S.closingPromise = null;
  }

  // --------- Read-Loop ---------
  async function startReadLoop() {
    try { await S.reader?.cancel(); } catch {}
    try { S.reader?.releaseLock?.(); } catch {}
    S.reader = S.dec.readable.getReader();
    (async () => {
      try {
        while (true) {
          const { value, done } = await S.reader.read();
          if (done) break;
          if (value) {
            const text = value; // TextDecoderStream liefert Strings
            for (let i = 0; i < text.length; i++) {
              const ch = text[i];
              if (ch === '\n') {
                const line = S.lineBuf; S.lineBuf = "";
                for (const fn of S.listeners) { try { fn(line); } catch {} }
                uiLog(line);
              } else if (ch !== '\r') {
                S.lineBuf += ch;
              }
            }
          }
        }
      } catch {
        // ok (cancel/close)
      }
    })();
  }

  // --------- Low-level Öffnen (ein Versuch) ---------
  async function openOnce(port) {
    // Vorher wirklich alles schließen
    await ensureClosed();

    // Manche Stacks brauchen eine Winzigkeit nach close()
    await sleep(50);

    // Port öffnen
    await port.open({ baudRate: 115200 });

    // Streams/Writer einrichten
    S.enc = new TextEncoder();
    S.dec = new TextDecoderStream();
    S.readPipe = port.readable.pipeTo(S.dec.writable).catch(()=>{});
    S.writer = port.writable.getWriter();

    // REPL anstupsen (sanfter für Calliope 1/2)
    await sleep(200); // Längere Pause nach Port-Öffnung
    await S.writer.write(S.enc.encode('\x03')); // Ein Ctrl+C
    await sleep(100);
    await S.writer.write(S.enc.encode('\r\n')); // Enter
    await sleep(100);

    S.port = port;
    try {
      const info = port.getInfo?.() || {};
      S.lastInfo = { usbVendorId: info.usbVendorId, usbProductId: info.usbProductId };
    } catch {}
    await startReadLoop();
  }

  // --------- Public API ---------
  function init({ editor, outEl } = {}) {
    S.editor = editor || null;
    S.outEl  = outEl  || null;
  }

 async function openSerial() {
  if (!('serial' in navigator)) {
    alert('Web Serial nur über HTTPS oder http://localhost in Chrome/Edge.');
    throw new Error('Web Serial nicht verfügbar');
  }
  if (S.opening) { uiLog('⏳ Verbindung läuft bereits …'); return false; }
  S.opening = true;
  try {
    // IMMER Dialog zeigen:
    let port = null;
    try {
      // Calliope-Varianten filtern
      port = await navigator.serial.requestPort({ 
        filters: [
          { usbVendorId: 0x0D28 }, // Calliope 3 (Nordic)
          { usbVendorId: 0x1366 }, // Calliope 1/2 (mbed)
          { usbVendorId: 0x0D28, usbProductId: 0x0204 }, // Calliope 3 spezifisch
          { usbVendorId: 0x1366, usbProductId: 0x1025 }, // Calliope 1/2 spezifisch
        ]
      });
    } catch (e) {
      // User hat abgebrochen → ruhig beenden
      if (e?.name === 'NotFoundError' || (e.message||'').includes('No port selected')) {
        uiLog('ℹ️ Kein Port ausgewählt.'); return false;
      }
      throw e;
    }

    // Öffnen (mit sauberem Cleanup & kleinem Backoff für frische Enumerations)
    const waits = [0, 300, 700, 1200]; // ms
    let lastErr = null;
    for (const w of waits) {
      if (w) { await new Promise(r=>setTimeout(r,w)); }
      try { await openOnce(port); uiLog('🔌 Serial verbunden'); return true; }
      catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Konnte Port nicht öffnen.');
  } finally {
    S.opening = false;
  }
}

  async function tryOpenGranted() {
    if (!('serial' in navigator)) return false;
    if (S.opening) return false;
    const ports = await navigator.serial.getPorts();
    if (!ports?.length) return false;
    let chosen = ports[0];
    if (S.lastInfo) {
      chosen = ports.find(p => {
        const i = p.getInfo?.() || {};
        return i.usbVendorId === S.lastInfo.usbVendorId && i.usbProductId === S.lastInfo.usbProductId;
      }) || chosen;
    }
    try {
      await openOnce(chosen);
      uiLog('🔌 Serial verbunden (auto)');
      return true;
    } catch (e) {
      uiLog(`⚠️ Auto-Open fehlgeschlagen: ${e.message || e}`);
      return false;
    }
  }

  async function closeSerial() {
    await ensureClosed();
    uiLog('🔌 Serial getrennt');
  }

  function isOpen(){ return !!S.writer; }
  function onData(fn){ S.listeners.add(fn); }
  function offData(fn){ S.listeners.delete(fn); }

  function serialWrite(data) {
    if (!S.writer) throw new Error('Serial nicht offen.');
    const buf = (data instanceof Uint8Array) ? data : S.enc.encode(String(data));
    return S.writer.write(buf);
  }

  async function pasteExec(code, delay = 20) {
    if (!S.writer) throw new Error('Serial nicht offen.');
    await S.writer.write(S.enc.encode('\x05')); // paste mode
    const lines = String(code).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    for (const ln of lines) { await S.writer.write(S.enc.encode(ln + '\r')); await sleep(delay); }
    await S.writer.write(S.enc.encode('\x04')); // Ctrl-D
  }

  function expectReset(ms) { S.expectResetUntil = Date.now() + (ms|0); }

  // Browser-Events
navigator.serial?.addEventListener?.('connect', async () => {
  if (Date.now() < S.expectResetUntil) {    // 👈 nur im angekündigten Zeitfenster
    try { await tryOpenGranted(); } catch {}
  }
});

  // --------- Export ---------
  window.CalliopeSerial = {
    init,
    openSerial,
    tryOpenGranted,
    closeSerial,
    isOpen,
    onData,
    offData,
    serialWrite,
    pasteExec,
    expectReset,
  };
})();