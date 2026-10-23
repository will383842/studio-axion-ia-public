"""
Alignement forcé d'un son sur un texte CONNU, avec WhisperX (modèle wav2vec2 français), sur le CPU d'un poste de
développement. Sert UNIQUEMENT au contrôle ponctuel de l'horodatage HeyGen (plan B.5) : voir README.md.

Usage : python outils/alignement/aligner.py <son> "<texte exact prononcé>"  > sortie.json
Sortie : [{"mot": "...", "debutSec": 0.12, "finSec": 0.40}, ...] (même forme que le studio, MotHorodate).
"""
import json
import sys

import whisperx  # pip install whisperx (≈ 2 Go, CPU suffit)


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit("Usage : aligner.py <son> \"<texte>\"")
    son, texte = sys.argv[1], sys.argv[2]
    audio = whisperx.load_audio(son)
    duree = len(audio) / 16000
    modele, meta = whisperx.load_align_model(language_code="fr", device="cpu")
    # Un seul segment couvrant tout le son, avec le texte connu : aucune transcription, seulement l'alignement.
    resultat = whisperx.align([{"start": 0.0, "end": duree, "text": texte}], modele, meta, audio, device="cpu", return_char_alignments=False)
    mots = [
        {"mot": m["word"], "debutSec": round(m["start"], 3), "finSec": round(m["end"], 3)}
        for m in resultat["word_segments"]
        if "start" in m and "end" in m
    ]
    json.dump(mots, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
