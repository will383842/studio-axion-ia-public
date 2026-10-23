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
