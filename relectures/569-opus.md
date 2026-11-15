# Relecture PR 569 — REPERE-PUBLICATION (Opus)

VERDICT PROVISOIRE : en cours

Tête relue : 2b84579812e25a1e73e110b50941a93f85913f91

## Avancement
- [x] Fichiers modifiés = exactement les 3 nouveaux fichiers de la fiche ; src/services/publications.ts et scripts/echecs-connus.json non touchés.
- [x] Fusion avec master f98e77a propre (branche 1 commit en retard, sans conflit).
- [x] Test de la PR : 6/6 verts.
- [x] tsc : 146 erreurs sur master f98e77a, 146 identiques sur la branche (diff vide, aucune dans les nouveaux fichiers) ; eslint propre sur les 3 fichiers.
- [x] Sondes jetables (non poussées) : repère rendu aux 4 statuts (brouillon, programmee, publiee, echec), dépôts par défaut compris ; signature vide du créneau → script maître ; script sans origineUsine → null ; repère absent → null ; publication de visuel sans vidéo → null (même avec un créneau cmd- sans vidéo) ; publications de démonstration → toutes null ; aucune écriture ; ligne : 14 clés exactes, jours 7/30, source saisie, portee/durée absentes → null, source « api » → null, ni texte ni signature.
