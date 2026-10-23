"""
Travaux du format face caméra (plan facecam v4, lot A « Fondations ») — SQUELETTE.

Routes ajoutées au MÊME serveur que le calage (même clé `STUDIO_RENDU_CLE`, en-tête `x-studio-rendu-cle`) :
  POST /transcrire  /visages  /image  /son  /segmenter   → 202 { idTravail, nouveau }  (idempotent)
  GET  /<route>/{idTravail}                               → état du travail (404 { statut: "inconnu" })
Tant qu'une route n'a pas d'exécutant (lots B à D), elle répond proprement 501 :
  { statut: "echec", erreur: { code: "non-implemente", reessayable: false, message } }

Règles (v4 n° 6) : chaque travail vit SUR DISQUE (un dossier par travail, état en JSON, repris après un redémarrage),
UN SEUL travail lourd à la fois (un seul fil de calcul), par tranches de 30 s côté exécutant. Les résultats lourds
partent sur R2 (adresses signées reçues dans la demande) : l'état ne garde que des clés et des mesures.
"""
from __future__ import annotations

import json
import os
import queue
import re
import shutil
import threading
import time
import traceback
from typing import Any, Callable

from .media import ErreurTravail, nettoyer_dossier

ROUTES_FACECAM = ("transcrire", "visages", "image", "son", "segmenter")
IDENT_VALIDE = re.compile(r"^[A-Za-z0-9_-]{1,200}$")
DOSSIER_PAR_DEFAUT = "/tmp/studio-aligneur-travaux"
DUREE_GARDE_SEC = 24 * 3600

# executer(demande, dossier_du_travail, progression) → résultat (dict : clés R2 et mesures, jamais de données lourdes).
Executant = Callable[[dict, str, Callable[[int], None]], dict]


def non_implemente(route: str) -> dict:
    return {"statut": "echec", "erreur": {"code": "non-implemente", "reessayable": False, "message": f"La route /{route} n'est pas encore disponible."}}


def verifier_demande_facecam(d: Any) -> str | None:
    if not isinstance(d, dict):
        return "demande illisible"
    if not isinstance(d.get("idTravail"), str) or not IDENT_VALIDE.match(d["idTravail"]):
        return "idTravail manquant ou mal formé"
    source = d.get("source")
    if not isinstance(source, str) or not source.startswith(("http://", "https://")):
        return "adresse de la source manquante"
    return None


class TravauxFacecam:
    """Travaux sur disque, un fil de calcul : en_file → en_cours → termine | echec. Idempotent par (route, id)."""

    def __init__(self, dossier: str = DOSSIER_PAR_DEFAUT, executants: dict[str, Executant] | None = None, horloge: Callable[[], float] = time.time, verrou_lourd: threading.Lock | None = None):
        self._dossier = dossier
        self._executants = dict(executants or {})
        self._horloge = horloge
        self._verrou = threading.Lock()
        # Vérif V5 : verrou PARTAGÉ avec le calage (`FileAlignement`) : un seul calcul lourd à la fois dans le conteneur.
        self._lourd = verrou_lourd or threading.Lock()
        self._attente: "queue.Queue[tuple[str, dict]]" = queue.Queue()
        os.makedirs(dossier, exist_ok=True)
        self._reprendre_apres_redemarrage()
        self._fil = threading.Thread(target=self._boucle, daemon=True, name="facecam")
        self._fil.start()

    def implementee(self, route: str) -> bool:
        return route in self._executants

    def _chemin(self, route: str, ident: str) -> str:
        return os.path.join(self._dossier, route, ident)

    def _lire(self, route: str, ident: str) -> dict | None:
        try:
            with open(os.path.join(self._chemin(route, ident), "etat.json"), encoding="utf-8") as f:
                return json.load(f)
        except (OSError, ValueError):
            return None

    def _ecrire(self, route: str, ident: str, etat: dict) -> None:
        dossier = self._chemin(route, ident)
        os.makedirs(dossier, exist_ok=True)
        provisoire = os.path.join(dossier, "etat.json.tmp")
        with open(provisoire, "w", encoding="utf-8") as f:
            json.dump({**etat, "depuis": self._horloge()}, f, ensure_ascii=False)
        os.replace(provisoire, os.path.join(dossier, "etat.json"))

    def _travaux_sur_disque(self):
        for route in ROUTES_FACECAM:
            racine = os.path.join(self._dossier, route)
            if not os.path.isdir(racine):
                continue
            for ident in sorted(os.listdir(racine)):
                yield route, ident, self._lire(route, ident)

    def purger_anciens(self) -> list[str]:
        """Oublie les travaux FINIS (termine, echec) de plus de 24 h. Jamais un travail en file ou en cours.
        Vérif V5 : appelé avant chaque travail (avant : seulement au démarrage du conteneur)."""
        effaces = []
        limite = self._horloge() - DUREE_GARDE_SEC
        for route, ident, etat in list(self._travaux_sur_disque()):
            if etat is not None and etat.get("statut") in ("termine", "echec") and etat.get("depuis", 0) < limite:
                shutil.rmtree(self._chemin(route, ident), ignore_errors=True)
                effaces.append(f"{route}/{ident}")
        return effaces

    def _reprendre_apres_redemarrage(self) -> None:
        """Un travail resté « en_cours » ou « en_file » au redémarrage repasse en file ; les vieux finis s'oublient."""
        self.purger_anciens()
        for route, ident, etat in list(self._travaux_sur_disque()):
            if etat is not None and etat.get("statut") in ("en_file", "en_cours") and isinstance(etat.get("demande"), dict):
                self._ecrire(route, ident, {"statut": "en_file", "demande": etat["demande"]})
                self._attente.put((route, etat["demande"]))

    def soumettre(self, route: str, demande: dict) -> tuple[int, dict]:
        if route not in self._executants:
            return 501, non_implemente(route)
        ident = demande["idTravail"]
        with self._verrou:
            if self._lire(route, ident) is not None:
                return 202, {"idTravail": ident, "nouveau": False}
            self._ecrire(route, ident, {"statut": "en_file", "demande": demande})
        self._attente.put((route, demande))
        return 202, {"idTravail": ident, "nouveau": True}

    def etat(self, route: str, ident: str) -> dict | None:
        if not IDENT_VALIDE.match(ident):
            return None
        e = self._lire(route, ident)
        return None if e is None else {k: v for k, v in e.items() if k not in ("depuis", "demande")}

    def _boucle(self) -> None:
        while True:
            route, demande = self._attente.get()
            ident = demande["idTravail"]
            dossier = self._chemin(route, ident)

            def progression(p: int, route: str = route, ident: str = ident, demande: dict = demande) -> None:
                self._ecrire(route, ident, {"statut": "en_cours", "progression": max(0, min(99, int(p))), "demande": demande})

            try:
                self.purger_anciens()
            except OSError:
                pass
            progression(1)
            try:
                with self._lourd:
                    resultat = self._executants[route](demande, dossier, progression)
                self._ecrire(route, ident, {"statut": "termine", "resultat": resultat})
            except MemoryError:
                self._ecrire(route, ident, {"statut": "echec", "erreur": {"code": "indisponible", "reessayable": True, "message": "Mémoire insuffisante."}})
            except ErreurTravail as e:
                # Lot B : panne typée d'un exécutant, rendue telle quelle (code, réessayable, message lisible).
                self._ecrire(route, ident, {"statut": "echec", "erreur": {"code": e.code, "reessayable": e.reessayable, "message": e.message}})
            except Exception as e:  # noqa: BLE001 — toute panne devient un échec typé, jamais un plantage
                traceback.print_exc()
                self._ecrire(route, ident, {"statut": "echec", "erreur": {"code": "inconnu", "reessayable": True, "message": f"Travail impossible ({type(e).__name__})."}})
            # Vérif V5 : un travail ROUTÉ en échec ne sert plus (le studio resoumet sous un autre identifiant) : ses
            # fichiers lourds (tranches, vidéos) sont effacés tout de suite ; seul l'état reste (24 h).
            if (self._lire(route, ident) or {}).get("statut") == "echec" and os.path.isdir(dossier):
                nettoyer_dossier(dossier)
