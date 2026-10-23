"""Lot R6 : le serveur refuse de démarrer sans la clé partagée (sans modèle ni torch)."""
import unittest

from aligneur.__main__ import cle_obligatoire


class CleObligatoire(unittest.TestCase):
    def test_sans_cle_refus(self):
        for env in ({}, {"STUDIO_RENDU_CLE": ""}, {"STUDIO_RENDU_CLE": "   "}):
            with self.assertRaises(SystemExit) as e:
                cle_obligatoire(env)
            self.assertIn("refus de démarrer", str(e.exception))

    def test_avec_cle(self):
        self.assertEqual(cle_obligatoire({"STUDIO_RENDU_CLE": " abc "}), "abc")


if __name__ == "__main__":
    unittest.main()
