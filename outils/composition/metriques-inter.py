"""
Métriques d'Inter Bold (encadré de titre de la brique commune « composition », née au lot M4) : chasse de chaque caractère, en unités de la
police, lues dans `studio-rendu/compositions/commune/polices/Inter-Bold.ttf` (SIL OFL 1.1).
Écrit src/briques/composition/metriques-inter.ts (généré : ne pas modifier à la main).
Usage (depuis la racine du dépôt) : python outils/composition/metriques-inter.py
"""
import json
from fontTools.ttLib import TTFont

CARACTERES = "".join(chr(c) for c in range(32, 127)) + "  «»…’‘“”–—€°ÀÂÄÆÇÈÉÊËÎÏÔŒÙÛÜŸàâäæçèéêëîïôœùûüÿ"
t = TTFont("studio-rendu/compositions/commune/polices/Inter-Bold.ttf")
cmap = t.getBestCmap(); hmtx = t["hmtx"]; upm = t["head"].unitsPerEm
largeurs = []
for c in CARACTERES:
    g = cmap.get(ord(c))
    if g is None and c in "  ":
        g = cmap.get(32)
    largeurs.append(hmtx[g][0] if g else hmtx[cmap[ord("n")]][0])
with open("src/briques/composition/metriques-inter.ts", "w", encoding="utf-8", newline="\n") as f:
    f.write("/**\n * MÉTRIQUES RÉELLES d'Inter Bold (encadré de titre), chasse de chaque caractère en unités de la police.\n")
    f.write(" * GÉNÉRÉ par outils/composition/metriques-inter.py : ne pas modifier à la main. PUR (lu aussi par Remotion).\n */\n")
    f.write("export const CARACTERES_INTER = " + json.dumps(CARACTERES, ensure_ascii=False) + ";\n")
    f.write("export const INTER_BOLD = " + json.dumps({"unitesParEm": upm, "largeurs": largeurs}, ensure_ascii=False) + ";\n")
print("ok", len(largeurs), upm)
