# P1 — Modèle de la toile, schéma, registres vides, palette, polices
Objectif : poser le modèle `toile/1` et ses registres pour que P2 et P3 n'aient plus qu'à remplir. Rien n'est rendu dans ce lot.
## À créer
- `docs/carrousels/continu/ARCHITECTURE.md` : recopie des décisions ci-dessous (court).
- `src/domaine/visuels/continu/version.ts` : `export const VERSION_TOILE_SOCLE = "toile-continue/0";` (P2 passe à /1).
- `src/domaine/visuels/continu/geometrie.ts` (PUR) : `LARGEUR_PAGE=1080`, `HAUTEURS={"4:5":1350,"3:4":1440}`, `MARGE_SURE=80`, `COIN_RESERVE=200`, `BANDE_COUTURE=80`, `largeurToile(n)`, `coutures(n)` (x des coutures internes), `rectPage(i, format)`, `PAGES_MIN=3`, `PAGES_MAX=10`, `PAGES_DEFAUT_MAX=6`.
- `src/briques/visuels/continu/registre-gabarits.ts` :
  - types `FamilleContinu = "couverture"|"liste"|"comparaison"|"cas"|"donnees"|"appel"|"parcours"|"essai"` et `RoleGabarit = "couverture"|"contenu"|"relance"|"appel"` ;
  - `DefinitionGabarit { type: string; famille; nom; role; sombre: boolean; orangeFort: boolean; version: number; schema: z.ZodObject (strict, doit contenir type: z.literal(id), alt, rubrique?) ; exemple: objet qui passe le schéma (textes de la maquette) ; bordsLibres: { gauche: [number,number][]; droite: [number,number][] } (intervalles de y libres dans les 120 px du bord) ; cas?: boolean (étiquette Scénario type posée par le code) ; exigeFait?: boolean ; exigeAccord?: boolean ; actif: boolean; essai?: true }` ;
  - `GABARITS` = concaténation de `familles/{couvertures,listes,comparaisons,cas,donnees,appels}.ts` (chacun exporte un tableau VIDE en P1), de `familles/essai.ts` (X00) et des pages de parcours (`registre-parcours.ts`) ;
  - `GABARITS_PRODUCTION` = `actif && !essai`.
- `src/briques/visuels/continu/familles/*.ts` (6 fichiers vides + `essai.ts` avec **X00** : couverture/contenu/appel génériques `{type:"X00", alt, rubrique?, titre ≤ 40, texte ≤ 90}`, `bordsLibres` larges, `essai:true`, `actif:false`).
- `src/briques/visuels/continu/registre-parcours.ts` : `DefinitionParcours { id:"PA"…"PH"; nom; pages: 3|4; commence: boolean; termine: boolean; pagesTypes: string[] (ex. ["PA1","PA2","PA3","PA4"]); sombres: number[]; version }`. Liste VIDE en P1, plus un parcours d'essai `PX` (3 pages `PX1..PX3`, `essai:true`).
- `src/briques/visuels/continu/registre-raccords.ts` : `R01` sphère, `R02` tuile à icône, `R03` étincelle (données : `diametre`, `version`). Les composants viennent en P2.
- `src/domaine/visuels/continu/schema-toile.ts` : `construireSchemaToile(gabarits, parcours, raccords)` → `ToileSpec` zod strict + `superRefine` qui applique les règles (§ décisions 2) avec des messages FRANÇAIS précis (« la page 3 : … »). Exporte `ToileSpec` (registre complet) et le type `ToileSpecType`. Les textes passent par `texteSansLien` (import de `../schema`).
- `src/domaine/visuels/continu/proprietes-toile.ts` : `validerProprietesToile(brut)`. Clés permises : `toile` et `versions` (versions = `{socle, gabarits: Record<type,number>}`). Refuse une clé inconnue, un socle ou une version de gabarit différents, avec un message qui commence par « Version de toile » (studio-rendu le traduira en « indisponible »). Retourne `{ toile, versions }` validés.
- `src/domaine/visuels/continu/empreinte.ts` : `empreinteToile(toile)` = sha256(socle + versions des gabarits, parcours et raccords utilisés + `canonique(toile)`). `canonique` est importé de `src/visuels/services/rendu`… INTERDIT : ce fichier n'est pas copié dans l'image et le domaine ne doit pas dépendre des services. **Recopie** `canonique` (6 lignes) dans `src/domaine/visuels/continu/canonique.ts`.
- Polices (OFL, fichiers dans le dépôt, aucun chargement externe) : `studio-rendu/compositions/commune/polices/BricolageGrotesque-Variable.ttf`, `InstrumentSerif-Regular.ttf`, `InstrumentSerif-Italic.ttf`, `OFL-BricolageGrotesque.txt`, `OFL-InstrumentSerif.txt`. Source : dépôt google/fonts, `ofl/bricolagegrotesque/` et `ofl/instrumentserif/`. Repli : paquets npm `@fontsource-variable/bricolage-grotesque` et `@fontsource/instrument-serif`, fichiers recopiés. Dans `README` des polices, noter l'URL source et le sha256.
## À modifier (existants)
- `src/briques/visuels/charte-carrousel.ts` : ajouter, SANS toucher `CHARTE_CARROUSEL` :
  - `CHARTE_CONTINU` (jetons nommés : `creme`, `encre`, `orange` repris de `CHARTE_CARROUSEL`, puis `creme2 #EDE2D1`, `blancCarte #FFFBF4`, `peche #F7DCC8`, `orangeClair #F08A52`, `orangeLumiere #FFA66E`, `orangeProfond #C4501F`, `orangeBrule #B8481A`, `encreDouce #241C15`, `brun #3A2D22`, `brunClair #52412F`, `brunNuit #1D1510`, `nuit #0E0905`, `brunPierre #5B4B3E`, `abricot #FFD2AE`, `rouille #8F3410`, `cuivre #C9511D`, `ecume #FFF4E8`, `rosePeche #FDEBDD`, `peau #F2C6A2`, `grisTexte #51463B`, `sableSombre #CDBFAE`, `lin #CFC3B1`) ;
  - `alpha(couleur, a)` → `color-mix(in srgb, <couleur> <a*100>%, transparent)` ;
  - `degrade(angle, arrets)` → chaîne `linear-gradient` ;
  - `DEGRADES_CONTINU` (tuile o/k/w/p/g, carte o/k/pl, bouton, barre ; valeurs exactes = lignes 118-122, 145-154 et 287-288 de la maquette).
- `src/domaine/visuels/visuel.ts` : `famille: "carrousel" | "carrousel-continu"` ; `toile?: ToileSpecType` ; `renduToile?: { empreinte: string; format: "4:5"|"3:4"; pages: { index: number; cle: string }[]; bandeCle: string; vignetteCle: string; renduLe: string }`. Rien d'autre. `carrousels.ts` ne change pas (il écrit toujours `"carrousel"`).
## Tests ROUGES d'abord (`tests/visuels/continu-p1-*.test.ts`)
- `continu-p1-geometrie` : `largeurToile(4)=4320`, `coutures(4)=[1080,2160,3240]`, `HAUTEURS["3:4"]=1440`.
- `continu-p1-schema` : une toile X00 + PX valide passe. ROUGES :
  - 2 pages, 11 pages, clé inconnue, « www.exemple.fr » dans un texte, type inconnu ;
  - pages PX dans le désordre ou incomplètes, deux parcours ;
  - deux pages sombres, la même plaquette deux fois ;
  - raccord sur une couture interne au parcours, raccord sur la couture 0 ou N ;
  - format « 1:1 », `alt` de page > 125 ;
  - page 1 qui n'est pas une couverture alors que le parcours ne commence pas ;
  - chaque message est en français et nomme la page.
- `continu-p1-proprietes` : socle différent → erreur « Version de toile… » ; version de gabarit différente → même erreur ; clé inconnue → refus.
- `continu-p1-registre` : chaque gabarit a un schéma strict dont `exemple` passe ; `type` unique ; `famille` connue ; X00 et PX sont exclus de `GABARITS_PRODUCTION`.
- `continu-p1-charte` : contrastes `contrasteWcag` (encre/crème ≥ 4,5 ; grisTexte/crème ≥ 4,5 ; sableSombre/encre ≥ 4,5 ; crème/encreDouce ≥ 4,5). `alpha("#000000",0.1)` donne une chaîne `color-mix(...)`.
- `continu-p1-polices` : les 3 fichiers + leurs licences existent. La table cmap contient A-Z, a-z, « éèêàçùœ’« » ». Si U+202F manque, le test l'ÉCRIT dans la sortie (P2 ajoutera la face de repli) ; recopie la fonction `codesCmap` de `tests/visuels/polices.test.ts`.
## Preuves
Sorties rouges puis vertes ; `pnpm tsc -p tsconfig.visuels.json` vert ; aucun test existant cassé (`pnpm vitest run tests/visuels`).
## Pièges
Union discriminée zod sur `type` construite dynamiquement : passer un tableau d'au moins 2 schémas. `superRefine` sur la toile entière (pas par page). Ne mets AUCUN chiffre dans un texte d'exemple. Tous les `exemple` reprennent mot pour mot les textes de la maquette (vouvoiement).
