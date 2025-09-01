from turtle import *

initTurtle()
penUp()
setPos(-190,-100)
penDown()
setPenColor('blue')
w = 10
while not w >= 180:
  forward(50)
  right(w)
  w = w + 1
