"""
Route `/son` (plan facecam v4, lot B ; n° 20) : le son de la vidéo face caméra, « réglage de pro ».

  1. son de la prise en 48 kHz mono, lu par tranches de 30 s ;
  2. débruitage DeepFilterNet 3 (MIT / Apache 2.0) MÉLANGÉ À 85 % avec l'original (la voix garde son grain) ;
     DeepFilterNet absent ou en panne : `afftdn` de FFmpeg, jamais d'échec pour ça ;
  3. facultatif, `parametres.gardes` (passages gardés par la brique coupes, temps de la prise) : le son est MONTÉ,
     avec un fondu de 15 ms à CHAQUE coupe et un TON DE PIÈCE continu sous les raccords (pris dans le passage le plus
     calme de la prise : les 3 s de pièce vide filmées au début, sinon la seconde la plus calme) ; 50 ms de fondu final ;
  4. chaîne voix : passe-haut 80 Hz, présence +2,5 dB vers 4 kHz, dé-esseur, compression douce (plage ≤ 4 LU),
     puis −14 LUFS et −1,5 dBTP en deux passes (`loudnorm` mesuré puis linéaire).
Résultat : { fichierCle, niveauLufs, cretedBTP, plageLU, dureeSec, debruitage: "deepfilternet" | "afftdn" }.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
from typing import Callable

from .media import FILTRE_SON_ALIGNE, ErreurTravail, cle, depot, deposer_fichier, entree, executer, nettoyer_dossier, parametre, sonder

FREQUENCE = 48000
MELANGE_DFN = 0.85
FONDU_COUPE_SEC = 0.015
FONDU_FIN_SEC = 0.05
CIBLE_LUFS = -14.0
CRETE_DBTP = -1.5
PLAGE_LU = 4.0
CHAINE_VOIX = "highpass=f=80:poles=2,equalizer=f=4000:t=q:w=1.2:g=2.5,deesser=i=0.35:m=0.5:f=0.5,acompressor=threshold=-22dB:ratio=2.5:attack=8:release=160:makeup=2"


def lire_son(source: str, frequence: int = FREQUENCE):
    """Son mono en float32 (numpy) décodé par FFmpeg, sur l'origine du conteneur (celle de l'image : `FILTRE_SON_ALIGNE`)."""
    import numpy as np

    r = executer(["ffmpeg", "-v", "error", "-nostdin", *entree(source), "-vn", "-af", FILTRE_SON_ALIGNE, "-ac", "1", "-ar", str(frequence), "-f", "f32le", "pipe:1"])
    return np.frombuffer(r.stdout, dtype=np.float32).copy()


def ecrire_wav(chemin: str, signal, frequence: int = FREQUENCE) -> str:
    import numpy as np

    executer(["ffmpeg", "-v", "error", "-nostdin", "-y", "-f", "f32le", "-ar", str(frequence), "-ac", "1", "-i", "pipe:0", "-c:a", "pcm_f32le", chemin], entree=np.asarray(signal, dtype=np.float32).tobytes())
    return chemin


# --------------------------------------------------------------------------------------------------------------------
# Débruitage
# --------------------------------------------------------------------------------------------------------------------

_dfn = None


def _compat_torchaudio() -> None:
    """DeepFilterNet 0.5 importe `torchaudio.backend.common`, retiré des torchaudio récents : module de remplacement."""
    import sys
    import types

    try:
        import torchaudio.backend.common  # noqa: F401
    except Exception:  # noqa: BLE001
        import torchaudio

        commun = types.ModuleType("torchaudio.backend.common")
        commun.AudioMetaData = getattr(torchaudio, "AudioMetaData", object)  # type: ignore[attr-defined]
        dorsal = sys.modules.get("torchaudio.backend") or types.ModuleType("torchaudio.backend")
        dorsal.common = commun  # type: ignore[attr-defined]
        sys.modules["torchaudio.backend"] = dorsal
        sys.modules["torchaudio.backend.common"] = commun


def charger_deepfilternet():
    global _dfn
    if _dfn is None:
        _compat_torchaudio()
        from df.enhance import init_df

        modele, etat, _ = init_df(log_level="ERROR")
        _dfn = (modele, etat)
    return _dfn


def debruiter_deepfilternet(signal, progression: Callable[[int, int], None] | None = None):
    """DeepFilterNet par tranches de 30 s (recouvrement de 0,5 s en fondu enchaîné), mélangé à 85 %."""
    import numpy as np
    import torch
    from df.enhance import enhance

    modele, etat = charger_deepfilternet()
    tranche = 30 * FREQUENCE
    recouvre = FREQUENCE // 2
    sortie = np.zeros_like(signal)
    poids = np.zeros_like(signal)
    debuts = list(range(0, max(len(signal), 1), tranche))
    for i, d in enumerate(debuts):
        a = max(0, d - recouvre)
        b = min(len(signal), d + tranche + recouvre)
        morceau = torch.from_numpy(signal[a:b].copy()).unsqueeze(0)
        propre = enhance(modele, etat, morceau, pad=True).squeeze(0).numpy()[: b - a]
        fenetre = np.ones(b - a, dtype=np.float32)
        if a > 0:
            fenetre[: 2 * recouvre] = np.linspace(0, 1, 2 * recouvre, dtype=np.float32)
        if b < len(signal):
            fenetre[-2 * recouvre :] = np.minimum(fenetre[-2 * recouvre :], np.linspace(1, 0, 2 * recouvre, dtype=np.float32))
        sortie[a:b] += propre * fenetre
        poids[a:b] += fenetre
        if progression:
            progression(i + 1, len(debuts))
    propre = sortie / np.maximum(poids, 1e-6)
    return (MELANGE_DFN * propre + (1 - MELANGE_DFN) * signal).astype(np.float32)


FILTRE_AFFTDN = "afftdn=nr=12:nf=-40:tn=1"
_retard_afftdn: float | None = None


def retard_afftdn() -> float:
    """Retard (s) qu'ajoute `afftdn` (10/10 : 25 ms mesurés en FFmpeg 6.1, longueur inchangée, donc la voix arrivait
    0,6 image après l'image). Mesuré une fois par conteneur sur un bip, pour suivre la version de FFmpeg en service."""
    global _retard_afftdn
    if _retard_afftdn is None:
        import numpy as np

        f = 16000
        x = (0.003 * np.random.default_rng(1).standard_normal(2 * f)).astype(np.float32)
        x[f : f + f // 12] += 0.5 * np.sin(2 * np.pi * 1000 * np.arange(f // 12) / f).astype(np.float32)
        r = executer(["ffmpeg", "-v", "error", "-nostdin", "-f", "f32le", "-ar", str(f), "-ac", "1", "-i", "pipe:0", "-af", FILTRE_AFFTDN, "-f", "f32le", "pipe:1"], entree=x.tobytes())
        y = np.frombuffer(r.stdout, np.float32)
        a, b = f - f // 10, f + f // 5
        c = np.correlate(y[a:b], x[a:b], "full")
        _retard_afftdn = max(0.0, min(0.2, float(np.argmax(c) - (b - a - 1)) / f))
    return _retard_afftdn


def debruiter_afftdn(chemin_entree: str, chemin_sortie: str) -> str:
    """Secours sans modèle : débruitage spectral de FFmpeg, réglé doux (même esprit : la voix reste naturelle), son
    RETARD compensé (le fichier est allongé d'autant avant, puis le début retiré : même longueur, même instant)."""
    d = retard_afftdn()
    filtre = f"apad=pad_dur={d:.6f},{FILTRE_AFFTDN},atrim=start={d:.6f},asetpts=PTS-STARTPTS" if d > 0 else FILTRE_AFFTDN
    executer(["ffmpeg", "-v", "error", "-nostdin", "-y", "-i", chemin_entree, "-af", filtre, "-c:a", "pcm_f32le", chemin_sortie])
    return chemin_sortie


# --------------------------------------------------------------------------------------------------------------------
# Montage du son : fondus à chaque coupe, ton de pièce continu
# --------------------------------------------------------------------------------------------------------------------

def ton_de_piece(signal, plaque: tuple[float, float] | None = None, duree: float = 1.0):
    """Le passage le plus calme (ou la plaque vide filmée au début) : sert de ton de pièce sous les raccords."""
    import numpy as np

    n = int(duree * FREQUENCE)
    if len(signal) < n * 2:
        return np.zeros(n, dtype=np.float32)
    if plaque and plaque[1] - plaque[0] >= 0.5:
        a, b = int(plaque[0] * FREQUENCE), int(plaque[1] * FREQUENCE)
        if b <= len(signal):
            return signal[a:b].astype(np.float32)
    pas = FREQUENCE // 10
    marge = FREQUENCE // 5
    meilleur, energie = marge, float("inf")
    for d in range(marge, len(signal) - n - marge, pas):
        e = float(np.mean(signal[d : d + n] ** 2))
        if e < energie:
            meilleur, energie = d, e
    return signal[meilleur : meilleur + n].astype(np.float32)


def boucle(ton, longueur: int):
    """Ton de pièce répété sur `longueur` échantillons, raccords en fondu enchaîné (aucun clic)."""
    import numpy as np

    if longueur <= 0 or len(ton) == 0:
        return np.zeros(max(longueur, 0), dtype=np.float32)
    f = min(len(ton) // 4, FREQUENCE // 20)
    sortie = np.zeros(longueur + len(ton), dtype=np.float32)
    pos = 0
    rampe = np.linspace(0, 1, f, dtype=np.float32) if f > 0 else None
    while pos < longueur:
        morceau = ton.copy()
        if rampe is not None and pos > 0:
            morceau[:f] *= rampe
            sortie[pos : pos + f] *= rampe[::-1]
        sortie[pos : pos + len(morceau)] += morceau
        pos += len(ton) - f
    return sortie[:longueur]


def monter(signal, gardes: list[dict], ton=None):
    """Assemble les passages gardés : fondu de 15 ms de part et d'autre de chaque coupe, ton de pièce dans le creux."""
    import numpy as np

    f = int(FONDU_COUPE_SEC * FREQUENCE)
    morceaux, enveloppes = [], []
    for k, g in enumerate(gardes):
        a = max(0, int(round(float(g["debutSec"]) * FREQUENCE)))
        b = min(len(signal), int(round(float(g["finSec"]) * FREQUENCE)))
        if b <= a:
            continue
        m = signal[a:b].astype(np.float32).copy()
        env = np.ones(b - a, dtype=np.float32)
        if k > 0 and len(m) > 2 * f:
            env[:f] = np.linspace(0, 1, f, dtype=np.float32)
        if k < len(gardes) - 1 and len(m) > 2 * f:
            env[-f:] = np.minimum(env[-f:], np.linspace(1, 0, f, dtype=np.float32))
        morceaux.append(m * env)
        enveloppes.append(env)
    if not morceaux:
        return np.zeros(0, dtype=np.float32)
    voix = np.concatenate(morceaux)
    env = np.concatenate(enveloppes)
    if ton is not None and len(ton):
        voix = voix + boucle(ton, len(voix)) * (1.0 - env)
    # Fin : 50 ms de fondu (v4 n° 23).
    ff = min(len(voix), int(FONDU_FIN_SEC * FREQUENCE))
    if ff > 0:
        voix[-ff:] *= np.linspace(1, 0, ff, dtype=np.float32)
    return voix


# --------------------------------------------------------------------------------------------------------------------
# Chaîne voix et niveau
# --------------------------------------------------------------------------------------------------------------------

def mesurer_loudnorm(chemin: str, chaine: str, cible: float = CIBLE_LUFS) -> dict:
    r = subprocess.run(["ffmpeg", "-v", "info", "-nostdin", "-i", chemin, "-af", f"{chaine},loudnorm=I={cible}:TP={CRETE_DBTP}:LRA={PLAGE_LU}:print_format=json", "-f", "null", "-"], capture_output=True)
    texte = r.stderr.decode("utf-8", "replace")
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", texte, re.S)
    if r.returncode != 0 or not m:
        raise ErreurTravail("inconnu", "Mesure du niveau sonore impossible.")
    return json.loads(m.group(0))


def mesurer_ebur128(chemin: str) -> dict:
    """Niveau intégré (LUFS), plage (LU) et crête vraie (dBTP) du fichier final."""
    r = subprocess.run(["ffmpeg", "-v", "info", "-nostdin", "-i", chemin, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True)
    texte = r.stderr.decode("utf-8", "replace")
    resume = texte[texte.rfind("Summary:") :] if "Summary:" in texte else texte

    def nombre(motif: str) -> float | None:
        m = re.search(motif, resume)
        return float(m.group(1)) if m else None

    return {"lufs": nombre(r"I:\s+(-?[\d.]+) LUFS"), "lra": nombre(r"LRA:\s+(-?[\d.]+) LU"), "crete": nombre(r"Peak:\s+(-?[\d.]+) dBFS")}


# Lot G : « plus fort » / « moins fort » demandés au monteur (± 1 LU, toujours dans la tolérance du contrôle).
CIBLES_VOLUME = {"plus-fort": CIBLE_LUFS + 1.0, "moins-fort": CIBLE_LUFS - 1.0}


def chaine_pro(chemin_entree: str, chemin_sortie: str, cible: float = CIBLE_LUFS) -> dict:
    mesure = mesurer_loudnorm(chemin_entree, CHAINE_VOIX, cible)
    norme = (
        f"loudnorm=I={cible}:TP={CRETE_DBTP}:LRA={PLAGE_LU}:measured_I={mesure['input_i']}:measured_TP={mesure['input_tp']}"
        f":measured_LRA={mesure['input_lra']}:measured_thresh={mesure['input_thresh']}:offset={mesure['target_offset']}:linear=true"
    )
    executer(["ffmpeg", "-v", "error", "-nostdin", "-y", "-i", chemin_entree, "-af", f"{CHAINE_VOIX},{norme},aresample={FREQUENCE}", "-c:a", "flac", "-sample_fmt", "s32", "-ar", str(FREQUENCE), chemin_sortie])
    return mesurer_ebur128(chemin_sortie)


def executer_son(demande: dict, dossier: str, progression: Callable[[int], None]) -> dict:
    sonde = sonder(demande["source"])
    if not sonde["son"]:
        raise ErreurTravail("refuse", "La prise n'a pas de son.", False)
    signal = lire_son(demande["source"])
    progression(10)
    brut = ecrire_wav(os.path.join(dossier, "brut.wav"), signal)
    voix = parametre(demande, "voix") or {}
    voix = voix if isinstance(voix, dict) else {}
    methode = "deepfilternet"
    if voix.get("nettoyer") is False:
        # Lot G : Will a demandé le son tel quel (aucun débruitage) ; la chaîne voix et le niveau restent.
        methode = "aucun"
        propre = signal
    else:
        try:
            propre = debruiter_deepfilternet(signal, lambda i, n: progression(10 + int(50 * i / n)))
        except Exception:  # noqa: BLE001 — une brique ratée n'empêche jamais la livraison : secours afftdn
            methode = "afftdn"
            propre = lire_son(debruiter_afftdn(brut, os.path.join(dossier, "afftdn.wav")))
    progression(62)
    gardes = parametre(demande, "gardes")
    if isinstance(gardes, list) and gardes:
        plaque = parametre(demande, "plaqueSec")
        ton = ton_de_piece(propre, tuple(plaque) if isinstance(plaque, list) and len(plaque) == 2 else None)
        propre = monter(propre, [g for g in gardes if isinstance(g, dict)], ton)
    if len(propre) < FREQUENCE // 10:
        raise ErreurTravail("refuse", "Son trop court après les coupes.", False)
    monte = ecrire_wav(os.path.join(dossier, "monte.wav"), propre)
    progression(75)
    final = os.path.join(dossier, "son.flac")
    mesures = chaine_pro(monte, final, CIBLES_VOLUME.get(str(voix.get("volume")), CIBLE_LUFS))
    progression(92)
    deposer_fichier(depot(demande, "son"), final, "audio/flac")
    duree = len(propre) / FREQUENCE
    nettoyer_dossier(dossier)
    return {
        "fichierCle": cle(demande, "son"),
        **({"niveauLufs": mesures["lufs"]} if mesures["lufs"] is not None else {}),
        **({"cretedBTP": mesures["crete"]} if mesures["crete"] is not None else {}),
        **({"plageLU": mesures["lra"]} if mesures["lra"] is not None else {}),
        "dureeSec": round(duree, 3),
        "debruitage": methode,
    }
