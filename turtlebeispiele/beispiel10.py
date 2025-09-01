from turtle import *
# Beschreibe diese Funktion …
def baum(laenge):
  if laenge >= 2:
    forward(laenge)
    left(45)
    baum(laenge / 2)
    right(90)
    baum(laenge / 2)
    left(45)
    backward(laenge)

initTurtle()
repeat 6:
  baum(100)
  right(72)
