# LUT Axion supplémentaires (C6-H8, 15/11/2026)

Trois LUT 65³ pour la planche de Williams (décision Q12 : jamais sur la v4, pas d'écran : C6-H9). Fabriquées par
`python outils/lut/generer-supplementaires.py` (numpy ; `--planche` ajoute Pillow et réécrit `planche-supplementaires.jpg`).
Moteur repris de `generateur-lut-buffer.py` (non modifié, jamais importé tel quel : on n'exécute que ses fonctions),
protection de la peau (`skin_weight`) gardée. Aucun fournisseur, aucun réseau, zéro euro. Licence : fabrication maison, propriété Axion.
Teintes dans `CHARTE_AXION` (ivoire `#FAF9F5`, noir `#141413`, terracotta `#B23F16`) ; aucun turquoise.

| Paramètre | Terracotta chaud | Ivoire doux contrasté | Encre froid neutre |
|---|---|---|---|
| `wb` (gain R, gain B) | 1,085 / 0,915 | 1,035 / 0,965 | 0,975 / 1,030 |
| `contrast` | 1,12 | 1,20 | 1,14 |
| `black_lift` | 0,002 | 0,004 | 0,004 |
| `rolloff` | 0,87 | 0,90 | 0,88 |
| `sh_color` (ombres) | (+0,035 +0,006 −0,035) | (+0,018 +0,006 −0,020) | (−0,012 −0,004 +0,034) |
| `hi_color` (lumières) | (+0,050 +0,012 −0,060) | (+0,030 +0,026 −0,012) | (−0,006 0 +0,012) |
| `sh_amt` / `hi_amt` | 0,28 / 0,34 | 0,16 / 0,26 | 0,24 / 0,10 |
| `vib` / `sh_desat` | 0,08 / 0,22 | 0,05 / 0,15 | 0,03 / 0,18 |
| `noir_chaud` | (0,020 0,010 0,004) | (0,012 0,008 0,004) | (0,006 0,008 0,014) |
| `froids` | 0,70 | 0,35 | 0 |
| Intensité par défaut | 65 | 60 | 60 |

## Sortie de `python outils/lut/qc.py` (entre dans `QC_PY` de `tests/luts-supplementaires.test.ts`)

```
axion-terracotta-chaud.cube      points=65 gris_monotone=True cassure_max=0.0154 noir=[0.02  0.01  0.004] blanc=[0.999 0.982 0.951]
axion-ivoire-doux-contraste.cube points=65 gris_monotone=True cassure_max=0.0169 noir=[0.012 0.008 0.004] blanc=[0.999 0.996 0.986]
axion-encre-froid-neutre.cube    points=65 gris_monotone=True cassure_max=0.0109 noir=[0.006 0.008 0.014] blanc=[0.981 0.985 0.989]
```

## Écart 33³ (aperçu) / 65³ (rendu final), mesuré sur la planche (4 images × 3 LUT, 8 bits, interpolation trilinéaire)

Écart moyen de 0,012 à 0,119 sur 255 ; écart maximal de 0,65 à 1,24 sur 255 (soit au plus 1 niveau sur 8 bits) : invisible à l'œil.
C'est une mesure pour la question de l'architecte, pas une décision. Le rendu final garde le 65³.

## Poids

Chaque `.cube` pèse ~7,1 Mo (7,4 Mo pour les anciens) : le dépôt grossit d'environ 21,5 Mo (+ 3 × 105 Ko d'aperçus et 200 Ko de planche).

## Commande

```
python outils/lut/generer-supplementaires.py            # 3 .cube dans public/luts/
pnpm exec tsx outils/lut/apercus.mts                    # 3 copies 33³ (les 4 anciennes réécrites à l'identique)
python outils/lut/generer-supplementaires.py --planche  # planche-supplementaires.jpg
```
