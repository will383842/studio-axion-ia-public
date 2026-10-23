# Aperçus du style « reference/2 » (gabarit de page clair)

Le style « reference/1 » ne change pas (page blanc cassé `#F7F2E8`, crayon qui écrit, Montserrat ExtraBold, encre, terracotta, vert sauge). « reference/2 » y ajoute **un gabarit de page**, celui de la maquette `maquettes/tableau-gabarit-clair/` (branche `tableau/maquette-gabarit-clair`), avec les corrections demandées après regard :

- texte grand : titre 90 px, phrase clé 72 px, détails 54 px (sur 1080 de large ; 84 / 66 / 50 avant le 14/10) ;
- la page commence en haut et son texte couvre 85 à 90 % de la zone sûre ; une page qui reste courte est centrée ;
- sans points d'étapes ni bandeau, le dessin se met à droite du titre (le haut de la page n'est plus vide) ;
- au changement de page, le titre (et la pastille d'une étape) s'écrit tout de suite ; les points et le dessin après lui ;
- la fin de TikTok et Shorts (« Enregistrez pour la retrouver ») s'écrit en grand dans le même cadre vert que l'appel
  des Reels, au moment où la voix la dit, puis axion-ia.com.

Finitions du 14/10 (regard de Will sur la première vraie vidéo, `v-4fb0bdccdab6`) : `finitions/`, avant / après sur
les vraies images du témoin `tests/tableau/temoins/gabarit-essai-reel-2026-10-14.json` (vraies voix).

Chaque page : repère (points des étapes) ou bandeau « Exemple » ; **titre** court souligné ; sur une étape, la **pastille numérotée**, écrite au moment où la voix dit « Un », « Deux »… ; **phrase clé** ; 1 à 3 **détails** ; un dessin. Page « exemple » : **AVANT / APRÈS** étiquetés. Dernière page : **« À retenir »** (liste numérotée des étapes) puis l'**appel en grand**.

## Fichiers

| Fichier | Contenu |
|---|---|
| `planche-<fiche>-<format>.jpg` | Toutes les pages d'une fiche, dans un format (vertical, portrait, carré, horizontal). |
| `<fiche>-<format>-page-<n>.jpg` | Une page finie, seule. |
| `avant-apres-relances-vertical.jpg` | À gauche, la fiche « relances » en « reference/1 » (avant) ; à droite, la même vidéo au gabarit clair. |
| `animation-etape-6s.mp4` | 6 s de vraie animation : la page « Étape 1 » de « réponses types » ; le crayon trace la pastille quand la voix dit « Un », puis le chiffre, le titre, la phrase clé, le détail. |
| `finitions/avant-<sortie>.jpg`, `finitions/apres-<sortie>.jpg` | Le témoin réel, une image toutes les 2 s (et la dernière), avant et après les finitions. |
| `finitions/pages-finies-avant-apres-<sortie>.jpg` | Les pages finies du témoin réel, avant (en haut) et après (en bas). |
| `finitions/avant-apres.jpg` | Changement de page, page qui se remplit, les deux fins : avant / après. |

Fiches : `reponses-types` (la vidéo de la maquette, 7 pages) et les quatre fiches réelles de production (`relances`, `taches-repetitives`, `habitude-equipe`, `consigne-ia`), réécrites au gabarit avec **le même texte dit, mot pour mot** (`tests/tableau/temoins/fiche-*-reference-2.json`).

Toutes sont calées sur un minutage régulier (0,3 s par mot) : la vraie voix n'a pas été lue.

## Refaire les images

```sh
cd studio-rendu && npm ci && cd ..
npx tsx tests/tableau/reference-2/apercus.mts docs/formats/apercus-reference-2 --formats vertical,portrait,carre,horizontal
npx tsx tests/tableau/gabarit-finitions/images.mts docs/formats/apercus-reference-2/finitions           # toutes les 2 s
npx tsx tests/tableau/gabarit-finitions/images.mts docs/formats/apercus-reference-2/finitions --pages   # pages finies
npx tsx tests/tableau/reference-2/video.mts docs/formats/apercus-reference-2/animation-etape-6s.mp4 reponses-types 6 s02
```
