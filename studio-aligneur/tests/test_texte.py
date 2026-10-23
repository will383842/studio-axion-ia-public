"""Préparation du texte (pur) : python -m unittest discover -s tests -t . (sans modèle ni torch)."""
import unittest

from aligneur.texte import decouper, forme_dite, nombre_en_lettres, phrases


class TestTexte(unittest.TestCase):
    def test_nombres(self):
        attendus = {0: "zéro", 21: "vingt-et-un", 71: "soixante-et-onze", 80: "quatre-vingts", 81: "quatre-vingt-un",
                    99: "quatre-vingt-dix-neuf", 135: "cent-trente-cinq", 200: "deux-cents", 2026: "deux-mille-vingt-six",
                    80000: "quatre-vingt-mille", 1500000: "un-million-cinq-cent-mille"}
        for n, dit in attendus.items():
            self.assertEqual(nombre_en_lettres(n), dit, n)

    def test_formes_dites(self):
        self.assertEqual(forme_dite("135"), "cent-trente-cinq")
        self.assertEqual(forme_dite("€"), "euros")
        self.assertEqual(forme_dite("PV,"), "pé-vé")
        self.assertEqual(forme_dite("Axion-IA,"), "axion-i-a")
        self.assertEqual(forme_dite("RGPD"), "èr-jé-pé-dé")
        self.assertEqual(forme_dite("SAS"), "sas")  # sigle qui se dit comme un mot
        self.assertEqual(forme_dite("1,5"), "un-virgule-cinq")
        self.assertEqual(forme_dite("14h30"), "quatorze-heures-trente")
        self.assertEqual(forme_dite("1er"), "premier")
        self.assertEqual(forme_dite("jours."), "jours")
        self.assertEqual(forme_dite("45%"), "quarante-cinq-pour-cent")

    def test_decoupage(self):
        self.assertEqual(decouper("Un bon PV, puis un pépin : voilà."), ["Un", "bon", "PV,", "puis", "un", "pépin", "voilà."])
        self.assertEqual(decouper("135 € ?"), ["135", "€"])

    def test_phrases(self):
        self.assertEqual(phrases(["Un", "bon.", "Deux", "trois", "!", "quatre"]), [(0, 2), (2, 5), (5, 6)])
        self.assertEqual(phrases(["a"] * 100, max_mots=45), [(0, 45), (45, 90), (90, 100)])


if __name__ == "__main__":
    unittest.main()
