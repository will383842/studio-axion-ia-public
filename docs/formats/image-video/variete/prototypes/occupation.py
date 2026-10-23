"""
Mesure d'OCCUPATION v3 (standard 74, § 2 bis, mesure durcie après la relecture de la v2 par le chef de projet).
Usage : python3 -I occupation.py <dossier-rendus> [noms…] [--masques <dossier>]   (sans nom : toutes les images)

Pourquoi une nouvelle mesure : `remplissage.py` (v2) comptait une rangée « occupée » dès que 1,5 % de sa largeur avait
un BORD (un filet fin, le contour d'une carte fantôme, une ligne d'horizon suffisaient). Des écrans à moitié vides à
l'œil passaient à 90 %. Ici on mesure la MASSE visible, comme l'œil sur une vignette :
1. Fond retiré : en 9:16, le VRAI fond vide de la charte (nuit, ivoire ou panneau orange, rendus dans fonds-vides/ par
   fonds-vides/entree.tsx), le plus proche de l'image ; sinon (4:5), un polynôme lisse de degré 4 ajusté en écartant
   le contenu (5 passes). Un panneau orange plein compte comme un aplat de fond, pas comme du contenu.
2. Contenu = pixel qui s'écarte du fond de plus de 28 (canal max), à 1/4 de résolution ; sur fond nuit, il doit aussi
   être clair (luminance > 85) : la lueur orangée et les fantômes très atténués ne comptent pas.
3. Fermeture morphologique (16 px) puis remplissage des trous : une ligne de texte devient un bloc, une carte cerclée
   devient pleine ; un trait fin isolé reste fin.
4. Une rangée est OCCUPÉE si ce contenu couvre au moins 20 % de la largeur (x 43 → 1037, soit ≥ 200 px) : un petit
   objet isolé ne suffit pas.
Hauteur utile : 9:16 y 230 → 1536 moins la bande des sous-titres 1152 → 1286 ; 4:5 y 54 → 1215 moins 1042 → 1176.
Seuils (9:16 et 4:5) : occupation ≥ 60 % ; plus grand trou continu ≤ 15 % ; ÉQUILIBRE ≥ 0,5 = densité de contenu
de la moitié basse (9:16 : y 883 → 1536 hors bande ; 4:5 : y 635 → 1215 hors bande) rapportée à celle de la moitié
haute (le contenu ne s'entasse plus en haut) ; en 9:16, zone d'appoint (y 1300 → 1536, sous les sous-titres) pleine
sur ≥ 50 % de ses rangées (un fantôme ou un filet ne suffit pas).
Limite connue : un écran coupé en deux aplats (nuit | ivoire, OUV-B, CAM-E) compte l'aplat comme contenu ; ces écrans
sont aussi vérifiés à l'œil.
Image plus large que haute (planche FIN-C-3) : non mesurée.
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

FONDS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonds-vides")

def fond_lisse(a):
    h, w, _ = a.shape
    yy, xx = np.mgrid[0:h, 0:w]
    X = np.stack([(xx / w) ** i * (yy / h) ** j for i in range(5) for j in range(5 - i)], -1).reshape(-1, 15)
    A = a.reshape(-1, 3)
    garde = np.ones(len(A), bool)
    for _ in range(5):
        coef, *_ = np.linalg.lstsq(X[garde], A[garde], rcond=None)
        r = np.abs(A - X @ coef).max(1)
        garde = r < 18
        if garde.sum() < len(A) * 0.2: break
    return (X @ coef).reshape(h, w, 3)

def masque(chemin):
    im = Image.open(chemin).convert("RGB")
    L, H = im.size
    q = 4
    a = np.asarray(im.resize((L // q, H // q), Image.BOX), float)
    vides = [os.path.join(FONDS, n) for n in ("FOND-S.jpg", "FOND-I.jpg", "FOND-O.jpg")]
    f = None
    if (L, H) == (1080, 1920) and all(os.path.exists(v) for v in vides):
        # 9:16 : on retire le VRAI fond vide (rendu par fonds-vides/entree.tsx) le plus proche de l'image, s'il lui
        # ressemble (écart médian ≤ 10) ; sinon (fond papier, écran coupé en deux aplats) on revient au polynôme.
        fs = [np.asarray(Image.open(v).convert("RGB").resize((L // q, H // q), Image.BOX), float) for v in vides]
        ecarts = [np.median(np.abs(g[::20] - a[::20])) for g in fs]
        if min(ecarts) <= 10: f = fs[int(np.argmin(ecarts))]
    if f is None:
        petit = np.asarray(im.resize((L // 8, H // 8), Image.BOX), float)
        f = fond_lisse(petit)
        f = np.asarray(Image.fromarray(np.clip(f, 0, 255).astype(np.uint8)).resize((L // q, H // q), Image.BILINEAR), float)
    ecart = np.abs(a - f).max(2)
    lum = a @ np.array([0.2126, 0.7152, 0.0722])
    lf = f @ np.array([0.2126, 0.7152, 0.0722])
    if np.median(lf) < 80:
        # Fond nuit : la lueur orangée (#7A3418), le halo des chiffres et les fantômes atténués ne comptent pas.
        m = (ecart > 28) & ((lum > 110) | (lum < lf - 20))
    else:
        # Fond ivoire : une carte blanche (écart ~ 15) compte, le grain non.
        m = ecart > 13
    m = ndimage.binary_closing(m, structure=np.ones((7, 7)), iterations=1, border_value=0)
    m = ndimage.binary_fill_holes(m)
    m = ndimage.binary_opening(m, structure=np.ones((2, 2)))
    return im.size, m, q

def mesure(chemin, dossier_masques=None):
    """Rend (occupation, plus grand trou, équilibre bas/haut, rangées pleines de la zone d'appoint) ; None si image large."""
    (L, H), m, q = masque(chemin)
    if L > H: return None
    if H >= 1900: utile, bande, milieu, appoint = (230, 1536), (1152, 1286), 883, (1300, 1536)
    else: utile, bande, milieu, appoint = (54, 1215), (1042, 1176), 635, None
    x0, x1 = 43 // q, (L - 43) // q
    seuil = 0.20 * (x1 - x0)
    occ = rangs = trou = trou_max = ap_occ = ap_rangs = 0
    masse = {"haut": [0, 0], "bas": [0, 0]}
    for y in range(utile[0] // q, utile[1] // q):
        if bande[0] // q <= y < bande[1] // q: continue
        rangs += 1
        n = m[y, x0:x1].sum()
        plein = n >= seuil
        cote = masse["bas" if y * q >= milieu else "haut"]
        cote[0] += n; cote[1] += x1 - x0
        if appoint and appoint[0] <= y * q < appoint[1]:
            ap_rangs += 1; ap_occ += plein
        if plein: occ += 1; trou = 0
        else: trou += 1; trou_max = max(trou_max, trou)
    if dossier_masques:
        os.makedirs(dossier_masques, exist_ok=True)
        Image.fromarray((m * 255).astype(np.uint8)).save(os.path.join(dossier_masques, os.path.basename(chemin)[:-4] + ".png"))
    dens = {k: v[0] / v[1] for k, v in masse.items()}
    equilibre = dens["bas"] / max(dens["haut"], 1e-6)
    return occ / rangs, trou_max / rangs, equilibre, (ap_occ / ap_rangs if appoint else None)

def verdict(r):
    p, t, e, ap = r
    return p >= 0.6 and t <= 0.15 and e >= 0.5 and (ap is None or ap >= 0.5)

if __name__ == "__main__":
    args = sys.argv[1:]
    dm = None
    if "--masques" in args:
        k = args.index("--masques"); dm = args[k + 1]; del args[k:k + 2]
    d = args[0]
    noms = args[1:] or sorted(f[:-4] for f in os.listdir(d) if f.endswith(".jpg"))
    print(f"{'image':14s} {'occupation':>10s} {'trou max':>9s} {'équilibre':>10s} {'appoint':>8s}  verdict")
    for n in noms:
        r = mesure(os.path.join(d, n + ".jpg"), dm)
        if r is None:
            print(f"{n:14s} (planche large, non mesurée)"); continue
        p, t, e, ap = r
        aps = "   —   " if ap is None else f"{ap*100:6.0f} %"
        print(f"{n:14s} {p*100:9.0f} % {t*100:8.0f} % {e:10.2f} {aps}  {'OK' if verdict(r) else 'NON'}")
