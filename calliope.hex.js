(function(){
  const STATE = {
    editor: null,
    outEl: null,
    target: 'c12',
    firmwareUrls: { c12: 'firmware/micro_bit.hex' }
  };
  const out = () => STATE.outEl || document.getElementById('output');
  const log = (...a)=>{ const el=out(); const msg=a.join(' ');
    if (el){ el.innerHTML += msg.replace(/\r/g,'').replace(/\n/g,'<br>')+'<br>'; el.scrollTop=el.scrollHeight; }
    else { console.log('[calliope]', msg); }
  };

  async function fetchText(url){
    const r = await fetch(url, { cache:'no-store' });
    if(!r.ok) throw new Error(`HTTP ${r.status} für ${url}`);
    return await r.text();
  }

  // --- WT-kompatible Normalisierung von main.py (LF, Prelude, finales LF, 16-Byte-Padding) ---
  function normalizeMainPy(py) {
    const PRELUDE = "from calliope_mini import uart\nuart.init()\n";
    let s = String(py).replace(/^\uFEFF/, "");                  // BOM weg
    if (!/^from\s+calliope_mini\s+import\s+uart\s*\n\s*uart\.init\(\)/.test(s)) {
      s = PRELUDE + s;                                         // Prelude vorn
    }
    s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");          // nur LF
    if (!s.endsWith("\n")) s += "\n";                           // finales LF
    const n = new TextEncoder().encode(s).length;               // NUL-Padding auf 16-Byte
    const pad = (16 - (n % 16)) % 16;
    if (pad) s += "\0".repeat(pad);
    return s;
  }

  // --------- manueller Intel-HEX Fallback (ohne microbit-fs) ----------
  function hexChecksum(bytes) {
    let sum = 0;
    for (const b of bytes) sum = (sum + (b & 0xFF)) & 0xFF;
    return ((0x100 - sum) & 0xFF);
  }
  function hexLine(addr, type, data) {
    const ll = data.length & 0xFF;
    const hi = (addr >> 8) & 0xFF, lo = addr & 0xFF;
    const bytes = [ll, hi, lo, type, ...data];
    const cs = hexChecksum(bytes);
    const to2 = (x)=>x.toString(16).toUpperCase().padStart(2,"0");
    const dataStr = data.map(to2).join("");
    return `:${to2(ll)}${to2(hi)}${to2(lo)}${to2(type)}${dataStr}${to2(cs)}`;
  }
  // schneidet ab 0xE000 und baut Script neu auf (Header MP A7 00 + 16-Byte Chunks + EOF)
  function rebuildWithAppendedScript(rawHex, mainPyUtf8Bytes) {
    const lines = rawHex.split(/\r?\n/).filter(Boolean);
    const kept = [];
    for (const line of lines) {
      if (!line.startsWith(":")) continue;
      const type = parseInt(line.slice(7,9),16);
      const addr = parseInt(line.slice(3,7),16);
      if (type === 1) continue;                 // EOF weglassen
      if (type === 0 && addr >= 0xE000) break;  // ab E000 wegschneiden
      kept.push(line);
    }
    const out = [...kept];
    // Headerwort an 0xE000: 4D 50 A7 00
    out.push(hexLine(0xE000, 0x00, [0x4D,0x50,0xA7,0x00]));
    // Python ab 0xE004 in 16-Byte-Blöcken
    let addr = 0xE004;
    for (let i=0; i<mainPyUtf8Bytes.length; i+=16) {
      const chunk = mainPyUtf8Bytes.slice(i, i+16);
      out.push(hexLine(addr, 0x00, Array.from(chunk)));
      addr += 16;
    }
    // EOF
    out.push(":00000001FF");
    return out.join("\n") + "\n";
  }

  // ------------ microbit-fs dynamisch erkennen (bevorzugt fromHex→toHex) -------------
  function resolveMicrobitFs() {
    const mod = window.MicrobitFs;
    const root = (mod && mod.default) ? mod.default : mod;
    const hasFn = (o,n)=>o && typeof o[n]==='function';

    // 1) echtes Dateisystem: vorhandenes main.py wird ÜBERSCHRIEBEN
    if (hasFn(root,'fromHex') && hasFn(root,'pack') /* einige Builds brauchen pack intern */) {
      return {
        kind: 'fromHex→toHex',
        async build({hex, files}) {
          const fs = await root.fromHex(hex);
          const content = normalizeMainPy(files['main.py'] || '');
          if (!fs || typeof fs.write !== 'function' || typeof fs.toHex !== 'function') {
            throw new Error('FS.write()/FS.toHex() fehlt');
          }
          await fs.write('main.py', content);
          return fs.toHex();
        }
      };
    }

    // 2) Append-API (wenn vorhanden) – erzeugt EINEN Script-Block
    if (hasFn(root,'addIntelHexAppendedScript')) {
      return {
        kind: 'appendedScript',
        async build({hex, files}) {
          const content = normalizeMainPy(files['main.py'] ?? '');
          if (!content) throw new Error('Kein main.py Inhalt übergeben');
          return root.addIntelHexAppendedScript(hex, 'main.py', content);
        }
      };
    }

    // 3) createHex/pack/build Fallbacks
    if (hasFn(root,'createHex')) {
      return {
        kind: 'createHex',
        async build({hex, files}) {
          return root.createHex({ hex, files:{ 'main.py': normalizeMainPy(files['main.py']||'') } });
        }
      };
    }
    if (hasFn(root,'pack')) {
      return {
        kind: 'pack',
        async build({hex, files}) {
          return root.pack({ hex, files:{ 'main.py': normalizeMainPy(files['main.py']||'') } });
        }
      };
    }
    if (hasFn(root,'build')) {
      return {
        kind: 'build',
        async build({hex, files}) {
          return root.build({ hex, files:{ 'main.py': normalizeMainPy(files['main.py']||'') } });
        }
      };
    }

    // 4) **Kein** microbit-fs → manueller Rebuilder
    return {
      kind: 'manual-intel-hex',
      async build({ hex, files }) {
        const norm = normalizeMainPy(files['main.py'] || '');
        const bytes = new TextEncoder().encode(norm);
        return rebuildWithAppendedScript(hex, bytes);
      }
    };
  }

  async function buildHexFromCode(pyCode){
    const firmwareHex = await fetchText(STATE.firmwareUrls[STATE.target]);
    const api = resolveMicrobitFs();
    log(`ℹ️ Build-Route: ${api.kind}; Basis: ${STATE.firmwareUrls[STATE.target]}`);
    return await api.build({ hex: firmwareHex, files: { 'main.py': pyCode } });
  }

  const API = {
    init({ editor, outEl, target='c12', firmwareUrls }){
      STATE.editor = editor || window.editor || null;
      STATE.outEl  = outEl  || document.getElementById('output') || null;
      STATE.target = target;
      if (firmwareUrls) STATE.firmwareUrls = firmwareUrls;
      log('✅ CalliopeHex bereit (Target:', STATE.target, ')');
    },
    setTargetC12(){ STATE.target='c12'; log('🎯 Ziel: Calliope 1/2'); },
    setTargetC3(){  STATE.target='c3';  log('🎯 Ziel: Calliope 3');  },

    async buildAndDownload(){
      try{
        const code = (STATE.editor?.getValue?.() || window.editor?.getValue?.() || '').toString();
        if (!code) throw new Error('Kein Code im Editor');
        const hex = await buildHexFromCode(code);
        const blob = new Blob([hex], { type:'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download='main.hex';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        log('⬇️ main.hex heruntergeladen.');
      } catch(e){ log('❌ Build/Download fehlgeschlagen:', e.message); }
    },

    async buildAndSaveToDrive(){
      try{
        if (!('showDirectoryPicker' in window)) throw new Error('File System Access API fehlt (Chrome/Edge + HTTPS).');
        const code = (STATE.editor?.getValue?.() || window.editor?.getValue?.() || '').toString();
        if (!code) throw new Error('Kein Code im Editor');
        const hex = await buildHexFromCode(code);
        const dir = await window.showDirectoryPicker();
        const fh = await dir.getFileHandle('main.hex', { create:true });
        const w = await fh.createWritable(); await w.write(hex); await w.close();
        log('💽 main.hex aufs Laufwerk gespeichert.');
      } catch(e){ log('❌ Build/Save fehlgeschlagen:', e.message); }
    }
  };

  window.CalliopeHex = API;
})();
