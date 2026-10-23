"""Vérif V5 (serveur) — un seul travail lourd à la fois, reprise après redémarrage sans double calcul, disque propre.

Sans modèle ni torch : les exécutants sont des faux qui comptent les calculs simultanés.
"""
import json
import os
import shutil
import tempfile
import threading
import time
import unittest

from aligneur.facecam import TravauxFacecam
from aligneur.serveur import FileAlignement


def attendre(condition, delai=5.0):
    fin = time.time() + delai
    while time.time() < fin:
        if condition():
            return True
        time.sleep(0.01)
    return False


class Compteur:
    """Compte les calculs lourds simultanés (passe image, calage)."""

    def __init__(self, duree=0.08):
        self.duree = duree
        self.verrou = threading.Lock()
        self.en_cours = 0
        self.maximum = 0
        self.faits = []

    def calculer(self, nom):
        with self.verrou:
            self.en_cours += 1
            self.maximum = max(self.maximum, self.en_cours)
        time.sleep(self.duree)
        with self.verrou:
            self.en_cours -= 1
            self.faits.append(nom)


class TestUnSeulTravailLourd(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.mkdtemp(prefix="v5-lourd-")

    def tearDown(self):
        shutil.rmtree(self.dossier, ignore_errors=True)

    def test_deux_passes_image_jamais_en_meme_temps(self):
        c = Compteur()
        t = TravauxFacecam(self.dossier, {"image": lambda d, dossier, p: (c.calculer(d["idTravail"]), {"fichierCle": d["idTravail"]})[1]})
        for i in range(3):
            t.soumettre("image", {"idTravail": f"passe-{i}", "source": "https://a"})
        self.assertTrue(attendre(lambda: len(c.faits) == 3))
        self.assertEqual(c.maximum, 1)

    def test_ROUGE_calage_et_passe_image_jamais_en_meme_temps(self):
        """Avant : le calage (fil « calage ») et la passe image (fil « facecam ») tournaient en parallèle dans 4,5 Go."""
        c = Compteur(duree=0.15)
        lourd = threading.Lock()
        t = TravauxFacecam(self.dossier, {"image": lambda d, dossier, p: (c.calculer("image"), {"fichierCle": "x"})[1]}, verrou_lourd=lourd)
        f = FileAlignement(lambda son, texte, ref: (c.calculer("calage"), {"mots": []})[1], lire_son=lambda a, d: os.path.join(d, "son"), verrou_lourd=lourd)
        for i in range(2):
            t.soumettre("image", {"idTravail": f"p-{i}", "source": "https://a"})
            f.soumettre({"idAlignement": f"c-{i}", "audio": "https://a", "texte": "un"})
        self.assertTrue(attendre(lambda: len(c.faits) == 4))
        self.assertEqual(c.maximum, 1)
        self.assertEqual(f.etat("c-1")["statut"], "termine")

    def test_attente_du_verrou_ne_compte_pas_dans_le_delai_du_calage(self):
        """Un calage qui attend la fin d'une passe image de 10 min ne doit pas être abandonné comme « figé »."""
        lourd = threading.Lock()
        lourd.acquire()  # une passe image occupe le verrou
        f = FileAlignement(lambda son, texte, ref: {"mots": []}, lire_son=lambda a, d: os.path.join(d, "son"), delai_calcul=0.2, verrou_lourd=lourd)
        f.soumettre({"idAlignement": "c-attend", "audio": "https://a", "texte": "un"})
        time.sleep(0.5)
        self.assertNotEqual((f.etat("c-attend") or {}).get("statut"), "echec")
        self.assertTrue(f.en_bonne_sante())
        lourd.release()
        self.assertTrue(attendre(lambda: (f.etat("c-attend") or {}).get("statut") == "termine"))


class TestRepriseApresRedemarrage(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.mkdtemp(prefix="v5-reprise-")

    def tearDown(self):
        shutil.rmtree(self.dossier, ignore_errors=True)

    def test_passe_reprise_depuis_ses_tranches_sans_double_calcul(self):
        """Conteneur tué pendant la 2e tranche : au redémarrage, la 1re tranche n'est pas recalculée, le travail finit."""
        calculees = []
        bloque = threading.Event()

        def passe(demande, dossier, progression, couper=True):
            for i in range(3):
                chemin = os.path.join(dossier, f"tranche-{i:03d}.mp4")
                if os.path.exists(chemin):
                    continue
                if couper and i == 1:
                    bloque.wait(3600)  # « SIGKILL » : ce fil ne finit jamais (fil démon, arrêté avec les tests)
                    raise RuntimeError("tué")
                calculees.append(i)
                with open(chemin + ".tmp.mp4", "w") as f:
                    f.write("x")
                os.replace(chemin + ".tmp.mp4", chemin)
            return {"fichierCle": "image"}

        avant = TravauxFacecam(self.dossier, {"image": passe})
        avant.soumettre("image", {"idTravail": "passe-1", "source": "https://a"})
        self.assertTrue(attendre(lambda: calculees == [0]))
        # Redémarrage : un nouveau processus sur le même dossier de travaux (volume gardé).
        apres = TravauxFacecam(self.dossier, {"image": lambda d, dossier, p: passe(d, dossier, p, couper=False)})
        self.assertTrue(attendre(lambda: (apres.etat("image", "passe-1") or {}).get("statut") == "termine"))
        self.assertEqual(calculees, [0, 1, 2])
        # Resoumis par le studio (même identifiant) : rien n'est recalculé.
        self.assertEqual(apres.soumettre("image", {"idTravail": "passe-1", "source": "https://a"}), (202, {"idTravail": "passe-1", "nouveau": False}))
        time.sleep(0.1)
        self.assertEqual(calculees, [0, 1, 2])

    def test_travail_termine_jamais_refait_apres_redemarrage(self):
        appels = []
        t = TravauxFacecam(self.dossier, {"son": lambda d, dossier, p: (appels.append(1), {"fichierCle": "s"})[1]})
        t.soumettre("son", {"idTravail": "son-1", "source": "https://a"})
        self.assertTrue(attendre(lambda: (t.etat("son", "son-1") or {}).get("statut") == "termine"))
        t2 = TravauxFacecam(self.dossier, {"son": lambda d, dossier, p: (appels.append(2), {"fichierCle": "s"})[1]})
        time.sleep(0.1)
        self.assertEqual(appels, [1])
        self.assertEqual(t2.etat("son", "son-1")["statut"], "termine")


class TestDisque(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.mkdtemp(prefix="v5-disque-")

    def tearDown(self):
        shutil.rmtree(self.dossier, ignore_errors=True)

    def test_ROUGE_echec_efface_les_fichiers_lourds(self):
        """Avant : un travail en échec gardait ses tranches (Go) jusqu'au prochain redémarrage ; le studio resoumet sous un
        AUTRE identifiant, elles ne servaient plus jamais."""
        def rate(demande, dossier, progression):
            with open(os.path.join(dossier, "tranche-000.mp4"), "w") as f:
                f.write("x" * 1000)
            raise RuntimeError("panne")

        t = TravauxFacecam(self.dossier, {"image": rate})
        t.soumettre("image", {"idTravail": "rate-1", "source": "https://a"})
        self.assertTrue(attendre(lambda: (t.etat("image", "rate-1") or {}).get("statut") == "echec"))
        self.assertEqual(sorted(os.listdir(os.path.join(self.dossier, "image", "rate-1"))), ["etat.json"])

    def test_ROUGE_vieux_travaux_finis_oublies_sans_redemarrage(self):
        """Avant : les travaux finis de plus de 24 h n'étaient oubliés qu'au DÉMARRAGE (conteneur ouvert des semaines)."""
        horloge = [1_000_000.0]
        t = TravauxFacecam(self.dossier, {"son": lambda d, dossier, p: {"fichierCle": "s"}}, horloge=lambda: horloge[0])
        t.soumettre("son", {"idTravail": "vieux", "source": "https://a"})
        self.assertTrue(attendre(lambda: (t.etat("son", "vieux") or {}).get("statut") == "termine"))
        horloge[0] += 25 * 3600
        t.soumettre("son", {"idTravail": "neuf", "source": "https://a"})
        self.assertTrue(attendre(lambda: (t.etat("son", "neuf") or {}).get("statut") == "termine"))
        self.assertTrue(attendre(lambda: not os.path.exists(os.path.join(self.dossier, "son", "vieux"))))
        self.assertTrue(os.path.exists(os.path.join(self.dossier, "son", "neuf", "etat.json")))

    def test_travail_en_file_ou_en_cours_jamais_efface(self):
        horloge = [1_000_000.0]
        os.makedirs(os.path.join(self.dossier, "image", "attend"))
        with open(os.path.join(self.dossier, "image", "attend", "etat.json"), "w") as f:
            json.dump({"statut": "en_file", "demande": {"idTravail": "attend", "source": "https://a"}, "depuis": 0}, f)
        bloque = threading.Event()
        t = TravauxFacecam(self.dossier, {"image": lambda d, dossier, p: (bloque.wait(5), {"fichierCle": "x"})[1]}, horloge=lambda: horloge[0])
        self.assertTrue(attendre(lambda: (t.etat("image", "attend") or {}).get("statut") == "en_cours"))
        horloge[0] += 30 * 3600
        t.purger_anciens()
        self.assertTrue(os.path.exists(os.path.join(self.dossier, "image", "attend", "etat.json")))
        bloque.set()


if __name__ == "__main__":
    unittest.main()
