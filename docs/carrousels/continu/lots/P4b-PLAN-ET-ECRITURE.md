# P4b — Planificateur et écriture des textes : branche `carrousels/continu-p4b` (après P1+P2 ; ses essais utilisent les familles déjà fusionnées)
## À créer
- `src/briques/visuels/continu/plan-toile.ts` (PUR, sans IA) :
  - signature : `choisirPlan({ sujet, version, intention?, recents: EmpreinteCarrousel[], familles?: FamilleContinu[], variete: "sobre"|"equilibre"|"varie", pagesCible?: number, format })` → `{ parcours, types: string[], raccords }` ;
  - graine : fnv1a recopié ;
  - préférence par intention : eveil → PC, PD, PB ; methode → PA, PG, PH, PF ; preuve → PB, PE, PF ;
  - composition : [couverture si `!commence`] + parcours + 0-3 contenus + [A02 facultatif] + [appel si `!termine`] ; total 3-6, ou `pagesCible` ≤ 10 ;
  - familles minimales : sobre 2, équilibré 3, varié 4 ;
  - raccords : R01-R03 posés au milieu de l'intersection des `bordsLibres`, sur chaque couture hors parcours, et TOUJOURS sur la couture 1/2 si le parcours ne commence pas ;
  - anti-répétition : `premierSansRepetition` de `memoire-carrousels.ts` ;
  - seuls les gabarits de `GABARITS_PRODUCTION` ; si les familles cochées rendent le plan impossible, une phrase claire.
- `src/visuels/continu/texte/simulation-toile.ts` : remplit le plan avec les `exemple` du registre ; le titre de couverture = sujet s'il tient dans son budget, sinon une `note` (« sujet non repris : trop long pour la couverture ») ; `version` décale les choix.
- `src/visuels/continu/texte/session-toile.ts` : `Paquet` zod `{ version:"paquet-session-toile/1", sujet, titre, pourquoi[] (une par page), toile: ToileSpec }` + `lirePaquetToile(contenu)` (phrases françaises comme `session.ts`, 64 Ko au plus).
- `scripts/visuels/ecrire-consigne-toile.ts` → génère `scripts/visuels/consigne-session-toile.md` depuis les registres : format, règles, table type → champs → budgets, plan proposé.
## Tests ROUGES d'abord
- Déterminisme : même entrée, même plan.
- `version+1` → autre plan.
- Jamais deux familles identiques à la suite ; jamais 2 pages sombres ; PA et PH → exactement 4 pages.
- Couverture décochée et parcours qui ne commence pas → autre parcours.
- Récents → pas la même suite.
- Raccord présent sur la couture 1/2.
- `consigne-session-toile.md` à jour (le test régénère et compare).
- Paquet invalide → phrases précises.
