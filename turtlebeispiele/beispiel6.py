from jturtle import *
import random

def teilkreis():
  repeat 12:
    forward(20)
    right(10)

def blatt():
  setFillColor((random.randint(0,255),random.randint(0,255),random.randint(0,255)))
  startPath()
  teilkreis()
  right(60)
  teilkreis()
  right(60)
  fillPath()

initTurtle()
repeat 10:
  blatt()
  right(36)
