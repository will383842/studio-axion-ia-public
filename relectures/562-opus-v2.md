# Relecture PR 562 (lot AUT-G) — Opus, v2

VERDICT : À CORRIGER (tête dd4e1b9515cb670bfe914c72c47a8920fc3ea66a)

1. (f) — 2 tests EXISTANTS, verts sur master, sont ROUGES sur la PR (déjà signalé en v1, non traité par dd4e1b95) ;
   ni modifiés, ni listés dans `scripts/echecs-connus.json`, mais la règle « tests existants verts » est violée :
   - `tests/voix/voix-epinglee-image-video.test.ts:130` : `toEqual({ videoId: "v1", travailId: "t1" })` reçoit en plus `cleUsine`
     (site `src/services/image-video.ts:323`).
   - `tests/cas-concret/services/branchements/branchements.test.ts:205` : même `toEqual` dans le faux `verifierEtReserver` ;
     l'exception fait échouer le travail → `expected 'echec' to be 'termine'` (ligne 209) (site `src/services/cas-concret-branchements.ts:687`).
   Gravité : BLOQUANTE pour la fusion (suite rouge), sans risque d'argent. Piste : seul l'ajout attendu de `cleUsine` les fait
   rougir ; il faut une décision explicite du responsable pour RENFORCER ces 2 assertions (ex. `{ videoId, travailId,
   cleUsine: expect.stringMatching(/^t1#voix-/) }`, qui ferait aussi tenir la clé par un vrai appel et pas seulement par une
   regex du source) — ou toute autre voie qui laisse ces 2 tests verts sans les affaiblir.

Tout le reste est OK : la FAILLE HAUTE de la v1 est corrigée (b), les mutations rougissent (c), concurrence (d) et Studio (e)
sans régression, tsc 146 = 146, eslint propre, aucun nom de personne ni montant codé en dur.

Suite complète (vitest, master vs PR, même machine) : master 27 485 verts / 274 rouges ; PR 27 496 verts / 276 rouges ;
différence = +13 nouveaux tests AUT-G verts et EXACTEMENT les 2 rouges ci-dessus ; aucun autre test ne change d'état.

Tête relue : origin/usine/AUT-G = dd4e1b9515cb670bfe914c72c47a8920fc3ea66a
Base : origin/master = 98af97a52d48927986b01dcd886b3a4e13caa8f5 (= merge-base)

## Détail par point

- Diff : exactement les 10 fichiers attendus, aucun autre.
- (f) FAILLE (déjà signalée en v1, NON corrigée par dd4e1b95) : 2 tests existants verts sur master (27/27) sont ROUGES sur la PR :
  - `tests/voix/voix-epinglee-image-video.test.ts` « une vidéo : réserve le prix de la voix… » : attend `demande` égale à
    `{ videoId: 'v1', travailId: 't1' }`, reçoit en plus `cleUsine`.
  - `tests/cas-concret/services/branchements/branchements.test.ts` « S1b · budget… » : `expected 'echec' to be 'termine'`.
  Absents de `scripts/echecs-connus.json`. Le journal affirme « aucun test existant modifié » mais ne dit pas qu'ils rougissent.
- (e) OK : sonde jetable rejouée à l'identique sur master et sur la PR (24 scénarios) : origine absente / « studio » ×
  interrupteur absent / éteint / actif × (3 commandes, changement de mois, sans budget) → 18 scénarios Studio STRICTEMENT
  identiques (résultats, engagement, registre, ET nombre de lectures des dépôts : 143 / 84 / 56). `BUDGET_USINE_ABSENT`
  (Usine, interrupteur absent ou éteint) et changement de mois Usine : mêmes résultats ; seules les lectures de l'Usine active
  changent (98→103, 144→150), attendu.
- (a) OK : sonde jetable (vrai `credits.ts`, dépôts mémoire, 0 €, travail `en_cours` enregistré, clés `T#${nouvelId("voix")}`
  comme aux 4 sites) : 15 € + 2×2 € → registre 1900 ; 18 €, 5 € et 1,01 € REFUSÉES `USINE_PLAFOND_ATTEINT` ; 1 € acceptée
  (égalité au plafond) → 2000.
- (b) OK — FAILLE HAUTE de la v1 CORRIGÉE (`src/services/autonomie-usine.ts:146-150`) : horloge avancée à +16 min, +60 min,
  +6 h, +3 j et jusqu'au 30/11 22:00 UTC (dernier soir du mois de Paris) : registre 1900, engagement 1900 ; 5 € et 18 €
  REFUSÉES, une 3e voix de 2 € REFUSÉE, 1 € acceptée. Fin du travail à +60 min (« consommee » ou « liberee », 16,50 € payés) :
  registre = 1650 (payé seul), engagement 0 ; 3,51 € refusée, 3,50 € acceptée ; libération répétée 3 fois (même issue puis
  issue inverse) : aucun changement (pas de double libération). « liberee » sans paiement : registre 0, engagement 0, 20 €
  acceptée. Mois suivant : l'ancien registre ne compte plus.
  Observation (non bloquante, côté prudent) : si le travail finit moins de 15 min après les lectures, les clés de voix
  restent comptées à leur accord pendant la fenêtre « en vol » (4 € de trop pendant ≤ 15 min, puis 0). Sur-comptage
  temporaire, jamais de fuite.
- (d) OK : `Promise.all` à 1 centime du plafond : 2 commandes → exactement 1 acceptée (registre 2000) ; 2 voix + 1 commande →
  1 seule acceptée, registre ≤ 2000 aussi 4 h après ; 3 `depenserSelonOrigine` à 2 centimes du plafond → 2 acceptées, `payer`
  lancé 2 fois seulement. Double clic du lancement (même travail, `Promise.all`) : registre 1500, engagement 1500 (pas de
  double engagement).
  Observation (non bloquante, inatteignable par les 4 sites qui tirent un `nouvelId` par appel) : la MÊME clé de voix
  rejouée deux fois → 2 « ok », registre +200 une fois, engagement +400 ; l'écart est du côté prudent pour l'engagement,
  mais le registre ne compte qu'une lecture si les deux étaient payées. L'idempotence reste aux appelants (journal).
- (c) OK : mutations appliquées une à une sur la PR, suites `tests/autonomie-usine-cle-depense*.test.ts` (13 tests) :
  clé = travailId aux 4 sites → ROUGE (4) ; clé retirée aux 4 sites → ROUGE (4) ; clé = travailId sur un seul site
  (tutoriel) → ROUGE (1) ; `couts.ts` « remplacer » (`dejaEngage = 0`) → ROUGE (2) ; `autonomie-usine.ts` « ajouter » ignoré
  → ROUGE (2) ; suppression du maintien dans le temps (`autonomie-usine.ts:146-150`) → ROUGE (2) ; `credits.ts`
  `cumuler: false` → ROUGE (1). La détection des 4 sites est une lecture du source (regex), pas un appel réel : suffisant
  pour la mutation demandée.
- (f) Bilan : tsc 146 = 146 (liste d'erreurs identique à master, aux numéros de ligne près) ; eslint des 9 fichiers .ts
  touchés : propre ; aucun test existant modifié, aucune assertion affaiblie, `scripts/echecs-connus.json` inchangé ;
  aucun nom de personne dans les lignes ajoutées ; aucun montant codé en dur dans `src/` (les 20 € ne sont écrits que dans
  les dépôts mémoire des essais). MAIS les 2 tests rouges ci-dessus → FAILLE (voir verdict).
- Sondes jetables (non poussées) : `sonde-562-studio` (24 scénarios master/PR) et `sonde-562-argent` (16 cas a/b/d), tous verts sur la PR.
