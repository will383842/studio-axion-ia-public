# P4 — Porte et note « continuité » (OPUS) : branche `carrousels/continu-p4` (après P1+P2 ; peut tourner pendant P3)
## À créer
- `src/domaine/controles-visuel/rythme-continu.ts` (PUR) : `controlesStructureToile(toile)` → `ControlePorte[]`. Rouge :
  - deux pages consécutives de même famille hors parcours ;
  - gabarit `actif:false` ou `exigeFait` ou `exigeAccord` utilisé ;
  - plus de 2 pages `cas` ; plus d'une page `orangeFort` ; plus d'une page sombre.
  Orange : moins de 3 familles pour 5 pages ou plus.
- `src/domaine/controles-visuel/porte-continu.ts` : `controlerToile: (spec, ctx: ContextePorte) => { rapport: RapportPorte (version "porte-carrousel/1"), specCorrige? }`.
  - `ToileSpec.safeParse` (messages français, modèle `phraseSchema` de `porte.ts` recopié) ;
  - textes = `textesDe({ alt: toile.alt, pages: toile.pages })` (JAMAIS `format`, `parcours` ni `raccords`) avec les mêmes contrôles que `porte.ts` (`premierChiffre`, `classementDans`, `ctx.interditsDans`, `tutoiementDans`, `contientJAide`, `expressionsBannieDans`, `sortantsDans`, `partAnglais`) ;
  - `controlesStructureToile` ;
  - mémoire : `controlesMemoire` sur l'empreinte {suite: parcours + types, couverture: type de la page 1} ;
  - `corrigerTypographie` n'est PAS réutilisé (il est typé `CarrouselSpec`) : recopie `espacerPage`/insécables via `transformerTextes` + fonctions de `src/briques/visuels/typographie-francaise.ts`.
- `src/domaine/controles-visuel/note-continu.ts` : `noterToile(toile, mesures?)` → `{ total, criteres[], bloquants[] }`. Grille (= écran de la maquette) :

| Critère | Points | Règle |
|---|---|---|
| Page 1 lisible seule | 15 | titre ≤ 10 mots, `intrusionsMetaP1 = 0`, élément à cheval sur la couture 1/2 |
| Aucun mot coupé par une couture | 12 | `textesSurCouture = 0` ; ÉLIMINATOIRE |
| Texte ≥ 26 px mesuré | 12 | ÉLIMINATOIRE |
| Contraste, orange en grands titres | 8 | |
| Zone sûre | 10 | marges + coin ; 7/10 si un texte est à moins de 100 px d'une couture |
| Charte, mots interdits, faits | 15 | ÉLIMINATOIRE (verdict de la porte) |
| Diversité des familles | 8 | |
| Signal de défilement | 5 | `debordCouture1 ≥ 1` |
| Texte du post | 6 | P7 |
| Un seul appel en dernière page | 6 | |
| Accessibilité (alt de chaque page) | 3 | |

  Une mesure absente vaut 0 au critère. Seuils exportés : `SEUIL_PRESENTE=90`, `SEUIL_RETOUCHE=85`. Polices permises : `["Axion Bricolage","Axion Instrument Serif","Axion Inter","Axion JetBrains Mono"]`.
## Tests ROUGES d'abord (`tests/visuels/continu-p4-*.test.ts`)
- « Grenoble », « Aucun gain garanti », « J'aide », « tu », « www.x.fr », « 3 fois plus » sont rouges.
- `format:"3:4"` et `type:"PA1"` ne déclenchent PAS CHIFFRE.
- Deux familles « liste » à la suite → rouge. D01 utilisé → rouge. Répétition d'un des 5 récents → orange.
- Somme des points = 100. `textesSurCouture=1` → total plafonné et bloquant.
- Mesures absentes → critères à 0.
## Preuves
Sorties ; tableau des notes sur les toiles d'essai de P2/P3 (lecture de leurs `mesures.json`).
