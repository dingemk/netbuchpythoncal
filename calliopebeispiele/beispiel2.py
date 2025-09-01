# Messen der Helligkeit

import calliope_mini as CM

while not CM.button_b.was_pressed():
    if CM.button_a.was_pressed():
        light = CM.display.read_light_level()
        fstr = "{:} ".format(light)
        CM.display.scroll(fstr, loop=True, wait=False)
CM.display.clear()

