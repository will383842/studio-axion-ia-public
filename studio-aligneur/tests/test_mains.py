"""Lot I2 (raccordé à l'intégration Z) : points et côté de la main dans la piste /visages. Calculs purs, sans MediaPipe."""
import unittest
from types import SimpleNamespace

from aligneur.visages import details_main, recaler_main


def point(x, y, z):
    return SimpleNamespace(x=x, y=y, z=z)


class TestMains(unittest.TestCase):
    def test_details_points_et_cote(self):
        main = [point(0.1 + i / 100, 0.5, -0.01 * i) for i in range(21)]
        d = details_main(main, "Left")
        self.assertEqual(len(d["points"]), 21)
        self.assertEqual(d["points"][3], [0.13, 0.5, -0.03])
        self.assertEqual(d["cote"], "gauche")
        self.assertEqual(details_main(main, "Right")["cote"], "droite")
        self.assertNotIn("cote", details_main(main, None))

    def test_recalage_par_la_bande(self):
        m = {"t": 1.0, "x": 0.5, "y": 0.4, "ouverte": True, "points": [[0.5, 0.4, 0.1]], "cote": "droite"}
        r = recaler_main(m, {"x": 1000, "largeur": 1080}, 3840)
        self.assertAlmostEqual(r["x"], round((1000 + 540) / 3840, 4))
        self.assertEqual(r["points"][0], [round((1000 + 540) / 3840, 4), 0.4, round(0.1 * 1080 / 3840, 4)])
        self.assertEqual(r["cote"], "droite")
        self.assertIs(recaler_main(m, None, 3840), m)
        sans = {"t": 1.0, "x": 0.5, "y": 0.4, "ouverte": False}
        self.assertNotIn("points", recaler_main(sans, {"x": 0, "largeur": 1920}, 3840))


if __name__ == "__main__":
    unittest.main()
