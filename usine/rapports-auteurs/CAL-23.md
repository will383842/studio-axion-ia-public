# CAL-23 · Rapport d'auteur (déplacer ou modifier une publication programmée)

## Base
- CAL-22 est fusionnée dans master (squash #1262, 55b49947). `usine/CAL-23` a reçu `origin/master` par fusion (aucun rebase, aucun force-push).
- Conflits : `src/services/retirer-programmation.ts`, `tests/calendrier/cal-22-retirer.test.ts`, `src/app/(studio)/calendrier/actions/retirer.ts`, `src/fournisseurs/publication/zernio-client.ts` = version de MASTER.
- PR #1234 : base passée de `usine/CAL-22` à `master`, toujours en brouillon.

## Ce que livre CAL-23
- Déplacer une publication programmée : « annuler puis recréer » (retrait confirmé chez le diffuseur, puis date et version suivante).
- Modifier le texte d'une publication programmée : même retrait, puis « À valider ».
- Le port de retrait passe maintenant par `client.retirer` de master (liste paginée brouillons + programmés ; rien trouvé ou réponse incertaine = « à vérifier »).

## Élargissement (décision du pilote)
- Nouveau `src/components/calendrier/RetirerProgrammation.tsx` : « Retirer » → confirmation (« Oui, retirer » / « Non, garder ») → `retirerProgrammationAction`.
  Un titre et une phrase par cas : retirée / à vérifier / à retirer à la main / pas retirée. Une erreur réseau n'est jamais dite « retirée ».
- Branché dans `FicheEntree` (propriété `retraitProgrammation`, éteinte par défaut) et dans `ApercuPublication` pour une entrée de créneau programmée à venir.
  L'ancien geste local (« Retirer du calendrier ») reste pour les entrées sans programmation chez le diffuseur (origine publication).
- Boutons neutres (aucun orange), pleine largeur, empilés : lisible à 375 px.
- Déplacement : l'ordre est vérifié par un test (retrait confirmé, PUIS écriture « annule » ; retrait raté = aucune écriture). Aucun brouillon orphelin : `retirer-programmation.ts` ignore les envois annulés, donc un envoi n'est jamais annulé avant son retrait.
- Aucun changement dans `src/fournisseurs/publication/**`, `tests/zernio/**`, `.github/`, `scripts/echecs-connus.json`. Aucun interrupteur changé, aucun appel réel.

## Tests
- `tests/calendrier/cal-23-bouton-retirer.test.tsx` (nouveau) : geste, confirmation, quatre refus, erreur réseau, où le geste paraît, ordre retrait/annulation, pagination du port.
- `tests/calendrier tests/zernio tests/libelles-interdits.test.ts` : tout passe sauf `tests/calendrier-lecture.test.ts` (« passage à l'heure d'hiver »), qui échoue déjà sur master.
- Un cycle d'imports (FicheEntree → composant → action → FicheEntree) est évité par un import de l'action au clic.

## Relectures Opus
Voir les commentaires de la PR (VERDICT OPUS et AUDIT OPUS).
