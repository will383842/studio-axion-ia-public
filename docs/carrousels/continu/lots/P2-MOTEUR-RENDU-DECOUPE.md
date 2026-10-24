# P2 — Moteur de rendu de la toile, découpe exacte, test pixel (après P1 fusionné)
Objectif : studio-rendu sait rendre UNE toile large, la mesurer, la découper en N JPEG exacts et les déposer. On le prouve avec X00 + PX + raccords R01-R03.
## À créer (studio-rendu)
- `studio-rendu/compositions/visuels/continu/constantes-continu.ts` : reprend `geometrie.ts` (import relatif `../../../../src/domaine/visuels/continu/geometrie`), polices, tailles de texte de la maquette (`.p` 38 px, `.sm` 31, `.lb` 24 → refuser < 26 : passer `.lb` et `.chip` à 26 minimum, `.foot` 25 → 26).
- `.../continu/polices-continu.ts` : chargement local (modèle `../polices.ts`, `delayRender`, `FontFace`, `policeTitrePrete`) de « Axion Bricolage » (variable 300-800), « Axion Instrument Serif » (normal + italique), plus Inter et JetBrains Mono existants. Si U+202F manque à Bricolage ou Instrument : face `unicodeRange:"U+202F"` prise dans Inter SemiBold (comme `polices.ts`).
- `.../continu/commun/` : `Fond.tsx` (crème, halos `radial-gradient` aux positions déclarées, fonds sombres par page, grain = motif SVG `feTurbulence` en image de fond carrelée 260 px, sans couleur littérale), `Entete.tsx` (`[data-entete]` : rubrique en pastille + marque « Axion-IA » en Instrument Serif), `Pied.tsx` (`NN / NN`, « glisser → » ou « enregistrer » sur la dernière page, rail de progression ; `[data-pied]`), `Primitives.tsx` (port fidèle de `tile()`, `sph()`, `spk()`, `.card` et variantes, `.pill`, `.bub`, `.tg`, `.tagx` de la maquette, en fonctions), `icones-continu.ts` (tracés `IC` de la maquette, sans couleur).
- `.../continu/ToileContinue.tsx` : props `{ toile, versions }`. Rend la toile N × 1080 : `Fond` → calque du parcours (`left = debut*1080`, `+45 px` en 3:4) → pour chaque page hors parcours, le composant du registre dans un conteneur `position:absolute; left:i*1080; width:1080; height:H` → `Entete`/`Pied` pour chaque page → raccords sur leurs coutures (`[data-a-cheval]`, centrés sur x = couture). Aucune page ne dessine son pied.
- `.../continu/registre-composants.ts` : `Record<type, (props) => JSX.Element>` assemblé depuis `gabarits/<famille>/index.ts` (fichiers vides sauf `essai/X00.tsx`), `parcours/index.ts` (`PX.tsx`) et `raccords/index.ts` (R01-R03). Fonctions seulement, aucun JSX au chargement.
- `.../continu/mesure/MesureToile.tsx` : enveloppe + mesures (§4.6 de la note) ; log `AXION-MESURE <nonce> {…}` avec les clés `debordements, taillePoliceMin, textes, textesSurCouture, textesHorsMarge, textesCoinReserve, intrusionsMetaP1, chevauchements, debordCouture1, traitsFinsSurCouture, pages, largeur, hauteur`. Réutilise `compterChevauchements`, `dessinsDe`, `TOLERANCE_PX` par import de `../commun/` ou `../../commun/` sans les modifier ; `zonesInterdites("meta",0)` de `src/briques/visuels/reseaux.ts`.
- `.../continu/mesure/Racine.tsx` + `index.ts` : `<Composition id="ToileContinueMesuree" … calculateMetadata={({props}) => ({ width: props.toile.pages.length*1080, height: HAUTEURS[props.toile.format] })}/>` (lis la doc Remotion 4.0.532 de `calculateMetadata`).
- `studio-rendu/src/paquet-toile.ts` : comme `paquet-mesure.ts`, entrée `compositions/visuels/continu/mesure/index.ts`.
- `studio-rendu/src/operations/toile-continue.ts` (modèle `visuel-page.ts`) :
  - paramètres connus : `proprietes`, `depotsPages`, `qualite` (90-95, défaut 95) ; aucune entrée ;
  - refuse une URL dans `proprietes` (`contientUneUrl`) ; chaque `depotsPages[i]` = `{cle, urlDepot}` passé par `exigerAdressePermise`, et leur nombre = nombre de pages ;
  - `validerProprietesToile` ; une erreur « Version de toile » donne `indisponible`, réessayable ;
  - `renderStill` PNG à scale 1 → `extraireMesure` (fonction existante) ;
  - FFmpeg : `crop=1080:H:i*1080:0` → `page-i.jpg` (`-pix_fmt yuvj444p -q:v 2`) ; mesure `ecartCoutureMax` en comparant, via `-f rawvideo -pix_fmt rgb24`, les colonnes 0 et 1079 de chaque JPEG avec celles du PNG ;
  - bande d'aperçu `scale=iw/4:-1` → `sortie` ;
  - dépôts ; mesures + `dureeMs`.
  - Fonctions PURES exportées et testées : `reglagesToile(parametres)`, `grapheDecoupe(i, hauteur)`, `verifierDepotsPages(liste, n)`.
- `studio-rendu/scripts/essai-toile.ts` (modèle `essai-l9.ts`, mais sans exiger `STUDIO_RENDU_NAVIGATEUR` : `ensureBrowser` sinon) : rend 4 toiles (PX+X00 : 4 pages en 4:5, 6 pages en 4:5, 10 pages en 4:5, 4 pages en 3:4). Le PNG est gardé dans le dossier de travail. **TEST PIXEL** : pour chaque i, la tranche PNG (crop sans perte) = colonnes [i·1080,(i+1)·1080) de la toile, octet pour octet ; concaténation des tranches = toile (0 trou, 0 remplacement serveur) ; colonne 1079 de la tranche i = colonne (i+1)·1080−1 de la toile, colonne 0 de la tranche i+1 = colonne (i+1)·1080 de la toile. Écrit `essais-visuels/continu/p2/mesures.json` (mesures, durées, octets, `ecartCoutureMax`) et échoue (code 1) sur toute faute.
- `studio-rendu/scripts/planche-toile.sh` : bande de chaque toile + pages côte à côte (ImageMagick `montage`), coutures marquées par un trait de contrôle ajouté SUR LA PLANCHE seulement.
## À modifier (existants)
- `studio-rendu/src/contrat.ts` et `src/fournisseurs/types.ts` : ajouter `| "toile-continue"` (une ligne chacun, commentaire « file courte : toile large rendue puis découpée »), et dans `OPERATIONS`. `tests/studio-rendu.test.ts` doit rester vert.
- `studio-rendu/src/index.ts` : `"toile-continue": async (d,c) => (await charger("toile-continue", () => import("./operations/toile-continue.js"))).toileContinue(d,c)` + préchauffage `paquetToile()` (une ligne `void import(...)`).
- `.github/workflows/tests-visuels.yml` : ajouter `"studio-rendu/src/operations/toile-*.ts"` aux deux listes `paths`.
- `src/domaine/visuels/continu/version.ts` : `"toile-continue/0"` → `"toile-continue/1"` (annoncer le cran).
## Tests ROUGES d'abord (`tests/visuels/continu-p2-*.test.ts`)
- `reglagesToile` refuse un paramètre inconnu, une qualité de 80 ou un `scale` présent.
- `verifierDepotsPages` refuse un nombre différent des pages, une adresse `http:`, une adresse hors stockage.
- `grapheDecoupe(2,1350)` contient `crop=1080:1350:2160:0`.
- Composition : `extraireMesure` accepte une ligne de toile complète et refuse une ligne sans `textesSurCouture`.
- `ToileContinue` est importable sans React global (le test `jsx-chargement-module` existant couvre le dossier).
- Studio : rien encore (le service vient en P5).
## Preuves attendues
Sortie de `npx tsx scripts/essai-toile.ts` (4 toiles, « TEST PIXEL : 0 trou, 0 remplacement serveur, colonnes de bord identiques »), `mesures.json`, durée de la toile de 10 pages (si > 30 s, l'écrire en tête de la PR), planche JPEG, bandes. Taille des JPEG par page.
## Pièges
Largeur ≤ 16 384 px (10 pages = 10 800 : OK) ; jamais scale 2. `delaiCourteMs` vaut 45 s, mesure le temps à froid. Le grain par `feTurbulence` sur toute la toile coûte cher : utilise un motif carrelé. Pas de trait fin ni de dégradé à bord net sur une couture. Bandes Meta de la page 1 : la rubrique (`[data-entete]`) est exclue, le titre non. Le PNG ne quitte pas le conteneur.
