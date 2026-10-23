# Journal — grammaire du monteur trop grande (« The compiled grammar is too large »)

Date : 10/10. Branche `fix/monteur-grammaire-trop-grande`, partie de `origin/master` à jour (e80f6ec). Aucun appel réel à Claude, HeyGen ou Higgsfield : dans les tests, Claude est un double (le vrai client SSE servi par un faux `fetch`). Rien n'a été fusionné ni déployé, et aucun serveur n'a été touché.

## Panne

Journal du conteneur, 10/10, après le correctif #5 :

- « Monteur · relecture des images » : `requete — Claude : The compiled grammar is too large, which would cause performance issues. Simplify your tool schemas or reduce the number of strict tools.`
- « Monteur · discussion » : même erreur.

Conséquence : chaque message au monteur échouait. L'API refusait la requête (400), et le monteur retombait sur la version simple sans dire pourquoi.

## Cause

Le correctif #5 avait respecté la limite **publiée** (16 propriétés à union) en rendant facultatifs les champs nullables. Mais la grammaire compilée dépend de l'ensemble du schéma, et l'API applique aussi une limite **interne**, sans chiffre publié. La doc Anthropic « Structured outputs », lue le 10/10, l'explique :

- au-delà, la requête est refusée (« Schema is too complex for compilation » ou, ici, « compiled grammar is too large »), même si chaque limite publiée est respectée ;
- « chaque paramètre facultatif double à peu près une partie de l'espace d'états de la grammaire » ;
- les unions et les objets imbriqués à champs facultatifs coûtent le plus.

Le schéma envoyé après #5 combinait les trois facteurs :

- 19 branches d'union : base, F3, K, `retirer`… ;
- 17 ou 18 champs facultatifs à l'intérieur de ces branches ;
- 35 listes fermées, dont les 13 modèles L ;
- 102 propriétés au total.

## Choix : (a) une enveloppe fixe envoyée, et la validation stricte côté serveur

La sortie structurée garde un schéma, mais minimal : chaque opération part comme `{ type: <liste des types>, parametres: "<objet JSON en texte>" }`. Le reste de la réponse ne change pas (`reponse`, `consignes`). Ce schéma n'a **aucune union** et **aucun champ facultatif**. Sa taille ne dépend plus du vocabulaire : avec 100 types de plus, il garde les mêmes propriétés et zéro union, ce qu'un test vérifie.

- **Ce que voit Claude.** Les champs de chaque type sont décrits dans la consigne par `SIGNATURES_OPERATIONS_FACECAM`. Ces signatures sont générées depuis les **mêmes** schémas zod, donc elles ne peuvent pas diverger du vocabulaire. Exemple : `- zoom : { debutMot: entier, finMot: entier, style: "punch-in"|"lent"|"flou", cible: "visage"|"main" }`. La consigne de la relecture reçoit maintenant le catalogue et les signatures : avant, elle ne connaissait les champs que par le schéma.
- **À la réception** (`role.envoi.lire`, appelé par `lireSortie`) :
  1. l'enveloppe est dépliée ;
  2. les champs nullables absents sont remis à null ;
  3. chaque opération est validée par le **schéma zod strict de son type** ;
  4. les réparateurs existants s'appliquent ensuite : effet spécial F3, effet réaliste K, carte sur mesure ;
  5. ce qui reste invalide est **écarté avec un motif précis**, par exemple « zoom n° 1 : cible: … » ou « parametres n'est pas un objet JSON valide » ;
  6. le schéma du rôle (`schemaReponseMonteur`, `schemaRelecture`) juge enfin la réponse aussi strictement qu'avant.
- **Un seul nouvel essai, guidé par l'erreur.** Si Claude a répondu mais qu'une opération ou toute la réponse est illisible, le monteur relance **un** appel. Cet appel reprend la même variable, à laquelle s'ajoutent les motifs exacts (`<erreurs_reponse_precedente>`). Il passe par le même chemin de dépense (plafond de la version, limite du mois, réservation). La réponse gardée est celle qui a le moins d'opérations écartées.
- **Un message clair.** Si la version complète ne rend rien (panne ou réponse illisible deux fois), Will lit : « Le monteur complet n'a pas pu traiter cette demande ; j'ai appliqué la version simple. Réessayez dans un instant pour la version complète. » Le motif exact va aux alertes et au journal du serveur. Le plafond de la version (lot G) reste invisible, comme avant.

### Options écartées

- **(b) Mode non strict** (JSON demandé dans le prompt, sans schéma). Rien ne garantirait plus la forme générale de la réponse (`reponse`, `consignes`, booléens, index). Avec l'enveloppe, cette forme reste garantie par l'API, et seul le contenu des paramètres est vérifié par le serveur.
- **(c) Deux appels** (choisir les types, puis les paramétrer). Le coût et la latence doubleraient à chaque message. Et la seconde grammaire grossirait encore avec le nombre de types choisis.

## Ce qui ne change pas

- Garde J (options payantes) : elle s'exécute avant l'appel, sans changement. Une opération hors vocabulaire, `multicamera` par exemple, est écartée, jamais exécutée, ce qu'un test vérifie.
- Les 13 modèles L, l'effet réaliste K (préparé, jamais posé sans « Confirmer »), les réparateurs, les types TypeScript et les schémas zod du domaine.
- Les autres rôles du studio : ils n'ont pas de `envoi`, donc leur corps envoyé est **identique**.
- L'ancienne forme (opérations à plat, simulation) reste acceptée par la lecture.

## Estimation hors ligne de la grammaire (par rôle, schéma EXACT envoyé)

Colonnes : propriétés · profondeur · branches d'union · enums/const · facultatifs · taille JSON (caractères). Seuils prudents du test (`SEUILS_GRAMMAIRE`) : 60 · 6 · 8 · 16 · 12 · 4000.

| Rôle | Mesure |
|---|---|
| stratege | 32 · 5 · 0 · 8 · 1 · 2238 |
| fond | 27 · 4 · 0 · 4 · 5 · 1949 |
| accroches | 14 · 4 · 0 · 2 · 1 · 1034 |
| juge | 6 · 5 · 0 · 1 · 0 · 537 |
| plan | 22 · 4 · 0 · 6 · 7 · 1687 |
| prose | 20 · 4 · 0 · 5 · 6 · 1530 |
| preference | 2 · 1 · 0 · 1 · 0 · 235 |
| reecriture | 5 · 4 · 0 · 1 · 1 · 599 |
| declinaison | 25 · 4 · 0 · 1 · 7 · 1552 |
| sonde | 1 · 1 · 0 · 0 · 0 · 167 |
| publication | 7 · 3 · 0 · 0 · 1 · 540 |
| **monteur-facecam**, avant (#5) | **102 · 4 · 19 · 35 · 17 · 6695** |
| **monteur-facecam**, après | **9 · 4 · 0 · 1 · 0 · 931** |
| **relecture-facecam**, avant (#5) | **101 · 4 · 19 · 36 · 18 · 6733** |
| **relecture-facecam**, après | **8 · 3 · 0 · 2 · 1 · 969** |
| monteur avocat (schéma prêt, sans rôle) | 27 · 4 · 5 · 8 · 2 · 2008 |

Les seuils sont fixés au-dessus du rôle le plus lourd qui fonctionne en production (stratege) et bien au-dessous du monteur d'avant. La contre-épreuve du test vérifie que le schéma d'avant dépasse 5 seuils sur 6.

## Tests ajoutés ou modifiés

`tests/schemas-claude-limites.test.ts` (44 tests) :

- Limites publiées pour tous les rôles (inchangé). Le monteur a maintenant **0 union**.
- **Estimation de grammaire** pour chaque rôle à sortie structurée (6 mesures, seuils prudents). Plus la contre-épreuve (le schéma de #5 dépasse les seuils), le test « 100 types de plus = même grammaire » et le monteur avocat.
- Vocabulaire complet : chaque type figure dans l'enveloppe envoyée et a sa signature dans les deux consignes, avec les 13 modèles L et l'effet réaliste K.
- Aller-retour et rigueur : enveloppe + nulls absents → réponse d'origine. Une opération fausse (champ manquant, valeur hors liste, mauvais type, paramètres illisibles) est écartée avec son motif précis, et les index des consignes sont renumérotés. Une réponse entière illisible reste « invalide ».
- **Bout en bout avec un double de Claude** (vrai client SSE, vrai `lireSortie`, vrai `piloterMonteur`) :
  - le corps envoyé n'a aucune union ;
  - toutes les familles sont appliquées : carte au modèle L `check-list`, `objetMain` (F3), `effetRealisteIA` (K, à confirmer et non posé), `couper`, `retablir` ;
  - `multicamera` hors vocabulaire est écartée, ce qui déclenche un nouvel essai qui cite le motif ;
  - les 13 modèles passent un à un ;
  - une réponse invalide deux fois donne la version simple avec la phrase claire (jamais « souci ») ;
  - un modèle hors liste passe par le réparateur « carte sur mesure », sans nouvel essai ;
  - relecture : une correction illisible est écartée, le reste est gardé.
- Contre-épreuve : sans `envoi` sur les deux rôles du monteur, **12 tests échouent**.

`tests/facecam-monteur.test.ts` : le test « réponse inutilisable → sans second appel » décrit maintenant le comportement voulu : **un** nouvel essai qui cite l'erreur, puis la version simple avec la phrase claire.

## Résultats exacts

- Tests du monteur et du face caméra, demandés (`tests/*monteur*`, `tests/*facecam*`, `v-coherence-facecam`, `g0-client`, `g4-roles`, `schemas-claude-limites`) : **24 fichiers, 327 tests réussis, 0 échec**.
- Les mêmes, plus les lots J et K (`j-*`, `k-*`), `e2e1-moteur-03` et `src/briques` : **38 fichiers, 513 tests réussis, 0 échec**.
- `next typegen` puis `tsc --noEmit` : **0 erreur** (dépendances de `studio-rendu` installées).
- `eslint` sur les fichiers touchés ou créés : **0 problème**.
- Suite complète, pour information : **281 fichiers (280 réussis, 1 ignoré), 3440 tests réussis, 3 ignorés, 0 échec**. Les 14 échecs notés dans le journal #5 (carte Montage) ne se reproduisent plus sur ce master.

## Fichiers

- `src/briques/monteur/enveloppe.ts` (nouveau, PUR) : enveloppe, dépliage, signatures générées.
- `src/generateur/roles/types.ts` : `DefinitionRole.envoi` (schéma envoyé et lecture) ; `construireRequete` envoie `envoi.schema` quand il existe.
- `src/generateur/roles/schema-api.ts` : `estimationGrammaire` et `SEUILS_GRAMMAIRE`.
- `src/fournisseurs/claude/inscription.ts` : `lireSortie` applique `envoi.lire` et rend `ecartees`.
- `src/services/depense-claude-video.ts` : transmet `ecartees`.
- `src/services/monteur-facecam.ts` : la relecture journalise les corrections écartées.
- `src/moteurs/montage-facecam/monteur/operations.ts`, `role.ts`, `agent.ts` : enveloppe du face caméra, consignes avec signatures, nouvel essai guidé, phrase claire.
