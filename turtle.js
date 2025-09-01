// turtle-blocks.js — Browser Turtle (Canvas) with Python-like API + Pyodide export

// ------- Config -------
const TURTLE_SIZE = 20; // visible turtle icon size
const DEFAULT_LINE_WIDTH = 1; // default pen width
const CANDIDATE_CANVAS_IDS = ["canvas", "myCanvas"]; // will pick the first that exists

// ------- State -------
let canvas,
  ctx,
  cssW = 0,
  cssH = 0,
  dpr = 1;
let x = 0,
  y = 0; // turtle coords (centered coordinate system)
let heading = 0; // 0 = north, 90 = east, 180 = south, 270 = west
let penDown = true;
let turtleVisible = true;
let paths = []; // list of path segments
let current; // current segment
let strokeColor = "#000000";
let fillColor = "#000000";
let filling = false;
let turtleImg = null;
let activeFill = null;
let fontSize = 16; // default font size for text

// Ready helper (for async registration)
let _readyResolve;
const turtleReady = new Promise((res) => (_readyResolve = res));

// ------- Init -------
function pickCanvas() {
  for (const id of CANDIDATE_CANVAS_IDS) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function setupCanvasResolution() {
  dpr = window.devicePixelRatio || 1;
  // prefer CSS size; fallback to attributes; final fallback to 800x400
  cssW = canvas.clientWidth || canvas.width || 800;
  cssH = canvas.clientHeight || canvas.height || 400;

  canvas.width = Math.max(1, Math.floor(cssW * dpr));
  canvas.height = Math.max(1, Math.floor(cssH * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // map logical units to CSS pixels

  console.log("Canvas-Auflösung aktualisiert:", cssW, "x", cssH);
}

function initTurtle(force = true) {
  if (current && !force) return;
  canvas = pickCanvas();

  if (!canvas) {
    console.warn(
      "[turtle] No canvas with id 'canvas' or 'myCanvas' found yet."
    );
    return; // will retry on ensureInit()
  }
  ctx = canvas.getContext("2d");

  setupCanvasResolution();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Alle Pfade löschen - das ist der wichtige Teil!
  paths = [];
  current = null;

  // logical origin in center
  x = 0;
  y = 0;
  heading = 0;
  penDown = true;
  turtleVisible = true;
  strokeColor = "#000";
  fillColor = "#000";
  filling = false;

  // load turtle image (once)
  if (!turtleImg) {
    turtleImg = new Image();
    turtleImg.src = "turtle.png";
    turtleImg.onload = () => draw();
  }

  // start first path
  newPath();
  draw();
  if (_readyResolve) _readyResolve();
}

function ensureInit() {
  if (!current) initTurtle();
  return !!current;
}

document.addEventListener("DOMContentLoaded", () => initTurtle());

// ------- Geometry Helpers -------
function toCanvasX(xu) {
  return cssW / 2 + xu;
}
function toCanvasY(yu) {
  return cssH / 2 - yu;
}
function rad(deg) {
  return (deg * Math.PI) / 180;
}

// ------- Path Handling -------
function newPath() {
  current = {
    down: penDown,
    stroke: strokeColor,
    lineWidth: DEFAULT_LINE_WIDTH,
    fontsize: fontSize,
    fill: filling,
    fillstyle: fillColor,
    points: [], // {x, y, r} if r>0 -> dot/circle element
  };
  // start at current pen position
  current.points.push({ x: toCanvasX(x), y: toCanvasY(y), r: 0 });
  paths.push(current);
}

function commitStyleToNewPath() {
  // start a new segment to apply current styles (stroke, width, fill state)
  const prevLW = current?.lineWidth ?? DEFAULT_LINE_WIDTH;
  const seg = {
    down: penDown,
    stroke: strokeColor,
    lineWidth: prevLW,
    fontsize: fontSize,
    fill: filling,
    fillstyle: fillColor,
    points: [],
  };

  // Debug: Zeige was passiert

  seg.points.push({ x: toCanvasX(x), y: toCanvasY(y), r: 0 });
  paths.push(seg);
  current = seg;
}

// ------- Drawing -------
function drawPaths() {
  for (const p of paths) {
    if (!p.points.length) continue;

    ctx.beginPath();

    for (let i = 0; i < p.points.length; i++) {
      const pt = p.points[i];

      // Text separat rendern (kein Teil des Canvas-Pfads)
      if (pt.text && pt.text !== "") {
        ctx.font = `${p.fontsize}px Arial`;
        ctx.fillStyle = p.fillstyle;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(pt.text, pt.x, pt.y);
        continue;
      }

      if (pt.r && pt.r > 0) {
        // Kreis/Punkt
        if (i === 0) ctx.moveTo(pt.x + pt.r, pt.y);
        ctx.arc(pt.x, pt.y, pt.r, 0, 2 * Math.PI);
      } else if (p.down) {
        // zeichnender Pfad
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      } else {
        // Stift oben → nur bewegen
        ctx.moveTo(pt.x, pt.y);
      }
    }

    // Styles setzen
    ctx.strokeStyle = p.stroke;
    ctx.lineWidth = p.lineWidth;

    // Nur Füll-Pfade schließen + füllen
    if (p.fill) {
      ctx.closePath();   // schließt Polygon, damit Füllen korrekt ist
      ctx.fillStyle = p.fillstyle;
      ctx.fill();
    }

    // Linien zeichnen (ohne closePath → keine Diagonal-Schlusslinie)
    if (p.down) {
      ctx.stroke();
    }
    // KEIN ctx.closePath() hier!
  }
}

function drawTurtle() {
  if (!turtleVisible || !turtleImg || !turtleImg.complete) return;
  ctx.save();
  // Note: canvas Y increases downward; our heading is mathematical (0° points east, +CCW)
  ctx.translate(toCanvasX(x), toCanvasY(y));

  ctx.rotate(rad(heading)); // negate to match screen coords
  ctx.drawImage(
    turtleImg,
    -TURTLE_SIZE / 2,
    -TURTLE_SIZE / 2,
    TURTLE_SIZE,
    TURTLE_SIZE
  );
  ctx.restore();
}

function draw() {
  if (!ensureInit()) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height); // device pixels
  drawPaths();
  drawTurtle();
}

// Funktion zum Neuziechnen aller Pfade nach Canvas-Resize
function redrawAllPaths() {
  if (!canvas || !ctx) {
    console.log("Canvas oder Kontext nicht verfügbar");
    return;
  }

  console.log("Zeichne alle Pfade neu nach Canvas-Resize");
  console.log("Anzahl Pfade:", paths.length);

  // Canvas-Auflösung aktualisieren
  setupCanvasResolution();

  // Alle Pfade mit neuen Koordinaten neu zeichnen
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (paths.length > 0) {
    drawPaths();
    console.log("Pfade neu gezeichnet");
  } else {
    console.log("Keine Pfade zum Zeichnen vorhanden");
  }

  drawTurtle();
}

// Globale Funktion für externe Aufrufe
window.turtleRedraw = redrawAllPaths;

// Funktion zum Löschen aller Pfade
function clearAllPaths() {
  if (!canvas || !ctx) {
    console.log("Canvas oder Kontext nicht verfügbar");
    return;
  }

  console.log("Lösche alle Pfade...");

  // Alle Pfade löschen
  paths = [];
  current = null;

  // Turtle zur Mitte zurücksetzen
  x = 0;
  y = 0;
  heading = 0;

  // Canvas leeren
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Neuen Pfad starten
  newPath();

  // Turtle zeichnen
  drawTurtle();

  console.log("Alle Pfade gelöscht, Turtle zur Mitte zurückgesetzt");
}

// Globale Funktion zum Löschen aller Pfade
window.clearAllPaths = clearAllPaths;

// ------- API (English, near Python turtle) -------
function forward(dist) {
  if (!ensureInit()) return;
  // Für 0°=Norden gilt: mathematischer Winkel = (90 - heading)
  const rad = (Math.PI / 180) * (90 - heading);
  const nx = x + dist * Math.cos(rad);
  const ny = y + dist * Math.sin(rad);

  // Debug: Zeige aktuelle Farbe
  // Stelle sicher, dass current die aktuelle Farbe hat
  if (current.stroke !== strokeColor) {
    current.stroke = strokeColor;
  }

  current.points.push({ x: toCanvasX(nx), y: toCanvasY(ny), r: 0 });
  if (filling && activeFill) {
    activeFill.points.push({ x: toCanvasX(nx), y: toCanvasY(ny), r: 0 });
  }
  x = nx;
  y = ny;
  draw();
}

function backward(dist) {
  forward(-dist);
}

const normDeg = (a) => ((a % 360) + 360) % 360;

function right(angle) {
  if (!ensureInit()) return;
  heading = normDeg(heading + angle);
  draw();
}
function left(angle) {
  if (!ensureInit()) return;
  heading = normDeg(heading - angle);
  draw();
}
function setheading(a) {
  if (!ensureInit()) return;
  heading = normDeg(a);
  draw();
}

function penup() {
  if (!ensureInit()) return;
  penDown = false;
  commitStyleToNewPath();
}
function pendown() {
  if (!ensureInit()) return;
  penDown = true;
  commitStyleToNewPath();
}
const pu = penup,
  pd = pendown;

function goto_(px, py) {
  // internal
  if (!ensureInit()) return;
  x = Number(px);
  y = Number(py);
  current.points.push({ x: toCanvasX(x), y: toCanvasY(y), r: 0 });
  if (filling && activeFill) {
    activeFill.points.push({ x: toCanvasX(x), y: toCanvasY(y), r: 0 });
  }
  draw();
}

// Neue setPos Funktion - bewegt Turtle ohne zu zeichnen und ohne Richtung zu ändern
// ersetzt deine setPos-Version
function setPos(px, py) {
  if (!ensureInit()) return;
  x = Number(px);
  y = Number(py);

  // neues, nicht zeichnendes Segment am Teleport-Punkt beginnen
  const seg = {
    down: false,
    stroke: strokeColor,
    lineWidth: current?.lineWidth ?? DEFAULT_LINE_WIDTH,
    fontsize: fontSize,
    fill: false,
    fillstyle: fillColor,
    points: [{ x: toCanvasX(x), y: toCanvasY(y), r: 0 }],
  };
  current = seg;
  paths.push(seg);

  draw();
}
// Neue moveto Funktion - zeichnet entsprechend der Stiftlage und richtet Turtle aus
function moveto(px, py) {
  if (!ensureInit()) return;

  const targetX = Number(px);
  const targetY = Number(py);

  // Berechne Richtung von aktueller Position zu Zielposition
  // Turtle: 0° = Norden, 90° = Osten, 180° = Süden, 270° = Westen
  const deltaX = targetX - x;
  const deltaY = targetY - y;

  // Konvertiere von mathematischen Koordinaten (0° = rechts) zu Turtle-Koordinaten (0° = oben)
  let angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
  angle = 90 - angle; // 90° abziehen für Turtle-Koordinaten

  // Setze Turtle in Richtung Zielposition
  heading = normDeg(angle);

  // Bewege Turtle zur Zielposition
  x = targetX;
  y = targetY;

  // Füge Punkt zum aktuellen Pfad hinzu (entsprechend der Stiftlage)
  current.points.push({ x: toCanvasX(x), y: toCanvasY(y), r: 0 });

  // Wenn Füllen aktiv ist, füge auch zum Füllpfad hinzu
  if (filling && activeFill) {
    activeFill.points.push({ x: toCanvasX(x), y: toCanvasY(y), r: 0 });
  }

  draw();
}

// Neue setX Funktion - ändert nur die X-Position
function setX(px) {
  if (!ensureInit()) return;
  const targetX = Number(px);
  x = targetX;
  draw(); // Nur Turtle neu zeichnen
}

// Neue setY Funktion - ändert nur die Y-Position
function setY(py) {
  if (!ensureInit()) return;
  const targetY = Number(py);
  y = targetY;
  draw(); // Nur Turtle neu zeichnen
}

function gotoFunc(px, py) {
  goto_(px, py);
} // exported as 'goto'


function moveTo(px, py) {
  moveto(px, py);
} // Neue moveto Funktion
function home() {
  goto_(0, 0);
  setheading(0);
}

function clear() {
  if (!ensureInit()) return;
  paths = [];
  newPath();
  draw();
}
function reset() {
  initTurtle(true);
} // full re-init
function init() {
  initTurtle(true);
} // alias für reset

function showturtle() {
  turtleVisible = true;
  draw();
}
function hideturtle() {
  turtleVisible = false;
  draw();
}
const st = showturtle,
  ht = hideturtle;

function color(...args) {
  // turtle.color() accepts 1 arg (stroke & fill) or 2 args (pencolor, fillcolor)
  if (!ensureInit()) return;
  if (args.length === 1) {
    strokeColor = toColorString(args[0]);
    fillColor = strokeColor;
  } else if (args.length == 2) {
    strokeColor = toColorString(args[0]);
    fillColor = toColorString(args[1]);
  }
  commitStyleToNewPath();
  if (filling && activeFill) {
    activeFill.stroke = strokeColor;
    activeFill.fillstyle = fillColor;
  }
}

function pencolor(c) {
  if (!ensureInit()) return;

  const oldColor = strokeColor;

  strokeColor = toColorString(c);

  commitStyleToNewPath();
}

function fillcolor(c) {
  if (!ensureInit()) return;
  fillColor = toColorString(c);

  commitStyleToNewPath();
}

function pensize(w) {
  if (!ensureInit()) return;
  const newLW = Number(w);
  const seg = {
    down: penDown,
    stroke: strokeColor,
    lineWidth: newLW,
    fontsize: fontSize,
    fill: filling,
    fillstyle: fillColor,
    points: [{ x: toCanvasX(x), y: toCanvasY(y), r: 0 }],
  };
  current = seg;
  paths.push(seg);
}
function width(w) {
  pensize(w);
}

function begin_fill() {
  if (!ensureInit()) return;
  if (filling) return;
  filling = true;
  activeFill = {
    down: penDown,
    stroke: "transparent",
    lineWidth: 1,
    fontsize: fontSize,
    fill: true,
    fillstyle: fillColor,
    points: [{ x: toCanvasX(x), y: toCanvasY(y), r: 0 }],
  };
  paths.push(activeFill);
}

function end_fill() {
  if (!ensureInit()) return;
  if (!filling) return;
  activeFill = null;
  filling = false;
  commitStyleToNewPath();
}

function dot(size = 5, c = null) {
  if (!ensureInit()) return;
  const r = Math.max(0.5, Number(size)) / 2;
  const seg = {
    down: false, // Keine Linie zeichnen, nur den Punkt
    stroke: c ? toColorString(c) : strokeColor,
    lineWidth: 1,
    fontsize: fontSize,
    fill: true,
    fillstyle: c ? toColorString(c) : strokeColor,
    points: [],
  };
  seg.points.push({ x: toCanvasX(x), y: toCanvasY(y), r: r }); // Radius explizit setzen
  paths.push(seg);
  draw();
}

function circle(radius, steps = 120) {
  // Approximate circle using polygon; sign of radius sets left/right orientation like turtle
  if (!ensureInit()) return;
  const r = Number(radius);
  const s = Math.max(8, Number(steps) | 0);
  const total = 2 * Math.PI * Math.abs(r);
  const stepLen = total / s;
  const turn = (360 / s) * (r >= 0 ? 1 : -1); // positive radius -> left turns
  for (let i = 0; i < s; i++) {
    forward(stepLen);
    left(turn);
  }
}

// speed is mostly a no-op here; kept for compatibility
function speed(_val = null) {
  /* no-op (we draw immediately) */
}

// Text an der Turtle-Position zeichnen
function label(text) {
  if (!ensureInit()) return;


  // Text direkt zeichnen und dann in den Pfad speichern
  const canvasX = toCanvasX(x);
  const canvasY = toCanvasY(y);

  // Text-Segment für Persistenz erstellen
  const seg = {
    down: false,
    stroke: strokeColor,
    lineWidth: 1,
    fontsize: current?.fontsize ?? fontSize,
    fill: true,
    fillstyle: strokeColor,
    points: [],
  };
  seg.points.push({ x: canvasX, y: canvasY, text: text }); // Platzhalterpunkt
  paths.push(seg);
  draw()
}

// Schriftgröße setzen
function setFontSize(size) {
  if (!ensureInit()) return;
  const newFontSize = Number(size);
  const seg = {
    down: penDown,
    stroke: strokeColor,
    lineWidth: current?.lineWidth ?? DEFAULT_LINE_WIDTH,
    fontsize: newFontSize,
    fill: filling,
    fillstyle: fillColor,
    points: [{ x: toCanvasX(x), y: toCanvasY(y), r: 0 }],
  };
  current = seg;
  paths.push(seg);
}

// RGB zu Hex Konverter (intern)
function rgbToHex(r, g, b) {
  // Stelle sicher, dass die Werte Zahlen sind und im Bereich 0-255 sind
  const clampedR = Math.max(0, Math.min(255, Math.round(Number(r))));
  const clampedG = Math.max(0, Math.min(255, Math.round(Number(g))));
  const clampedB = Math.max(0, Math.min(255, Math.round(Number(b))));

  // Konvertiere zu Hex mit führenden Nullen
  const hexR = clampedR.toString(16).padStart(2, "0");
  const hexG = clampedG.toString(16).padStart(2, "0");
  const hexB = clampedB.toString(16).padStart(2, "0");

  return `#${hexR}${hexG}${hexB}`;
}

// RGB-Array zu Hex Konverter (intern)
function rgbArrayToHex(rgbArray) {
  if (!Array.isArray(rgbArray) || rgbArray.length < 3) {
    return "#000000";
  }

  return rgbToHex(rgbArray[0], rgbArray[1], rgbArray[2]);
}

// helpers
function toColorString(v) {
  if (typeof v === "string") return v;
  if (Array.isArray(v) || (v && typeof v === "object" && v.length === 3)) {
    const [r, g, b] = Array.from(v);
    // Stelle sicher, dass die Werte Zahlen sind
    const result = rgbArrayToHex(Array.from(v));
    return result;
  }

  return "#000";
}

// ------- Expose to JS (optional for debugging) -------
Object.assign(window, {
  forward,
  backward,
  right,
  left,
  penup,
  pendown,
  pu,
  pd,
  goto: gotoFunc,
  setPos,
  setheading,
  home,
  clear,
  reset,
  color,
  pencolor,
  fillcolor,
  begin_fill,
  end_fill,
  pensize,
  width,
  dot,
  circle,
  showturtle,
  hideturtle,
  st,
  ht,
  speed,
  label,
  setFontSize,
});

// ------- Export to Python (Pyodide) -------
window.registerTurtleInPython = async (pyodide) => {
  // make sure canvas is ready
  if (!ensureInit()) await turtleReady;

  const api = {
    // Bewegung & Richtung
    forward,
    backward,
    right,
    left,
    // Stift & Position
    penup,
    pendown,
    pu,
    pd,
    penDown: pendown,
    penUp: penup,
    goto: gotoFunc,
    setPos,
    setpos: setPos,
    moveTo: moveto,
    setheading,
    setHeading: setheading,
    home,
    // Sichtbarkeit
    showTurtle: showturtle,
    hideturtle,
    st,
    ht,
    // Farben/Füllen/Linien
    color,
    pencolor,
    fillcolor,
    begin_fill,
    end_fill,
    pensize,
    width,
    setPenWidth: pensize,
    setPenColor: pencolor,
    setFillColor: fillcolor,
    startPath: begin_fill,
    fillPath: end_fill,
    // Formen
    dot,
    circle,
    // Text
    label,
    setFontSize,
    // Reset/Clear
    clear,
    reset,
    init: reset,
    initTurtle: initTurtle,
    hideTurtle: hideturtle,
    showTurtle: showturtle,
    // Turtle-Bild
    turtleImg: turtleImg,
    // Turtle-Position
    getX: () => x,
    getY: () => y,
    xcor: () => x,
    ycor: () => y,
    // Turtle-Richtung
    heading: () => heading,
  };

  pyodide.registerJsModule("turtle", api);
  pyodide.registerJsModule("jturtle", api);

  console.log("Turtle-API erfolgreich in Pyodide registriert");
};
