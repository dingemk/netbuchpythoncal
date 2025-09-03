/* calliope.hex.js
 * Builder & Flasher für Calliope mini 1/2 und 3
 * - init({ outEl, firmwareUrls })
 * - setTargetC12(), setTargetC3(), getTarget()
 * - buildAndDownload(), buildAndSaveToDrive(), buildAndFlashWebUSB()
 *
 * Abhängigkeiten (global):
 *   - window.calliopeHexTools: { appendScriptV1, packMainPyAuto, hexToU8? }
 *   - window.CalliopeSerial?: { saveHexToDrive?, expectReset? }
 *   - DAPjs (für C3-WebUSB): lädt in deiner index.html als ES-Modul und setzt
 *       window.DAPjs, window.DAPLink, window.WebUSB
 */

(function () {
  'use strict';

  // -------------------- interner Zustand --------------------
  const S = {
    outEl: null,
    target: 'c12', // 'c12' | 'c3'
    firmwareUrls: {
      c12: 'firmware/calliope12-micropython.hex',
      c3:  'firmware/calliope-v3-correct.hex'
    },
  };

  // -------------------- kleine Utils --------------------
  function log(msg, cls = 'text-muted') {
    try {
      if (S.outEl) {
        S.outEl.insertAdjacentHTML('beforeend', `<div class="${cls}">${msg}</div>`);
        S.outEl.scrollTo?.(0, S.outEl.scrollHeight);
      } else {
        console.log('[CalliopeHex]', msg);
      }
    } catch { console.log('[CalliopeHex]', msg); }
  }

  function getEditorCode() {
    try { if (window.editor?.getValue) return String(window.editor.getValue()); } catch {}
    try { if (window.cmEditor?.getValue) return String(window.cmEditor.getValue()); } catch {}
    const ta = document.querySelector('#editor, textarea[name="code"], textarea[data-role="editor"]');
    return ta ? String(ta.value || '') : '';
  }

  function ensureTools() {
    const T = window.calliopeHexTools || window.calliopeHexTools?.default;
    if (!T) throw new Error('calliope-hex-tools nicht geladen.');
    const hasV1 = typeof T.appendScriptV1 === 'function';
    const hasPack = typeof T.packMainPyAuto === 'function';
    if (!hasV1 || !hasPack) throw new Error('calliope-hex-tools unvollständig (appendScriptV1/packMainPyAuto fehlen).');
    return T;
  }

  async function fetchText(url, purpose = 'Ressource') {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${purpose} nicht ladbar (${res.status}) → ${url}`);
    return res.text();
  }

  async function fetchBaseHex() {
    const url = S.target === 'c3' ? S.firmwareUrls.c3 : S.firmwareUrls.c12;
    if (!url) throw new Error('Keine Firmware-URL für aktuelles Ziel.');
    return await fetchText(url, 'Firmware');
  }

  // --------- HELPER: C3 per WebUSB verbinden (mit Retries & Clock-Drossel) ----------
  async function connectDAPLinkC3WithRetries(logFn) {
    const WebUSB = window.WebUSB || window.DAPjs?.WebUSB;
    const DAPLink = window.DAPLink || window.DAPjs?.DAPLink;
    if (!WebUSB || !DAPLink) throw new Error('DAPjs/WebUSB nicht geladen');

    // Serielle Verbindungen schließen, damit WebUSB exklusiv ist
    try { await window.CalliopeSerial?.closeSerial?.(); } catch {}

    // Kleiner Diagnose-Helper: DETAILS.TXT lesen, wenn vorhanden
    async function logDetailsTxt() {
      try {
        const drives = await navigator.storage?.getDirectory?.(); // nicht überall verfügbar
      } catch {}
      try {
        // Wenn Calliope als Mass-Storage gemountet ist, kann man DETAILS.TXT über die Filesystem-API
        // idR. nicht direkt lesen. In der Praxis: Nutzerhinweis
        logFn?.('ℹ️ Tipp: Öffne auf dem Calliope-Laufwerk die Datei <code>DETAILS.TXT</code> und prüfe die DAPLink-Version (empfohlen ≥ 0249).', 'text-muted');
      } catch {}
    }

    // Drei Verbindungs-Versuche mit sinkender SWD-Clock
    const clocks = [1_000_000, 500_000, 200_000]; // 1 MHz → 500 kHz → 200 kHz
    let lastErr = null;

    for (let i = 0; i < clocks.length; i++) {
      const hz = clocks[i];
      let daplink = null;
      try {
        // 1) Gerät *in der User-Geste* auswählen
        // Spezifischer Filter für Calliope mini 3 (CMSIS-DAP)
        const device = await navigator.usb.requestDevice({ 
          filters: [
            { vendorId: 0x0D28, productId: 0x0204 }, // Calliope mini 3 CMSIS-DAP
            { vendorId: 0x0D28 } // Fallback für andere DAPLink-Geräte
          ] 
        });
        
        // Debug: USB-Gerätedaten loggen
        console.log('USB Device:',
          device.productName,
          'vid=0x' + device.vendorId.toString(16),
          'pid=0x' + device.productId.toString(16));

        // 2) Transport + DAPLink
        const transport = new WebUSB(device);
        daplink = new DAPLink(transport);

        // 3) Verbinden
        await daplink.connect();

        // 4) Clock setzen (wenn API verfügbar)
        try {
          if (typeof daplink.setClock === 'function') {
            await daplink.setClock(hz);
          } else if (daplink.dap?.swjClock) {
            await daplink.dap.swjClock(hz);
          }
        } catch (e) {
          // nicht fatal
          console.warn('[CalliopeHex] Clock-Drosselung nicht verfügbar:', e);
        }

        // 5) Sanity-Call: Version abfragen (stabilisiert manche Firmwares)
        try { 
          if (typeof daplink.getVersion === 'function') {
            const vers = await daplink.getVersion();
            console.log('DAPLink Version:', vers);
          }
        } catch {}

        // Erfolgreiche Verbindung zurückgeben
        if (i > 0) logFn?.(`🔁 Verbunden mit gedrosselter SWD-Clock: ${hz/1000} kHz`, 'text-muted');
        return daplink;

      } catch (e) {
        lastErr = e;
        // Aufräumen, damit der nächste Versuch „sauber" startet
        try { await daplink?.disconnect(); } catch {}
        // Nutzerfreundliche Meldung
        if (/Bad response for 8\s*->\s*17/i.test(String(e?.message))) {
          logFn?.(`⚠️ Verbindung schlug fehl (Bad response 8→17) – neuer Versuch mit ${hz === 200_000 ? 'noch niedriger' : 'niedriger'}er Clock …`, 'text-warning');
        } else {
          logFn?.(`⚠️ Verbindungsversuch fehlgeschlagen: ${e?.message || e}`, 'text-warning');
        }
        // Beim ersten Fehlschlag gleich Hinweis auf DETAILS.TXT
        if (i === 0) await logDetailsTxt();
      }
    }

    // Alle Versuche fehlgeschlagen
    throw lastErr || new Error('WebUSB-Verbindung nicht möglich.');
  }

  // -------------------- Build-Pipeline --------------------
  async function buildHexText() {
    const T = ensureTools();
    const baseHex = await fetchBaseHex();
    const py = getEditorCode();
    if (!/\S/.test(py)) throw new Error('Kein Python-Code im Editor.');

    if (S.target === 'c3') {
      // Calliope mini 3 – auto pack main.py in passende Slots/FS
      return await T.packMainPyAuto(baseHex, py, { quiet: true });
    }
    // Calliope 1/2 – klassisch anfügen
    return T.appendScriptV1(baseHex, py);
  }

  // -------------------- Öffentliche API --------------------
  const API = {
    init(opts = {}) {
      if (opts.outEl) S.outEl = opts.outEl;
      if (opts.firmwareUrls && typeof opts.firmwareUrls === 'object') {
        S.firmwareUrls = { ...S.firmwareUrls, ...opts.firmwareUrls };
      }
      log('✅ CalliopeHex init');
      return API;
    },
    setTargetC12() { S.target = 'c12'; log('Ziel: Calliope mini 1/2'); },
    setTargetC3()  { S.target = 'c3';  log('Ziel: Calliope mini 3'); },
    getTarget()    { return S.target; },

    // Editor → HEX-Download
    async buildAndDownload() {
      try {
        const hexText = await buildHexText();
        const blob = new Blob([hexText], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'main.hex';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        log('⬇️ HEX heruntergeladen: main.hex');
      } catch (e) {
        log(`❌ ${e?.message || e}`, 'text-danger');
        throw e;
      }
    },

    // Editor → Gerätelaufwerk (wenn CalliopeSerial.saveHexToDrive() existiert), sonst Download
    async buildAndSaveToDrive() {
      try {
        const hexText = await buildHexText();

        // Reboot/Reset-Fenster ankündigen (für Auto-Reconnect über Serial)
        try { window.CalliopeSerial?.expectReset?.(20000); } catch {}

        if (window.CalliopeSerial?.saveHexToDrive) {
          await window.CalliopeSerial.saveHexToDrive(hexText, 'main.hex');
          log('💽 HEX auf Laufwerk kopiert (main.hex)');
        } else {
          // Fallback: normaler Download
          const blob = new Blob([hexText], { type: 'text/plain' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'main.hex';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          log('⬇️ HEX heruntergeladen (Fallback). Nach dem Kopieren aufs Gerät startet es neu.');
        }
      } catch (e) {
        log(`❌ ${e?.message || e}`, 'text-danger');
        throw e;
      }
    },

    // Editor → WebUSB (nur C3). requestDevice() kommt als allererstes (User-Geste!)
    async buildAndFlashWebUSB() {
      if (S.target !== 'c3') {
        // Für C1/2 gibt es kein WebUSB-Flash → auf Laufwerk/Download ausweichen
        return API.buildAndSaveToDrive();
      }

      const WebUSB = window.WebUSB || window.DAPjs?.WebUSB;
      const DAPLink = window.DAPLink || window.DAPjs?.DAPLink;
      if (!WebUSB || !DAPLink) {
        log('⚠️ DAPjs nicht verfügbar – verwende Save to Drive', 'text-warning');
        return API.buildAndSaveToDrive();
      }

      let daplink = null;
      try {
        // 1) ***WICHTIG***: *direkt* in der Button-Geste verbinden (mit Retries)
        daplink = await connectDAPLinkC3WithRetries((m,c)=>log(m,c));

        // 2) ***Jetzt erst*** bauen (darf dauern)
        const hexText = await buildHexText();

        // 3) Flashen (bevorzugt flashHex, sonst Binärdaten)
        if (typeof daplink.flashHex === 'function') {
          await daplink.flashHex(hexText);
        } else {
          const T = ensureTools();
          const u8 = (typeof T.hexToU8 === 'function')
            ? T.hexToU8(hexText)
            : new TextEncoder().encode(hexText); // Fallback
          await daplink.flash(u8.buffer ?? u8);
        }

        // 4) Reset & Erfolg
        await daplink.reset(false);
        log('✅ Flash erfolgreich', 'text-success');

      } catch (e) {
        // Bekannter Fehler → klare Hinweise
        if (/Bad response for 8\s*->\s*17/i.test(String(e?.message))) {
          log(
            '❌ Flash: Bad response 8→17. Prüfe bitte:<br>' +
            '• Nur **ein** Tab/App mit Zugriff geöffnet<br>' +
            '• Board **nicht** im <code>MAINTENANCE</code>-Modus<br>' +
            '• USB-Kabel/Port (Datenkabel) wechseln<br>' +
            '• DAPLink-Interface-Version in <code>DETAILS.TXT</code> (empf. ≥ 0249)<br>' +
            '• Erneut versuchen – die SWD-Clock wurde bereits automatisch gesenkt.',
            'text-danger'
          );
        } else {
          log(`❌ Flash: ${e?.message || e}`, 'text-danger');
        }

        // Fallback anbieten
        try {
          log('↪️ Fallback: Speichere HEX auf Laufwerk.', 'text-muted');
          await API.buildAndSaveToDrive();
        } catch (e2) {
          log(`❌ Fallback fehlgeschlagen: ${e2?.message || e2}`, 'text-danger');
        }

        throw e;

      } finally {
        // 5) Immer sauber trennen (wichtig für den nächsten Versuch)
        try { await daplink?.disconnect(); } catch {}
      }
    },

    // Für externe Handler: denselben Buildpfad nutzen
    _buildHexText: () => buildHexText(),
    get firmwareUrls() { return { ...S.firmwareUrls }; },
  };

  // Globale API exportieren
  window.CalliopeHex = API;
})();
