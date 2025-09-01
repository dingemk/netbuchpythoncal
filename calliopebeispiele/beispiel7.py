# Töne erzeugen und Tonfolgen abspielen

import music

tonfolge = [262, 294, 330, 349, 392, 392, 
            0, 440, 440, 440, 440, 392]
for ton in tonfolge:
    music.pitch(ton, 500)
 