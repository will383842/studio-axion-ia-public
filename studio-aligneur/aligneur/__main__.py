"""
Point d'entrée du conteneur `studio-aligneur`.

  python -m aligneur                      → serveur HTTP sur PORT (4200 par défaut), clé STUDIO_RENDU_CLE OBLIGATOIRE
  python -m aligneur --precharger         → télécharge les modèles (calage, Whisper, MediaPipe, DeepFilterNet), puis s'arrête
  python -m aligneur --caler SON "TEXTE" [REFERENCE.json]  → calage d'un son en local, JSON sur la sortie
"""
from __future__ import annotations

import json
import os
import sys


def cle_obligatoire(env: dict[str, str]) -> str:
    """Lot R6 : le serveur ne démarre pas sans la clé partagée (jamais ouvert sans clé, même sur le réseau interne)."""
    cle = (env.get("STUDIO_RENDU_CLE") or "").strip()
    if not cle:
        raise SystemExit("studio-aligneur : STUDIO_RENDU_CLE manquante, refus de démarrer (même clé que studio-rendu).")
    return cle


def executants_facecam() -> dict:
    """Lot B : exécutants réels des routes face caméra (modèles chargés au premier travail). `/segmenter` reste à
    construire (lot D, à la demande) : sans exécutant, elle répond 501 « non-implemente »."""
    from .image import executer_image
    from .son import executer_son
    from .transcrire import executer_transcription
    from .visages import executer_visages

    return {"transcrire": executer_transcription, "visages": executer_visages, "image": executer_image, "son": executer_son}


def precharger_facecam() -> None:
    """Modèles face caméra téléchargés à la construction de l'image (aucun téléchargement au premier appel)."""
    from .transcrire import MODELE_WHISPER, charger_whisper
    from .visages import precharger_modeles

    charger_whisper()
    print(f"faster-whisper {MODELE_WHISPER} prêt.", flush=True)
    precharger_modeles()
    print("MediaPipe (visage, mains) prêt.", flush=True)
    try:
        from .son import charger_deepfilternet

        charger_deepfilternet()
        print("DeepFilterNet prêt.", flush=True)
    except Exception as e:  # noqa: BLE001 — la route /son se replie sur afftdn : la construction ne s'arrête pas
        print(f"DeepFilterNet indisponible ({type(e).__name__}) : secours afftdn.", flush=True)


def main() -> None:
    args = sys.argv[1:]
    if args[:1] == ["--precharger"]:
        from .calage import MODELE, charger_modele

        charger_modele()
        print(f"Modèle {MODELE} prêt.", flush=True)
        precharger_facecam()
        return
    if args[:1] == ["--caler"]:
        from .calage import caler

        reference = None
        if len(args) > 3:
            with open(args[3], encoding="utf-8") as f:
                reference = json.load(f)
        json.dump(caler(args[1], args[2], reference), sys.stdout, ensure_ascii=False, indent=1)
        return

    cle = cle_obligatoire(dict(os.environ))
    from .calage import MODELE, caler, charger_modele
    from .serveur import FileAlignement, creer_serveur

    charger_modele()  # le premier appel ne paie pas le chargement
    port = int(os.environ.get("PORT", "4200"))
    from .serveur import DELAI_CALCUL_SEC

    delai = float(os.environ.get("STUDIO_ALIGNEUR_DELAI_SEC") or DELAI_CALCUL_SEC)
    # Plan facecam v4 (lot A) : travaux face caméra sur disque (routes en squelette, 501 tant qu'elles n'ont pas d'exécutant).
    from .facecam import DOSSIER_PAR_DEFAUT, TravauxFacecam

    # Vérif V5 : UN calcul lourd à la fois dans le conteneur (calage OU travail face caméra), sous un seul verrou.
    import threading

    lourd = threading.Lock()
    facecam = TravauxFacecam(os.environ.get("STUDIO_ALIGNEUR_TRAVAUX") or DOSSIER_PAR_DEFAUT, executants_facecam(), verrou_lourd=lourd)
    serveur = creer_serveur(FileAlignement(caler, delai_calcul=delai, verrou_lourd=lourd), ("0.0.0.0", port), cle=cle, modele=f"whisperx:{MODELE}", facecam=facecam)
    print(f"studio-aligneur prêt sur le port {port}.", flush=True)
    serveur.serve_forever()


if __name__ == "__main__":
    main()
