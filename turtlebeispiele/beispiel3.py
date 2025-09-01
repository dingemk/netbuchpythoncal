from jturtle import *
import math
# Beschreibe diese Funktion …
def segment_zeichnen(r, g, b):
  setFillColor((r,g,b))
  startPath()
  forward(180)
  right(90)
  bogen_zeichnen()
  left(90)
  backward(180)
  fillPath()
# Beschreibe diese Funktion …
def bogen_zeichnen():
  abschnitt = 180 * (2 * (math.pi / 360))
  repeat 45:
    forward(abschnitt)
    right(1)

initTurtle()
segment_zeichnen(0, 0, 0)
segment_zeichnen(255, 0, 0)
segment_zeichnen(255, 255, 0)
segment_zeichnen(0, 255, 0)
segment_zeichnen(0, 255, 255)
segment_zeichnen(0, 0, 255)
segment_zeichnen(255, 0, 255)
segment_zeichnen(255, 255, 255)
