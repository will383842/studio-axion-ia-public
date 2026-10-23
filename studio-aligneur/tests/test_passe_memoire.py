"""Passe image (10/10) : fils de FFmpeg / x264 bornés (mémoire), conversion 16 bits sans copie, progression PENDANT la
tranche (avant : 8 % → 92 % d'un coup, « 1 % » affiché pendant toute la passe « formats »)."""
import os
import shutil
import subprocess
import tempfile
import unittest
from unittest import mock

from aligneur import image, media

FFMPEG = shutil.which("ffmpeg") is not None
try:
    import cv2  # noqa: F401
    import numpy as np

    NUMPY = True
except ImportError:  # pragma: no cover - image sans numpy
    NUMPY = False


class TestFils(unittest.TestCase):
    def test_fils_du_conteneur(self):
        with mock.patch.dict(os.environ, {"STUDIO_ALIGNEUR_FILS": "3"}):
            self.assertEqual(media.fils_ffmpeg(), 3)
        with mock.patch.dict(os.environ, {"STUDIO_ALIGNEUR_FILS": "n'importe"}):
            self.assertEqual(media.fils_ffmpeg(), 2)
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(media.fils_ffmpeg(), 2)

    def test_encodeur_borne(self):
        with mock.patch.object(image.subprocess, "Popen") as popen, mock.patch.dict(os.environ, {"STUDIO_ALIGNEUR_FILS": "2"}):
            image.encodeur("x.mp4", 3840, 2160, "format=yuv420p10le")
        cmd = popen.call_args[0][0]
        self.assertEqual(cmd[cmd.index("-threads") + 1], "2")
        self.assertEqual(cmd[cmd.index("-filter_threads") + 1], "2")
        self.assertEqual(cmd[cmd.index("-rc-lookahead") + 1], str(image.PREVISION_X264))

    def test_decodeur_borne(self):
        faux = mock.MagicMock()
        faux.stdout.read.return_value = b""
        with mock.patch.object(media.subprocess, "Popen", return_value=faux) as popen, mock.patch.dict(os.environ, {"STUDIO_ALIGNEUR_FILS": "2"}):
            list(media.lire_images("prise.mov", "fps=25", 16, 16, 1.0, 2.0, profondeur16=True))
        cmd = popen.call_args[0][0]
        # Fils du décodeur : option d'ENTRÉE, donc avant « -i ».
        self.assertLess(cmd.index("-threads"), cmd.index("-i"))
        self.assertEqual(cmd[cmd.index("-threads") + 1], "2")
        self.assertIn("-filter_threads", cmd)


@unittest.skipUnless(NUMPY, "numpy absent")
class TestVers16Bits(unittest.TestCase):
    def test_valeurs_et_en_place(self):
        passe = image.Passe(None, {"gain": 1.0, "balance": [1, 1, 1], "decalagePeau": [0, 0]}, {}, (2, 2))
        sortie = np.array([[[-0.1, 0.0, 0.5], [1.0, 1.2, 0.25]]], np.float32)
        r = image.vers_16bits(sortie, passe)
        self.assertEqual(r.dtype, np.uint16)
        self.assertEqual(r.tolist(), [[[0, 0, 32768], [65535, 65535, 16384]]])

    def test_image_gardee_par_l_anti_grain_intacte(self):
        passe = image.Passe(None, {}, {}, (1, 1))
        passe.precedente = np.full((1, 1, 3), 0.5, np.float32)
        image.vers_16bits(passe.precedente, passe)
        self.assertEqual(float(passe.precedente[0, 0, 0]), 0.5)


@unittest.skipUnless(FFMPEG and NUMPY, "FFmpeg ou numpy absent")
class TestProgressionDansLaTranche(unittest.TestCase):
    def test_progression_chaque_seconde(self):
        dossier = tempfile.mkdtemp(prefix="passe-essai-")
        source = os.path.join(dossier, "prise.mp4")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=160x288:r=25:d=4", "-c:v", "libx264", "-pix_fmt", "yuv420p", source], check=True)
        vus = []
        sortie = os.path.join(dossier, "depot", "sortie.mp4")
        travail = os.path.join(dossier, "travail")
        os.makedirs(travail)
        r = image.executer_passe({"source": source, "depots": {"image": sortie}, "parametres": {"etape": "passe", "cles": {"image": "image.mp4"}}}, travail, vus.append)
        self.assertTrue(os.path.exists(sortie))
        self.assertEqual(r["fichierCle"], "image.mp4")
        # 4 s dans une seule tranche : une progression par seconde de vidéo, croissante, entre 8 et 92.
        pendant = [p for p in vus if 8 < p < 92]
        self.assertGreaterEqual(len(pendant), 3)
        self.assertEqual(vus, sorted(vus))
        shutil.rmtree(dossier, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
