from turtle import *
# Beschreibe diese Funktion …
def neck(n, laenge):
  repeat int(n):
    forward(100)
    right(360 / n)

initTurtle()
penUp()
setPos(-190,-80)
penDown()
neck(8, 150)
neck(6, 150)
neck(4, 150)
neck(3, 150)
