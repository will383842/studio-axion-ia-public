"""Hésitations (rapport V6, P0 n° 7) : Whisper efface les « euh » (0 « euh » dans la transcription réelle d'IMG_7747).

Deux remèdes, testés ici sans modèle :
  1. une invite VERBATIM (exemple écrit avec des « euh » et des mots redits) pour que Whisper les garde ;
  2. une détection ACOUSTIQUE des pauses remplies (voyelle tenue, voisée, spectre stable, hors des mots transcrits),
     qui rajoute un mot « euh » à la transcription : la brique `coupes` peut alors le couper.
Le son d'essai est synthétisé (syllabes variées pour la parole, voyelle /ø/ tenue pour le « euh »).
"""
import importlib.util
import math
import unittest

AVEC_NUMPY = importlib.util.find_spec("numpy") is not None
SR = 16000


def _voyelle(np, duree, f0, formants, derive=0.0, amplitude=0.3):
    """Voyelle par synthèse additive : harmoniques de f0 pondérées par l'enveloppe de 3 formants."""
    t = np.arange(int(duree * SR)) / SR
    f0_t = f0 * (1 + derive * (t / max(duree, 1e-3) - 0.5))
    phase = 2 * math.pi * np.cumsum(f0_t) / SR
    signal = np.zeros_like(t)
    for k in range(1, int(4000 / f0)):
        f = k * f0
        gain = sum(1.0 / (1 + ((f - fc) / bw) ** 2) for fc, bw in formants) / k**0.6
        signal += gain * np.sin(k * phase)
    env = np.minimum(1, np.minimum(t, duree - t) / 0.02)
    return amplitude * signal / (np.abs(signal).max() + 1e-9) * env


VOYELLES = [[(700, 90), (1200, 110), (2500, 150)], [(300, 60), (2200, 120), (3000, 160)], [(450, 80), (900, 100), (2400, 150)], [(350, 70), (1800, 110), (2500, 150)], [(600, 90), (1700, 110), (2600, 150)]]
EUH = [(420, 70), (1500, 110), (2400, 150)]


def _parole(np, rng, duree):
    """Syllabes de 90 à 160 ms (voyelle + bruit de consonne), f0 et timbre qui changent sans arrêt."""
    morceaux = []
    total = 0.0
    while total < duree:
        d = rng.uniform(0.09, 0.16)
        morceaux.append(_voyelle(np, d, rng.uniform(100, 190), VOYELLES[rng.integers(len(VOYELLES))], derive=rng.uniform(-0.2, 0.2)))
        c = rng.uniform(0.03, 0.06)
        morceaux.append(rng.normal(0, 0.05, int(c * SR)))
        total += d + c
    return np.concatenate(morceaux)[: int(duree * SR)]


@unittest.skipUnless(AVEC_NUMPY, "numpy absent")
class TestPausesRemplies(unittest.TestCase):
    def construire(self):
        import numpy as np

        rng = np.random.default_rng(7)
        bruit = lambda d: rng.normal(0, 0.002, int(d * SR))  # noqa: E731
        segments = [
            ("silence", bruit(0.5)),
            ("parole", _parole(np, rng, 1.6)),  # mots 0.5-2.1
            ("silence", bruit(0.15)),
            ("euh", _voyelle(np, 0.55, 118, EUH, derive=0.02)),  # « euh » 2.25-2.80, absent de Whisper
            ("silence", bruit(0.2)),
            ("parole", _parole(np, rng, 1.4)),  # 3.0-4.4
            ("souffle", rng.normal(0, 0.02, int(0.4 * SR))),  # respiration (non voisée) 4.4-4.8
            ("parole", _parole(np, rng, 1.2)),  # 4.8-6.0
            ("silence", bruit(0.6)),  # 6.0-6.6
            ("tenue", _voyelle(np, 0.5, 130, VOYELLES[0], derive=0.01)),  # voyelle tenue DANS un mot transcrit 6.6-7.1
            ("silence", bruit(0.4)),
        ]
        son = np.concatenate([s for _, s in segments]).astype(np.float32)
        mots = [
            {"mot": "Bonjour", "debutSec": 0.5, "finSec": 1.2},
            {"mot": "à", "debutSec": 1.25, "finSec": 1.4},
            {"mot": "tous,", "debutSec": 1.45, "finSec": 2.1},
            {"mot": "je", "debutSec": 3.0, "finSec": 3.3},
            {"mot": "voulais", "debutSec": 3.35, "finSec": 3.9},
            {"mot": "dire", "debutSec": 3.95, "finSec": 4.4},
            {"mot": "que", "debutSec": 4.8, "finSec": 5.2},
            {"mot": "voilà", "debutSec": 5.25, "finSec": 6.0},
            {"mot": "ah", "debutSec": 6.6, "finSec": 7.1},
        ]
        return son, mots

    def test_le_euh_absent_de_whisper_est_retrouve_et_rien_d_autre(self):
        from aligneur.hesitations import pauses_remplies

        son, mots = self.construire()
        trouvees = pauses_remplies(son, SR, mots)
        self.assertEqual(len(trouvees), 1, trouvees)
        self.assertAlmostEqual(trouvees[0]["debutSec"], 2.25, delta=0.08)
        self.assertAlmostEqual(trouvees[0]["finSec"], 2.80, delta=0.08)

    def test_les_mots_euh_sont_inseres_dans_la_transcription_a_leur_place(self):
        from aligneur.hesitations import avec_pauses_remplies

        son, mots = self.construire()
        sortie, n = avec_pauses_remplies(son, SR, mots)
        self.assertEqual(n, 1)
        self.assertEqual([m["mot"] for m in sortie][:4], ["Bonjour", "à", "tous,", "euh"])
        self.assertEqual(sortie[3]["source"], "acoustique")
        self.assertEqual(len(sortie), len(mots) + 1)

    def test_rien_sur_du_silence_ou_sans_mots(self):
        import numpy as np

        from aligneur.hesitations import pauses_remplies

        self.assertEqual(pauses_remplies(np.zeros(SR * 2, np.float32), SR, []), [])


@unittest.skipUnless(AVEC_NUMPY, "numpy absent")
class TestChaineReelleFfmpeg(unittest.TestCase):
    def test_son_extrait_par_ffmpeg_relu_puis_euh_retrouve(self):
        """Vrai FFmpeg : le son passe par `extraire_son` (PCM flottant 32 bits, filtre d'alignement) puis est relu."""
        import os
        import shutil
        import tempfile
        import wave

        import numpy as np

        if not shutil.which("ffmpeg"):
            self.skipTest("ffmpeg absent")
        from aligneur.hesitations import avec_pauses_remplies
        from aligneur.media import extraire_son
        from aligneur.transcrire import lire_son_16k

        son, mots = TestPausesRemplies().construire()
        dossier = tempfile.mkdtemp(prefix="hesitations-")
        try:
            source = os.path.join(dossier, "prise.wav")
            with wave.open(source, "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(SR)
                w.writeframes((np.clip(son, -1, 1) * 32767).astype("<i2").tobytes())
            relu = lire_son_16k(extraire_son(source, os.path.join(dossier, "son-16k.wav")))
            self.assertIsNotNone(relu)
            self.assertAlmostEqual(len(relu) / SR, len(son) / SR, delta=0.05)
            sortie, n = avec_pauses_remplies(relu, SR, mots)
            self.assertEqual(n, 1)
            euh = [m for m in sortie if m["mot"] == "euh"][0]
            self.assertAlmostEqual(euh["debutSec"], 2.25, delta=0.1)
        finally:
            shutil.rmtree(dossier, ignore_errors=True)


class TestInviteVerbatim(unittest.TestCase):
    def test_l_invite_montre_des_hesitations_et_garde_le_glossaire(self):
        from aligneur.transcrire import invite_whisper

        invite, mots_cles = invite_whisper(["Certifexemple", "OPCO"])
        self.assertIn("euh", invite.lower())
        # Un mot redit, comme Will le dit (« je… je ») : Whisper apprend à ne pas le nettoyer.
        self.assertRegex(invite, r"\bje\W+je\b")
        self.assertIn("Certifexemple", invite)
        self.assertEqual(mots_cles, "Certifexemple OPCO")
        sans, cles = invite_whisper([])
        self.assertIn("euh", sans.lower())
        self.assertIsNone(cles)

    def test_transcription_passe_l_invite_verbatim_et_ajoute_les_euh_acoustiques(self):
        from aligneur import transcrire

        vus = {}

        class Mot:
            def __init__(self, w, s, e):
                self.word, self.start, self.end, self.probability = w, s, e, 0.9

        class Segment:
            start, end, text = 0.5, 4.4, "Bonjour à tous, je voulais dire"
            words = [Mot(" Bonjour", 0.5, 1.2), Mot(" à", 1.25, 1.4), Mot(" tous,", 1.45, 2.1), Mot(" je", 3.0, 3.3)]

        class Info:
            duration, language = 7.5, "fr"

        class Modele:
            def transcribe(self, chemin, **options):
                vus.update(options)
                return iter([Segment()]), Info()

        ancien_modele, ancien_lire = transcrire.charger_whisper, transcrire.lire_son_16k
        transcrire.charger_whisper = lambda: Modele()
        transcrire.lire_son_16k = lambda chemin: None
        try:
            r = transcrire.transcrire_fichier("son.wav", ["Certifexemple"])
        finally:
            transcrire.charger_whisper, transcrire.lire_son_16k = ancien_modele, ancien_lire
        self.assertIn("euh", vus["initial_prompt"].lower())
        self.assertEqual(vus["hotwords"], "Certifexemple")
        self.assertEqual([m["mot"] for m in r["mots"]], ["Bonjour", "à", "tous,", "je"])
        self.assertEqual(r["hesitationsAcoustiques"], 0)


if __name__ == "__main__":
    unittest.main()
