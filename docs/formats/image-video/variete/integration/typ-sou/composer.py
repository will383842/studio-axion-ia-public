"""Superpose le calque des sous-titres (PNG transparent) sur la scène : <CODE>-1-scene.jpg + <CODE>-1-calque.png → <CODE>-1.jpg.
Usage : python3 -I composer.py <dossier> [CODE…]   (par défaut SOU-B SOU-C)"""
import os, sys
from PIL import Image

d = sys.argv[1]
for code in sys.argv[2:] or ["SOU-B", "SOU-C"]:
    scene = Image.open(os.path.join(d, f"{code}-1-scene.jpg")).convert("RGBA")
    calque = Image.open(os.path.join(d, f"{code}-1-calque.png")).convert("RGBA")
    Image.alpha_composite(scene, calque).convert("RGB").save(os.path.join(d, f"{code}-1.jpg"), quality=90)
    print(f"{code}-1.jpg")
