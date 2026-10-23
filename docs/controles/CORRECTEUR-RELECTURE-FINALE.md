# CORRECTEUR — RELECTURE FINALE (04/10/2026)

Branche `outils/final2`, partie de `origin/outils/final` (8e6cbaa). Source : `docs/controles/RELECTURE-FINALE.md` (branche `relectures/finale`), lue en entier.
Règles tenues : chaque défaut a d'abord un test rouge ; aucune dépense sans prix et accord ; rien n'est effacé ; **aucun appel réseau réel, aucune clé** (tous les tests passent par des doubles).

## Ce qui est corrigé

### E1 — HeyGen : « Réessayer » sur un rendu encore « en cours » (bloquant)
- **Avant** : après 6 h, « Réessayer » relisait l'ancien rendu. S'il était toujours en cours, la pièce repartait en envoi avec une clé neuve. L'identifiant de l'ancien rendu était perdu, et ce rendu n'était plus compté. Il pouvait donc être payé deux fois et compté une seule.
- **Maintenant** (`src/moteurs/montage-avocat/double.ts`) : tant que HeyGen n'a ni fini ni échoué, **rien n'est renvoyé**. La pièce reste en échec, avec son identifiant (`idExterne`), et reste comptée dans `lignesDouble` (`delaiDepasse`).
  - Au « Réessayer » suivant, l'ancien rendu est relu.
  - S'il est fini, il est repris sans nouvel envoi.
  - S'il a échoué chez HeyGen, seule cette pièce repart, avec une clé neuve et le plafond 1,5× toujours appliqué.
- **Ce que lit Will** :
  - nouvelle phrase quand le rendu est toujours en cours : « HeyGen travaille encore sur votre double. Il est déjà payé et compté : rien n'est renvoyé tant qu'il n'est pas fini. Touchez « Réessayer » plus tard. » ;
  - la phrase des 6 h ne promet plus « ne sera pas repayé » : elle dit que le rendu est relu d'abord et jamais renvoyé tant que HeyGen y travaille.
- **Test** : `e2e-verif1-ef-reessayer-redemarrage` › « CORRIGÉ E1 ».
  - Scénario : deux « Réessayer » pendant que HeyGen bloque, puis fin chez HeyGen.
  - Vérifié : aucun nouvel envoi, les identifiants sont gardés, chaque rendu est compté une fois dans les dépenses, et la vidéo est terminée sans renvoi.
  - Rouge avant la correction : un 5e envoi payant partait (attendu 4).

### G1 — « Reprendre l'écriture » relevait le plafond sans prix
- `ecritureArretee` renvoie le **supplément possible**, en euros : c'est le pire cas des appels restés sans réponse. Le bouton l'affiche : « Reprendre l'écriture (jusqu'à X de plus) ».
- `reprendreEcritureArretee(id, accord)` refuse avec `CONFIRMATION_REQUISE` et ce montant tant que l'accord ne le couvre pas. L'écran passe par la feuille « Confirmer ce prix » (`avecConfirmationPrix`), dans `EcritureEnCours` et dans `CartePanneAjout`.
- **Un seul relèvement par accord** :
  - `releverPlafondApresPannes(id, maxUsd)` ne relève jamais plus que ce que Will a vu ;
  - si le montant est plus haut au moment d'écrire, rien n'est relevé et le nouveau prix est redemandé ;
  - les appels relevés sont notés : un nouveau cycle « panne puis reprise » redemande l'accord.
- **Sans supplément** (aucun appel sans réponse) : la reprise reste un simple toucher, sans nouvelle dépense possible au-delà de l'accord du lancement.
- **Tests** :
  - `e2e-verif1-bc-serie` › « CORRIGÉ G1 » : sans accord, refus ; accord trop bas, refus ; bon accord, un relèvement ; double toucher, rien de plus ;
  - `relecture-finale-petits` : les écrans.

### G2 — Marque « Réécrire ce texte »
- La durée de la marque vaut maintenant `ESSAIS_TEXTE_PUBLICATION × DELAI_TOTAL_MS + 2 min`, soit 12 min (avant : 5 min).
- Un jeton propriétaire est enregistré (`reecrituresJetons`). `libererReecriture` ne lève la marque que si elle est encore la sienne.
- **Test** : `e2e-verif2-limites` › « CORRIGÉ G2 ». Une marque de 5 min 30 bloque toujours. La marque d'une autre réécriture n'est pas levée par la fin d'un appel plus ancien.

### G3 — Feuille « Fabriquer » d'une vidéo d'essai
- Dans `partPayee`, quand le moteur décidé est l'essai, aucune voix n'est comptée comme payée : le moteur `simulation` n'en appelle aucune.
- La feuille affiche donc la pastille Essai et « Essai : rien ne sera payé. », et le total du jour ne bouge pas.
- **Test** : `e2e-verif1-a1-eteints` › « CORRIGÉ G3 ».
- **Test ajusté** : `e2e2-argent-simule-et-pannes` (« voix payée, double simulé ») allume maintenant un vrai moteur, seul cas où la voix est réellement payée.

### S1 et S2 — Temps quadratiques de l'import
- **S1** (`recollerLignesPdf`) : seule la fin de la ligne en cours décide, et les morceaux ne sont joints qu'une fois.
  - C'est le même résultat qu'avant : le dernier morceau ajouté commence par une minuscule, donc rien avant lui ne peut finir une phrase.
  - Nouvelle borne : un texte brut de plus de 2 × 200 000 caractères est refusé « trop long » avant tout traitement (`TEXTE_BRUT_MAX_CARACTERES`).
- **S2** (`ouvrantsAvecLaSuite`) : l'expression qui revenait en arrière est remplacée par `ouvrantsEnFin`, une lecture unique de la suite finale de guillemets et d'espaces. Le résultat est le même.
- **Tests** (`tests/relecture-finale-import-lineaire.test.ts`) :
  - équivalence avec l'ancien code sur 3 000 textes au hasard (S1) et 20 000 morceaux au hasard (S2) ;
  - temps : 200 000 lignes, et 200 000 espaces insécables, doivent passer en moins d'1 s. Avant la correction : **36,5 s et 15,9 s** (rouges).

### Petits défauts
- **« Fabriquer les N »** : la feuille passe le format des versions (`formatIds`) au résumé de dépense.
- **`briqueVisage`** : le moteur est lu par `idMoteurDeCommande`, déplacé dans `src/moteurs/ids.ts` pour éviter un cycle d'imports. Une commande sans moteur, ou avec un moteur inconnu, n'annonce aucun prix HeyGen (test `c4-avatar-par-format`, rouge avant).
- **Finition** :
  - les suites sont notées **sur le travail** (`finitionAFaire`), dans la même écriture que « terminé » ;
  - chaque suite faite est retirée, et seules les suites ratées sont rejouées : le relevé de débit de la mère n'est plus compté deux fois ;
  - les anciennes notes (paramètres `fabrication.finitionAFaire.*`) sont encore reprises.
  - Deux tests (rouges avant) dans `e2e-verif1-ef-reessayer-redemarrage`.
- **Épisodes de série** :
  - `attribuerNumero(id, { episode: false })` au lancement : l'épisode est pris à la **première étape vraiment payée** (`prendreEpisode`) ;
  - une écriture d'essai ou une écriture en attente de crédit n'en consomme donc aucun ;
  - le numéro du sujet, lui, ne change pas de règle.
  - Nouveau test « essai » dans `paquet4-jonctions` (rouge avant).
  - Deux tests de `e2e-verif1-bc-serie` déroulent maintenant l'écriture avant de lire les épisodes (toujours 1, 2…).
  - Le test de jonction des épisodes joue directement la première étape payée. Le parcours complet est couvert par `e2e-verif1-bc-serie`.

## Non traité (hors de la demande, ou à trancher)
- **Accord donné sur un écran « Essai »** alors que les interrupteurs sont allumés dans un autre onglet.
- **Clé fal.ai** `-t${tentatives}`.
- **Écart voix** entre le texte écrit et le texte dit.
- **Sécurité P1 à P4** : `umask` des copies de base, regex `.docx` dans l'enfant, garde-fou des copies studio-rendu, `phraseLisible`.
- **G1, plusieurs instances** : le verrou reste en mémoire. Avec deux instances web, un même accord pourrait relever deux fois, mais jamais au-delà du montant accepté pour chaque appel noté. Le risque est inchangé depuis la relecture.

## Contrôles
| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` (racine) | OK |
| `npx tsc --noEmit` (studio-rendu) | OK |
| `npx eslint .` | OK, 0 erreur |
| `npx vitest run` (complet) | **234 fichiers OK (1 ignoré), 2 878 verts, 3 sautés, 0 rouge** (avant : 2 863) |
| `npx next build --webpack` | OK |
| `pnpm build` | OK |
| `shellcheck deploiement/*.sh` | OK (shellcheck installé par `pip install shellcheck-py`) |

`master` n'est pas touché. Aucun appel réseau réel, aucune clé.
