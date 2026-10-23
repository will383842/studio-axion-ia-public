"""
Calcul PUR du calage (numpy seul, testé sans modèle par tests/test_ctc.py) :
  - `viterbi_ctc` : alignement forcé CTC (le même calcul que WhisperX / torchaudio `forced_align`) d'une suite de
    lettres connue sur les probabilités du modèle, image par image ;
  - `silences` : vrais blancs du son (niveau relatif à la parole, donc valable pour un son propre comme pour un son
    avec souffle) ;
  - `affiner` : du chemin CTC aux débuts / fins de mots — latence du modèle retirée, débuts posés sur la reprise
    réelle de la voix après un blanc, fins posées sur le début du blanc qui suit (ou sur le mot suivant).
"""
from __future__ import annotations

import numpy as np

FREQ = 16000
PAS_ENERGIE = 0.005
FENETRE_ENERGIE = 0.010


def viterbi_ctc(logp: np.ndarray, jetons: list[int], blanc: int = 0) -> np.ndarray:
    """
    Chemin le plus probable qui lit `jetons` dans l'ordre (blancs libres entre eux). Renvoie, pour chaque image,
    l'indice du jeton lu (ou -1 pour un blanc). `logp` : images × vocabulaire (log-probabilités).
    """
    T = logp.shape[0]
    L = len(jetons)
    if L == 0:
        return np.full(T, -1, dtype=np.int64)
    etendu = np.full(2 * L + 1, blanc, dtype=np.int64)
    etendu[1::2] = jetons
    S = len(etendu)
    repetes = sum(1 for a, b in zip(jetons, jetons[1:]) if a == b)
    if T < L + repetes:
        raise ValueError("son trop court pour le texte")
    # Saut de deux états permis vers une lettre différente de la lettre d'avant (le blanc entre deux mêmes lettres est dû).
    saut = np.zeros(S, dtype=bool)
    saut[2:] = (etendu[2:] != blanc) & (etendu[2:] != etendu[:-2])
    moins_inf = -np.inf
    dp = np.full(S, moins_inf)
    dp[0] = logp[0, etendu[0]]
    dp[1] = logp[0, etendu[1]]
    retour = np.zeros((T, S), dtype=np.int8)
    for t in range(1, T):
        rester = dp
        un = np.concatenate(([moins_inf], dp[:-1]))
        deux = np.where(saut, np.concatenate(([moins_inf, moins_inf], dp[:-2])), moins_inf)
        pile = np.stack([rester, un, deux])
        choix = np.argmax(pile, axis=0)
        dp = pile[choix, np.arange(S)] + logp[t, etendu]
        retour[t] = choix
    s = S - 1 if dp[S - 1] >= dp[S - 2] else S - 2
    if not np.isfinite(dp[s]):
        raise ValueError("aucun chemin")
    chemin = np.empty(T, dtype=np.int64)
    for t in range(T - 1, -1, -1):
        chemin[t] = s
        s -= int(retour[t, s])
    return np.where(chemin % 2 == 1, (chemin - 1) // 2, -1)


def spans(chemin: np.ndarray, nombre: int) -> list[tuple[int, int] | None]:
    """[première image, dernière image] lue pour chaque jeton."""
    sortie: list[tuple[int, int] | None] = [None] * nombre
    for t, k in enumerate(chemin):
        if k < 0:
            continue
        a = sortie[k]
        sortie[k] = (t, t) if a is None else (a[0], t)
    return sortie


def energie(audio: np.ndarray) -> np.ndarray:
    """Niveau (dB) par pas de 5 ms, fenêtre de 10 ms."""
    pas = int(FREQ * PAS_ENERGIE)
    fen = int(FREQ * FENETRE_ENERGIE)
    if len(audio) < fen:
        return np.zeros(0)
    n = 1 + (len(audio) - fen) // pas
    carre = np.concatenate(([0.0], np.cumsum(audio.astype(np.float64) ** 2)))
    debuts = np.arange(n) * pas
    moyenne = (carre[debuts + fen] - carre[debuts]) / fen
    return 10 * np.log10(moyenne + 1e-12)


def silences(audio: np.ndarray, ecart_db: float = 35.0, duree_min: float = 0.08) -> list[tuple[float, float]]:
    """
    Vrais blancs du son : au moins `duree_min` sous (niveau de la parole − `ecart_db`). Le niveau de la parole est le
    90e centile du son : le seuil suit la voix (une voix forte avec un souffle n'a pas de faux blanc).
    """
    e = energie(audio)
    if not len(e):
        return []
    seuil = np.percentile(e, 90) - ecart_db
    calme = e < seuil
    sortie = []
    i = 0
    while i < len(calme):
        if calme[i]:
            j = i
            while j < len(calme) and calme[j]:
                j += 1
            debut, fin = i * PAS_ENERGIE, (j - 1) * PAS_ENERGIE + FENETRE_ENERGIE
            if fin - debut >= duree_min:
                sortie.append((debut, min(fin, len(audio) / FREQ)))
            i = j
        else:
            i += 1
    return sortie


def affiner(debuts_bruts: list[float], fins_brutes: list[float], blancs: list[tuple[float, float]], duree: float,
            latence: float, fin_supplement: float, recherche: float = 0.25, duree_min: float = 0.02,
            accrocher: bool = True) -> list[tuple[float, float]]:
    """
    Du chemin CTC aux mots. Débuts : séparateur lu avant le mot − latence du modèle ; avec `accrocher`, si la voix
    reprend après un vrai blanc situé APRÈS la fin du mot précédent (entre `recherche` s avant le début corrigé et le
    début CTC), le début est posé sur cette reprise. Fins : dernière lettre lue + `fin_supplement` (la fin d'un mot
    s'entend après sa dernière lettre lue), coupée au début d'un vrai blanc, jamais au-delà du mot suivant. Un blanc
    lu par le modèle (souffle, respiration, silence) reste donc un blanc entre deux mots : le nettoyage le retrouve.
    Toujours dans l'ordre. `accrocher=False` : latence seule (mesures indépendantes des blancs).
    """
    n = len(debuts_bruts)
    debuts = []
    precedent = 0.0
    for i in range(n):
        brut = debuts_bruts[i]
        d = max(0.0, brut - latence)
        if accrocher:
            borne = fins_brutes[i - 1] if i else -1.0
            reprises = [f for (a, f) in blancs if a >= borne and d - recherche <= f <= brut]
            if reprises:
                d = max(reprises)
            dedans = next(((a, f) for (a, f) in blancs if a >= borne and a < d < f), None)
            if dedans:
                d = dedans[1]
        d = max(d, precedent + (duree_min if i else 0.0))
        d = min(d, duree)
        debuts.append(d)
        precedent = d
    sortie = []
    for i in range(n):
        d = debuts[i]
        suivant = debuts[i + 1] if i + 1 < n else duree
        f = min(suivant, duree, fins_brutes[i] + fin_supplement)
        if accrocher:
            blanc = next((a for (a, b) in blancs if d + duree_min <= a < f and a >= fins_brutes[i] - latence), None)
            if blanc is not None:
                f = blanc
        f = max(f, d + duree_min)
        sortie.append((round(d, 3), round(f, 3)))
    return sortie
