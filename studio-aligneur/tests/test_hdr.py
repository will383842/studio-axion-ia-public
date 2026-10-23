"""HDR / BT.2020 → SDR BT.709 (09/10) : détection, table 3D (BT.2100, BT.2408), prise SDR inchangée. Sans FFmpeg."""
import json
import os
import tempfile
import unittest
from unittest import mock

from aligneur import media
from aligneur.controle_ffmpeg import hlg_depuis_sdr


def sonde_de(flux: dict) -> dict:
    sortie = mock.Mock(stdout=json.dumps({"streams": [{"codec_type": "video", "width": 1920, "height": 1080, **flux}], "format": {"duration": "3.0"}}).encode())
    with mock.patch.object(media, "executer", return_value=sortie):
        return media.sonder("prise.mov")


class Detection(unittest.TestCase):
    def test_iphone_hlg_dolby_vision_84(self):
        s = sonde_de({"color_transfer": "arib-std-b67", "color_primaries": "bt2020", "color_space": "bt2020nc",
                      "side_data_list": [{"side_data_type": "DOVI configuration record", "dv_profile": 8, "dv_bl_signal_compatibility_id": 4}]})
        self.assertTrue(s["hdr"])
        self.assertEqual(s["conversion"], "hlg")
        self.assertEqual(s["dolbyVision"], 8)

    def test_pq_avec_maxcll(self):
        s = sonde_de({"color_transfer": "smpte2084", "color_primaries": "bt2020", "side_data_list": [{"side_data_type": "Content light level metadata", "max_content": 1600, "max_average": 400}]})
        self.assertEqual(s["conversion"], "pq")
        self.assertAlmostEqual(media.pic_relatif(s, "pq"), 1600 / 203, places=3)

    def test_bt2020_sdr_et_sdr(self):
        self.assertEqual(sonde_de({"color_transfer": "bt2020-10", "color_primaries": "bt2020"})["conversion"], "bt2020")
        sdr = sonde_de({"color_transfer": "bt709", "color_primaries": "bt709"})
        self.assertEqual(sdr["conversion"], "")
        self.assertFalse(sdr["hdr"])

    def test_sdr_passe_inchangee(self):
        # Même chaîne qu'avant le 09/10 : aucune étape de couleur.
        sdr = sonde_de({"color_transfer": "bt709", "color_primaries": "bt709"})
        self.assertEqual(media.filtre_preparation(sdr), "fps=25:start_time=0")
        self.assertEqual(media.filtre_preparation(sdr, 960), "fps=25:start_time=0,scale=960:-2:flags=area")
        self.assertEqual(media.filtre_preparation({"hdr": False}), "fps=25:start_time=0")


class Table(unittest.TestCase):
    PIC = 1000 / 203

    def test_aller_retour_gris_et_peau(self):
        # Une couleur SDR codée en HLG (BT.2408) revient à elle-même (sous le genou des reflets).
        for rgb in [(0.2, 0.2, 0.2), (0.45, 0.45, 0.45), (0.7, 0.7, 0.7), (194 / 255, 150 / 255, 130 / 255), (115 / 255, 82 / 255, 68 / 255), (98 / 255, 122 / 255, 157 / 255)]:
            lu = media.point_sdr(*hlg_depuis_sdr(rgb), "hlg", self.PIC)
            for a, b in zip(lu, rgb):
                self.assertAlmostEqual(a, b, delta=0.002, msg=f"{rgb} → {lu}")

    def test_reflets_comprimes_sans_ecretage_et_monotones(self):
        prec = -1.0
        for i in range(101):
            v = media.point_sdr(i / 100, i / 100, i / 100, "hlg", self.PIC)[0]
            self.assertGreaterEqual(v, prec)
            prec = v
        self.assertLess(media.point_sdr(0.85, 0.85, 0.85, "hlg", self.PIC)[0], media.point_sdr(0.95, 0.95, 0.95, "hlg", self.PIC)[0])
        self.assertLessEqual(prec, 1.0)
        self.assertGreater(prec, 0.995)  # le pic HLG (1000 cd/m²) touche le blanc SDR

    def test_teinte_gardee_couleur_vive(self):
        # Reflet de peau (front brillant) : comprimé, toujours plus rouge que vert que bleu.
        r, g, b = media.point_sdr(0.92, 0.8, 0.72, "hlg", self.PIC)
        self.assertTrue(1.0 > r > g > b > 0.5, (r, g, b))
        # Rouge HLG très vif : reste rouge (il ne blanchit pas).
        r, g, b = media.point_sdr(1.0, 0.3, 0.2, "hlg", self.PIC)
        self.assertGreater(r, 0.95)
        self.assertLess(max(g, b), 0.2)

    def test_pq_blanc_de_reference(self):
        # PQ 58 % ≈ 203 cd/m² = blanc SDR (pris dans l'épaule : ≈ 96 %).
        v = media.point_sdr(0.5807, 0.5807, 0.5807, "pq", 1000 / 203)[0]
        self.assertAlmostEqual(v, 0.957, delta=0.01)

    def test_bt2020_sdr_blanc_et_noir(self):
        self.assertAlmostEqual(media.point_sdr(1, 1, 1, "bt2020", 1.0)[0], 1.0, places=3)
        self.assertEqual(media.point_sdr(0, 0, 0, "bt2020", 1.0), (0.0, 0.0, 0.0))

    def test_fichier_cube_et_filtre(self):
        with tempfile.TemporaryDirectory() as d:
            chemin = media.table_conversion("hlg", self.PIC, taille=5, dossier=d)
            with open(chemin, encoding="ascii") as f:
                lignes = f.read().splitlines()
            self.assertIn("LUT_3D_SIZE 5", lignes)
            self.assertEqual(len([x for x in lignes if x and x[0].isdigit()]), 125)
            self.assertEqual(media.table_conversion("hlg", self.PIC, taille=5, dossier=d), chemin)  # gardée
            with mock.patch.object(media, "DOSSIER_LUTS", d), mock.patch.object(media, "TAILLE_LUT", 5):
                f = media.filtre_preparation({"hdr": True, "transfert": "arib-std-b67", "conversion": "hlg"}, 960)
            self.assertIn("scale=in_color_matrix=bt2020:in_range=tv", f)
            self.assertIn(f"lut3d=file={os.path.join(d, 'hlg-pic4.926-t65-v1.cube')}:interp=tetrahedral", f.replace("t5", "t65"))
            self.assertTrue(f.endswith(f"{media.ETIQUETTES_BT709},fps=25:start_time=0,scale=960:-2:flags=area"))


if __name__ == "__main__":
    unittest.main()
