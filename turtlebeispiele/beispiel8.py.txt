from jturtle import *
import random
import math
# Beschreibe diese Funktion …
def wirbel_zeichnen(groesse):
  winkel = 45
  repeat 8:
    spirale_zeichnen(groesse, 15)
    right(winkel)
# Beschreibe diese Funktion …
def spirale_zeichnen(groesse, laenge):
  x_startwert = getX()
  y_startwert = getY()
  alter_kurs = heading()
  spiralarm_zeichnen(groesse, laenge)
  penUp()
  setPos(x_startwert,y_startwert)
  setHeading(alter_kurs)
  penDown()
# Beschreibe diese Funktion …
def spiralarm_zeichnen(groesse, laenge):
  while laenge <= groesse:
    penUp()
    forward(laenge)
    penDown()
    zufallsgroesse = random.randint(5, round(laenge * 0.75))
    setPenColor((random.randint(0,255),random.randint(0,255),random.randint(0,255)))
    dot(zufallsgroesse)
    left(10)
    laenge = laenge * 1.015

initTurtle()
hideTurtle()
wirbel_zeichnen(22)
