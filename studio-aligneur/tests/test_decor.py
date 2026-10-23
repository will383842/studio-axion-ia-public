"""Décor IA (lot G) : extraire, reposer (25 i/s sans changer la vitesse), mesurer ; plan `decor` lu par le cadrage.
Sans MediaPipe ni réseau : les mesures sont testées sur leurs calculs purs, FFmpeg sur de petites vidéos de synthèse."""
import math
import os
import shutil
import subprocess
import tempfile
import unittest

from aligneur.decor import ecart_bouche_ms, executer_extraire, executer_reposer, filtre_reposer_effet, gains_couleur, ressemblance_points, stats_rgb
from aligneur.image import pieces_du_plan
from aligneur.media import ErreurTravail, sonder

FFMPEG = shutil.which("ffmpeg") is not None


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


class TestMesuresPures(unittest.TestCase):
    def test_ecart_bouche_retrouve_le_decalage(self):
        voix = [abs(math.sin(i / 3.0)) + (0.8 if i % 17 < 5 else 0) for i in range(200)]
        # L'image est en retard de 2 images (80 ms à 25 i/s).
        bouche = [0.0, 0.0] + voix[:-2]
        self.assertEqual(ecart_bouche_ms(bouche, voix), 80.0)
        self.assertEqual(ecart_bouche_ms(voix, voix), 0.0)
        self.assertIsNone(ecart_bouche_ms([1.0] * 50, voix[:50]))
        self.assertIsNone(ecart_bouche_ms(voix[:10], voix[:10]))

    def test_ressemblance_du_visage(self):
        visage = [[0, 0], [10, 0], [5, 8], [2, 12], [8, 12], [5, 16]]
        meme = [[x * 2 + 100, y * 2 + 50] for x, y in visage]  # même forme, autre place, autre taille
        autre = [[0, 0], [14, 0], [5, 4], [1, 15], [12, 9], [7, 20]]
        self.assertGreater(ressemblance_points([visage] * 3, [meme] * 3), 0.99)
        self.assertLess(ressemblance_points([visage], [autre]), 0.85)
        self.assertIsNone(ressemblance_points([], [visage]))


class TestCadrageAvecDecor(unittest.TestCase):
    def test_plan_coupe_aux_bornes_des_morceaux(self):
        decor = [{"debutSec": 2.0, "finSec": 4.0, "chemin": "d0.mp4"}]
        pieces = pieces_du_plan(25, 100, decor)  # prise 1 s → 5 s
        self.assertEqual([(a, b, m["chemin"] if m else None) for a, b, m in pieces], [(25, 50, None), (50, 100, "d0.mp4"), (100, 125, None)])
        self.assertEqual(pieces_du_plan(0, 25, decor), [(0, 25, None)])


@unittest.skipUnless(FFMPEG, "FFmpeg absent")
class TestExtraireReposer(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.mkdtemp(prefix="decor-essai-")
        self.source = os.path.join(self.dossier, "passe.mp4")
        ffmpeg("-f", "lavfi", "-i", "testsrc2=s=1640x2160:r=25:d=6", "-c:v", "libx264", "-pix_fmt", "yuv420p", self.source)

    def tearDown(self):
        shutil.rmtree(self.dossier, ignore_errors=True)

    def test_extraire_un_passage_sans_son_dans_la_fenetre(self):
        travail = os.path.join(self.dossier, "t1")
        os.makedirs(travail)
        sortie = os.path.join(self.dossier, "r2", "passage.mp4")
        r = executer_extraire({"source": self.source, "depots": {"passage": sortie}, "parametres": {"debutSec": 1.0, "finSec": 4.0, "fenetre": {"x": 200, "largeur": 1216, "hauteur": 2160}, "cles": {"passage": "facecam/v/ver/decor/passage-0.mp4"}}}, travail, lambda p: None)
        self.assertEqual(r["fichierCle"], "facecam/v/ver/decor/passage-0.mp4")
        s = sonder(sortie)
        self.assertEqual((s["largeur"], s["hauteur"]), (720, 1280))
        self.assertFalse(s["son"])
        self.assertAlmostEqual(r["dureeSec"], 3.0, delta=0.05)
        self.assertEqual(r["fenetre"], {"x": 200, "y": 0, "largeur": 1216, "hauteur": 2160})

    def test_reposer_a_25_ips_sans_changer_la_vitesse(self):
        retouche = os.path.join(self.dossier, "higgsfield.mp4")
        ffmpeg("-f", "lavfi", "-i", "testsrc2=s=704x1248:r=24:d=3.04", "-c:v", "libx264", "-pix_fmt", "yuv420p", retouche)
        travail = os.path.join(self.dossier, "t2")
        os.makedirs(travail)
        sortie = os.path.join(self.dossier, "r2", "decor.mp4")
        r = executer_reposer({"source": retouche, "depots": {"decor": sortie}, "parametres": {"conversion": {"filtreVideo": "fps=25", "vitesse": 1, "dureeSec": 3.0}, "taille": {"largeur": 1216, "hauteur": 2160}}}, travail, lambda p: None)
        s = sonder(sortie)
        self.assertEqual((s["largeur"], s["hauteur"]), (1216, 2160))
        self.assertAlmostEqual(r["dureeSec"], 3.0, delta=0.05)
        self.assertEqual(r["ips"], 25)
        with self.assertRaises(ErreurTravail):
            executer_reposer({"source": retouche, "depots": {"decor": sortie}, "parametres": {"conversion": {"filtreVideo": "setpts=0.96*PTS", "dureeSec": 3.0}}}, travail, lambda p: None)


class TestEffetRealiste(unittest.TestCase):
    """Lot K : le passage d'un effet réaliste par IA est reposé avec ses couleurs accordées sur l'origine et un fondu."""

    def test_gains_couleur_ramenent_la_sortie_sur_l_origine(self):
        origine = [(0.5, 0.2), (0.45, 0.2), (0.4, 0.2)]
        sortie = [(0.55, 0.2), (0.45, 0.2), (0.35, 0.25)]  # plus rouge, moins bleue et plus contrastée en bleu
        g = gains_couleur(sortie, origine)
        for (a, b), (ms, _), (mo, _) in zip(g, sortie, origine):
            self.assertAlmostEqual(a * ms + b, mo, delta=0.002)
        self.assertAlmostEqual(g[2][0], 0.8, delta=1e-6)
        # Bornes : jamais un changement de lumière voulu effacé.
        borne = gains_couleur([(0.1, 0.01), (0.5, 0.2), (0.5, 0.2)], [(0.9, 0.3), (0.5, 0.2), (0.5, 0.2)])
        self.assertEqual(borne[0][0], 1.25)
        self.assertLessEqual(borne[0][1], 0.12)
        self.assertIsNone(gains_couleur(None, origine))

    def test_graphe_sans_changer_la_vitesse(self):
        g = filtre_reposer_effet("fps=25", ",scale=72:128", 5.0, 0.2, [(1.0, 0.0), (1.0, 0.0), (0.9, 0.02)])
        self.assertIn("lutrgb", g)
        self.assertIn("blend=all_expr", g)
        self.assertIn("min(T/0.200,(5.000-T)/0.200)", g)
        self.assertNotIn("setpts", g)
        with self.assertRaises(ErreurTravail):
            filtre_reposer_effet("setpts=0.9*PTS", "", 5.0, 0.2, None)

    @unittest.skipUnless(FFMPEG, "FFmpeg absent")
    def test_reposer_avec_accord_et_fondu(self):
        dossier = tempfile.mkdtemp()
        try:
            # Sortie de Higgsfield : 24 i/s, teinte rouge ajoutée ; origine : 25 i/s.
            higgs = os.path.join(dossier, "higgs.mp4")
            origine = os.path.join(dossier, "origine.mp4")
            ffmpeg("-f", "lavfi", "-i", "testsrc2=s=72x128:r=24:d=3.04", "-vf", "colorchannelmixer=rr=1.0:rb=0.25", "-c:v", "libx264", "-pix_fmt", "yuv420p", higgs)
            ffmpeg("-f", "lavfi", "-i", "testsrc2=s=72x128:r=25:d=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", origine)
            travail = os.path.join(dossier, "t")
            os.makedirs(travail)
            sortie = os.path.join(dossier, "r", "effet.mp4")
            r = executer_reposer({"source": higgs, "depots": {"decor": sortie}, "parametres": {"conversion": {"filtreVideo": "fps=25", "vitesse": 1, "dureeSec": 3.0}, "taille": {"largeur": 72, "hauteur": 128}, "original": origine, "fonduSec": 0.2, "accorderCouleurs": True}}, travail, lambda p: None)
            s = sonder(sortie)
            self.assertEqual((s["largeur"], s["hauteur"]), (72, 128))
            self.assertAlmostEqual(r["dureeSec"], 3.0, delta=0.05)
            # Les couleurs de la sortie sont plus proches de l'origine qu'avant l'accord (canal rouge).
            avant = stats_rgb(higgs, dossier, "a")
            apres = stats_rgb(sortie, dossier, "b")
            ref = stats_rgb(origine, dossier, "c")
            self.assertLess(abs(apres[0][0] - ref[0][0]), abs(avant[0][0] - ref[0][0]))
        finally:
            shutil.rmtree(dossier, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
