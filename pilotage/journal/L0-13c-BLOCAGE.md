# L0-13c — blocage : un test hors liste rougit

PR brouillon n°596, branche `usine/L0-13c`.

Le test `tests/a-publier-carte-par-video.test.ts` (« le détail est replié par défaut… », ligne 77) attend le texte « Compte Buffer ».
Ce texte vient du repli `: "Buffer"` de `LignesAPublier.tsx` (ligne 471), que le critère « le seul Buffer visible restant est le libellé historique » oblige à retirer ; il devient « Compte Zernio ».

Ce test n'est pas dans fichiers_autorises : conformément à la fiche (« arrêt et annonce, pas de modification »), il n'est pas touché.

Décision demandée au pilotage, au choix :
1. autoriser la modification de ce test (« Compte Buffer » devient « Compte Zernio ») dans L0-13c ;
2. ou renoncer au changement de ce repli dans `LignesAPublier.tsx`.

Rien d'autre ne rougit dans les tests ciblés (tests/zernio vert, sans modification).
