# hex_creator.py
import os
import subprocess

def create_hex_from_python(python_file, output_hex=None):
    if output_hex is None:
        output_hex = python_file.replace('.py', '.hex')
    
    try:
        # Versuche uflash zu verwenden
        result = subprocess.run(['uflash', python_file, '--output', output_hex], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"HEX-Datei erfolgreich erstellt: {output_hex}")
        else:
            print(f"Fehler: {result.stderr}")
            
    except FileNotFoundError:
        print("uflash nicht gefunden. Bitte installieren: pip install uflash")

# Beispiel verwenden
create_hex_from_python('main.py')