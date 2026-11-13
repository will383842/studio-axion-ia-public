"""Routes face caméra (lot A) : 501 propre sans exécutant, même clé, travaux sur disque repris — sans modèle ni torch."""
import json
import os
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request

from aligneur.facecam import ROUTES_FACECAM, TravauxFacecam, verifier_demande_facecam
from aligneur.serveur import FileAlignement, creer_serveur

DEMANDE = {"idTravail": "t-1-transcrire", "source": "https://r2.exemple/prise.mov?sig=x"}


def appeler(base, chemin, corps=None, cle="secret"):
    entetes = {"content-type": "application/json"}
    if cle:
        entetes["x-studio-rendu-cle"] = cle
    req = urllib.request.Request(base + chemin, data=json.dumps(corps).encode() if corps is not None else None, headers=entetes, method="POST" if corps is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


class TestRoutesHttp(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.mkdtemp(prefix="facecam-essai-")
        self.travaux = TravauxFacecam(self.dossier, {"transcrire": lambda d, dossier, p: {"transcriptionCle": f"studio/dev/facecam/{d['idTravail']}.json.gz"}})
        self.serveur = creer_serveur(FileAlignement(lambda *a: {}, lambda a, d: ""), ("127.0.0.1", 0), cle="secret", facecam=self.travaux)
        import threading

        threading.Thread(target=self.serveur.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.serveur.server_address[1]}"

    def tearDown(self):
        self.serveur.shutdown()

    def test_non_implementee_501_propre(self):
        for route in [r for r in ROUTES_FACECAM if r != "transcrire"]:
            statut, corps = appeler(self.base, f"/{route}", DEMANDE)
            self.assertEqual(statut, 501)
            self.assertEqual(corps["erreur"]["code"], "non-implemente")
            self.assertFalse(corps["erreur"]["reessayable"])
            self.assertEqual(appeler(self.base, f"/{route}/x")[0], 501)

    def test_meme_cle(self):
        self.assertEqual(appeler(self.base, "/visages", DEMANDE, cle="faux")[0], 401)

    def test_travail_sur_disque_idempotent(self):
        self.assertEqual(appeler(self.base, "/transcrire", DEMANDE), (202, {"idTravail": DEMANDE["idTravail"], "nouveau": True}))
        self.assertEqual(appeler(self.base, "/transcrire", DEMANDE)[1]["nouveau"], False)
        fin = time.time() + 5
        while time.time() < fin:
            statut, etat = appeler(self.base, f"/transcrire/{DEMANDE['idTravail']}")
            if etat.get("statut") == "termine":
                break
            time.sleep(0.02)
        self.assertEqual(etat["resultat"]["transcriptionCle"], "studio/dev/facecam/t-1-transcrire.json.gz")
        self.assertNotIn("demande", etat)
        self.assertTrue(os.path.exists(os.path.join(self.dossier, "transcrire", DEMANDE["idTravail"], "etat.json")))
        self.assertEqual(appeler(self.base, "/transcrire/inconnu")[0], 404)
        self.assertEqual(appeler(self.base, "/transcrire", {"idTravail": "../x", "source": "https://a"})[0], 400)


class TestReprise(unittest.TestCase):
    def test_travail_en_cours_repris_apres_redemarrage(self):
        dossier = tempfile.mkdtemp(prefix="facecam-reprise-")
        os.makedirs(os.path.join(dossier, "son", "t-2"))
        with open(os.path.join(dossier, "son", "t-2", "etat.json"), "w") as f:
            json.dump({"statut": "en_cours", "progression": 40, "demande": {"idTravail": "t-2", "source": "https://a"}, "depuis": time.time()}, f)
        t = TravauxFacecam(dossier, {"son": lambda d, dossier, p: {"sonCle": "s"}})
        fin = time.time() + 5
        while time.time() < fin and (t.etat("son", "t-2") or {}).get("statut") != "termine":
            time.sleep(0.02)
        self.assertEqual(t.etat("son", "t-2")["resultat"], {"sonCle": "s"})

    def test_verification(self):
        self.assertIsNone(verifier_demande_facecam(DEMANDE))
        self.assertIsNotNone(verifier_demande_facecam({"idTravail": "a b", "source": "https://a"}))
        self.assertIsNotNone(verifier_demande_facecam({"idTravail": "a", "source": "file:///etc/passwd"}))


class TestReprisePanne(unittest.TestCase):
    """GV2-11 : un identifiant en échec est resoumis ; un travail figé libère la file."""

    def test_echec_resoumis_nouveau_et_seconde_execution(self):
        appels = []

        def executant(d, dossier, p):
            appels.append(1)
            if len(appels) == 1:
                raise RuntimeError("panne")
            return {"sonCle": "s"}

        t = TravauxFacecam(tempfile.mkdtemp(prefix="facecam-resoumis-"), {"son": executant})
        demande = {"idTravail": "t-3", "source": "https://a"}
        self.assertEqual(t.soumettre("son", demande), (202, {"idTravail": "t-3", "nouveau": True}))
        fin = time.time() + 5
        while time.time() < fin and (t.etat("son", "t-3") or {}).get("statut") != "echec":
            time.sleep(0.02)
        self.assertEqual(t.soumettre("son", demande), (202, {"idTravail": "t-3", "nouveau": True}))
        fin = time.time() + 5
        while time.time() < fin and (t.etat("son", "t-3") or {}).get("statut") != "termine":
            time.sleep(0.02)
        self.assertEqual(t.etat("son", "t-3")["resultat"], {"sonCle": "s"})
        self.assertEqual(len(appels), 2)
        # Terminé : plus de nouvel essai.
        self.assertFalse(t.soumettre("son", demande)[1]["nouveau"])

    def test_travail_fige_echec_reessayable_file_liberee(self):
        lacher = threading.Event()

        def executant(d, dossier, p):
            if d["idTravail"] == "fige":
                lacher.wait(10)
            return {"sonCle": "s"}

        t = TravauxFacecam(tempfile.mkdtemp(prefix="facecam-fige-"), {"son": executant}, delai_travail=0.3)
        try:
            t.soumettre("son", {"idTravail": "fige", "source": "https://a"})
            t.soumettre("son", {"idTravail": "suivant", "source": "https://a"})
            fin = time.time() + 5
            while time.time() < fin and (t.etat("son", "suivant") or {}).get("statut") != "termine":
                time.sleep(0.02)
            e = t.etat("son", "fige")
            self.assertEqual(e["statut"], "echec")
            self.assertTrue(e["erreur"]["reessayable"])
            self.assertEqual(e["erreur"]["message"], "Le calcul n'a pas abouti dans le temps imparti.")
            self.assertEqual(t.etat("son", "suivant")["statut"], "termine")
        finally:
            lacher.set()


if __name__ == "__main__":
    unittest.main()
