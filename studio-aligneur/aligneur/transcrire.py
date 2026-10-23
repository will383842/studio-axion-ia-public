"""
Route `/transcrire` (plan facecam v4, lot B) : transcription au mot de TOUTE la prise, avec faster-whisper `small` en
int8 sur le processeur (MIT). Elle sert à repérer les phrases du texte validé, les reprises, le début et la fin à
jeter, et les consignes « Monteur, … » (repérées par le studio, brique `coupes`).

Le glossaire maison (Axion-IA, Certifexemple, OPCO, noms propres…) est donné à Whisper deux fois : dans `initial_prompt`
(il oriente l'orthographe) et dans `hotwords` (il favorise ces mots).

Rapport V6, P0 n° 7 : Whisper NETTOIE la parole (0 « euh » dans la transcription réelle d'IMG_7747), si bien que la
brique `coupes` ne voyait ni les « euh » ni les mots redits. Deux remèdes :
  - l'invite est VERBATIM : elle commence par un exemple de parole avec des « euh » et un mot redit (« je… je »),
    ce qui apprend à Whisper à les écrire (style de l'invite recopié) ;
  - les pauses remplies sont aussi cherchées DANS LE SON (`hesitations.py`) et ajoutées comme mots « euh ». Le texte validé n'est PAS donné à Whisper : il
le « réciterait » et masquerait les reprises. Les horodatages fins viennent ensuite de l'aligneur existant, sur le son
monté (texte validé) : `/alignements`.

Demande : { idTravail, source, depots: { transcription }, parametres: { glossaire?: [str], cles? } }
Résultat : { transcriptionCle, dureeSec, largeurSource, hauteurSource, mots: [{ mot, debutSec, finSec, proba }] } (mots
inline : quelques dizaines de Ko pour une vidéo de 2 min ; le json.gz complet, segments compris, part sur R2). Les
dimensions de la prise après rotation servent au cadrage quand `/visages` échoue (Vérif V2, 10/10).
"""
from __future__ import annotations

import os
from typing import Callable

from .hesitations import avec_pauses_remplies
from .media import ErreurTravail, cle, depot, deposer_json_gz, extraire_son, nettoyer_dossier, parametre, sonder

MODELE_WHISPER = os.environ.get("STUDIO_WHISPER_MODELE", "small")
DOSSIER_MODELES = os.environ.get("STUDIO_WHISPER_DOSSIER", "/app/modeles/whisper")
MOTS_INLINE_MAX = 6000

_modele = None


def charger_whisper():
    """Charge le modèle une fois (téléchargé à la construction de l'image : `--precharger`)."""
    global _modele
    if _modele is None:
        from faster_whisper import WhisperModel

        fils = int(os.environ.get("STUDIO_ALIGNEUR_FILS", "2"))
        _modele = WhisperModel(MODELE_WHISPER, device="cpu", compute_type="int8", cpu_threads=fils, download_root=DOSSIER_MODELES)
    return _modele


# Exemple de parole NON nettoyée (hésitations, mot redit, phrase reprise) : Whisper recopie le style de son invite.
INVITE_VERBATIM = "Euh, alors… je, je voulais vous dire, hum, que… bon, euh, on y va. Le, le point important, euh, c'est ça."


def invite_whisper(glossaire: list[str]) -> tuple[str, str | None]:
    """Invite VERBATIM (hésitations gardées), suivie du glossaire ; `hotwords` = le glossaire."""
    invite, mots_cles = invite_glossaire(glossaire)
    return (f"{INVITE_VERBATIM} {invite}" if invite else INVITE_VERBATIM), mots_cles


def lire_son_16k(chemin: str):
    """Le WAV mono extrait (`extraire_son` : PCM flottant 32 bits ; PCM 16 bits accepté) en float32 ; None si numpy
    manque ou si le fichier est illisible (la détection acoustique est un plus : jamais bloquante)."""
    try:
        import struct

        import numpy as np

        with open(chemin, "rb") as f:
            donnees = f.read()
        if donnees[:4] != b"RIFF" or donnees[8:12] != b"WAVE":
            return None
        pos, fmt, brut = 12, None, None
        while pos + 8 <= len(donnees):
            nom, taille = donnees[pos:pos + 4], struct.unpack("<I", donnees[pos + 4:pos + 8])[0]
            corps = donnees[pos + 8:pos + 8 + taille]
            if nom == b"fmt ":
                code, canaux, _, _, _, bits = struct.unpack("<HHIIHH", corps[:16])
                if code == 0xFFFE and len(corps) >= 26:
                    code = struct.unpack("<H", corps[24:26])[0]  # WAVE_FORMAT_EXTENSIBLE : sous-format
                fmt = (code, canaux, bits)
            elif nom == b"data":
                brut = corps
            pos += 8 + taille + (taille & 1)
        if not fmt or brut is None or fmt[1] != 1:
            return None
        if fmt[0] == 3 and fmt[2] == 32:
            return np.frombuffer(brut[: len(brut) // 4 * 4], dtype="<f4").astype(np.float32)
        if fmt[0] == 1 and fmt[2] == 16:
            return np.frombuffer(brut[: len(brut) // 2 * 2], dtype="<i2").astype(np.float32) / 32768.0
        return None
    except Exception:  # noqa: BLE001
        return None


def invite_glossaire(glossaire: list[str]) -> tuple[str | None, str | None]:
    """`initial_prompt` (phrase naturelle) et `hotwords` (liste) tirés du glossaire, bornés à ~200 caractères."""
    termes: list[str] = []
    for t in glossaire:
        t = str(t).strip()
        if t and t not in termes and sum(len(x) + 2 for x in termes) + len(t) <= 200:
            termes.append(t)
    if not termes:
        return None, None
    return "Vidéo d'Axion-IA. Mots utilisés : " + ", ".join(termes) + ".", " ".join(termes)


def transcrire_fichier(chemin_son: str, glossaire: list[str], progression: Callable[[int], None] | None = None, duree: float = 0.0) -> dict:
    modele = charger_whisper()
    invite, mots_cles = invite_whisper(glossaire)
    options = dict(
        language="fr",
        task="transcribe",
        beam_size=5,
        word_timestamps=True,
        condition_on_previous_text=False,
        # Les longs silences (chaise vide au début) font halluciner Whisper : la détection de voix les écarte.
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500, "speech_pad_ms": 200},
        initial_prompt=invite,
    )
    if mots_cles:
        options["hotwords"] = mots_cles
    try:
        segments, info = modele.transcribe(chemin_son, **options)
    except TypeError:
        # Version de faster-whisper sans `hotwords` : l'invite seule suffit.
        options.pop("hotwords", None)
        segments, info = modele.transcribe(chemin_son, **options)
    mots: list[dict] = []
    sortie_segments: list[dict] = []
    total = duree or float(getattr(info, "duration", 0) or 0)
    for s in segments:
        sortie_segments.append({"debutSec": round(s.start, 3), "finSec": round(s.end, 3), "texte": s.text.strip()})
        for w in s.words or []:
            texte = w.word.strip()
            if not texte:
                continue
            mots.append({"mot": texte, "debutSec": round(float(w.start), 3), "finSec": round(max(float(w.end), float(w.start)), 3), "proba": round(float(w.probability), 3)})
        if progression and total > 0:
            progression(10 + int(85 * min(1.0, s.end / total)))
    # V6 : pauses remplies retrouvées dans le son (Whisper les efface), ajoutées comme mots « euh ».
    son = lire_son_16k(chemin_son)
    ajoutees = 0
    if son is not None:
        mots, ajoutees = avec_pauses_remplies(son, 16000, mots)
    return {"mots": mots, "segments": sortie_segments, "dureeSec": round(total, 3), "langue": getattr(info, "language", "fr"), "hesitationsAcoustiques": ajoutees}


def executer_transcription(demande: dict, dossier: str, progression: Callable[[int], None]) -> dict:
    # La source peut être une piste sonore seule (voix seule d'Image → vidéo) : pas d'image exigée ici.
    sonde = sonder(demande["source"], exiger_image=False)
    if not sonde["son"]:
        raise ErreurTravail("refuse", "La prise n'a pas de son.", False)
    progression(3)
    chemin = extraire_son(demande["source"], os.path.join(dossier, "son-16k.wav"))
    progression(10)
    glossaire = [g for g in (parametre(demande, "glossaire") or []) if isinstance(g, str)][:80]
    resultat = transcrire_fichier(chemin, glossaire, progression, sonde["duree"])
    deposer_json_gz(depot(demande, "transcription"), {"version": 1, "modele": f"faster-whisper:{MODELE_WHISPER}:int8", **resultat}, dossier, "transcription")
    nettoyer_dossier(dossier)
    sortie = {"transcriptionCle": cle(demande, "transcription"), "dureeSec": resultat["dureeSec"] or round(sonde["duree"], 3), "largeurSource": sonde["largeur"], "hauteurSource": sonde["hauteur"], "hesitationsAcoustiques": resultat["hesitationsAcoustiques"]}
    if len(resultat["mots"]) <= MOTS_INLINE_MAX:
        sortie["mots"] = [{k: m[k] for k in ("mot", "debutSec", "finSec")} for m in resultat["mots"]]
    return sortie
