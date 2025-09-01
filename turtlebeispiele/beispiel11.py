from turtle import *
#Zeichnet einen Balken
def zeichne_balken(x, y, width, height, color):
    setFillColor(color)
    setPenColor("red")
    setPenWidth(2)
    setPos(x, y)
    setHeading(90)
    startPath()
    repeat 2:
        forward(width)
        left(90)
        forward(height)
        left(90)
    fillPath()

#Zeichnet das Histogramm der Note
def zeichne_diagramm(noten):
    hideTurtle()
    setFontSize(30)
    # Berechne Häufigkeiten
    haeufigkeiten = [noten.count(i) for i in range(1, 7)]
    max_haeufigkeit = max(haeufigkeiten)
 
    # Skaliere die Höhe der Balken
    skala = 200 / max_haeufigkeit
    balken_breite = 60
    start_x = -200 
    for i, haeufigkeit in enumerate(haeufigkeiten):
        if haeufigkeit > 0:
            x = start_x + i * balken_breite
            balken_hoehe = haeufigkeit * skala
            zeichne_balken(x, -150, balken_breite, balken_hoehe, "blue")

            # Beschriftung der Balken
            setPos(x + balken_breite/2-10, -180)
            label(str(i+1))
 
            # Häufigkeit über dem Balken
            setPos(x + balken_breite/2 - 10, -150 + balken_hoehe + 20)
            label(str(haeufigkeit))

initTurtle()
print("Notenerfassung für die Klassenarbeit")
print("Geben Sie die Noten ein (1-6). Eingabe von 0 beendet die Erfassung.")
noten = []
note = 1
while not note == 0:
    note = int(input("Note eingeben: "))
    if 1 <= note <= 6:
        noten.append(note)
    else:
        print("Bitte nur Noten zwischen 1 und 6 eingeben!")
        print(noten)
        if noten:
            # Berechne Durchschnitt
            durchschnitt = sum(noten) / len(noten)
 
            # Zeichne Histogramm
            zeichne_diagramm(noten)
 
            # Zeige Durchschnittsnote
            setPenColor("black")
            setPos(-200, 150)
            label(f"Durchschnittsnote: {durchschnitt:.2f}")
        else:
            print("Keine Noten eingegeben!")