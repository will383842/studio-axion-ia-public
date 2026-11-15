# Relecture PR 574 (RC-28 « Premiers pas et recette »), 3e passage

**VERDICT : OK — FUSION POSSIBLE sur la tête complète `614c529fb560a2d876d251137760312b4fbbbc4b`**
(base `efba326ecbea3d32e7e5e8e03dbc52e628058ebb`, PR encore en brouillon : à sortir du brouillon avant la fusion)

## Point de la 2e relecture

- Point 1 (fausse fenêtre « Confirmer » avant fabrication) : **corrigé** par le commit `614c529f`.
  L. 80 devient : « Après le clic sur **Fabriquer**, la fabrication démarre directement, sans fenêtre de confirmation. »
  C'est exact : `RelireScript.lancerVideo` (`src/components/script/RelireScript.tsx:153-168`) envoie l'accord avec le montant,
  `prixCentimes` est toujours numérique sur ce parcours (`NouvelleVideoTableau.tsx:665`, `src/services/tableau-creation.ts:339`),
  et `confirmerPrix` rend un montant connu sans ouvrir la feuille (`src/components/ui/ConfirmationPrix.tsx:34-39`).
- Point 2 (facultatif : « Vidéos validées » rangée sous **Publier**) : non repris, l. 108 et l. 140 inchangées. Reste facultatif, non bloquant.

## Vérifications faites (conformes)

- Diff contre la base = `docs/PREMIERS-PAS.md` seul (+153), 3 commits.
- Plus aucune autre mention de confirmation : `grep -i confirm` ne trouve que la l. 80, désormais juste.
  Les mentions « sans votre accord » (l. 11, 117, 150) parlent de la publication et sont conformes au texte de l'écran.
- Tous les noms d'écran, de bouton et de message cités (40 libellés : « Nouvelle vidéo », « Choisir un format », « Découper en scènes »,
  « Fabriquer », « Fabrication en cours », « Mes contenus », « Vidéos validées », « À publier », « Contrôler et valider »,
  « Envoyer en brouillon », « Commentaire épinglé », « Mention IA », « Lien privé », « Reprendre la fiche », « Corriger la fiche »,
  « Rien n'est prêt à partir », « Cochez d'abord », etc.) existent dans `src/` (grep).
- Aucun prix ni symbole monétaire, aucun « Buffer », aucune promesse de gain, aucun nom ni prénom de personne.
- Signature laissée vide : « Recette signée par le fondateur : ____ » (l. 153).
- CI verte sur `614c529f` : 7/7 contrôles en succès ; PR fusionnable sans conflit (état « clean »).
