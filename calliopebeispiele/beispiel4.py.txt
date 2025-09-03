# Vordefinierte Melodien abspielen
import calliope_mini as CM
import music

while (CM.pin1.read_analog() > 100 and 
        CM.pin1.read_analog() < 900):
    if CM.button_a.was_pressed():
        music.play(music.JUMP_UP)
    if CM.button_b.was_pressed():
        music.play(music.JUMP_DOWN)
    CM.sleep(100)

