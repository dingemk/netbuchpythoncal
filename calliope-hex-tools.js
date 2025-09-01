/**
 * Minimal-Tooling für Calliope-HEX:
 *  - appendScriptV1(): fügt main.py nach 0x0003E000 ein (Classic/Calliope 1.x/2.0).
 *  - packMainPyAuto(): versucht erst Dateisystem (für V3 via @microbit/microbit-fs),
 *                      fällt sonst auf appendScriptV1 zurück.
 *
 * Quellen zum Format:
 *  - MicroPython HEX-Layout + "Appended script" Header ("MP", Länge, Bytes) für V1.  // docs
 *  - micro:bit FS-Lib, die auch das Layout/FS lesen/schreiben kann (für CODAL/V3).   // lib
 */

///////////////////////////
// Intel HEX Hilfsfunktionen
///////////////////////////
function toHex2(n){ return n.toString(16).toUpperCase().padStart(2,'0'); }
function toHex4(n){ return n.toString(16).toUpperCase().padStart(4,'0'); }

function checksumByteSum(bytes){
  let sum = 0;
  for(const b of bytes) sum = (sum + (b & 0xFF)) & 0xFF;
  // Zweierkomplement
  return ((~sum + 1) & 0xFF);
}

function makeRecord(address16, recordType, dataBytes){
  const len = dataBytes.length;
  const hi = (address16 >> 8) & 0xFF, lo = address16 & 0xFF;
  const bytes = [len, hi, lo, recordType, ...dataBytes];
  const csum = checksumByteSum(bytes);
  const dataHex = dataBytes.map(toHex2).join('');
  return `:${toHex2(len)}${toHex4(address16)}${toHex2(recordType)}${dataHex}${toHex2(csum)}`;
}

function stripEOF(hexStr){
  return hexStr
    .replace(/\r/g,'')
    .split('\n')
    .filter(l => l.trim() && !/^:00000001FF$/i.test(l.trim()))
    .join('\n');
}

///////////////////////////
// 1) Classic: "Appended script" bei 0x0003E000 (V1-Kompatibel)
///////////////////////////
export function appendScriptV1(baseHex, pythonText){
  // MicroPython V1 "Appended script" Format:
  // 0x0003E000: 'M' 'P' (0x4D 0x50)
  // 0x0003E002: 2 Bytes Länge (little endian, nur der Script-Teil)
  // 0x0003E004: Script als UTF-8 Bytes
  // Quelle/Beleg: MicroPython Devguide "MicroPython Hex File" → Appended script (Deprecated) V1. 
  // (Für Classic-Ports wie Calliope 1.x ist das genau der richtige Mechanismus.)
  // Docs: https://microbit-micropython.readthedocs.io/...  (siehe Zitat) 
  const utf8 = new TextEncoder().encode(pythonText);
  if (utf8.length > 8*1024 - 4) {
    throw new Error("Script zu groß für den 8KB Appended-Script-Bereich (Classic).");
  }
  const header = new Uint8Array(4);
  header[0] = 0x4D; // 'M'
  header[1] = 0x50; // 'P'
  header[2] = utf8.length & 0xFF;
  header[3] = (utf8.length >> 8) & 0xFF;

  // Datenblock ab 0x0003E000:
  const startAddr = 0x0003E000;
  const block = new Uint8Array(header.length + utf8.length);
  block.set(header, 0);
  block.set(utf8, 4);

  // Intel-HEX Records erzeugen: zuerst ELA (Extended Linear Address = 0x0003)
  // Hinweis aus den MicroPython-Dokumenten: Adressen müssen monoton steigen.
  // Wir hängen die neuen Records NACH dem Basis-HEX an. 
  const lines = [];
  const ELA = 0x04;
  const DATA = 0x00;
  const EOF  = ":00000001FF";

  const base = stripEOF(baseHex);
  lines.push(base);

  // Setze Upper 16 Bits auf 0x0003
  const upper = 0x0003;
  const elaData = [ (upper >> 8) & 0xFF, (upper & 0xFF) ];
  lines.push(makeRecord(0x0000, ELA, elaData));

  // Schreibe Daten in 16-Byte Zeilen ab 0xE000 (lower 16 bits)
  const lowBase = startAddr & 0xFFFF;
  const chunkSize = 16;
  for (let off = 0; off < block.length; off += chunkSize){
    const slice = block.slice(off, off + chunkSize);
    lines.push(makeRecord(lowBase + off, DATA, Array.from(slice)));
  }

  // EOF
  lines.push(EOF);
  return lines.join('\n') + '\n';
}

///////////////////////////
// 2) Auto: V3 über Filesystem (falls Lib verfügbar) → sonst Fallback auf V1-Append
///////////////////////////
export async function packMainPyAuto(baseHex, pythonText){
  // Versuche, die micro:bit-FS-Lib dynamisch zu laden (CDN).
  // Sie kann aus einem MicroPython-HEX die FS-Region ermitteln (Layouttabelle/UICR)
  // und Dateien wie 'main.py' einbetten. Für Calliope mini V3 (CODAL-Port)
  // ist das sehr ähnlich wie beim micro:bit V2.
  try {
    const mod = await import("https://cdn.skypack.dev/@microbit/microbit-fs");
    const { MicropythonFsHex } = mod;

    // Initialisiere mit dem bereitgestellten Calliope-V3-MicroPython-HEX:
    const fs = new MicropythonFsHex(baseHex);
    fs.write("main.py", pythonText);
    // Neues HEX mit FS zurückgeben
    return fs.getIntelHex();
  } catch (e){
    // Fallback: Classic-Append (funktioniert auf Calliope 1.x/2.0 und
    // in der Praxis häufig auch bei Ports, die das alte Schema akzeptieren).
    console.warn("FS-Pfad nicht verfügbar – nutze Classic Append:", e);
    return appendScriptV1(baseHex, pythonText);
  }
}

// --- Ein Mini-Demo zum Ausprobieren (kannst du löschen) ---
window.calliopeHexTools = { appendScriptV1, packMainPyAuto };

