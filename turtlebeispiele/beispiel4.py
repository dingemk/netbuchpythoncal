from turtle import *
# Beschreibe diese Funktion …
def quadrat():
  repeat 4:
    forward(40)
    right(90)

initTurtle()
penUp()
setPos(-180,180)
setPenColor('blue')
penDown()
right(90)
repeat 8:
  repeat 8:
    quadrat()
    forward(40)
  backward(320)
  right(90)
  forward(40)
  left(90)
