"""Synchro son-image de bout en bout (10/10, `docs/facecam/JOURNAL-CONTROLES-QUALITE.md`) : une source synthétique
« iPhone » (cadence variable autour de 30 i/s, base de temps 600, son qui démarre 0,2 s après l'image dans le MOV) avec
un FLASH et un BIP au même instant du conteneur passe par les vraies étapes `/son` (coupe comprise) et `/image`
cadrage (préparation 25 i/s) ; dans la piste montée, le flash et le bip doivent tomber à ± 1 image. Le contrôle machine
de synchro doit dire 0, et retrouver un décalage injecté. Demande FFmpeg et numpy (sautés sinon)."""
import math
import os
import shutil
import subprocess
import tempfile
import unittest

try:
    import numpy as np
except ImportError:  # pragma: no cover
    np = None

FFMPEG = shutil.which("ffmpeg") and shutil.which("ffprobe")
FPS_SOURCE = 30
IMAGE_FLASH = 120  # ≈ 4,0 s
DEPART_SON = 0.2  # le flux son commence 0,2 s après l'image (edit list du MOV)
GARDES = [{"debutSec": 0.0, "finSec": 2.5}, {"debutSec": 3.0, "finSec": 7.0}]
PLANS = [
    {"debutSec": 0.0, "finSec": 2.5, "priseDebutSec": 0.0, "priseFinSec": 2.5, "cadre": {"x": 0, "y": 0, "largeur": 320, "hauteur": 240}},
    {"debutSec": 2.5, "finSec": 6.5, "priseDebutSec": 3.0, "priseFinSec": 7.0, "cadre": {"x": 0, "y": 0, "largeur": 320, "hauteur": 240}},
]


def instant_flash() -> float:
    """Horodatage exact (base 1/600) de l'image du flash après la cadence variable."""
    return round((IMAGE_FLASH / FPS_SOURCE + 0.012 * math.sin(IMAGE_FLASH)) * 600) / 600


def fabriquer_prise(dossier: str) -> str:
    """MOV : image noire puis blanche dès IMAGE_FLASH (cadence variable), voix synthétique et bip à l'instant du flash."""
    f = 48000
    t_flash = instant_flash()
    duree_son = 7.5 - DEPART_SON
    rng = np.random.default_rng(7)
    t = np.arange(int(duree_son * f)) / f
    voix = np.zeros_like(t)
    # Syllabes : bruit filtré modulé par des enveloppes de 120-260 ms, silences variables ; rien à ± 0,7 s du flash.
    debut = 0.15
    while debut < duree_son - 0.3:
        longueur = rng.uniform(0.12, 0.26)
        centre_conteneur = debut + DEPART_SON + longueur / 2
        if abs(centre_conteneur - t_flash) > 0.7 + longueur / 2:
            m = (t >= debut) & (t < debut + longueur)
            env = np.sin(np.pi * (t[m] - debut) / longueur) ** 2
            bruit = np.convolve(rng.standard_normal(m.sum()), np.ones(6) / 6, mode="same")
            voix[m] += 0.6 * rng.uniform(0.4, 1.0) * env * bruit / (np.abs(bruit).max() + 1e-9)
        debut += longueur + rng.uniform(0.05, 0.35)
    voix += 0.002 * rng.standard_normal(len(t))  # bruit de fond de la pièce
    bip = (t >= t_flash - DEPART_SON) & (t < t_flash - DEPART_SON + 0.08)
    voix[bip] += 0.5 * np.sin(2 * np.pi * 1000 * t[bip])
    wav = os.path.join(dossier, "voix.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(f), "-ac", "1", "-i", "pipe:0", "-c:a", "pcm_s16le", wav], input=voix.astype(np.float32).tobytes(), check=True)
    prise = os.path.join(dossier, "prise.mov")
    subprocess.run([
        "ffmpeg", "-v", "error", "-y",
        "-f", "lavfi", "-i", f"color=c=black:s=320x240:r={FPS_SOURCE}:d=7.5",
        "-itsoffset", str(DEPART_SON), "-i", wav,
        "-vf", f"geq=lum='if(gte(N,{IMAGE_FLASH}),235,16)':cb=128:cr=128,settb=1/600,setpts=(N/{FPS_SOURCE}+0.012*sin(N))/TB",
        "-fps_mode", "passthrough", "-video_track_timescale", "600", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "pcm_s16le", prise,
    ], check=True)
    return prise


def debut_flux(chemin: str, type_flux: str) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", type_flux[0], "-show_entries", "stream=start_time", "-of", "csv=p=0", chemin], capture_output=True, check=True)
    return float(r.stdout.decode().strip().splitlines()[0])


def flash_et_bip(chemin: str) -> tuple[float, float]:
    """Instant (s) de la première image blanche (25 i/s) et du début du bip, lus comme un lecteur les lit."""
    from aligneur.son import lire_son

    r = subprocess.run(["ffmpeg", "-v", "error", "-i", chemin, "-an", "-vf", "fps=25:start_time=0,scale=32:24", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True, check=True)
    lum = np.frombuffer(r.stdout, np.uint8).reshape(-1, 32 * 24).mean(1)
    t_image = int(np.argmax(lum > 128)) / 25
    son = lire_son(chemin, 48000)
    a, b = int((t_image - 0.6) * 48000), int((t_image + 0.6) * 48000)
    fenetre = np.abs(son[max(0, a) : b])
    t_son = (max(0, a) + int(np.argmax(fenetre > 0.3 * fenetre.max()))) / 48000
    return t_image, t_son


@unittest.skipUnless(FFMPEG and np is not None, "FFmpeg ou numpy absent")
class SynchroBoutEnBout(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from aligneur.image import executer_cadrage
        from aligneur.son import executer_son

        cls.dossier = tempfile.mkdtemp(prefix="synchro-")
        cls.prise = fabriquer_prise(cls.dossier)
        travail = os.path.join(cls.dossier, "son")
        os.makedirs(travail)
        cls.son = os.path.join(cls.dossier, "sorties", "son.flac")
        executer_son({"source": cls.prise, "depots": {"son": cls.son}, "parametres": {"gardes": GARDES, "voix": {"nettoyer": False}}}, travail, lambda p: None)
        travail = os.path.join(cls.dossier, "cadrage")
        os.makedirs(travail)
        cls.montage = os.path.join(cls.dossier, "sorties", "montage.mov")
        cls.resultat = executer_cadrage({
            "source": cls.prise,
            "depots": {"montage": cls.montage},
            "parametres": {"etape": "cadrage", "preparer": True, "plans": PLANS, "son": cls.son, "prise": cls.prise, "sortie": {"largeur": 160, "hauteur": 120}},
        }, travail, lambda p: None)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.dossier, ignore_errors=True)

    def test_source_conforme(self):
        # La source reproduit bien le cas : son qui démarre après l'image, flash et bip au même instant du conteneur.
        self.assertAlmostEqual(debut_flux(self.prise, "audio") - debut_flux(self.prise, "video"), DEPART_SON, places=2)
        t_image, t_son = flash_et_bip(self.prise)
        self.assertLessEqual(abs(t_son - t_image) * 25, 1.0, (t_image, t_son))

    def test_piste_montee_alignee_a_une_image(self):
        t_image, t_son = flash_et_bip(self.montage)
        attendu = instant_flash() - 0.5  # 0,5 s coupées avant le flash
        self.assertLessEqual(abs(t_image - attendu) * 25, 1.0, (t_image, attendu))
        self.assertLessEqual(abs(t_son - t_image) * 25, 1.0, f"flash {t_image:.3f} s, bip {t_son:.3f} s")

    def test_controle_machine_dit_synchrone(self):
        c = self.resultat["controles"]
        self.assertEqual(c["version"], 2)
        self.assertIn(c["decalageSynchroImages"], (-1, 0, 1), c.get("synchro"))
        self.assertGreater(c["synchro"]["correlation"], 0.5)

    def test_controle_retrouve_un_decalage_injecte(self):
        from aligneur.image import decalage_synchro

        # Son retardé de 120 ms (3 images) : +3 ; image qui démarre 120 ms après le son dans le conteneur : −3.
        retard = os.path.join(self.dossier, "retard.mov")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", self.montage, "-map", "0:v", "-map", "0:a", "-c:v", "copy", "-af", "adelay=120:all=1", "-c:a", "pcm_s24le", retard], check=True)
        self.assertEqual(decalage_synchro(retard, PLANS, self.prise)["images"], 3)
        image_tard = os.path.join(self.dossier, "image-tard.mkv")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-itsoffset", "0.12", "-i", self.montage, "-i", self.montage, "-map", "0:v", "-map", "1:a", "-c", "copy", image_tard], check=True)
        self.assertEqual(decalage_synchro(image_tard, PLANS, self.prise)["images"], -3)

    def test_sans_prise_aucune_conclusion(self):
        from aligneur.image import controles_machine

        c = controles_machine(self.montage, PLANS, None, self.dossier, True)
        self.assertIsNone(c["decalageSynchroImages"])


if __name__ == "__main__":
    unittest.main()
