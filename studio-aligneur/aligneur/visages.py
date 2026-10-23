"""
Route `/visages` (plan facecam v4, lot B) : points du visage (MediaPipe FaceLandmarker, 478 points, Apache 2.0) et
mains (MediaPipe HandLandmarker), une image sur 2 (12,5 par seconde) pour le visage et une sur 6 pour les mains, sur
la prise PRÉPARÉE (rotation, HDR → SDR, 25 i/s) réduite à 960 px de large. Lissage ALLER-RETOUR (aucun retard) et
trous comblés par interpolation. Travail par tranches de 30 s, chaque tranche gardée sur disque (reprise après un
redémarrage).

Deux dépôts json.gz sur R2 :
  - `piste` : la piste légère lue par le studio (brique `realisation`, format `src/briques/realisation/piste.ts`) ;
  - `points` : les points utiles aux masques (ovale, yeux, sourcils, bouche, iris), lus par la passe image `/image`.
Résultat : { pisteVisageCle, pointsCle, visageTrouvePct, luminanceMoyenne, largeurSource, hauteurSource }.
"""
from __future__ import annotations

import json
import os
from typing import Callable

from .media import IMAGES_PAR_SEC, ErreurTravail, cle, depot, deposer_json_gz, filtre_preparation, lire_images, nettoyer_dossier, parametre, sonder, tranches

DOSSIER_MODELES = os.environ.get("STUDIO_MEDIAPIPE_DOSSIER", "/app/modeles/mediapipe")
MODELE_VISAGE = "face_landmarker.task"
MODELE_MAINS = "hand_landmarker.task"
ADRESSES_MODELES = {
    MODELE_VISAGE: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    MODELE_MAINS: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
}
LARGEUR_ANALYSE = 720
PAS_VISAGE = 2
PAS_MAINS = 6

# Points MediaPipe gardés pour les masques de la passe image (mêmes listes que les prototypes du 08/10).
OVALE = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
OEIL_G = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
OEIL_D = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
BOUCHE = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
LEVRES_INT = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191]
SOURCIL_G = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46]
SOURCIL_D = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276]
IRIS = [468, 473]
INDICES_POINTS = sorted(set(OVALE + OEIL_G + OEIL_D + BOUCHE + LEVRES_INT + SOURCIL_G + SOURCIL_D + IRIS))


def chemin_modele(nom: str) -> str:
    return os.path.join(DOSSIER_MODELES, nom)


def precharger_modeles() -> None:
    """Téléchargés à la construction de l'image (aucun téléchargement au premier appel)."""
    import urllib.request

    os.makedirs(DOSSIER_MODELES, exist_ok=True)
    for nom, adresse in ADRESSES_MODELES.items():
        if not os.path.exists(chemin_modele(nom)):
            urllib.request.urlretrieve(adresse, chemin_modele(nom))


def lisser_aller_retour(valeurs, alpha: float = 0.35):
    """Lissage exponentiel aller puis retour : aucun retard (le cadre ne « traîne » pas derrière la tête)."""
    import numpy as np

    v = np.asarray(valeurs, dtype=np.float64).copy()
    if len(v) < 3:
        return v
    for i in range(1, len(v)):
        v[i] = alpha * v[i] + (1 - alpha) * v[i - 1]
    for i in range(len(v) - 2, -1, -1):
        v[i] = alpha * v[i] + (1 - alpha) * v[i + 1]
    return v


def combler(t, valeurs, trouve):
    """Interpolation linéaire des instants sans visage (aux bords : valeur la plus proche)."""
    import numpy as np

    t = np.asarray(t, dtype=np.float64)
    v = np.asarray(valeurs, dtype=np.float64)
    ok = np.asarray(trouve, dtype=bool)
    if ok.sum() == 0:
        return v
    if v.ndim == 1:
        return np.interp(t, t[ok], v[ok])
    return np.stack([np.interp(t, t[ok], v[ok, k]) for k in range(v.shape[1])], axis=1)


def details_main(main, cote_brut):
    """Lot I2 : les 21 points MediaPipe Hands (x, y normalisés, z en part de la largeur, 4 décimales) et le côté de
    la main de la personne (« Left » → gauche, vérifié sur une photo non retournée). Côté inconnu : absent."""
    sortie = {"points": [[round(float(p.x), 4), round(float(p.y), 4), round(float(p.z), 4)] for p in main]}
    cote = {"Left": "gauche", "Right": "droite"}.get(cote_brut or "")
    if cote:
        sortie["cote"] = cote
    return sortie


def recaler_main(m, bande, largeur_source):
    """Ramène une main lue dans la bande analysée aux coordonnées de la source (x et les points ; z suit l'échelle de
    la largeur). Sans bande : inchangée."""
    if not bande:
        return m
    echelle = bande["largeur"] / largeur_source
    sortie = {**m, "x": round((bande["x"] + m["x"] * bande["largeur"]) / largeur_source, 4)}
    if m.get("points"):
        sortie["points"] = [[round((bande["x"] + p[0] * bande["largeur"]) / largeur_source, 4), p[1], round(p[2] * echelle, 4)] for p in m["points"]]
    return sortie


def analyser_tranche(source: str, filtre: str, largeur: int, hauteur: int, debut: float, duree: float, detecteurs, index_global: int) -> dict:
    """Une tranche de 30 s : points du visage une image sur 2, mains une image sur 6."""
    import mediapipe as mp
    import numpy as np

    visage, mains = detecteurs
    t_list, pts_list, trouve, lum = [], [], [], []
    mains_sortie = []
    for n, brut in enumerate(lire_images(source, filtre, largeur, hauteur, debut, duree)):
        if n % PAS_VISAGE:
            continue
        t = debut + n / IMAGES_PAR_SEC
        image = np.frombuffer(brut, np.uint8).reshape(hauteur, largeur, 3)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(image))
        ms = int(round(t * 1000))
        r = visage.detect_for_video(mp_image, ms)
        t_list.append(round(t, 3))
        if r.face_landmarks:
            lm = r.face_landmarks[0]
            pts = np.array([[lm[i].x, lm[i].y] for i in INDICES_POINTS], dtype=np.float32)
            pts_list.append(pts)
            trouve.append(True)
            xs = [lm[i].x for i in OVALE]
            ys = [lm[i].y for i in OVALE]
            x0, x1 = max(0, int(min(xs) * largeur)), min(largeur, int(max(xs) * largeur))
            y0, y1 = max(0, int(min(ys) * hauteur)), min(hauteur, int(max(ys) * hauteur))
            if x1 > x0 and y1 > y0:
                zone = image[y0:y1, x0:x1].astype(np.float32)
                lum.append(float((zone[..., 0] * 0.299 + zone[..., 1] * 0.587 + zone[..., 2] * 0.114).mean()))
        else:
            pts_list.append(np.zeros((len(INDICES_POINTS), 2), np.float32))
            trouve.append(False)
        if mains is not None and (n // PAS_VISAGE) % (PAS_MAINS // PAS_VISAGE) == 0:
            rm = mains.detect_for_video(mp_image, ms)
            cotes = rm.handedness or []
            for i_main, main in enumerate(rm.hand_landmarks or []):
                paume = [main[0], main[5], main[9], main[13], main[17]]
                x = sum(p.x for p in paume) / 5
                y = sum(p.y for p in paume) / 5
                # Main ouverte : les bouts des doigts loin du poignet.
                ouverte = sum(((main[k].x - main[0].x) ** 2 + (main[k].y - main[0].y) ** 2) ** 0.5 for k in (8, 12, 16, 20)) / 4 > 1.6 * (((main[9].x - main[0].x) ** 2 + (main[9].y - main[0].y) ** 2) ** 0.5)
                cote = cotes[i_main][0].category_name if i_main < len(cotes) and cotes[i_main] else None
                mains_sortie.append({"t": round(t, 3), "x": round(x, 4), "y": round(y, 4), "ouverte": bool(ouverte), **details_main(main, cote)})
    return {
        "index": index_global,
        "t": t_list,
        "points": [p.round(4).tolist() for p in pts_list],
        "trouve": trouve,
        "luminances": lum,
        "mains": mains_sortie,
    }


def bande_analyse(sonde: dict, demandee: dict | None) -> dict:
    """Même bande que la passe image (`image.bande_utile`) : colonne 9:16 × 1,35, centrée, sauf bande demandée."""
    w, h = sonde["largeur"], sonde["hauteur"]
    if isinstance(demandee, dict) and "x" in demandee and "largeur" in demandee:
        largeur = int(min(w, max(64, int(demandee["largeur"]))))
        x = int(min(max(0, int(demandee["x"])), w - largeur))
    else:
        largeur = int(min(w, round(h * 9 / 16 * 1.35)))
        x = (w - largeur) // 2
    largeur -= largeur % 2
    return {"x": x - x % 2, "largeur": largeur}


def reperer_visage(source: str, sonde: dict, vision, mpt) -> float | None:
    """Centre horizontal (0-1) du visage sur l'image entière, médiane de 5 images réparties ; `None` si introuvable."""
    import mediapipe as mp
    import numpy as np

    largeur = min(1920, sonde["largeur"])
    hauteur = int(round(sonde["hauteur"] * largeur / max(sonde["largeur"], 1) / 2)) * 2
    filtre = filtre_preparation(sonde, largeur)
    detecteur = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=chemin_modele(MODELE_VISAGE)), num_faces=1))
    centres = []
    try:
        for k in range(5):
            t = sonde["duree"] * (k + 0.5) / 5
            brut = next(lire_images(source, filtre, largeur, hauteur, t, 1.0 / IMAGES_PAR_SEC), None)
            if brut is None:
                continue
            image = np.frombuffer(brut, np.uint8).reshape(hauteur, largeur, 3)
            r = detecteur.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(image)))
            if r.face_landmarks:
                centres.append(float(np.mean([p.x for p in r.face_landmarks[0]])))
    finally:
        detecteur.close()
    return float(np.median(centres)) if centres else None


def construire_piste(tranches_lues: list[dict], largeur_source: int, hauteur_source: int, bande: dict | None = None) -> tuple[dict, dict]:
    """Assemble les tranches, comble, lisse ; rend (piste légère, points des masques), positions sur la source entière."""
    import numpy as np

    t = np.array([x for tr in tranches_lues for x in tr["t"]], dtype=np.float64)
    trouve = np.array([x for tr in tranches_lues for x in tr["trouve"]], dtype=bool)
    if len(t) == 0 or trouve.sum() == 0:
        raise ErreurTravail("refuse", "Visage introuvable dans la vidéo.", False)
    pts = np.array([x for tr in tranches_lues for x in tr["points"]], dtype=np.float64)  # (N, P, 2)
    n, p, _ = pts.shape
    plat = combler(t, pts.reshape(n, p * 2), trouve)
    plat = np.stack([lisser_aller_retour(plat[:, k]) for k in range(plat.shape[1])], axis=1)
    pts = plat.reshape(n, p, 2)
    if bande:
        # Bande → source entière (x seulement : la bande garde toute la hauteur).
        pts[..., 0] = (bande["x"] + pts[..., 0] * bande["largeur"]) / largeur_source
    pos = {idx: k for k, idx in enumerate(INDICES_POINTS)}
    ovale = pts[:, [pos[i] for i in OVALE]]
    x0, y0 = ovale[..., 0].min(1), ovale[..., 1].min(1)
    x1, y1 = ovale[..., 0].max(1), ovale[..., 1].max(1)
    yeux = (pts[:, pos[IRIS[0]]] + pts[:, pos[IRIS[1]]]) / 2
    haut_bas = np.linalg.norm(pts[:, pos[10]] - pts[:, pos[152]], axis=1) + 1e-6
    ouverture = np.linalg.norm(pts[:, pos[13]] - pts[:, pos[14]], axis=1) / haut_bas
    bouche = np.clip(ouverture / 0.12, 0, 1)
    echantillons = [
        {
            "t": round(float(t[i]), 3),
            "yeuxX": round(float(yeux[i, 0]), 4),
            "yeuxY": round(float(yeux[i, 1]), 4),
            "boite": [round(float(x0[i]), 4), round(float(y0[i]), 4), round(float(x1[i] - x0[i]), 4), round(float(y1[i] - y0[i]), 4)],
            "bouche": round(float(bouche[i]), 3),
            "confiance": 1 if trouve[i] else 0,
        }
        for i in range(n)
    ]
    luminances = [x for tr in tranches_lues for x in tr["luminances"]]
    piste = {
        "version": 1,
        "largeurSource": largeur_source,
        "hauteurSource": hauteur_source,
        "imagesParSec": IMAGES_PAR_SEC,
        "echantillons": echantillons,
        "mains": [recaler_main(m, bande, largeur_source) for tr in tranches_lues for m in tr["mains"]],
        "visageTrouvePct": round(100.0 * float(trouve.mean()), 1),
        **({"luminanceVisage": round(float(np.median(luminances)), 1)} if luminances else {}),
    }
    points = {"version": 1, "indices": INDICES_POINTS, "t": [round(float(x), 3) for x in t], "points": pts.round(4).reshape(n, p * 2).tolist(), "confiance": [1 if x else 0 for x in trouve]}
    return piste, points


def executer_visages(demande: dict, dossier: str, progression: Callable[[int], None]) -> dict:
    from mediapipe.tasks import python as mpt
    from mediapipe.tasks.python import vision

    sonde = sonder(demande["source"])
    # On analyse la BANDE utile (colonne 9:16 avec la marge des zooms) : sur l'image 16:9 entière, le visage est trop
    # petit pour le détecteur de MediaPipe (portée courte). Les positions sont ensuite ramenées à la source entière.
    bande = bande_analyse(sonde, parametre(demande, "bande"))
    if not isinstance(parametre(demande, "bande"), dict):
        # Sujet décentré : repérage sur l'image ENTIÈRE (5 images, 1920 px) puis bande centrée sur le visage.
        centre = reperer_visage(demande["source"], sonde, vision, mpt)
        if centre is not None:
            x = int(round(centre * sonde["largeur"] - bande["largeur"] / 2))
            x = max(0, min(sonde["largeur"] - bande["largeur"], x))
            bande = {"x": x - x % 2, "largeur": bande["largeur"]}
    largeur = LARGEUR_ANALYSE
    hauteur = int(round(sonde["hauteur"] * largeur / max(bande["largeur"], 1) / 2)) * 2
    filtre = f"{filtre_preparation(sonde)},crop={bande['largeur']}:{sonde['hauteur'] - sonde['hauteur'] % 2}:{bande['x']}:0,scale={largeur}:{hauteur}:flags=area"
    visage = vision.FaceLandmarker.create_from_options(
        vision.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=chemin_modele(MODELE_VISAGE)), running_mode=vision.RunningMode.VIDEO, num_faces=1)
    )
    mains = None
    if os.path.exists(chemin_modele(MODELE_MAINS)):
        mains = vision.HandLandmarker.create_from_options(
            vision.HandLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=chemin_modele(MODELE_MAINS)), running_mode=vision.RunningMode.VIDEO, num_hands=2)
        )
    lues: list[dict] = []
    liste = tranches(sonde["duree"])
    try:
        for i, (debut, duree) in enumerate(liste):
            chemin = os.path.join(dossier, f"tranche-{i:03d}.json")
            if os.path.exists(chemin):
                with open(chemin, encoding="utf-8") as f:
                    lues.append(json.load(f))
                continue
            # MediaPipe exige des instants croissants : les tranches sont lues dans l'ordre, les tranches déjà faites sautées.
            tranche = analyser_tranche(demande["source"], filtre, largeur, hauteur, debut, duree, (visage, mains), i)
            with open(chemin + ".tmp", "w", encoding="utf-8") as f:
                json.dump(tranche, f)
            os.replace(chemin + ".tmp", chemin)
            lues.append(tranche)
            progression(5 + int(85 * (i + 1) / len(liste)))
    finally:
        visage.close()
        if mains is not None:
            mains.close()
    piste, points = construire_piste(lues, sonde["largeur"], sonde["hauteur"], bande)
    deposer_json_gz(depot(demande, "piste"), piste, dossier, "piste")
    deposer_json_gz(depot(demande, "points"), points, dossier, "points")
    nettoyer_dossier(dossier)
    return {
        "pisteVisageCle": cle(demande, "piste"),
        "pointsCle": cle(demande, "points"),
        "visageTrouvePct": piste["visageTrouvePct"],
        **({"luminanceMoyenne": piste["luminanceVisage"]} if "luminanceVisage" in piste else {}),
        "largeurSource": sonde["largeur"],
        "hauteurSource": sonde["hauteur"],
        "hdr": sonde["hdr"],
    }
