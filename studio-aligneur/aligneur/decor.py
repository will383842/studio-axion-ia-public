"""
Décor IA (plan facecam v4 n° 32, lot E1 ; routes du lot G) : trois étapes de la route `/image` autour d'un passage
retouché par Higgsfield. Aucun appel à Higgsfield ici : le studio lui envoie le passage extrait et dépose sa sortie.

ÉTAPE « extraire » — l'IMAGE SEULE (sans son) d'un passage de la passe image (10 bits, temps de la prise), dans la
fenêtre 9:16 du décor (`fenetre` : colonne de la bande), en H.264 8 bits 720 × 1280 (ce que Higgsfield accepte).

ÉTAPE « reposer » — le passage retouché (24 i/s, ≈ 704 × 1248) remis à 25 i/s SANS CHANGER LA VITESSE (`fps=25`,
duplication d'images, jamais `setpts`), à la taille de la fenêtre, coupé à la durée exacte du passage d'origine, en
10 bits (comme la passe image). Le cadrage (`decor` du plan) le relit à la place de la passe sur cet intervalle.

ÉTAPE « mesurer » — le raccord du passage retouché contre l'original et la VOIX D'ORIGINE : écart bouche / voix (ms),
ressemblance du visage (0 à 1), part des images où le visage est trouvé. Calculs purs dans `ecart_bouche_ms`,
`ressemblance_points` (testés sans MediaPipe) ; MediaPipe ne sert qu'à lire les points.
"""
from __future__ import annotations

import os
from typing import Callable

from .media import ETIQUETTES_BT709, IMAGES_PAR_SEC, ErreurTravail, cle, depot, deposer_fichier, entree, executer, nettoyer_dossier, parametre, sonder

LARGEUR_HIGGSFIELD = 720
HAUTEUR_HIGGSFIELD = 1280
CRF_DECOR = 8
# Mesures : chaque image (écart bouche / voix au pas de 40 ms), analyse à 360 px de large (le visage occupe la fenêtre).
PAS_MESURE = 1
LARGEUR_MESURE = 360
# Points pour la ressemblance : ovale, yeux, sourcils, nez (indices MediaPipe, sous-ensemble stable).
POINTS_FORME = [10, 152, 234, 454, 33, 133, 362, 263, 70, 107, 300, 336, 1, 4, 61, 291]
LEVRE_HAUT, LEVRE_BAS, COIN_G, COIN_D = 13, 14, 61, 291


def _fenetre(demande: dict, sonde: dict) -> dict:
    f = parametre(demande, "fenetre") or {}
    largeur = int(f.get("largeur") or round(sonde["hauteur"] * 9 / 16))
    hauteur = int(f.get("hauteur") or sonde["hauteur"])
    x = int(max(0, min(sonde["largeur"] - largeur, int(f.get("x", (sonde["largeur"] - largeur) // 2)))))
    y = int(max(0, min(sonde["hauteur"] - hauteur, int(f.get("y", 0)))))
    return {"x": x - x % 2, "y": y - y % 2, "largeur": largeur - largeur % 2, "hauteur": hauteur - hauteur % 2}


def _intervalle(demande: dict) -> tuple[float, float]:
    debut = float(parametre(demande, "debutSec", 0) or 0)
    fin = float(parametre(demande, "finSec", 0) or 0)
    if fin <= debut:
        raise ErreurTravail("refuse", "Passage du décor vide.", False)
    return debut, fin


def executer_extraire(demande: dict, dossier: str, progression: Callable[[int], None]) -> dict:
    sonde = sonder(demande["source"])
    debut, fin = _intervalle(demande)
    f = _fenetre(demande, sonde)
    sortie = os.path.join(dossier, "passage.mp4")
    executer([
        "ffmpeg", "-v", "error", "-nostdin", "-y", "-ss", f"{debut:.3f}", *entree(demande["source"]), "-t", f"{fin - debut:.3f}", "-an",
        "-vf", f"crop={f['largeur']}:{f['hauteur']}:{f['x']}:{f['y']},scale={LARGEUR_HIGGSFIELD}:{HAUTEUR_HIGGSFIELD}:flags=lanczos,setsar=1,format=yuv420p",
        "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-r", str(IMAGES_PAR_SEC), "-movflags", "+faststart", sortie,
    ])
    progression(80)
    deposer_fichier(depot(demande, "passage"), sortie, "video/mp4")
    duree = sonder(sortie)["duree"]
    nettoyer_dossier(dossier)
    return {"fichierCle": cle(demande, "passage"), "dureeSec": round(duree, 3), "fenetre": f}


def executer_reposer(demande: dict, dossier: str, progression: Callable[[int], None]) -> dict:
    """`source` : la sortie de Higgsfield déposée par le studio ; `conversion` : filtre `fps=25,…` et durée exacte."""
    conversion = parametre(demande, "conversion") or {}
    filtre = str(conversion.get("filtreVideo") or f"fps={IMAGES_PAR_SEC}")
    if "setpts" in filtre or "atempo" in filtre:
        raise ErreurTravail("refuse", "Le décor ne change jamais la vitesse (ni setpts ni atempo).", False)
    duree = float(conversion.get("dureeSec") or 0)
    if duree <= 0:
        raise ErreurTravail("refuse", "Durée du passage manquante.", False)
    taille = parametre(demande, "taille") or {}
    echelle = f",scale={int(taille['largeur'])}:{int(taille['hauteur'])}:flags=lanczos,setsar=1" if taille.get("largeur") and taille.get("hauteur") else ""
    sortie = os.path.join(dossier, "decor.mp4")
    # Lot K (effet réaliste par IA, facultatif) : couleurs accordées sur le passage d'origine (le Look Will réappliqué)
    # et fondu de raccord court avec lui aux deux bouts. Absent : exactement comme avant (Décor IA).
    original = parametre(demande, "original")
    fondu = float(parametre(demande, "fonduSec", 0) or 0)
    accorder = parametre(demande, "accorderCouleurs") is True
    if isinstance(original, str) and original and (fondu > 0 or accorder):
        local = telecharger_original(original, dossier)
        gains = gains_couleur(stats_rgb(demande["source"], dossier, "sortie"), stats_rgb(local, dossier, "origine")) if accorder else None
        complexe = filtre_reposer_effet(filtre, echelle, duree, fondu, gains)
        executer([
            "ffmpeg", "-v", "error", "-nostdin", "-y", *entree(demande["source"]), "-i", local, "-an", "-t", f"{duree:.3f}",
            "-filter_complex", complexe, "-map", "[v]",
            "-c:v", "libx264", "-preset", "fast", "-crf", str(CRF_DECOR), "-profile:v", "high10", "-g", str(IMAGES_PAR_SEC),
            "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-movflags", "+faststart", sortie,
        ])
    else:
        executer([
            "ffmpeg", "-v", "error", "-nostdin", "-y", *entree(demande["source"]), "-an", "-t", f"{duree:.3f}",
            "-vf", f"{filtre}{echelle},format=yuv420p10le,{ETIQUETTES_BT709}",
            "-c:v", "libx264", "-preset", "fast", "-crf", str(CRF_DECOR), "-profile:v", "high10", "-g", str(IMAGES_PAR_SEC),
            "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-movflags", "+faststart", sortie,
        ])
    progression(85)
    s = sonder(sortie)
    deposer_fichier(depot(demande, "decor"), sortie, "video/mp4")
    nettoyer_dossier(dossier)
    return {"fichierCle": cle(demande, "decor"), "dureeSec": round(s["duree"], 3), "ips": IMAGES_PAR_SEC}


# --------------------------------------------------------------------------------------------------------------------
# Lot K : effet réaliste par IA — couleurs accordées et fondu de raccord (calculs purs, sans numpy)
# --------------------------------------------------------------------------------------------------------------------

# Gain par canal borné : l'accord corrige une dérive de teinte du modèle, jamais un changement de lumière voulu.
GAIN_MIN, GAIN_MAX = 0.8, 1.25
DECALAGE_MAX = 0.12
# Images lues pour les statistiques : aux bords du passage (l'objet ajouté est surtout au milieu).
POSITIONS_STATS = (0.04, 0.1, 0.16, 0.84, 0.9, 0.96)
TAILLE_STATS = (36, 64)


def telecharger_original(adresse: str, dossier: str) -> str:
    if os.path.exists(adresse):
        return adresse
    from .image import telecharger

    return telecharger(adresse, os.path.join(dossier, "original.mp4"))


def stats_rgb(source: str, dossier: str, nom: str) -> list[tuple[float, float]] | None:
    """Moyenne et écart type par canal (0-1) sur quelques images des bords du passage, en petit (rawvideo rgb24)."""
    import subprocess

    try:
        duree = float(sonder(source)["duree"])
    except Exception:  # noqa: BLE001 — une source illisible donne « pas d'accord »
        return None
    w, h = TAILLE_STATS
    valeurs: list[list[float]] = [[], [], []]
    for k, pos in enumerate(POSITIONS_STATS):
        r = subprocess.run(
            ["ffmpeg", "-v", "error", "-nostdin", "-ss", f"{max(0.0, pos * duree):.3f}", *entree(source), "-frames:v", "1", "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            capture_output=True,
        )
        octets = r.stdout
        if len(octets) < w * h * 3:
            continue
        for i in range(0, w * h * 3, 3):
            valeurs[0].append(octets[i] / 255)
            valeurs[1].append(octets[i + 1] / 255)
            valeurs[2].append(octets[i + 2] / 255)
    if not valeurs[0]:
        return None
    sortie = []
    for v in valeurs:
        m = sum(v) / len(v)
        e = (sum((x - m) ** 2 for x in v) / len(v)) ** 0.5
        sortie.append((m, e))
    return sortie


def gains_couleur(sortie: list[tuple[float, float]] | None, origine: list[tuple[float, float]] | None) -> list[tuple[float, float]] | None:
    """Par canal : y = a·x + b qui ramène la moyenne et l'écart type de la sortie sur ceux de l'origine (bornés)."""
    if not sortie or not origine or len(sortie) != 3 or len(origine) != 3:
        return None
    gains = []
    for (ms, es), (mo, eo) in zip(sortie, origine):
        a = min(GAIN_MAX, max(GAIN_MIN, eo / es)) if es > 1e-4 else 1.0
        b = min(DECALAGE_MAX, max(-DECALAGE_MAX, mo - a * ms))
        gains.append((round(a, 4), round(b, 4)))
    return gains


def filtre_accord(gains: list[tuple[float, float]] | None) -> str:
    """`lutrgb` en 16 bits par canal (aucune perte de la passe 10 bits) ; sans gains : rien."""
    if not gains:
        return ""
    r, g, b = (f"clip(val*{a}+{d}*maxval,minval,maxval)" for a, d in gains)
    return f",format=rgb48le,lutrgb=r='{r}':g='{g}':b='{b}'"


def filtre_reposer_effet(filtre: str, echelle: str, duree: float, fondu: float, gains: list[tuple[float, float]] | None) -> str:
    """Graphe FFmpeg : sortie (0) à 25 i/s, accordée, fondue aux deux bouts avec l'origine (1). Vitesse inchangée."""
    if "setpts" in filtre or "atempo" in filtre:
        raise ErreurTravail("refuse", "L'effet ne change jamais la vitesse (ni setpts ni atempo).", False)
    effet = f"[0:v]{filtre}{echelle}{filtre_accord(gains)},format=yuv420p10le[e]"
    if fondu <= 0:
        return f"{effet};[e]{ETIQUETTES_BT709}[v]"
    f = max(0.04, min(fondu, duree / 4))
    origine = f"[1:v]fps={IMAGES_PAR_SEC}{echelle},format=yuv420p10le[o]"
    melange = f"[o][e]blend=all_expr='A+(B-A)*clip(min(T/{f:.3f},({duree:.3f}-T)/{f:.3f}),0,1)',{ETIQUETTES_BT709}[v]"
    return f"{effet};{origine};{melange}"


# --------------------------------------------------------------------------------------------------------------------
# Mesures (pures)
# --------------------------------------------------------------------------------------------------------------------

def ecart_bouche_ms(bouche: list[float], energie: list[float], images_par_sec: float = IMAGES_PAR_SEC, decalage_max: int = 6) -> float | None:
    """Décalage (ms) qui aligne le mieux l'ouverture de la bouche et l'énergie de la voix ; positif = image en retard."""
    import numpy as np

    n = min(len(bouche), len(energie))
    if n < images_par_sec:
        return None
    b = np.asarray(bouche[:n], dtype=np.float64)
    e = np.asarray(energie[:n], dtype=np.float64)
    if b.std() < 1e-9 or e.std() < 1e-9:
        return None
    b = (b - b.mean()) / b.std()
    e = (e - e.mean()) / e.std()
    scores = {}
    for k in range(-decalage_max, decalage_max + 1):
        # k > 0 : la bouche bouge k images APRÈS la voix (image en retard).
        x = b[k:] if k >= 0 else b[: n + k]
        y = e[: n - k] if k >= 0 else e[-k:]
        if len(x) > images_par_sec // 2:
            scores[k] = float(np.dot(x, y) / len(x))
    if not scores:
        return None
    meilleur = max(scores, key=scores.get)
    return round(meilleur * 1000.0 / images_par_sec, 1)


def _forme(points) -> "object | None":
    import numpy as np

    p = np.asarray(points, dtype=np.float64)
    if p.ndim != 2 or len(p) < 4:
        return None
    p = p - p.mean(axis=0)
    echelle = np.sqrt((p ** 2).sum(axis=1).mean())
    return None if echelle < 1e-9 else (p / echelle).ravel()


def ressemblance_points(a: list[list[list[float]]], b: list[list[list[float]]]) -> float | None:
    """Ressemblance (0 à 1) de la FORME du visage (points normalisés, médiane sur le passage) entre deux vidéos."""
    import numpy as np

    fa = [f for f in (_forme(x) for x in a) if f is not None]
    fb = [f for f in (_forme(x) for x in b) if f is not None]
    if not fa or not fb:
        return None
    ma, mb = np.median(np.array(fa), axis=0), np.median(np.array(fb), axis=0)
    cos = float(np.dot(ma, mb) / (np.linalg.norm(ma) * np.linalg.norm(mb) + 1e-12))
    # Deux visages différents gardent une forme proche (≈ 0,9) : on étire l'échelle pour que 0,85 soit exigeant.
    return round(max(0.0, min(1.0, 1.0 - (1.0 - cos) * 10.0)), 4)


def ouverture_bouche(points) -> float:
    """Ouverture de la bouche (lèvres intérieures) rapportée à sa largeur ; `points` : dict indice → (x, y)."""
    haut, bas, g, d = points[LEVRE_HAUT], points[LEVRE_BAS], points[COIN_G], points[COIN_D]
    largeur = ((d[0] - g[0]) ** 2 + (d[1] - g[1]) ** 2) ** 0.5
    return 0.0 if largeur < 1e-9 else (((bas[0] - haut[0]) ** 2 + (bas[1] - haut[1]) ** 2) ** 0.5) / largeur


def _lire_points(source: str, dossier: str) -> tuple[list, list[float], int, int]:
    """Points (forme) et ouverture de la bouche, une image sur `PAS_MESURE` ; rend aussi trouvées / lues."""
    import mediapipe as mp
    import numpy as np
    from mediapipe.tasks import python as mpt
    from mediapipe.tasks.python import vision

    from .media import lire_images
    from .visages import MODELE_VISAGE, chemin_modele

    s = sonder(source)
    largeur = LARGEUR_MESURE
    hauteur = int(round(s["hauteur"] * largeur / max(1, s["largeur"]) / 2)) * 2
    detecteur = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=chemin_modele(MODELE_VISAGE)), running_mode=vision.RunningMode.VIDEO, num_faces=1))
    formes, bouche, trouvees, lues = [], [], 0, 0
    try:
        for n, brut in enumerate(lire_images(source, f"scale={largeur}:{hauteur}:flags=area", largeur, hauteur)):
            ms = int(round(n * 1000 / IMAGES_PAR_SEC))
            if n % PAS_MESURE:
                continue
            lues += 1
            image = np.frombuffer(brut, np.uint8).reshape(hauteur, largeur, 3)
            r = detecteur.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(image)), ms)
            if not r.face_landmarks:
                bouche.append(bouche[-1] if bouche else 0.0)
                continue
            lm = r.face_landmarks[0]
            trouvees += 1
            formes.append([[lm[i].x * largeur, lm[i].y * hauteur] for i in POINTS_FORME])
            bouche.append(ouverture_bouche({i: (lm[i].x * largeur, lm[i].y * hauteur) for i in (LEVRE_HAUT, LEVRE_BAS, COIN_G, COIN_D)}))
    finally:
        detecteur.close()
    return formes, bouche, trouvees, lues


def _energie_voix(source: str, debut: float, fin: float, pas: int) -> list[float]:
    import numpy as np

    r = executer(["ffmpeg", "-v", "error", "-nostdin", "-ss", f"{debut:.3f}", *entree(source), "-t", f"{fin - debut:.3f}", "-vn", "-ac", "1", "-ar", "8000", "-f", "f32le", "pipe:1"])
    son = np.frombuffer(r.stdout, np.float32)
    fenetre = 8000 * pas // IMAGES_PAR_SEC
    n = len(son) // max(1, fenetre)
    return [] if n == 0 else np.sqrt((son[: n * fenetre].reshape(n, fenetre) ** 2).mean(1)).tolist()


def executer_mesurer(demande: dict, dossier: str, progression: Callable[[int], None]) -> dict:
    """`source` : le passage retouché ; `original` : le passage extrait ; `voix` : la prise (son d'origine)."""
    original = parametre(demande, "original")
    voix = parametre(demande, "voix")
    if not isinstance(original, str) or not isinstance(voix, str):
        raise ErreurTravail("refuse", "Mesure du décor : original ou voix manquant.", False)
    debut, fin = _intervalle(demande)
    try:
        formes_d, bouche_d, trouvees, lues = _lire_points(demande["source"], dossier)
        progression(45)
        formes_o, _, _, _ = _lire_points(original, dossier)
    except ImportError as e:
        raise ErreurTravail("indisponible", "Mesure du visage indisponible (MediaPipe absent).", False) from e
    progression(85)
    energie = _energie_voix(voix, debut, fin, PAS_MESURE)
    ecart = ecart_bouche_ms(bouche_d, energie, IMAGES_PAR_SEC / PAS_MESURE)
    nettoyer_dossier(dossier)
    # Mesure impossible : `None` (JSON valide) ; le studio juge alors « mesure impossible » et garde le vrai décor.
    return {
        "ecartBoucheMs": ecart,
        "ressemblanceVisage": ressemblance_points(formes_o, formes_d) if formes_o and formes_d else 0.0,
        "visageTrouvePct": round(100.0 * trouvees / max(1, lues), 1),
    }
