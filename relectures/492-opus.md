# Relecture PR 492 — STU-PORTE-PROG (porte v2, appel 4 « programmations »)

**Verdict : À CORRIGER**

Tête relue : `af6f2f54` (branche `usine/STU-PORTE-PROG`, à jour sur master). Lecture seule ; essais jetables non versionnés.

## Ce qui est bon
- Périmètre : 3 fichiers autorisés + journal (`pilotage/journal/STU-PORTE-PROG.md`). Garde `outils/gardes/zone-interdite.mjs --fichiers` : **vert**. Aucun fichier d'envoi, aucune zone Zernio touchée.
- Isolation : `src/services/porte-programmations.ts:9-12` n'importe que `origine-date`, des types et `plan-editorial` (pas de fournisseur, pas de port d'envoi). Aucun envoi planifié écrit (vérifié par test).
- Critère 1 (création) : entrée `prog-<cle>`, origine « usine », date par défaut, passée à « a_valider » par `changerStatut(..., "usine")` dont la garde interdit à l'usine d'écrire au-delà de propose/a_valider/archive. Jamais « valide ». OK.
- Critère 3 (route) : `garderPorte` (jeton à temps constant, contrat 2, liste blanche de champs) → `statut`, `valideeLe`, `valideePar`, `origine`, `programme` rejetés en 400 `champ_invalide`. Le proxy couvre aussi `/api/usine/*` (double contrôle du jeton). Rejeu de la même `cle` sans `entreeId` : aucun doublon, rattrapage d'une création restée à « propose ». OK.
- Forme cohérente avec l'appel 1 (`commandes/route.ts`) : mêmes regex, même gestion `statut`/`terminer`, même forme d'erreur.
- Aucun nom de personne, aucun prix dans le diff.
- Tests relancés : `npx vitest run tests/porte-v2` → **4 fichiers, 45 tests verts**.
- Interfaces injectées : aucune. CAL-21 (`validerEntree`) n'est pas appelée (correct : la validation reste un geste du fondateur) ; L0-13 n'apparaît nulle part sur master et rien n'en dépend ici. Donc aucune interface fictive à risque.

## À corriger (bloquant)

1. **Critère 2 violé : un décalage du fondateur sur une entrée d'origine usine est écrasé.** `src/services/porte-programmations.ts:116-124`.
   `decaler()` (`src/services/plan-editorial.ts`, action fondateur `calendrier/actions/decaler.ts`) ne change pas `origine` : l'entrée reste « usine » avec `decalages: 1`. Rien sur master n'écrit jamais `origine: "vous"`. `ecritureDatePermise("usine","usine")` laisse donc passer, et la révision par `entreeId` remet la date de l'usine.
   Essai reproduit : création 10/12 → fondateur décale au 15/12 (`decalages: 1`) → usine envoie `entreeId` jour 11/12 → réponse 200, entrée au **11/12**. La date choisie par le fondateur est perdue, sans ligne de journal.
   Correction minimale : refuser la révision dès que `cible.decalages > 0` (ou `valideeLe`/`valideePar` présents) → `date_du_fondateur_conservee`. Plus un test qui fait `decaler()` avant la révision.

2. **Révision hors ordre : un ancien message rejoué remet une date périmée.** `porte-programmations.ts:116-124`. La `cle` est ignorée dans la branche `entreeId` : aucune trace de la révision appliquée.
   Essai : révision A (12/12) puis rejeu tardif de la révision B plus ancienne (11/12) → entrée au **11/12**. Ce n'est pas un doublon, mais le rejeu a un effet. Garder la dernière clé appliquée (par ex. `repereUsine` ou un paramètre `prog-rev:<cle>`) et ne rien faire si la clé est déjà connue ; ou refuser `entreeId` tant que le contrat de l'appel 4 n'est pas confirmé (le journal, ligne 13, dit lui-même que la forme n'est pas confirmée).

3. **La révision écrit une entrée incohérente et contourne la validation du créneau.** `porte-programmations.ts:122`.
   `enregistrer({...cible, jourVise, heuresParReseau: {...cible.heuresParReseau, [p.reseau]: p.instant}})` : si l'usine vise un autre réseau, on garde l'heure de l'ancien jour sur le premier réseau. Essai : instagram au 10/12 17:00 + révision linkedin au 11/12 → `jourVise: 2026-12-11` et `instagram: 2026-12-10T17:00Z`. `validerCreneau` n'est pas appelé (contrairement à `creerCreneau`). `compteCible`, `videoId` et `visuelId` reçus sont ignorés sans le dire. Il faut recalculer toutes les heures sur le nouveau jour, comme `decaler()`, ou n'accepter que le même réseau, puis valider avant d'enregistrer.

4. **Pas de « Tout arrêter » : incohérent avec l'appel 1.** `src/app/api/usine/programmations/route.ts:41-46`. `commandes/route.ts` renvoie 423 `tout_arrete` sans rien écrire quand `USINE_TOUT_ARRETER` est actif ; ici, essai avec `USINE_TOUT_ARRETER=1` → **201, entrée créée**. Reprendre le même contrôle, en premier, avec un test.

## À corriger (non bloquant, mais à faire dans la même passe)

5. `entreeId` inconnu → crée silencieusement une entrée neuve (`porte-programmations.ts:117-126`, essai : 201). L'usine croit réviser et obtient une création. Préférer 404/409 `entree_inconnue`, ou documenter ce choix dans le contrat.
6. Retour trompeur : `{ etat: "recue", deja: true }` (ligne 124) quand rien n'a été écrit (entrée usine déjà validée ou programmée). Prévoir un état distinct (ex. `deja_validee`). `date_du_fondateur_conservee` porte aussi `deja: true` (ligne 109) sans que ce soit un rejeu.
7. Tests trop faibles sur la révision (`tests/porte-v2/programmations.test.ts:260-266, 277-286`) : le titre « déjà décalée ou validée » ne teste que « validée » ; la révision ne vérifie ni `heuresParReseau` ni l'ordre des messages. Ajouter : décalage du fondateur puis révision (refus attendu), rejeu hors ordre, autre réseau, `USINE_TOUT_ARRETER`. La mutation « garde d'origine retirée » du journal ne couvre pas le cas n° 1 : elle était crédible mais la garde elle-même est incomplète.
8. Journal, ligne 10 : « aucune interface injectée n'a donc été nécessaire » est vrai, mais la fiche demandait de le prouver pour L0-13 aussi. Ajouter une ligne : L0-13 absent de master, non utilisé.

## Ce qui bloque la fusion
- **Les points 1 à 4 ci-dessus** (code de cette PR) : seuls vrais bloquants.
- **CAL-21** : déjà sur master (`calendrier/actions/ajouter.ts:128`), non appelé. Ne bloque pas.
- **L0-13** : absent de master ; la PR n'en dépend pas. Ne bloque pas, sauf si la fiche L0-13 doit fixer le contrat de l'appel 4 (forme du corps, `entreeId`, codes 201/200). Dans ce cas, le plus sûr est de retirer `entreeId` de cette PR et de garder seulement la création.
- **RC-40** : sans objet. Aucun fichier Zernio ni d'envoi touché, la garde de zone est verte sans accord. **Aucun accord écrit nécessaire.**
- Contrat à confirmer côté usine (forme du corps, `entreeId`, 201/200) : à trancher par le fondateur avant d'ouvrir l'appel 4 en production. Ne bloque pas une fusion de la création seule.
