# Générateur de scripts, lot G1a : relevé des références (étape 0) et écarts au plan

> Relevé fait le 02/10/2026 sur `generateur/maquettes` au commit `917a862` (lots A et B, lot « intensité · crédits ·
> calage » et lot GM fusionnés). Plan : `_GENERATEUR-SCRIPTS-2026-10-02/11-PLAN-FINAL-GENERATEUR-v5.md` (B.1), avec
> l'addendum l’addendum de décisions du 2026-10-02, qui prime. **Le nom du symbole fait foi** ; les numéros
> de ligne ci-dessous sont ceux du commit relevé, avant les ajouts de G1a.

## 1. Références de B.1 : où elles sont réellement

| Symbole (B.1) | Plan v5 | Relevé (917a862) | Remarque |
|---|---|---|---|
| `FamilleFormat` | `formats/types.ts:12` | `:12` ; `DefinitionFormat.famille` `:201` (plan `:195`) | conforme |
| `RecetteScript` | `:48-57` | `:48-57` ; `motsParSeconde` `:54` | conforme |
| `DefinitionFormat` | `:182-235` | `:188-241` | décalé de 6 lignes |
| `formatAvocat` | `formats/avocat/index.ts:116, 147-178`, réseaux `:211`, ratios `:117` | objet `:105`, version `:107`, ratios `:117`, blocs `:148-155`, critères `:164-173`, `reseauxConseilles` `:215` | décalé |
| `REGLES_COMMUNES` | `formats/communs.ts:36-40` | `:36-40` | conforme |
| Registre des réseaux | `reseaux/index.ts:15-132` | `RESEAUX` `:36-132` | conforme |
| `LogoReseau` | `components/ui/LogoReseau.tsx` | présent | conforme |
| `SegmentScript` | `domaine/types.ts:489-504` | `:513-528` | décalé (+24) |
| `TypeAccroche` | `:509` | `:533` | décalé |
| `Script` | `:526` (à confirmer) | `:550-570` | décalé |
| `Video` | `:637-680`, `etapeEditoriale :647`, `typeDerive :675`, `ratios :649` | `:670-718`, `:680`, `:708`, `:682` | décalé (+33) |
| `Publication`, `StatsPublication` | `:888-919` | `:933-961` ; **`idExterne` existe déjà** (`:959`) | `idExterne` n'est donc PAS ajouté |
| `KitPublication`, `genererKit` | `:877-886`, `services/publications.ts:19-52` | `:919-928` ; `genererKit :19`, `obtenirKit :55` | |
| `KitPublication.tsx` | `:33, :238, :263` | `:33, :238, :263` | conforme |
| `FeuilleEnvoyerBuffer`, `envoyerVersBuffer` | `:53`, `publications.ts:129-157` | `envoyerVersBuffer :129-161` | il écrit aussi `etapeEditoriale: "programmee"` (`:157`) |
| `DepenseEnregistree` | `:1069-1075` | `:1118-1124` | décalé |
| `Travail`, `'generation-script'` | `:988, :1019`, `travaux.ts:226-235` | `:1059`, `:1030` ; `calculerFile` vit dans **`domaine/suivi.ts`** (importé par `travaux.ts:12`), concurrence `travaux.ts:230-235` | |
| Boucle de fond | `services/boucle.ts:24-28`, `instrumentation.ts` | `boucle.ts:26-37`, `instrumentation.ts:16-33` (migration `:16-17`, boucle `:32-33`) | |
| `FournisseurScript` | `fournisseurs/types.ts:98-174`, `index.ts:35-69` | `types.ts:159-177` ; convention `FOURNISSEUR_<TYPE>` `index.ts:73`, `resoudreFournisseur :88` | décalé |
| `FournisseurTexteReseaux` | `types.ts:321-325`, `simulation/autres.ts:235-257` | `types.ts:324-328` | |
| Notation | `notation-script.ts:43, 87, 135` | `:43, :87, :135` | conforme |
| `analyserAdresse` | `adresse.ts:42-49` | `:42` | conforme |
| `lecture.ts` | `:9-73` | `:9-81` (`dureeParleeEstimee :55`) | |
| `estimerDureeTexte`, `zoneDuree` | `formats/index.ts:112, 144` | `:112`, `:144` | conforme |
| `prononciationsActives` | commande `fabrication.ts:304`, `types.ts:1289` | `fabrication.ts:309`, `CommandeFabrication.prononciations` `types.ts:1338` | |
| « Ma façon de parler » | `services/scripts.ts:148-169`, défauts `:156` | `FaconDeParler :148`, `FACON_PAR_DEFAUT :155`, `lireFaconDeParler :162`, `enregistrerFaconDeParler :166` | |
| `enregistrerScript` | `services/scripts.ts:76-95` | `:76-101` | |
| `enregistrerScriptDuBrouillon` | `services/videos.ts:270-279` | `:270-310` | |
| `Idee`, `Serie` | `:955-967`, `idees.ts:37-39` | `:997-1009` ; `archiverIdee :37` | |
| Écran Écrire | `ecrire/page.tsx:18-77`, défaut Idées `:27` | défaut Idées `:28` ; onglets `idees · scripts · references · facon` | |
| Atelier, entrées « Une idée », listes, galerie, carte, téléchargement, calendrier, navigation, recherche | (B.1) | tous présents aux chemins indiqués ; `navigation.ts` Calendrier `:20` et `:42`, Écrire `:21` et `:34` ; `recherche.ts` groupes `videos, scripts, idees, bibliotheque` `:13` | non touchés en G1a (G1b) |
| `CommandeFabrication` | `:1267-1310` (`script :1279`, `ratios :1278`, `audioMaitre :1310`) | `:1316-1381` (`ratios :1327`, `script :1328`, `audioMaitre :1362`) | décalé (+49) |
| Lectures de `format.reseauxConseilles` | `fabrication.ts:382`, `sous-titres.ts:48`, `parametres.ts:89`, `montage-avocat/index.ts:442` | `fabrication.ts:396`, `sous-titres.ts:48`, `briques/composition/parametres.ts:97`, `moteurs/montage-avocat/index.ts:512` | G6 |
| Passage des segments au moteur | `montage-avocat/index.ts:183` | `segmentsDe :198-200` | G6 |
| `fabrication.ts` : `verifierBudget`, `construireCommande`, écriture `"valide"` | `:564`, privé, `:523` | **`verifierBudget` n'existe plus** : remplacé par `verifierBudgetEtCredits` (`services/credits.ts:287`, appelé `fabrication.ts:502, 558, 641, 683`) ; `construireCommande` est **exporté** (`:279`) ; écriture `statutEditorial: "valide"` **`:539`** | la brique Crédits (prérequis de G0) est déjà sur `master` |
| Dépôts « documents » | `depots.ts:58-94`, `postgres/index.ts:26-31` | `Depots :61-101`, `COLLECTIONS postgres :24-32` | |
| Migrations | `migrations.ts:266-274` | boucle des étapes `:272-281`, dernière **`etape-18-calage`** | G1a prend **`etape-19-generateur`** |
| Dépendances | `package.json` | ni `@anthropic-ai/sdk` ni bibliothèque zip | conforme (rien ajouté en G1a) |

**Écritures d'état relevées en plus de celles du plan** (toutes laissées telles quelles, la synchronisation les rattrape) :
- `services/travaux.ts:111-114` écrit `etapeEditoriale: "a_relire"` (et `statut: "prete"`) à la fin d'une fabrication : c'est la seconde moitié de « après chaque fabrication » ;
- `services/publications.ts:157` et `:167` (`envoyerVersBuffer`, `noterPublicationManuelle`) et `services/videos.ts:353-356` (`changerEtapeEditoriale`, changement manuel) écrivent aussi la copie. Les deux premières tombent d'accord avec `etatReseau` ; le changement manuel d'étape d'une vidéo rattachée reste à rediriger en G1b.

## 2. Écarts au plan décidés en G1a (et pourquoi)

1. **`domaine/derivations-generateur.ts`** au lieu d'ajouter à `domaine/derivations.ts` : ce fichier existe déjà et sert la session du moteur ; un fichier à part évite de se disputer les mêmes lignes. Noms des fonctions inchangés.
2. **`ScriptMaitre` : les champs produits par l'écriture sont facultatifs** (`angle`, `theme`, `motCle`, `idees`, `exception`, `envoi`, `livraison`, `accrochesFinalistes`, `criteresPropres`, `emotion`, `pointDeVue`) : un brouillon sans numéro existe avant toute écriture.
3. **`codeClassement` et `declinaison` facultatifs sur `generateur/maquettes`** : les fichiers des formats appartiennent à la session du moteur. Ils sont résolus par `formatGenerateur()` (code lu dans `registre-codes.ts`, déclinaison dans la famille). Sur `generateur/prepare-moteur`, ils deviennent obligatoires et sont posés dans chaque format.
4. **Codes réseau dans `reseaux/codes.ts`** (TT, IG, FB, LI, YS, YT) ; le registre des réseaux reçoit `codeClassement` sur `generateur/prepare-moteur`, lu depuis ce module (une seule source).
5. **`RecetteScript.partiesDeclinaison`** (ajout) : blocs qui forment l'ouverture et la fin d'une version par réseau ; le central ne nomme ainsi aucun bloc.
6. **`ReseauDeclinaison` ordonné** TikTok, Instagram, Shorts, LinkedIn, Facebook (colonnes de la mini-grille = ordre de publication de B.6.12, comme les maquettes GM).
7. **`RegleDatee.niveau` += `"hypothese"`** (les `hyp-*` de la v5) et champ `effet` ; nouvelle règle **`hyp-ecriture-reseau`** (mots-dièse, première ligne et boucle par réseau, sans source de plateforme) et **`ys-video-associee`** (aide officielle YouTube). Les niveaux mixtes du plan sont semés au niveau le plus bas.
8. **Segment facultatif** : le réseau qui le retient est lu dans `reseaux/ecriture.ts` (`segmentFacultatif`, LinkedIn), jamais écrit en dur.
9. **Tournures** : l'addendum fait foi (`CALIBRAGE-ANTI-TEXTE-IA.md`). Semées : 68 `bloquant` (classe A) et 19 `grappe` (classe B) ; les 19 présentes chez l'avocat de référence (classe C) ne sont **pas** semées. `TourneInterdite.source` += `"plan"`, `"oral"` (catégories du calibrage). Les expressions Python du lot GR sont traduites en JavaScript (limite de mot sensible aux accents, drapeaux `imu`), l'origine est gardée (`regexOrigine`). Plus la liste du parcours de Will (Top 1 %, CAC 40, témoignages d'exemple, SCI de Saint-Étienne, autres activités) et le tiret long (`grappe`). Les règles de typographie (portée `affiche`) et les autres détecteurs de structure arrivent en G3.
10. **Thèmes** : `ContexteAxion.piliersProposes` (ajout) range la proposition tirée de la Bible ; `piliers` reste vide tant que Will n'a pas validé.
11. **`TexteReseau.source`** (copie dans le kit) vaut `"variante" | "fournisseur"`.
12. **`TypeAccroche`** n'est pas encore étendu (B.4.3 : G3), pour ne pas casser les tables existantes ; `reseaux/ecriture.ts` cite les styles favorisés par leur identifiant en texte.
13. **Écriture SIMULÉE** (`generateur/simulation.ts`, `ecrireSujetSimule`) : aucune clé, aucun appel, aucune dépense ; elle marque le point du « premier appel payant », où le numéro est pris. Un `GenerationScript` est journalisé (`simulee: true`, plafond 1,50 $ ou 0,70 $).
14. **Environnement** : jonction `studio-rendu/node_modules` vers le dépôt principal (ignorée par git), sans quoi `tsc` échouait sur `@remotion/renderer` dans la copie de travail.

## 3. Vérifications demandées par la v5 (G1a)

| Point | Résultat (02/10/2026) | Règle |
|---|---|---|
| Durée maximale Facebook | Toutes les vidéos sont des Reels depuis juin 2025, sans plafond (sources secondaires : postfa.st, opus.pro) | `fb-tout-reels-2025`, encore « à revoir » sur la page officielle de Meta |
| Miniature LinkedIn | Miniature personnalisée possible à l'envoi depuis l'ordinateur (sources secondaires : vaynermedia, Sked Social) | `li-miniature`, « à revoir » sur l'aide officielle |
| Couverture d'un Short | Une image de la vidéo se choisit dans l'application (iOS et Android), avant ou après la mise en ligne, avec texte et filtres (Social Media Today, RouteNote) | `ys-couverture-instant` |
| « Vidéo associée » | Confirmée par l'aide officielle YouTube (une vidéo de la chaîne, choisie dans YouTube Studio) | `ys-video-associee` (nouvelle) |

## 4. Ce qui reste pour les lots suivants

- **G1b** : écrans (onglets Écrire, fiche sujet et mini-grille branchées sur `listerSujets`/`grilleSujet`, filtres, recherche par code avec `analyserCode`, `nomFichier` dans le téléchargement, kit synchronisé, feuille Buffer verrouillée) ; rediriger `changerEtapeEditoriale` pour une vidéo rattachée ; masquer « Valider ce texte » (le service le refuse déjà).
- **G2** : saisie des matières et des preuves, `ExempleStyle`, validation de la fiche de style, des thèmes proposés et des interdits (confirmation d'un toucher), carnet de voix ; `jaugeCarburant`.
- **G3** : contrôles C1-C76 (dont l'application des tournures semées), `choisirCombinaison`, `sujetsProches`, extension de `TypeAccroche`, recette avocat v4 (structures, zones, appels par objectif).
- **G0/G4** : Claude réel à la place de `ecrireSujetSimule` (même point de numérotation), boucle de génération, `fabriquerVariante` (qui appellera `rattacherVideoAVariante` puis `synchroniserApresFabrication`), branchement de `synchroniserApresFabrication` dans `travaux.ts` (préparé sur `generateur/prepare-moteur`).
- **Branche `generateur/prepare-moteur`** (non fusionnée, sur accord de Will) : registre des réseaux (`codeClassement`, monogramme Shorts, miniature Instagram 3:4), avocat (`"facebook"`, code, déclinaison, segments facultatifs), Créateur B en face caméra, codes et déclinaisons de tous les formats, ajouts à `CommandeFabrication`, appel de synchronisation après fabrication dans `travaux.ts`.
