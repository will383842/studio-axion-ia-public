# sans-prix-services-2026-11-11 — messages des services sans montant

## Cause
Des messages d'erreur, d'alerte, de cloche, de journal et de confirmation citaient un montant (€, $, plafond, « coûte au plus … »).

## Fichiers touchés (texte uniquement, aucune condition ni calcul changé)
`src/services/` : generation-claude, boucle-generation, plafond-sujet, credit-claude (« Épuisé », « Expiré »), image-video-{ecran,texte,scripts,lot}, creation-format, cas-concret-relance, cas-concret-retouches, tableau-creation, tableau-vue, serie-ecriture, fabrication, comite-editorial, depense-claude-video, suppression-video, reglages.
Tests ajustés : r8-correctifs, suppression-video-service, credit-restant-corrections, tableau/creation, garde-fous-budget, e2e-verif1-d-interrupteurs, garde-ecran.

## Résultats
- `npx tsc --noEmit -p .` : 172 lignes d'erreur, identiques à master (remotion absent, types Next `RouteContext`/`LayoutProps`) ; aucune dans `src/services`.
- Lot des 35 fichiers de tests touchant ces textes : mêmes 25 échecs que sur master (r8-bout-en-bout, e2e-verif1-bc-serie, r2-textes-publication, g4c-corrections, garde-ecran jargon, garde-fous-budget « toute seule »), aucun nouvel échec. Suite complète non terminée (dépasse 15 min).

## Points laissés
- Fichiers interdits contenant encore des montants dans leurs messages : `src/services/budget-mensuel.ts` (l. ~159, passe un prix à `messageAuDelaDuBudgetIndicatifClaude`), `src/services/credits.ts` (l. ~346 « Confirmez ce prix », « coûte au plus {prix} »), `src/services/mode-budget.ts` (paramètre `prixAnnonce`), `src/services/publications.ts` s'il en a.
- Champs de données de prix (`prix`, `cout`, `phrase: "environ …"` dans cas-concret, cas-concret-vue, cas-concret-retouches, generateur-depenses `resumeDepense`, totaux de crédit `formaterDollars` dans credit-claude, `prixJugementDirect`) : affichages de fiche de prix, pas des messages ; à traiter avec le lot « sans prix » de l'interface.
- `src/domaine/**` (phraseAttenteCredit, phraseAttenteSeuil…) hors périmètre.
- `src/app/api/**` : aucun message avec montant trouvé hors `usine/`.
