# Contrôle de l'horodatage des mots (moteur avocat, lot M1 — plan B.5)

**But** : vérifier, une fois, que l'horodatage par mot renvoyé par la voix HeyGen (`word_timestamps` de
`POST /v3/voices/speech`) est assez juste pour caler les sous-titres et les coupes. Cible : **écart moyen < 40 ms**.
Seuil de décision : **au-delà de 80 ms**, on construit le conteneur `studio-aligneur` (Python, CPU, 1-2 Go, lot à part) ;
sinon **aucun conteneur Python** n'est construit, et ce dossier ne sert plus.

Tout se fait **sur un poste de développement**, jamais sur le serveur, sans GPU.

## Quand

Au lot **M0b**, dès que `HEYGEN_API_KEY` existe : 5 phrases de la vraie voix de Will (dont « Un bon PV, puis un pépin »,
un montant, un nom propre), produites par la synthèse audio seule de HeyGen.

## Étapes

1. Pour chaque phrase, garder le son (`phrase-N.mp3`) et la réponse HeyGen (`phrase-N.heygen.json` : la liste
   `word_timestamps`, mot / début / fin en secondes).
2. Installer WhisperX une fois (Python 3.10+, environ 2 Go, CPU suffit) :
   ```
   python -m venv .venv-aligneur
   .venv-aligneur\Scripts\pip install whisperx
   ```
3. Alignement forcé sur le texte connu (modèle wav2vec2 français, aucune transcription : on donne le texte) :
   ```
   .venv-aligneur\Scripts\python outils\alignement\aligner.py phrase-1.mp3 "Un bon PV, puis un pépin." > phrase-1.whisperx.json
   ```
4. Comparer (même calcul que le studio, `ecartMoyenMs` de `src/moteurs/montage-avocat/report.ts`) :
   ```
   pnpm exec tsx outils/alignement/comparer.ts phrase-1.heygen.json phrase-1.whisperx.json [phrase-2.heygen.json phrase-2.whisperx.json …]
   ```
   Le script affiche l'écart par phrase, l'écart moyen, et la décision (« horodatage suffisant » ou « construire studio-aligneur »).
5. Noter le résultat dans `docs/MOTEUR-AVOCAT-EXECUTION.md` (rapport du lot M0b ou M1).

## Ce qui a déjà été vérifié (lot M1, 02/10)

Sans clé HeyGen, le chemin complet a été testé sur un **vrai fichier son** fabriqué en local par la voix de synthèse
de Windows (`outils/voix-essai/`, `tests/fixtures/voix-essai.*`) : report des horodatages du texte prononcé sur le
texte validé, nettoyage des blancs par FFmpeg, mots décalés tombant sur la voix (`tests/montage-avocat-son.test.ts`).
Reste à mesurer la justesse propre de HeyGen : c'est l'objet de ce dossier.

## Lot « calage » (D3, 02/10) : le conteneur `studio-aligneur` est construit

Le seuil de 80 ms avait été jugé dépassé au lot M0b (190-270 ms) : `studio-aligneur/` existe désormais
(`deploiement/studio-aligneur/Dockerfile`, service du compose). Ce dossier garde les outils de mesure :

- `fabriquer-etalon.ps1` → `etalon/` : un son de la voix Windows avec les débuts EXACTS des mots, sur un texte à part.
  C'est le SEUL son qui règle quelque chose (la latence du modèle, `LATENCE_MODELE_SEC`, et la fin des mots,
  `FIN_SUPPLEMENT_SEC`, dans `studio-aligneur/aligneur/calage.py`).
- `mesurer_calage.py` → `docs/captures/d3-calage/mesures.json` : étalon, fixture `voix-essai` (tous les mots contre leurs
  débuts exacts), les 5 phrases HeyGen du lot M0b, WhisperX tel quel pour comparaison, temps de calcul, mémoire.
  ```
  python -m venv .venv-aligneur
  .venv-aligneur\Scripts\pip install -r studio-aligneur\requirements.txt psutil
  .venv-aligneur\Scripts\python outils\alignement\mesurer_calage.py
  ```
  (pour la colonne « WhisperX tel quel » : `pip install --no-deps whisperx==3.4.2 transformers pandas nltk`, Python 3.12.)
- `aligner.py` et `comparer.ts` (lot M1) restent, inchangés.

Résultats et lecture : `docs/captures/d3-calage/LISEZ-MOI.md`.
