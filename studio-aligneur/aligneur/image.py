"""
Route `/image` (plan facecam v4, lot B ; n° 7, 8, 9, 17, 34) : l'image de la vidéo face caméra, en DEUX étapes.

ÉTAPE « passe » (par défaut) — UNE SEULE passe Python sur la BANDE UTILE de la prise (≈ 1600 × 2160 : la colonne 9:16
avec la marge des zooms), dans le temps de la prise (rétablir une coupe ne la relance jamais) :
  0. préparation par FFmpeg : rotation, HLG/PQ → SDR BT.709 (`zscale` + tonemap `hable`), 25 i/s, découpe de la bande ;
  1. ANTI-GRAIN AVANT tout éclaircissement : moyenne temporelle adaptative au mouvement sur toute l'image, renforcée
     dans la boîte du visage (n° 34) ;
  2. lumière virtuelle douce sur le visage (prototype `lumiere-prototype.py`) et fond assombri de 12 % (jamais flouté,
     aucun détourage : un ovale très doux autour de la tête et des épaules), gain global FIXE pour toute la vidéo
     (aucun pompage), plafonné ;
  3. bonne mine (prototype `bonne-mine-prototype.py`) dans le seul masque de la peau : teint plus lumineux et plus
     chaud, cernes éclaircies, peau lissée en gardant 75 % du grain, effet réduit du côté déjà éclairé (la tache orangée
     du prototype) ; yeux à peine plus clairs et seule netteté de l'image (jamais sur la peau) ;
  4. dents : seulement bouche ouverte, fondu sur 3 images, jamais plus claires que le blanc des yeux ;
  5. couleurs mesurées UNE fois par vidéo sur la peau et le mur (jamais l'image entière : le pull bleu de F0 rendait
     tout orange), vers le « Look Will » de référence s'il existe (correspondance Lab), puis la LUT du format ;
  6. intermédiaire 10 bits quasi sans perte (x264 10 bits, crf 8, une image clé par seconde) déposé sur R2.
  Crans Moins / Juste / Plus pour lumière, couleurs, mine et dents. Mesures rendues : luminance et BRUIT du visage
  avant / après (contrôle : jamais plus de bruit que l'original), teinte de la peau, ΔE00 avec la référence.

ÉTAPE « cadrage » — à partir de l'intermédiaire : chaque plan de la réalisation (cadre fixe dans la source, temps de
la prise) est découpé, recadré et mis à 1080 × 1920 (lanczos), puis les plans sont mis bout à bout dans le temps du
montage avec le son monté (`/son`). Sortie : la piste montée 10 bits, PRÉ-CADRÉE (`sourcePreCadree`, lot C), et les
contrôles machine (n° 24) : noirs, images figées, image isolée à une coupe, niveau sonore, synchro son-image.
"""
from __future__ import annotations

import math
import os
import re
import shutil
import subprocess
import urllib.request
from typing import Callable

from .media import (
    ETIQUETTES_BT709,
    IMAGES_PAR_SEC,
    ErreurTravail,
    cle,
    depot,
    deposer_fichier,
    entree,
    executer,
    filtre_preparation,
    fils_ffmpeg,
    lire_images,
    lire_json_gz,
    nettoyer_dossier,
    options_fils,
    parametre,
    sonder,
    tranches,
)

CRANS = {"moins": 0.6, "juste": 1.0, "plus": 1.4}
CIBLE_VISAGE_Y = 118.0
GAIN_GLOBAL_MAX = 1.3
GAIN_GLOBAL_MIN = 0.85
ASSOMBRI_FOND = 0.12
PREROLL_IMAGES = 10
CRF_INTERMEDIAIRE = 8
ECHANTILLONS_MESURE = 12
# Cibles par défaut (sans Look Will de référence) : mur neutre à peine chaud, peau sur la ligne des tons chair.
MUR_AB_DEFAUT = (0.5, 3.0)
TEINTE_PEAU_DEG = 55.0

# Indices MediaPipe (mêmes listes que visages.py).
from .visages import BOUCHE, IRIS, LEVRES_INT, OEIL_D, OEIL_G, OVALE, SOURCIL_D, SOURCIL_G  # noqa: E402


# --------------------------------------------------------------------------------------------------------------------
# Points du visage interpolés à chaque image
# --------------------------------------------------------------------------------------------------------------------

class Points:
    """Points du visage (json.gz de `/visages`), interpolés à l'instant demandé, en pixels de la bande."""

    def __init__(self, donnees: dict, largeur_source: int, hauteur_source: int, bande_x: int):
        import numpy as np

        self.indices = {idx: k for k, idx in enumerate(donnees["indices"])}
        self.t = np.asarray(donnees["t"], dtype=np.float64)
        n = len(self.t)
        self.p = np.asarray(donnees["points"], dtype=np.float32).reshape(n, -1, 2)
        self.ok = np.asarray(donnees.get("confiance", [1] * n), dtype=bool)
        self.echelle = np.array([largeur_source, hauteur_source], dtype=np.float32)
        self.decalage = np.array([bande_x, 0], dtype=np.float32)

    def a(self, t: float):
        import numpy as np

        if len(self.t) == 0:
            return None
        k = int(np.searchsorted(self.t, t))
        if k <= 0:
            pts = self.p[0]
        elif k >= len(self.t):
            pts = self.p[-1]
        else:
            r = (t - self.t[k - 1]) / max(self.t[k] - self.t[k - 1], 1e-6)
            pts = self.p[k - 1] * (1 - r) + self.p[k] * r
        return (pts * self.echelle - self.decalage).astype(np.float32)

    def liste(self, pts, indices: list[int]):
        return pts[[self.indices[i] for i in indices]]


# --------------------------------------------------------------------------------------------------------------------
# Masques (calculés dans la seule zone du visage)
# --------------------------------------------------------------------------------------------------------------------

def poly(forme, pts, flou: float = 0.0, dilate: int = 0):
    import cv2
    import numpy as np

    m = np.zeros(forme, np.float32)
    cv2.fillPoly(m, [np.round(pts).astype(np.int32)], 1.0)
    if dilate:
        m = cv2.dilate(m, np.ones((dilate, dilate), np.uint8))
    return cv2.GaussianBlur(m, (0, 0), flou) if flou else m


def masques_visage(forme, P: Points, pts, origine):
    """Peau, cernes, yeux, intérieur de la bouche, dans une zone (y0, x0) ; tailles relatives au visage."""
    import cv2
    import numpy as np

    o = np.array([origine[1], origine[0]], dtype=np.float32)
    L = lambda idx: P.liste(pts, idx) - o  # noqa: E731
    ovale = L(OVALE)
    taille = float(max(ovale[:, 0].max() - ovale[:, 0].min(), 1.0))
    u = max(1, int(taille / 60))
    yeux = np.maximum(poly(forme, L(OEIL_G), dilate=3 * u), poly(forme, L(OEIL_D), dilate=3 * u))
    trous = np.clip(yeux + poly(forme, L(BOUCHE), dilate=4 * u) + poly(forme, L(SOURCIL_G), dilate=3 * u) + poly(forme, L(SOURCIL_D), dilate=3 * u), 0, 1)
    peau = cv2.GaussianBlur(np.clip(poly(forme, ovale) - trous, 0, 1), (0, 0), 3 * u)
    cerne = np.zeros(forme, np.float32)
    for idx in (OEIL_G, OEIL_D):
        e = L(idx)
        x0, x1 = e[:, 0].min(), e[:, 0].max()
        yb, hh = e[:, 1].max(), e[:, 1].max() - e[:, 1].min()
        cv2.ellipse(cerne, (int((x0 + x1) / 2), int(yb + hh * 0.9)), (max(1, int((x1 - x0) * 0.48)), max(1, int(hh * 0.85))), 0, 0, 360, 1.0, -1)
    cerne = cv2.GaussianBlur(cerne * (1 - cv2.GaussianBlur(yeux, (0, 0), u)), (0, 0), 2.5 * u)
    interieur = poly(forme, L(LEVRES_INT))
    return {"peau": peau, "cerne": cerne, "yeux": cv2.GaussianBlur(yeux, (0, 0), u), "bouche": interieur, "taille": taille}


def zone_visage(pts, P: Points, forme_image, marge: float = 0.45):
    ovale = P.liste(pts, OVALE)
    x0, y0 = ovale.min(0)
    x1, y1 = ovale.max(0)
    mx, my = (x1 - x0) * marge, (y1 - y0) * marge
    h, w = forme_image[:2]
    return int(max(0, y0 - my)), int(min(h, y1 + my)), int(max(0, x0 - mx)), int(min(w, x1 + mx))


# --------------------------------------------------------------------------------------------------------------------
# Couleur : Lab, ΔE00, mesures sur la peau et le mur
# --------------------------------------------------------------------------------------------------------------------

def lab(rgb01):
    """RGB [0, 1] (float32, ordre R, G, B) → Lab (L 0-100)."""
    import cv2

    return cv2.cvtColor(rgb01.astype("float32"), cv2.COLOR_RGB2Lab)


def delta_e00(lab1, lab2) -> float:
    """CIEDE2000 entre deux couleurs Lab."""
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cm = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cm**7 / (Cm**7 + 25**7)))
    a1p, a2p = a1 * (1 + G), a2 * (1 + G)
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    dh = h2p - h1p
    if C1p * C2p == 0:
        dh = 0
    elif dh > 180:
        dh -= 360
    elif dh < -180:
        dh += 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dh / 2))
    Lm, Cmp = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0:
        hm = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hm = (h1p + h2p) / 2
    else:
        hm = (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2
    T = 1 - 0.17 * math.cos(math.radians(hm - 30)) + 0.24 * math.cos(math.radians(2 * hm)) + 0.32 * math.cos(math.radians(3 * hm + 6)) - 0.20 * math.cos(math.radians(4 * hm - 63))
    dT = 30 * math.exp(-(((hm - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cmp**7 / (Cmp**7 + 25**7))
    Sl = 1 + 0.015 * (Lm - 50) ** 2 / math.sqrt(20 + (Lm - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cmp, 1 + 0.015 * Cmp * T
    Rt = -math.sin(math.radians(2 * dT)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))


def bruit(y, masque) -> float:
    """Bruit d'une zone : écart médian absolu du détail fin de la luminance (0-255), là où le masque vaut > 0,5."""
    import cv2
    import numpy as np

    detail = y - cv2.GaussianBlur(y, (0, 0), 1.2)
    v = detail[masque > 0.5]
    if v.size < 50:
        return float("nan")
    return float(1.4826 * np.median(np.abs(v - np.median(v))) * 255)


def luminance(rgb01):
    return rgb01[..., 0] * 0.299 + rgb01[..., 1] * 0.587 + rgb01[..., 2] * 0.114


def mesurer_image(rgb01, P: Points, pts) -> dict | None:
    """Mesures d'une image : peau (Lab, Y, bruit), mur (Lab : au-dessus des épaules, loin du visage)."""
    import numpy as np

    if pts is None:
        return None
    y0, y1, x0, x1 = zone_visage(pts, P, rgb01.shape, 0.1)
    zone = rgb01[y0:y1, x0:x1]
    if zone.size == 0:
        return None
    m = masques_visage(zone.shape[:2], P, pts, (y0, x0))
    peau = m["peau"] > 0.6
    if peau.sum() < 100:
        return None
    lab_zone = lab(zone)
    h, w = rgb01.shape[:2]
    haut_visage = int(P.liste(pts, OVALE)[:, 1].min())
    mur = np.zeros((h, w), bool)
    bande_haute = max(4, int(haut_visage * 0.8))
    mur[: bande_haute, : max(1, x0 - int(0.1 * w))] = True
    mur[: bande_haute, min(w - 1, x1 + int(0.1 * w)) :] = True
    mesure = {
        "peauLab": [float(lab_zone[..., k][peau].mean()) for k in range(3)],
        "peauY": float(luminance(zone)[peau].mean() * 255),
        "bruitPeau": bruit(luminance(zone), m["peau"]),
    }
    if mur.sum() > 500:
        echant = rgb01[mur][:: max(1, int(mur.sum() // 20000))]
        lab_mur = lab(echant.reshape(-1, 1, 3)).reshape(-1, 3)
        mesure["murLab"] = [float(np.median(lab_mur[:, k])) for k in range(3)]
        mesure["murRgb"] = [float(np.median(echant[:, k])) for k in range(3)]
    return mesure


# Lot G : teinte demandée au monteur (« plus chaud », « plus froid ») : gains rouge / bleu doux, appliqués à toute l'image.
TEINTES = {"plus-chaud": (1.04, 1.0, 0.95), "plus-froid": (0.96, 1.0, 1.05)}


def reglages_video(mesures: list[dict], crans: dict, reference: dict | None, teinte: str | None = None) -> dict:
    """Gains FIXES pour toute la vidéo (aucun pompage) : exposition, balance des blancs du mur, décalage de la peau."""
    import numpy as np

    ok = [m for m in mesures if m]
    if not ok:
        return {"gain": 1.0, "balance": list(TEINTES.get(teinte or "", (1.0, 1.0, 1.0))), "decalagePeau": [0.0, 0.0], "peauY": None}
    lum = crans.get("lumiere", 1.0)
    coul = crans.get("couleurs", 1.0)
    peau_y = float(np.median([m["peauY"] for m in ok]))
    cible = CIBLE_VISAGE_Y + (lum - 1.0) * 12
    gain = float(np.clip((cible / max(peau_y, 1.0)) ** 1.0, GAIN_GLOBAL_MIN, GAIN_GLOBAL_MAX))
    # Balance des blancs mesurée sur le MUR (von Kries en lumière linéaire), partielle (70 % × cran couleurs).
    balance = [1.0, 1.0, 1.0]
    murs = [m["murRgb"] for m in ok if "murRgb" in m]
    if murs:
        r, g, b = (float(np.median([x[k] for x in murs])) ** 2.2 for k in range(3))
        cible_ab = tuple(reference["murLab"][1:]) if reference and "murLab" in reference else MUR_AB_DEFAUT
        # Mur neutre (gris de même luminance), puis la légère chaleur visée vient du décalage Lab de la peau / LUT.
        moyenne = (r + g + b) / 3
        # Un mur blanc ou gris (chroma ≤ 10) est ramené au neutre à 50 % ; un mur franchement coloré (chroma ≥ 20) est
        # une vraie couleur du décor : on n'y touche pas. Gains bornés à ± 12 %.
        murs_lab = [m["murLab"] for m in ok if "murLab" in m]
        chroma_mur = float(np.median([math.hypot(x[1], x[2]) for x in murs_lab])) if murs_lab else 0.0
        force = min(1.0, 0.5 * coul) * float(np.clip((20 - chroma_mur) / 10, 0, 1))
        balance = [float(np.clip(1 + force * (moyenne / max(x, 1e-4) - 1), 0.88, 1.12)) for x in (r, g, b)]
        balance = [float(x * (1 + 0.004 * cible_ab[1] * (1 if k == 0 else -1 if k == 2 else 0))) for k, x in enumerate(balance)]
    # Peau : vers la référence (Look Will), sinon sur la ligne des tons chair (teinte 55°), chroma gardé.
    peau_lab = np.median(np.array([m["peauLab"] for m in ok]), axis=0)
    if reference and "peauLab" in reference:
        cible_a, cible_b = reference["peauLab"][1], reference["peauLab"][2]
    else:
        chroma = max(math.hypot(peau_lab[1], peau_lab[2]), 16.0)
        cible_a = chroma * math.cos(math.radians(TEINTE_PEAU_DEG))
        cible_b = chroma * math.sin(math.radians(TEINTE_PEAU_DEG))
    if teinte in TEINTES:
        balance = [float(np.clip(x * g, 0.85, 1.15)) for x, g in zip(balance, TEINTES[teinte])]
    da = float(np.clip((cible_a - peau_lab[1]) * 0.6 * coul, -6, 6))
    db = float(np.clip((cible_b - peau_lab[2]) * 0.6 * coul, -6, 6))
    return {"gain": round(gain, 4), "balance": [round(x, 4) for x in balance], "decalagePeau": [round(da, 3), round(db, 3)], "peauY": round(peau_y, 1)}


# --------------------------------------------------------------------------------------------------------------------
# Traitement d'une image
# --------------------------------------------------------------------------------------------------------------------

class Passe:
    """État de la passe (image précédente pour l'anti-grain, poids des dents pour le fondu sur 3 images)."""

    def __init__(self, P: Points | None, reglages: dict, crans: dict, forme):
        self.P = P
        self.r = reglages
        self.c = crans
        self.precedente = None
        self.y_precedente = None
        self.poids_dents = 0.0
        self.forme = forme

    # 1. Anti-grain AVANT tout éclaircissement : moyenne temporelle adaptative au mouvement (poids α / (1 + (écart/σ)²)).
    def anti_grain(self, f, zone):
        import cv2
        import numpy as np

        y = cv2.cvtColor(f, cv2.COLOR_RGB2GRAY)
        if self.precedente is None:
            self.precedente, self.y_precedente = f, y
            return f
        ecart = cv2.absdiff(y, self.y_precedente)
        poids = cv2.divide(0.45, 1.0 + cv2.multiply(ecart, ecart, scale=1 / 0.025**2), dtype=cv2.CV_32F)
        if zone is not None:
            y0, y1, x0, x1 = zone
            # Visage : débruitage renforcé (boîte du visage seulement, n° 34).
            e = ecart[y0:y1, x0:x1]
            poids[y0:y1, x0:x1] = cv2.divide(0.6, 1.0 + cv2.multiply(e, e, scale=1 / 0.03**2), dtype=cv2.CV_32F)
        # sortie = f + poids × (précédente − f), sans tableau intermédiaire de plus.
        sortie = np.subtract(self.precedente, f)
        np.multiply(sortie, poids[..., None], out=sortie)
        np.add(sortie, f, out=sortie)
        self.precedente, self.y_precedente = sortie, cv2.cvtColor(sortie, cv2.COLOR_RGB2GRAY)
        return sortie

    # 2. Lumière virtuelle et fond assombri (cartes basse définition, lissées, agrandies : aucun bord). Le gain est
    # appliqué en valeurs codées (gamma) ; la balance des blancs, calculée en lumière linéaire, y est ramenée (^1/2,2).
    def lumiere(self, f, pts):
        import cv2
        import numpy as np

        h, w = f.shape[:2]
        petit = (max(8, w // 8), max(8, h // 8))
        yy, xx = np.mgrid[0 : petit[1], 0 : petit[0]].astype(np.float32)
        gain = np.full((petit[1], petit[0]), self.r["gain"], np.float32)
        if pts is not None and self.P is not None:
            ovale = self.P.liste(pts, OVALE) / 8.0
            cx, cy = ovale[:, 0].mean(), ovale[:, 1].mean()
            fw = float(ovale[:, 0].max() - ovale[:, 0].min())
            fh = float(ovale[:, 1].max() - ovale[:, 1].min())
            lx, ly, r = cx - 0.35 * fw, cy - 0.25 * fw, fw * 1.6
            cle_lum = np.exp(-(((xx - lx) ** 2 + (yy - ly) ** 2) / (2 * r * r)))
            visage = np.exp(-(((xx - cx) / (0.9 * fw)) ** 2 + ((yy - cy) / (0.9 * fh)) ** 2))
            # Sujet : tête et épaules (ovale très doux sous le visage) ; le fond est hors de cet ovale.
            sujet = np.maximum(visage, np.exp(-(((xx - cx) / (2.2 * fw)) ** 2 + ((yy - (cy + 1.6 * fh)) / (2.0 * fh)) ** 2)))
            sujet = cv2.GaussianBlur(sujet, (0, 0), 2.0)
            gain = gain * (1 + 0.22 * self.c.get("lumiere", 1.0) * cle_lum * visage) * (1 - ASSOMBRI_FOND * (1 - sujet))
        gain = cv2.resize(gain.astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC)
        b = np.array([float(x) ** (1 / 2.2) for x in self.r["balance"]], np.float32)
        sortie = np.multiply(f, gain[..., None])
        np.multiply(sortie, b, out=sortie)
        # Épaule douce : les hautes lumières ne brûlent pas (seuls les pixels au-delà du seuil sont touchés).
        seuil = 0.92
        haut = sortie > seuil
        if haut.any():
            sortie[haut] = seuil + (1 - seuil) * np.tanh((sortie[haut] - seuil) / (1 - seuil))
        return sortie

    # 3-4-5. Bonne mine, dents, teinte de la peau, netteté des yeux : dans la zone du visage seulement.
    def visage(self, f, pts, bouche: float):
        import cv2
        import numpy as np

        if pts is None or self.P is None:
            return f
        # Zone serrée autour de l'ovale (les masques n'en débordent que par leur flou).
        y0, y1, x0, x1 = zone_visage(pts, self.P, f.shape, 0.12)
        zone = f[y0:y1, x0:x1].astype(np.float32)
        if zone.size == 0:
            return f
        # Masques et lissage à mi-définition (ils sont flous de toute façon), agrandis ensuite : 4 fois moins de calcul.
        zh, zw = zone.shape[:2]
        demi = masques_visage((max(2, zh // 2), max(2, zw // 2)), self.P, pts * 0.5, (y0 * 0.5, x0 * 0.5))
        m = {k: (cv2.resize(v, (zw, zh), interpolation=cv2.INTER_LINEAR) if isinstance(v, np.ndarray) else v * 2) for k, v in demi.items()}
        mine = self.c.get("mine", 1.0)
        peau = m["peau"]
        u = max(1, int(m["taille"] / 60))
        # Effet réduit du côté déjà éclairé (évite la tache orangée du prototype sur la joue droite).
        y = luminance(zone)
        moy = float(y[peau > 0.5].mean()) if (peau > 0.5).any() else 0.5
        cote = np.clip(1 - (y - moy) / 0.25, 0.5, 1.0)
        # Lissage : on garde 75 % du grain naturel (jamais de netteté sur la peau).
        petite = cv2.resize(zone, (max(2, zw // 2), max(2, zh // 2)), interpolation=cv2.INTER_AREA)
        lisse = cv2.bilateralFilter(petite, 9, 0.16, max(2.0, 1.5 * u / 2))
        # Le grain est à l'échelle de 1 à 2 pixels : séparation des fréquences à σ = 2.
        detail = zone - cv2.GaussianBlur(zone, (0, 0), 2.0)
        douce = cv2.resize(cv2.GaussianBlur(lisse, (0, 0), 0.75 * u), (zw, zh), interpolation=cv2.INTER_LINEAR) + detail * 0.75
        k = (peau * 0.5 * min(mine, 1.2))[..., None]
        zone = zone * (1 - k) + douce * k
        # Teint : plus lumineux, plus chaud, un peu plus coloré (dans le seul masque de la peau).
        hsv = cv2.cvtColor(np.clip(zone, 0, 1), cv2.COLOR_RGB2HSV)
        hsv[..., 1] = np.clip(hsv[..., 1] * (1 + 0.14 * mine * peau * cote), 0, 1)
        hsv[..., 2] = np.clip(hsv[..., 2] * (1 + 0.06 * mine * peau * cote), 0, 1)
        zone = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
        chaud = (peau * cote * mine)[..., None]
        zone = zone * (1 + chaud * np.array([0.035, 0.0, -0.025], np.float32))
        # Cernes : éclaircies et moins violettes.
        c = (m["cerne"] * mine)[..., None]
        zone = zone * (1 + 0.11 * c)
        gris = zone.mean(2, keepdims=True)
        zone = zone * (1 - 0.22 * c) + gris * np.array([1.04, 1.0, 0.97], np.float32) * 0.22 * c
        # Peau vers la teinte visée (Look Will ou ligne des tons chair) : décalage Lab fixe pour la vidéo.
        da, db = self.r["decalagePeau"]
        if da or db:
            L = lab(np.clip(zone, 0, 1))
            L[..., 1] += da * peau
            L[..., 2] += db * peau
            zone = cv2.cvtColor(L, cv2.COLOR_Lab2RGB)
        # Yeux : à peine plus clairs, seule netteté de l'image.
        ye = m["yeux"][..., None]
        net = zone + 0.6 * (zone - cv2.GaussianBlur(zone, (0, 0), 1.5))
        zone = (zone * (1 - ye) + net * ye) * (1 + 0.04 * mine * ye)
        # Dents : bouche ouverte seulement, fondu sur 3 images ; jamais plus claires que le blanc des yeux.
        cible = 1.0 if bouche > 0.25 else 0.0
        self.poids_dents += max(-1 / 3, min(1 / 3, cible - self.poids_dents))
        lignes, colonnes = np.nonzero(m["bouche"] > 0.5)
        if self.poids_dents > 0.01 and lignes.size > 20:
            # Seulement le rectangle de la bouche ; plafond = blanc des yeux (90e centile de leur clarté), moins 2.
            yeux = m["yeux"] > 0.6
            yeux_l = lab(np.clip(zone[yeux][None], 0, 1))[0, :, 0] if yeux.any() else np.zeros(0)
            plafond = float(np.percentile(yeux_l, 90)) - 2 if yeux_l.size > 10 else 85.0
            b0, b1 = max(0, lignes.min() - 2 * u), min(zh, lignes.max() + 2 * u + 1)
            c0, c1 = max(0, colonnes.min() - 2 * u), min(zw, colonnes.max() + 2 * u + 1)
            L = lab(np.clip(zone[b0:b1, c0:c1], 0, 1))
            chroma = np.hypot(L[..., 1], L[..., 2])
            dents = (m["bouche"][b0:b1, c0:c1] * (L[..., 0] > 45) * (chroma < 30)).astype(np.float32)
            force = cv2.GaussianBlur(dents, (0, 0), 0.8 * u) * self.poids_dents * self.c.get("dents", 1.0)
            L[..., 2] *= 1 - 0.55 * force
            L[..., 1] *= 1 - 0.3 * force
            L[..., 0] = np.minimum(L[..., 0] + 7 * force, np.maximum(L[..., 0], plafond))
            zone[b0:b1, c0:c1] = cv2.cvtColor(L, cv2.COLOR_Lab2RGB)
        # Écrit en place : `f` est déjà une image neuve (sortie de la lumière), aucune copie de l'image entière.
        f[y0:y1, x0:x1] = np.clip(zone, 0, 1)
        return f

    def traiter(self, f, t: float, bouche: float):
        pts = self.P.a(t) if self.P is not None else None
        zone = zone_visage(pts, self.P, f.shape, 0.2) if pts is not None and self.P is not None else None
        f = self.anti_grain(f, zone)
        f = self.lumiere(f, pts)
        return self.visage(f, pts, bouche)


# --------------------------------------------------------------------------------------------------------------------
# Étape « passe »
# --------------------------------------------------------------------------------------------------------------------

def bande_utile(sonde: dict, demandee: dict | None) -> dict:
    """La colonne 9:16 avec la marge des zooms (≈ 1600 × 2160 sur une source 4K horizontale), en pixels pairs."""
    w, h = sonde["largeur"], sonde["hauteur"]
    if isinstance(demandee, dict) and "x" in demandee and "largeur" in demandee:
        largeur = int(min(w, max(64, int(demandee["largeur"]))))
        x = int(min(max(0, int(demandee["x"])), w - largeur))
    else:
        largeur = int(min(w, round(h * 9 / 16 * 1.35)))
        x = (w - largeur) // 2
    largeur -= largeur % 2
    x -= x % 2
    return {"x": x, "largeur": largeur, "hauteur": h - h % 2}


def telecharger(adresse: str, chemin: str) -> str:
    if not adresse.startswith(("http://", "https://")):
        return adresse
    try:
        with urllib.request.urlopen(adresse, timeout=600) as r, open(chemin, "wb") as f:
            shutil.copyfileobj(r, f, 1024 * 1024)
    except OSError as e:
        raise ErreurTravail("fichier-inaccessible", f"Lecture impossible ({os.path.basename(chemin)}).") from e
    return chemin


def filtre_lut(chemin_lut: str | None, intensite: float) -> str:
    """LUT du format à son intensité (mélange avec l'image non teintée), en 16 bits ; puis 10 bits pour l'encodeur.
    RVB → YUV en BT.709 plage tv EXPLICITE (09/10) : sans elle, FFmpeg (5.1 comme 8.1) prenait la matrice BT.601 et le
    fichier, étiqueté BT.709, sortait avec des couleurs décalées (rouge pur : Y = 324 au lieu de 250 sur 1023)."""
    vers_yuv = "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p10le"
    if not chemin_lut or intensite <= 0:
        return vers_yuv
    k = max(0.0, min(1.0, intensite))
    chemin = chemin_lut.replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
    return f"format=gbrp16le,split[a][b];[b]lut3d=file='{chemin}':interp=tetrahedral[c];[c][a]blend=all_mode=normal:all_opacity={k:.3f},{vers_yuv}"


# 10/10 : prévision de x264 (images gardées d'avance) : 40 par défaut au préréglage « fast » ; 10 suffit à un
# intermédiaire quasi sans perte (crf 8) et retire ≈ 30 images 4K de 16 bits en mémoire.
PREVISION_X264 = 10


def encodeur(chemin: str, largeur: int, hauteur: int, filtre: str) -> subprocess.Popen:
    """x264 10 bits de l'intermédiaire, fils bornés à ceux du conteneur (sans borne : un fil par cœur de l'hôte, chacun
    avec ses images en vol — 2,9 Go mesurés sur une bande 4K pleine largeur)."""
    fils = str(fils_ffmpeg())
    cmd = [
        "ffmpeg", "-v", "error", "-nostdin", "-y", *options_fils(),
        "-f", "rawvideo", "-pix_fmt", "rgb48le", "-s", f"{largeur}x{hauteur}", "-r", str(IMAGES_PAR_SEC), "-i", "pipe:0",
        "-filter_complex", f"[0:v]{filtre},{ETIQUETTES_BT709}[v]", "-map", "[v]",
        "-c:v", "libx264", "-preset", "fast", "-crf", str(CRF_INTERMEDIAIRE), "-profile:v", "high10", "-g", str(IMAGES_PAR_SEC),
        "-threads", fils, "-rc-lookahead", str(PREVISION_X264),
        "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
        "-movflags", "+faststart", chemin,
    ]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)


def vers_16bits(sortie, passe: "Passe"):
    """Image [0, 1] → RGB 16 bits pour l'encodeur, sans copie de plus : bornée et mise à l'échelle EN PLACE quand
    l'image n'est pas gardée par l'anti-grain (image précédente), puis écrite telle quelle (tampon numpy)."""
    import numpy as np

    if sortie is passe.precedente:
        sortie = sortie.copy()
    np.clip(sortie, 0, 1, out=sortie)
    sortie *= 65535.0
    sortie += 0.5
    return sortie.astype(np.uint16)


def executer_passe(demande: dict, dossier: str, progression: Callable[[int], None]) -> dict:
    import numpy as np

    source = demande["source"]
    sonde = sonder(source)
    bande = bande_utile(sonde, parametre(demande, "bande"))
    crans = {k: CRANS.get(str(v), 1.0) for k, v in (parametre(demande, "image") or {}).items() if k in ("lumiere", "couleurs", "mine", "dents")}
    reference = parametre(demande, "lookWill")
    reference = reference if isinstance(reference, dict) else None
    P = None
    adresse_points = parametre(demande, "points")
    if isinstance(adresse_points, str) and adresse_points:
        P = Points(lire_json_gz(adresse_points, dossier, "points"), sonde["largeur"], sonde["hauteur"], bande["x"])
    bouche_t, bouche_v = [], []
    adresse_piste = parametre(demande, "piste")
    if isinstance(adresse_piste, str) and adresse_piste:
        piste = lire_json_gz(adresse_piste, dossier, "piste")
        bouche_t = [e["t"] for e in piste.get("echantillons", [])]
        bouche_v = [e.get("bouche", 0) for e in piste.get("echantillons", [])]
    lut = parametre(demande, "lut")
    chemin_lut = None
    intensite_lut = 0.0
    if isinstance(lut, dict) and isinstance(lut.get("adresse"), str):
        chemin_lut = telecharger(lut["adresse"], os.path.join(dossier, "look.cube"))
        intensite_lut = float(lut.get("intensite", 60)) / 100.0
    w, h = bande["largeur"], bande["hauteur"]
    prep = f"{filtre_preparation(sonde)},crop={w}:{h}:{bande['x']}:0"
    duree = sonde["duree"]

    # Mesures une fois par vidéo (12 images réparties) : gains FIXES, couleurs sur la peau et le mur.
    instants = [duree * (k + 0.5) / ECHANTILLONS_MESURE for k in range(ECHANTILLONS_MESURE)]
    avant: list[dict | None] = []
    for t in instants:
        brut = next(lire_images(source, prep, w, h, t, 1.0 / IMAGES_PAR_SEC, profondeur16=True), None)
        if brut is None:
            avant.append(None)
            continue
        img = np.frombuffer(brut, np.uint16).reshape(h, w, 3).astype(np.float32) / 65535.0
        avant.append(mesurer_image(img, P, P.a(t)) if P is not None else None)
    teinte = parametre(demande, "teinte")
    reglages = reglages_video([m for m in avant if m], crans, reference, teinte if isinstance(teinte, str) else None)
    progression(8)

    # La passe, par tranches de 30 s (chaque tranche gardée sur disque : reprise après un redémarrage).
    liste = tranches(duree)
    fichiers = []
    apres: list[dict] = []
    for i, (debut, longueur) in enumerate(liste):
        chemin = os.path.join(dossier, f"tranche-{i:03d}.mp4")
        fichiers.append(chemin)
        if os.path.exists(chemin):
            continue
        preroll = min(debut, PREROLL_IMAGES / IMAGES_PAR_SEC)
        passe = Passe(P, reglages, crans, (h, w))
        enc = encodeur(chemin + ".tmp.mp4", w, h, filtre_lut(chemin_lut, intensite_lut))
        n = 0
        a_mesurer = {int(round((t - (debut - preroll)) * IMAGES_PAR_SEC)): t for t in instants if debut <= t < debut + longueur}
        total = max(1, int(round((longueur + preroll) * IMAGES_PAR_SEC)))
        try:
            for brut in lire_images(source, prep, w, h, debut - preroll, longueur + preroll, profondeur16=True):
                t = debut - preroll + n / IMAGES_PAR_SEC
                # 10/10 : conversions EN PLACE (une seule image flottante de plus, pas trois) ; tampon brut lâché tout de suite.
                img = np.frombuffer(brut, np.uint16).reshape(h, w, 3).astype(np.float32)
                del brut
                img *= 1.0 / 65535.0
                bouche = float(np.interp(t, bouche_t, bouche_v)) if bouche_t else 0.0
                sortie = passe.traiter(img, t, bouche)
                del img
                if n in a_mesurer and P is not None:
                    m = mesurer_image(sortie, P, P.a(t))
                    if m:
                        apres.append(m)
                if t >= debut - 1e-6:
                    assert enc.stdin is not None
                    enc.stdin.write(vers_16bits(sortie, passe))
                n += 1
                # Progression honnête PENDANT la tranche (avant : seulement à sa fin, 8 % → 92 % d'un coup sur 30 s).
                if n % IMAGES_PAR_SEC == 0:
                    progression(8 + int(84 * (i + min(1.0, n / total)) / len(liste)))
        finally:
            if enc.stdin:
                enc.stdin.close()
            enc.wait()
        if enc.returncode != 0:
            raise ErreurTravail("inconnu", "Encodage de l'image impossible.")
        os.replace(chemin + ".tmp.mp4", chemin)
        progression(8 + int(84 * (i + 1) / len(liste)))

    final = os.path.join(dossier, "image-10bits.mp4")
    liste_concat = os.path.join(dossier, "tranches.txt")
    with open(liste_concat, "w", encoding="utf-8") as f:
        for c in fichiers:
            f.write(f"file '{c}'\n")
    executer(["ffmpeg", "-v", "error", "-nostdin", "-y", "-f", "concat", "-safe", "0", "-i", liste_concat, "-c", "copy", "-movflags", "+faststart", final])
    progression(95)
    deposer_fichier(depot(demande, "image"), final, "video/mp4")

    mesures = mesures_passe([m for m in avant if m], apres, reference)
    nettoyer_dossier(dossier)
    return {"fichierCle": cle(demande, "image"), "hdr": sonde["hdr"], "bande": bande, "reglages": reglages, "mesures": mesures}


def mesures_passe(avant: list[dict], apres: list[dict], reference: dict | None) -> dict:
    """Contrôles d'image (n° 17, L7) : luminance, bruit du visage (jamais plus que l'original), teinte, ΔE00."""
    import numpy as np

    def med(liste, cle_):
        v = [m[cle_] for m in liste if cle_ in m and m[cle_] == m[cle_]]
        return round(float(np.median(v)), 2) if v else None

    sortie: dict = {
        "luminanceVisageAvant": med(avant, "peauY"),
        "luminanceVisageApres": med(apres, "peauY"),
        "bruitVisageAvant": med(avant, "bruitPeau"),
        "bruitVisageApres": med(apres, "bruitPeau"),
    }
    if apres:
        peau = np.median(np.array([m["peauLab"] for m in apres]), axis=0)
        sortie["teintePeauDeg"] = round(math.degrees(math.atan2(peau[2], peau[1])) % 360, 1)
        sortie["peauLab"] = [round(float(x), 2) for x in peau]
        # V6 P0 n° 4 : le mur mesuré après retouche fait partie de la référence du look (« Garder pour les prochaines »).
        murs = [m["murLab"] for m in apres if "murLab" in m]
        if murs:
            sortie["murLab"] = [round(float(x), 2) for x in np.median(np.array(murs), axis=0)]
        if reference and "peauLab" in reference:
            sortie["deltaE00Peau"] = round(delta_e00(tuple(reference["peauLab"]), tuple(peau)), 2)
    if sortie["bruitVisageAvant"] and sortie["bruitVisageApres"] is not None:
        sortie["bruitRatio"] = round(sortie["bruitVisageApres"] / max(sortie["bruitVisageAvant"], 1e-6), 3)
    return sortie


# --------------------------------------------------------------------------------------------------------------------
# Étape « cadrage » : piste montée pré-cadrée + contrôles machine
# --------------------------------------------------------------------------------------------------------------------

def executer_cadrage(demande: dict, dossier: str, progression: Callable[[int], None]) -> dict:
    plans = [p for p in (parametre(demande, "plans") or []) if isinstance(p, dict)]
    if not plans:
        raise ErreurTravail("refuse", "Aucun plan à monter.", False)
    bande = parametre(demande, "bande") or {"x": 0}
    sortie = parametre(demande, "sortie") or {"largeur": 1080, "hauteur": 1920}
    W, H = int(sortie["largeur"]), int(sortie["hauteur"])
    # `preparer` : secours quand la passe image a échoué (une brique ratée n'empêche jamais la livraison) — on recadre
    # directement la PRISE (lue par son adresse, sans la copier), avec la préparation (rotation, HDR → SDR, 25 i/s).
    preparer = bool(parametre(demande, "preparer", False))
    if preparer:
        source = demande["source"]
        sonde = sonder(source)
        prep = filtre_preparation(sonde) + ","
        bande = {"x": 0}
    else:
        source = telecharger(demande["source"], os.path.join(dossier, "image-10bits.mp4"))
        sonde = sonder(source)
        prep = ""
    # Image réellement lue (prise préparée, ou bande de la passe) : un cadre qui la déborde est ramené dedans.
    image_lue = (sonde["largeur"], sonde["hauteur"])
    progression(5)
    # Lot G : Décor IA (lot E1) appliqué — sur ses intervalles (temps de la prise), le plan lit le passage retouché (à la
    # taille de la fenêtre du décor, 10 bits) au lieu de la passe image ; le son reste celui de la prise (son monté).
    decor = morceaux_decor(parametre(demande, "decor"), dossier) if not preparer else ([], None)
    morceaux = []
    cumul = 0
    for i, p in enumerate(plans):
        c = p["cadre"]
        debut = int(round(float(p["priseDebutSec"]) * IMAGES_PAR_SEC))
        # Bornes en images sur le temps du MONTAGE (aucune dérive cumulée avec le son monté).
        fin_montage = int(round(float(p["finSec"]) * IMAGES_PAR_SEC))
        images = max(1, fin_montage - cumul)
        cumul += images
        for j, (f0, f1, m) in enumerate(pieces_du_plan(debut, images, decor[0])):
            chemin = os.path.join(dossier, f"plan-{i:03d}-{j:02d}.mp4")
            morceaux.append(chemin)
            if os.path.exists(chemin):
                continue
            if m is None:
                src, depart = source, f0 / IMAGES_PAR_SEC
                largeur, hauteur, x, y = cadre_dans_image(int(c["x"]) - int(bande.get("x", 0)), int(c["y"]), int(c["largeur"]), int(c["hauteur"]), *image_lue)
                filtre_prep = prep
            else:
                f = decor[1]
                src, depart = m["chemin"], max(0.0, f0 / IMAGES_PAR_SEC - float(m["debutSec"]))
                largeur, hauteur, x, y = int(c["largeur"]), int(c["hauteur"]), max(0, int(c["x"]) - int(f["x"])), max(0, int(c["y"]) - int(f.get("y", 0)))
                filtre_prep = ""
            executer([
                "ffmpeg", "-v", "error", "-nostdin", "-y", "-ss", f"{depart:.3f}", *entree(src), "-frames:v", str(f1 - f0), "-an",
                "-vf", f"{filtre_prep}crop={largeur}:{hauteur}:{x}:{y},scale={W}:{H}:flags=lanczos,setsar=1,format=yuv420p10le,{ETIQUETTES_BT709}",
                "-c:v", "libx264", "-preset", "fast", "-crf", str(CRF_INTERMEDIAIRE), "-profile:v", "high10", "-g", str(IMAGES_PAR_SEC),
                "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", chemin + ".tmp.mp4",
            ])
            os.replace(chemin + ".tmp.mp4", chemin)
        progression(5 + int(70 * (i + 1) / len(plans)))
    liste = os.path.join(dossier, "plans.txt")
    with open(liste, "w", encoding="utf-8") as f:
        for m in morceaux:
            f.write(f"file '{m}'\n")
    video = os.path.join(dossier, "video.mp4")
    executer(["ffmpeg", "-v", "error", "-nostdin", "-y", "-f", "concat", "-safe", "0", "-i", liste, "-c", "copy", video])
    final = os.path.join(dossier, "montage.mov")
    son = parametre(demande, "son")
    if isinstance(son, str) and son:
        son_local = telecharger(son, os.path.join(dossier, "son.flac"))
        executer(["ffmpeg", "-v", "error", "-nostdin", "-y", "-i", video, *entree(son_local), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "pcm_s24le", "-shortest", final])
    else:
        executer(["ffmpeg", "-v", "error", "-nostdin", "-y", "-i", video, "-c", "copy", final])
    progression(82)
    prise = parametre(demande, "prise")
    controles = controles_machine(final, plans, parametre(demande, "piste"), dossier, bool(son), prise if isinstance(prise, str) and prise else None, (W, H))
    progression(95)
    deposer_fichier(depot(demande, "montage"), final, "video/quicktime")
    duree = cumul / IMAGES_PAR_SEC
    sortie_vignette = {}
    if (demande.get("depots") or {}).get("vignette"):
        # Vignette : une image en pleine phrase (v4 n° 23 : image 0 = visage en pleine phrase), en JPEG.
        vignette = os.path.join(dossier, "vignette.jpg")
        executer(["ffmpeg", "-v", "error", "-nostdin", "-y", "-ss", f"{min(0.5, duree / 2):.2f}", "-i", final, "-frames:v", "1", "-q:v", "3", vignette])
        deposer_fichier(depot(demande, "vignette"), vignette, "image/jpeg")
        sortie_vignette = {"vignetteCle": cle(demande, "vignette")}
    nettoyer_dossier(dossier)
    return {"fichierCle": cle(demande, "montage"), **sortie_vignette, "dureeSec": round(duree, 3), "largeur": W, "hauteur": H, "controles": controles}


def cadre_dans_image(x: int, y: int, largeur: int, hauteur: int, image_largeur: int, image_hauteur: int) -> tuple[int, int, int, int]:
    """Cadre (taille, position) ramené dans l'image lue, rapport gardé, pixels pairs (Vérif V2, 10/10) : un plan calculé
    pour une autre source (visage non suivi : source supposée 3840 × 2160) ne fait plus échouer FFmpeg."""
    if image_largeur <= 0 or image_hauteur <= 0:
        return largeur, hauteur, max(0, x), max(0, y)
    echelle = min(1.0, image_largeur / max(largeur, 1), image_hauteur / max(hauteur, 1))
    if echelle < 1.0:
        cx, cy = x + largeur / 2, y + hauteur / 2
        largeur, hauteur = 2 * int(largeur * echelle / 2), 2 * int(hauteur * echelle / 2)
        x, y = int(cx - largeur / 2), int(cy - hauteur / 2)
    x = min(max(0, x), image_largeur - largeur)
    y = min(max(0, y), image_hauteur - hauteur)
    return largeur, hauteur, x - x % 2, y - y % 2


def morceaux_decor(plan, dossier: str) -> tuple[list[dict], dict | None]:
    """Morceaux retouchés du plan `decor` (appliqué seulement), téléchargés une fois ; et la fenêtre du décor (px)."""
    # Lot K : un plan « effets » (effets réalistes par IA, sans décor) se lit de la même façon ; morceaux `effet`.
    if not isinstance(plan, dict) or not (plan.get("decorApplique") or plan.get("effets")) or not isinstance(plan.get("fenetre"), dict):
        return [], None
    sortie = []
    for k, m in enumerate(plan.get("morceaux") or []):
        if not isinstance(m, dict) or m.get("source") not in ("decor", "effet") or not isinstance(m.get("adresse"), str):
            continue
        chemin = telecharger(m["adresse"], os.path.join(dossier, f"decor-{k:03d}.mp4"))
        sortie.append({"debutSec": float(m["debutSec"]), "finSec": float(m["finSec"]), "chemin": chemin})
    return sortie, plan["fenetre"]


def pieces_du_plan(debut: int, images: int, decor: list[dict]) -> list[tuple[int, int, dict | None]]:
    """Le plan [debut, debut + images[ (images de la prise) coupé aux bornes des morceaux du décor."""
    bornes = {debut, debut + images}
    for m in decor:
        for b in (int(round(m["debutSec"] * IMAGES_PAR_SEC)), int(round(m["finSec"] * IMAGES_PAR_SEC))):
            if debut < b < debut + images:
                bornes.add(b)
    liste = sorted(bornes)
    pieces = []
    for f0, f1 in zip(liste, liste[1:]):
        milieu = (f0 + f1) / 2 / IMAGES_PAR_SEC
        m = next((x for x in decor if x["debutSec"] <= milieu < x["finSec"]), None)
        pieces.append((f0, f1, m))
    return pieces


def detections(chemin: str, filtre: str, motif: str) -> list[dict]:
    r = subprocess.run(["ffmpeg", "-v", "info", "-nostdin", "-i", chemin, "-an", "-vf", filtre, "-f", "null", "-"], capture_output=True)
    texte = r.stderr.decode("utf-8", "replace")
    return [{k: float(v) for k, v in m.groupdict().items()} for m in re.finditer(motif, texte)]


# Version des contrôles machine rendus par le cadrage. 2 (10/10, `docs/facecam/JOURNAL-CONTROLES-QUALITE.md`) : synchro
# mesurée contre le son de la PRISE, visage (luminance, teinte) mesuré sur la piste montée elle-même. Une reprise dont les
# contrôles sont plus anciens refait le cadrage (ses mesures n'étaient pas fiables).
VERSION_CONTROLES = 2
# Synchro : enveloppe du son à 100 Hz, recherche à ± 1 s, corrélation minimale pour conclure.
ENVELOPPE_HZ = 100
SYNCHRO_RECHERCHE_SEC = 1.0
SYNCHRO_CORRELATION_MIN = 0.3
# Visage : instants mesurés sur la piste montée ; zones de peau dans la boîte de l'ovale (x0, y0, x1, y1 relatifs).
VISAGE_INSTANTS = 12
ZONES_PEAU = ((0.20, 0.52, 0.38, 0.68), (0.62, 0.52, 0.80, 0.68), (0.36, 0.12, 0.64, 0.26))
# Décodage comme un lecteur : matrice BT.709 et plage tv EXPLICITES (la conversion par défaut de swscale est BT.601 :
# la peau ColorChecker (194, 150, 130) se lit alors (188, 146, 131)), arrondis exacts, 16 bits.
DECODAGE_BT709 = "scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int"


def controles_machine(chemin: str, plans: list[dict], adresse_piste, dossier: str, avec_son: bool, prise: str | None = None, sortie_px: tuple[int, int] | None = None) -> dict:
    """Contrôles avant Claude (n° 24) : noirs, images figées, image isolée à une coupe, niveau sonore, synchro, visage."""
    from .son import mesurer_ebur128

    noirs = detections(chemin, "blackdetect=d=0.08:pix_th=0.06", r"black_start:(?P<debut>[\d.]+) black_end:(?P<fin>[\d.]+)")
    figes = detections(chemin, "freezedetect=n=-60dB:d=2", r"freeze_start: (?P<debut>[\d.]+)")
    isolees = [i for i, p in enumerate(plans) if (float(p["finSec"]) - float(p["debutSec"])) * IMAGES_PAR_SEC < 3]
    sortie: dict = {"version": VERSION_CONTROLES, "noirs": noirs, "figes": figes, "imagesIsolees": isolees}
    piste = None
    if isinstance(adresse_piste, str) and adresse_piste:
        try:
            piste = lire_json_gz(adresse_piste, dossier, "piste-controle")
        except Exception:  # noqa: BLE001 — un contrôle raté ne bloque jamais la livraison
            piste = None
    if avec_son:
        niveau = mesurer_ebur128(chemin)
        sortie["niveauLufs"] = niveau["lufs"]
        sortie["cretedBTP"] = niveau["crete"]
        try:
            synchro = decalage_synchro(chemin, plans, prise) if prise else None
        except Exception:  # noqa: BLE001
            synchro = None
        sortie["decalageSynchroImages"] = synchro["images"] if synchro else None
        if synchro:
            sortie["synchro"] = synchro
    if piste and sortie_px:
        try:
            visage = mesurer_visage_montage(chemin, plans, piste, sortie_px)
        except Exception:  # noqa: BLE001
            visage = None
        if visage:
            sortie["visage"] = visage
    return sortie


def enveloppe_son(son, frequence: int):
    """Enveloppe du son à `ENVELOPPE_HZ` : log de l'énergie (dB) par fenêtre de 10 ms, plancher à −50 dB du maximum
    (les silences débruités et ceux de la prise se valent), centrée sur une moyenne glissante de 0,5 s (le niveau, la
    compression et le débruitage ne déplacent pas les attaques des syllabes, seules utiles ici)."""
    import numpy as np

    pas = frequence // ENVELOPPE_HZ
    n = len(son) // pas
    if n == 0:
        return np.zeros(0)
    e = 10 * np.log10((son[: n * pas].reshape(n, pas).astype(np.float64) ** 2).mean(1) + 1e-12)
    e = np.maximum(e, e.max() - 50)
    k = ENVELOPPE_HZ // 2
    return e - np.convolve(e, np.ones(k) / k, mode="same")


def decalage_flux(chemin: str) -> float:
    """Retard du départ de l'IMAGE sur l'origine du conteneur (s). Le son, lui, est lu sur cette origine
    (`FILTRE_SON_ALIGNE`) : son propre départ tardif est déjà dans la corrélation, pas ici."""
    import json

    r = executer(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,start_time", "-of", "json", chemin])
    debuts: dict[str, float] = {}
    for f in json.loads(r.stdout or b"{}").get("streams", []):
        try:
            debuts.setdefault(str(f.get("codec_type")), float(f.get("start_time")))
        except (TypeError, ValueError):
            continue
    if "video" not in debuts or not debuts:
        return 0.0
    return debuts["video"] - min(debuts.values())


def decalage_synchro(chemin: str, plans: list[dict], prise: str) -> dict | None:
    """Décalage son-image de la piste montée, en images (> 0 : le son arrive APRÈS l'image ; |décalage| > 1 = anomalie).

    Le son de chaque plan doit être celui de la PRISE au même instant (`priseDebutSec`) : on corrèle l'enveloppe du son
    monté avec celle de la prise remise sur le temps du montage, plan par plan, puis on ajoute l'écart de départ des
    flux du fichier. Aucune hypothèse sur la voix : l'ancienne mesure (ouverture de la bouche contre énergie de la voix)
    portait le décalage NATUREL de la parole (la bouche s'ouvre 100 à 200 ms avant le son) et ne regardait pas le
    fichier image ; sa fenêtre de ± 5 images rendait 5 dès que le maximum tombait au bord. Rend None si le son est trop
    court ou trop peu corrélé pour conclure (jamais une fausse alerte)."""
    import numpy as np

    from .son import lire_son

    frequence = 8000
    monte = enveloppe_son(lire_son(chemin, frequence), frequence)
    source = enveloppe_son(lire_son(prise, frequence), frequence)
    n = len(monte)
    if n < 3 * ENVELOPPE_HZ or len(source) == 0:
        return None
    attendu = np.full(n, np.nan)
    for p in plans:
        d = int(round(float(p["debutSec"]) * ENVELOPPE_HZ))
        f = min(n, int(round(float(p["finSec"]) * ENVELOPPE_HZ)))
        s0 = int(round(float(p["priseDebutSec"]) * ENVELOPPE_HZ))
        if f <= d:
            continue
        idx = s0 + np.arange(f - d)
        ok = (idx >= 0) & (idx < len(source))
        attendu[d:f][ok] = source[idx[ok]]
    # On ne garde que la parole (enveloppe attendue au-dessus de sa médiane), loin des raccords (ton de pièce, fondus).
    rayon = int(SYNCHRO_RECHERCHE_SEC * ENVELOPPE_HZ)
    valide = ~np.isnan(attendu)
    if valide.sum() < 2 * ENVELOPPE_HZ:
        return None
    a = np.where(valide, attendu, 0.0)
    scores = {}
    for k in range(-rayon, rayon + 1):
        # k > 0 : le son monté est en RETARD de k centièmes sur la prise.
        x = monte[max(0, k) : n + min(0, k)]
        y = a[max(0, -k) : n - max(0, k)]
        v = valide[max(0, -k) : n - max(0, k)]
        if v.sum() < ENVELOPPE_HZ:
            continue
        x, y = x[v] - x[v].mean(), y[v] - y[v].mean()
        scores[k] = float(np.dot(x, y) / (np.linalg.norm(x) * np.linalg.norm(y) + 1e-12))
    if not scores:
        return None
    k = max(scores, key=scores.get)
    if scores[k] < SYNCHRO_CORRELATION_MIN or abs(k) >= rayon:
        return None
    # Sous-échantillon : parabole sur les trois scores autour du maximum.
    if k - 1 in scores and k + 1 in scores:
        g, c, dr = scores[k - 1], scores[k], scores[k + 1]
        den = g - 2 * c + dr
        k = k + (0.5 * (g - dr) / den if den < 0 else 0.0)
    son_sec = k / ENVELOPPE_HZ
    flux_sec = decalage_flux(chemin)
    total = son_sec - flux_sec
    return {"images": int(round(total * IMAGES_PAR_SEC)), "ms": round(total * 1000), "sonMs": round(son_sec * 1000), "fluxMs": round(flux_sec * 1000), "correlation": round(scores[max(scores, key=scores.get)], 3)}


def boite_visage_a(piste: dict, t: float):
    """Boîte de l'ovale (x, y, largeur, hauteur relatifs à la source) à l'instant `t` de la prise ; None sans visage."""
    ech = [e for e in piste.get("echantillons", []) if e.get("confiance", 1) and isinstance(e.get("boite"), list)]
    if not ech:
        return None
    e = min(ech, key=lambda x: abs(float(x["t"]) - t))
    return e["boite"] if abs(float(e["t"]) - t) <= 0.5 else None


def mesurer_visage_montage(chemin: str, plans: list[dict], piste: dict, sortie_px: tuple[int, int]) -> dict | None:
    """Luminance et teinte de la peau mesurées sur la PISTE MONTÉE (après la passe, la LUT et l'encodage 10 bits),
    décodée comme un lecteur : YUV BT.709 plage tv → R'G'B' (matrice EXPLICITE, jamais la BT.601 par défaut).

    Zones : deux joues et le front, dans la boîte de l'ovale (piste du visage, remise dans le cadre du plan) — loin des
    yeux, des sourcils, des narines et des lèvres. Luminance = luma BT.709 (0,2126 R' + 0,7152 G' + 0,0722 B') en
    pleine plage 0-255 ; teinte = angle h_ab de CIELAB (D65) sur les médianes de a* et b*."""
    import numpy as np

    W, H = sortie_px
    pistes_l, pistes_h = float(piste.get("largeurSource") or 0), float(piste.get("hauteurSource") or 0)
    if not plans or pistes_l <= 0 or pistes_h <= 0:
        return None
    duree = max(float(p["finSec"]) for p in plans)
    lumas, l_s, a_s, b_s = [], [], [], []
    for k in range(VISAGE_INSTANTS):
        t = duree * (k + 0.5) / VISAGE_INSTANTS
        p = next((x for x in plans if float(x["debutSec"]) <= t < float(x["finSec"])), None)
        if p is None:
            continue
        boite = boite_visage_a(piste, float(p["priseDebutSec"]) + t - float(p["debutSec"]))
        if boite is None:
            continue
        c = p["cadre"]
        ex, ey = W / float(c["largeur"]), H / float(c["hauteur"])
        bx, by = (boite[0] * pistes_l - float(c["x"])) * ex, (boite[1] * pistes_h - float(c["y"])) * ey
        bw, bh = boite[2] * pistes_l * ex, boite[3] * pistes_h * ey
        # `fps` : sans lui, FFmpeg ne rend AUCUNE image d'un `-ss` qui ne tombe pas sur une image (cas mesuré en 6.1).
        brut = next(lire_images(chemin, f"fps={IMAGES_PAR_SEC}:start_time=0,{DECODAGE_BT709}", W, H, t, 1.0 / IMAGES_PAR_SEC, profondeur16=True), None)
        if brut is None:
            continue
        img = np.frombuffer(brut, np.uint16).reshape(H, W, 3)
        pixels = []
        for (x0, y0, x1, y1) in ZONES_PEAU:
            xa, xb = int(max(0, bx + x0 * bw)), int(min(W, bx + x1 * bw))
            ya, yb = int(max(0, by + y0 * bh)), int(min(H, by + y1 * bh))
            if xb - xa >= 2 and yb - ya >= 2:
                pixels.append(img[ya:yb, xa:xb].reshape(-1, 3))
        if not pixels:
            continue
        zone = np.concatenate(pixels).astype(np.float32) / 65535.0
        if len(zone) < 50:
            continue
        lumas.append(float(np.median(zone @ np.array([0.2126, 0.7152, 0.0722], np.float32))) * 255.0)
        lab_z = lab(zone.reshape(-1, 1, 3)).reshape(-1, 3)
        l_s.append(float(np.median(lab_z[:, 0])))
        a_s.append(float(np.median(lab_z[:, 1])))
        b_s.append(float(np.median(lab_z[:, 2])))
    if len(lumas) < 3:
        return None
    a, b = float(np.median(a_s)), float(np.median(b_s))
    return {
        "luminance": round(float(np.median(lumas)), 1),
        "teinteDeg": round(math.degrees(math.atan2(b, a)) % 360, 1),
        "peauLab": [round(float(np.median(l_s)), 2), round(a, 2), round(b, 2)],
        "images": len(lumas),
    }


# --------------------------------------------------------------------------------------------------------------------
# Étape « images » (lot G) : images de contrôle de la vidéo FINIE pour la relecture Claude ciblée (B.24)
# --------------------------------------------------------------------------------------------------------------------

def executer_images(demande: dict, dossier: str, progression: Callable[[int], None]) -> dict:
    """Une image JPEG par instant demandé (raccords, cartes, 3 premières secondes, dernière image), 540 px de large."""
    instants = [i for i in (parametre(demande, "instants") or []) if isinstance(i, dict) and isinstance(i.get("nom"), str)]
    if not instants:
        raise ErreurTravail("refuse", "Aucune image de contrôle demandée.", False)
    if len(instants) > 40:
        raise ErreurTravail("refuse", "Trop d'images de contrôle (40 au plus).", False)
    largeur = int(parametre(demande, "largeur", 540) or 540)
    largeur -= largeur % 2
    source = demande["source"]
    images = []
    for k, i in enumerate(instants):
        nom = re.sub(r"[^A-Za-z0-9_-]", "-", i["nom"])[:60]
        chemin = os.path.join(dossier, f"{nom}.jpg")
        t = max(0.0, float(i.get("instantSec", 0)))
        executer(["ffmpeg", "-v", "error", "-nostdin", "-y", "-ss", f"{t:.3f}", *entree(source), "-frames:v", "1", "-vf", f"scale={largeur}:-2:flags=lanczos", "-q:v", "4", chemin])
        if not os.path.exists(chemin):
            continue
        deposer_fichier(depot(demande, i["nom"]), chemin, "image/jpeg")
        images.append({"nom": i["nom"], "cle": cle(demande, i["nom"]), "instantSec": round(t, 3)})
        progression(int(95 * (k + 1) / len(instants)))
    nettoyer_dossier(dossier)
    return {"images": images}


def executer_image(demande: dict, dossier: str, progression: Callable[[int], None]) -> dict:
    etape = parametre(demande, "etape", "passe")
    if etape in ("extraire", "reposer", "mesurer"):
        # Lot G : Décor IA (lot E1) — extraire un passage, reposer le passage retouché, mesurer le raccord.
        from .decor import executer_extraire, executer_mesurer, executer_reposer

        return {"extraire": executer_extraire, "reposer": executer_reposer, "mesurer": executer_mesurer}[etape](demande, dossier, progression)
    if parametre(demande, "etape", "passe") == "images":
        return executer_images(demande, dossier, progression)
    if parametre(demande, "etape", "passe") == "cadrage":
        return executer_cadrage(demande, dossier, progression)
    return executer_passe(demande, dossier, progression)
