"""
Assemble une PLANCHE JPG (< 2 Mo) : des colonnes côte à côte, chacune = une variante (1 à 3 images empilées),
avec « CODE · nom » sous la colonne. Usage :
  python3 -I planche.py <sortie.jpg> "<titre>" <dossier-rendus> "CODE|Nom court|img1,img2" ["CODE|Nom|img"] ...
Les images sont cherchées dans <dossier-rendus> (nom sans .jpg). 9:16 et 4:5 acceptés (largeur de vignette fixe).
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

POL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../../../studio-rendu/compositions/commune/polices")
IVOIRE, ENCRE, ORANGE, GRIS = (244, 239, 231), (21, 16, 12), (194, 83, 42), (138, 124, 110)

def police(nom, t):
    return ImageFont.truetype(os.path.join(POL, nom), t)

def main():
    sortie, titre, dossier = sys.argv[1:4]
    colonnes = []
    for spec in sys.argv[4:]:
        code, nom, imgs = spec.split("|")
        colonnes.append((code, nom, [Image.open(os.path.join(dossier, i + ".jpg")).convert("RGB") for i in imgs.split(",")]))
    n = len(colonnes)
    lv = 540 if n <= 4 else 440 if n <= 6 else 360
    gout, marge, haut_titre, haut_leg = 28, 48, 150, 120
    def h(im): return round(im.height * lv / im.width)
    hmax = max(sum(h(i) for i in c[2]) + gout * (len(c[2]) - 1) for c in colonnes)
    L = marge * 2 + n * lv + (n - 1) * gout * 2
    H = haut_titre + hmax + haut_leg + marge
    p = Image.new("RGB", (L, H), IVOIRE)
    d = ImageDraw.Draw(p)
    f_t, f_code, f_nom = police("Anton-Regular.ttf", 64), police("Anton-Regular.ttf", 44), police("Inter-Bold.ttf", 30)
    d.text((L / 2, 80), titre.upper(), font=f_t, fill=ENCRE, anchor="mm")
    for k, (code, nom, imgs) in enumerate(colonnes):
        x = marge + k * (lv + gout * 2)
        y = haut_titre
        for im in imgs:
            v = im.resize((lv, h(im)), Image.LANCZOS)
            d.rounded_rectangle((x - 3, y - 3, x + lv + 2, y + v.height + 2), radius=14, fill=(214, 204, 190))
            masque = Image.new("L", v.size, 0)
            ImageDraw.Draw(masque).rounded_rectangle((0, 0, v.width - 1, v.height - 1), radius=12, fill=255)
            p.paste(v, (x, y), masque)
            y += v.height + gout
        yl = haut_titre + hmax + 24
        d.text((x + lv / 2, yl), code, font=f_code, fill=ORANGE, anchor="mt")
        d.text((x + lv / 2, yl + 58), nom, font=f_nom, fill=ENCRE, anchor="mt")
    q = 88
    while True:
        p.save(sortie, "JPEG", quality=q, optimize=True, progressive=True)
        if os.path.getsize(sortie) < 1_900_000 or q <= 50: break
        q -= 6
    print(f"{sortie} : {p.width}×{p.height}, {os.path.getsize(sortie)//1024} Ko (qualité {q})")

main()
