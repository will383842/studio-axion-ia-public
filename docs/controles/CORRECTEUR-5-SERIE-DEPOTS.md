# CORRECTEUR 5 — Écriture en série, vrais envois de fichiers, chiffres honnêtes

Branche `outils/serie-depots`, partie de `d186500` (version en ligne). Sources : audit A (`AUDIT-A-BOUT-EN-BOUT.md`,
B5 et non-bloquants 4.x) et audit B (`AUDIT-B-SCRIPTS-AVATAR.md`, B7).
Aucun appel réseau réel, aucune clé : les tests utilisent un faux seau en mémoire et un faux Claude qui interdit tout
appel. Aucune donnée n'est effacée.

## En bref

| Point | Fait | Test (rouge sur `d186500`, vert ici) |
|---|---|---|
| 1. Écriture en série (B7) | « Écrire ces N idées » depuis Écrire › Idées et depuis l'atelier (« Plusieurs », une idée par ligne) | `tests/c5-serie-ecriture.test.ts` (9) |
| 2. B5 : vrais envois | Bibliothèque, Personnages et assistant envoient vraiment le fichier | `tests/c5-depots-reels.test.ts` (7) |
| 3. Non-bloquants 4.1 à 4.13 | Plus aucun chiffre fictif présenté comme réel | `tests/chiffres-*.test.ts` (4 fichiers) |

## 1. Écriture en série

**À l'écran**
- **Écrire › Idées** : chaque idée encore libre a une case ronde. Dès qu'une case est cochée, la barre du bas devient
  « Écrire ces N idées » (avec « Annuler »).
- **Atelier** : le bouton « Plusieurs » transforme le champ en « une idée par ligne ». Les puces et numéros sont retirés,
  les doublons ignorés, 20 idées au plus.
- **Feuille de confirmation** :
  - « Au plus X € », et en dessous « N idées × prix d'un sujet ». Le prix d'un sujet vient de `prixLancement()`, au taux
    réglé : il n'est jamais écrit en dur. Le bouton « Écrire · au plus … » de l'atelier utilise aussi ce prix calculé, à
    la place de l'ancien « 1,40 € » en dur.
  - Si le budget ne couvre pas tout : « Le budget du mois couvre 4 idées : elles partent (au plus 5,40 €). Les autres
    restent en idée. » Le bouton devient « Écrire 4 idées sur 10 ».
  - Les réglages communs (réseaux, format, qui parle, vous ou tu, but) sont les mêmes tuiles que sur l'écran Sujet.
    Ils sont extraits dans `components/generateur/ReglagesSujet.tsx` et partagés par les deux écrans.
  - En essai, la pastille « Essai » s'affiche avec « Rien n'est payé tant que Claude n'est pas branché ».
- **Suivi** : en haut de l'onglet Idées, « 3 sur 10 écrits » avec une barre d'avancement, mis à jour toutes les 5 s
  tant qu'une écriture tourne. Il affiche aussi « 2 à compléter » ou « 1 en attente de budget ». En dépliant, chaque
  idée mène à son sujet. Une idée reliée affiche la pastille « Sujet ».

**Côté service** (`src/services/serie-ecriture.ts`, actions dans `app/(studio)/ecrire/serie/actions.ts`)
- `planSerie(n)` :
  - Le prix total maximum vaut n × `prixLancement()`.
  - Le nombre d'idées qui partent est le plus petit de trois nombres : les idées demandées, ce que couvre le budget
    restant du mois (`resumeBudget().restant`), ce que couvre la limite Claude du mois (`claude.plafondMensuelUsd` moins
    le consommé et le réservé).
  - Les écritures déjà en cours comptent pour leur reste possible (plafond moins dépensé). Le même argent n'est donc
    jamais promis deux fois.
  - Le calcul pur est `calculerPlanSerie`.
- `lancerSerie` :
  - Un `lancerGeneration` par idée retenue, l'une après l'autre. La boucle de génération les écrit une par une. Rien
    n'est appelé chez Claude pendant la requête.
  - Les étapes de facturation de la boucle (pré-vol, plafonds) restent en place comme seconde garde.
  - Une file empêche deux séries de partir en même temps. La clé du geste empêche qu'un double toucher relance la
    série.
  - Chaque idée est reliée à son sujet (`Idee.scriptMaitreId`).
  - Les idées qui ne partent pas restent des idées. Celles tapées dans l'atelier sont notées dans « Idées » : rien
    n'est perdu.
- `suiviSerie` : l'état réel de chaque écriture (écrit, en écriture, en attente de budget, à compléter).

**Preuve du rouge** : sur `d186500`, le fichier de test échoue au chargement (`Cannot find package
'@/services/serie-ecriture'`). La série n'existait pas.

**Couverture des 9 tests** :
- plan pur : budget limitant, Claude limitant, budget épuisé, essai ;
- prix calculé : il change avec le taux, et le total vaut N × ce prix ;
- Claude branché avec un budget pour 3 idées sur 5 : 3 partent, 2 restent des idées libres, chaque idée est reliée à
  son sujet, aucun appel à Claude, et une nouvelle série ne part plus ;
- limite Claude du mois ;
- double envoi du même geste ;
- la boucle écrit une par une : « 1 sur 3 » après un tour, puis « 3 sur 3 » ;
- découpage « une idée par ligne ».

**Vérifié à l'écran** (serveur de production local, iPhone 13) : feuille « Écrire ces 3 idées · Au plus 4,05 € · 3
idées × 1,35 € », puis suivi, puis sélection « Écrire ces 2 idées ». Après cette capture, j'ai corrigé un défaut : la
coche verte s'affichait sur « 0 sur 3 écrit » quand les idées étaient à compléter.

## 2. B5 : les fichiers ajoutés partent vraiment

Avant, `deposerFichierSimule` n'enregistrait qu'une fiche (nom, type, taille). R2 la refusait, et le fichier restait
inutilisable.

Les ajouts suivants passent maintenant par le même chemin que ZoneDepot, Mes images et Tournage
(`envoyerFichier` → `/api/depots` → `services/envois.ts`) :
- Bibliothèque : élément avec fichier, illustrations, rushs, preuve de licence ;
- Personnages : vidéos du visage, voix enregistrée ou importée, document d'accord ;
- assistant « Nouvelle vidéo » : captures et entrées, rushs.

Changements :
- Le navigateur envoie d'abord, avec la nouvelle aide `envoyerFichiers` (`lib/envoi-multipart.ts`). L'action ne reçoit
  ensuite que `{ fichierId }`.
- Le serveur contrôle chaque fichier avec `fichierEnvoye` (`services/fichiers.ts`) : il doit exister, venir d'un envoi,
  être « prêt » (octets arrivés) et avoir la bonne destination (type et, pour un personnage, son identifiant). Une
  simple fiche est refusée : « Ce fichier n'est pas arrivé. Envoyez-le à nouveau. »
- Un envoi raté affiche une phrase simple. Le message « Essai » ne s'affiche que si le studio n'a pas encore de
  stockage relié.
- Le type de destination `entree` (assistant) est ajouté aux destinations acceptées par `/api/depots`.
- La LUT gardait déjà le vrai chemin. Seul son secours en essai (sans octets, refusé en réel) garde l'ancien dépôt.

**Preuve du rouge** : sur `d186500`, les 7 tests échouent. Après correction, les 7 passent. Le faux seau R2 est en
mémoire, avec envoi par morceaux. Les tests vérifient :
- les octets sont identiques dans le seau ;
- l'élément, le visage, la voix ou l'accord pointe sur le fichier envoyé ;
- aucun fichier « fantôme » n'est créé ;
- une fiche sans octets, un fichier « en attente » ou un fichier envoyé pour un autre personnage est refusé.

## 3. Non-bloquants de l'audit A

Commits `43a6475` à `6efb18f`, fusionnés dans cette branche.

| Point | Correction | Échec avant |
|---|---|---|
| 4.1 | Budget « Par mois » et « Par poste » : le payé seulement (`montantPaye`), au mois de Paris. Le mois en cours concorde avec la jauge. Une dépense sans détail compte dans « Autres ». | `expected 1004 to be 300` ; mois UTC au lieu de Paris |
| 4.2 | « Annoncé / réel » : un travail dont une partie du réel est simulée n'est plus comparé. Une vidéo entièrement simulée n'a rien à comparer. | `estime: - 380 / + 860` |
| 4.3 | Note de la vidéo (montage réel) : seulement la note globale et les alertes, libellée « Estimation ». Les sous-notes inventées (lèvres, son, sous-titres, réalisme) ne sont plus produites ni affichées. Celles des anciennes vidéos restent en base. | sous-notes présentes ; pas de « Estimation » |
| 4.4 | Note du script /100 : « Note estimée » (fiche script, atelier, blocs). | libellé absent |
| 4.5 | Dépenses d'exemple exclues de la jauge, de « Par mois », de « Par poste », de « Par outil » et du coût moyen. | `expected 580 to be 80` |
| 4.10 | Jauge des crédits : ton neutre (gris) quand le solde est inconnu. Un seul mot change dans `services/credits.ts`. | `expected 'vert' to be 'neutre'` |
| 4.11 | Taille réelle des fichiers produits (`Sortie.taille`), 0 si inconnue, jamais 1 Mo inventé. | `expected 1000000 to be 52000000` |
| 4.12 | Frise « Sous-titres » rattachée à la vraie composition (`ETAPES_REELLES`) en montage réel, coût nul. | étape planifiée à l'horloge |
| 4.13 | Estimation du montage réel : les prix d'essai des étapes faites sur notre serveur sont retirés (sous-titres, étalonnage, mixage, habillage, export). En essai, l'estimation est inchangée. | 5 lignes d'essai présentes |

**À valider par Will (4.5)** : une dépense marquée « exemple » n'est retirée que si aucun travail ne lui est associé
(dépense semée au démarrage). Une dépense écrite par une vraie fabrication compte toujours, même sur une vidéo
d'exemple : un vrai paiement ne doit jamais disparaître du budget.

Un test existant a changé d'attente : `e2e2-argent-simule-et-pannes.test.ts`, écart du travail `t1` (en partie simulé)
maintenant `null`, avec un commentaire.

## Fichiers partagés avec d'autres correcteurs

- `services/credits.ts` : un seul mot (4.10).
- `components/ecrire/OngletIdees.tsx` : quelques lignes ajoutées :
  - la case à cocher ;
  - la pastille « Sujet » ;
  - le suivi ;
  - la barre de série, dans un nouveau fichier `SerieIdees.tsx`.

  L'icône « En faire une vidéo » n'est pas touchée.
- `fabrication*`, `decors`, `fal`, `heygen`, `ZoneColler`, `scripts.ts` : non touchés.

## Contrôles (sur la branche fusionnée)

- `npx tsc --noEmit` : 0 erreur (après `npm ci --ignore-scripts` dans `studio-rendu/`, dont les dépendances
  `@remotion/*` manquaient dans le conteneur ; rien de ce côté n'est commité).
- `npx eslint .` : 0 erreur, 0 avertissement.
- `npx vitest run` complet : 182 fichiers passés, 1 ignoré ; **2448 tests passés**, 2 ignorés, 0 échec.
- `npx next build --webpack` : compilation réussie.
