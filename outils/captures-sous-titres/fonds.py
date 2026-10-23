"""
Fond « illustration claire » des captures de contrôle (B.5) : le pire cas pour un texte crème — ciel blanc,
route claire, gilet jaune fluo sous la ligne des sous-titres (≈ 25 % du temps chez la référence).
Usage : python outils/captures-sous-titres/fonds.py
"""
from PIL import Image, ImageDraw, ImageFilter
import os

ICI = os.path.dirname(os.path.abspath(__file__))
W, H = 1080, 1920
im = Image.new("RGB", (W, H))
d = ImageDraw.Draw(im)
for y in range(H):
    if y < 820:  # ciel très clair
        t = y / 820
        c = (int(236 + 14 * t), int(242 + 8 * t), int(250 - 4 * t))
    else:  # route claire
        t = (y - 820) / (H - 820)
        c = (int(214 - 30 * t), int(210 - 30 * t), int(204 - 30 * t))
    d.line([(0, y), (W, y)], fill=c)
# Lignes blanches de la route
for k in range(6):
    y = 1000 + k * 160
    d.polygon([(520 - k * 6, y), (560 + k * 6, y), (566 + k * 8, y + 90), (514 - k * 8, y + 90)], fill=(250, 250, 248))
# Gilet jaune fluo au centre, derrière la ligne des sous-titres (48 %)
d.rounded_rectangle((250, 760, 830, 1420), radius=60, fill=(226, 236, 40))
d.rectangle((250, 960, 830, 1010), fill=(235, 235, 235))
d.rectangle((250, 1120, 830, 1170), fill=(235, 235, 235))
d.ellipse((430, 520, 650, 760), fill=(232, 196, 170))
im = im.filter(ImageFilter.GaussianBlur(1.2))
im.save(os.path.join(ICI, "fond-clair.jpg"), quality=90)
print("ok")
