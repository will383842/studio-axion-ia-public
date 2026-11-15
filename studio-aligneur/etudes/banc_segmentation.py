"""Banc d'étude du détourage sur vraie prise (C5-5.20). ÉTUDE, hors production, gratuite.

Importé par aucun module du service, aucune route, rien ne se lance à l'import. Entrée : le chemin d'une prise sur le
poste (jamais dans le dépôt). Sortie : un JSON de chiffres (+ au plus 5 images de contrôle écrites hors du dépôt).
Le banc mesure un masque : il ne dessine rien sur le visage et ne publie rien.
"""
import argparse
import json
import os
import sys
import time

CLES_RESULTAT = ("methode", "images", "largeur", "hauteur", "temps_par_image_ms", "iou_voisines", "bord_incertain", "zones_de_bord", "fuites_tete")
BANDE_INCERTAINE = (0.3, 0.7)
MODELE_PAR_DEFAUT = "selfie_segmenter.tflite"
AIDE = "Banc d'étude du détourage (hors production, gratuit). Exemple : python etudes/banc_segmentation.py PRISE.mp4 --sortie /tmp/banc"


def iou(a, b) -> float:
    """Intersection sur union de deux masques (seuil 0,5) ; deux masques vides valent 1."""
    import numpy as np
    ma, mb = np.asarray(a) >= 0.5, np.asarray(b) >= 0.5
    union = int(np.logical_or(ma, mb).sum())
    return 1.0 if union == 0 else float(np.logical_and(ma, mb).sum()) / union


def part_bord_incertain(masque) -> float:
    """Part des pixels entre 0,3 et 0,7 (rapportée à l'image entière)."""
    import numpy as np
    m = np.asarray(masque)
    return float(((m > BANDE_INCERTAINE[0]) & (m < BANDE_INCERTAINE[1])).sum()) / max(1, m.size)


def zone_de_bord(masque, noyau: int = 9):
    """Anneau de bord (dilatation moins érosion du masque binaire) : là où vivent cheveux et mains."""
    import cv2
    import numpy as np
    b = (np.asarray(masque) >= 0.5).astype("uint8")
    k = np.ones((noyau, noyau), "uint8")
    return (cv2.dilate(b, k) - cv2.erode(b, k)) > 0


def mesures_image(masque) -> dict:
    """Cheveux/mains : incertitude moyenne dans le tiers haut (tête, cheveux) et le tiers bas (mains) de l'anneau de bord.
    Fuite autour de la tête : masque allumé loin du corps, dans le tiers haut, hors de la plus grande composante."""
    import cv2
    import numpy as np
    m = np.asarray(masque)
    h = m.shape[0]
    anneau = zone_de_bord(m)
    incertain = (m > BANDE_INCERTAINE[0]) & (m < BANDE_INCERTAINE[1])

    def part(zone):
        n = int(zone.sum())
        return float((incertain & zone).sum()) / n if n else 0.0

    haut, bas = np.zeros_like(anneau), np.zeros_like(anneau)
    haut[: h // 3], bas[2 * h // 3:] = True, True
    binaire = (m >= 0.5).astype("uint8")
    nb, etiquettes, stats, _ = cv2.connectedComponentsWithStats(binaire)
    fuite = 0.0
    if nb > 2:
        principal = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        reste = (binaire > 0) & (etiquettes != principal)
        fuite = float(reste[: h // 2].sum()) / max(1, binaire.sum())
    return {"cheveux": part(anneau & haut), "mains": part(anneau & bas), "fuite": fuite}


def segmenteur_fond_uni():
    """Méthode de référence gratuite et sans modèle : distance à la couleur de fond (médiane des bords de l'image)."""
    import numpy as np

    def segmenter(image):
        bords = np.concatenate([image[0], image[-1], image[:, 0], image[:, -1]]).astype("float32")
        fond = np.median(bords, axis=0)
        distance = np.linalg.norm(image.astype("float32") - fond, axis=2)
        return np.clip(distance / 60.0, 0.0, 1.0)

    return segmenter


def segmenteur_mediapipe(chemin_modele: str):
    """Segmentation de personne MediaPipe (Apache 2.0, déjà au requirements.txt). Le modèle .tflite est fourni sur le poste."""
    import mediapipe as mp
    from mediapipe.tasks import python as mpt
    from mediapipe.tasks.python import vision
    seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
        base_options=mpt.BaseOptions(model_asset_path=chemin_modele), output_confidence_masks=True, output_category_mask=False))

    def segmenter(image):
        import cv2
        import numpy as np
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        res = seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
        masques = res.confidence_masks
        return np.asarray(masques[-1].numpy_view(), dtype="float32").reshape(image.shape[:2])

    return segmenter


def mesurer(chemin: str, segmenter, methode: str, dossier_controle: str | None = None, max_images: int = 0) -> dict:
    import cv2
    import numpy as np
    cap = cv2.VideoCapture(chemin)
    if not cap.isOpened():
        raise ValueError(f"prise illisible : {chemin}")
    temps, ious, bords, cheveux, mains, fuites, precedent, n = [], [], [], [], [], [], None, 0
    largeur = hauteur = 0
    controles = []
    while True:
        ok, image = cap.read()
        if not ok or (max_images and n >= max_images):
            break
        hauteur, largeur = image.shape[:2]
        t0 = time.process_time()
        masque = np.asarray(segmenter(image), dtype="float32")
        temps.append((time.process_time() - t0) * 1000.0)
        if precedent is not None:
            ious.append(iou(precedent, masque))
        precedent = masque
        bords.append(part_bord_incertain(masque))
        z = mesures_image(masque)
        cheveux.append(z["cheveux"]); mains.append(z["mains"]); fuites.append(z["fuite"])
        if dossier_controle and len(controles) < 5 and n % 10 == 0:
            controles.append((n, masque))
        n += 1
    cap.release()
    if dossier_controle and controles:
        os.makedirs(dossier_controle, exist_ok=True)
        for i, m in controles:
            cv2.imwrite(os.path.join(dossier_controle, f"masque_{i:05d}.png"), (m * 255).astype("uint8"))

    def stat(v):
        return {"moyenne": float(np.mean(v)), "min": float(np.min(v)), "max": float(np.max(v))} if v else {"moyenne": 0.0, "min": 0.0, "max": 0.0}

    return {
        "methode": methode, "images": n, "largeur": largeur, "hauteur": hauteur,
        "temps_par_image_ms": {**stat(temps), "p95": float(np.percentile(temps, 95)) if temps else 0.0},
        "iou_voisines": stat(ious), "bord_incertain": stat(bords),
        "zones_de_bord": {"cheveux": stat(cheveux), "mains": stat(mains)}, "fuites_tete": stat(fuites),
    }


def principal(argv=None) -> int:
    p = argparse.ArgumentParser(prog="banc_segmentation", add_help=False, description=AIDE)
    p.add_argument("prise", nargs="?")
    p.add_argument("--methode", choices=("mediapipe", "fond-uni"), default="mediapipe")
    p.add_argument("--modele", default=os.path.join(os.environ.get("STUDIO_MEDIAPIPE_DOSSIER", "/app/modeles/mediapipe"), MODELE_PAR_DEFAUT))
    p.add_argument("--sortie", help="dossier HORS du dépôt pour le JSON et les images de contrôle")
    p.add_argument("--max-images", type=int, default=0)
    p.add_argument("--aide", "-h", "--help", action="store_true")
    a = p.parse_args(argv)
    if a.aide or not a.prise:
        print(AIDE)
        return 0
    segmenter = segmenteur_fond_uni() if a.methode == "fond-uni" else segmenteur_mediapipe(a.modele)
    res = mesurer(a.prise, segmenter, a.methode, a.sortie, a.max_images)
    texte = json.dumps(res, indent=2, ensure_ascii=False)
    if a.sortie:
        os.makedirs(a.sortie, exist_ok=True)
        with open(os.path.join(a.sortie, "banc_segmentation.json"), "w", encoding="utf-8") as f:
            f.write(texte)
    print(texte)
    return 0


if __name__ == "__main__":
    sys.exit(principal())
