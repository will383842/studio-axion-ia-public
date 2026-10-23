"""
Mesure de REMPLISSAGE (standard 74, § 2 bis) : part de la hauteur utile occupée par du contenu, hors zones protégées
et hors bande des sous-titres. Usage : python3 -I remplissage.py <dossier-rendus> [noms…]  (sans nom : toutes les images)
- 9:16 (1080 × 1920) : hauteur utile = y 230 → 1536 (0,12 → 0,80), moins la bande des sous-titres 1152 → 1286.
- 4:5 (1080 × 1350) : hauteur utile = y 54 → 1215, moins la bande des sous-titres 1042 → 1176.
Une rangée de pixels est « occupée » si au moins 1,5 % de sa largeur (x 43 → 1037) s'écarte nettement (> 24 sur un canal)
du fond local (flou large de 41 px) : les bords d'un objet, d'une lettre, d'un trait comptent ; un fond uni, une lueur
ou le grain ne comptent pas. Seuils : ≥ 60 % des rangées utiles occupées ET plus grand trou continu ≤ 15 % de la hauteur utile.
"""
import os, sys
from PIL import Image, ImageChops, ImageFilter

def mesure(chemin):
    im = Image.open(chemin).convert("RGB")
    L, H = im.size
    if H >= 1900: utile, bande = (230, 1536), (1152, 1286)
    else: utile, bande = (54, 1215), (1042, 1176)
    fond = im.filter(ImageFilter.BoxBlur(41))
    ecart = ImageChops.difference(im, fond).convert("L").point(lambda v: 255 if v > 24 else 0)
    px = ecart.crop((43, 0, L - 43, H)).load()
    lu = L - 86
    rangs, occ, trou, trou_max = 0, 0, 0, 0
    for y in range(*utile):
        if bande[0] <= y < bande[1]: continue
        rangs += 1
        n = sum(1 for x in range(0, lu, 2) if px[x, y]) * 2
        if n >= 0.015 * lu: occ += 1; trou = 0
        else: trou += 1; trou_max = max(trou_max, trou)
    return occ / rangs, trou_max / rangs

if __name__ == "__main__":
    d = sys.argv[1]
    noms = sys.argv[2:] or sorted(f[:-4] for f in os.listdir(d) if f.endswith(".jpg"))
    for n in noms:
        p, t = mesure(os.path.join(d, n + ".jpg"))
        print(f"{n:14s} remplissage {p*100:5.1f} %  plus grand trou {t*100:5.1f} %  {'OK' if p >= 0.6 and t <= 0.15 else 'NON'}")
