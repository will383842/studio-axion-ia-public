# Relecture v2 PR 523 (RC-14, registre d'alertes unique) : À CORRIGER. Fusion NON possible sur la tête 3f057854

Tête relue : `3f057854` (usine/RC-14) ; delta `05a0930f..3f057854`. Lecture seule ; rejeu et mutations faits dans une copie jetable.

**Verdict : À CORRIGER.** La correction de la date illisible (point 1 de la v1) est **juste et testée**. Le **point 2 de la v1 n'est pas traité** : `JOUR_MS` et le calcul du jour de Paris sont toujours recopiés dans `src/domaine/alertes/jours.ts:4-10` au lieu d'être importés de `src/lib/dates.ts:7` (`JOUR_MS`) et `src/lib/dates.ts:64` (`cleJour`). La garde `tests/garde-regle-unique.test.ts` signale toujours `src/domaine/alertes/jours.ts:4` (9 copies de `JOUR_MS` dans `src/`, contre 8 sur master). Le correctif tient en quelques lignes : `import { JOUR_MS, cleJour } from "@/lib/dates"`, `jourParis = cleJour`, l'horloge restant injectée. **Fusion possible dès ce point corrigé.**

## Vérifications
1. **Delta limité à la correction** : 3 fichiers, 1 commit. `registre.ts` +4 (deux gardes de date illisible), test +29 (5 cas), journal +2. Rien d'autre. OK.
2. **Rejeu** (calendrier sain de J à J+8 avec visuels, horloge au 11/11/2026 à 10 h, heure de Paris) :
   - date illisible (`13/11/2026`, `xx`, `undefined`) + autres entrées avec visuel : `visuel-manquant`, `trou-j7` et `trou-j2` donnent **non évalué** ;
   - date illisible + entrée lisible à J+3 sans visuel : `visuel-manquant` donne **alerte** ;
   - toutes les dates lisibles avec visuel : **ok** partout ;
   - J+7 et J+2 vides + date illisible : **non évalué** ; J+7 et J+2 vides, toutes les dates lisibles : **alerte** ; calendrier vide : alerte pour les trous, ok pour le visuel (rien à juger). OK.
3. **Mutations** (toutes rouges, puis restaurées : 48/48 verts) :
   - retrait de la garde du visuel : 1 test rouge ;
   - retrait de la garde des trous : 1 rouge ;
   - retrait des deux gardes : 2 rouges ;
   - seuil 80 → 81 : 1 rouge ;
   - « non-evalue » → « ok » dans `seuil.ts` : 5 rouges ;
   - `NON_EVALUE` → ok dans `registre.ts` : 10 rouges ;
   - import et appel de `envoyerPush` dans le service : 1 rouge.
4. **Fonction de seuil unique** : `evaluerSeuil` est intacte. Le delta n'ajoute ni seuil, ni comparaison chiffrée, ni appel à `evaluerSeuil`. OK.
5. `vitest run tests/alertes` : 48/48 verts. eslint propre sur le lot. `tsc --noEmit` : 146 erreurs, comme avant, aucune dans les fichiers du lot. Aucun nom de personne dans le delta. OK.

## Remarque (non bloquante)
- Trous J+7/J+2 : une date illisible donne « non évalué » **même si le jour visé est déjà rempli** par une entrée lisible. Ce cas pourrait être évalué « ok » sans risque. C'est prudent (aucun faux vert), mais l'information est moins précise. On peut le laisser tel quel.
