# Messen der Betriebstemperatur
import calliope_mini as CM

def showTemperature():
    CM.display.clear()
    temperature = CM.temperature()
    fstr = "{:} ".format(temperature)
    CM.display.scroll(fstr, loop=False, wait=True)

lasttemp = 0
while not CM.button_b.was_pressed():
    temperature = CM.temperature()
    if lasttemp != temperature:
        CM.display.set_pixel(2, 2, 9)
        lasttemp = temperature
    CM.sleep(1000)
    if CM.button_a.was_pressed():
        showTemperature()

CM.display.clear()