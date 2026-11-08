"""
Métriques des polices des sous-titres (lot M2) : chasse de chaque caractère, en unités de la police.
- Manrope variable (charte Axion 2026, police unique) → instances statiques « Manrope Medium » (500) et « Manrope ExtraBold » (800).
- Écrit src/briques/sous-titres/metriques.ts (généré : ne pas modifier à la main).
Usage (depuis la racine du dépôt) : python outils/captures-sous-titres/metriques.py
"""
import json, os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

DOSSIER = "src/briques/sous-titres/polices"
vf = os.path.join(DOSSIER, "Manrope-Variable.ttf")
INSTANCES = {"Manrope Medium": ("Manrope-Medium.ttf", 500), "Manrope ExtraBold": ("Manrope-ExtraBold.ttf", 800)}
for nom, (fichier, graisse) in INSTANCES.items():
    chemin = os.path.join(DOSSIER, fichier)
    if not os.path.exists(chemin):
        inst = instancer.instantiateVariableFont(TTFont(vf), {"wght": graisse})
        for n in inst["name"].names:
            if n.nameID in (1, 4, 16):
                n.string = nom
        inst.save(chemin)

CARACTERES = "".join(chr(c) for c in range(32, 127)) + "  «»…’‘“”–—€°%ÀÂÄÆÇÈÉÊËÎÏÔŒÙÛÜŸàâäæçèéêëîïôœùûüÿ"
POLICES = {nom: fichier for nom, (fichier, _g) in INSTANCES.items()}
sortie = {}
for nom, fichier in POLICES.items():
    t = TTFont(os.path.join(DOSSIER, fichier))
    cmap = t.getBestCmap(); hmtx = t["hmtx"]; upm = t["head"].unitsPerEm
    os2 = t["OS/2"]
    largeurs = []
    for c in CARACTERES:
        g = cmap.get(ord(c))
        if g is None and c in "  ":
            g = cmap.get(32)
        largeurs.append(hmtx[g][0] if g else hmtx[cmap[ord("n")]][0])
    sortie[nom] = {"unitesParEm": upm, "ascendante": os2.sTypoAscender, "descendante": os2.sTypoDescender, "hauteurCapitales": getattr(os2, "sCapHeight", 700), "largeurs": largeurs}

with open("src/briques/sous-titres/metriques.ts", "w", encoding="utf-8", newline="\n") as f:
    f.write("/**\n * MÉTRIQUES RÉELLES des polices des sous-titres (chasse de chaque caractère, unités de la police).\n")
    f.write(" * GÉNÉRÉ par outils/captures-sous-titres/metriques.py depuis les fichiers de `polices/` : ne pas modifier à la main.\n */\n")
    f.write("export const CARACTERES = " + json.dumps(CARACTERES, ensure_ascii=False) + ";\n\n")
    f.write("export interface MetriquesPolice {\n  unitesParEm: number;\n  ascendante: number;\n  descendante: number;\n  hauteurCapitales: number;\n  largeurs: readonly number[];\n}\n\n")
    f.write("export const METRIQUES: Record<string, MetriquesPolice> = " + json.dumps(sortie, ensure_ascii=False) + ";\n")
print("ok", {k: len(v["largeurs"]) for k, v in sortie.items()})
