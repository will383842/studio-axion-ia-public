"""
Planche « vidéos tirées au sort » : une RANGÉE par vidéo (sa recette en légende), les MÊMES moments en colonnes.
Usage : python3 -I tirages.py <sortie.jpg> <dossier-rendus> "<Moment 1>,<Moment 2>,…" "Vidéo 1|OUV-C · REC-C · …|img1,img2,…" …
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

POL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../../../studio-rendu/compositions/commune/polices")
IVOIRE, ENCRE, ORANGE = (244, 239, 231), (21, 16, 12), (194, 83, 42)
f = lambda n, t: ImageFont.truetype(os.path.join(POL, n), t)

sortie, dossier, moments = sys.argv[1], sys.argv[2], sys.argv[3].split(",")
rangs = [s.split("|") for s in sys.argv[4:]]
lv, hv, gout, marge, gauche, haut = 300, 533, 24, 40, 330, 210
L = gauche + len(moments) * (lv + gout) + marge
H = haut + len(rangs) * (hv + gout + 20) + marge
p = Image.new("RGB", (L, H), IVOIRE)
d = ImageDraw.Draw(p)
d.text((L / 2, 60), "3 VIDÉOS TIRÉES AU SORT · MÊMES MOMENTS", font=f("Anton-Regular.ttf", 60), fill=ENCRE, anchor="mm")
for j, m in enumerate(moments):
    d.text((gauche + j * (lv + gout) + lv / 2, 160), m, font=f("Inter-Bold.ttf", 30), fill=ENCRE, anchor="mm")
for i, (nom, recette, imgs) in enumerate(rangs):
    y = haut + i * (hv + gout + 20)
    d.text((marge, y + 40), nom.upper(), font=f("Anton-Regular.ttf", 54), fill=ORANGE)
    for k, ligne in enumerate(recette.split(" · ")):
        d.text((marge, y + 130 + k * 40), ligne, font=f("Inter-Bold.ttf", 30), fill=ENCRE)
    for j, img in enumerate(imgs.split(",")):
        im = Image.open(os.path.join(dossier, img + ".jpg")).convert("RGB")
        im = im.resize((lv, round(im.height * lv / im.width)), Image.LANCZOS).crop((0, 0, lv, hv))
        x = gauche + j * (lv + gout)
        m = Image.new("L", im.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, lv - 1, hv - 1), radius=12, fill=255)
        d.rounded_rectangle((x - 3, y - 3, x + lv + 2, y + hv + 2), radius=14, fill=(214, 204, 190))
        p.paste(im, (x, y), m)
q = 88
while True:
    p.save(sortie, "JPEG", quality=q, optimize=True, progressive=True)
    if os.path.getsize(sortie) < 1_900_000 or q <= 50: break
    q -= 6
print(f"{sortie} : {p.width}×{p.height}, {os.path.getsize(sortie)//1024} Ko")
