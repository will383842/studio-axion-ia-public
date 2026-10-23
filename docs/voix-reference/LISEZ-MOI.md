# Voix de référence du studio (14/10/2026)

Choix de Will : la voix de la vidéo `on-recrute-en-15-minutes-v4.mp4`, **de la seconde 25 à la seconde 30** (`voix-reference-v4-25-30s.wav`, 48 kHz mono, extrait tel quel).

`comparer-voix.py` est l'outil de mesure d'origine (Python/numpy) : fenêtres de 40 ms pas de 10 ms, parole = énergie > 0,02, hauteur par autocorrélation (70-300 Hz, seuil 0,4), « rythme » = pics de l'enveloppe lissée (5 fenêtres) au-dessus de 0,03 par seconde.

Mesures de la référence : hauteur 152,4 Hz · variation 31,2 Hz · énergie 0,141 · dynamique 0,528 · rythme 5,0 pics/s · parole 77 %.
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
- Tolérances (`TOLERANCES_VOIX`), `VERSION_MESURE_VOIX` et `REFERENCE_V4` (avocat, tableau, cas concret) : inchangées.
- Rejugement : `ecartHorsReference` (`src/moteurs/montage-image-video/secours.ts`) rejuge, contre la nouvelle référence, la prise retenue d'un « non » enregistré dont la mesure est à la version courante (gratuit : aucune lecture, retenue inchangée). Un « oui » enregistré n'est jamais rejugé ; une mesure d'une version plus ancienne garde ses écarts enregistrés. Ainsi « Refaire » sur un refus déjà gardé ne redonne plus le même refus.
- Le fichier .mp3 de la voix n'est pas versionné dans le dépôt (décision en attente de Will).
