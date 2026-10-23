# CORRECTEUR — D1 (relecture finale 2) — branche `outils/d1` (depuis master 7fd6eab) (04/10/2026)

Source : `docs/controles/RELECTURE-FINALE-2.md` (branche `relectures/finale2`), section D1.
Aucun appel réseau réel (un seul `fetch` doublé), aucune clé, rien n'est effacé. `master` n'est pas touché.

## Le défaut

HeyGen refuse net de répondre (erreur non réessayable) sur un rendu **déjà accepté** : suivi `GET /v3/videos/{id}` en 401, 403, 402, 404 ou autre 4xx, ou téléchargement refusé **après** la fin chez HeyGen (taille non annoncée, vidéo trop lourde, adresse hors liste, stockage non relié).
Avant : la pièce passait en échec **sans** rester comptée (`lignesDouble`), et « Réessayer » la renvoyait avec une clé neuve. L'identifiant de l'ancien rendu était perdu : payé deux fois, compté une fois ou pas du tout.

## La correction

- `src/moteurs/montage-avocat/double.ts`, `catch` d'`avancerDouble` : une erreur non réessayable alors que la pièce est en phase `rendu` (suivi normal ou relecture `reverifier`) **avec** un `idExterne` met la pièce en échec avec le drapeau `suiviRefuse`.
  - L'`idExterne` est gardé.
  - La pièce reste comptée : `lignesDouble` compte `echec` + (`delaiDepasse` **ou** `suiviRefuse`).
  - La raison brute reste dans `detail` (détail technique), jamais à l'écran.
- Nouvelle aide `renduARelire(p)` : échec + `idExterne` + (`delaiDepasse` ou `suiviRefuse`).
- `src/moteurs/montage-avocat/index.ts` :
  - « Réessayer » (`reessayer`) : une pièce `renduARelire` repart en `rendu` + `reverifier`, sans renvoi. Ensuite :
    - fini chez HeyGen → récupéré, sans renvoi ;
    - toujours en cours → rien n'est renvoyé (comme E1, phrase `MESSAGE_DOUBLE_TOUJOURS_EN_COURS`) ;
    - échoué chez HeyGen → seule cette pièce repart, avec une clé neuve, sous le plafond 1,5× cumulé (règle existante).
  - Phrase pour Will (`MESSAGE_DOUBLE_SUIVI_REFUSE`), suivie de la raison simple déjà en français quand elle est connue :
    « HeyGen a refusé de nous répondre sur ce rendu. Il est déjà compté : touchez « Réessayer », il sera relu, jamais renvoyé tant que HeyGen y travaille. Raison : HeyGen refuse la connexion : vérifiez la clé dans Réglages > Connexions. »
    Ni code HTTP, ni anglais (vérifié par le test).
- Les refus **avant** acceptation (phase `envoi`) gardent le comportement d'avant : secondes rendues, rien n'est parti.

## Tests ajoutés (`tests/e2e-verif1-ef-reessayer-redemarrage.test.ts`, bloc E2)

Le réseau doublé gagne trois réglages : `suiviRefus` (code HTTP au suivi), `telechargementsRefuses` (fichier sans taille annoncée) et `echecsCibles` (rendu déclaré échoué, son illisible).

- **(a)** Clé refusée (401) au suivi pendant le rendu, puis « Réessayer » avec une clé valide, alors que HeyGen travaille encore → aucun `POST /v3/videos`, phrase E1. HeyGen finit, puis « Réessayer » → terminé, aucun renvoi, chaque rendu compté une fois.
- **(b)** Téléchargement refusé après la fin chez HeyGen → les rendus restent comptés. « Réessayer » → récupération des anciens rendus, aucun renvoi, comptés une fois.
- **(c)** Refus (403), puis HeyGen déclare **un** passage du second angle échoué → **un seul** renvoi : ce passage, avec la clé `…:e{essai+1}`. Les secondes envoyées n'augmentent que de ce passage, sous le plafond. Les autres pièces gardent leur essai, et chaque pièce est comptée une fois.

## Preuves rouges (code d'avant, tests nouveaux)

| Test | Rouge avec les assertions de phrase | Rouge « argent » seul (copie jetable du test, supprimée) |
|---|---|---|
| (a) | `expected 'Votre double n'a pas pu être rendu :…' to contain` la phrase D1 | `lignesDouble` : `expected [] to have a length of 4 but got +0` (4 rendus acceptés, **0** compté). Sans cette assertion : `expected 8 to be 4` → **4 renvois payants** `POST /v3/videos` au « Réessayer », alors que HeyGen travaille encore. |
| (b) | même rouge de phrase | `expected [] to have a length of 4 but got +0`. Sans cette assertion : `expected 8 to be 4` → **4 renvois** de rendus déjà finis et facturés. |
| (c) | `expected 8 to be 5` | `expected 8 to be 5` : **3 renvois de trop** (attendu : 1 seul). |

Après correction : **19/19 verts** dans le fichier (les 16 d'avant, dont `CORRIGÉ E1`, plus les 3 nouveaux).

## Contrôles

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` (racine) | OK |
| `npx tsc --noEmit` (studio-rendu) | OK |
| `npx eslint .` | OK |
| `npx vitest run` (complet) | **234 fichiers OK (1 ignoré), 2 881 verts, 3 sautés, 0 rouge** (2 878 avant + 3) |
| `npx next build --webpack` | OK |

## Limites

- Si le refus dure (clé jamais réparée), chaque « Réessayer » relit et retombe en échec, avec la même phrase. Rien n'est renvoyé, et le rendu reste compté une fois (`lignesRestantes` retire le doublon, comme pour E1).
- Angle principal échoué chez HeyGen après un refus : son renvoi dépasse en général le plafond 1,5× et il est refusé en phrase simple. C'est la règle existante, inchangée.
