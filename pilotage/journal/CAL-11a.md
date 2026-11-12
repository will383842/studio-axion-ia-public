# CAL-11a : ADR reprogrammation (FAIT, à relire)
- Fait : docs/adr/0014-reprogrammation-glisser-deposer.md (compare bibliothèque et événements pointer : poids, clavier, téléphone ; tranche : pointer natif, aucune dépendance). package.json non touché.
- Test : tests/adr/adr-0014-reprogrammation-pointer.test.ts (rouge d'abord : fichier absent).
- Statut de l'ADR : brouillon, à valider par le fondateur. Bandeau « Annuler » : 10 secondes.
- tsc / eslint : aucun fichier de code touché.
- CORRECTIF (relecture z4) : tests/adr/adr-0014-reprogrammation-pointer.test.ts ne cite plus aucun nom de personne ; fichier d'essai accepté par le pilote ; 4 essais passés.
contrôle anti-fuite : vide
