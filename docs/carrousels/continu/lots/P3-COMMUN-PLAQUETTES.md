# Partie commune à P3a…P3h (à coller AVANT la consigne de chaque P3x)
Pré-requis : P1 et P2 fusionnés. Source : `docs/carrousels/continu/MAQUETTE-v3.html`. Les plaquettes sont les appels `add('<Famille>','<Nom>', function(){…})` (l. 319-428), les parcours sont `PANOS.push({id:…})` (l. 448-545), les primitives `tile/sph/spk/pg/T/P/card/num/sc` (l. 286-298, 432-446).
Pour CHAQUE plaquette du lot :
1. Entrée du registre dans `src/briques/visuels/continu/familles/<famille>.ts` :
   - `type`, `nom`, `famille`, `role`, `sombre` (maquette `dk:1`), `orangeFort` (`or:1`, ou carte orange > 12 % de la page), `version: 1`, `actif` ;
   - `schema` strict : un champ par texte visible de la maquette (titre, accent en italique dans un champ séparé `accent`, items…). Les étiquettes fixes (« Scénario type · exemple illustratif » = `textesFixes.t26Etiquette`, « Sans » / « Avec », numéros, pied) sont POSÉES PAR LE CODE et ne sont pas des champs ;
   - `exemple` = textes de la maquette ;
   - `bordsLibres` mesurés ;
   - `alt` d'exemple.
2. Composant `studio-rendu/compositions/visuels/continu/gabarits/<famille>/<ID>.tsx`, port FIDÈLE : mêmes tailles, mêmes positions, mêmes objets illustrés, en primitives P2 et jetons `CHARTE_CONTINU`. `.main` (padding 52/0/150) et marges 80 sont repris.
3. Budgets MESURÉS : contenus moyen (maquette), minimal, maximal (budget plein, mots longs « professionnalisation », « automatiquement »). Si un texte déborde, baisser le budget du schéma ; jamais réduire la police sous 26 px.
4. Essai réel : `studio-rendu/scripts/essai-continu-<famille>.ts`. Chaque plaquette est posée seule au milieu d'une toile X00 de 3 pages, en 4:5 et en 3:4. Les mesures doivent toutes être à 0 et la police ≥ 26.
5. Planche avant/après : capture de la maquette (Playwright permis ICI seulement, script hors dépôt) à côté du rendu Remotion. Fichier `studio-rendu/essais-visuels/continu/<lot>/planche-avant-apres.jpg`.
Tests ROUGES d'abord (`tests/visuels/continu-<lot>.test.ts`) :
- chaque `exemple` passe son schéma ; un texte au budget + 1 échoue ;
- un champ « étiquette » inexistant est refusé (strict) ;
- `sombre`/`orangeFort` sont conformes à la maquette (table attendue écrite dans le test) ;
- `version >= 1` ;
- le composant est déclaré dans `registre-composants` pour chaque `type` du registre.
Ne touche QUE les fichiers de ta famille (+ `gabarits/<famille>/index.ts`). Aucun changement de `VERSION_TOILE_SOCLE`.
