# Style « reference/3 » : le gabarit par parties

Regard de Will le 14/10 sur la vidéo `v-f1739d6a4f51` (défilement dans `avant/`) : « ce n'est pas assez clair… le
motion design n'est pas assez précis… on n'a pas dès le début le problème… c'est une douleur et une solution ».

`reference/3` remplace `reference/2` pour les **nouvelles** vidéos (les fiches d'avant gardent leur style). Même page
blanc cassé, même crayon, mêmes couleurs. Ce qui change :

| Défaut vu (avant) | Règle de « reference/3 » |
|---|---|
| « Le problème », « Le vrai problème » | Une étiquette de **partie** constante en haut de chaque page : ACCROCHE, LA DOULEUR (terracotta), LA SOLUTION (vert, « Étape 2 sur 4 »), EXEMPLE (« Exemple illustratif »), À RETENIR, À VOUS (l'appel). Jamais « problème » (règle et contrôle). |
| Accroche à moitié écrite pendant 2 s | L'accroche (la douleur) est **entière, en très grand, centrée, dès la première image** ; le crayon entoure « collé », « contrat client », « ChatGPT » au moment où la voix les dit. |
| Bas des pages vide, texte petit | Le contenu occupe toute la zone sûre, centré optiquement ; titre 100, phrase clé 78, détails 62 px (accroche 112) ; **3 blocs au plus** ; chaque page finie couvre au moins 60 % de la zone sûre (contrôle). |
| Lignes à moitié écrites, page avec seulement « À » | Chaque bloc est **fini au plus tard quand la voix finit de le dire** (heures lues dans la voix) ; l'étiquette et le titre arrivent avec la page ; transition de 300 ms, la même partout. |
| Solution écrite en noir, pas montrée | Visuels : **pastilles de couleur** (✓ vert, ✎ orange, ✕ rouge), **liste cochée** qui se coche au fil de la voix, **« M. Dupont → Client A »** (barré, flèche, écrit à côté). Chaque visuel arrive au mot dit. |
| « Interdire ne sert à rien » barré, confus | Seule une **idée reçue**, étiquetée « Idée reçue », est barrée (règle). |
| Récap immobile 10 s, appel petit et tard | « À retenir » court (liste pâle cochée au fil de la voix), puis une **page d'appel plein cadre** (fond vert, l'appel en grand, axion-ia.com), entière au moins 2,5 s avant la fin (contrôle). |
| Mouvement imprécis | Une seule courbe douce pour tout, traits calés sur les mots dits, crayon sans tremblement, qui ne se pose jamais sur le texte à lire (il sort de la page au repos), léger rebond des pastilles, **barre de progression** des parties en haut. |

Le découpage (consigne version 11) classe chaque phrase dans sa partie ; il suit le champ facultatif `parties` du
générateur de scripts quand il est donné. Bonnes pratiques et sources : `BONNES-PRATIQUES.md`.

## Fichiers

| Fichier | Contenu |
|---|---|
| `avant/defilement-v-f1739d6a4f51.jpg` | La vidéo jugée, une image toutes les 2,5 s. |
| `avant/script-temoin.txt` | Son script complet. |
| `apres/defilement-<sortie>.jpg` | La même vidéo (même texte dit, mot pour mot) en « reference/3 », une image toutes les 2,5 s : vertical, portrait, carré, horizontal. |
| `apres/extrait-0-6s.mp4` | Les 6 premières secondes (accroche entière, mots de la douleur entourés, première transition). |
| `apres/extrait-solution.mp4` | La page « Classez » : pastilles vert / orange / rouge au mot dit. |
| `apres/extrait-fin.mp4` | La fin : exemple, « À retenir », la page d'appel. |

Témoin : `tests/tableau/temoins/fiche-temoin-v-f1739d6a4f51-reference-3.json`, calé sur un minutage réaliste (débit de
la voix réelle, 20,5 caractères par seconde, pauses aux virgules et aux points) : la vraie voix n'a pas été lue.

## Refaire les images

```sh
cd studio-rendu && npm ci && cd ..
npx tsx tests/tableau/reference-3/apercus.mts docs/formats/apercus-reference-3/apres --videos
```

## Gabarit cadré des scripts (15/10)

`gabarit-cadre/defilement-vertical.jpg` : l'exemple validé par Will le 15/10 (« Ce devis collé dans ChatGPT contient
trois données de trop », `../tableau-anime-scripts/exemples-v4/01-formation.md`), découpé comme le fait la consigne
version 12 (fiche de test `tests/tableau/temoins/fiche-gabarit-cadre-reference-3.json`), calé sur une voix posée de
16,5 caractères par seconde (80 s), une image toutes les 2,5 s. Six passages, « Étape x sur 3 », « À retenir » = l'idée
en une phrase. Refaire : `npx tsx tests/tableau/reference-3/apercus.mts --gabarit-cadre --formats vertical`.
