// Python-IDE Scripts (Monaco, Pyodide, Turtle, UI)
(function () {
  // ========== Monaco ==========
  require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs" } });
  let editor;
  require(["vs/editor/editor.main"], function () {
    const startCode = sessionStorage.getItem('pythonide-editor-content') || "";
    editor = monaco.editor.create(document.getElementById("editor"), {
      value: startCode, language: "python", theme: "vs", automaticLayout: true, fontSize: 14
    });
    window.editor = editor;
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, runCode);
    editor.onDidChangeModelContent(function () {
      const current = editor.getValue();
      if (current.trim()) sessionStorage.setItem('pythonide-editor-content', current);
      else sessionStorage.removeItem('pythonide-editor-content');
    });
  });

  // ========== Pyodide + IO ==========
  let pyodide;
  const outEl = document.getElementById("output");
  const saveBtn = document.getElementById("save-png-btn");
  const appCanvas = document.getElementById("canvas");

  window.addEventListener("unhandledrejection", function (evt) {
    evt.preventDefault();
    const reason = evt.reason;
    const msg = "[Unhandled] " + (reason && reason.message ? reason.message : String(reason));
    const pre = document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.textContent = msg;
    outEl.appendChild(pre);
    outEl.scrollTop = outEl.scrollHeight;
  });

  async function bootPyodide() {
    outEl.innerHTML = "Lade Pyodide...<br>";
    pyodide = await loadPyodide();

    if (typeof window.registerTurtleInPython !== "function") {
      outEl.innerHTML += "Fehler: turtle.js geladen, aber registerTurtleInPython fehlt.<br>";
      return;
    }
    await window.registerTurtleInPython(pyodide);

    pyodide.setStdout({
      batched: function (txt) {
        const htmlText = txt.replace(/\n/g, '<br>');
        if (txt.trim() !== '') outEl.innerHTML += htmlText + '<br>';
        outEl.scrollTop = outEl.scrollHeight;
      }
    });
    pyodide.setStderr({
      batched: function (txt) {
        const htmlText = txt.replace(/\n/g, '<br>');
        outEl.innerHTML += htmlText;
        outEl.scrollTop = outEl.scrollHeight;
      }
    });

    outEl.innerHTML += "Pyodide + jturtle bereit.<br>";

    // Python input() → JS prompt
    pyodide.runPython(`
      import js
      def custom_input(prompt_text=''):
          return js.window.prompt(prompt_text)
      import builtins
      builtins.input = custom_input
    `);

    try { pyodide.FS.mkdir("/home"); } catch {}
    try { pyodide.FS.mkdir("/home/pyodide"); } catch {}

    // Gespeicherte Dateien aus localStorage wiederherstellen
    try {
      outEl.innerHTML += "Lade gespeicherte Dateien...<br>";
      let loadedFiles = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('file_')) {
          const filename = key.replace('file_', '');
          try {
            const fileData = JSON.parse(localStorage.getItem(key));
            const uint8Array = new Uint8Array(fileData);
            pyodide.FS.writeFile("/home/pyodide/" + filename, uint8Array);
            (window.uploadedFiles ??= new Set()).add(filename);
            loadedFiles++;
          } catch (e) {
            console.warn("[startup] Wiederherstellen fehlgeschlagen:", filename, e);
            localStorage.removeItem(key);
          }
        }
      }
      outEl.innerHTML += loadedFiles
        ? `✅ ${loadedFiles} gespeicherte Dateien wiederhergestellt<br>`
        : "ℹ️ Keine gespeicherten Dateien gefunden<br>";
    } catch (e) {
      console.warn("Fehler beim Laden der gespeicherten Dateien:", e);
      outEl.innerHTML += "⚠️ Fehler beim Laden der gespeicherten Dateien<br>";
    }

    // ✅ Meldung mit Zeilenumbruch, wenn Dateien-Panel ausgeblendet
    setTimeout(() => {
      const filesHidden = getComputedStyle(document.getElementById("files-panel")).display === "none";
      outEl.textContent = filesHidden ? "✅ Alle Dateien geladen - Bereit für Python-Code!\n" : "";
    }, 1000);

    if (saveBtn) saveBtn.disabled = false;

    setupUpload();
    await window.refreshFileList?.();
  }

  function setupUpload() {
    const input = document.getElementById("file-input");
    if (!input) return console.error("[upload] #file-input fehlt");
    input.addEventListener("change", async (e) => {
      try {
        if (!pyodide) { alert("Pyodide noch nicht bereit."); return; }
        try { pyodide.FS.mkdir("/home"); } catch {}
        try { pyodide.FS.mkdir("/home/pyodide"); } catch {}
        const files = e.target.files || [];
        for (const f of files) {
          const data = new Uint8Array(await f.arrayBuffer());
          pyodide.FS.writeFile("/home/pyodide/" + f.name, data);
          try { localStorage.setItem(`file_${f.name}`, JSON.stringify(Array.from(data))); } catch {}
          (window.uploadedFiles ??= new Set()).add(f.name);
        }
        input.value = "";
        await window.refreshFileList?.();
      } catch (err) {
        console.error("[upload] Fehler:", err);
        alert("Fehler beim Hochladen: " + err.message);
      }
    });
  }

  window.addEventListener("DOMContentLoaded", function () {
    const emergencyResetBtn = document.getElementById("emergency-reset-btn");
    if (emergencyResetBtn) {
      emergencyResetBtn.addEventListener("click", function () {
        if (confirm("Möchten Sie die Seite wirklich neu laden? Der Editor-Inhalt wird wiederhergestellt!")) {
          location.reload();
        }
      });
    }
    bootPyodide();
  });

  // ========== Run ==========
  async function runCode() {
    if (!pyodide) return;
    outEl.innerHTML = "";
    outEl.style.color = "inherit";

    let code = editor.getValue();

    if (code.includes('pandas') || code.includes('pd.') || code.includes('DataFrame')) {
      if (!code.includes('import pandas')) code = "import pandas as pd\nimport numpy as np\n\n" + code;
    }

    // lokale Module vorab laden
    if (code.includes('import ') && code.includes('.py')) {
      try {
        const files = pyodide.FS.readdir("/home/pyodide");
        const pyFiles = files.filter(f => f.endsWith('.py'));
        for (const file of pyFiles) {
          try {
            const content = pyodide.FS.readFile("/home/pyodide/" + file, { encoding: 'utf8' });
            pyodide.runPython(content);
          } catch {}
        }
      } catch {}
    }

    code = extendPythonCode(code);
    window.__lastRunPythonCode = code;

    let timeoutMs = 15000;
    if (/\binput\s*\(/.test(code)) timeoutMs = 120000;
    if (/makeTurtle|from\s+gturtle|matplotlib|plt\./.test(code)) timeoutMs = Math.max(timeoutMs, 30000);

    try {
      const low = code.toLowerCase();
      if (low.includes("while true") || code.includes("while True") || code.includes("while 1")) {
        throw new Error("Zeitüberschreitung/Endlosschleife: 'while True' ist nicht erlaubt. Nutze 'for i in range(n):'.");
      }
      const codePromise = pyodide.runPythonAsync(code);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Zeitüberschreitung - Programm läuft zu lange (${Math.round(timeoutMs/1000)} Sekunden)`)), timeoutMs)
      );
      await Promise.race([codePromise, timeoutPromise]);
    } catch (e) {
      const tb = String(e?.message || e || "");
      if (/Zeitüberschreitung/.test(tb)) {
        const pre = document.createElement("pre"); pre.style.whiteSpace = "pre-wrap";
        pre.textContent =
          `❌ Zeitüberschreitung: Dein Programm lief länger als ${Math.round(timeoutMs/1000)} Sekunden.\n` +
          `Hinweis: Vermeide Endlosschleifen, reduziere Ausgabe oder Eingabeaufforderungen.`;
        outEl.style.color = "#d32f2f"; outEl.innerHTML = ""; outEl.appendChild(pre); return;
      }
      const msg = formatPythonError(tb, { userCode: window.__lastRunPythonCode || null, contextLines: 1 });
      outEl.style.color = "#d32f2f"; outEl.innerHTML = ""; const pre = document.createElement("pre"); pre.style.whiteSpace = "pre-wrap"; pre.textContent = msg; outEl.appendChild(pre);
    }
  }

  // ========== repeat-Erweiterung & Fehlerformatierer ==========
  function extendPythonCode(code) {
    const lines = code.split(/\r?\n/);
    const out = [];
    for (let line of lines) {
      const original = line;
      const trimmed = line.trimStart();
      const indent = line.slice(0, line.length - trimmed.length);
      if (!trimmed || trimmed.startsWith('#')) { out.push(original); continue; }
      let m = trimmed.match(/^repeat\s+(.+?)\s*:\s*(#.*)?$/);
      if (m) { const expr=m[1].trim(); const comment=m[2]?' '+m[2].trim():''; out.push(`${indent}for _ in range(${expr}):${comment}`); continue; }
      m = trimmed.match(/^repeat\s+(.+?)\s+(?!#)(.+)$/);
      if (m) { const expr=m[1].trim(); const stmt=m[2].trim(); out.push(`${indent}for _ in range(${expr}): ${stmt}`); continue; }
      m = trimmed.match(/^repeat\s+(.+?)\s*(#.*)?$/);
      if (m) { const expr=m[1].trim(); const comment=m[2]?' '+m[2].trim():''; out.push(`${indent}for _ in range(${expr}):${comment}`); continue; }
      out.push(original);
    }
    return out.join('\n');
  }

  function formatPythonError(errorMessage, opts = {}) {
    const { userCode = null, contextLines = 1 } = opts;
    const clean = extractRelevantError(String(errorMessage || ""));
    const parsed = parsePyodideTraceback(clean.split(/\r?\n/));
    const snippet = buildSnippet({ userCode, line: parsed.line, contextLines, fallbackCodeFromTrace: parsed.codeFromTraceback });
    const hints = buildHints(parsed, snippet?.mainLine || "");
    const header =
      "❌ Python-Fehler\n" +
      (parsed.file ? `Datei: ${parsed.file}\n` : "") +
      (parsed.line ? `Zeile: ${parsed.line}\n` : "") +
      (parsed.errorType ? `Art: ${parsed.errorType}\n` : "") +
      (parsed.errorMessage ? `Nachricht: ${parsed.errorMessage}\n` : "");
    const block = [];
    if (snippet?.text) block.push("\nCodeausschnitt:\n" + snippet.text);
    if (hints) block.push("\nHinweise:\n" + hints);
    return header + (block.length ? "\n" + block.join("\n") : "");
  }
  function extractRelevantError(message) {
    let m = message; const idx = m.indexOf("Traceback (most recent call last):");
    if (idx >= 0) m = m.slice(idx);
    const lines = m.split(/\r?\n/);
    const filtered = [];
    for (const line of lines) {
      if (line.includes('File "/lib/python') || line.includes("_pyodide/_base.py") || line.includes('File "/usr/lib/') || line.includes("site-packages/pyodide") || line.includes("importlib/_bootstrap")) continue;
      filtered.push(line);
    }
    return filtered.join("\n").trim() || message;
  }
  function parsePyodideTraceback(lines) {
    let file = "", line = null, codeFromTraceback = "", errorType = "", errorMessage = "";
    const frameRegex = /^\s*File\s+"([^"]+)",\s+line\s+(\d+)(?:,.*)?$/;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(frameRegex);
      if (m) {
        file = m[1]; line = parseInt(m[2], 10);
        let j = i + 1; while (j < lines.length && lines[j].trim() === "") j++;
        if (j < lines.length && !/^ {0,}File\s+/.test(lines[j])) {
          if (!/^\s*\^+\s*$/.test(lines[j])) codeFromTraceback = lines[j].trim();
        }
      }
    }
    let last = ""; for (let k = lines.length - 1; k >= 0; k--) { const t = lines[k].trim(); if (t) { last = t; break; } }
    const mLast = last.match(/^([A-Za-z_][\w\.]*)(?::\s*(.*))?$/);
    if (mLast) { errorType = mLast[1] || ""; errorMessage = mLast[2] || ""; } else { errorMessage = last; }
    return { file, line, codeFromTraceback, errorType, errorMessage };
  }
  function buildSnippet({ userCode, line, contextLines, fallbackCodeFromTrace }) {
    if (userCode && Number.isInteger(line) && line > 0) {
      const src = userCode.split(/\r?\n/);
      const idx = line - 1;
      const start = Math.max(0, idx - contextLines);
      const end = Math.min(src.length - 1, idx + contextLines);
      const rows = [];
      for (let i = start; i <= end; i++) {
        const ln = String(i + 1).padStart(4, " ");
        const marker = i === idx ? ">" : " ";
        rows.push(`${marker} ${ln}: ${src[i]}`);
        if (i === idx) {
          const indent = (src[i].match(/^(\s*)/)?.[1].length) || 0;
          rows.push(`  ${" ".repeat(6 + indent)}^`);
        }
      }
      return { text: rows.join("\n"), mainLine: src[idx] || "" };
    }
    if (fallbackCodeFromTrace) return { text: `>      ${fallbackCodeFromTrace}`, mainLine: fallbackCodeFromTrace };
    return { text: "", mainLine: "" };
  }
  function isRepeatContext(lineText) { const t = (lineText || "").trim(); return t.startsWith("repeat ") || t.startsWith("for _ in range("); }
  function buildHints(parsed, codeLine) {
    const t = parsed.errorType || ""; const rawMsg = parsed.errorMessage || ""; const msg = rawMsg.toLowerCase(); const lineText = (codeLine || "").trim(); const inRepeat = isRepeatContext(lineText);
    const missingColonAfter = (kw) => `Fehlender Doppelpunkt nach "${kw}":\n   Richtig: ${kw} … :\n   Falsch:  ${kw} …`;
    if (t === "SyntaxError" || /invalid syntax/.test(msg)) {
      if (/unexpected eof while parsing|unterminated/.test(msg)) return "Unvollständiger Ausdruck oder fehlende schließende Klammer/Anführungszeichen.";
      if (/eol while scanning string literal/.test(msg)) return "Unvollständiger String: Anführungszeichen nicht geschlossen.";
      if (/\bexpected ':'\b/.test(msg)) { if (inRepeat && lineText.startsWith("repeat ") && !lineText.endsWith(":") && !/:\s*\S/.test(lineText)) return 'Nach "repeat <Ausdruck>" muss ein Doppelpunkt folgen, wenn ein Block kommt.'; return "Doppelpunkt (:) erwartet – z. B. nach if/for/while/def/class…"; }
      if (/^(if|elif|else|for|while|def|class|try|except|finally)\b/i.test(lineText) && !lineText.endsWith(":")) { const kw = lineText.match(/^\w+/)?.[0] || "Block"; return missingColonAfter(kw); }
      if (inRepeat && /^repeat\s+.+/.test(lineText) && !/:$/.test(lineText)) return 'Einzeilige Form: "repeat <Ausdruck> <Anweisung>" – oder Block: "repeat <Ausdruck>:"';
      return "Allgemeiner Syntaxfehler. Prüfe Klammern (), Doppelpunkte (:), Anführungszeichen und Kommas.";
    }
    if (t === "IndentationError") {
      if (/expected an indented block/.test(msg)) return "Block erwartet: Zeilen innerhalb von if/for/while/def… müssen eingerückt sein (z. B. 4 Leerzeichen).";
      if (/unindent does not match/.test(msg)) return "Einrückungsniveau passt nicht. Achte auf konsistente Leerzeichen/Tabs.";
      return "Einrückungsfehler. Verwende konsequent 4 Leerzeichen pro Ebene.";
    }
    if (t === "NameError") {
      const m = rawMsg.match(/name ['"]([^'"]+)['"] is not defined/i);
      if (m) return inRepeat ? `Im Ausdruck von "repeat …" ist „${m[1]}“ nicht definiert.` : `„${m[1]}“ ist nicht definiert.`;
      return "Ein Name ist nicht definiert.";
    }
    if (t === "TypeError") {
      if (/object cannot be interpreted as an integer/.test(msg)) return inRepeat ? 'Der Ausdruck in "repeat …" muss eine **ganze Zahl** ergeben.' : "Es wurde eine ganze Zahl erwartet (z. B. für range()).";
      if (/unsupported operand type/.test(msg)) return "Nicht kompatible Typen in einem Operator. Mit int()/str()/float() umwandeln.";
      if (/is not iterable/.test(msg)) return "Objekt ist nicht iterierbar.";
      return inRepeat ? 'Der Ausdruck in "repeat …" muss eine **ganze Zahl** liefern.' : "Typfehler: Datentypen prüfen.";
    }
    if (t === "ValueError") {
      if (/invalid literal for int\(/.test(msg)) return inRepeat ? 'Der Ausdruck in "repeat …" kann nicht in int umgewandelt werden.' : 'Ungültiger Wert für int().';
      return "Ungültiger Wert an Funktion/Operation übergeben.";
    }
    if (t === "ZeroDivisionError") return "Division durch 0 ist nicht erlaubt.";
    if (t === "IndexError") return "Listenindex außerhalb des gültigen Bereichs.";
    if (t === "KeyError") return "Dictionary-Schlüssel nicht vorhanden.";
    if (/no such file or directory/.test(msg)) return "Datei nicht gefunden. Pfad/Name prüfen.";
    return inRepeat ? 'Fehler in "repeat …". Ausdruck muss eine ganze Zahl sein.' : "Fehler prüfen: Syntax, Einrückung, definierte Variablen.";
  }

  // ========== Buttons ==========
  document.getElementById("run-icon")?.addEventListener("click", runCode);
  document.getElementById("clear-editor-btn")?.addEventListener("click", () => window.editor && editor.setValue(""));
  document.getElementById("clear-canvas-btn")?.addEventListener("click", () => {
    const ctx = appCanvas.getContext("2d");
    ctx.clearRect(0, 0, appCanvas.width, appCanvas.height);
  });
  document.getElementById("clear-output-btn")?.addEventListener("click", () => { outEl.innerHTML = ""; });

  // ========== Dropdowns (Clear + Hamburger) ==========
  (function initDropdowns(){
    const clearDropdownBtn  = document.getElementById("clear-dropdown-btn");
    const clearDropdownMenu = document.getElementById("clear-dropdown-menu");
    clearDropdownBtn?.addEventListener("click", function(e) {
      e.preventDefault();
      const isVisible = clearDropdownMenu.style.display === "block";
      clearDropdownMenu.style.display = isVisible ? "none" : "block";
    });
    document.addEventListener("click", function(e) {
      if (!clearDropdownBtn?.contains(e.target) && !clearDropdownMenu?.contains(e.target)) clearDropdownMenu.style.display = "none";
    });

    const hamburgerBtn  = document.getElementById("hamburger-btn");
    const hamburgerMenu = document.getElementById("hamburger-menu");
    hamburgerBtn?.addEventListener("click", function(e) {
      e.preventDefault(); e.stopPropagation();
      if (hamburgerMenu.classList.contains('show')) { hamburgerMenu.classList.remove('show'); hamburgerMenu.style.display = 'none'; }
      else { hamburgerMenu.classList.add('show'); hamburgerMenu.style.display = 'block'; }
    });
    document.addEventListener("click", function(e) {
      if (!hamburgerBtn?.contains(e.target) && !hamburgerMenu?.contains(e.target)) { hamburgerMenu?.classList.remove('show'); if (hamburgerMenu) hamburgerMenu.style.display = 'none'; }
    });
  })();

  // ========== Programm laden/speichern ==========
  document.getElementById("load-program-btn")?.addEventListener("click", function(e) {
    e.preventDefault(); document.getElementById('hamburger-menu')?.style && (document.getElementById('hamburger-menu').style.display = "none");
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.py,.txt';
    input.onchange = function(e){ const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader(); reader.onload = ev => editor.setValue(ev.target.result); reader.readAsText(file); };
    input.click();
  });
  document.getElementById("save-program-btn")?.addEventListener("click", function(e) {
    e.preventDefault(); document.getElementById('hamburger-menu')?.style && (document.getElementById('hamburger-menu').style.display = "none");
    const code = editor.getValue();
    const blob = new Blob([code], { type: 'text/plain' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'programm.py'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  });

  // ========== Layout-Logik ==========
  (function initLayoutLogic(){
    const menu       = document.getElementById('hamburger-menu');
    const select     = document.getElementById('layout-select');
    const canvasWrap = document.getElementById('canvas-wrap');
    const output     = document.getElementById('output');
    const files      = document.getElementById('files-panel');
    const rzH        = document.getElementById('resizer-h');
    if (!canvasWrap || !output || !files) return;

    const show = (el, on=true)=>{ if (el) el.style.display = on ? '' : 'none'; };
    function refreshResizerH(){
      const canvasVisible = getComputedStyle(canvasWrap).display !== 'none';
      const outputVisible = getComputedStyle(output).display     !== 'none';
      if (rzH) rzH.style.display = (canvasVisible && outputVisible) ? '' : 'none';
    }

    function applyLayout(mode){
      switch(mode){
        case 'canvas-output':
          show(canvasWrap, true);
          show(output, true);
          show(files, false);
          files.classList.remove('layout-output-files');
          output.classList.remove('layout-output-files');
          break;
        case 'output-files':
          show(canvasWrap, false);
          show(output, true);
          show(files, true);
          files.classList.add('layout-output-files');
          output.classList.add('layout-output-files');
          break;
        case 'canvas-output-files':
          show(canvasWrap, true);
          show(output, true);
          show(files, true);
          files.classList.remove('layout-output-files');
          output.classList.remove('layout-output-files');
          break;
        default:
          mode = 'canvas-output';
          return applyLayout(mode);
      }
      try { localStorage.setItem('ui.layout', mode); } catch {}
      if (select && select.value !== mode) select.value = mode;
      try { window.editor?.layout?.(); } catch {}
      refreshResizerH();
      if (menu) menu.style.display = 'none';
    }

    // global bereitstellen (Resizer nutzt es ggf.)
    window.applyLayout = applyLayout;

    // Select steuert Layout
    select?.addEventListener('change', () => applyLayout(select.value));

    // Alte Links weiterhin unterstützen (falls noch vorhanden)
    document.getElementById('layout-canvas-output')?.addEventListener('click', e => { e.preventDefault(); applyLayout('canvas-output'); });
    document.getElementById('layout-output-files')?.addEventListener('click', e => { e.preventDefault(); applyLayout('output-files'); });
    document.getElementById('layout-canvas-output-files')?.addEventListener('click', e => { e.preventDefault(); applyLayout('canvas-output-files'); });

    // initial
    let start = 'canvas-output';
    try {
      const saved = localStorage.getItem('ui.layout');
      if (saved) start = saved;
      else if (select && select.value) start = select.value;
    } catch {}
    applyLayout(start);
  })();

  // ========== Resizer (Flex-basiert) ==========
  (function initResizersFlex(){
    const ready = (fn)=> (document.readyState !== 'loading') ? fn() : document.addEventListener('DOMContentLoaded', fn);
    ready(()=>{
      const work       = document.getElementById('workarea');
      const left       = document.getElementById('left');
      const right      = document.getElementById('right');
      const rzV        = document.getElementById('resizer');
      const rzH        = document.getElementById('resizer-h');
      const canvasWrap = document.getElementById('canvas-wrap');
      const output     = document.getElementById('output');
      if (!work || !left || !right || !rzV || !rzH || !canvasWrap || !output) return;

      const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
      const relayout = ()=>{ try{ window.editor?.layout?.(); }catch{} };
      const px = (n)=> `${Math.round(n)}px`;

      const setLeftWidth = (w)=>{
        left.style.flex = `0 0 ${px(w)}`;
        left.style.width = px(w);
        try{ localStorage.setItem('ui.splitV', Math.round(w)); }catch{}
        relayout();
      };
      const setCanvasHeight = (h)=>{
        canvasWrap.style.flex = `0 0 ${px(h)}`;
        canvasWrap.style.height = px(h);
        try{ localStorage.setItem('ui.splitH', Math.round(h)); }catch{}
      };

      const sv = parseInt(localStorage.getItem('ui.splitV'),10);
      if (!isNaN(sv) && sv>0) setLeftWidth(sv);
      else setLeftWidth(left.getBoundingClientRect().width || 480);

      const sh = parseInt(localStorage.getItem('ui.splitH'),10);
      if (!isNaN(sh) && sh>0) setCanvasHeight(sh);
      else {
        const rh = right.getBoundingClientRect().height || 600;
        setCanvasHeight(Math.max(140, Math.round(rh*0.6)));
      }

      // vertikal
      rzV.addEventListener('mousedown', (e)=>{
        e.preventDefault();
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
        const startX = e.clientX;
        const startW = left.getBoundingClientRect().width;
        const minL   = 200;
        function onMove(ev){
          const maxL = work.getBoundingClientRect().width - 320; // rechte Seite min 320
          setLeftWidth(clamp(startW + (ev.clientX - startX), minL, maxL));
        }
        function onUp(){
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          document.body.style.userSelect = '';
          document.body.style.cursor = '';
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });

      // horizontal
      rzH.addEventListener('mousedown', (e)=>{
        e.preventDefault();
        if (getComputedStyle(canvasWrap).display === 'none') return;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'row-resize';
        const rectRight = right.getBoundingClientRect();
        const startY = e.clientY;
        const startH = canvasWrap.getBoundingClientRect().height;
        const minTop = 140, minBottom = 120;
        function onMove(ev){
          const newH = clamp(startH + (ev.clientY - startY), minTop, rectRight.height - minBottom);
          setCanvasHeight(newH);
        }
        function onUp(){
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          document.body.style.userSelect = '';
          document.body.style.cursor = '';
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });

      // Resizer-H nur zeigen, wenn Canvas & Output sichtbar
      const show = (el,on=true)=>{ if (el) el.style.display = on ? '' : 'none'; };
      function refreshH(){
        const canvasVisible = getComputedStyle(canvasWrap).display !== 'none';
        const outputVisible = getComputedStyle(output).display     !== 'none';
        show(rzH, canvasVisible && outputVisible);
      }
      refreshH();

      // auf Layout-Wechsel reagieren (Dropdown + evtl. Links)
      const wire = (id, handler)=>{ const el = document.getElementById(id); if (el) el.addEventListener('click', (e)=>{ e.preventDefault(); handler(); refreshH(); }); };
      wire('layout-canvas-output',       ()=>window.applyLayout?.('canvas-output'));
      wire('layout-output-files',        ()=>window.applyLayout?.('output-files'));
      wire('layout-canvas-output-files', ()=>window.applyLayout?.('canvas-output-files'));
      const select = document.getElementById('layout-select');
      select?.addEventListener('change', ()=>{ window.applyLayout?.(select.value); refreshH(); });

      window.addEventListener('resize', ()=>{
        const minL = 200;
        const maxL = work.getBoundingClientRect().width - 320;
        const w = left.getBoundingClientRect().width;
        setLeftWidth(clamp(w, minL, maxL));
      });
    });
  })();

// ------- Beispiele: Setup & UI-Elemente -------
const examplesBtn           = document.getElementById("examples-btn");
const examplesModalElement  = document.getElementById('examplesModal');
const examplesGrid          = document.getElementById("examples-grid");
const loadExampleBtn        = document.getElementById("load-example-btn");
const examplesModalTitle    = document.getElementById("examplesModalLabel");
let selectedExample = null;
let examples = [];

if (examplesBtn) {
  examplesBtn.addEventListener("click", async function(e) {
    e.preventDefault();
    await loadExamplesFromFolder();
    showExamples();
  });
}

// ------- kleine Utils -------
function joinUrl(...parts) {
  return parts
    .map((p, i) => i === 0 ? p.replace(/\/+$/,'') : p.replace(/^\/+|\/+$/g,''))
    .filter(Boolean)
    .join('/');
}
async function urlExists(url) {
  try {
    let res = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (!res.ok) res = await fetch(url, { method: "GET", cache: "no-store" });
    return res.ok;
  } catch { return false; }
}
async function resolveImageUrl(base, stem) {
  const exts = ["png","PNG","jpg","JPG","jpeg","JPEG","webp","WEBP"];
  for (const ext of exts) {
    const candidate = joinUrl(base, `${stem}.${ext}`) + `?v=${Date.now()}`;
    if (await urlExists(candidate)) return candidate;
  }
  return null;
}
function currentDevice() {
  try {
    // bevorzugt gespeicherte Auswahl
    const saved = localStorage.getItem('ui.device');
    if (saved) return saved;
  } catch {}
  // sonst DOM-Select
  const sel = document.getElementById('device-select');
  return sel?.value || 'none';
}
async function detectBase(baseFolder) {
  // baseFolder: 'turtlebeispiele' | 'calliopebeispiele'
  const preferred = new URL(`./${baseFolder}/`, document.baseURI).href;
  const fallbacks = [
    new URL(`/netbuchpython/${baseFolder}/`, location.origin).href,
    new URL(`/${baseFolder}/`, location.origin).href
  ];
  if (window.NETBUCH_BASE) {
    fallbacks.unshift(new URL(joinUrl(window.NETBUCH_BASE, baseFolder + '/'), location.origin).href);
  }
  const candidates = [preferred, ...fallbacks];
  // Suche nach einer plausiblen Datei
  const stems = ['beispiel1','beispiel01','example1'];
  const codeExts = ['.py','.py.txt','.txt'];
  for (const base of candidates) {
    for (const stem of stems) {
      for (const ext of codeExts) {
        if (await urlExists(joinUrl(base, `${stem}${ext}`))) return base;
      }
    }
  }
  return preferred;
}

// ------- Loader je nach Gerät -------
async function loadExamplesFromFolder() {
  const dev = currentDevice();                        // 'none' | 'c12' | 'c3' | …
  const isCalliope = (dev === 'c12' || dev === 'c3'); // Calliope erkannt
  const folder = isCalliope ? 'calliopebeispiele' : 'turtlebeispiele';
  const BASE = await detectBase(folder);

  const list = [];

  if (!isCalliope) {
    // ---- Turtle-Modus (mit Bildern, Grid) ----
    for (let i = 1; i <= 12; i++) {
      const stem = `beispiel${i}`;
      // Code-Datei mit Fallbacks
      const codeHit = await (async () => {
        const files = [`${stem}.py`, `${stem}.py.txt`, `${stem}.txt`];
        for (const f of files) {
          const url = joinUrl(BASE, f);
          try {
            const res = await fetch(url, { cache: "no-store" });
            if (res.ok) return { url, text: await res.text() };
          } catch {}
        }
        return null;
      })();
      if (!codeHit) continue;

      const imgUrl = await resolveImageUrl(BASE, stem);
      list.push({
        name: `Beispiel ${i}`,
        file: codeHit.url,
        image: imgUrl || joinUrl(BASE, "placeholder.png"),
        description: `Python-Programm: Beispiel ${i}`,
        code: codeHit.text,
        kind: 'turtle'
      });
    }
  } else {
    // ---- Calliope-Modus (ohne Bilder, Liste) ----
    // Wir probieren beispiel1…beispiel20 sowie 01…20
    const stems = [];
    for (let i = 1; i <= 20; i++) stems.push(`beispiel${i}`, `beispiel${String(i).padStart(2,'0')}`);
    const seen = new Set();
    for (const stem of stems) {
      if (seen.has(stem)) continue;
      seen.add(stem);
      const hit = await (async () => {
        const files = [`${stem}.py`, `${stem}.py.txt`, `${stem}.txt`];
        for (const f of files) {
          const url = joinUrl(BASE, f);
          try {
            const res = await fetch(url, { cache: "no-store" });
            if (res.ok) return { url, text: await res.text() };
          } catch {}
        }
        return null;
      })();
      if (!hit) continue;
      list.push({
        name: stem.replace(/^beispiel/i, 'Beispiel '),
        file: hit.url,
        image: null,
        description: `Calliope: ${stem}`,
        code: hit.text,
        kind: 'calliope'
      });
    }
  }

  if (list.length === 0) {
    // Fallback-Eintrag
    list.push({
      name: isCalliope ? 'Beispiel 1 (Calliope – Fallback)' : 'Beispiel 1 (Turtle – Fallback)',
      file: joinUrl(BASE, isCalliope ? 'beispiel1.py' : 'beispiel1.py.txt'),
      image: isCalliope ? null : joinUrl(BASE, 'placeholder.png'),
      description: 'Fallback',
      code: isCalliope
        ? '# Calliope-Fallback\nprint("Hallo Calliope!")\n'
        : '# Turtle-Fallback\nforward(100)\nright(90)\nforward(100)\n',
      kind: isCalliope ? 'calliope' : 'turtle'
    });
  }

  examples = list;
}

// ------- Modal-Rendering -------
function showExamples() {
  if (!examplesModalElement) return;

  // Titel je nach Modus
  const isCalliope = examples.some(e => e.kind === 'calliope');
  if (examplesModalTitle) {
    examplesModalTitle.textContent = isCalliope ? '📚 Calliope-Beispiele' : '📚 Turtle-Beispiele';
  }

  examplesGrid.innerHTML = "";
  selectedExample = null;
  if (loadExampleBtn) loadExampleBtn.disabled = true;

  if (!isCalliope) {
    // Grid mit Bildern (Turtle)
    examples.forEach((ex, index) => {
      const cardHtml = `
        <div class="col-6 col-md-4 col-lg-3">
          <div class="example-card" data-example="${index}">
            <img src="${ex.image}"
                 alt="${ex.name}"
                 class="example-image"
                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkJpbGQgbmljaHQgZ2VmdW5kZW48L3RleHQ+PC9zdmc+'">
            <div class="example-title">${ex.name}</div>
          </div>
        </div>
      `;
      examplesGrid.insertAdjacentHTML('beforeend', cardHtml);
    });
  } else {
    // Einspaltige Liste (Calliope)
    const listHtml = `
      <div class="col-12">
        <ul class="list-group" id="calliope-list">
          ${examples.map((ex, idx) => `
            <li class="list-group-item d-flex align-items-center justify-content-between" data-example="${idx}">
              <span>${ex.name}</span>
              <button class="btn btn-sm btn-outline-primary pick-example" data-example="${idx}">Auswählen</button>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
    examplesGrid.insertAdjacentHTML('beforeend', listHtml);
  }

  // Auswahl-Interaktion
  if (!isCalliope) {
    document.querySelectorAll('.example-card').forEach(card => {
      card.addEventListener('click', function() {
        document.querySelectorAll('.example-card').forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        selectedExample = parseInt(this.dataset.example, 10);
        loadExampleBtn.disabled = false;
      });
    });
  } else {
    document.querySelectorAll('.pick-example').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        selectedExample = parseInt(this.dataset.example, 10);
        // Visuell markieren
        document.querySelectorAll('#calliope-list .list-group-item').forEach(li => li.classList.remove('active'));
        this.closest('li')?.classList.add('active');
        loadExampleBtn.disabled = false;
      });
    });
  }

  // Modal anzeigen (manuell, wie bisher)
  examplesModalElement.style.display = 'block';
  examplesModalElement.classList.add('show');
  document.body.classList.add('modal-open');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop fade show';
  backdrop.id = 'examples-backdrop';
  document.body.appendChild(backdrop);
}


    function showLicenses() {
        console.log("showLicenses() aufgerufen");
        const licensesModal = document.getElementById('licensesModal');
        if (licensesModal) {
            licensesModal.style.display = 'block';
            licensesModal.classList.add('show');
            document.body.classList.add('modal-open');
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            backdrop.id = 'licenses-backdrop';
            document.body.appendChild(backdrop);
        } else {
            console.error("Lizenzen-Modal nicht gefunden!");
        }
    }

    function showImpressum() {
        console.log("showImpressum() aufgerufen");
        const impressumModal = document.getElementById('impressumModal');
        if (impressumModal) {
            impressumModal.style.display = 'block';
            impressumModal.classList.add('show');
            document.body.classList.add('modal-open');
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            backdrop.id = 'impressum-backdrop';
            document.body.appendChild(backdrop);
        } else {
            console.error("Impressum-Modal nicht gefunden!");
        }
    }

    loadExampleBtn.addEventListener("click", async function() {
        if (selectedExample === null) return;

        try {
            const example = examples[selectedExample];
            // Verwende den bereits geladenen Code (kein fetch mehr nötig)
            const code = example.code || "";
            if (window.editor && code) {
                window.editor.setValue(code);
                outEl.innerHTML += `<br>📁 Beispiel "${example.name}" geladen<br>`;
            } else {
                outEl.innerHTML += `<br>❌ Kein Code für "${example.name}" verfügbar<br>`;
            }
            examplesModalElement.style.display = 'none';
            examplesModalElement.classList.remove('show');
            document.body.classList.remove('modal-open');
            const backdrop = document.getElementById('examples-backdrop');
            if (backdrop) backdrop.remove();
        } catch (error) {
            console.error("Fehler beim Laden des Beispiels:", error);
            outEl.innerHTML += `<br>❌ Fehler beim Laden des Beispiels: ${error.message}<br>`;
        }
    });

    // Close-Button Events für Beispiele-Modal
    const modalCloseButtons = document.querySelectorAll('#examplesModal .btn-close, #examplesModal .btn-secondary');
    modalCloseButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            examplesModalElement.style.display = 'none';
            examplesModalElement.classList.remove('show');
            document.body.classList.remove('modal-open');
            const backdrop = document.getElementById('examples-backdrop');
            if (backdrop) backdrop.remove();
        });
    });

    // Close-Button Events für Lizenzen-Modal
    const licensesModalCloseButtons = document.querySelectorAll('#licensesModal .btn-close, #licensesModal .btn-secondary');
    licensesModalCloseButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const licensesModal = document.getElementById('licensesModal');
            if (licensesModal) {
                licensesModal.style.display = 'none';
                licensesModal.classList.remove('show');
                document.body.classList.remove('modal-open');
                const backdrop = document.getElementById('licenses-backdrop');
                if (backdrop) backdrop.remove();
            }
        });
    });

    // Close-Button Events für Impressum-Modal
    const impressumModalCloseButtons = document.querySelectorAll('#impressumModal .btn-close, #impressumModal .btn-secondary');
    impressumModalCloseButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const impressumModal = document.getElementById('impressumModal');
            if (impressumModal) {
                impressumModal.style.display = 'none';
                impressumModal.classList.remove('show');
                document.body.classList.remove('modal-open');
                const backdrop = document.getElementById('impressum-backdrop');
                if (backdrop) backdrop.remove();
            }
        });
    });

})(); // IIFE Ende
