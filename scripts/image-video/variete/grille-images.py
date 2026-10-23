"""Planche de toutes les images extraites d'une vidéo (répétition générale) : python3 -I grille-images.py <sortie.jpg> <dossier-images> <nom> <dossier-polices>."""
import sys, os, re
from PIL import Image, ImageDraw, ImageFont
sortie, dossier, nom = sys.argv[1:4]
pol = sys.argv[4]
fs = sorted([f for f in os.listdir(dossier) if f.startswith(nom + "-") and f.endswith(".jpg")], key=lambda f: float(f[len(nom)+1:-4].replace("_", ".")))
ims = [Image.open(os.path.join(dossier, f)) for f in fs]
w = 270; h = round(ims[0].height * w / ims[0].width); col = 8; g = 10; leg = 34
rows = (len(ims) + col - 1) // col
p = Image.new("RGB", (col * (w + g) + g, rows * (h + g + leg) + g + 60), (244, 239, 231))
d = ImageDraw.Draw(p); f = ImageFont.truetype(os.path.join(pol, "Inter-Bold.ttf"), 24); t = ImageFont.truetype(os.path.join(pol, "Anton-Regular.ttf"), 40)
d.text((g, 8), nom.upper(), font=t, fill=(21, 16, 12))
for i, (fn, im) in enumerate(zip(fs, ims)):
    x = g + (i % col) * (w + g); y = 60 + g + (i // col) * (h + g + leg)
    d.text((x, y), fn[len(nom)+1:-4].replace("_", ",") + " s", font=f, fill=(194, 83, 42))
    p.paste(im.resize((w, h), Image.LANCZOS), (x, y + leg))
p.save(sortie, quality=82)
