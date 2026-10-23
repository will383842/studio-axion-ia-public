"""studio-aligneur RÉEL (serveur, travaux sur disque, exécutants son / image / visages), sauf /transcrire :
Whisper (Hugging Face) est injoignable ici → transcription remplacée par les mots connus de la prise synthétique."""
import json, os, sys
sys.path.insert(0, "/home/user/studio-axion-ia/studio-aligneur")
from aligneur.facecam import TravauxFacecam
from aligneur.serveur import FileAlignement, creer_serveur
from aligneur.image import executer_image
from aligneur.son import executer_son
from aligneur.visages import executer_visages
from aligneur.media import sonder, cle, depot, deposer_json_gz
MOTS = os.environ["V2_MOTS"]
def transcrire(demande, dossier, progression):
    s = sonder(demande["source"])
    d = json.load(open(MOTS))
    deposer_json_gz(depot(demande, "transcription"), {"version": 1, "modele": "fixe", "mots": d["mots"], "segments": []}, dossier, "transcription")
    return {"transcriptionCle": cle(demande, "transcription"), "dureeSec": round(s["duree"], 3), "mots": d["mots"], "largeurSource": s["largeur"], "hauteurSource": s["hauteur"]}
travaux = TravauxFacecam(os.environ.get("V2_TRAVAUX", "/tmp/claude-0/v2/travaux"), {"transcrire": transcrire, "visages": executer_visages, "image": executer_image, "son": executer_son})
srv = creer_serveur(FileAlignement(lambda *a, **k: {}), ("127.0.0.1", int(os.environ.get("PORT", "4200"))), cle="cle-essai", modele="essai", facecam=travaux)
print("aligneur prêt", flush=True)
srv.serve_forever()
