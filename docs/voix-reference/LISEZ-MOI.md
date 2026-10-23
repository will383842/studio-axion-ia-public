# Voix de référence du studio (14/10/2026)

Choix de Will : la voix de la vidéo `on-recrute-en-15-minutes-v4.mp4`, **de la seconde 25 à la seconde 30** (`voix-reference-v4-25-30s.wav`, 48 kHz mono, extrait tel quel).

`comparer-voix.py` est l'outil de mesure d'origine (Python/numpy) : fenêtres de 40 ms pas de 10 ms, parole = énergie > 0,02, hauteur par autocorrélation (70-300 Hz, seuil 0,4), « rythme » = pics de l'enveloppe lissée (5 fenêtres) au-dessus de 0,03 par seconde.

Mesures de la référence D'ORIGINE (ANCIENNE voix, archivée depuis le 23/10/2026 : `REFERENCE_ANCIENNE_VOIX_V4` ; la référence courante est dans la section « Nouvelle voix 23/10/2026 (toutes les vidéos) » en bas) : hauteur 152,4 Hz · variation 31,2 Hz · énergie 0,141 · dynamique 0,528 · rythme 5,0 pics/s · parole 77 %.
Tolérances provisoires (écart relatif) : hauteur 8 % · variation 25 % · énergie 20 % · dynamique 20 % · rythme 12 % · parole 12 %, à régler à l'oreille avec Will.

Premiers constats : v3 et v10 ressemblantes ; essai du 14/10 hors tolérance (hauteur +9 %, variation +22 %).

## Mesure version 2 (15/10)

Essai réel v-dd3049053f88 : la fin courte (~3 s, « Et chez vous, qui répond aux clients qui écrivent la nuit ? ») était refusée en Q16 pour « part de parole −14 % (toléré 12 %) ». Cause : la part de parole se comptait sur TOUT le fichier, blancs de début et de fin ajoutés par HeyGen compris, alors que la référence est coupée en pleine phrase. Sur 3 s, 0,3-0,4 s de blanc aux bords suffisaient à perdre plus de 12 %.

Depuis la version 2, la part de parole se compte **entre la première et la dernière fenêtre de parole** (`comparer-voix.py` et `studio-rendu/src/audio/voix.ts`, même calcul). Les cinq autres mesures sont inchangées. La référence ne bouge pas : **0,7702** avec l'ancienne comme avec la nouvelle méthode (l'extrait commence et finit en parole), donc `REFERENCE_V4.partieParole` reste 0,77. Sans aucune fenêtre de parole, la part de parole est illisible (NaN).

`studio-rendu` rapporte `voix.versionMesure: 2`. Une prise déjà payée mesurée avant (sans version) est re-mesurée gratuitement à la reprise (« Refaire cette partie »), jamais relue chez HeyGen.

## Contrôle de ressemblance : budget de lectures (décision de Will, 14/10)

Chaque lecture payée est mesurée et comparée à la référence. Le budget d'essais est serré : par défaut le contrôle relance **une seule fois** (réglage `voix.ressemblance`, `relancesMax` = 1) soit **2 lectures au plus** par texte. Le réglage peut aller de 0 à 2 relances ; à 2, il y a 3 lectures au plus.
Le prix annoncé est toujours le maximum de lectures : une voix de tableau à 0,36 € la lecture est annoncée **0,72 € au plus** (1,08 € si le réglage est à 2 relances, 0,36 € si le contrôle est coupé).
Une commande déjà lancée garde son réglage figé ; une commande d'avant ce contrôle (sans champ) garde le contrôle coupé.

## Référence d'Image → vidéo : 158,4 Hz (décision de Will, 20/10/2026)

« Oui, 158 Hz » : pour **Image → vidéo SEULEMENT**, la hauteur de référence de la voix passe de 152,4 Hz (extrait 25-30 s de la v4, le bas de sa voix) à **158,4 Hz** (la v4 ENTIÈRE, mesurée). La tolérance reste **8 %** et les cinq autres mesures restent celles de `REFERENCE_V4`. Constante : `REFERENCE_V4_IV` (`src/domaine/image-video/reference-voix.ts`), passée par `outilsVoixCasConcretIV` (option `reference` de la voix maître). Avocat, tableau et cas concret gardent 152,4 Hz (`REFERENCE_V4`, inchangée). Aucune empreinte, aucune version (`VERSION_VOIX`, `VERSION_MESURE_VOIX`) ni tolérance ne change ; la hauteur d'une fin reste jugée par rapport au corps. Un verdict déjà rendu n'est pas recalculé tout seul : seule une lecture neuve ou une re-mesure applique la nouvelle référence (exception depuis le 23/10/2026 : voir la section « Nouvelle voix 23/10/2026 » ci-dessous, le corps d'Image → vidéo est rejugé sur sa mesure gardée).

## Nouvelle voix 23/10/2026 (Image → vidéo seulement)

Décision de Will, 23/10/2026 : « cette voix me convient ». L'ancienne voix n'existe plus chez HeyGen (voix épinglée DJI_44_20261021_204103) ; la v-6e4a06b9c718 était refusée contre l'ancienne référence (hauteur +19 %, variation +35 %).

- `REFERENCE_V4_IV` (`src/domaine/image-video/reference-voix.ts`) devient un littéral figé : hauteur 188,2 Hz, variation 42,3 Hz, énergie 0,133, dynamique 0,525, rythme 5,03 pics/s, part de parole 0,70. Source : prise 2 (retenue) de v-6e4a06b9c718, mesure « video-finie » v3 (188,235 / 42,274 / 0,13313 / 0,52493 / 5,02898 / 0,70003). La prise 1 (192,77 / 41,75 / 0,13292 / 0,52929 / 4,83368 / 0,704) passe aussi (écarts +2,4 / −1,3 / 0 / +0,8 / −3,9 / +0,6 %).
- Tolérances (`TOLERANCES_VOIX`) et `VERSION_MESURE_VOIX` : inchangées. `REFERENCE_V4` (avocat, tableau, cas concret) : voir la section suivante.
- Rejugement : `ecartHorsReference` (`src/moteurs/montage-image-video/secours.ts`) rejuge, contre la nouvelle référence, la prise retenue d'un « non » enregistré dont la mesure est à la version courante (gratuit : aucune lecture, retenue inchangée). Un « oui » enregistré n'est jamais rejugé ; une mesure d'une version plus ancienne garde ses écarts enregistrés. Ainsi « Refaire » sur un refus déjà gardé ne redonne plus le même refus.
- Le fichier .mp3 de la voix n'est pas versionné dans le dépôt (décision en attente de Will).

## Nouvelle voix 23/10/2026 (toutes les vidéos : avocat, tableau, cas concret)

Autorisation explicite de Will, 23/10/2026 (« cette voix me convient ») : `REFERENCE_V4` (`src/briques/voix-maitre/reference.ts`) passe de l'ancienne voix à la NOUVELLE voix HeyGen `b22b1a358ca740eda753772ebaaf11f7` (en code depuis #593).

- Valeurs (mesure BRUTE, non arrondie) : hauteur 188,23529 Hz · variation 41,20256 Hz · énergie 0,09306 · dynamique 0,59929 · rythme 4,77686 pics/s · part de parole 0,61973.
- Source : prise 2 d'Image → vidéo (v-6e4a06b9c718), mesure brute (sans traitement « video-finie », comme l'avocat, le tableau et le cas concret), durée 75,36 s. La valeur « video-finie » de la même prise est `REFERENCE_V4_IV` (Image → vidéo seulement) : l'énergie (0,093 contre 0,133) et la part de parole (0,62 contre 0,70) diffèrent selon le mode de mesure, pas la hauteur (188,2 Hz dans les deux).
- L'ancienne référence est archivée dans `REFERENCE_ANCIENNE_VOIX_V4` (152,4 / 31,2 / 0,141 / 0,528 / 5,0 / 0,77), utilisée seulement par le test du WAV de l'ancienne voix (`voix-reference-v4-25-30s.wav`).
- `REFERENCE_V4_IV` (Image → vidéo) reste un littéral explicite (valeurs arrondies, inchangées) : elle n'étale pas `REFERENCE_V4`.
- Tolérances (`TOLERANCES_VOIX`) et `VERSION_MESURE_VOIX` : INCHANGÉES, aucun seuil assoupli. Aucun .mp3 ajouté.
- Effet : un verdict déjà rendu n'est pas recalculé tout seul ; une lecture neuve ou une re-mesure est jugée contre la nouvelle référence.
- Rythme du tableau : la référence de rythme baisse de 5,0 à 4,77686 pics/s (−4,5 %). Une voix de tableau mesurée à R pics/s est jugée à R / 4,77686 − 1 (au lieu de R / 5,0 − 1) ; tolérance 12 % inchangée. Une mesure réelle d'une voix de tableau à vitesse 1,0 reste à faire (non mesurée dans ce lot).
