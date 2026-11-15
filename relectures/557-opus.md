# Relecture PR 557 (Opus) — brand(V7-L10-bis) : palette 2026 sur le thème clair du Studio, titres en Manrope

## VERDICT : À CORRIGER — fusion impossible en l'état (tête complète 224250c5eba2f0ed512fe6119af674541026dc14)

1. **BLOQUANT — branche sans histoire commune avec master.** `git merge-base origin/master 224250c5` ne renvoie rien : master a été réécrit (mise à jour forcée) et la PR repose sur 7ecc9a9e (#287), absent de master (tête master d19d8d2c, #574). GitHub ne peut pas fusionner ; la base déclarée (ebe57d43) n'est pas le parent réel.
2. **BLOQUANT — conflits sur les 3 fichiers.** Report de 224250c5 sur origin/master : conflit dans `src/app/globals.css`, `src/app/layout.tsx`, `tests/theme-clair.test.ts`. Sur master, `globals.css` a été refondu (COUL-01 : +288/-61 depuis le parent de la PR, jetons `--accent`, `--barre-*`, `--fam-*`, `--res-*`, `--statut-*`, `--trait-champ`) ; la PR, écrite sur l'ancienne version, les ignore. Il faut repartir de master et refaire le travail, pas résoudre ligne à ligne.
3. **BLOQUANT — décision de charte à trancher.** Le thème clair de master est aujourd'hui volontairement bleu (barre « bleu ciel », accent `#14507f`, voir `src/app/globals.css` de master l. 31-50 et l. 336 « jamais le bleu du Studio » pour la page publique seulement). La PR pose une palette sans bleu ; c'est un changement de direction qui contredit l'état actuel de master et ses tests (`tests/visuels/coul-01-jetons.test.ts`, `tests/visuels/couleurs-theme-seulement.test.ts`, `tests/charte/jetons-charte.test.ts`). À valider par le propriétaire avant toute reprise.
4. **MOYEN — nom de personne dans un dépôt public.** `tests/theme-clair.test.ts:150` (`it.todo(...)`) contient un prénom. À remplacer par « décision du propriétaire » ou une référence d'escalade.
5. **MOYEN — `layout.tsx` (PR) supprime Archivo Black** (`src/app/layout.tsx:11-17` de l'ancienne base). Sur master, Archivo Black reste chargée sous `--police-archivo` comme police de MARQUE (aperçu de la bibliothèque) : la reprise ne doit pas la retirer.
6. **MOYEN — perte de sens des états.** `src/app/globals.css:25-28` (PR) : `--ambre` = `#141413` (= `--texte`) et `--brique` = `#B23F16` (= `--orange`). Avertissement, erreur et action principale deviennent indiscernables (ex. `CarteCredits.tsx:44` : ton « orange » rendu comme le texte, ton « rouge » comme l'accent). Le test lui-même le laisse en `it.todo` (l. 150).
7. **MINEUR — thème sombre :** `--sauge` `#5E7050` sur `#141413` = 3,43:1 (commentaire PR l. 59 : icône ou filet seulement) ; tout `text-sauge` en zone `.theme-sombre` échouerait au 4,5:1. À vérifier à la reprise.

## Points vérifiés conformes (sur le contenu de la PR)
- Diff limité à 3 fichiers (globals.css, layout.tsx, tests/theme-clair.test.ts) ; `scripts/echecs-connus.json` inchangé.
- Contrastes clairs : sauge/ivoire 5,10 ; sauge/blanc 5,37 ; terracotta/ivoire 5,51 ; blanc/terracotta 5,81 ; `--texte-faible`/`#E8E6DC` 5,27. Sombre : noir/`#D97757` 5,90 ; `#B0AEA5`/noir 8,29.
- Aucun bleu ni jaune ajouté par la PR.
- Manrope chargée en local (`next/font/local`, `src/app/polices/manrope-latin.woff2`), aucun lien Google Fonts ni `next/font/google`.
- `npx vitest run tests/theme-clair.test.ts` sur la tête : 11 réussis, 1 todo.
- `gh pr checks` : aucun contrôle GitHub n'a tourné sur 224250c5 (statut « pending », zéro check-run) — cohérent avec l'absence de base commune.
