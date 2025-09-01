# # NimSpiel
# 
# - Auf dem Tisch liegen einige Münzen (hier als Beispiel 5 Münzen). 
# - Derjenige Spieler, der am Zug ist, darf einige Münzen (hier im Beispiel maximal 2 Münzen) vom Tisch nehmen. Danach ist der jeweils andere Spieler am Zug.
# - Es gewinnt derjenige, der die letzte(n) Münze(n) vom Tisch nimmt.

from random import choice


# ## Globale Einstellungen

'''
    Globale Einstellungen:
    
    anzahlMuenzen (vom Nutzer änderbar)
    maxNim (vom Nutzer änderbar)
'''
anzahlMuenzen = 5
maxNim = 2


# ### Hilfsfunktionen und Variablen

# ##### Spielzustand

spielZustand = {
    "computerStartet": False,
    "computerZieht": False,
    "letzterGemachterZug": None,
    "aktuelleSituation": anzahlMuenzen,
    "rundeBeendet": False,
    }


def zeigeSpielZustand():
    '''
        Alle Werte, die den Spielzustand beschreiben,
        werden ausgegeben.
    '''
    for name, value in spielZustand.items():
        print(f"{name}: {str(value)}")


# #### Das Gedächtnis des Computers

# Hier merkt der Computer sich, welcher Zug in einer der 5 möglichen Situationen bisher noch nicht als Verlustzug erkannt wurde.

sinnvolleZuege = {}


def initGedaechtnis ():
    '''
        Es ist ein Dictionary, das für jede Situation angibt, welche Züge (noch) sinnvoll sind.
    '''
    for i in range (1,anzahlMuenzen+1):
        sinnvolleZuege[i] = [x for x in range(1, i+1) if x <= maxNim]


def zeigeGedaechtnis():
    '''
        Das oben beschriebene Gedächtnis des Computers wird angezeigt.
    '''
    if spielZustand["letzterGemachterZug"] == None:
        mySit = 0
        myMove = 0
    else:
        mySit, myMove = spielZustand["letzterGemachterZug"]
    
    for sit, zuege in sinnvolleZuege.items():
        if sit != mySit:
            rest = ""
        else:
            rest = "Gezogen " + str(myMove)
        
        if sit == spielZustand["aktuelleSituation"]:
            print(f"* Für {sit} Münze(n): {zuege}; {rest}")
        else:
            print(f"  Für {sit} Münze(n): {zuege}; {rest}")


# #### Ein Zufallszug für den Computer

def zufallszugComputer(situation):
    '''
        Aus der Menge der möglichen Züge, die für die jeweilige Situation im Gedächtnis zu finden sind,
        wird per Zufall ein Zug ausgewählt.
    '''
    return choice(sinnvolleZuege[situation])


# #### Ein Zufallszug für den Gegner

def zufallszugGegner(situation):
    '''
        Ein möglicher Zufallszug wird ausgewählt.
    '''
    return choice([x for x in range (1,situation + 1) if x <= maxNim])


# #### Das Spiel komplett neu starten


def newGame():
    ''' 
        Alle Werte werden mit initialen Werten belegt.
    '''
    print("Ein neues Spiel beginnt!")
    spielZustand["computerStartet"] = False
    spielZustand["computerZieht"] = False
    spielZustand["letzterGemachterZug"] = None
    spielZustand["aktuelleSituation"] = 5
    spielZustand["rundeBeendet"] = False
    initGedaechtnis()


# #### Eine neue Runde starten

def newRound():
    '''
        Das recht, in der neuen Runde zu starten, wechselt.
    '''
    print("+++++++++ Eine neue Runde beginnt! +++++++++")
    spielZustand["computerStartet"] = not spielZustand["computerStartet"]
    spielZustand["computerZieht"] = spielZustand["computerStartet"]
    spielZustand["letzterGemachterZug"] = None
    spielZustand["aktuelleSituation"] = 5
    spielZustand["rundeBeendet"] = False


# ### Der Gegner zieht

def gegnerZieht():
    anzahl = zufallszugGegner(spielZustand["aktuelleSituation"])
    print(f"Gegner nimmt  {anzahl} Münze(n)")
    spielZustand["aktuelleSituation"] -= anzahl
    
    if spielZustand["aktuelleSituation"] == 0: # Gegner hat gewonnen, Computer verloren
        spielZustand["rundeBeendet"] = True
        print("Gegner hat gewonnen! Gedächtnis am Ende dieser Runde:")
        
        # der letzte Zug war nicht gut!
        if spielZustand["letzterGemachterZug"] != None:
            (situation, zug) = spielZustand["letzterGemachterZug"]
            sinnvolleZuege[situation].remove(zug)
            spielZustand["letzterGemachterZug"] = None
        
        zeigeGedaechtnis()
        spielZustand["rundeBeendet"] = True
    else:
        spielZustand["computerZieht"] = True


# ### Der Computer zieht

def computerZieht():
    if sinnvolleZuege[spielZustand["aktuelleSituation"]] == []: 
        # Es ist also kein sinnvoller Zug mehr möglich
        print("Computer Gibt auf! Das derzeitige Gedächtnis:")
        
        # der letzte Zug sollte nicht erneut gemacht werden!
        if spielZustand["letzterGemachterZug"] != None:
            # Es gibt einen letzten Zug
            (situation, zug) = spielZustand["letzterGemachterZug"]
            sinnvolleZuege[situation].remove(zug)
            spielZustand["letzterGemachterZug"] = None
        
        zeigeGedaechtnis()
        spielZustand["rundeBeendet"] = True
    else:        
        # jetzt tatsächlich ziehen
        anzahl = zufallszugComputer(spielZustand["aktuelleSituation"])
        print(f"Computer nimmt  {anzahl} Münze(n)")
        
        # merke mir, dass ich in der aktuellen Situation diesen Zug gamacht habe
        spielZustand["letzterGemachterZug"] = (spielZustand["aktuelleSituation"], anzahl)
        spielZustand["aktuelleSituation"] -= anzahl
        
        if spielZustand["aktuelleSituation"] == 0: #Computer hat gewonnen
            print("Computer hat gewonnen")
            print("Gedächtnis am Ende dieser Runde:")
            zeigeGedaechtnis()
            spielZustand["rundeBeendet"] = True
        else:
            print("Jetzt ist mein Gedächtnis:")
            zeigeGedaechtnis()
            spielZustand["computerZieht"] = False


def eineRunde():
    while not spielZustand["rundeBeendet"]:
        if spielZustand["computerZieht"]:
            print("----- Computer zieht! -------")
            computerZieht()
        else:
            print("----- Gegner zieht! ---------")
            gegnerZieht()


def vieleRunden(anzahl):
    newGame()
    for _ in range(anzahl):
        eineRunde()
        newRound()


# z.B. spielen wir einmal 20 Runden:
vieleRunden(20)