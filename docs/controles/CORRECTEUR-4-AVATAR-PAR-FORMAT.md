# Correcteur 4 — Un avatar par format

Branche `outils/avatar-par-format`, partie de `origin/master` (`d186500`, version en ligne).
Sources : audit B, section 3 (plan 3.4), et audit A, point **B4** (voix d'essai).

## Comment Will s'en sert (pas à pas)

1. Ouvrez **Personnages**, puis votre fiche, onglet **« Visages »**.
2. **Choisir le visage habituel.** Touchez un visage, puis **« Visage par défaut »**.
   - Une petite étoile orange le marque dans la grille.
   - C'est le visage pris quand un format n'a pas d'avatar à lui.
3. **Donner un avatar à un format.** Dans le bloc **« Par format »** (il apparaît dès que deux visages sont prêts) :
   - touchez le format, par exemple « Vidéo type avocat » ;
   - choisissez la photo de l'avatar voulu ;
   - **« Habituel »** revient au visage par défaut.
4. **Créez une vidéo de ce format.** L'avatar choisi est déjà en place, sans rien régler.
   - Le second angle est celui du **même avatar** (même tenue). Il ne se mélange jamais avec un autre avatar.
5. **Pour une seule vidéo**, changez l'avatar dans le bloc **« Plateau »** (Qui parle, Tenues). Le réglage du format reste.
6. **Avant d'allumer le montage réel** (Réglages › Connexions › Montage), le prix de la vidéo de 45 s suit l'avatar du format :
   - deux angles si cet avatar en a deux ;
   - un seul angle sinon.
7. Si la voix de votre fiche est encore une voix d'essai, le montage réel refuse de partir avec ce message :
   **« Reliez d'abord votre voix HeyGen dans Personnages. »**
   Pour régler cela : ouvrez l'onglet **« Voix »**, puis **« Relier ma voix HeyGen »**.

## Ce qui a été fait (points 1 à 8 validés par Will)

| # | Quoi | Où |
|---|------|----|
| 1 | `visageParFormat?: Record<string, Id>` sur `Personnage` (ajout pur) | `src/domaine/types.ts` |
| 2 | `visagePourFormat(visages, personnage, formatId, choixVideo?)` : choix de la vidéo > visage du format > visage par défaut > premier prêt. Le second angle passe ensuite par `resoudreVisagesParAngle` (même tenue, même posture), donc il reste celui du même avatar. Ajout de `anglePrincipalDe` et `visagePrincipalResolu`. | `src/domaine/distribution.ts` |
| 3 | Services `choisirVisagePourFormat`, `choisirVisageParDefaut` (visage du personnage et prêt, sinon refus clair) ; actions `choisirVisagePourFormatAction`, `choisirVisageParDefautAction` | `src/services/personnages.ts`, `src/app/(studio)/personnages/actions.ts` |
| 4 | Écran : section « Par format » (vignettes, feuille avec photos), étoile du visage par défaut, bouton « Visage par défaut » dans la fiche d'un visage | `src/components/personnages/OngletVisages.tsx` |
| 5 | Les 5 appels qui ignoraient le format passent par `visagePourFormat` : `nouvelle/[format]/page.tsx`, `assistant/etapes/Distribution.tsx` (choix du personnage), `services/videos.ts`, `services/fabrication-reseaux.ts` (1 ligne), `services/fabrication.ts` (1 ligne). `visagePour` garde le visage actuel, ou à défaut un visage du même fournisseur, à l'angle principal de la recette : changer de tenue ou de posture ne bascule plus sur l'autre avatar (Plateau et « Décrivez »). | voir colonne Quoi, + `assistant/express/logique.ts`, `FeuillePlateau.tsx` |
| 6 | Angle principal lu dans la recette (`recetteMontage.angles.principal`), plus « trois-quarts » en dur | `src/moteurs/montage-avocat/index.ts` (découpage), `src/briques/index.ts` (prix du double) |
| 7 | Garde B4 : un montage **vraiment réel** refuse une voix absente ou d'essai, au lancement (`refusAuLancement`, avant toute réservation) et dans `lancer`. Ce contrôle passe après celui du double. Le refus est écrit par la fonction pure `refusVoixEssai`. | `src/moteurs/montage-avocat/index.ts` |
| 8 | Prix 45 s avant d'allumer : il prend l'avatar **du format** de Will et son second angle (même règle que la vidéo), au lieu de « deux avatars prêts n'importe où ». Le prix de lancement passe par la même résolution (création du brouillon, estimation des versions). | `src/services/reglages.ts` (`partSecondAnglePrix`) |

**Fichiers partagés avec les autres correcteurs** : changements minimaux.
- `fabrication.ts` et `fabrication-reseaux.ts` : 1 import et 1 ligne chacun, seulement l'appel qui choisit le visage.
- `credits.ts` : non touché.

**Données JSON** : aucune migration.
- Un ancien personnage sans `visageParFormat` garde exactement le comportement d'avant. Un test le vérifie : `visagePourFormat` donne le même résultat que `visageParDefaut`.

## Tests

- `tests/c4-avatar-par-format.test.ts` (13 tests) couvre :
  - le domaine : ordre de choix, anciens personnages, second angle du même avatar, angle de la recette ;
  - `visagePour` ;
  - les services ;
  - le parcours fiche › nouvelle vidéo › fabrication ;
  - la brique « visage » ;
  - la garde B4 en pur.
- `tests/c4-avatar-prix-reel.test.ts` (5 tests) reprend le réseau doublé de `r8-correctifs` : aucun appel réel, aucune clé. Il couvre :
  - le prix de 45 s ;
  - le prix de lancement ;
  - la garde B4 au lancement (rien n'est réservé ni payé).

**Preuve du rouge.** Les sources ont été remises à `origin/master` (`git stash -- src`) et les nouveaux tests lancés. Résultat : **14 échecs, tous les tests marqués « ROUGE »**. Les 4 tests restants passent : ils décrivent le comportement d'avant, qui doit rester.

```
× ROUGE — avatar du format sans second angle (costume seul) : pas de ligne de second angle…
× ROUGE — le prix de lancement d'une nouvelle vidéo avocat suit le même avatar (un angle, costume)
× ROUGE — voix d'essai : refus clair au lancement, rien n'est réservé ni payé
× ROUGE — choix de la vidéo > visage du format > visage par défaut > premier prêt
× ROUGE — ancien personnage sans visageParFormat : exactement le comportement d'avant (visageParDefaut)
× ROUGE — le second angle reste celui du MÊME avatar (même tenue), jamais l'autre
× ROUGE — angle principal lu dans la recette ; « trois-quarts » seulement à défaut
× ROUGE — même tenue chez deux avatars : le visage actuel (ou son fournisseur) est gardé…
× ROUGE — une action ; visage d'un autre personnage, pas prêt ou format inconnu : refusé…
× ROUGE — « Visage par défaut » : écrit visageParDefautId, refuse un visage étranger ou pas prêt
× ROUGE — nouvelle vidéo avocat : l'avatar du format est pris d'office…
× ROUGE — fabrication d'une distribution sans visage : l'avatar du format et SON second angle (même tenue)
× ROUGE — recette « face » d'abord : le prix suit l'avatar de face, pas celui de trois quarts
× ROUGE — voix absente ou d'essai : « Reliez d'abord votre voix HeyGen dans Personnages. »
Tests  14 failed | 4 passed (18)
```

**Anciens tests ajustés (données seulement, aucun test retiré ni désactivé).** Trois tests lançaient un montage réel avec la voix d'essai de la démo. La garde B4 refuse désormais ce cas, à juste titre. Chacun reçoit donc une voix HeyGen, doublée et sans appel réel, pour atteindre le refus qu'il vérifie :
- `montage-avocat.contrat.test.ts` (stockage non relié) ;
- `r7e-avatar-parle.test.ts` (confirmation, budget) ;
- `r7-double-heygen.test.ts`. Ici, l'assertion « aucun refus » vérifie aussi que la voix d'essai donne bien le refus B4.

## Contrôles

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` (racine) | OK |
| `npx tsc --noEmit` (`studio-rendu`) | OK |
| `npx eslint .` | OK |
| `npx vitest run` (complet) | 178 fichiers OK, 1 ignoré ; 2433 tests OK, 2 ignorés (dont `tests/garde-ecran.test.ts` vert) |
| `npx next build --webpack` | OK |

## Reste à faire (hors de ce lot)

- **Recette à la main** (plan 3.4, point 7) sur Avocat, avec un modèle et en mode rapide, sur le studio en ligne.
- **Données (B4).** Dans Personnages › Williams › Voix, relier la voix HeyGen clonée. Sans cela, la nouvelle garde refuse le montage réel, avec le message prévu.
