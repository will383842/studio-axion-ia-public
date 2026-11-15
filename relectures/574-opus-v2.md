# Relecture PR 574 (RC-28 « Recette de bout en bout et premiers pas »), 2e passage

**VERDICT : À CORRIGER** (tête complète `5611615e3fffa1e550214cedb48234e3766ee701`, base `efba326ecbea3d32e7e5e8e03dbc52e628058ebb`)

## Points à corriger

1. **docs/PREMIERS-PAS.md, l. 80 (étape D, point 3) — gravité FAIBLE.**
   « Le studio demande une confirmation avant de fabriquer. Lisez, puis cliquez sur **Confirmer**. » est faux pour ce bouton.
   **Fabriquer** passe par `RelireScript.lancerVideo` (`src/components/script/RelireScript.tsx:153-168`) avec `prixCentimes` toujours numérique
   (`NouvelleVideoTableau.tsx:665`, `tableau-creation.ts:339` : `coutVoixCentimes: number`). L'accord part directement avec le montant ;
   si le serveur répond `CONFIRMATION_REQUISE` avec un montant, `confirmerPrix` l'accepte tout de suite **sans ouvrir la feuille**
   (`src/components/ui/ConfirmationPrix.tsx:34-39`, règle du 25/10 : « le prix ne bloque jamais et personne ne le valide à la main »).
   La feuille « Confirmer » n'apparaît donc pas : la personne attend une fenêtre qui ne vient jamais.
   La 1re relecture avait demandé cette mention à tort ; je corrige ma demande.
   À faire : supprimer le point 3 (et renuméroter), ou écrire « La fabrication part tout de suite, sans fenêtre de confirmation. ».

2. **docs/PREMIERS-PAS.md, l. 108 et l. 140 — gravité MINEURE (facultatif).**
   « Vidéos validées » n'est pas une entrée de premier niveau : elle est rangée sous la rubrique pliable **Publier**
   (`src/components/coquille/navigation.ts:67-74` et `:100`, avec « Réponses automatiques » toujours présent, donc la rubrique reste pliée).
   Par cohérence avec l. 96 (« Mes contenus, puis Vidéos ») : « Dans le menu, cliquez sur **Publier**, puis sur **Vidéos validées** ».

## Points de la 1re relecture

- Point 1 (case « Ce conseil n'est pas en première page d'une recherche ») : **corrigé**. l. 78 et l. 86 ; ligne « Si ça bloque » l. 136
  avec le message exact de `src/domaine/relecture-tableau.ts:189`. Libellé conforme à `NouvelleVideoTableau.tsx:653`. Le blocage est bien
  affiché sous le bouton grisé (`RelireScript.tsx:340`, `:361`). Mention de confirmation sans montant : présente, mais inexacte (voir point 1 ci-dessus).
- Point 2 (« Vidéos validées », « Mes contenus » puis « Vidéos ») : **corrigé** (l. 96, 108, 138, 140), libellés conformes à `navigation.ts:26`, `:58`, `:62`.
- Point 3 (« Je suis connecté ») : **corrigé** (l. 14 : « La connexion au studio est faite. »). « La voix déjà payée » remplacé par « déjà faite » (l. 137),
  conforme au libellé `Fabriquer (voix déjà faite)` (`NouvelleVideoTableau.tsx:668`).

## Vérifications faites (conformes)

- Diff = `docs/PREMIERS-PAS.md` seul (+153), 2 commits.
- Nouveaux libellés cités présents dans src/ : case « première page », message « Cochez d'abord « Ce conseil… » », « Confirmer »
  (existe dans `ConfirmationPrix.tsx:74`, mais pas sur ce parcours), « Vidéos validées », « Mes contenus », « Vidéos », « Fabrication en cours ».
  Les autres libellés étaient vérifiés au 1er passage et n'ont pas changé.
- Aucun prix ni symbole monétaire, aucun « Buffer », aucune promesse de gain, aucun nom ni prénom de personne (« Google » = moteur de recherche).
- Signature laissée vide : « Recette signée par le fondateur : ____ » (l. 153).
- CI verte sur `5611615e` : 7/7 contrôles en succès.
