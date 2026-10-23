"""
Contrôle RÉEL de FFmpeg (09/10, après la panne d'export du FFmpeg 5.1 de Debian) : les commandes écrites par
`media.py`, `decor.py`, `son.py`, `image.py` et `calage.py` sont EXÉCUTÉES, par les mêmes fonctions que la production,
sur des sources lavfi courtes (≈ 2 s) dans un dossier temporaire effacé. Aucun dépôt R2 : `deposer_fichier` est
remplacé par une fonction vide le temps du contrôle.

  python -m aligneur.controle_ffmpeg     → une ligne par contrôle ; code 1 si un seul échoue

Lancé par deploiement/verifier-outils-video.sh dans l'image fraîchement construite, AVANT toute mise en ligne.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import time
from typing import Callable

LARGEUR, HAUTEUR, DUREE = 1920, 1080, 2.0


def ffmpeg(*args: str) -> None:
    r = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-y", *args], capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.decode("utf-8", "replace").strip().splitlines()[-1:] or "FFmpeg a échoué")


def cube_identite(chemin: str, taille: int = 17) -> str:
    lignes = [f"LUT_3D_SIZE {taille}"]
    for b in range(taille):
        for g in range(taille):
            for r in range(taille):
                lignes.append(f"{r / (taille - 1):.6f} {g / (taille - 1):.6f} {b / (taille - 1):.6f}")
    with open(chemin, "w", encoding="utf-8") as f:
        f.write("\n".join(lignes) + "\n")
    return chemin


def etiquettes(chemin: str) -> str:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=color_primaries,color_transfer,color_space,color_range",
                        "-of", "csv=p=0", chemin], capture_output=True, text=True)
    return r.stdout.strip()


def verifier_bt709(chemin: str) -> None:
    """Les fichiers 10 bits intermédiaires doivent sortir étiquetés BT.709 plage tv (lus ainsi par studio-rendu)."""
    lu = etiquettes(chemin)
    assert sorted(lu.split(",")) == sorted(["tv", "bt709", "bt709", "bt709"]), f"{os.path.basename(chemin)} étiqueté « {lu} » au lieu de BT.709 tv"


# Mire HDR (09/10) : cases SDR BT.709 connues, codées en HLG BT.2020 10 bits par les formules de l'UIT (BT.2100 et
# BT.2408 : blanc SDR = 203 cd/m², OOTF de gamma 1,2 sur la luminance, écran de 1000 cd/m²). Une bonne conversion
# HDR → SDR doit retrouver les valeurs SDR d'origine. Mesuré : l'ancienne chaîne (zscale + tonemap hable) rendait
# le gris 45 % à 102 sur 255 au lieu de 115 et la peau claire à (164, 121, 102) au lieu de (194, 150, 130).
MIRE_HDR = [("gris 45 %", (0.45, 0.45, 0.45)), ("peau claire", (194 / 255, 150 / 255, 130 / 255)), ("peau foncée", (115 / 255, 82 / 255, 68 / 255))]
COTE_MIRE = 64


def hlg_depuis_sdr(rgb: tuple[float, float, float]) -> tuple[float, float, float]:
    import math

    m = ((0.6274, 0.3293, 0.0433), (0.0691, 0.9195, 0.0114), (0.0164, 0.0880, 0.8956))
    lin = [v ** 2.4 * 203.0 for v in rgb]
    fd = [sum(m[i][k] * lin[k] for k in range(3)) for i in range(3)]
    ys = (0.2627 * fd[0] + 0.6780 * fd[1] + 0.0593 * fd[2]) / 1000.0
    es = [x / (1000.0 * ys ** (0.2 / 1.2)) for x in fd]
    a, b, c = 0.17883277, 0.28466892, 0.55991073
    return tuple(math.sqrt(3 * e) if e <= 1 / 12 else a * math.log(12 * e - b) + c for e in es)  # type: ignore[return-value]


def mire_hlg(chemin: str) -> None:
    """Cases côte à côte (64 px), 10 images, HEVC sans perte 10 bits étiqueté HLG BT.2020 (comme un iPhone)."""
    plans: list[list[int]] = [[], [], []]
    for _, rgb in MIRE_HDR:
        r, g, b = hlg_depuis_sdr(rgb)
        y = 0.2627 * r + 0.6780 * g + 0.0593 * b
        for k, v in enumerate((64 + 876 * y, 512 + 896 * (b - y) / 1.8814, 512 + 896 * (r - y) / 1.4746)):
            plans[k].append(int(round(v)))
    largeur = COTE_MIRE * len(MIRE_HDR)
    image = b"".join(b"".join(int(plans[k][x // COTE_MIRE]).to_bytes(2, "little") for x in range(largeur)) * COTE_MIRE for k in range(3))
    r = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-y", "-f", "rawvideo", "-pix_fmt", "yuv444p10le", "-s", f"{largeur}x{COTE_MIRE}", "-r", "25", "-i", "pipe:0",
                        "-vf", "format=yuv420p10le,setparams=color_primaries=bt2020:color_trc=arib-std-b67:colorspace=bt2020nc:range=tv",
                        "-c:v", "libx265", "-preset", "ultrafast", "-x265-params", "lossless=1:log-level=error:colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc:range=limited",
                        chemin], input=image * 10, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.decode("utf-8", "replace").strip().splitlines()[-1:] or "mire HLG impossible")


# Rapport V6, P0 n° 2 : bandes sur le mur. Dégradé doux de 120 niveaux 10 bits (≈ 30 en 8 bits) sur toute la largeur.
NIVEAUX_DEGRADE_MUR = 120


def niveaux_ligne(chemin: str, ligne: int, instant: float = 0.2) -> int:
    """Niveaux de luminance distincts (lus en 10 bits) sur une ligne, entre 10 % et 90 % de la largeur."""
    r = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-ss", f"{instant:.2f}", "-i", chemin, "-frames:v", "1", "-vf", f"crop=iw:1:0:{ligne},format=gray10le", "-f", "rawvideo", "-"], capture_output=True)
    if r.returncode != 0 or not r.stdout:
        raise RuntimeError(f"lecture de {os.path.basename(chemin)} impossible")
    n = len(r.stdout) // 2
    return len({int.from_bytes(r.stdout[2 * x: 2 * x + 2], "little") for x in range(n // 10, n * 9 // 10)})


def verifier_degrade_mur(dossier: str, lut: str | None = None) -> tuple[int, int]:
    """Un mur en dégradé 10 bits traverse l'encodeur de la passe image (LUT comprise) : ≥ 85 % de ses niveaux gardés."""
    from . import image, media

    source = os.path.join(dossier, "mur-10bits.mp4")
    ffmpeg("-f", "lavfi", "-i", f"nullsrc=s=640x360:r=25:d=0.6,format=yuv420p10le,geq=lum='420+{NIVEAUX_DEGRADE_MUR}*X/W':cb=512:cr=512",
           "-c:v", "libx264", "-preset", "ultrafast", "-qp", "0", "-pix_fmt", "yuv420p10le", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv", source)
    sortie = os.path.join(dossier, "mur-passe.mp4")
    enc = image.encodeur(sortie, 640, 360, image.filtre_lut(lut, 0.7))
    assert enc.stdin is not None
    for bloc in media.lire_images(source, media.filtre_preparation(media.sonder(source)), 640, 360, duree=0.5, profondeur16=True):
        enc.stdin.write(bloc)
    enc.stdin.close()
    assert enc.wait() == 0
    avant, apres = niveaux_ligne(source, 180), niveaux_ligne(sortie, 180)
    assert apres >= 0.85 * avant, f"bandes : {apres} niveaux gardés sur {avant} dans le dégradé du mur"
    return avant, apres


# Mire 10 bits « face caméra » (10/10, constat « zoom demandé = image cassée ») : mur clair, grand aplat de peau,
# sweat bleu-gris ; la zone mesurée (peau, au centre) reste dans l'image d'un plan large ET d'un plan serré à 130 %.
MIRE_FACECAM = ("color=c=0x7F7F7F:s=608x1080:r=25:d=2.2,format=rgb24,drawbox=x=0:y=0:w=608:h=170:color=0xB9B5AE:t=fill,"
                "drawbox=x=120:y=216:w=368:h=486:color=0xE0AC8F:t=fill,drawbox=x=0:y=815:w=608:h=265:color=0x4A5568:t=fill")


def chroma_moyenne(chemin: str, instant: float, zone: str) -> tuple[float, float]:
    """U et V moyens (8 bits) d'une zone (`crop` FFmpeg) d'une image, décodée en BT.709 plage tv EXPLICITES."""
    r = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-ss", f"{instant:.3f}", "-i", chemin, "-frames:v", "1", "-vf",
                        f"{zone},scale=1:1:flags=area:in_color_matrix=bt709:in_range=tv:out_color_matrix=bt709:out_range=tv,format=yuv444p",
                        "-f", "rawvideo", "-"], capture_output=True)
    assert r.returncode == 0 and len(r.stdout) >= 3, r.stderr.decode("utf-8", "replace")[-300:]
    return float(r.stdout[1]), float(r.stdout[2])


def controles(dossier: str) -> list[tuple[str, Callable[[], object]]]:
    from . import decor, image, media, son

    p = lambda nom: os.path.join(dossier, nom)  # noqa: E731
    # Aucun dépôt R2 pendant le contrôle : le fichier « déposé » est gardé à côté pour lire ses étiquettes.
    decor.deposer_fichier = lambda adresse, chemin, *a, **k: shutil.copy(chemin, p(f"depot-{os.path.basename(chemin)}"))
    sous = lambda nom: os.makedirs(p(nom), exist_ok=True) or p(nom)  # noqa: E731 — nettoyer_dossier vide son dossier
    t = f"{DUREE + 0.2:.2f}"

    def sources():
        ffmpeg("-f", "lavfi", "-i", f"testsrc2=s={LARGEUR}x{HAUTEUR}:r=30", "-f", "lavfi", "-i", "sine=f=220:r=48000,volume=0.3", "-t", t,
               "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", p("prise.mp4"))
        # Prise HDR façon iPhone : HLG BT.2020 10 bits (déclenche la table 3D de `filtre_preparation`).
        ffmpeg("-f", "lavfi", "-i", f"testsrc2=s={LARGEUR}x{HAUTEUR}:r=30", "-t", t,
               "-vf", "format=yuv420p10le,setparams=color_primaries=bt2020:color_trc=arib-std-b67:colorspace=bt2020nc:range=tv",
               "-c:v", "libx264", "-preset", "ultrafast", "-profile:v", "high10", p("prise-hlg.mp4"))
        ffmpeg("-f", "lavfi", "-i", "testsrc=s=704x1248:r=24", "-t", t, "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", p("higgsfield.mp4"))
        cube_identite(p("look.cube"))

    def sonder():
        s = media.sonder(p("prise.mp4"))
        h = media.sonder(p("prise-hlg.mp4"))
        assert s["largeur"] == LARGEUR and s["son"] and not s["hdr"], s
        assert h["hdr"], h

    def lire(hdr: bool):
        def f():
            source = p("prise-hlg.mp4" if hdr else "prise.mp4")
            filtre = media.filtre_preparation(media.sonder(source), 640)
            images = list(media.lire_images(source, filtre, 640, 360, duree=0.4, profondeur16=hdr))
            assert len(images) >= 5, f"{len(images)} image(s) lue(s) avec « {filtre} »"
        return f

    def conversion_hdr():
        from array import array

        mire_hlg(p("mire-hlg.mp4"))
        sonde = media.sonder(p("mire-hlg.mp4"))
        assert sonde["conversion"] == "hlg" and sonde["hdr"], sonde
        largeur = COTE_MIRE * len(MIRE_HDR)
        brut = next(media.lire_images(p("mire-hlg.mp4"), media.filtre_preparation(sonde), largeur, COTE_MIRE, profondeur16=True))
        px = array("H", brut)
        for i, (nom, attendu) in enumerate(MIRE_HDR):
            j = ((COTE_MIRE // 2) * largeur + i * COTE_MIRE + COTE_MIRE // 2) * 3
            lu = [px[j + k] / 65535 * 255 for k in range(3)]
            ecart = max(abs(lu[k] - attendu[k] * 255) for k in range(3))
            assert ecart <= 3.0, f"{nom} : lu {[round(v, 1) for v in lu]} au lieu de {[round(v * 255, 1) for v in attendu]} (écart {ecart:.1f} sur 255)"

    def sdr_inchangee():
        # Une prise SDR BT.709 n'a AUCUNE étape de conversion de couleurs : seulement la cadence 25 i/s, calée sur
        # l'origine du conteneur (start_time=0, correctif de synchro #18).
        assert media.filtre_preparation(media.sonder(p("prise.mp4"))) == f"fps={media.IMAGES_PAR_SEC}:start_time=0"

    def extraire():
        d = sous("extraire")
        r = decor.executer_extraire({"source": p("prise.mp4"), "parametres": {"debutSec": 0.2, "finSec": 1.4}, "depots": {"passage": "x"}}, d, lambda _: None)
        assert r["dureeSec"] > 1, r

    def reposer(effet: bool):
        def f():
            d = sous("reposer-effet" if effet else "reposer")
            parametres = {"conversion": {"filtreVideo": "fps=25", "dureeSec": 1.5}, "taille": {"largeur": 608, "hauteur": 1080}}
            if effet:
                parametres.update({"original": p("prise.mp4"), "fonduSec": 0.2, "accorderCouleurs": True})
                assert decor.stats_rgb(p("higgsfield.mp4"), d, "s") is not None, "stats_rgb : aucune image lue"
            r = decor.executer_reposer({"source": p("higgsfield.mp4"), "parametres": parametres, "depots": {"decor": "x"}}, d, lambda _: None)
            assert abs(r["dureeSec"] - 1.5) < 0.1, r
            verifier_bt709(p("depot-decor.mp4"))
        return f

    def energie():
        assert len(decor._energie_voix(p("prise.mp4"), 0.0, 1.0, 1)) >= 20

    def chaine_son():
        brut = media.extraire_son(p("prise.mp4"), p("brut.wav"), frequence=48000)
        propre = son.debruiter_afftdn(brut, p("afftdn.wav"))
        signal = son.lire_son(propre)
        son.ecrire_wav(p("relu.wav"), signal)
        mesure = son.chaine_pro(p("relu.wav"), p("voix.flac"))
        assert mesure["lufs"] is not None and abs(mesure["lufs"] - son.CIBLE_LUFS) < 1.5, mesure

    def passe_image():
        chemin = p("passe.mp4")
        enc = image.encodeur(chemin, 640, 360, image.filtre_lut(p("look.cube"), 0.7))
        assert enc.stdin is not None
        for bloc in media.lire_images(p("prise.mp4"), media.filtre_preparation(media.sonder(p("prise.mp4")), 640), 640, 360, duree=1.0, profondeur16=True):
            enc.stdin.write(bloc)
        enc.stdin.close()
        erreurs = enc.stderr.read().decode("utf-8", "replace") if enc.stderr else ""
        assert enc.wait() == 0, erreurs.strip()[-300:]
        assert media.sonder(chemin)["duree"] > 0.8
        verifier_bt709(chemin)

    def couleurs_passe():
        # Rouge pur BT.709 → RVB 16 bits (lecture) → encodeur de la passe → Y relu : ≈ 250 sur 1023 en BT.709 (324 en BT.601).
        ffmpeg("-f", "lavfi", "-i", "color=c=red:s=64x64:r=25", "-t", "0.2", "-vf", f"scale=out_color_matrix=bt709:out_range=tv,format=yuv420p10le,{media.ETIQUETTES_BT709}",
               "-c:v", "libx264", "-preset", "ultrafast", "-crf", "1", "-profile:v", "high10", p("rouge.mp4"))
        enc = image.encodeur(p("rouge-passe.mp4"), 64, 64, image.filtre_lut(None, 0))
        assert enc.stdin is not None
        for bloc in media.lire_images(p("rouge.mp4"), "null", 64, 64, profondeur16=True):
            enc.stdin.write(bloc)
        enc.stdin.close()
        assert enc.wait() == 0
        r = subprocess.run(["ffmpeg", "-v", "error", "-i", p("rouge-passe.mp4"), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "yuv420p10le", "-"], capture_output=True)
        y = int.from_bytes(r.stdout[2 * 64 * 32 : 2 * 64 * 32 + 2], "little")
        assert 240 <= y <= 260, f"Y du rouge = {y} sur 1023 (BT.709 ≈ 250 ; BT.601 ≈ 324) : matrice de couleurs fausse"
        verifier_bt709(p("rouge-passe.mp4"))

    def controles_machine():
        ffmpeg("-i", p("passe.mp4"), "-i", p("voix.flac"), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "pcm_s24le", "-shortest", p("montage.mov"))
        r = image.controles_machine(p("montage.mov"), [{"debutSec": 0, "finSec": 1}], None, dossier, True)
        assert r.get("niveauLufs") is not None, r

    def cadrage_zoom():
        # Piste étalonnée 10 bits (comme la passe), puis l'étape « cadrage » réelle : plan large, plan serré 130 %
        # (zoom demandé au monteur), plan large. La peau garde sa chrominance dans les trois plans (± 3 sur 255).
        ffmpeg("-f", "lavfi", "-i", MIRE_FACECAM, "-vf", f"scale=out_color_matrix=bt709:out_range=tv,format=yuv420p10le,{media.ETIQUETTES_BT709}",
               "-c:v", "libx264", "-preset", "ultrafast", "-crf", "8", "-profile:v", "high10", p("mire-facecam.mp4"))
        image.deposer_fichier = lambda adresse, chemin, *a, **k: shutil.copy(chemin, adresse)
        large = {"x": 0, "y": 0, "largeur": 608, "hauteur": 1080}
        serre = {"x": 70, "y": 120, "largeur": 468, "hauteur": 832}
        plans = [{"debutSec": 0.0, "finSec": 0.6, "priseDebutSec": 0.0, "priseFinSec": 0.6, "cadre": large},
                 {"debutSec": 0.6, "finSec": 1.4, "priseDebutSec": 0.6, "priseFinSec": 1.4, "cadre": serre},
                 {"debutSec": 1.4, "finSec": 2.0, "priseDebutSec": 1.4, "priseFinSec": 2.0, "cadre": large}]
        image.executer_cadrage({"source": p("mire-facecam.mp4"), "depots": {"montage": p("montage-zoom.mov")},
                                "parametres": {"etape": "cadrage", "bande": {"x": 0}, "plans": plans, "sortie": {"largeur": 608, "hauteur": 1080}}}, sous("cadrage-zoom"), lambda _: None)
        verifier_bt709(p("montage-zoom.mov"))
        reference = chroma_moyenne(p("mire-facecam.mp4"), 0.3, "crop=iw*0.16:ih*0.08:iw*0.42:ih*0.36")
        for t in (0.3, 1.0, 1.7):
            lu = chroma_moyenne(p("montage-zoom.mov"), t, "crop=iw*0.16:ih*0.08:iw*0.42:ih*0.36")
            ecart = max(abs(lu[0] - reference[0]), abs(lu[1] - reference[1]))
            assert ecart <= 3.0, f"peau à {t:.1f} s : U, V = {lu} au lieu de {reference} (écart {ecart:.1f} sur 255)"

    def calage():
        from .calage import lire_son

        assert len(lire_son(p("brut.wav"))) > 16000

    return [
        ("version", lambda: ffmpeg("-version")),
        ("sources lavfi (8 bits, HLG 10 bits, décor)", sources),
        ("ffprobe : sonder (8 bits, HLG)", sonder),
        ("préparation SDR (filtre_preparation + lire_images)", lire(False)),
        ("préparation HDR → SDR (table 3D BT.2100 → BT.709, rgb48le)", lire(True)),
        ("conversion HDR → SDR juste (mire HLG BT.2100 : gris et peau à 3 sur 255 près)", conversion_hdr),
        ("prise SDR inchangée (aucune conversion)", sdr_inchangee),
        ("décor : extraire (crop, lanczos, libx264)", extraire),
        ("décor : reposer (fps=25, high10, étiquettes BT.709)", reposer(False)),
        ("décor : reposer avec effet (lutrgb 16 bits, blend de raccord, étiquettes BT.709)", reposer(True)),
        ("décor : énergie de la voix", energie),
        ("son : afftdn, loudnorm 2 passes, ebur128, FLAC 32 bits", chaine_son),
        ("image : encodeur 10 bits + LUT (lut3d, blend, high10, étiquettes BT.709)", passe_image),
        ("image : couleurs de la passe (RVB → YUV en BT.709)", couleurs_passe),
        ("image : dégradé de mur 10 bits, aucune bande (encodeur de la passe + LUT)", lambda: verifier_degrade_mur(dossier, p("look.cube"))),
        ("image : contrôles machine (blackdetect, freezedetect, ebur128)", controles_machine),
        ("image : cadrage avec zoom demandé (plan serré 130 %), couleurs de la peau gardées", cadrage_zoom),
        ("calage : lecture du son 16 kHz", calage),
    ]


def main() -> int:
    version = subprocess.run(["ffmpeg", "-hide_banner", "-version"], capture_output=True, text=True).stdout.split("\n")[0]
    print(f"studio-aligneur — {version or 'FFmpeg introuvable'}", flush=True)
    dossier = tempfile.mkdtemp(prefix="controle-ffmpeg-")
    echecs = 0
    liste: list[tuple[str, Callable[[], object]]] = []
    try:
        liste = controles(dossier)
        for nom, f in liste:
            debut = time.monotonic()
            try:
                f()
                print(f"OK    {nom} ({int((time.monotonic() - debut) * 1000)} ms)", flush=True)
            except Exception as e:  # noqa: BLE001 — chaque contrôle est rapporté, les suivants continuent
                echecs += 1
                print(f"ÉCHEC {nom} ({int((time.monotonic() - debut) * 1000)} ms)\n      {type(e).__name__} : {e}", flush=True)
    finally:
        shutil.rmtree(dossier, ignore_errors=True)
    print(f"{echecs} contrôle(s) FFmpeg en échec sur {len(liste)}." if echecs else f"{len(liste)} contrôles FFmpeg réussis.", flush=True)
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())
