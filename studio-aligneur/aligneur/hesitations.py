"""
Pauses remplies (« euh », « heu », « hum ») retrouvées DANS LE SON (rapport V6, P0 n° 7).

Whisper nettoie la parole : la transcription réelle d'IMG_7747 ne contient aucun « euh ». La brique `coupes` du studio
sait couper un « euh » qu'on lui donne ; elle était donc aveugle. Ici, on cherche dans le son ce qu'est une pause
remplie : une VOYELLE TENUE (voisée, timbre stable, hauteur stable, au moins 0,22 s), assez forte, qui tombe HORS des
mots transcrits (un blanc pour Whisper). Chaque pause trouvée devient un mot « euh » (`source: "acoustique"`) inséré
à sa place dans la transcription.

Numpy seul (aucun modèle). Trames de 32 ms, pas de 10 ms. Seuils relatifs au son de la prise (bruit de fond et parole
médians), pour tenir d'une pièce à l'autre.
"""
from __future__ import annotations

TRAME_SEC = 0.032
PAS_SEC = 0.010
DUREE_MIN_SEC = 0.22
DUREE_MAX_SEC = 2.0
# Part de la pause qui doit tomber hors des mots transcrits (Whisper déborde parfois un peu sur le blanc).
HORS_MOTS_MIN = 0.7
# Voisement : pic d'autocorrélation normalisée dans 70-400 Hz.
VOISEMENT_MIN = 0.55
# Hauteur stable : écart-type relatif de f0 sur la pause.
F0_ECART_MAX = 0.08
# Au-dessus du bruit de fond (dB) et au plus tant sous la parole médiane (dB).
AU_DESSUS_BRUIT_DB = 15.0
SOUS_PAROLE_MAX_DB = 18.0


def _trames(np, son, sr):
    n = int(TRAME_SEC * sr)
    pas = int(PAS_SEC * sr)
    if len(son) < n:
        return np.zeros((0, n), np.float32), pas
    nb = 1 + (len(son) - n) // pas
    idx = np.arange(n)[None, :] + pas * np.arange(nb)[:, None]
    return son[idx] * np.hanning(n)[None, :].astype(np.float32), pas


def analyser(son, sr: int) -> dict:
    """Mesures par trame : niveau (dB), voisement, f0 (Hz), flux spectral (stabilité du timbre)."""
    import numpy as np

    son = np.asarray(son, dtype=np.float32)
    trames, _ = _trames(np, son, sr)
    if not len(trames):
        return {"db": np.zeros(0), "voise": np.zeros(0), "f0": np.zeros(0), "flux": np.zeros(0)}
    rms = np.sqrt((trames**2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(rms + 1e-9)
    n = trames.shape[1]
    taille = 1 << (2 * n - 1).bit_length()
    spectre = np.fft.rfft(trames, taille, axis=1)
    auto = np.fft.irfft(np.abs(spectre) ** 2, axis=1)[:, :n]
    auto = auto / (auto[:, :1] + 1e-12)
    lag_min, lag_max = int(sr / 400), min(n - 1, int(sr / 70))
    zone = auto[:, lag_min:lag_max]
    lag = zone.argmax(axis=1) + lag_min
    voise = zone.max(axis=1)
    f0 = sr / lag
    # Timbre : log-spectre de 80 Hz à 4 kHz ; flux = écart moyen avec la trame précédente (dB).
    freqs = np.fft.rfftfreq(taille, 1 / sr)
    bande = (freqs >= 80) & (freqs <= 4000)
    log_spec = 20 * np.log10(np.abs(spectre[:, bande]) + 1e-6)
    flux = np.zeros(len(trames))
    flux[1:] = np.abs(np.diff(log_spec, axis=0)).mean(axis=1)
    return {"db": db, "voise": voise, "f0": f0, "flux": flux}


def pauses_remplies(son, sr: int, mots: list[dict]) -> list[dict]:
    """Pauses remplies hors des mots transcrits : [{ debutSec, finSec }], triées."""
    import numpy as np

    a = analyser(son, sr)
    db, voise, f0, flux = a["db"], a["voise"], a["f0"], a["flux"]
    if len(db) < 10:
        return []
    bruit = float(np.percentile(db, 10))
    voisees = db[(voise >= VOISEMENT_MIN) & (db > bruit + AU_DESSUS_BRUIT_DB)]
    if not len(voisees):
        return []
    parole = float(np.median(voisees))
    # Timbre stable : flux sous le tiers bas de celui des trames voisées (une vraie parole change de timbre sans arrêt).
    flux_voise = flux[(voise >= VOISEMENT_MIN) & (db > bruit + AU_DESSUS_BRUIT_DB)]
    seuil_flux = float(np.percentile(flux_voise, 35)) if len(flux_voise) else 0.0
    candidat = (voise >= VOISEMENT_MIN) & (db > bruit + AU_DESSUS_BRUIT_DB) & (db > parole - SOUS_PAROLE_MAX_DB)
    # Le flux de la 1re trame d'une voyelle est fort (attaque) : on le lisse sur 5 trames avant de comparer.
    flux_lisse = np.convolve(flux, np.ones(5) / 5, mode="same")
    stable = flux_lisse <= max(seuil_flux, 1e-6) * 1.15
    t = np.arange(len(db)) * PAS_SEC + TRAME_SEC / 2
    dans_mot = np.zeros(len(db), bool)
    for m in mots:
        try:
            d, f = float(m["debutSec"]), float(m["finSec"])
        except (KeyError, TypeError, ValueError):
            continue
        dans_mot |= (t >= d) & (t <= f)
    sortie: list[dict] = []
    i = 0
    actif = candidat & stable
    while i < len(actif):
        if not actif[i]:
            i += 1
            continue
        j = i
        # Une trame isolée hors critère (≤ 30 ms) ne coupe pas la pause.
        while j + 1 < len(actif) and (actif[j + 1] or (j + 3 < len(actif) and actif[j + 2:j + 4].all() and candidat[j + 1])):
            j += 1
        debut, fin = t[i] - TRAME_SEC / 2, t[j] + TRAME_SEC / 2
        duree = fin - debut
        hors = 1.0 - dans_mot[i:j + 1].mean()
        f = f0[i:j + 1]
        stable_f0 = float(np.std(f) / max(np.mean(f), 1e-6)) <= F0_ECART_MAX
        if DUREE_MIN_SEC <= duree <= DUREE_MAX_SEC and hors >= HORS_MOTS_MIN and stable_f0:
            sortie.append({"debutSec": round(float(max(0.0, debut)), 3), "finSec": round(float(fin), 3)})
        i = j + 1
    return sortie


def avec_pauses_remplies(son, sr: int, mots: list[dict]) -> tuple[list[dict], int]:
    """La transcription avec un mot « euh » (`source: "acoustique"`) à chaque pause remplie trouvée ; et leur nombre."""
    pauses = pauses_remplies(son, sr, mots)
    if not pauses:
        return mots, 0
    ajout = [{"mot": "euh", "debutSec": p["debutSec"], "finSec": p["finSec"], "proba": 0.0, "source": "acoustique"} for p in pauses]
    return sorted([*mots, *ajout], key=lambda m: (float(m["debutSec"]), float(m["finSec"]))), len(ajout)
