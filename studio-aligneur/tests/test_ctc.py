"""Calcul pur du calage (numpy seul, sans modèle) : alignement forcé CTC, blancs, affinage."""
import unittest

import numpy as np

from aligneur.ctc import affiner, silences, spans, viterbi_ctc


def logp_depuis(chemin, vocabulaire=5, sur=0.9):
    """Probabilités imitées : à chaque image, le jeton du chemin voulu est très probable."""
    p = np.full((len(chemin), vocabulaire), (1 - sur) / (vocabulaire - 1))
    for t, j in enumerate(chemin):
        p[t, j] = sur
    return np.log(p)


class TestViterbi(unittest.TestCase):
    def test_retrouve_le_chemin(self):
        # blanc=0 ; lettres 1, 2, 2 (deux mêmes lettres : un blanc entre elles est dû), 3
        voulu = [0, 0, 1, 1, 0, 2, 0, 2, 2, 0, 3, 0]
        chemin = viterbi_ctc(logp_depuis(voulu), [1, 2, 2, 3])
        self.assertEqual(spans(chemin, 4), [(2, 3), (5, 5), (7, 8), (10, 10)])

    def test_son_trop_court(self):
        with self.assertRaises(ValueError):
            viterbi_ctc(logp_depuis([0, 1]), [1, 1, 2])

    def test_texte_vide(self):
        self.assertTrue((viterbi_ctc(logp_depuis([0, 0, 0]), []) == -1).all())


class TestSilences(unittest.TestCase):
    def test_blanc_relatif_a_la_voix(self):
        freq = 16000
        t = np.arange(freq) / freq
        voix = (0.3 * np.sin(2 * np.pi * 200 * t)).astype(np.float32)
        souffle = (0.003 * np.random.default_rng(1).standard_normal(freq // 2)).astype(np.float32)  # −50 dB
        son = np.concatenate([voix, souffle, voix])
        blancs = silences(son)
        self.assertEqual(len(blancs), 1)
        self.assertAlmostEqual(blancs[0][0], 1.0, delta=0.02)
        self.assertAlmostEqual(blancs[0][1], 1.5, delta=0.02)


class TestAffiner(unittest.TestCase):
    def test_latence_retiree_et_ordre(self):
        r = affiner([0.60, 0.80], [0.70, 1.00], [], 2.0, latence=0.05, fin_supplement=0.18)
        self.assertEqual(r[0][0], 0.55)
        self.assertEqual(r[1][0], 0.75)
        self.assertEqual(r[0][1], 0.75)  # parole continue : la fin rejoint le mot suivant
        self.assertLessEqual(r[1][1], 2.0)

    def test_debut_pose_sur_la_reprise_apres_un_blanc(self):
        # Blanc de 1,0 à 1,40 s après le premier mot ; début CTC du second à 1,55 s : posé sur la reprise (1,40 s).
        r = affiner([0.2, 1.55], [0.6, 1.9], [(1.0, 1.40)], 3.0, latence=0.05, fin_supplement=0.18)
        self.assertEqual(r[1][0], 1.40)
        # La fin du premier mot s'arrête au début du blanc : le nettoyage retrouve le blanc.
        self.assertEqual(r[0][1], 0.78)
        self.assertLessEqual(r[0][1], 1.0)

    def test_un_blanc_avant_le_mot_precedent_ne_compte_pas(self):
        # Blanc de tête (0 à 0,45 s) : il ne doit pas tirer le DEUXIÈME mot en arrière.
        r = affiner([0.55, 0.75], [0.70, 0.95], [(0.0, 0.45)], 2.0, latence=0.05, fin_supplement=0.18)
        self.assertEqual(r[0][0], 0.45)
        self.assertEqual(r[1][0], 0.70)

    def test_sans_accrocher(self):
        r = affiner([0.2, 1.55], [0.6, 1.9], [(1.0, 1.40)], 3.0, latence=0.05, fin_supplement=0.18, accrocher=False)
        self.assertEqual(r[1][0], 1.50)


if __name__ == "__main__":
    unittest.main()
