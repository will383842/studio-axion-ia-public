# Relecture v2 PR 569 — REPERE-PUBLICATION (Opus)

VERDICT PROVISOIRE : en cours — tête relue dc53fc21d1e5f59695c162835c505f484b0e2e68

## Avancement
- [x] Tête complète : dc53fc21d1e5f59695c162835c505f484b0e2e68 (origin/usine/REPERE-PUBLICATION).
- [x] Diff contre la base de fusion : exactement 3 fichiers (src/domaine/releve-usine.ts, src/services/repere-publication.ts, tests/usine/repere-publication.test.ts) ; depuis 2b845798, seul le test change (+10 lignes) hors fusion de master.
- [x] src/services/publications.ts et scripts/echecs-connus.json inchangés ; fusion avec master a24e3767 sans conflit.
- [x] Cas de test présent : « commande avec visuelId (créneau cmd- sans vidéo) + publication de visuel sans videoId : null » ; 7/7 verts.
- [x] Mutation à la main (suppression de `if (!pub.videoId) return null;`) : le nouveau cas ROUGIT (1 échoué, 6 verts) ; garde restaurée.
