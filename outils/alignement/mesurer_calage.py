"""
PREUVE DU CALAGE (lot « calage », D3) — écart des débuts de mots, AVANT (voix HeyGen) et APRÈS (studio-aligneur).

  python outils/alignement/mesurer_calage.py            (depuis la racine du dépôt, environnement de studio-aligneur)

Aucun appel payant ici : les 5 phrases de la vraie voix HeyGen de Will du lot M0b (`docs/captures/m0b-voix/`, 0,08 $
payés le 02/10) et une 6e écrite pour la mesure (`phrase-heygen.mts`, 0,03 $ le 02/10, `docs/captures/d3-calage/`).
Sorties : `docs/captures/d3-calage/mesures.json` + résumé à l'écran.

Trois mesures, chacune contre une référence INDÉPENDANTE de ce qui est mesuré :
 1. ÉTALON (`outils/alignement/etalon/`, voix Windows, débuts exacts) : latence brute du modèle → `LATENCE_MODELE_SEC`.
    C'est le SEUL son qui sert à régler quelque chose.
 2. FIXTURE `tests/fixtures/voix-essai` (autre texte, débuts exacts de Windows) : TOUS les mots, contrôle.
 3. 5 PHRASES HEYGEN : référence = reprise de la VOIX (passage voisé) après une pause, pour les mots qui suivent une
    ponctuation et commencent par un son voisé. Le seuil de −35 dB du lot M0b est écarté : la voix HeyGen respire
    fort entre les phrases (souffle à −17 dB) et ce seuil prend le souffle pour le mot. L'erreur propre de cette
    référence est contrôlée sur la fixture (débuts exacts). L'aligneur recale ses débuts sur les blancs : la variante
    « latence seule » (sans recalage) est aussi donnée, pour ne pas le mesurer contre lui-même.
Également : WhisperX tel quel (`whisperx.align`), s'il est installé, pour comparaison ; temps de calcul et mémoire.
"""
from __future__ import annotations

import json
import os
import re
import statistics as st
import sys
import time
import unicodedata

RACINE = os.getcwd()
sys.path.insert(0, os.path.join(RACINE, "studio-aligneur"))

import numpy as np  # noqa: E402

from aligneur import calage  # noqa: E402
from aligneur.texte import decouper  # noqa: E402

SORTIE = os.path.join(RACINE, "docs", "captures", "d3-calage")
M0B = os.path.join(RACINE, "docs", "captures", "m0b-voix")
PHRASES = [(M0B, p) for p in ["1-sons-proches", "2-montant", "3-nom-propre", "4-avant", "5-apres"]] + [
    (SORTIE, f"{n}-mesure") for n in range(6, 10) if os.path.exists(os.path.join(SORTIE, f"{n}-mesure.heygen.json"))
]


def lire_json(chemin: str):
    with open(chemin, encoding="utf-8-sig") as f:
        return json.load(f)


def norm(m: str) -> str:
    m = "".join(c for c in unicodedata.normalize("NFD", m.lower()) if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", m)


def memoire_mo() -> float | None:
    try:
        import psutil

        p = psutil.Process()
        info = p.memory_info()
        return round(getattr(info, "peak_wset", info.rss) / 1e6, 1)
    except Exception:  # noqa: BLE001
        return None


def stats(ecarts: list[float]) -> dict:
    if not ecarts:
        return {"mots": 0}
    a = [abs(x) for x in ecarts]
    return {"mots": len(a), "ecartMoyenMs": round(st.mean(a), 1), "ecartMedianMs": round(st.median(a), 1), "ecartMaxMs": round(max(a)), "biaisMs": round(st.mean(ecarts), 1)}


def whisperx_brut(son: str, texte: str):
    try:
        import contextlib

        import whisperx
    except ImportError:
        return None
    with contextlib.redirect_stdout(sys.stderr):
        modele, meta = whisperx.load_align_model(language_code="fr", device="cpu")
    audio = whisperx.load_audio(son)
    r = whisperx.align([{"start": 0.0, "end": len(audio) / 16000, "text": " ".join(decouper(texte))}], modele, meta, audio, "cpu")
    return [{"mot": w["word"], "debutSec": w.get("start")} for w in r["word_segments"]]


def correspondance(a: list[dict], b: list[dict]) -> list[tuple[dict, dict]]:
    """Paires (a, b) des mêmes mots, dans l'ordre (les découpages peuvent différer : « € » absent chez HeyGen)."""
    paires = []
    j = 0
    for x in a:
        k = next((q for q in range(j, min(len(b), j + 3)) if norm(b[q]["mot"]) == norm(x["mot"]) and norm(x["mot"])), None)
        if k is not None:
            paires.append((x, b[k]))
            j = k + 1
    return paires


VOISEES = set("aeiouyàâäéèêëîïôöùûüœbdgvzjlmnrw")


def attaques_voisees(audio: np.ndarray, blanc_min: float = 0.06) -> list[float]:
    """
    Reprises de la VOIX : début d'un passage voisé (≥ 40 ms, la voix vibre : autocorrélation ≥ 0,6 entre 80 et 400 Hz)
    précédé d'au moins `blanc_min` sans voix. Constat (02/10) : la voix HeyGen pose parfois, avant un mot, un son
    VOISÉ qui n'est pas un mot du texte (≈ 0,5 s à −17 dB, ex. phrase 1 de 0,25 à 0,81 s puis de 3,15 à 3,65 s) :
    le seuil de −35 dB du lot M0b le prenait pour le mot. Ici, seule la reprise après une vraie coupure de la voix compte.
    """
    fen, pas = 480, 80
    n = max(0, 1 + (len(audio) - fen) // pas)
    niveau = np.array([10 * np.log10(np.mean(audio[k * pas:k * pas + fen].astype(np.float64) ** 2) + 1e-12) for k in range(n)])
    seuil = np.percentile(niveau, 90) - 30 if n else 0
    voise = np.zeros(n, dtype=bool)
    for k in range(n):
        if niveau[k] < seuil:
            continue
        x = audio[k * pas:k * pas + fen].astype(np.float64)
        x = x - x.mean()
        spectre = np.fft.rfft(x, 2 * fen)
        ac = np.fft.irfft(spectre * np.conj(spectre))[:fen]
        if ac[0] <= 0:
            continue
        voise[k] = (ac[40:200] / ac[0]).max() >= 0.6
    sortie, calme = [], 0
    k = 0
    while k < n:
        if voise[k]:
            j = k
            while j < n and voise[j]:
                j += 1
            if (j - k) * pas / 16000 >= 0.04 and calme * pas / 16000 >= blanc_min:
                # début du passage : centre de la première fenêtre voisée moins une demi-fenêtre
                sortie.append(round(k * pas / 16000, 3))
            calme = 0
            k = j
        else:
            calme += 1
            k += 1
    return sortie


def apres_pause(texte: str) -> list[int]:
    """Rangs (dans `decouper`) des mots qui suivent une ponctuation (ou le premier) et commencent par un son voisé."""
    sortie, rang, pause = [], 0, True
    for brut in texte.split():
        if not re.search(r"[\w€%&$£+°@§]", brut):
            pause = True  # ponctuation isolée (« : », « ? »)
            continue
        if pause and norm(brut)[:1] in VOISEES:
            sortie.append(rang)
        pause = re.search(r"[,;:.!?…]$", brut) is not None
        rang += 1
    return sortie


def etalon() -> dict:
    d = lire_json(os.path.join(RACINE, "outils", "alignement", "etalon", "etalon.debuts.json"))
    r = calage.caler(os.path.join(RACINE, "outils", "alignement", "etalon", "etalon.wav"), d["texte"], latence=0.0, accrocher=False)
    lags = [(w["debutSec"] - m["debutSec"]) * 1000 for m, w in zip(d["mots"], r["mots"])]
    return {"mots": len(lags), "latenceMedianeMs": round(st.median(lags), 1), "latenceMoyenneMs": round(st.mean(lags), 1), "ecartTypeMs": round(st.pstdev(lags), 1),
            "constanteRetenueMs": round(calage.LATENCE_MODELE_SEC * 1000)}


def fixture() -> dict:
    texte = lire_json(os.path.join(RACINE, "tests", "fixtures", "voix-essai.json"))["texteEnvoye"]
    debuts = lire_json(os.path.join(RACINE, "tests", "fixtures", "voix-essai.debuts.json"))
    son = os.path.join(RACINE, "tests", "fixtures", "voix-essai.wav")
    t = time.perf_counter()
    final = calage.caler(son, texte)
    duree_calcul = time.perf_counter() - t
    latence_seule = calage.caler(son, texte, accrocher=False)
    sortie = {
        "reference": "débuts exacts des mots donnés par la synthèse Windows (voix-essai.debuts.json)",
        "aligneur": stats([(w["debutSec"] - d["debutSec"]) * 1000 for d, w in zip(debuts, final["mots"])]),
        "aligneurLatenceSeule": stats([(w["debutSec"] - d["debutSec"]) * 1000 for d, w in zip(debuts, latence_seule["mots"])]),
        "dureeSonSec": round(len(calage.lire_son(son)) / 16000, 2),
        "dureeCalculSec": round(duree_calcul, 2),
        "mots": [{"mot": d["mot"], "reference": d["debutSec"], "aligneur": w["debutSec"]} for d, w in zip(debuts, final["mots"])],
    }
    wx = whisperx_brut(son, texte)
    if wx:
        sortie["whisperxTelQuel"] = stats([(w["debutSec"] - d["debutSec"]) * 1000 for d, w in zip(debuts, wx) if w["debutSec"] is not None])
    return sortie


def heygen() -> dict:
    phrases = []
    toutes = {"heygen": [], "aligneur": [], "aligneurLatenceSeule": [], "whisperxTelQuel": []}
    calculs = []
    accord: list[float] = []
    accord_fins: list[float] = []
    for dossier, p in PHRASES:
        h = lire_json(os.path.join(dossier, f"{p}.heygen.json"))
        son = os.path.join(dossier, f"{p}.mp3")
        audio = calage.lire_son(son)
        t = time.perf_counter()
        final = calage.caler(son, h["texte"], h["mots"])
        calculs.append({"phrase": p, "dureeSonSec": round(len(audio) / 16000, 2), "dureeCalculSec": round(time.perf_counter() - t, 2)})
        seule = calage.caler(son, h["texte"], h["mots"], accrocher=False)
        wx = whisperx_brut(son, h["texte"]) or []
        attaques = attaques_voisees(audio)
        paires = dict((id(a), b) for a, b in correspondance(final["mots"], h["mots"]))
        lignes = []
        for i in apres_pause(h["texte"]):
            am, sm = final["mots"][i], seule["mots"][i]
            hm = paires.get(id(am))
            wm = wx[i] if i < len(wx) and norm(wx[i]["mot"]) == norm(am["mot"]) else None
            if hm is None:
                continue
            milieu = (hm["debutSec"] + am["debutSec"]) / 2
            proche = min(attaques, key=lambda r: abs(r - milieu), default=None)
            if proche is None or abs(proche - milieu) > 0.2:
                continue
            lignes.append({"mot": am["mot"], "reference": proche, "heygen": hm["debutSec"], "aligneur": am["debutSec"],
                           "aligneurLatenceSeule": sm["debutSec"], "whisperxTelQuel": wm.get("debutSec") if wm else None})
        accord.extend(abs(a["debutSec"] - b["debutSec"]) * 1000 for a, b in correspondance(final["mots"], h["mots"]))
        accord_fins.extend(abs(a["finSec"] - b["finSec"]) * 1000 for a, b in correspondance(final["mots"], h["mots"]))
        for ligne in lignes:
            for cle in toutes:
                if ligne.get(cle) is not None:
                    toutes[cle].append((ligne[cle] - ligne["reference"]) * 1000)
        phrases.append({"phrase": p, "texte": h["texte"], "attaquesVoisees": attaques, "mots": lignes,
                        "aligneurTout": final["mots"], "heygenTout": h["mots"]})
    return {
        "reference": "reprise de la voix (passage voisé) après ≥ 60 ms sans voix, pour les mots qui suivent une ponctuation (ou ouvrent la phrase) et commencent par un son voisé",
        **{cle: stats(v) for cle, v in toutes.items()},
        "accordHeygenAligneur": {"debutsMoyenMs": round(st.mean(accord), 1), "debutsMedianMs": round(st.median(accord), 1),
                                 "finsMoyenMs": round(st.mean(accord_fins), 1), "mots": len(accord)},
        "calcul": calculs,
        "phrases": phrases,
    }


def controle_reference() -> dict:
    """La référence « reprise voisée » elle-même, contrôlée sur la fixture (débuts exacts) : son erreur propre."""
    texte = lire_json(os.path.join(RACINE, "tests", "fixtures", "voix-essai.json"))["texteEnvoye"]
    debuts = lire_json(os.path.join(RACINE, "tests", "fixtures", "voix-essai.debuts.json"))
    attaques = attaques_voisees(calage.lire_son(os.path.join(RACINE, "tests", "fixtures", "voix-essai.wav")))
    ecarts = []
    for i in apres_pause(texte):
        proche = min(attaques, key=lambda r: abs(r - debuts[i]["debutSec"]), default=None)
        if proche is not None and abs(proche - debuts[i]["debutSec"]) < 0.1:
            ecarts.append((proche - debuts[i]["debutSec"]) * 1000)
    return {"sur": "fixture voix-essai (mots après ponctuation, début voisé)", **stats(ecarts)}


def main() -> None:
    os.makedirs(SORTIE, exist_ok=True)
    t = time.perf_counter()
    calage.charger_modele()
    chargement = round(time.perf_counter() - t, 2)
    resultat = {
        "date": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "modele": f"wav2vec2 {calage.MODELE} (celui de WhisperX pour le français), processeur seul, "
                  f"{os.environ.get('STUDIO_ALIGNEUR_FILS', '2')} fils",
        "chargementModeleSec": chargement,
        "etalon": etalon(),
        "fixture": fixture(),
        "heygen": heygen(),
        "controleReferenceHeygen": controle_reference(),
        "memoireMaxMo": memoire_mo(),
        "coutAppelsPayants": "0,11 $ en tout, relevés sur le solde (29,83 → 29,72 $) : phrase 6 0,03 $ puis phrases 7 à 9 0,08 $ (POST /v3/voices/speech × 4) ; phrases 1-5 du lot M0b réutilisées",
    }
    with open(os.path.join(SORTIE, "mesures.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(resultat, f, ensure_ascii=False, indent=1)
    fx, hg = resultat["fixture"], resultat["heygen"]
    print(f"Étalon : latence brute médiane {resultat['etalon']['latenceMedianeMs']} ms (constante {resultat['etalon']['constanteRetenueMs']} ms)")
    print(f"Fixture ({fx['aligneur']['mots']} mots) : aligneur {fx['aligneur']['ecartMoyenMs']} ms ; latence seule {fx['aligneurLatenceSeule']['ecartMoyenMs']} ms"
          + (f" ; WhisperX tel quel {fx['whisperxTelQuel']['ecartMoyenMs']} ms" if "whisperxTelQuel" in fx else ""))
    print(f"HeyGen ({hg['aligneur']['mots']} reprises) : HeyGen {hg['heygen'].get('ecartMoyenMs')} ms ; aligneur {hg['aligneur'].get('ecartMoyenMs')} ms ; "
          f"latence seule {hg['aligneurLatenceSeule'].get('ecartMoyenMs')} ms ; WhisperX tel quel {hg['whisperxTelQuel'].get('ecartMoyenMs')} ms")
    print(f"Accord HeyGen ↔ aligneur sur tous les mots : {hg['accordHeygenAligneur']}")
    print(f"Erreur propre de la référence voisée (fixture) : {resultat['controleReferenceHeygen']}")
    print(f"Chargement du modèle {chargement} s ; mémoire max {resultat['memoireMaxMo']} Mo")


if __name__ == "__main__":
    main()
