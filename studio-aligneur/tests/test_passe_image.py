"""Passe image (rapport V6, P0 n° 3 et 4) : référence du Look Will et passe visage réellement exécutée.

Les tests qui demandent numpy / OpenCV sont sautés proprement s'ils manquent (conteneur minimal).
"""
import importlib.util
import math
import os
import unittest

AVEC_NUMPY = importlib.util.find_spec("numpy") is not None


@unittest.skipUnless(AVEC_NUMPY, "numpy absent")
class TestMesuresLook(unittest.TestCase):
    def test_peau_et_mur_mesures_apres_retouche_et_delta_e_contre_la_reference(self):
        from aligneur.image import mesures_passe

        apres = [
            {"peauY": 128.0, "bruitPeau": 1.0, "peauLab": [62.0, 14.0, 19.0], "murLab": [71.0, 1.0, 5.0]},
            {"peauY": 130.0, "bruitPeau": 1.1, "peauLab": [63.0, 14.5, 18.6], "murLab": [70.6, 1.4, 4.6]},
            {"peauY": 126.0, "bruitPeau": 0.9, "peauLab": [62.4, 14.2, 18.9]},
        ]
        avant = [{"peauY": 110.0, "bruitPeau": 1.4, "peauLab": [55.0, 12.0, 15.0]}]
        m = mesures_passe(avant, apres, {"peauLab": [62.4, 14.2, 18.9]})
        self.assertEqual(m["peauLab"], [62.4, 14.2, 18.9])
        # V6 : le mur fait partie de la référence du look (avant : jamais rendu).
        self.assertEqual(m["murLab"], [70.8, 1.2, 4.8])
        self.assertLess(m["deltaE00Peau"], 0.5)
        self.assertLess(m["bruitRatio"], 1.0)
        loin = mesures_passe(avant, apres, {"peauLab": [50.0, 25.0, 5.0]})
        self.assertGreaterEqual(loin["deltaE00Peau"], 4.0)

    def test_sans_mur_mesure_pas_de_mur_invente(self):
        from aligneur.image import mesures_passe

        m = mesures_passe([], [{"peauY": 120.0, "bruitPeau": 1.0, "peauLab": [60.0, 12.0, 16.0]}], None)
        self.assertNotIn("murLab", m)
        self.assertNotIn("deltaE00Peau", m)


AVEC_CV2 = AVEC_NUMPY and importlib.util.find_spec("cv2") is not None


def _points_visage(np, cx, cy, rx, ry, ouverte):
    """Points du visage façon MediaPipe (mêmes indices que `/visages`), posés sur des ellipses : ovale, yeux, iris,
    sourcils, lèvres (extérieur et intérieur, ouvert ou fermé). Coordonnées en pixels de la source."""
    from aligneur.visages import BOUCHE, INDICES_POINTS, IRIS, LEVRES_INT, OEIL_D, OEIL_G, OVALE, SOURCIL_D, SOURCIL_G

    pos = {}

    def ellipse(indices, x, y, ax, ay, depart=-math.pi / 2):
        for k, i in enumerate(indices):
            a = depart + 2 * math.pi * k / len(indices)
            pos[i] = (x + ax * math.cos(a), y + ay * math.sin(a))

    ellipse(OVALE, cx, cy, rx, ry)
    ellipse(OEIL_G, cx - 0.38 * rx, cy - 0.12 * ry, 0.2 * rx, 0.07 * ry, math.pi)
    ellipse(OEIL_D, cx + 0.38 * rx, cy - 0.12 * ry, 0.2 * rx, 0.07 * ry, math.pi)
    pos[IRIS[0]] = (cx - 0.38 * rx, cy - 0.12 * ry)
    pos[IRIS[1]] = (cx + 0.38 * rx, cy - 0.12 * ry)
    for indices, x in ((SOURCIL_G, cx - 0.38 * rx), (SOURCIL_D, cx + 0.38 * rx)):
        for k, i in enumerate(indices):
            pos[i] = (x - 0.22 * rx + 0.44 * rx * k / (len(indices) - 1), cy - 0.3 * ry - 0.03 * ry * math.sin(math.pi * k / (len(indices) - 1)))
    ellipse(BOUCHE, cx, cy + 0.5 * ry, 0.3 * rx, (0.13 if ouverte else 0.07) * ry, math.pi)
    ellipse(LEVRES_INT, cx, cy + 0.5 * ry, 0.24 * rx, (0.08 if ouverte else 0.008) * ry, math.pi)
    return np.array([pos[i] for i in INDICES_POINTS], np.float32)


class TestDegradeMur(unittest.TestCase):
    def test_encodeur_de_la_passe_garde_les_niveaux_du_mur(self):
        """V6 P0 n° 2 : contrôle réel (`controle_ffmpeg`) — un dégradé 10 bits garde ses niveaux à travers la passe."""
        import shutil
        import tempfile

        if not shutil.which("ffmpeg"):
            self.skipTest("ffmpeg absent")
        from aligneur.controle_ffmpeg import cube_identite, verifier_degrade_mur

        dossier = tempfile.mkdtemp(prefix="degrade-mur-")
        try:
            avant, apres = verifier_degrade_mur(dossier, cube_identite(os.path.join(dossier, "look.cube")))
            self.assertGreaterEqual(avant, 90)
            self.assertGreaterEqual(apres, 0.85 * avant)
        finally:
            shutil.rmtree(dossier, ignore_errors=True)


@unittest.skipUnless(AVEC_CV2, "numpy / OpenCV absents")
class TestPasseVisageExecutee(unittest.TestCase):
    """V6 P0 n° 3 : la passe visage (`executer_passe` → `Passe.traiter`) EXÉCUTÉE de bout en bout, vrai FFmpeg et vrai
    OpenCV, sur 5 s d'un visage de synthèse (pas de vraie prise dans le dépôt : l'essai sur IMG_7747 reste à faire sur
    le serveur). Grain temporel, visage sombre, bouche ouverte de 2 à 3 s ; dents visibles de 3,5 à 4,5 s alors que
    la piste dit la bouche FERMÉE (les dents ne doivent être blanchies que bouche ouverte)."""

    L, H, FPS, DUREE = 960, 540, 25, 5.0
    CX, CY, RX, RY = 480, 250, 70, 92
    PEAU = (120, 85, 72)
    # Dents jaunies assez sombres pour que le gain ne les sature pas (sinon tout tend vers le blanc, b* compris).
    DENTS = (172, 158, 118)

    @classmethod
    def setUpClass(cls):
        import gzip
        import json
        import shutil
        import subprocess
        import tempfile

        import cv2
        import numpy as np

        if not shutil.which("ffmpeg"):
            raise unittest.SkipTest("ffmpeg absent")
        cls.dossier = tempfile.mkdtemp(prefix="passe-visage-")
        rng = np.random.default_rng(3)
        n = int(cls.DUREE * cls.FPS)
        cls.source = os.path.join(cls.dossier, "prise.mp4")
        enc = subprocess.Popen(["ffmpeg", "-v", "error", "-nostdin", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{cls.L}x{cls.H}", "-r", str(cls.FPS), "-i", "pipe:0",
                                "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p10le,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv",
                                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "6", "-profile:v", "high10", cls.source], stdin=subprocess.PIPE)
        fond = np.zeros((cls.H, cls.L, 3), np.float32)
        fond[:] = np.linspace(150, 120, cls.L, dtype=np.float32)[None, :, None] * np.array([1.0, 0.97, 0.92], np.float32)
        cv2.ellipse(fond, (cls.CX, cls.H), (200, 150), 0, 180, 360, (45, 55, 80), -1)  # épaules (pull)
        t_pts, pts, bouche = [], [], []
        for k in range(n):
            t = k / cls.FPS
            ouverte = 2.0 <= t < 3.0
            dents_vues = ouverte or 3.5 <= t < 4.5
            img = fond.copy()
            cv2.ellipse(img, (cls.CX, cls.CY), (cls.RX, cls.RY), 0, 0, 360, cls.PEAU, -1)
            for dx in (-0.38, 0.38):
                c = (int(cls.CX + dx * cls.RX), int(cls.CY - 0.12 * cls.RY))
                cv2.ellipse(img, c, (int(0.2 * cls.RX), int(0.07 * cls.RY)), 0, 0, 360, (235, 235, 230), -1)
                cv2.circle(img, c, int(0.055 * cls.RY), (60, 40, 30), -1)
            bx, by = cls.CX, int(cls.CY + 0.5 * cls.RY)
            cv2.ellipse(img, (bx, by), (int(0.3 * cls.RX), int((0.13 if dents_vues else 0.07) * cls.RY)), 0, 0, 360, (150, 70, 70), -1)
            if dents_vues:
                cv2.ellipse(img, (bx, by), (int(0.24 * cls.RX), int(0.08 * cls.RY)), 0, 0, 360, (40, 20, 20), -1)
                cv2.rectangle(img, (bx - int(0.2 * cls.RX), by - int(0.07 * cls.RY)), (bx + int(0.2 * cls.RX), by), cls.DENTS, -1)
            img += rng.normal(0, 6.0, img.shape).astype(np.float32)  # grain temporel
            enc.stdin.write(np.clip(img, 0, 255).astype(np.uint8).tobytes())
            if k % 5 == 0:
                t_pts.append(round(t, 3))
                p = _points_visage(np, cls.CX, cls.CY, cls.RX, cls.RY, ouverte) / np.array([cls.L, cls.H], np.float32)
                pts.append(p.reshape(-1).round(5).tolist())
                bouche.append({"t": round(t, 3), "bouche": 0.6 if ouverte else 0.0})
        enc.stdin.close()
        assert enc.wait() == 0
        from aligneur.visages import INDICES_POINTS

        cls.points = os.path.join(cls.dossier, "points.json.gz")
        with gzip.open(cls.points, "wt", encoding="utf-8") as f:
            json.dump({"version": 1, "indices": INDICES_POINTS, "t": t_pts, "points": pts, "confiance": [1] * len(t_pts)}, f)
        cls.piste = os.path.join(cls.dossier, "piste.json.gz")
        with gzip.open(cls.piste, "wt", encoding="utf-8") as f:
            json.dump({"echantillons": bouche}, f)
        from aligneur.image import executer_passe

        cls.sortie = os.path.join(cls.dossier, "sortie", "image-10bits.mp4")
        travail = os.path.join(cls.dossier, "travail")
        os.makedirs(travail)
        demande = {"source": cls.source, "depots": {"image": cls.sortie}, "parametres": {"etape": "passe", "image": {"lumiere": "juste", "couleurs": "juste", "mine": "juste", "dents": "juste"}, "points": cls.points, "piste": cls.piste, "cles": {"image": "facecam/v/ver/image-10bits.mp4"}}}
        cls.resultat = executer_passe(demande, travail, lambda _p: None)

    @classmethod
    def tearDownClass(cls):
        import shutil

        shutil.rmtree(cls.dossier, ignore_errors=True)

    def image(self, chemin, t, x0=0):
        """Image RGB 0-1 (float) à l'instant t ; `x0` : décalage de la bande dans la source."""
        import subprocess

        import numpy as np

        r = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-ss", f"{t:.3f}", "-i", chemin, "-frames:v", "1", "-vf", "scale=in_color_matrix=bt709:in_range=tv,format=rgb48le", "-f", "rawvideo", "-"], capture_output=True)
        largeur = int(len(r.stdout) / 6 / self.H)
        img = np.frombuffer(r.stdout, "<u2").reshape(self.H, largeur, 3).astype(np.float32) / 65535.0
        return img[:, x0:] if x0 else img

    def lab_dents(self, img, decalage):
        from aligneur.image import lab

        bx, by = self.CX - decalage, int(self.CY + 0.5 * self.RY)
        zone = img[by - int(0.06 * self.RY): by - 2, bx - int(0.15 * self.RX): bx + int(0.15 * self.RX)]
        return lab(zone.reshape(1, -1, 3).clip(0, 1))[0].mean(0)

    def test_resultat_depose_et_mesures(self):
        r = self.resultat
        self.assertTrue(os.path.exists(self.sortie))
        self.assertEqual(r["fichierCle"], "facecam/v/ver/image-10bits.mp4")
        m = r["mesures"]
        # Visage sombre ramené dans la plage visée (100-140 sur 255), plus clair qu'avant.
        self.assertLess(m["luminanceVisageAvant"], 100)
        self.assertGreaterEqual(m["luminanceVisageApres"], 100)
        self.assertLessEqual(m["luminanceVisageApres"], 140)
        # Débruitage : le visage est MOINS granuleux que l'original (contrôle « jamais plus de bruit »).
        self.assertLess(m["bruitRatio"], 1.0)
        self.assertIn("murLab", m)

    def test_gain_fixe_sans_pompage(self):
        import numpy as np

        x = self.resultat["bande"]["x"]
        rapports = []
        for t in (0.6, 1.6, 2.6, 3.6, 4.4):
            avant = self.image(self.source, t)[30:90, x + 10: x + 60].mean()
            apres = self.image(self.sortie, t)[30:90, 10:60].mean()
            rapports.append(apres / avant)
        self.assertLess(float(np.std(rapports)), 0.01, rapports)

    def test_dents_blanchies_seulement_bouche_ouverte(self):
        x = self.resultat["bande"]["x"]
        ouverte_avant = self.lab_dents(self.image(self.source, 2.5), 0)
        ouverte_apres = self.lab_dents(self.image(self.sortie, 2.5), x)
        fermee_avant = self.lab_dents(self.image(self.source, 4.0), 0)
        fermee_apres = self.lab_dents(self.image(self.sortie, 4.0), x)
        # Mêmes dents à l'entrée aux deux instants : seul le signal « bouche » diffère.
        self.assertAlmostEqual(float(ouverte_avant[2]), float(fermee_avant[2]), delta=1.0)
        # Bouche ouverte : le jaune des dents baisse nettement de plus que la balance globale (b* Lab).
        self.assertLess(ouverte_apres[2], fermee_apres[2] - 3.0, (ouverte_apres, fermee_apres))
        # Piste « bouche fermée » : aucune retouche des dents (seuls le gain et la balance globaux jouent).
        self.assertGreater(fermee_apres[2], fermee_avant[2] - 4.0, (fermee_avant, fermee_apres))
        # Jamais plus clair que le blanc des yeux.
        self.assertLess(ouverte_apres[0], 100.0)
