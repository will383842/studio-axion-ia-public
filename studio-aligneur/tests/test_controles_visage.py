"""Mesure du visage sur la piste montée (10/10, `docs/facecam/JOURNAL-CONTROLES-QUALITE.md`) : luma BT.709 et teinte
CIELAB lues dans le fichier encodé (YUV 10 bits BT.709 plage tv) comme un lecteur les lit, aux joues et au front de la
boîte du visage remise dans le cadre du plan. Demande FFmpeg, numpy et OpenCV (sautés sinon)."""
import math
import os
import shutil
import subprocess
import tempfile
import unittest

try:
    import cv2
    import numpy as np
except ImportError:  # pragma: no cover
    np = None

FFMPEG = shutil.which("ffmpeg")
PEAU = (194, 150, 130)  # « light skin » de la charte ColorChecker (sRGB 8 bits)
FOND = (60, 60, 60)
W, H = 320, 480
# Source 640 × 480 ; le plan recadre x = 160..480 (pleine hauteur) ; la boîte du visage, dans la source, va de
# x = 240 à 400 et de y = 120 à 360, soit x = 80..240 et y = 120..360 dans l'image montée (échelle 1).
CADRE = {"x": 160, "y": 0, "largeur": 320, "hauteur": 480}
PISTE = {"largeurSource": 640, "hauteurSource": 480, "echantillons": [{"t": t / 10, "boite": [240 / 640, 120 / 480, 160 / 640, 240 / 480], "bouche": 0, "confiance": 1} for t in range(41)]}
PLANS = [{"debutSec": 0.0, "finSec": 3.0, "priseDebutSec": 1.0, "priseFinSec": 4.0, "cadre": CADRE}]


def attendu_luma_709(rgb) -> float:
    r, g, b = rgb
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def attendu_teinte(rgb) -> float:
    lab = cv2.cvtColor(np.array([[rgb]], np.float32) / 255.0, cv2.COLOR_RGB2Lab)[0, 0]
    return math.degrees(math.atan2(lab[2], lab[1])) % 360


@unittest.skipUnless(FFMPEG and np is not None, "FFmpeg, numpy ou OpenCV absent")
class MesureVisage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dossier = tempfile.mkdtemp(prefix="visage-")
        img = np.zeros((H, W, 3), np.uint8)
        img[:] = FOND
        img[120:360, 80:240] = PEAU
        cls.chemin = os.path.join(cls.dossier, "montage.mov")
        # Même encodage que la piste montée : R'G'B' → YUV BT.709 plage tv EXPLICITE, 10 bits, étiqueté BT.709.
        subprocess.run([
            "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", "25", "-i", "pipe:0",
            "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p10le,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv",
            "-c:v", "libx264", "-crf", "8", "-profile:v", "high10", cls.chemin,
        ], input=img.tobytes() * 75, check=True)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.dossier, ignore_errors=True)

    def test_luma_et_teinte_lues_comme_un_lecteur(self):
        from aligneur.image import mesurer_visage_montage

        m = mesurer_visage_montage(self.chemin, PLANS, PISTE, (W, H))
        self.assertIsNotNone(m)
        self.assertEqual(m["images"], 12)
        self.assertAlmostEqual(m["luminance"], attendu_luma_709(PEAU), delta=1.5)
        self.assertAlmostEqual(m["teinteDeg"], attendu_teinte(PEAU), delta=1.5)

    def test_zones_dans_le_visage_seulement(self):
        # Fond très différent : s'il entrait dans les zones, la médiane bougerait.
        from aligneur.image import ZONES_PEAU

        for x0, y0, x1, y1 in ZONES_PEAU:
            self.assertTrue(0 < x0 < x1 < 1 and 0 < y0 < y1 < 1)

    def test_sans_visage_aucune_mesure(self):
        from aligneur.image import mesurer_visage_montage

        piste = {**PISTE, "echantillons": [{**e, "confiance": 0} for e in PISTE["echantillons"]]}
        self.assertIsNone(mesurer_visage_montage(self.chemin, PLANS, piste, (W, H)))

    def test_controles_rendent_le_visage(self):
        from aligneur import image

        chemin_piste = os.path.join(self.dossier, "piste.json.gz")
        import gzip
        import json

        with gzip.open(chemin_piste, "wt", encoding="utf-8") as f:
            json.dump(PISTE, f)
        c = image.controles_machine(self.chemin, PLANS, chemin_piste, self.dossier, False, None, (W, H))
        self.assertEqual(c["version"], image.VERSION_CONTROLES)
        self.assertAlmostEqual(c["visage"]["luminance"], attendu_luma_709(PEAU), delta=1.5)


@unittest.skipUnless(FFMPEG and np is not None, "FFmpeg ou numpy absent")
class RetardAfftdn(unittest.TestCase):
    def test_afftdn_ne_retarde_plus_la_voix(self):
        from aligneur.son import debruiter_afftdn, ecrire_wav, lire_son

        f = 48000
        x = (0.003 * np.random.default_rng(3).standard_normal(3 * f)).astype(np.float32)
        i = int(1.5 * f)
        x[i : i + f // 12] += 0.5 * np.sin(2 * np.pi * 1000 * np.arange(f // 12) / f).astype(np.float32)
        with tempfile.TemporaryDirectory() as d:
            y = lire_son(debruiter_afftdn(ecrire_wav(os.path.join(d, "a.wav"), x), os.path.join(d, "b.wav")))
        self.assertEqual(len(y), len(x))
        a, b = i - f // 10, i + f // 5
        c = np.correlate(y[a:b], x[a:b], "full")
        self.assertLessEqual(abs(int(np.argmax(c)) - (b - a - 1)), f // 1000)  # ≤ 1 ms


if __name__ == "__main__":
    unittest.main()
