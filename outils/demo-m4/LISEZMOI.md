# Vidéo de démonstration du lot M4 (preuve du montage réel, sans aucun appel payant)

1. `powershell -File outils/demo-m4/fabriquer-voix-demo.ps1` — voix de synthèse de Windows (Hortense), avec le
   début de chaque mot, comme les horodatages de HeyGen. Le texte envoyé porte les prononciations substituées.
2. `pnpm exec tsx outils/demo-m4/rendre-demo.mts` — le vrai code du studio : report des horodatages, découpage,
   sous-titres (M2), paramètres de composition (M4), puis l'opération `composition` de `studio-rendu` pour 9:16,
   4:5 et 1:1 (Remotion + FFmpeg en local, pas de Docker). Le double est une silhouette SIMULÉE rendue d'abord en
   webm VP9 transparent 1080 × 1920 (même forme de fichier qu'un double HeyGen entraîné avec `matting`).
   Variable utile : `STUDIO_RENDU_CONCURRENCE=2` (pages du navigateur en parallèle).
3. `pnpm exec tsx outils/demo-m4/mesurer-rendu.mts [concurrence]` — où passe le temps de rendu des calques image
   dans le NAVIGATEUR (chemin d'avant le lot M4b, encore utilisé pour le double simulé).
4. Lot M4b : `pnpm exec tsx outils/demo-m4/mesurer-m4b.mts [fils]` — la passe FFmpeg des calques image et l'export,
   rejoués sur les fichiers préparés par la démonstration (durée, mémoire, avec `-benchmark`).
   `DEMO_MESURE=6fils` avec `start /affinity 3F` (Windows) : la démonstration en 9:16 seulement, sur 6 fils, temps
   dans le dossier temporaire (`mesure-6fils.json`), rien n'est écrit dans `docs/`.
   `pnpm exec tsx outils/demo-m4/essai-micro.mts [sortie.png]` : le micro dessiné seul, net et flouté.

Sorties : `docs/captures/m4-demo/` (la vidéo 9:16, les captures, `mesures.json`, `mesures-coeurs.json`) ; la
démonstration du lot M4 est gardée dans `docs/captures/m4-demo/v1/` ; 4:5 et 1:1 dans le dossier temporaire
(`studio-m4-demo`).
