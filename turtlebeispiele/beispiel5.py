from turtle import *
# Beschreibe diese Funktion …
def kreis():
  repeat 90:
    forward(6)
    right(4)

initTurtle()
setPenColor('green')
repeat 36:
  kreis()
  right(10)
