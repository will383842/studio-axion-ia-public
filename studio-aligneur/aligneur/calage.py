"""
CALAGE DES MOTS (alignement forcé sur le TEXTE CONNU, processeur seul, aucune transcription).

Modèle : celui que WhisperX choisit pour le français, `VOXPOPULI_ASR_BASE_10K_FR` (wav2vec2 « base », torchaudio,
≈ 360 Mo), TÉLÉCHARGÉ À LA CONSTRUCTION DE L'IMAGE (`python -m aligneur --precharger`) : aucun téléchargement au
premier appel. Chargé une fois par processus.

Pourquoi pas `whisperx.align` tel quel : mesuré sur la fixture `voix-essai` (débuts exacts connus), il pose chaque mot
en moyenne 155 ms trop tard et colle le premier mot à 0 s (il avale le blanc de tête) — pas mieux que HeyGen. Même
modèle, même alignement CTC (`ctc.viterbi_ctc`), avec trois corrections :
  1. un séparateur de mot « | » lu avant, entre et après les mots (le modèle le lit à l'attaque du mot) ;
  2. la latence propre du modèle retirée (`LATENCE_MODELE_SEC`, mesurée UNE fois sur un étalon distinct :
     `outils/alignement/etalon/`, jamais sur les sons de contrôle) ;
  3. débuts posés sur la reprise réelle de la voix après un blanc, fins sur le début du blanc suivant.

Entrées : le son (tout format lu par FFmpeg) et le texte exact prononcé. Sortie (forme `ResultatAlignement` du studio) :
un mot par mot du texte (`texte.decouper`), dans l'ordre, horodaté ; un mot sans lettre lisible prend le temps entre
ses voisins et porte `aligne: false` (compté dans `motsNonAlignes`).

Son long (> 30 s) : découpé en morceaux de ≤ 25 s, coupés sur l'instant le plus calme près d'une fin de phrase, pour
borner le calcul et la mémoire.
"""
from __future__ import annotations

import contextlib
import os
import subprocess
import sys
import time
import unicodedata

import numpy as np

from .ctc import affiner, silences, spans, viterbi_ctc
from .texte import decouper, forme_dite, phrases

FREQ = 16000
MODELE = "VOXPOPULI_ASR_BASE_10K_FR"
MORCEAU_MAX_SEC = 25.0
SON_COURT_SEC = 30.0
SEPARATEUR = "|"
# Latence du modèle (s) : l'attaque d'un mot est lue en moyenne ce temps APRÈS le vrai début (séparateur « | »).
# Mesurée par `outils/alignement/mesurer_calage.py --etalon` (médiane sur l'étalon) ; voir docs/captures/d3-calage/.
LATENCE_MODELE_SEC = 0.05
# La fin d'un mot s'entend après sa dernière lettre lue (s) : mesurée sur l'étalon (fins avant un blanc).
FIN_SUPPLEMENT_SEC = 0.18

_modele = None


def charger_modele():
    """(modèle, étiquettes) — le modèle français de WhisperX, une fois par processus."""
    global _modele
    if _modele is None:
        import torch
        import torchaudio

        torch.set_num_threads(max(1, int(os.environ.get("STUDIO_ALIGNEUR_FILS", "2"))))
        bundle = getattr(torchaudio.pipelines, MODELE)
        # Le téléchargement éventuel écrit sur la sortie standard : renvoyé vers les erreurs (la sortie reste du JSON).
        with contextlib.redirect_stdout(sys.stderr):
            modele = bundle.get_model().eval()
        etiquettes = [c.lower() for c in bundle.get_labels()]
        _modele = (modele, {c: i for i, c in enumerate(etiquettes)})
    return _modele


def lire_son(chemin: str) -> np.ndarray:
    """Son en 16 kHz mono (FFmpeg), flottants dans [-1, 1]."""
    sortie = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", chemin, "-f", "s16le", "-ac", "1", "-ar", str(FREQ), "-"],
        capture_output=True, check=False, timeout=300,
    )
    if sortie.returncode != 0 or not sortie.stdout:
        raise ValueError("son illisible")
    return np.frombuffer(sortie.stdout, np.int16).astype(np.float32) / 32768.0


def emissions(audio: np.ndarray) -> tuple[np.ndarray, float]:
    """Log-probabilités du modèle (images × étiquettes) et durée d'une image (s)."""
    import torch

    modele, _ = charger_modele()
    x = torch.from_numpy(np.ascontiguousarray(audio))[None]
    if x.shape[1] < 400:
        x = torch.nn.functional.pad(x, (0, 400 - x.shape[1]))
    with torch.inference_mode():
        sortie, _ = modele(x)
        logp = torch.log_softmax(sortie, dim=-1)[0].numpy()
    return logp, (len(audio) / FREQ) / max(1, logp.shape[0])


def lettres(dit: str, dictionnaire: dict) -> list[int]:
    """Lettres connues du modèle seulement (aucun joker qui absorberait du son)."""
    sortie = []
    for c in dit.lower():
        if c == SEPARATEUR:
            continue
        if c in dictionnaire:
            sortie.append(dictionnaire[c])
            continue
        base = "".join(x for x in unicodedata.normalize("NFD", c) if unicodedata.category(x) != "Mn")
        if base and base in dictionnaire:
            sortie.append(dictionnaire[base])
    return sortie


def _coupe_calme(audio: np.ndarray, vers_sec: float, rayon_sec: float = 0.8) -> float:
    from .ctc import PAS_ENERGIE, energie

    e = energie(audio)
    i0 = max(0, int((vers_sec - rayon_sec) / PAS_ENERGIE))
    i1 = min(len(e), int((vers_sec + rayon_sec) / PAS_ENERGIE))
    if i1 - i0 < 10:
        return vers_sec
    lisse = np.convolve(e[i0:i1], np.ones(10) / 10, mode="same")
    return (i0 + int(np.argmin(lisse))) * PAS_ENERGIE


def morceaux(mots: list[str], audio: np.ndarray, reference: list[dict] | None) -> list[tuple[int, int, float, float]]:
    """[(premier mot, fin, début s, fin s)] ; un seul morceau pour un son court."""
    duree = len(audio) / FREQ
    if duree <= SON_COURT_SEC or len(mots) < 2:
        return [(0, len(mots), 0.0, duree)]
    groupes = phrases(mots)
    poids = np.cumsum([0] + [max(1, len(m)) for m in mots])
    ref_ok = reference is not None and len(reference) == len(mots)

    def frontiere(i: int) -> float:
        """Temps annoncé de la frontière avant le mot i : par la voix si elle découpe pareil, sinon au prorata du texte."""
        if i >= len(mots):
            return duree
        if ref_ok:
            return (float(reference[i - 1]["finSec"]) + float(reference[i]["debutSec"])) / 2
        return duree * poids[i] / poids[-1]

    sortie = []
    debut_mot, debut_sec = 0, 0.0
    for k, (_, g1) in enumerate(groupes):
        dernier = g1 == len(mots)
        suivant = groupes[k + 1][1] if k + 1 < len(groupes) else len(mots)
        if dernier or frontiere(suivant) - debut_sec > MORCEAU_MAX_SEC:
            fin_sec = duree if dernier else _coupe_calme(audio, frontiere(g1))
            sortie.append((debut_mot, g1, debut_sec, fin_sec))
            debut_mot, debut_sec = g1, fin_sec
    return sortie


def caler_morceau(audio: np.ndarray, decalage: float, jetons_mots: list[list[int]], dictionnaire: dict) -> list[tuple[float, float]]:
    """Débuts / fins BRUTS (avant affinage) des mots d'un morceau : séparateur avant le mot → début ; dernière lettre → fin."""
    logp, pas = emissions(audio)
    sep = dictionnaire[SEPARATEUR]
    suite: list[int] = [sep]
    role: list[tuple[int, str]] = [(0, "sep")]
    for k, j in enumerate(jetons_mots):
        for c in j:
            suite.append(c)
            role.append((k, "lettre"))
        suite.append(sep)
        role.append((k + 1, "sep"))
    chemin = viterbi_ctc(logp, suite, blanc=dictionnaire.get("-", 0))
    etendues = spans(chemin, len(suite))
    sortie = []
    for k in range(len(jetons_mots)):
        sep_avant = next(e for e, (m, r) in zip(etendues, role) if m == k and r == "sep")
        lettres_k = [e for e, (m, r) in zip(etendues, role) if m == k and r == "lettre" and e is not None]
        debut = sep_avant[0] if sep_avant else lettres_k[0][0]
        fin = lettres_k[-1][1] + 1 if lettres_k else debut + 1
        sortie.append((decalage + debut * pas, decalage + fin * pas))
    return sortie


def caler(chemin_son: str, texte: str, reference: list[dict] | None = None, latence: float | None = None, brut: bool = False,
          accrocher: bool = True) -> dict:
    """Horodatage de chaque mot du texte sur le son (secondes, 3 décimales). `brut` / `accrocher` : variantes de mesure."""
    t0 = time.perf_counter()
    _, dictionnaire = charger_modele()
    audio = lire_son(chemin_son)
    duree = len(audio) / FREQ
    mots = decouper(texte)
    if not mots:
        return {"mots": [], "motsNonAlignes": 0, "modele": f"wav2vec2:{MODELE}", "dureeCalculSec": 0}
    jetons = [lettres(forme_dite(m), dictionnaire) for m in mots]

    bruts: list[tuple[float, float] | None] = [None] * len(mots)
    for m0, m1, s0, s1 in morceaux(mots, audio, reference):
        # Les mots sans aucune lettre lisible ne sont pas lus : ils prendront le temps de leurs voisins.
        indices = [i for i in range(m0, m1) if jetons[i]]
        if not indices:
            continue
        a0, a1 = int(s0 * FREQ), int(s1 * FREQ)
        try:
            cales = caler_morceau(audio[a0:a1], s0, [jetons[i] for i in indices], dictionnaire)
        except ValueError:
            continue  # morceau impossible à lire : ses mots restent non alignés (voisins)
        for i, h in zip(indices, cales):
            bruts[i] = h

    alignes = [i for i, h in enumerate(bruts) if h is not None]
    horodates: list[dict | None] = [None] * len(mots)
    if alignes:
        if brut:
            fins = [(bruts[i][0], bruts[i][1]) for i in alignes]  # type: ignore[index]
        else:
            fins = affiner([bruts[i][0] for i in alignes], [bruts[i][1] for i in alignes], silences(audio), duree,  # type: ignore[index]
                           LATENCE_MODELE_SEC if latence is None else latence, FIN_SUPPLEMENT_SEC, accrocher=accrocher)
        for i, (d, f) in zip(alignes, fins):
            horodates[i] = {"debutSec": d, "finSec": f}

    sortie, non_alignes = completer(mots, horodates, duree)
    return {
        "mots": sortie,
        "motsNonAlignes": non_alignes,
        "modele": f"wav2vec2:{MODELE}",
        "dureeCalculSec": round(time.perf_counter() - t0, 3),
    }


def completer(mots: list[str], horodates: list[dict | None], duree: float) -> tuple[list[dict], int]:
    """Mots non alignés : entre la fin du voisin d'avant et le début du voisin d'après, au prorata des lettres."""
    sortie: list[dict] = []
    non_alignes = 0
    i = 0
    while i < len(mots):
        h = horodates[i]
        if h is not None:
            sortie.append({"mot": mots[i], "debutSec": round(h["debutSec"], 3), "finSec": round(max(h["debutSec"], h["finSec"]), 3)})
            i += 1
            continue
        j = i
        while j < len(mots) and horodates[j] is None:
            j += 1
        avant = sortie[-1]["finSec"] if sortie else 0.0
        apres = horodates[j]["debutSec"] if j < len(mots) else min(duree, avant + 0.3 * (j - i))  # type: ignore[index]
        apres = max(avant, apres)
        poids = [max(1, len(m)) for m in mots[i:j]]
        t = avant
        for k, p in zip(range(i, j), poids):
            part = (apres - avant) * p / sum(poids)
            sortie.append({"mot": mots[k], "debutSec": round(t, 3), "finSec": round(t + part, 3), "aligne": False})
            t += part
            non_alignes += 1
        i = j
    return sortie, non_alignes
