# sans-prix-credits-2026-11-11 — aucun montant dans les cartes de crédit

**Cause** : l'Accueil et Réglages › Crédits affichaient encore des montants (« 180,97 $ », « ce mois / plafond », « réservés », « expirent »).

**Fait (affichage seulement, aucun calcul/plafond/blocage/accord modifié)**
- Nouveau `src/domaine/niveau-credit.ts` : niveaux en mots (« Crédit suffisant » / « À recharger bientôt » / « À recharger »), mêmes seuils que le bandeau (`SEUIL_VIDEOS_ALERTE`, jauge, `SEUIL_PRESQUE_VIDE_CENTIMES`). Claude en abonnements : « Presque épuisé » / « Épuisé jusqu'au renouvellement » (un forfait ne se recharge pas).
- `CarteCredits` (Accueil) : niveau + « ≈ N vidéos restantes » (calcul existant), plus de solde ni d'étiquette de solde.
- `CarteCreditClaude` (Accueil) : niveau en mots, « ≈ N scripts restants » (coût moyen par script déjà présent, via `videosRestantes` de la carte Claude, passé depuis `page.tsx`), plus de total ni de « consommé ce mois-ci ».
- `Credits.tsx` : niveau à la place du solde ; retirés « Ce mois / plafond », « réservés », montant des expirations.
- `CreditClaude.tsx` : niveau par compte et au total ; retirés « dépensé ce mois-ci » et « 200 $ » de l'aide.
- `ConfirmationPrix`, `BandeauCredits`, `EstimationCout`, `Connexions.tsx`, `Cloche` : déjà sans montant, non modifiés.
- Tests : `tests/source-claude/carte-credit-claude.test.ts` ajusté (absence de $/€) ; nouveau `tests/sans-prix-credits.test.ts`.

**Champs de saisie conservés (Réglages)** : « Crédit du cycle ($) », « Solde relevé dans la Console ($) » (CreditClaude) ; « Montant ($) » de la feuille « J'ai rechargé » (Credits).

**Résultats** : vitest sur tests/source-claude, d2-credits, chiffres-ecrans, final-b-accessibilite, theme-clair, sans-prix-credits : 15 fichiers, 228 tests verts. `npx tsc --noEmit -p .` : aucune erreur nouvelle (erreurs existantes sur master : types Next générés `RouteContext`/`LayoutProps`, `remotion` dans docs/, 20 erreurs dans tests/zernio).

**Points laissés**
- `src/domaine/credits.ts` (`messageAlerteCredit`, `messageEpuise`) compose encore « Il reste 12,00 $ » / « Solde … » dans les notifications de la cloche (le composant Cloche n'affiche que le texte reçu). À corriger côté domaine ; les textes passent par `services/credits.ts` (interdit), qui fournit `disponibleTexte`.
- `CarteCredit` (type de `services/credits.ts`, interdit) porte toujours les champs texte en $ ; ils ne sont simplement plus affichés.
- Réglages « Montage réel … avec son prix » (commentaire de type seulement) : aucun montant affiché dans Connexions.tsx.
