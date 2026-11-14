# ARG-TESTS-SUITE — journal

Fiche : tests d'argent seulement (aucun fichier de `src/**` modifié).

## Fichiers touchés
- `tests/e2e-verif1-ef-reessayer-redemarrage.test.ts` (cas « E2 ») : Zernio est le canal d'envoi par défaut (PR 440). Clé factice + faux client Zernio injecté (remis à zéro après chaque essai, aucun appel réseau), l'attendu passe de `via: "buffer", statut: "brouillon"` à `via: "zernio"`. Aucune assertion d'argent retirée.
- `tests/reseaux/t5-prix-plafond.test.ts` : l'identifiant de vidéo entre dans le « réel » simulé (`hache(étape + videoId)`, ×0,90 à ×1,09 par ligne). `nouvelId` est remplacé par une suite fixe remise à zéro avant chaque essai ; l'horloge de la boucle de fabrication part d'une date fixe au lieu de `Date.now()`. Seuil `MARGE_SIMULEE` (1,1) et plafonds inchangés.

## Vérifications
- t5-prix-plafond : 10 exécutions consécutives, 21/21 vertes. E2 : fichier 19/19 vert.
- eslint propre sur les deux fichiers ; tsc : 146 erreurs avant comme après (aucune nouvelle).
- Recoupement avec la PR 515 : aucun (elle est fusionnée ; ses fichiers sont distincts des deux miens).
- Mutations (temporaires, restaurées par `git checkout src`) :
  - T5 : « réel » simulé ×1,5 au lieu de ×0,9 → 3 rouges (plafond réel ≤ annoncé × 1,1 et « 4:5 : 0 € de plus »). Discriminant.
  - E2, canal : défaut de `outilPour` remis sur Buffer → le cas E2 devient rouge. Discriminant sur le canal.
  - E2, argent : désactiver la garde `PLAFOND_VOIX` ou rendre la clé d'idempotence du rendu aléatoire ne fait PAS rougir le cas E2 lui-même (la clé aléatoire fait rougir un autre cas du même fichier, « CORRIGÉ D1 (c) »). Je n'ai pas trouvé de mutation qui fasse rougir ses assertions d'argent ; à regarder par une session dédiée (je n'ai rien relâché ni retiré).

## À retirer à la fusion — `scripts/echecs-connus.json` (posées par la PR 503)
1. fichier `tests/e2e-verif1-ef-reessayer-redemarrage.test.ts`, nom « E2 — redémarrage du serveur en plein travail (montage réel allumé) redémarrage pendant le rendu du double (accepté par HeyGen, pas encore relu) : reprise sans rien repayer, jusqu'au brouillon Buffer ». Attention : j'ai renommé ce test (« … jusqu'à l'envoi par Zernio (canal par défaut) »), l'entrée ne correspond donc plus au nom.
2. fichier `tests/reseaux/t5-prix-plafond.test.ts`, nom « T5 · « Fabriquer les N » (moteur avocat, hors T5) : tout en 9:16, prix annoncé = contrôlé annoncé = contrôlé au lancement, réel dans la marge de la simulation (≤ annoncé × 1,1) ; aucune sortie en 4:5, même LinkedIn ».

## Point d'attention
La PR 503 modifie aussi `tests/reseaux/t5-prix-plafond.test.ts` (2 lignes dans `beforeEach`) : conflit possible à la fusion, à résoudre en gardant les deux changements.
