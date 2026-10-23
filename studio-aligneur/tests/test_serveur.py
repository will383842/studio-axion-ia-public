"""Protocole HTTP (même que studio-rendu), file à un fil, effacement des fichiers — sans modèle ni torch."""
import json
import os
import threading
import time
import unittest
import urllib.error
import urllib.request

from aligneur.serveur import ErreurAlignement, FileAlignement, creer_serveur, verifier_demande

DEMANDE = {"idAlignement": "t-1-alignement", "audio": "https://r2.exemple/son.mp3?sig=x", "texte": "Un bon PV", "langue": "fr"}


class Essai:
    def __init__(self):
        self.dossiers = []
        self.appels = 0
        self.lacher = threading.Event()
        self.lacher.set()

    def lire_son(self, adresse, dossier):
        if "panne" in adresse:
            raise ErreurAlignement("fichier-inaccessible", "Son illisible.", True)
        chemin = os.path.join(dossier, "son")
        with open(chemin, "wb") as f:
            f.write(b"x")
        self.dossiers.append(dossier)
        return chemin

    def calculer(self, son, texte, reference):
        self.lacher.wait(5)
        self.appels += 1
        if "boum" in texte:
            raise RuntimeError("boum")
        return {"mots": [{"mot": m, "debutSec": i * 0.5, "finSec": i * 0.5 + 0.4} for i, m in enumerate(texte.split())], "motsNonAlignes": 0, "modele": "essai", "dureeCalculSec": 0.1}


def attendre(file, ident, statut, delai=5):
    fin = time.time() + delai
    while time.time() < fin:
        e = file.etat(ident)
        if e and e["statut"] == statut:
            return e
        time.sleep(0.01)
    raise AssertionError(f"{ident} jamais « {statut} » : {file.etat(ident)}")


class TestFile(unittest.TestCase):
    def test_termine_et_dossier_efface(self):
        e = Essai()
        f = FileAlignement(e.calculer, e.lire_son)
        self.assertTrue(f.soumettre(DEMANDE))
        r = attendre(f, DEMANDE["idAlignement"], "termine")
        self.assertEqual([m["mot"] for m in r["resultat"]["mots"]], ["Un", "bon", "PV"])
        self.assertTrue(all(not os.path.exists(d) for d in e.dossiers), "le dossier temporaire doit être effacé")

    def test_idempotent(self):
        e = Essai()
        f = FileAlignement(e.calculer, e.lire_son)
        self.assertTrue(f.soumettre(DEMANDE))
        self.assertFalse(f.soumettre(DEMANDE))
        attendre(f, DEMANDE["idAlignement"], "termine")
        self.assertEqual(e.appels, 1)

    def test_une_demande_a_la_fois_et_rang(self):
        e = Essai()
        e.lacher.clear()
        f = FileAlignement(e.calculer, e.lire_son)
        f.soumettre({**DEMANDE, "idAlignement": "a"})
        f.soumettre({**DEMANDE, "idAlignement": "b"})
        f.soumettre({**DEMANDE, "idAlignement": "c"})
        attendre(f, "a", "en_cours")
        self.assertEqual(f.etat("b"), {"statut": "en_file", "rang": 0})
        self.assertEqual(f.etat("c"), {"statut": "en_file", "rang": 1})
        e.lacher.set()
        attendre(f, "c", "termine")

    def test_echecs_types(self):
        e = Essai()
        f = FileAlignement(e.calculer, e.lire_son)
        f.soumettre({**DEMANDE, "idAlignement": "p", "audio": "https://r2.exemple/panne"})
        f.soumettre({**DEMANDE, "idAlignement": "b", "texte": "boum"})
        self.assertEqual(attendre(f, "p", "echec")["erreur"]["code"], "fichier-inaccessible")
        erreur = attendre(f, "b", "echec")["erreur"]
        self.assertEqual((erreur["code"], erreur["reessayable"]), ("inconnu", True))

    def test_verification(self):
        self.assertIsNone(verifier_demande(DEMANDE))
        self.assertEqual(verifier_demande({**DEMANDE, "audio": "file:///etc/passwd"}), "adresse du son manquante")
        self.assertEqual(verifier_demande({**DEMANDE, "texte": " "}), "texte manquant")
        self.assertEqual(verifier_demande({**DEMANDE, "langue": "en"}), "langue non prise en charge")


class TestHttp(unittest.TestCase):
    def setUp(self):
        self.essai = Essai()
        self.serveur = creer_serveur(FileAlignement(self.essai.calculer, self.essai.lire_son), ("127.0.0.1", 0), cle="secret", modele="essai")
        threading.Thread(target=self.serveur.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.serveur.server_address[1]}"

    def tearDown(self):
        self.serveur.shutdown()
        self.serveur.server_close()

    def appel(self, chemin, corps=None, cle="secret"):
        entetes = {"content-type": "application/json"}
        if cle:
            entetes["x-studio-rendu-cle"] = cle
        donnees = json.dumps(corps).encode() if corps is not None else None
        req = urllib.request.Request(self.base + chemin, data=donnees, headers=entetes, method="POST" if corps is not None else "GET")
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_protocole(self):
        self.assertEqual(self.appel("/sante", cle=None)[0], 200)
        self.assertEqual(self.appel("/alignements", DEMANDE, cle="faux")[0], 401)
        self.assertEqual(self.appel("/alignements/inconnu"), (404, {"statut": "inconnu"}))
        statut, corps = self.appel("/alignements", DEMANDE)
        self.assertEqual((statut, corps["idAlignement"], corps["nouveau"]), (202, DEMANDE["idAlignement"], True))
        self.assertEqual(self.appel("/alignements", {**DEMANDE, "audio": "x"})[0], 400)
        etat = {}
        fin = time.time() + 5
        while time.time() < fin:
            statut, etat = self.appel("/alignements/" + DEMANDE["idAlignement"])
            if etat["statut"] == "termine":
                break
            time.sleep(0.02)
        self.assertEqual(etat["statut"], "termine")
        self.assertEqual(len(etat["resultat"]["mots"]), 3)


class TestDelaiCalcul(unittest.TestCase):
    """Audit D : un calcul figé ne bloque plus la file pour toujours ; `/sante` le dit (503)."""

    def test_calcul_fige_abandonne_file_liberee_sante_503(self):
        fige = threading.Event()
        lacher = threading.Event()

        def calculer(son, texte, reference):
            if "fige" in texte:
                fige.set()
                lacher.wait(10)  # « figé » (relâché à la fin du test)
            return {"mots": [], "motsNonAlignes": 0, "modele": "essai", "dureeCalculSec": 0.0}

        e = Essai()
        f = FileAlignement(calculer, e.lire_son, delai_calcul=0.3)
        serveur = creer_serveur(f, ("127.0.0.1", 0), cle="secret", modele="essai")
        threading.Thread(target=serveur.serve_forever, daemon=True).start()
        try:
            f.soumettre({**DEMANDE, "idAlignement": "fige-1", "texte": "fige"})
            f.soumettre({**DEMANDE, "idAlignement": "suivant-2", "texte": "suivant"})
            r = attendre(f, "fige-1", "echec")
            self.assertEqual(r["erreur"]["code"], "indisponible")
            self.assertFalse(r["erreur"]["reessayable"])
            # La file est libérée : la demande suivante est calculée malgré le calcul figé.
            attendre(f, "suivant-2", "termine")
            self.assertFalse(f.en_bonne_sante())
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{serveur.server_address[1]}/sante", timeout=5) as rep:
                    statut = rep.status
            except urllib.error.HTTPError as err:
                statut = err.code
            self.assertEqual(statut, 503)
            # Le calcul figé finit enfin : il n'écrase pas l'échec, et la santé revient.
            lacher.set()
            fin = time.time() + 5
            while time.time() < fin and not f.en_bonne_sante():
                time.sleep(0.02)
            self.assertTrue(f.en_bonne_sante())
            self.assertEqual(f.etat("fige-1")["statut"], "echec")
        finally:
            lacher.set()
            serveur.shutdown()
            serveur.server_close()


if __name__ == "__main__":
    unittest.main()
