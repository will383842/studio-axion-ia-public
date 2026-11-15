# Relecture PR 562 (lot AUT-G) — Opus v3

VERDICT : OK — FUSION POSSIBLE sur la tête complète 5dc51527e705b4492649852c050f309bc1cdbdcb

Le point (f) de la v2 est corrigé : les 2 tests rouges sont verts, et cela sans toucher à un seul test existant ni à `scripts/echecs-connus.json`.
Suites voisines identiques à master (mêmes 10 rouges déjà présents, +14 tests AUT-G verts). Les sondes d'argent tiennent, le chemin Studio est inchangé, tsc donne 146 = 146 et eslint est propre.

Tête relue : 5dc51527e705b4492649852c050f309bc1cdbdcb

## (1) Les 2 tests rouges de la v2
- `tests/voix/voix-epinglee-image-video.test.ts` et `tests/cas-concret/services/branchements/branchements.test.ts` : VERTS sur 5dc51527 (avec les 2 suites AUT-G : 4 fichiers, 41 tests verts).
- Ces 2 fichiers ne sont PAS modifiés par la PR (diff master...PR vide pour tests/voix, tests/cas-concret) ; `scripts/echecs-connus.json` inchangé.
- Correction côté code : `src/services/cle-depense-usine.ts` ne donne `cleUsine` que pour l'origine normalisée « usine » (même `normaliserOrigine` que `credits.ts`), objet vide pour le Studio. Aux 4 sites, l'origine passée à la clé est la même que celle passée à la réservation.

## (2) Suites des zones touchées (vitest, même machine, base = merge-base 98af97a5 vs PR 5dc51527)
Fichiers : tests/voix, tests/cas-concret, tests/autonomie-usine*, tests/*credits* (alertes-credits-claires, sans-prix-credits, l3-01-verrou-credits*, d2-credits, g0-credits, image-video/lot/credits-lot).
- base : 4330 tests, 4316 verts, 10 rouges ; PR : 4344 tests, 4330 verts, 10 rouges.
- Comparaison test par test : les 10 rouges sont IDENTIQUES (déjà rouges sur master, tous dans tests/cas-concret, sans lien avec AUT-G) ; la seule différence est l'ajout de 14 tests AUT-G, tous verts. AUCUN nouveau rouge.
- La PR fusionne sans conflit sur l'origin/master actuel (f98e77a5).

## (3) Sondes d'argent rejouées (sonde jetable non poussée, vrai `credits.ts` + vrai `cleDepenseUsine`, plafond de 20 € en dépôt mémoire)
- Plafond : 15 € + 2 voix à 2 € → registre 1900 ; 18 €, 5 € et 1,01 € REFUSÉES `USINE_PLAFOND_ATTEINT` ; 3e voix de 2 € REFUSÉE ; 1 € acceptée (égalité) → 2000. OK.
- Maintien dans le temps : départ 15/11 10:00 UTC, horloge avancée à +16 min, +60 min et au 30/11 22:30 UTC (dernier soir du mois à Paris) : registre 1900 à chaque fois, 18 € et 5 € REFUSÉES, 3e voix REFUSÉE. OK.
- Mutation de contrôle : si `cleDepenseUsine` ne rend jamais de clé, la sonde rougit (4 sur 4) et le test du dépôt aussi (1). Les sondes ont donc une vraie portée.

## (4) Chemin Studio
- `cleDepenseUsine(origine)` rend `{}` pour une origine absente ou « studio » : pas de champ `cleUsine`, pas de tirage d'identifiant. La demande est donc exactement celle de master aux 4 sites.
- Dans `verifierEtReserver` côté Studio : `cleUsine` vaut undefined et `ajouter` n'est pas transmis ; `engagerBudget(..., { cumuler: false })` remplace comme avant. `reserverCredits` reçoit `{ videoId, travailId, lignes }` et ne lit que ces champs, donc rien ne change. Les 2 anciens tests Studio rouges sont redevenus verts sans modification. OK.

## (5) Bilan
- tsc : 146 erreurs sur la base et 146 sur la PR, liste identique (numéros de ligne mis à part).
- eslint des 8 fichiers src et des 2 fichiers de test touchés : propre.
- Aucun nom de personne dans les lignes ajoutées. Aucun montant codé en dur dans src/ : les 20 € n'apparaissent que dans les dépôts mémoire des essais.
- Seuls les fichiers AUT-G changent (11 fichiers : services, 2 tests nouveaux, journal). Aucun test existant n'est modifié et aucune assertion n'est assouplie.
