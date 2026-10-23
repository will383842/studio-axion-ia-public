"""Routes face caméra (lot A) : 501 propre sans exécutant, même clé, travaux sur disque repris — sans modèle ni torch."""
import json
import os
import tempfile
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


if __name__ == "__main__":
    unittest.main()
