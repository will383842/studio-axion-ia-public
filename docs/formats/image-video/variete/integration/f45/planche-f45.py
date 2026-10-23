"""Lot F45 · planche « 9:16 | 4:5 » de la carte C aux mêmes instants (images de rendre-f45.mts).
Usage : python3 -I planche-f45.py <dossier-rendus> <sortie.jpg> [instants…]"""
import os, sys
from PIL import Image, ImageDraw, ImageFont
d, sortie, *ts = sys.argv[1:]
H = 560
police = ImageFont.load_default(size=26) if hasattr(ImageFont, "load_default") else None
paires = []
for t in ts:
    a, b = os.path.join(d, f"9x16-{t}.jpg"), os.path.join(d, f"4x5-{t}.jpg")
    if os.path.exists(a) and os.path.exists(b): paires.append((t, Image.open(a), Image.open(b)))
lw = lambda im: int(im.width * H / im.height)
largeur_paire = lw(paires[0][1]) + lw(paires[0][2]) + 20
cols = 3
rows = (len(paires) + cols - 1) // cols
P = Image.new("RGB", (cols * (largeur_paire + 40) + 40, rows * (H + 60) + 30), (243, 237, 228))
dr = ImageDraw.Draw(P)
for k, (t, a, b) in enumerate(paires):
    x, y = 40 + (k % cols) * (largeur_paire + 40), 30 + (k // cols) * (H + 60)
    dr.text((x, y), f"{float(t):.1f} s   9:16  |  4:5", fill=(21, 16, 12), font=police)
    P.paste(a.resize((lw(a), H)), (x, y + 34)); P.paste(b.resize((lw(b), H)), (x + lw(a) + 20, y + 34))
P.save(sortie, quality=82); print(sortie, P.size)
