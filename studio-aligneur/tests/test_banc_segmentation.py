"""Banc d'étude du détourage (C5-5.20) : vidéo synthétique (forme unie qui bouge sur fond uni), aucune vraie prise."""
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest

ICI = os.path.dirname(os.path.abspath(__file__))
BANC = os.path.join(ICI, "..", "etudes", "banc_segmentation.py")
ALIGNEUR = os.path.join(ICI, "..", "aligneur")

try:
    import cv2
    import numpy as np
except ImportError:  # saut propre
    cv2 = np = None


def charger():
    spec = importlib.util.spec_from_file_location("banc_segmentation", BANC)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class TestBancSansDependances(unittest.TestCase):
    def test_aide_ne_lit_rien(self):
        r = subprocess.run([sys.executable, BANC, "--aide"], capture_output=True, text=True, check=True)
        self.assertIn("hors production", r.stdout)

    def test_aucun_module_du_service_n_importe_etudes(self):
        for racine, _, fichiers in os.walk(ALIGNEUR):
            for f in fichiers:
                if f.endswith(".py"):
                    with open(os.path.join(racine, f), encoding="utf-8") as fh:
                        self.assertNotIn("etudes", fh.read(), f)


class TestSortieHorsDepot(unittest.TestCase):
    def test_sortie_dans_le_depot_refusee(self):
        banc = charger()
        cible = os.path.join(banc.racine_du_depot(), "studio-aligneur", "controle_refuse_test")
        self.assertFalse(os.path.exists(cible))
        r = subprocess.run([sys.executable, BANC, "prise_absente.avi", "--methode", "fond-uni", "--sortie", cible],
                           capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("HORS du dépôt", r.stderr)
        self.assertFalse(os.path.exists(cible))

    def test_sortie_temporaire_acceptee(self):
        banc = charger()
        with tempfile.TemporaryDirectory() as d:
            self.assertFalse(banc.sortie_dans_le_depot(d))


@unittest.skipIf(cv2 is None, "numpy / cv2 absents")
class TestBancSurVideoSynthetique(unittest.TestCase):
    def test_json_complet(self):
        banc = charger()
        with tempfile.TemporaryDirectory() as d:
            chemin = os.path.join(d, "synth.avi")
            w = cv2.VideoWriter(chemin, cv2.VideoWriter_fourcc(*"MJPG"), 25, (160, 120))
            for i in range(12):
                im = np.full((120, 160, 3), 30, "uint8")
                cv2.circle(im, (50 + 4 * i, 60), 25, (200, 180, 160), -1)
                w.write(im)
            w.release()
            res = banc.mesurer(chemin, banc.segmenteur_fond_uni(), "fond-uni", os.path.join(d, "ctl"))
            for cle in banc.CLES_RESULTAT:
                self.assertIn(cle, res)
            json.dumps(res)
            self.assertEqual(res["images"], 12)
            self.assertGreater(res["temps_par_image_ms"]["moyenne"], 0)
            self.assertGreaterEqual(res["iou_voisines"]["min"], 0.0)
            self.assertLessEqual(res["iou_voisines"]["max"], 1.0)
            self.assertGreater(res["iou_voisines"]["moyenne"], 0.5)
            self.assertLessEqual(len(os.listdir(os.path.join(d, "ctl"))), 5)

    def test_iou_bornes(self):
        banc = charger()
        a = np.zeros((10, 10), "float32"); a[:5] = 1
        self.assertEqual(banc.iou(a, a), 1.0)
        self.assertEqual(banc.iou(a, 1 - a), 0.0)


if __name__ == "__main__":
    unittest.main()
