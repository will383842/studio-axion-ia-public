"""Vérif V2 (10/10) : étape « cadrage » de `/image` sur une prise PORTRAIT d'iPhone, avec un vrai FFmpeg.

Panne trouvée : quand `/visages` échoue (visage introuvable, panne), la chaîne calculait les plans pour une source
supposée 3840 × 2160 (paysage) ; le cadre (1216 × 2160) dépassait la prise portrait (1080 × 1920 ou 2160 × 3840) et
FFmpeg n'écrivait rien : le montage entier échouait, alors qu'un visage non suivi doit seulement donner un cadre centré.
"""
import json
import os
import shutil
import subprocess
import tempfile
import unittest

from aligneur.image import executer_cadrage
from aligneur.media import sonder

FFMPEG = shutil.which("ffmpeg") is not None
# Plans rendus par la brique réalisation pour une source supposée 3840 × 2160 (visage non suivi, cadre centré).
PLANS_PAYSAGE = [
    {"debutSec": 0, "finSec": 1.4, "priseDebutSec": 0, "priseFinSec": 1.4, "cadre": {"x": 1312, "y": 0, "largeur": 1216, "hauteur": 2160}},
    {"debutSec": 1.4, "finSec": 2.8, "priseDebutSec": 1.6, "priseFinSec": 3, "cadre": {"x": 1392, "y": 96, "largeur": 1056, "hauteur": 1878}},
]


@unittest.skipUnless(FFMPEG, "FFmpeg absent")
class CadrageHorsSource(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp(prefix="cadrage-")
        self.prise = os.path.join(self.d, "prise.mp4")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=270x480:r=25:d=3", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", self.prise], check=True)

    def tearDown(self):
        shutil.rmtree(self.d, ignore_errors=True)

    def cadrer(self, source: str, parametres: dict) -> dict:
        travail = os.path.join(self.d, "travail")
        os.makedirs(travail, exist_ok=True)
        sortie = os.path.join(self.d, "sortie", "montage.mov")
        demande = {"idTravail": "t", "source": source, "depots": {"montage": sortie}, "parametres": {"etape": "cadrage", "plans": PLANS_PAYSAGE, "sortie": {"largeur": 270, "hauteur": 480}, **parametres}}
        r = executer_cadrage(demande, travail, lambda p: None)
        s = sonder(sortie)
        self.assertEqual((s["largeur"], s["hauteur"]), (270, 480))
        self.assertAlmostEqual(r["dureeSec"], 2.8, places=2)
        return r

    def test_prise_preparee_portrait(self):
        self.cadrer(self.prise, {"preparer": True, "bande": {"x": 0}})

    def test_passe_image_portrait(self):
        self.cadrer(self.prise, {"bande": {"x": 0}})


if __name__ == "__main__":
    unittest.main()
