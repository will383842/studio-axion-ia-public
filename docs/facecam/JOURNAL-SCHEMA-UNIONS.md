# Journal — schémas Claude trop complexes (« too many parameters with union types »)

Date : 09/10. Branche `fix/monteur-schema-unions` (partie de `origin/master` à jour, e69459d). Aucun appel réel à Claude, HeyGen ou Higgsfield : `fetch` est remplacé par une erreur dans le nouveau test.

## Panne

Journal du conteneur, après la fusion des lots J, K et L :

- « Monteur · relecture des images » : `Schemas contains too many parameters with union types (18 …, limit: 16)`
- « Monteur · discussion » : `… (17 …, limit: 16)`

Conséquences : le chat « modifier la vidéo » répondait « un souci est survenu », et l'étape « relecture » du montage n'aboutissait pas.

## Cause

`schemaJson` (`src/generateur/roles/types.ts`) convertit le schéma zod du rôle avec `z.toJSONSchema`. Chaque `.nullable()` y devient `anyOf: [X, {type: "null"}]`. L'API compte toutes les **propriétés** qui ont un `anyOf` ou un `type` en tableau, toutes branches confondues (limite : 16 par requête). Le vocabulaire du monteur face caméra (`operations.ts`) a fini par en compter 17 :

- `ajouterCarte` : modele, html, animationGardeeId
- `miseEnPage` : cote ; `couleurs` : teinte
- `son` : precision, debutMot, finMot
- `arretImage` : texte ; `titre` : debutMot, finMot
- lot F3, `vitreBrisee` : dureeSec, texteCarte ; `transitionEcran` : dureeSec
- lot K, `effetRealisteIA` : instantSec, imageReference, sonSuggere

Ce sont les 3 champs du lot K qui ont fait passer le total au-dessus de 16. La relecture y ajoute `defauts[].elementId`, d'où 18. Mon compteur hors ligne retrouve exactement 17 et 18 propriétés : les chiffres de l'API sont reproduits.

## Correctif (générique, pour tous les rôles)

`src/generateur/roles/schema-api.ts` (PUR) :

1. **À l'envoi** (`sansNullables`, appelé par `schemaJson`) : une propriété `anyOf [X, null]` (ou `type: [t, "null"]`) devient `X` et sort de `required`. Le champ est alors **absent** plutôt que null. L'union des opérations reste un `anyOf`, mais il n'y en a qu'un, sur les éléments du tableau.
2. **À la réception** (`restaurerNulls`, appelé par `lireSortie` dans `src/fournisseurs/claude/inscription.ts`) : un champ absent que le schéma zod accepte à `null` (mais pas absent) est remis à `null`. La validation zod **inchangée** du rôle passe ensuite. Rien d'autre n'est modifié et une valeur présente n'est jamais écrasée. Dans les unions, la branche est choisie par son littéral `type`.
3. Les schémas zod du domaine ne bougent pas. On garde donc tels quels les réparateurs (`reparerEffetSpecial`, `reparerEffetRealiste`, carte sur mesure), la garde J des options payantes, les 13 modèles L, l'effet réaliste K et les types TypeScript.

J'ai écarté l'aplatissement de l'union en un seul objet : il aurait fait exploser le nombre de champs facultatifs, limités à 24 par requête.

## Limites documentées vérifiées hors ligne

D'après la doc Anthropic « Structured outputs », lue le 09/10. Les limites sont cumulées sur tous les schémas stricts d'une requête, et chaque requête du studio n'a qu'un schéma :

- ≤ 16 propriétés à union (`anyOf` ou `type` en tableau) ;
- ≤ 24 propriétés facultatives (absentes de `required`) ;
- objets fermés (`additionalProperties: false`) ;
- pas de bornes numériques, de longueurs, de `pattern` ni de `minItems` > 1 ;
- pas de récursion ni de `$ref` ; pas d'`enum` de types complexes.

## Comptes avant / après, par rôle

Colonnes « unions (API) » : propriétés à union, comme l'API les compte. Colonnes « unions (prudent) » : on ajoute l'union des éléments de tableau.

| Rôle | Unions avant (API) | Unions avant (prudent) | Facultatifs avant | Unions après (API) | Unions après (prudent) | Facultatifs après |
|---|---|---|---|---|---|---|
| stratege | 0 | 0 | 1 | 0 | 0 | 1 |
| fond | 0 | 0 | 5 | 0 | 0 | 5 |
| accroches | 0 | 0 | 1 | 0 | 0 | 1 |
| juge | 0 | 0 | 0 | 0 | 0 | 0 |
| plan | 0 | 0 | 7 | 0 | 0 | 7 |
| prose | 0 | 0 | 6 | 0 | 0 | 6 |
| preference | 0 | 0 | 0 | 0 | 0 | 0 |
| reecriture | 0 | 0 | 1 | 0 | 0 | 1 |
| declinaison | 0 | 0 | 7 | 0 | 0 | 7 |
| sonde | 0 | 0 | 0 | 0 | 0 | 0 |
| publication | 0 | 0 | 1 | 0 | 0 | 1 |
| **monteur-facecam** (« Monteur · discussion ») | **17** | 18 | 0 | **0** | 1 | 17 |
| **relecture-facecam** (« Monteur · relecture des images ») | **18** | 19 | 0 | **0** | 1 | 18 |
| monteur-avocat (schéma prêt, sans rôle) | 2 | 3 | 0 | 0 | 1 | 2 |

Après le correctif, chaque rôle a au plus 1 union (objectif ≤ 12) et au plus 18 facultatifs (limite 24, alerte du test au-delà de 20).

## Test anti-régression

`tests/schemas-claude-limites.test.ts` :

- Il construit le **corps exact** envoyé à l'API (`construireRequete` → `corpsRequete` → `output_config.format.schema`) pour chaque rôle, et vérifie toutes les limites ci-dessus. Il signale (`console.warn`) un rôle au-delà de 12 unions ou de 20 facultatifs.
- Il vérifie que sa liste couvre **tous** les `export const …: DefinitionRole` de `src` : un nouveau rôle oublié fait échouer le test.
- Il vérifie que le schéma envoyé contient toujours les 19 opérations, les 13 modèles L et `effetRealisteIA` (K).
- Il vérifie l'aller-retour : une réponse privée de ses nulls redonne la réponse d'origine, pour toutes les opérations à champs nullables et pour la sortie simulée de chaque rôle. La validation reste stricte : champ requis manquant, valeur hors liste ou type faux donnent « invalide ». L'ancienne forme, avec les nulls, reste acceptée.
- Contre-épreuve : sans le correctif dans `schemaJson`, 3 tests échouent (les deux rôles du monteur et la marge ≤ 12).

## Résultats exacts

- `vitest run tests/schemas-claude-limites.test.ts` + tests du monteur et du face caméra (`tests/*monteur*`, `tests/*facecam*`, `v-coherence-facecam`, `z-integration-facecam`, `h-facecam-multicamera`, `e2e1-moteur-03-depense-a-l-echec`) + `g0-client` + `g4-roles` : **24 fichiers, 292 tests réussis, 0 échec**.
- Lots J, K, L, H (`j-options-payantes`, `k-chaine-effet-realiste`, `k-effet-realiste`, `h-avocat-mission-h`, `facecam-monteur-13-modeles`, `facecam-motion-7-13`) : **6 fichiers, 80 tests réussis, 0 échec**.
- `next typegen` puis `tsc --noEmit` : **0 erreur**, une fois les dépendances de `studio-rendu` installées (`npm ci` dans `studio-rendu/`). Sans elles, il y a 9 erreurs, toutes dans `studio-rendu/` (modules `@remotion/*` absents), aucune dans `src/`.
- `eslint` sur les 4 fichiers touchés ou créés : **0 problème**.
- Suite complète, pour information : 3378 tests réussis, 14 échoués, 3 ignorés. Les échecs viennent de 5 fichiers sans lien avec ce correctif : `e2e-verif1-a1-eteints`, `e2e-verif1-bc-serie`, `e2e-verif1-d-interrupteurs`, `r0-connexions`, `r6-je-lis-reel`. Ce sont des assertions sur la carte Montage (« Face caméra » en trop dans « Montage réel pour »). Les **mêmes 14 échecs se reproduisent sur `origin/master` sans ce correctif**.

Rien n'a été fusionné ni déployé, et aucun serveur n'a été touché.
