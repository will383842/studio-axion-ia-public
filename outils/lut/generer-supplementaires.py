# -*- coding: utf-8 -*-
"""
Fabrique les 3 LUT Axion supplémentaires (C6-H8) dans public/luts/ : terracotta chaud, ivoire doux contrasté,
encre froid neutre. Réutilise les fonctions de generateur-lut-buffer.py SANS l'importer tel quel (il exécute
ses 4 builds au chargement) : on n'exécute que la partie « outils + build », avant le marqueur des réglages.
Usage : python outils/lut/generer-supplementaires.py   (numpy requis ; zéro réseau)
Teintes dans CHARTE_AXION (src/briques/jetons-motion.ts) : ivoire #FAF9F5, noir #141413, terracotta #B23F16.
Aucun turquoise : aucune ombre ne pousse le vert et le bleu ensemble contre le rouge.
"""
import os

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.normpath(os.path.join(ICI, "..", "..", "public", "luts"))
MARQUEUR = "# ---------- reglages"

source = open(os.path.join(ICI, "generateur-lut-buffer.py"), encoding="utf-8").read()
prefixe = source.split(MARQUEUR)[0]
espace = {"__file__": os.path.join(SORTIE, "x.py"), "__name__": "generateur_buffer"}
exec(compile(prefixe, "generateur-lut-buffer.py", "exec"), espace)
build = espace["build"]

ORANGE_TERRE = (+0.050, +0.012, -0.060)   # lumières terracotta / ambre
BRUN_CHAUD = (+0.035, +0.006, -0.035)     # ombres brun chaud
IVOIRE = (+0.030, +0.026, -0.012)         # hautes lumières crème (#FAF9F5)
BRUN_DOUX = (+0.018, +0.006, -0.020)
ENCRE = (-0.012, -0.004, +0.034)          # ombres encre : indigo, jamais cyan
GRIS_FROID = (-0.006, 0.000, +0.012)

build("axion-terracotta-chaud.cube", "Axion - Terracotta chaud",
      wb=(1.085, 0.915), contrast=1.12, black_lift=0.002, rolloff=0.87,
      sh_color=BRUN_CHAUD, hi_color=ORANGE_TERRE, sh_amt=0.28, hi_amt=0.34, vib=0.08, sh_desat=0.22,
      noir_chaud=(0.020, 0.010, 0.004), froids=0.70)
build("axion-ivoire-doux-contraste.cube", "Axion - Ivoire doux contraste",
      wb=(1.035, 0.965), contrast=1.20, black_lift=0.004, rolloff=0.90,
      sh_color=BRUN_DOUX, hi_color=IVOIRE, sh_amt=0.16, hi_amt=0.26, vib=0.05, sh_desat=0.15,
      noir_chaud=(0.012, 0.008, 0.004), froids=0.35)
build("axion-encre-froid-neutre.cube", "Axion - Encre froid neutre",
      wb=(0.975, 1.030), contrast=1.14, black_lift=0.004, rolloff=0.88,
      sh_color=ENCRE, hi_color=GRIS_FROID, sh_amt=0.24, hi_amt=0.10, vib=0.03, sh_desat=0.18,
      noir_chaud=(0.006, 0.008, 0.014), froids=0.0)


# ---------- planche avant / après (option : python outils/lut/generer-supplementaires.py --planche) ----------
# Pillow requis pour la planche seulement. Interpolation trilinéaire 65³ (rendu final) et 33³ (aperçu) : l'écart
# moyen / maximal entre les deux, sur les 4 images, est écrit dans outils/lut/parametres-supplementaires.md.
def lire_cube(chemin):
    import numpy as np
    lignes = open(chemin, encoding="utf-8").read().split("\n")
    n = int([l for l in lignes if l.startswith("LUT_3D_SIZE")][0].split()[1])
    rows = [l for l in lignes if l and (l[0].isdigit() or l[0] == "-")]
    return np.array([list(map(float, r.split())) for r in rows]).reshape(n, n, n, 3)  # [b][g][r]

def appliquer(img, d):
    import numpy as np
    n = d.shape[0]
    p = img.astype("float64") / 255.0 * (n - 1)
    i0 = np.clip(np.floor(p).astype(int), 0, n - 2)
    f = p - i0
    r0, g0, b0 = i0[..., 0], i0[..., 1], i0[..., 2]
    fr, fg, fb = f[..., 0:1], f[..., 1:2], f[..., 2:3]
    out = 0
    for dr in (0, 1):
        for dg in (0, 1):
            for db in (0, 1):
                w = (fr if dr else 1 - fr) * (fg if dg else 1 - fg) * (fb if db else 1 - fb)
                out = out + w * d[b0 + db, g0 + dg, r0 + dr]
    return out

def reduire_33(d):
    import numpy as np
    idx = np.linspace(0, d.shape[0] - 1, 33)
    # même rééchantillonnage que l'aperçu : trilinéaire sur l'axe de 65 vers 33 points
    pts = np.stack(np.meshgrid(idx, idx, idx, indexing="ij"), axis=-1)
    i0 = np.clip(np.floor(pts).astype(int), 0, d.shape[0] - 2)
    f = pts - i0
    out = 0
    for a in (0, 1):
        for b in (0, 1):
            for c in (0, 1):
                w = (f[..., 0] if a else 1 - f[..., 0]) * (f[..., 1] if b else 1 - f[..., 1]) * (f[..., 2] if c else 1 - f[..., 2])
                out = out + w[..., None] * d[i0[..., 0] + a, i0[..., 1] + b, i0[..., 2] + c]
    return out

def planche():
    import numpy as np
    from PIL import Image, ImageDraw
    racine = os.path.normpath(os.path.join(ICI, "..", ".."))
    noms = ["avant", "axion-chaud", "cinema", "neutre"]
    luts = ["axion-terracotta-chaud", "axion-ivoire-doux-contraste", "axion-encre-froid-neutre"]
    cubes = {n: lire_cube(os.path.join(SORTIE, n + ".cube")) for n in luts}
    w, h = 480, 270
    feuille = Image.new("RGB", (w * 4, (h + 24) * 4), (20, 20, 19))
    dessin = ImageDraw.Draw(feuille)
    ecarts = []
    for y, nom in enumerate(noms):
        img = Image.open(os.path.join(racine, "public", "demo", "lut", nom + ".jpg")).convert("RGB").resize((w, h))
        a = np.asarray(img)
        colonnes = [("sans LUT", img)]
        for n in luts:
            r65 = appliquer(a, cubes[n])
            r33 = appliquer(a, reduire_33(cubes[n]))
            ecarts.append((nom, n, float(np.abs(r65 - r33).mean() * 255), float(np.abs(r65 - r33).max() * 255)))
            colonnes.append((n.replace("axion-", ""), Image.fromarray(np.clip(r65 * 255 + 0.5, 0, 255).astype("uint8"))))
        for x, (titre, im) in enumerate(colonnes):
            feuille.paste(im, (x * w, y * (h + 24) + 24))
            dessin.text((x * w + 6, y * (h + 24) + 6), f"{nom} - {titre}", fill=(250, 249, 245))
    feuille.save(os.path.join(ICI, "planche-supplementaires.jpg"), quality=88)
    for e in ecarts:
        print("ECART 65 vs 33 : %-12s %-30s moyen=%.3f max=%.2f (sur 255)" % e)

if True:
    import sys
    if "--planche" in sys.argv:
        planche()
