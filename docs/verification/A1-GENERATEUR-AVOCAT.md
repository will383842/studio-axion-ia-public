# Vérification A1 — générateur de scripts du format avocat (10/10/2026)

- Branche `verif/a1-generateur-avocat`, partie de `origin/master` @ `fc894ae`.
- **Rien n'a été fusionné, rien n'a été déployé, aucun serveur lancé, aucun appel réel.** Claude est doublé (le vrai
  fournisseur servi par un faux `fetch` qui rend la sortie simulée de chaque rôle) ; tout autre `fetch` fait échouer.
- Preuve principale : `tests/a1-generateur-avocat.test.ts` (**11 tests**), plus les suites G1a → G7, E2E-1/E2E-2 du
  générateur et `tests/schemas-claude-limites.test.ts`, déjà présentes et relancées.

## 1. Défaut trouvé et corrigé (test rouge d'abord)

### Constat prod du 09/10 : texte complet collé refusé « Pas assez de matière pour une vidéo »

**Verdict : ce n'était PAS voulu.** Reproduit sur master avec un texte collé de 4 paragraphes (situation dans les PME,
« Parce que… », la solution, « ça ne marche pas si… ») :

```
MATIERE_INSUFFISANTE — « Il manque : le pourquoi ; un appui (une preuve, une observation, ou votre avis si vous parlez). »
```

Cause : `creerSujet` faisait du texte de « Une phrase à vous » **une seule matière**, d'un seul type deviné sur le
texte entier. Ici « ça ne marche pas si » l'emportait : tout le texte devenait une « limite ». Le choix conjoint (étape
0) cherchait alors « le pourquoi » parmi les observations, études ou avis contenant une cause… et n'en trouvait aucun,
alors que le texte le contenait. Le message était donc **faux** (il disait qu'il manquait ce qui était là) et ne disait
pas comment garder le texte. Collé dans le champ de l'idée, le texte ne comptait même pas comme matière
(« Il faudrait une actualité datée… »).

Correction (règle « matière vraie » intacte : rien n'est réécrit, rien n'est ajouté) :

| Où | Quoi |
|---|---|
| `src/domaine/matieres.ts` | `estTexteColle` (3 phrases ou plus) et `decouperTexteWill` : découpe **mot pour mot** par la découpe de la dictée en vrac (`decouperDictee`, citations comprises), une phrase de moins de 6 mots rejoint la suivante. Moins de 3 phrases : le texte reste entier (comportement d'avant). |
| `src/services/generateur.ts` (`creerSujet`) | Une matière **par morceau**, chacune avec son type ; toutes imposées au sujet. Un texte complet collé **dans l'idée** (sans « Une phrase à vous ») compte aussi comme matière de Will. Un morceau « cas client » ou « parole d'un dirigeant » porte `accord: { requis: true, obtenu: false }` : il n'est jamais cité sans accord, et la fiche du sujet propose « J'ai son accord » (avant : ignoré en silence). |
| `src/domaine/derivations-generateur.ts` | `proposerTypeMatiere` : « dans beaucoup de PME / d'entreprises… » au milieu d'une phrase = observation (appui permis en « Mon double »). |
| `src/services/boucle-generation.ts` | Si un texte collé ne suffit toujours pas (`MATIERE_INSUFFISANTE` ou `ANCRAGE_MANQUANT`), la carte ajoute : « Votre texte est bien pris. Pour le garder mot pour mot, sans réécriture : « Nouvelle vidéo », étape Script, onglet « Coller ». » (`PHRASE_TEXTE_COLLE`). Toujours 0 €, sans numéro. |

Résultat : le même texte part à l'écriture en « Je lis » comme en « Mon double », collé dans « Une phrase à vous » ou
dans l'idée. Chaque matière créée est une sous-chaîne du texte collé.

## 2. Vérification étape par étape

| Étape | Résultat | Preuve |
|---|---|---|
| Idée → sujet brouillon sans numéro, 0 € | OK | `g1a-service`, `a1` (carte insuffisante : aucun numéro, aucun appel) |
| Domaine Axion-IA (pilier, hors domaine à 0 €), contexte-axion, source axion-ia.com | OK | `e2e1-gen-domaine`, `e2e2-gen-domaine`, `source-axion`, `source-axion-capture` |
| Matières (dictée, types, accord, péremption, retrait) | OK après correction (texte collé) | `g2-matieres`, `e2e2-gen-restes`, `a1` |
| Choix conjoint, réservation, rotation de série, diversité | OK | `g3-*`, `e7-series`, `c5-serie-ecriture` |
| **Texte complet collé** | **KO → corrigé** | `a1` › texte complet collé (5 tests) |
| Chaîne d'écriture (stratège → déclinaison), Claude doublé | OK | `g4-*`, `a1` › idée → version validée |
| Une version par réseau, durée dans la zone du réseau | OK | `a1` (durée ≤ borne haute de `zoneDureeSec`, chaque réseau coché a sa version) |
| Vouvoiement par défaut, « + Tu » à part | OK | `a1` (aucun « tu/te/ton… » dans le texte dit), `e2e2-gen-tu` |
| Français | OK | `a1`, consignes des rôles |
| Très peu de texte à l'écran | OK | `a1` (encadré ≤ 5 mots, incrustations ≤ 4 mots, aucun titre à l'écran) ; contrôles C18/C19, ACR-07, DEC-03 |
| Jamais de faux cas client ni de chiffre inventé | OK | `a1` (accroche « 87 % … 12 000 euros » rendue par le double : jamais retenue) ; ACR-05 et DEC-04 critiques ; cas client sans accord jamais cité (`a1`, `e2e2-gen-restes`) |
| Plafond d'écriture 1,50 $ ≈ 1,35 € (taux 0,9) par sujet | OK | `a1` (dépense > 0 et ≤ plafond), `e2e2-gen-argent`, `e2e1-secu-plafonds`, `v4-argent` |
| Plafond tenu en reprise | OK | `a1` (limite du mois atteinte au milieu → attente, reprise par Will : étapes payées non rejouées, total ≤ 1,50 $, plafond inchangé). Seul cas où le plafond monte : la reprise après des appels **restés sans réponse** (pire cas relevé), **uniquement après accord explicite** sur le montant affiché (`reprendreEcritureArretee`, `CONFIRMATION_REQUISE`). |
| Retouches : « Autre accroche / Plus court / Améliorer » | OK | `a1` (plafond de la retouche 0,70 $, ancienne version gardée, nouvelle version à relire), `c1-argent-b1-retouche-avocat` |
| Retouche phrase par phrase (à la main) | OK | `a1` (aucun appel à Claude, nouvelle version à relire, la phrase est bien là) |
| « Valider les N » | OK | `a1` (bloqué tant que la limite proposée n'est pas validée), `g4-service` |
| « Fabriquer » / « Fabriquer les N » : rien ne part sans accord | OK | `a1` (version non validée refusée ; au-delà du seuil sans prix confirmé : refus, aucune vidéo créée), `e2e2-argent-fabriquer-n`, `e2e2-gen-fabriquer-version`, `g6*` |
| Schémas Claude de TOUS les rôles du générateur | OK | `schemas-claude-limites` : stratège, fond, accroches, juge, plan, prose, préférence, réécriture, déclinaison, sonde, publication → **0 union** (limite 16), facultatifs ≤ 7 (limite 24), grammaire sous les seuils prudents (propriétés ≤ 32/60, profondeur ≤ 5/6, JSON ≤ 2 181/4 000). La couverture « tous les rôles déclarés » est vérifiée par le test lui-même. |

## 3. Contrôles

- `npx next typegen` puis `npx tsc --noEmit` : **0 erreur** (dépendances de studio-rendu installées).
- `npx eslint .` : **0 erreur, 0 alerte**.
- Suite complète `npx vitest run` (une fois, avec les corrections) : **288 fichiers réussis, 1 sauté ; 3 607 tests réussis, 3 sautés, 0 échec** (566 s).

## 4. Restes (non corrigés, à décider)

1. **Typage par phrase = heuristique.** Un texte collé sans constat ni « parce que » explicite peut encore être jugé
   insuffisant en « Mon double » (un avis de Will n'y sert pas d'appui, règle n° 65). La carte le dit maintenant et
   montre le chemin « Coller ». Un rangement par Claude (« Ranger pour moi ») reste simulé.
2. **Reprise après appels sans réponse** : le plafond du sujet peut dépasser 1,50 $, du pire cas des appels perdus,
   seulement après « Confirmer » sur le montant affiché. Voulu (correcteur final A) ; à confirmer par Will.
3. Le texte collé reste aussi l'**idée** du sujet quand il est collé dans ce champ (titre long sur la liste). Sans
   effet sur l'écriture.
