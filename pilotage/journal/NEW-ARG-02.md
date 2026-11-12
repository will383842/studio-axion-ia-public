# NEW-ARG-02 : garde « règles de fer » (final, branche propre)
- Fait : outils/gardes/regles-de-fer.mjs (7 règles : montant, workflow externe, Haiku, purge, date Buffer 18/11 et 20/11, push, nom du fondateur) + job « regles-de-fer » dans verifier.yml. Un seul commit sur master (fusion squash de usine/NEW-ARG-02, le montant de l'ancien historique n'y est plus). La base L0-17 est la version corrigée de usine/L0-17-propre (fichiers de L0-17 repris à l'identique) ; master a avancé : 3 fichiers récents ajoutés aux exceptions « purge ».
- Fichiers de la fiche : verifier.yml, regles-de-fer.mjs, regles-de-fer.test.ts, ce journal.
- Zone Zernio non touchée (4 de ses fichiers figurent dans les exceptions, avec leur nombre d'occurrences : à annoncer à la session Zernio).
- contrôle anti-fuite : vide

## Corrections après relecture (v1-u5)
- Constat 1 (montant, faux vert) : CORRIGÉ. Rouge sur `formaterMontant`, `euros(`, `EncartCout`, `JaugeBudget`, `lib/montants`, `devise: "EUR"`, `currency:`, tout symbole « € » ou `&euro;`, le mot « euros » ou le symbole « $ » collé après une expression, le « $ » avant une interpolation, le symbole sur la ligne suivante ; 2 tests (une vingtaine de cas rouge, un cas vert). Sur master actuel, 18 fichiers d'écran sont concernés (et non 20 : master a changé) ; ils sont dans les exceptions de départ, avec leur nombre, à vider par NEW-ARG-01.
- Constat 3 (liste des mots en clair dans le journal) : CORRIGÉ dans le workflow : `secrets.MOTS_FONDATEUR` (masqué dans le journal), plus de `vars.`, test. Le secret N'EST PAS créé : sans lui, la règle est dite « non vérifiée » (annotation visible). Le code lit aussi un fichier hors dépôt (MOTS_FONDATEUR_FICHIER).
- Constat 4 (dépôt privé dans `run:`) : CORRIGÉ. `gh repo clone <dépôt>`, `gh api repos/<dépôt>` rougissent ; `--repo`, clone et api du dépôt lui-même (`${{ github.repository }}`) restent verts ; test.
- Constat 5 (exception d'un fichier entier) : CORRIGÉ. Chaque exception porte un nombre d'occurrences ; au-delà : rouge « exception-depassee » ; fichier sans motif : « exception-perimee » ; test.
- Constat 2 (critère 4, ~155 fichiers avec le nom) : REPORTÉ, décision du fondateur (fiche de nettoyage ou fichiers autorisés élargis) avant toute fusion. Constat 6 (montant dans l'historique) : réglé par ce commit unique. Remarque 7 (couplage Zernio), 8 (job jamais exécuté sur GitHub), 9 (sens de « aucun push », date Buffer sur la ligne voisine) : reportées.
- Tests (cloud) : tests/outils + tests/scripts + tests/gardes : 167 passés, 0 échoué, 1 sauté. Garde sur la branche : 0 défaut.

## Corrections après relecture (opus-v1-y1)
- Nouveau constat 1 (trous « dollars » de la règle montant) : CORRIGÉ. « dollars » est reconnu après une expression ; le symbole dollar, « euros » ou « dollars » seul dans une chaîne ou un élément, le mot seul sur la ligne suivante, "EUR" et "USD" en littéral sont rouges. 12 tests rouges avant le code (un par forme) et un test vert (texte ordinaire). Le mot au singulier seul (nom d'icône) reste permis. Garde sur la branche : 0 défaut, exceptions inchangées.
- Bloquant 2 (critère 4, nom du fondateur, ~155 fichiers) : PILOTAGE : fiche de nettoyage ou fichiers autorisés élargis, secret créé, puis `--strict` ; non corrigeable ici.
- Nouveau constat 2 (secret contre « sans secret », en-tête de regles-de-fer.mjs) : PILOTAGE : décision du fondateur d'abord (secret admis ou fichier hors dépôt), l'en-tête suivra ; non modifié.
- Constat 3 (GH_REPO=..., chemins relatifs de gh api) et remarques 7, 8, 9 : REPORTÉS. Constat 4 (ordre de fusion) : fusionner cette branche seule, elle contient L0-17 ; elle n'a pas la correction du build de L0-17-propre (a21cf9c4) : à refaire sur master après la fusion de L0-17-propre.
- Tests (cloud) : tests/outils + tests/scripts + tests/gardes : 180 passés, 1 sauté, 0 échoué.
- contrôle anti-fuite : vide
