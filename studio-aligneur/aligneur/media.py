"""
Outils communs des travaux face caméra (plan facecam v4, lot B) : lecture de la prise, préparation de l'image,
dépôts sur R2 par adresse signée, tranches de 30 s. Aucun modèle ici : importable sans numpy ni torch.

Préparation de la prise (v4 n° 9) : rotation (FFmpeg applique la matrice d'affichage de l'iPhone), HDR → SDR BT.709,
25 i/s. HDR (09/10, `docs/JOURNAL-FFMPEG8-QUALITE.md`) : HLG (dont Dolby Vision 8.4 de l'iPhone), PQ, ou BT.2020 SDR,
converti par une TABLE 3D calculée ici selon BT.2100 / BT.2408 (OOTF sur la LUMINANCE, blanc SDR = 203 cd/m², reflets
comprimés sur le maximum de R, G, B (teinte gardée), primaires BT.2020 → BT.709). L'ancienne chaîne `zscale` + tonemap
`hable` assombrissait tout (blanc SDR à 95 % rendu à 73 %) et `zscale` applique l'OOTF composante par composante (peau
trop orangée). Une prise SDR BT.709 passe inchangée.
La prise d'origine n'est JAMAIS modifiée : elle est lue par son adresse signée, en lecture seule.
"""
from __future__ import annotations

import gzip
import json
import math
import os
import shutil
import subprocess
import tempfile
import urllib.error
import urllib.request
from typing import Any, Callable, Iterator

IMAGES_PAR_SEC = 25
# Étiquettes BT.709 (plage tv) posées SUR LES IMAGES, à la fin du graphe : depuis FFmpeg 7.1, les options de sortie
# `-color_primaries` / `-color_trc` ne passent plus à libx264 quand un filtre est présent (primaires et transfert
# « unknown » mesurés en 7.1, 8.1.1 et 9.0.2) ; `setparams` les impose dans toutes les versions (5.1 comprise).
ETIQUETTES_BT709 = "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"
TRANCHE_SEC = 30.0
# Son et image sur la MÊME origine (10/10, `docs/facecam/JOURNAL-CONTROLES-QUALITE.md`) : le temps du conteneur, celui
# de `-ss` (0 = début du fichier). FFmpeg rend les échantillons du son à partir du PREMIER échantillon du flux, sans
# tenir compte de son horodatage : un MOV dont le son démarre après l'image (edit list, `start_time` du son > 0) faisait
# arriver toute la voix trop tôt (0,178 s = 4,5 images sur une source synthétique). `first_pts=0` comble ce retard par
# du silence ; `async=1` comble aussi les trous du flux (paquets perdus) au lieu de recoller la suite trop tôt.
FILTRE_SON_ALIGNE = "aresample=async=1:first_pts=0"
DELAI_DEPOT_SEC = 1800


class ErreurTravail(Exception):
    """Panne typée d'un travail (le serveur la rend telle quelle : code, réessayable, message lisible)."""

    def __init__(self, code: str, message: str, reessayable: bool = True):
        super().__init__(message)
        self.code = code
        self.message = message
        self.reessayable = reessayable


def executer(cmd: list[str], entree: bytes | None = None) -> subprocess.CompletedProcess:
    r = subprocess.run(cmd, input=entree, capture_output=True)
    if r.returncode != 0:
        fin = r.stderr.decode("utf-8", "replace")[-600:]
        raise ErreurTravail("inconnu", f"FFmpeg a échoué ({os.path.basename(cmd[0])}) : {fin.strip().splitlines()[-1] if fin.strip() else 'sans message'}")
    return r


# --------------------------------------------------------------------------------------------------------------------
# Lecture de la prise
# --------------------------------------------------------------------------------------------------------------------

ENTREE_RESEAU = ["-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "10"]


def entree(source: str) -> list[str]:
    """Options d'entrée FFmpeg : une adresse signée est relue avec reprise ; un fichier local tel quel."""
    return (ENTREE_RESEAU if source.startswith(("http://", "https://")) else []) + ["-i", source]


def sonder(source: str, exiger_image: bool = True) -> dict:
    """ffprobe : définition, durée, rotation, transfert (HDR), cadence, présence du son.

    `exiger_image=False` : une piste SONORE seule est acceptée (la voix seule d'Image → vidéo, transcrite pour l'écoute) ;
    la sonde rend alors une définition nulle et aucune particularité d'image. Sans image ni son, la prise reste refusée.
    """
    r = executer(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", source])
    info = json.loads(r.stdout or b"{}")
    video = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), None)
    son_present = any(s.get("codec_type") == "audio" for s in info.get("streams", []))
    if not video and not exiger_image and son_present:
        audio = next(s for s in info["streams"] if s.get("codec_type") == "audio")
        duree = float(info.get("format", {}).get("duration") or audio.get("duration") or 0)
        return {"largeur": 0, "hauteur": 0, "duree": duree, "rotation": 0, "transfert": "", "primaires": "", "matrice": "", "plage": "", "hdr": False, "dolbyVision": 0, "maxCll": 0, "codec": "", "son": True, "conversion": ""}
    if not video:
        raise ErreurTravail("refuse", "La prise ne contient pas d'image.", False)
    rotation = 0
    for d in video.get("side_data_list", []) or []:
        if "rotation" in d:
            rotation = int(round(float(d["rotation"])))
    if video.get("tags", {}).get("rotate"):
        rotation = int(video["tags"]["rotate"])
    rotation %= 360
    largeur, hauteur = int(video.get("width", 0)), int(video.get("height", 0))
    if rotation in (90, 270, -90, -270):
        largeur, hauteur = hauteur, largeur
    transfert = video.get("color_transfer") or ""
    primaires = video.get("color_primaries") or ""
    duree = float(info.get("format", {}).get("duration") or video.get("duration") or 0)
    sonde = {
        "largeur": largeur,
        "hauteur": hauteur,
        "duree": duree,
        "rotation": rotation,
        "transfert": transfert,
        "primaires": primaires,
        "matrice": video.get("color_space") or "",
        "plage": video.get("color_range") or "",
        "hdr": transfert in TRANSFERTS_HDR,
        # Dolby Vision (iPhone : profil 8.4, couche de base HLG compatible) : le profil, 0 sinon.
        "dolbyVision": profil_dolby_vision(video),
        # Pic de luminance déclaré (MaxCLL, cd/m²) : sert au PQ ; 0 si absent.
        "maxCll": max_cll(video),
        "codec": video.get("codec_name", ""),
        "son": any(s.get("codec_type") == "audio" for s in info.get("streams", [])),
    }
    sonde["conversion"] = nature_couleurs(sonde)
    return sonde


# --------------------------------------------------------------------------------------------------------------------
# HDR (et BT.2020) → SDR BT.709 par table 3D
# --------------------------------------------------------------------------------------------------------------------

TRANSFERTS_HDR = ("arib-std-b67", "smpte2084")
BLANC_SDR_NITS = 203.0  # BT.2408 : blanc de référence (HLG 75 %, PQ 58 %) = 100 % du SDR
PIC_HLG_NITS = 1000.0  # écran de référence HLG (BT.2100) : OOTF de gamma 1,2
PIC_PQ_DEFAUT_NITS = 1000.0  # PQ sans MaxCLL : pic des iPhone
# Niveau LINÉAIRE SDR (maximum de R, G, B) au-delà duquel les reflets sont comprimés (≈ 91 % du signal) : la peau et les gris restent
# exacts, seuls les reflets (fenêtre, front brillant) entrent en douceur dans les 9 % du haut.
GENOU = 0.8
TAILLE_LUT = 65
VERSION_LUT = 1
DOSSIER_LUTS = os.environ.get("ALIGNEUR_LUTS") or os.path.join(tempfile.gettempdir(), "aligneur-luts")
_HLG_A, _HLG_B, _HLG_C = 0.17883277, 0.28466892, 0.55991073
_2020_VERS_709 = ((1.660491, -0.587641, -0.072850), (-0.124550, 1.132900, -0.008349), (-0.018151, -0.100579, 1.118730))


def profil_dolby_vision(video: dict) -> int:
    for d in video.get("side_data_list", []) or []:
        if "dv_profile" in d:
            return int(d.get("dv_profile") or 0)
    return 0


def max_cll(video: dict) -> float:
    for d in video.get("side_data_list", []) or []:
        if "max_content" in d:
            try:
                return float(d["max_content"])
            except (TypeError, ValueError):
                return 0.0
    return 0.0


def nature_couleurs(sonde: dict) -> str:
    """« hlg », « pq », « bt2020 » (gamme large, transfert SDR) ou « » (SDR BT.709 : la prise passe inchangée)."""
    transfert = sonde.get("transfert") or ""
    if transfert == "arib-std-b67":
        return "hlg"
    if transfert == "smpte2084":
        return "pq"
    if sonde.get("hdr"):  # sonde d'avant le 09/10 (sans transfert lisible) : HLG, le cas de l'iPhone
        return "hlg"
    if (sonde.get("primaires") or "") == "bt2020":
        return "bt2020"
    return ""


def pic_relatif(sonde: dict, nature: str) -> float:
    """Pic du signal en multiples du blanc SDR (203 cd/m²) : HLG 4,93 ; PQ selon MaxCLL ; SDR 1."""
    if nature == "hlg":
        return PIC_HLG_NITS / BLANC_SDR_NITS
    if nature == "pq":
        nits = float(sonde.get("maxCll") or 0) or PIC_PQ_DEFAUT_NITS
        return max(1.0, min(nits, 10000.0) / BLANC_SDR_NITS)
    return 1.0


def _pq_nits(v: float) -> float:
    m1, m2, c1, c2, c3 = 0.1593017578125, 78.84375, 0.8359375, 18.8515625, 18.6875
    p = v ** (1 / m2)
    return 10000.0 * (max(p - c1, 0.0) / (c2 - c3 * p)) ** (1 / m1)


def _hlg_scene(v: float) -> float:
    return v * v / 3 if v <= 0.5 else (math.exp((v - _HLG_C) / _HLG_A) + _HLG_B) / 12


def point_sdr(r: float, g: float, b: float, nature: str, pic: float) -> tuple[float, float, float]:
    """Un point de la table : R'G'B' BT.2020 (HLG, PQ ou SDR) → R'G'B' BT.709 SDR (BT.1886, gamma 2,4)."""
    if nature == "hlg":
        e = (_hlg_scene(r), _hlg_scene(g), _hlg_scene(b))
        ys = 0.2627 * e[0] + 0.6780 * e[1] + 0.0593 * e[2]
        # OOTF de BT.2100 sur la LUMINANCE de la scène (et non composante par composante) : teintes gardées.
        k = PIC_HLG_NITS / BLANC_SDR_NITS * ys ** 0.2 if ys > 0 else 0.0
        lin = (k * e[0], k * e[1], k * e[2])
    elif nature == "pq":
        lin = (_pq_nits(r) / BLANC_SDR_NITS, _pq_nits(g) / BLANC_SDR_NITS, _pq_nits(b) / BLANC_SDR_NITS)
    else:
        lin = (r ** 2.4, g ** 2.4, b ** 2.4)
    m = _2020_VERS_709
    c = [max(0.0, m[i][0] * lin[0] + m[i][1] * lin[1] + m[i][2] * lin[2]) for i in range(3)]
    haut = max(c)
    if haut > GENOU and (pic > 1 or haut > 1):
        # Épaule sur le MAXIMUM de R, G, B (pente 1 au genou, pic → 100 %) : rapports R:G:B gardés, donc teinte et
        # saturation gardées, et jamais d'écrêtage (une épaule sur la luminance blanchissait les rouges vifs).
        s, p = (haut - GENOU) / (1 - GENOU), (max(pic, haut) - GENOU) / (1 - GENOU)
        h2 = GENOU + (1 - GENOU) * min(1.0, s * (1 + s / (p * p)) / (1 + s))
        c = [v * h2 / haut for v in c]
    return tuple(min(1.0, max(0.0, v)) ** (1 / 2.4) for v in c)  # type: ignore[return-value]


def table_conversion(nature: str, pic: float, taille: int = TAILLE_LUT, dossier: str | None = None) -> str:
    """Fichier .cube de la conversion (calculé une fois, gardé sur disque ; écrit puis renommé : jamais à moitié lu)."""
    dossier = dossier or DOSSIER_LUTS
    chemin = os.path.join(dossier, f"{nature}-pic{pic:.3f}-t{taille}-v{VERSION_LUT}.cube")
    if os.path.exists(chemin):
        return chemin
    os.makedirs(dossier, exist_ok=True)
    pas = [i / (taille - 1) for i in range(taille)]
    lignes = [f"TITLE \"studio-aligneur {nature} vers SDR BT.709\"", f"LUT_3D_SIZE {taille}"]
    for b in pas:
        for g in pas:
            for r in pas:
                lignes.append("%.6f %.6f %.6f" % point_sdr(r, g, b, nature, pic))
    provisoire = f"{chemin}.{os.getpid()}.tmp"
    with open(provisoire, "w", encoding="ascii") as f:
        f.write("\n".join(lignes) + "\n")
    os.replace(provisoire, chemin)
    return chemin


def filtre_conversion_sdr(sonde: dict) -> list[str]:
    """Étapes FFmpeg HDR / BT.2020 → YUV BT.709 tv 16 bits étiqueté ; [] pour une prise déjà SDR BT.709."""
    nature = sonde.get("conversion", None)
    if nature is None:
        nature = nature_couleurs(sonde)
    if not nature:
        return []
    plage = "pc" if sonde.get("plage") == "pc" else "tv"
    return [
        # YUV BT.2020 → R'G'B' 16 bits SANS toucher au transfert (la table attend le signal HLG / PQ tel quel).
        f"scale=in_color_matrix=bt2020:in_range={plage}:flags=bicubic+accurate_rnd+full_chroma_int",
        "format=gbrp16le",
        f"lut3d=file={table_conversion(nature, pic_relatif(sonde, nature))}:interp=tetrahedral",
        "scale=out_color_matrix=bt709:out_range=tv:flags=bicubic+accurate_rnd+full_chroma_int",
        "format=yuv444p16le",
        ETIQUETTES_BT709,
    ]


def filtre_preparation(sonde: dict, largeur_sortie: int | None = None) -> str:
    """Chaîne FFmpeg de préparation : HDR → SDR BT.709 si besoin, 25 i/s, mise à l'échelle facultative."""
    f: list[str] = filtre_conversion_sdr(sonde)
    # `start_time=0` : la première image rendue est celle de l'instant 0 du conteneur (ou de `-ss`), même si le flux
    # d'image démarre plus tard (complétée par la première image) — même origine que le son (`FILTRE_SON_ALIGNE`).
    f.append(f"fps={IMAGES_PAR_SEC}:start_time=0")
    if largeur_sortie:
        f.append(f"scale={largeur_sortie}:-2:flags=area")
    return ",".join(f)


def tranches(duree: float, taille: float = TRANCHE_SEC) -> list[tuple[float, float]]:
    """Tranches de 30 s : [(début, durée)…] couvrant toute la durée."""
    t, sortie = 0.0, []
    while t < duree - 1e-3:
        sortie.append((t, min(taille, duree - t)))
        t += taille
    return sortie or [(0.0, max(duree, 0.04))]


def fils_ffmpeg() -> int:
    """Fils de calcul d'un FFmpeg (décodage, filtres, x264) : ceux du conteneur (`STUDIO_ALIGNEUR_FILS`, 2 par défaut).
    10/10 : sans cette borne, FFmpeg et x264 prenaient un fil par cœur DE L'HÔTE, chacun avec ses images 4K en vol
    (décodage HEVC, file d'attente des filtres, prévision de x264) : 5,1 Go au total sur la passe « formats » mesurée,
    dont 4,3 Go pour les deux FFmpeg, au-delà de la limite du conteneur."""
    try:
        return max(1, int(os.environ.get("STUDIO_ALIGNEUR_FILS", "2")))
    except ValueError:
        return 2


def options_fils() -> list[str]:
    """Options globales FFmpeg bornant les fils des filtres (avant les entrées)."""
    return ["-filter_threads", str(fils_ffmpeg())]


def lire_images(source: str, filtre: str, largeur: int, hauteur: int, debut: float = 0.0, duree: float | None = None, profondeur16: bool = False) -> Iterator[bytes]:
    """Images brutes RGB (8 ou 16 bits par composante) décodées par FFmpeg, une à la fois (jamais toute la vidéo en mémoire).
    Décodeur et filtres bornés aux fils du conteneur (`fils_ffmpeg`) : autant d'images 4K en vol, pas une par cœur."""
    cmd = ["ffmpeg", "-v", "error", "-nostdin", *options_fils()]
    if debut > 0:
        cmd += ["-ss", f"{debut:.3f}"]
    cmd += ["-threads", str(fils_ffmpeg())]
    cmd += entree(source)
    if duree is not None:
        cmd += ["-t", f"{duree:.3f}"]
    fmt = "rgb48le" if profondeur16 else "rgb24"
    cmd += ["-an", "-vf", filtre, "-f", "rawvideo", "-pix_fmt", fmt, "pipe:1"]
    taille = largeur * hauteur * 3 * (2 if profondeur16 else 1)
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=taille)
    try:
        assert proc.stdout is not None
        while True:
            bloc = proc.stdout.read(taille)
            if len(bloc) < taille:
                break
            yield bloc
    finally:
        if proc.stdout:
            proc.stdout.close()
        proc.wait()


def extraire_son(source: str, chemin: str, frequence: int = 16000, canaux: int = 1) -> str:
    executer(["ffmpeg", "-v", "error", "-nostdin", "-y", *entree(source), "-vn", "-af", FILTRE_SON_ALIGNE, "-ac", str(canaux), "-ar", str(frequence), "-c:a", "pcm_f32le", chemin])
    return chemin


# --------------------------------------------------------------------------------------------------------------------
# Dépôts sur R2 (adresses signées reçues dans la demande) — jamais de données lourdes dans l'état du travail
# --------------------------------------------------------------------------------------------------------------------

def deposer_fichier(adresse: str, chemin: str, type_contenu: str = "application/octet-stream") -> None:
    """PUT de l'adresse signée, en flux (le fichier n'est jamais chargé en mémoire)."""
    if not adresse.startswith(("http://", "https://")):
        # Essais locaux : « adresse » = chemin de destination.
        os.makedirs(os.path.dirname(os.path.abspath(adresse)), exist_ok=True)
        shutil.copyfile(chemin, adresse)
        return
    taille = os.path.getsize(chemin)
    with open(chemin, "rb") as f:
        req = urllib.request.Request(adresse, data=f, method="PUT", headers={"content-type": type_contenu, "content-length": str(taille)})
        try:
            with urllib.request.urlopen(req, timeout=DELAI_DEPOT_SEC) as r:
                if r.status >= 300:
                    raise ErreurTravail("indisponible", f"Dépôt refusé ({r.status}).")
        except urllib.error.HTTPError as e:
            raise ErreurTravail("indisponible", f"Dépôt refusé ({e.code}).") from e
        except OSError as e:
            raise ErreurTravail("indisponible", "Dépôt impossible (réseau).") from e


def deposer_json_gz(adresse: str, donnees: Any, dossier: str, nom: str) -> None:
    chemin = os.path.join(dossier, f"{nom}.json.gz")
    with gzip.open(chemin, "wt", encoding="utf-8", compresslevel=6) as f:
        json.dump(donnees, f, ensure_ascii=False, separators=(",", ":"))
    deposer_fichier(adresse, chemin, "application/gzip")


def lire_json_gz(adresse: str, dossier: str, nom: str) -> Any:
    """Lit un json.gz par son adresse signée (piste du visage, points…) ou un chemin local."""
    chemin = adresse
    if adresse.startswith(("http://", "https://")):
        chemin = os.path.join(dossier, f"{nom}.json.gz")
        try:
            with urllib.request.urlopen(adresse, timeout=120) as r, open(chemin, "wb") as f:
                shutil.copyfileobj(r, f)
        except OSError as e:
            raise ErreurTravail("fichier-inaccessible", f"Lecture impossible ({nom}).") from e
    with gzip.open(chemin, "rt", encoding="utf-8") as f:
        return json.load(f)


def depot(demande: dict, nom: str) -> str:
    """Adresse signée de dépôt d'un résultat (obligatoire)."""
    adresse = (demande.get("depots") or {}).get(nom)
    if not isinstance(adresse, str) or not adresse:
        raise ErreurTravail("refuse", f"Adresse de dépôt « {nom} » manquante.", False)
    return adresse


def cle(demande: dict, nom: str) -> str:
    """Clé R2 du résultat `nom`, telle que le studio l'a choisie (rendue dans le résultat, jamais l'adresse signée)."""
    cles = ((demande.get("parametres") or {}).get("cles") or {})
    return str(cles.get(nom) or nom)


def parametre(demande: dict, nom: str, defaut: Any = None) -> Any:
    return (demande.get("parametres") or {}).get(nom, defaut)


def nettoyer_dossier(dossier: str, garder: tuple[str, ...] = ("etat.json",)) -> None:
    """Efface les fichiers lourds d'un travail fini (journal du lot A : ne pas garder 24 h de vidéos sur disque)."""
    for nom in os.listdir(dossier):
        if nom in garder:
            continue
        chemin = os.path.join(dossier, nom)
        if os.path.isdir(chemin):
            shutil.rmtree(chemin, ignore_errors=True)
        else:
            try:
                os.remove(chemin)
            except OSError:
                pass


def progression_par_tranche(progression: Callable[[int], None], debut: int, fin: int) -> Callable[[int, int], None]:
    """Progression d'un travail découpé en tranches : la tranche i sur n occupe [debut, fin]."""
    def poser(i: int, n: int) -> None:
        progression(debut + int((fin - debut) * i / max(n, 1)))
    return poser
