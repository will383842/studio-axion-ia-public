# Relecture PR 562 (lot AUT-G) — Opus, v2

VERDICT PROVISOIRE : en cours (tendance : À CORRIGER — voir (f))

Tête relue : origin/usine/AUT-G = dd4e1b9515cb670bfe914c72c47a8920fc3ea66a
Base : origin/master = 98af97a52d48927986b01dcd886b3a4e13caa8f5 (= merge-base)

## Avancement

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
