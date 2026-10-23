# Banc à l'aveugle « chaîne équipe contre chaîne courte » : note de conception (17/10/2026)

Accord de Will : un test à l'aveugle, **8 $ au maximum**, **5 sujets**. Cette branche livre l'OUTIL et sa preuve
(tests en simulation, 0 $). Le banc réel sera lancé plus tard sur le serveur par la session principale.

## Ce qui est comparé, sans rien changer

- `executerChaineCourte` (`src/generateur/chaine-courte.ts`) : 3 appels (angle + 5 accroches, script, relecture).
- `executerChaineEquipe` (`src/generateur/chaine-equipe.ts`) : rédacteur en chef (2 fois au pire), scénariste,
  accroches, relecteur.
- Les deux reçoivent les MÊMES données (`DonneesGeneration` de l'étape 0, gratuite) et le MÊME exécutant. Aucune ligne
  de leur logique n'est modifiée ; le banc les appelle telles qu'elles sont dans master.
- UN seul réseau par sujet : aucune déclinaison (étape 4 de la courte, étape 5 de l'équipe) ne part, ce qui tient le
  budget.

## Comment le banc tourne hors de l'application (comme G4)

Le banc G4 (`outils/generateur/banc-g4.mts`, rapport (rapport de banc non publié)) a été lancé par
`tsx --conditions=react-server`, sans base de données : un exécutant à lui, qui appelle `envoyerMessage` et compte le
coût de chaque réponse. Le banc à l'aveugle fait pareil :

- **Exécutant réel** : `creerFournisseurScriptClaude(cle).executerRole` (`src/fournisseurs/claude/inscription.ts`),
  le même appel que le studio, SANS `executerRoleFacture` (`src/services/generation-claude.ts`) qui lit et écrit la
  base (plafond du sujet, Crédits, dépenses). Rien n'est écrit dans la base ; aucune connexion à Redis ni à Postgres.
- **Coût réel** : jetons de la réponse × prix du modèle (`coutUsd` de `src/fournisseurs/claude/tarifs.ts`), et jamais
  sous le prix du modèle DEMANDÉ en cas de repli serveur (même règle que `coutReelUsd`).
- **Plafond bloquant** codé dans le banc (`PLAFOND_USD`, défaut 8, refus au démarrage si > 8) : avant CHAQUE appel,
  coût réel cumulé + appels en vol (à leur pire cas) + **pire cas de l'appel** (`pireCasRole` : toute l'entrée au prix
  de l'écriture en cache + `maxTokens` en sortie) > plafond → l'appel ne part pas, la chaîne reçoit
  « plafond-atteint » (`Attente`, son arrêt propre), le banc s'arrête et écrit son rapport partiel.
- Erreur après envoi (délai, réseau, réponse illisible) : le pire cas de l'appel est compté comme dépensé (prudence :
  il a peut-être été facturé).
- Socle : les données FIXES du banc (`CONTEXTE_BANC` des bancs G4 et d'écriture, tournures calibrées). Le vrai socle
  de Will est dans la base : il n'est pas lu (règle « sans base de données »).

## Modes

- `--simulation` : sorties simulées des rôles, aucune clé, 0 $ (même parcours, mêmes fichiers).
- `--estimer` : aucun appel. Par sujet et par chaîne : coût réaliste (médianes mesurées, `estimationRealisteRole`) et
  PIRE CAS (`pireCasChaineCourte` / `pireCasChaineEquipe`, la règle de la réserve du studio, et jamais moins que la
  somme des `pireCasRole` des appels vus en simulation). Total, et comparaison au plafond.
- Réel (par défaut) : exige `ANTHROPIC_API_KEY` dans l'environnement, jamais affichée.

## Sorties (`DOSSIER`, défaut `banc-aveugle-sortie/`)

- `paires.md` : pour chaque sujet, « Script A » et « Script B » dans un ordre tiré au hasard (graine notée en tête,
  générateur à graine `tirage` du banc d'écriture). Seulement les textes DITS (accroche, corps, appel). Ni nom de rôle,
  ni nom de chaîne, ni nombre d'étapes, ni coût. Un test vérifie la liste des mots interdits.
- `cle.json` : sujet → `{ A, B }` = `courte` / `equipe`, à n'ouvrir qu'après le vote.
- `couts.json` : coût réel et durée par sujet et par chaîne, statut, total, plafond, arrêt éventuel.
- `brut/` : l'état complet de chaque chaîne par sujet (`<code>-courte.json`, `<code>-equipe.json`).
- Sortie standard : une ligne par appel (rôle, modèle, durée, coût, cumul).

## Sujets

`tests/generateur/banc/registre-banc-aveugle.ts` : 5 sujets TEST tirés des bases de l'Usine (tailles TPE, PME, ETI,
grand groupe ; dirigeant, DAF, DRH, directeur de filiale ; douleurs de la table `douleur`), un réseau chacun (TikTok,
Instagram, Facebook, YouTube Shorts, LinkedIn). Aucune preuve « cas client » réelle ; un seul cas FICTIF marqué
(registre fictif des fixtures, comme le sujet 3 de G4). Positionnement « nous le mettons en place pour vous ».
