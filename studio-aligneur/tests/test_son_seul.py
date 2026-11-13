"""Sonde d'une piste sonore seule (voix seule d'Image → vidéo, transcrite pour l'écoute) : acceptée par la transcription,
toujours refusée par les routes qui ont besoin d'une image."""
import os
import shutil
import subprocess
import tempfile
import unittest

from aligneur import media


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg absent")
class SondeSonSeul(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.mkdtemp(prefix="son-seul-")
        self.addCleanup(shutil.rmtree, self.dossier, ignore_errors=True)
        self.wav = os.path.join(self.dossier, "voix.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-y", "-f", "lavfi", "-i", "sine=f=220:d=1.2", "-ar", "16000", "-ac", "1", self.wav], check=True)
        self.video = os.path.join(self.dossier, "prise.mp4")
        subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-y", "-f", "lavfi", "-i", "color=c=black:s=320x240:d=1", "-f", "lavfi", "-i", "sine=f=220:d=1", "-shortest", "-pix_fmt", "yuv420p", self.video], check=True)

    def test_son_seul_refuse_par_defaut(self):
        with self.assertRaises(media.ErreurTravail) as c:
            media.sonder(self.wav)
        self.assertEqual(c.exception.message, "La prise ne contient pas d'image.")
        self.assertFalse(c.exception.reessayable)

    def test_son_seul_accepte_pour_la_transcription(self):
        s = media.sonder(self.wav, exiger_image=False)
        self.assertTrue(s["son"])
        self.assertEqual((s["largeur"], s["hauteur"]), (0, 0))
        self.assertAlmostEqual(s["duree"], 1.2, delta=0.1)
        self.assertEqual(s["conversion"], "")
        self.assertFalse(s["hdr"])

    def test_une_prise_avec_image_est_sondee_comme_avant(self):
        for exiger in (True, False):
            s = media.sonder(self.video, exiger_image=exiger)
            self.assertEqual((s["largeur"], s["hauteur"]), (320, 240))
            self.assertTrue(s["son"])

    def test_ni_image_ni_son_reste_refuse(self):
        vide = os.path.join(self.dossier, "vide.txt")
        open(vide, "w").write("pas un média")
        with self.assertRaises(media.ErreurTravail):
            media.sonder(vide, exiger_image=False)


class FonduFinDuSon(unittest.TestCase):
    """GV2-33 : le fondu final de `monter` est réglable (0,05 s par défaut, 0,12 s pour la face caméra)."""

    FREQ = 48000

    def _decroit(self, voix, duree_sec):
        import numpy as np

        n = int(duree_sec * self.FREQ)
        fin = np.abs(voix[-n:])
        # Enveloppe sur 10 tranches : strictement non croissante (le signal d'entrée est constant).
        tranches = [float(t.mean()) for t in np.array_split(fin, 10)]
        return all(a >= b - 1e-6 for a, b in zip(tranches, tranches[1:])) and tranches[-1] < 0.2 * tranches[0]

    def _signal(self):
        import numpy as np

        return np.ones(self.FREQ * 2, dtype=np.float32)

    def test_fondu_de_012_s(self):
        import numpy as np
        from aligneur import son

        voix = son.monter(self._signal(), [{"debutSec": 0.0, "finSec": 2.0}], None, 0.12)
        self.assertTrue(self._decroit(voix, 0.12))
        # Juste avant les 0,12 dernières secondes, le signal est encore plein.
        avant = voix[-int(0.12 * self.FREQ) - 10]
        self.assertAlmostEqual(float(avant), 1.0, places=3)
        self.assertGreater(float(np.abs(voix[-int(0.08 * self.FREQ)])), 0.2)

    def test_fondu_par_defaut_005_s(self):
        from aligneur import son

        voix = son.monter(self._signal(), [{"debutSec": 0.0, "finSec": 2.0}], None)
        self.assertTrue(self._decroit(voix, 0.05))
        self.assertAlmostEqual(float(voix[-int(0.05 * self.FREQ) - 10]), 1.0, places=3)
        self.assertEqual(son.FONDU_FIN_SEC, 0.05)
