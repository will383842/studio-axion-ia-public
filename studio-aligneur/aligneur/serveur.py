"""
Serveur HTTP de `studio-aligneur` (réseau `interne` du compose, jamais exposé) — même protocole que `studio-rendu` :
  POST /alignements        → { idAlignement, nouveau }  (202, réponse immédiate ; idempotent)
  GET  /alignements/{id}   → EtatAlignement             (404 { statut: "inconnu" } : après un redémarrage, par ex.)
  GET  /sante              → { ok, modele, file }
  POST /transcrire /visages /image /son /segmenter, GET /<route>/{id} → travaux face caméra (`facecam.py`, lot A :
                             501 « non-implemente » tant qu'une route n'a pas d'exécutant)
Clé partagée facultative `STUDIO_RENDU_CLE` (en-tête `x-studio-rendu-cle`), la même que `studio-rendu`.

Une demande à la fois (un seul fil de calcul), le reste attend en file. Audit D : un calcul a un délai maximal
(`DELAI_CALCUL_SEC`, 15 min ; `STUDIO_ALIGNEUR_DELAI_SEC`) ; au-delà il est abandonné (échec typé), la file est LIBÉRÉE
pour la demande suivante, et `/sante` répond 503 tant qu'un calcul figé occupe encore le processus (Docker le voit). Le son est lu par l'adresse signée reçue,
dans un dossier temporaire effacé après chaque demande. Les résultats restent en mémoire (6 h, 500 au plus) :
le studio les relit, puis ils s'oublient ; aucun fichier, aucune base.
"""
from __future__ import annotations

import hmac
import json
import os
import queue
import shutil
import tempfile
import threading
import time
import traceback
import urllib.error
import urllib.request
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable
from urllib.parse import unquote

from .facecam import ROUTES_FACECAM, TravauxFacecam, non_implemente, verifier_demande_facecam

CORPS_MAX = 1024 * 1024
SON_MAX = 200 * 1024 * 1024
DUREE_GARDE_SEC = 6 * 3600
GARDES_MAX = 500
DELAI_LECTURE_SEC = 120
# Audit D : délai maximal d'un calcul (lecture du son + calage). Le studio abandonne de son côté au bout de 20 min.
DELAI_CALCUL_SEC = 15 * 60

# calculer(chemin_son, texte, reference) → résultat (dict au format ResultatAlignement du studio).
Calcul = Callable[[str, str, "list[dict] | None"], dict]


class ErreurAlignement(Exception):
    def __init__(self, code: str, message: str, reessayable: bool):
        super().__init__(message)
        self.code = code
        self.message = message
        self.reessayable = reessayable

    def en_json(self) -> dict:
        return {"code": self.code, "reessayable": self.reessayable, "message": self.message}


def verifier_demande(d: Any) -> str | None:
    if not isinstance(d, dict):
        return "demande illisible"
    if not isinstance(d.get("idAlignement"), str) or not d["idAlignement"] or len(d["idAlignement"]) > 300:
        return "idAlignement manquant"
    if not isinstance(d.get("audio"), str) or not d["audio"].startswith(("http://", "https://")):
        return "adresse du son manquante"
    if not isinstance(d.get("texte"), str) or not d["texte"].strip():
        return "texte manquant"
    if len(d["texte"]) > 20000:
        return "texte trop long"
    if d.get("langue", "fr") != "fr":
        return "langue non prise en charge"
    ref = d.get("reference")
    if ref is not None and not (isinstance(ref, list) and all(isinstance(m, dict) for m in ref)):
        return "référence illisible"
    return None


def telecharger(adresse: str, dossier: str) -> str:
    """Lit le son par son adresse signée (taille bornée) ; erreur « fichier-inaccessible » si l'adresse ne répond pas."""
    chemin = os.path.join(dossier, "son")
    try:
        with urllib.request.urlopen(urllib.request.Request(adresse, headers={"user-agent": "studio-aligneur"}), timeout=DELAI_LECTURE_SEC) as r, open(chemin, "wb") as f:
            total = 0
            while True:
                bloc = r.read(1 << 16)
                if not bloc:
                    break
                total += len(bloc)
                if total > SON_MAX:
                    raise ErreurAlignement("refuse", "Son trop volumineux.", False)
                f.write(bloc)
    except ErreurAlignement:
        raise
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise ErreurAlignement("fichier-inaccessible", f"Son illisible à son adresse ({type(e).__name__}).", True) from e
    return chemin


class FileAlignement:
    """File d'attente à un seul fil : en_file → en_cours → termine | echec. Idempotente par identifiant."""

    def __init__(self, calculer: Calcul, lire_son: Callable[[str, str], str] = telecharger, horloge: Callable[[], float] = time.time, delai_calcul: float = DELAI_CALCUL_SEC, verrou_lourd: threading.Lock | None = None):
        self._calculer = calculer
        # Vérif V5 : verrou PARTAGÉ avec les travaux face caméra : un seul calcul lourd à la fois dans le conteneur. Il est
        # pris AVANT le décompte du délai (attendre une passe image n'est pas « figé ») et rendu à la fin du calcul, ou à
        # son abandon (audit D : un calcul figé ne bloque jamais la file ; `/sante` répond 503 tant qu'il vit).
        self._lourd = verrou_lourd or threading.Lock()
        self._delai_calcul = delai_calcul
        # Calculs abandonnés après le délai, dont le fil tourne encore (un fil Python ne s'arrête pas de force).
        self._figes: set[threading.Thread] = set()
        self._lire_son = lire_son
        self._horloge = horloge
        self._verrou = threading.Lock()
        self._etats: "OrderedDict[str, dict]" = OrderedDict()
        self._attente: "queue.Queue[dict]" = queue.Queue()
        self._ordre: list[str] = []
        self._fil = threading.Thread(target=self._boucle, daemon=True, name="calage")
        self._fil.start()

    def soumettre(self, demande: dict) -> bool:
        ident = demande["idAlignement"]
        with self._verrou:
            self._oublier_anciens()
            if ident in self._etats:
                return False
            self._etats[ident] = {"statut": "en_file", "depuis": self._horloge()}
            self._ordre.append(ident)
        self._attente.put(demande)
        return True

    def etat(self, ident: str) -> dict | None:
        with self._verrou:
            e = self._etats.get(ident)
            if e is None:
                return None
            if e["statut"] == "en_file":
                return {"statut": "en_file", "rang": self._ordre.index(ident) if ident in self._ordre else 0}
            return {k: v for k, v in e.items() if k != "depuis"}

    def resume(self) -> dict:
        with self._verrou:
            return {"enFile": len(self._ordre), "gardes": len(self._etats), "figes": self._compter_figes()}

    def _compter_figes(self) -> int:
        """Calculs abandonnés encore vivants (sous le verrou). Un calcul figé qui finit enfin n'est plus compté."""
        self._figes = {f for f in self._figes if f.is_alive()}
        return len(self._figes)

    def en_bonne_sante(self) -> bool:
        with self._verrou:
            return self._compter_figes() == 0

    def _oublier_anciens(self) -> None:
        limite = self._horloge() - DUREE_GARDE_SEC
        finis = [i for i, e in self._etats.items() if e["statut"] in ("termine", "echec")]
        for ident in finis:
            if self._etats[ident]["depuis"] < limite or len(self._etats) > GARDES_MAX:
                del self._etats[ident]

    def _poser(self, ident: str, etat: dict) -> None:
        with self._verrou:
            self._etats[ident] = {**etat, "depuis": self._horloge()}

    def _traiter(self, demande: dict, dossier: str, abandonne: threading.Event) -> dict:
        """Lecture du son puis calcul ; renvoie l'état final (jamais d'exception). Abandonné : n'écrit plus rien."""
        ident = demande["idAlignement"]
        try:
            son = self._lire_son(demande["audio"], dossier)
            with self._verrou:
                if not abandonne.is_set():
                    self._etats[ident] = {"statut": "en_cours", "progression": 40, "depuis": self._horloge()}
            resultat = self._calculer(son, demande["texte"], demande.get("reference"))
            return {"statut": "termine", "resultat": resultat}
        except ErreurAlignement as e:
            return {"statut": "echec", "erreur": e.en_json()}
        except MemoryError:
            return {"statut": "echec", "erreur": {"code": "indisponible", "reessayable": True, "message": "Mémoire insuffisante pour ce son."}}
        except Exception as e:  # noqa: BLE001 — toute panne du calcul devient un échec typé, jamais un plantage
            traceback.print_exc()
            return {"statut": "echec", "erreur": {"code": "inconnu", "reessayable": True, "message": f"Calage impossible ({type(e).__name__})."}}

    def _boucle(self) -> None:
        while True:
            demande = self._attente.get()
            ident = demande["idAlignement"]
            with self._verrou:
                if ident in self._ordre:
                    self._ordre.remove(ident)
            self._lourd.acquire()
            self._poser(ident, {"statut": "en_cours", "progression": 10})
            dossier = tempfile.mkdtemp(prefix="calage-")
            boite: dict = {}
            abandonne = threading.Event()

            rendu = threading.Event()
            garde = threading.Lock()

            def liberer(rendu: threading.Event = rendu, garde: threading.Lock = garde) -> None:
                with garde:
                    if not rendu.is_set():
                        rendu.set()
                        self._lourd.release()

            def calcul(demande: dict = demande, dossier: str = dossier, boite: dict = boite, abandonne: threading.Event = abandonne, liberer: Callable[[], None] = liberer) -> None:
                try:
                    boite.update(etat=self._traiter(demande, dossier, abandonne))
                finally:
                    liberer()

            fil = threading.Thread(target=calcul, daemon=True, name=f"calcul-{ident[:40]}")
            fil.start()
            fil.join(self._delai_calcul)
            if fil.is_alive():
                # Audit D : calcul figé. La file est libérée (demande suivante) ; le fil est compté comme figé (`/sante`).
                with self._verrou:
                    abandonne.set()
                    self._figes.add(fil)
                # Audit D : la file est libérée, le verrou lourd aussi (un calcul figé n'arrête pas tout le conteneur).
                liberer()
                print(f"calcul abandonné après {int(self._delai_calcul)} s : {ident}", flush=True)
                etat = {"statut": "echec", "erreur": {"code": "indisponible", "reessayable": False, "message": f"Calage abandonné : plus de {int(self._delai_calcul // 60) or 1} min de calcul."}}
            else:
                etat = boite.get("etat") or {"statut": "echec", "erreur": {"code": "inconnu", "reessayable": True, "message": "Calage impossible."}}
            self._poser(ident, etat)
            # Aucun fichier ne survit à la demande.
            shutil.rmtree(dossier, ignore_errors=True)


def creer_serveur(file: FileAlignement, adresse: tuple[str, int], cle: str | None = None, modele: str = "", facecam: TravauxFacecam | None = None) -> ThreadingHTTPServer:
    class Gestionnaire(BaseHTTPRequestHandler):
        server_version = "studio-aligneur"
        sys_version = ""

        def log_message(self, fmt: str, *args: Any) -> None:  # journal court, sans adresse signée
            chemin = self.path.split("?")[0]
            print(f"{self.command} {chemin} {args[1] if len(args) > 1 else ''}", flush=True)

        def _repondre(self, statut: int, corps: Any) -> None:
            texte = json.dumps(corps, ensure_ascii=False).encode("utf-8")
            self.send_response(statut)
            self.send_header("content-type", "application/json; charset=utf-8")
            self.send_header("cache-control", "no-store")
            self.send_header("content-length", str(len(texte)))
            self.end_headers()
            self.wfile.write(texte)

        def _cle_valide(self) -> bool:
            if not cle:
                return True
            recue = self.headers.get("x-studio-rendu-cle")
            return isinstance(recue, str) and hmac.compare_digest(recue.encode(), cle.encode())

        def do_GET(self) -> None:  # noqa: N802
            chemin = self.path.split("?")[0]
            if chemin == "/sante":
                # Audit D : un calcul figé occupe encore le processus → 503 (le conteneur passe « unhealthy »).
                ok = file.en_bonne_sante()
                return self._repondre(200 if ok else 503, {"ok": ok, "modele": modele, "file": file.resume()})
            if not self._cle_valide():
                return self._repondre(401, {"erreur": "clé invalide"})
            if chemin.startswith("/alignements/"):
                etat = file.etat(unquote(chemin[len("/alignements/"):]))
                return self._repondre(200, etat) if etat else self._repondre(404, {"statut": "inconnu"})
            route = chemin.split("/")[1] if chemin.count("/") == 2 else ""
            if route in ROUTES_FACECAM:
                if facecam is None or not facecam.implementee(route):
                    return self._repondre(501, non_implemente(route))
                etat = facecam.etat(route, unquote(chemin.split("/")[2]))
                return self._repondre(200, etat) if etat else self._repondre(404, {"statut": "inconnu"})
            return self._repondre(404, {"erreur": "introuvable"})

        def do_POST(self) -> None:  # noqa: N802
            if not self._cle_valide():
                return self._repondre(401, {"erreur": "clé invalide"})
            chemin = self.path.split("?")[0]
            route_facecam = chemin[1:] if chemin[1:] in ROUTES_FACECAM else None
            if chemin != "/alignements" and not route_facecam:
                return self._repondre(404, {"erreur": "introuvable"})
            longueur = int(self.headers.get("content-length") or 0)
            if longueur > CORPS_MAX:
                return self._repondre(413, {"erreur": "trop volumineux"})
            try:
                demande = json.loads(self.rfile.read(longueur).decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                return self._repondre(400, {"erreur": "demande illisible"})
            if route_facecam:
                if facecam is None or not facecam.implementee(route_facecam):
                    return self._repondre(501, non_implemente(route_facecam))
                probleme = verifier_demande_facecam(demande)
                if probleme:
                    return self._repondre(400, {"erreur": probleme})
                return self._repondre(*facecam.soumettre(route_facecam, demande))
            probleme = verifier_demande(demande)
            if probleme:
                return self._repondre(400, {"erreur": probleme})
            nouveau = file.soumettre(demande)
            return self._repondre(202, {"idAlignement": demande["idAlignement"], "nouveau": nouveau})

    return ThreadingHTTPServer(adresse, Gestionnaire)
