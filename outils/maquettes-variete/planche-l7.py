"""
PLANCHES DU LOT L7 (animations des objets d'étape) : une planche par groupe d'objets ; pour chaque objet, une rangée
par animation (0 = v4, 1, 2) et une vignette par instant (entrée des pièces, milieu, posé), recadrée sur l'objet.
Usage (racine du dépôt), après rendre-l7.mjs : python3 outils/maquettes-variete/planche-l7.py l7a
(groupe décrit par outils/maquettes-variete/l7/l7a.json : instants et noms des animations de chaque objet)
Sortie : outils/maquettes-variete/sortie/l7/<groupe>.jpg
"""
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

D = os.path.join("outils", "maquettes-variete", "sortie", "l7")
FOND = (244, 239, 231)
ENCRE = (21, 16, 12)
ORANGE = (194, 83, 42)
GRIS = (138, 124, 110)
CADRE = (40, 740, 1040, 1740)  # zone de l'objet dans l'écran 1080 × 1920
V = 280
MARGE = 18
ETIQ = 280



def police(taille):
    for nom in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "arialbd.ttf"]:
        try:
            return ImageFont.truetype(nom, taille)
        except OSError:
            pass
    return ImageFont.load_default()


def planche(groupe):
    g = json.load(open(os.path.join("outils", "maquettes-variete", "l7", f"{groupe}.json"), encoding="utf-8"))
    objets = list(g)
    rangs = [(o, a) for o in objets for a in (0, 1, 2)]
    l = ETIQ + 3 * (V + MARGE) + MARGE
    h = 70 + len(rangs) * (V + MARGE) + len(objets) * 20
    im = Image.new("RGB", (l, h), FOND)
    d = ImageDraw.Draw(im)
    d.text((MARGE, 18), f"L7 · {groupe} — chaque objet : anim 0 (v4), 1, 2 ; trois instants", fill=ENCRE, font=police(24))
    y = 70
    for o in objets:
        for a in (0, 1, 2):
            nom = g[o]["noms"][a]
            d.text((MARGE, y + 10), o, fill=ENCRE, font=police(19))
            d.text((MARGE, y + 40), f"anim {a} · " + " / ".join(f"{i / 25:.2f}s" for i in g[o]["instants"]), fill=ORANGE if a else GRIS, font=police(15))
            for k, ligne in enumerate(couper(nom, 18)):
                d.text((MARGE, y + 70 + 24 * k), ligne, fill=GRIS, font=police(16))
            for j, i in enumerate(g[o]["instants"]):
                v = Image.open(os.path.join(D, "brut", f"{o}-a{a}-i{i}.jpg")).convert("RGB").crop(CADRE).resize((V, V), Image.LANCZOS)
                im.paste(v, (ETIQ + j * (V + MARGE), y))
            y += V + MARGE
        y += 20
    im.save(os.path.join(D, f"{groupe}.jpg"), quality=86)
    print(os.path.join(D, f"{groupe}.jpg"), im.size)


def couper(t, n):
    mots, lignes, cour = t.split(), [], ""
    for m in mots:
        if len(cour) + len(m) + 1 > n and cour:
            lignes.append(cour)
            cour = m
        else:
            cour = f"{cour} {m}".strip()
    return lignes + ([cour] if cour else [])


if __name__ == "__main__":
    planche(sys.argv[1])
