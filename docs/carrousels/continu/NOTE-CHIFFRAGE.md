# P0 — Note de chiffrage « carrousel continu » (25/10/2026)
Base lue : dépôt PUBLIC will383842/studio-axion-ia-public, `origin/master` = bdbc329 (après `git fetch`). Maquette validée par le commanditaire le 25/10 : `MAQUETTE-CARROUSEL-CONTINU-v3.html` (27 plaquettes, 8 parcours, toile N × 1080).

## 1. Comment le pipeline actuel fabrique un carrousel (de la fiche au JPEG)
1. Écran `src/app/(studio)/carrousels/nouveau/actions.ts` → `creerDepuisFormulaire` (`src/visuels/services/creation.ts`) → `creerDepuisSujet` ou `deposerSession` (`src/visuels/services/carrousels.ts`).
2. `demarrer()` : `exigerAllume` (interrupteur `carrousels.actif`, `src/visuels/interrupteur.ts`, éteint par défaut), `fournisseurPermis` (simulation ou session ; le mode « api » est refusé), anti double clic (60 s), puis création d'un `Visuel` `vis_<uuid>` à l'état « brouillon » dans `depots().visuels`. C'est une collection JSON générique (`src/donnees/postgres/index.ts`, ligne « visuels »).
3. `rediger()` : `recentsDe()` (empreintes des 5 derniers, `memoire-carrousels.ts`) → `fournisseur.ecrire` (`src/visuels/texte/simulation.ts` : gabarits figés + fnv1a ; ou `session.ts` : paquet `paquet-session-carrousel/1`) → `deps.porte` = `controlerCarrousel` (`src/domaine/controles-visuel/porte.ts` : schéma Zod `CarrouselSpec`, textes via `textesDe`, `controlesStructure` de `rythme.ts`, `controlesMemoire`, `corrigerTypographie`) → statut « ecrit » ou « bloque ».
4. `after()` → `lancerRendu()` → `deps.rendre` = `rendreCarrousel` (`src/visuels/services/rendu.ts`). L'empreinte vaut sha256(`VERSION_RENDU` "visuel-page/10" + `canonique(spec validé)`). On consulte le registre `visuels.rendu.<empreinte>` (paramètres). Puis, page par page, ×1 et ×2 : `rendrePageVisuel` → `executerRendu` (`src/fournisseurs/rendu/attente.ts`) avec la demande `{operation:"visuel-page", file:"courte", parametres:{proprietes:{spec,index[,cadre]}, scale, jpegQuality:88}}`.
5. Côté studio-rendu : `studio-rendu/src/operations/visuel-page.ts` → `validerProprietesPage` (`src/visuels/proprietes-page.ts`, contrôle `VERSION_COMPOSITION`) → `renderStill` de la composition `VisuelPageMesuree` (paquet `src/paquet-mesure.ts`, entrée `compositions/visuels/mesure/index.ts`). `MesureVisuelPage.tsx` mesure le DOM et écrit `AXION-MESURE <nonce> {…}`. `extraireMesure` lit cette ligne, `deposer` envoie le JPEG à l'adresse signée, puis le studio refuse la page si débordement, police < 26 px, texte en zone réservée, chevauchement ou intrusion.
6. `assemblage-pdf` produit le PDF. La fiche passe « a_valider » avec `rendu.pages[x1Cle,x2Cle]`, `pdfCle` et `vignetteCle`. `rendreReseaux` (`rendu-reseaux.ts`, cadres linkedin/meta) est branché dans `dependancesCarrousels()` (commit 2c9f2f8) mais n'est appelé nulle part : `lancerRendu` n'appelle que `deps.rendre`.

## 2. Carte des fichiers existants (réutiliser / étendre / ne pas toucher)
| Fichier | Rôle | Pour le continu |
|---|---|---|
| `src/briques/visuels/registre-pages.ts` | `PAGES[type].famille`, budgets mesurés | Inspiration seulement : registre séparé `src/briques/visuels/continu/` |
| `src/domaine/controles-visuel/rythme.ts` | `controlesStructure`, `familleDePage` | Non modifié ; règles propres dans `rythme-continu.ts` |
| `src/domaine/controles-visuel/note.ts` | `noterCarrousel`, `POLICES_AUTORISEES` (sans Bricolage) | **REMPLACÉ SUR LE SERVEUR (déploiement) : NE PAS TOUCHER** ; note propre `note-continu.ts` |
| `src/domaine/controles-visuel/porte.ts` | porte des carrousels | Non modifié ; `porte-continu.ts` réutilise `texte.ts` (exports purs), `textesDe`, `controlesMemoire`/`premierSansRepetition` |
| `src/domaine/controles-visuel/memoire-carrousels.ts` | `repete`, `premierSansRepetition`, `MEMOIRE_CARROUSELS=5` | Réutilisé tel quel (fonctions pures) |
| `src/domaine/visuels/schema.ts` | `CarrouselSpec`, `texteSansLien`, regex SANS_LIEN | Réutiliser `texteSansLien` ; nouveau `continu/schema-toile.ts` |
| `src/domaine/visuels/visuel.ts` | type `Visuel` (`famille: "carrousel"`) | ÉTENDU (P1) : `famille: "carrousel" \| "carrousel-continu"`, `toile?`, `renduToile?` |
| `src/visuels/services/carrousels.ts` | cycle de vie, `ErreurVisuel`, `masquerSecrets`, `RENDU_PERIME_MS` | Non modifié ; importé par `src/visuels/continu/services/carrousels-continus.ts` |
| `src/visuels/services/production.ts` | `dependancesCarrousels()` | **REMPLACÉ SUR LE SERVEUR (déploiement) : NE PAS TOUCHER.** On importe seulement `dependancesCarrousels` (forcément exporté, puisque les pages l'importent) |
| `src/visuels/services/rendu.ts` / `rendu-reseaux.ts` | `canonique`, `executerRendu` | Réutiliser `canonique` (import) ; `VERSION_RENDU` jamais modifié |
| `src/visuels/proprietes-page.ts` | `VERSION_COMPOSITION` "visuel-page/10" | Jamais modifié ; versions propres au continu |
| `src/briques/visuels/reseaux.ts` | `PROFILS_RESEAUX`, `zonesInterdites("meta",0)`, `ratioPermisInstagram` (min 0,8) | Réutilisé ; 3:4 = 0,75 < 0,8, donc non publiable par l'API |
| `src/briques/visuels/charte-carrousel.ts` | SEUL fichier où une couleur littérale est permise (test `sources-sans-couleur-litterale`) | ÉTENDU (P1) : `CHARTE_CONTINU` + aides `alpha()`/`degrade()` |
| `src/briques/visuels/textes-fixes.ts` | `t26Etiquette` « Scénario type · exemple illustratif » | Réutilisé par import |
| `src/visuels/interrupteur.ts` | `FamilleVisuelle`, `CLES_INTERRUPTEURS_VISUELS` | ÉTENDU (P5) : famille `carrousels-continus`, clé `carrousels-continus.actif` (éteint par défaut) |
| `src/app/(studio)/reglages/carrousels/{page,actions}.ts(x)` | interrupteurs | ÉTENDU (P5) : 3e ligne + famille acceptée |
| `src/visuels/services/vues.ts` | listes/fiches | ÉTENDU (P5) : la liste des carrousels classiques filtre `famille === "carrousel"` |
| `src/lib/zip.ts` (`fluxZip`) + modèle `src/app/api/telechargements/route.ts` | ZIP au fil de l'eau | Réutilisé (P5) |
| `studio-rendu/src/contrat.ts` + `src/fournisseurs/types.ts` (copie) + `tests/studio-rendu.test.ts` (concordance à la compilation) | opérations | ÉTENDUS (P2) : opération `toile-continue` |
| `studio-rendu/src/index.ts` | table des opérations, préchauffage | ÉTENDU (P2) : opération chargée au 1er appel + préchauffage `paquetToile()` |
| `studio-rendu/src/outils.ts` | `deposer`, `exigerAdressePermise`, `executer`, `FFMPEG` | Réutilisé |
| `studio-rendu/compositions/visuels/commun/zones.ts`, `occupation.ts`, `attente-police.ts` | mesures de chevauchement et de vide, attente des polices | Réutilisés par import (non modifiés) |
| `studio-rendu/compositions/visuels/polices.ts`, `commune/polices/*` | Inter, Kalam, JetBrains Mono | Ajout (P1/P2) de Bricolage Grotesque + Instrument Serif (OFL) |
| `studio-rendu/scripts/controle-cartes.ts` | contrôle des cartes motion (pas des pages fixes) | Non utilisé ; modèle d'essai = `scripts/essai-l9.ts` + `planche-l9.sh` |
| `deploiement/studio-rendu/Dockerfile` | copie `src/domaine/visuels` et `src/briques/visuels` ENTIERS (l. 72-73) | Non modifié : tout le partagé vit dans ces deux dossiers |
| `.github/workflows/tests-visuels.yml` | CI ciblée (vitest tests/visuels + tsc tsconfig.visuels.json) | ÉTENDU (P2/P5) : chemins `studio-rendu/src/operations/toile-*.ts`, `src/app/api/carrousels-continus/**` |
| Tests existants à respecter | `imports-sans-js`, `jsx-chargement-module`, `sources-sans-couleur-litterale`, `polices`, `garde-acces-carrousels` (compte 3 actions / 3 pages), `menu-carrousels`, `version-composition` | `garde-acces-carrousels` mis à jour en P6 (nouvelles routes) |
| Stockage des fiches | collection `visuels` (JSON), aucune migration | Même collection, `famille:"carrousel-continu"` |

## 3. Ce qui bloque, ce qui aide une toile large
- **Aide** : le contrat de mesure par nonce, la mise à l'échelle Remotion (`renderStill`, `REGLAGES_RENDU`, gl swangle), FFmpeg présent dans l'image, `deposer`/`exigerAdressePermise`, la collection JSON sans migration, la copie entière par le Dockerfile de `src/domaine/visuels` et `src/briques/visuels`, `fluxZip`, `premierSansRepetition`.
- **Bloque ou impose** :
  - (a) une composition Remotion a une taille fixe : il faut `calculateMetadata` (largeur = N × 1080, hauteur 1350 ou 1440) ;
  - (b) le contrat ne prévoit qu'UNE sortie par opération ;
  - (c) `VisuelPage` et les mesures supposent 1080 de large ;
  - (d) le schéma `CarrouselSpec` est fermé (union discriminée T01…T29) ;
  - (e) les zones Meta « hypothese » de la page 1 (bandes de 135 px, grille de 40 px) gênent un objet posé sur la couture ;
  - (f) Chrome plafonne une capture vers 16 384 px : à ×1, 10 pages font 10 800 px (OK) ; ×2 est impossible, donc la V1 rend à ×1 seulement (1080 natif suffit à Instagram et Facebook) ;
  - (g) la file courte coupe à 45 s (`delaiCourteMs`) ;
  - (h) `textesDe` contrôle toute chaîne hors clés techniques (`type`, `version`, `icone`…) : un « 4:5 » ou un identifiant « PA1 » en texte déclencherait la porte CHIFFRE ;
  - (i) le test des couleurs littérales s'applique à `studio-rendu/compositions/visuels/**`.

## 4. Décisions d'architecture (tranchées)
1. **Isolation** : tout le continu est NEUF. Il vit dans `src/domaine/visuels/continu/`, `src/briques/visuels/continu/` (copiés dans l'image), `src/domaine/controles-visuel/{porte,note,rythme}-continu.ts`, `src/visuels/continu/` (studio seul), `studio-rendu/compositions/visuels/continu/` (dans le filtre de la CI et sous le test des couleurs), `studio-rendu/src/operations/toile-continue.ts` et `studio-rendu/src/paquet-toile.ts`. Les routes sont `src/app/(studio)/carrousels/continus/**` et `src/app/api/carrousels-continus/[id]/zip/route.ts`.
2. **Modèle `toile/1`** (P1), schéma strict construit depuis le registre :
   `{ version:"toile/1", format:"4:5"|"3:4", alt, parcours:{ id:"PA".."PH", debut:index }, pages: PageToile[3..10], raccords: { couture:1..N-1, type:"R01"…, y:number }[] }`
   - `PageToile` = union discriminée sur **`type`** (clé technique) : `C01…`, `L01…`, `K01…`, `S01…`, `D01…`, `A01…`, pages de parcours `PA1…PH4`, et `X00` (essai, hors production). Chaque page porte `alt` (≤ 125), une `rubrique` facultative (≤ 28) et ses champs.
   - Règles du schéma : pages d'un parcours contiguës, complètes et dans l'ordre ; un seul parcours ; page 1 = couverture ou parcours qui commence ; dernière page = appel ou parcours qui termine ; une seule page sombre (place libre) ; jamais deux fois la même plaquette ; raccord interdit sur une couture interne au parcours.
3. **Registre** : `DefinitionGabarit { type, famille, nom, role, sombre, orangeFort, version:number, schema(z strict), exemple, bordsLibres, exigeFait?, exigeAccord?, actif, essai? }`. Six fichiers de famille (`familles/couvertures.ts` … `appels.ts`) sont créés VIDES en P1 : chaque lot P3 ne touche que le sien, donc aucun conflit.
4. **Versions** : `VERSION_TOILE_SOCLE = "toile-continue/1"` dans `src/domaine/visuels/continu/version.ts`, changé seulement par P2/P4 en annonçant le cran. Chaque gabarit, parcours ou raccord a son `version` entier. L'empreinte vaut sha256(socle + versions des gabarits utilisés + canonique). studio-rendu refuse une version différente (« indisponible, réessayable »). **`VERSION_RENDU` et `VERSION_COMPOSITION` ne sont jamais touchés.**
5. **Rendu : UNE image large, puis une découpe exacte** (opération `toile-continue`, file courte). On rend la toile entière en PNG dans le conteneur. FFmpeg `crop=1080:H:i*1080:0` produit N JPEG (yuvj444p, -q:v 2), déposés aux adresses `parametres.depotsPages[]` (chacune passée par `exigerAdressePermise`). `sortie` reçoit une bande d'aperçu JPEG au quart de la taille. Le PNG ne sort pas du conteneur.
   - **Pourquoi pas N rendus de fenêtres décalées** : avec une seule source sans perte, la tranche i vaut exactement les colonnes [i·1080, (i+1)·1080) de la toile. La colonne de bord de la tranche i (1079) et la 1re colonne de la tranche i+1 sont deux colonnes voisines de la même image. Le test pixel « tranches mises bout à bout = toile, octet pour octet ; 0 trou, 0 remplacement serveur » est donc DÉMONTRABLE.
   - Avec N rendus, chaque fenêtre refait la mise en page, le lissage, le découpage en tuiles du processeur graphique et la région des filtres (`feDropShadow` d'un objet à cheval rogné autrement au bord de la fenêtre). L'égalité n'est plus garantie, et le coût est multiplié par N.
6. **Mesures du DOM** (`MesureToile`) : débordements, `taillePoliceMin` ≥ 26, `textesSurCouture` (bande ±80 px autour de chaque couture, sauf `[data-mot-affiche]`), `textesHorsMarge` (80 px), `textesCoinReserve` (200 × 200 en bas à droite de chaque page), `intrusionsMetaP1` (zones `zonesInterdites("meta",0)` hors `[data-entete]`), `chevauchements` (réutilise `compterChevauchements`/`dessinsDe`), `debordCouture1` (≥ 1 `[data-a-cheval]` à travers x = 1080), `traitsFinsSurCouture` (`[data-trait-fin]` sur une couture = 0).
   - Mesures de l'opération : `ecartCoutureMax` (écart JPEG/PNG sur les colonnes de bord), `dureeMs`, `octetsPages`.
7. **Plaquettes et parcours** : composants React portés à la main depuis le HTML/JS de la maquette, dans `studio-rendu/compositions/visuels/continu/{gabarits/<famille>/<ID>.tsx, parcours/<ID>.tsx, raccords/<ID>.tsx}`. L'en-tête (rubrique + marque « Axion-IA »), le pied (NN / NN, « glisser → » ou « enregistrer », rail) et le fond (crème, halos, grain) sont posés par le moteur, jamais par une plaquette. En 3:4, la page gagne 90 px : les plaquettes en colonne flexible les absorbent, le calque des parcours est décalé de +45 px.
8. **Générateur** (P4b, sans IA) : `choisirPlan()` est PUR et déterministe. Graine fnv1a(sujet normalisé | version | intention). Préférence de parcours par intention : `eveil` → PC, PD, PB ; `methode` → PA, PG, PH, PF ; `preuve` → PB, PE, PF ; sans intention → les 8.
   - La toile se compose ainsi : [couverture si le parcours ne commence pas] + parcours + 0 à 3 plaquettes de contenu + [A02 relance facultative] + [appel si le parcours ne termine pas]. Total 3 à 6 pages par défaut, 10 au plus. Raccords choisis dans l'intersection des `bordsLibres`.
   - Variété : jamais deux familles identiques à la suite ; ≥ 2, 3 ou 4 familles selon le curseur « Variété » (sobre, équilibré, varié) ; au plus 2 pages de cas ; une seule page sombre ; une seule page « orangeFort ».
   - Anti-répétition : `premierSansRepetition` sur l'empreinte {suite, couverture} des 5 dernières fiches continues.
   - Textes : la voie existante. Simulation = exemples du registre, avec le sujet repris en titre s'il tient. Session = paquet `paquet-session-toile/1` + consigne générée depuis le registre. Le mode api reste verrouillé.
9. **Interrupteur** : `carrousels-continus.actif`, ÉTEINT par défaut. Toute action l'exige ; le rendu le revérifie.
10. **production.ts / note.ts** : AUCUNE ligne à modifier. `src/visuels/continu/services/production-continus.ts` appelle `dependancesCarrousels()` et en reprend `depot`, `contextePorte` (qui fournit `interditsDans`), `urlLecture`, `urlTelechargement`, `verrou`, `maintenant`, `lireParametre` et `ecrireParametre`. Il construit lui-même `allume` (`generateurAllume("carrousels-continus")`), le stockage (MIME `image/jpeg`, via `fournisseur("stockage")` de `@/services/_commun`), le registre `visuels.toile.<empreinte>` et le service de rendu (`obtenirServiceRendu`).
11. **Données et chiffres** : D01 (grand chiffre, `exigeFait`) et D02 (citation, `exigeAccord`, avis éteints DGCCRF) sont construits, rendus en planche, mais `actif:false` : jamais planifiés, et la porte les met en rouge. Aucun domaine écrit sur les pages : le « axion-ia.com » de la plaquette A03 de la maquette est retiré au profit de la marque de l'en-tête.
12. **Couleurs** : base = `CHARTE_CARROUSEL` (crème #F8F0E3, encre #0D0A07, orange #D9622B). Les nuances de la maquette (#F08A52, #FFA66E, #C4501F, #B8481A, #EDE2D1, #FFFBF4, #F7DCC8, #241C15, #51463B, #CDBFAE, #3A2D22, #52412F, #1D1510, #0E0905, #5B4B3E, #FFD2AE, #8F3410, #C9511D, #FFF4E8, #FDEBDD, #F2C6A2, #CFC3B1) deviennent des jetons nommés de `CHARTE_CONTINU`. Les `rgba(...)` deviennent `alpha(jeton, a)` (color-mix).
13. **Réseaux V1** : Instagram + Facebook ; même série de JPEG (cadre meta) ; 10 pages au plus. Le 3:4 n'est livré qu'en téléchargement, avec la mention « publication par l'API Instagram impossible sous 0,8 (ratioPermisInstagram) ». LinkedIn (PDF) attend la V2. Pas de page 1 propre à chaque réseau en V1, puisque Instagram et Facebook partagent le cadre meta.

## 5. Chiffrage (ordre de grandeur, routines Sonnet sauf mention)
| Lot | Fichiers neufs / modifiés | Lignes | Routine |
|---|---|---|---|
| P0b maquette publique | 1 / 0 | — | session locale (gh api) |
| P1 modèle + schéma + palette | ~14 / 2 | ~1 100 | 1 |
| P2 moteur + découpe + test pixel | ~16 / 4 | ~1 600 | 1 + relecture Opus |
| P3a…P3f (27 plaquettes) | ~45 / 0 | ~5 500 | 6 en parallèle |
| P3h (8 parcours) | ~18 / 0 | ~2 400 | 1 |
| P3g (33 plaquettes, 3 vagues) | ~45 / 0 | ~6 000 | 3 Opus (conception) puis Sonnet |
| P4 porte + note | ~5 / 0 | ~900 | Opus |
| P4b plan + textes | ~8 / 0 | ~1 000 | 1 |
| P5 service, rendu, ZIP, interrupteur | ~9 / 5 | ~1 300 | 1 |
| P6 écran | ~12 / 2 | ~1 500 | 1 |
| P7 post + texte alternatif | ~4 / 0 | ~500 | 1 |
| P8 recette | essais + planche | — | Opus + le commanditaire |
Total ≈ 22 000 lignes, environ 20 passages de routine et autant de relectures. Coût : 0 € d'API (simulation ou session), aucune publication.
