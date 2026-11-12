# Sans prix — lot fin (2026-11-11)

Branche `sans-prix-lot-fin-2026-11-11`, depuis `sans-prix-lot-2026-11-11` (9bde1702) + fusion de `origin/master` (aucun conflit).

## Vérifications
- `pnpm install --frozen-lockfile` (le dépôt n'a pas de `package-lock.json` racine : `npm ci` est impossible, pnpm-lock.yaml fait foi).
- `npx tsc --noEmit -p .` : 146 erreurs, **identiques à master** (toutes préexistantes, surtout dans `tests/`) ; le lot n'en ajoute aucune.
- Tests lancés : `src/briques`, `tests/harmonisation`, `tests/tableau`, et les fichiers touchés `aucun-prix-affiche`, `correcteur-ui2`, `d2-credits`, `e2e-verif2-limites`, `k-effet-realiste`, `m3-votre-video`.
  Premier passage : 10 rouges sur 3006. Après correction : seuls restent 2 rouges, présents aussi sur master.

## Tests ajustés (texte seulement, vérifications gardées ou durcies par « pas de € »)
- `tests/tableau/taches/taches-fond.test.ts` : apostrophe échappée (`&#x27;`) dans le HTML rendu.
- `tests/tableau/raccords-2/ecran-generateur.test.ts`, `tests/tableau/relecture/relecture-serveur.test.ts` : boutons « Découper en scènes » / « Fabriquer la vidéo » sans prix.
- `tests/harmonisation/suivi-generique.test.ts`, `suivi-facecam.test.ts`, `fiche-generique.test.ts` : plus de « Déjà payé : x », plus de montant payé après l'arrêt, plus de chiffres de coût sur la fiche vidéo.
Aucun code, condition, calcul ni blocage de dépense modifié.

## ProgressionEtapes.tsx et Fabrication.tsx
Aucun montant affiché restant : le champ `depense` de `SuiviProgression` n'est plus lu à l'écran, et `Fabrication.tsx` ne passe plus de dépense visible (les phrases d'arrêt ne contiennent plus de montant). Rien à modifier.

## Points laissés
- `tests/harmonisation/image-video-adaptateurs.test.ts` (attend `<BarreActionCollee><BoutonFabriquer` dans `Depot.tsx`) : rouge sur master aussi, sans lien avec les prix.
- `tests/tableau/souffle-voix/souffle-voix.test.ts` (vrai son FFmpeg) : rouge sur master aussi.
- Les 146 erreurs tsc de master.
- Champ mort `depense` dans `SuiviProgression` (type seulement) : laissé.
- Tests des autres dossiers non touchés par le lot : non lancés.
