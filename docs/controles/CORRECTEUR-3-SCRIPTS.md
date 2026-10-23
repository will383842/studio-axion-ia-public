# Correcteur 3 : scripts réels (suite de l'audit B)

- **Branche :** `outils/scripts-reels`, partie de `master` @ `d186500` (la version en ligne).
- **Objectif :** plus aucun texte de script simulé quand Claude est relié.
- **Fichiers d'argent des moteurs non touchés :** `credits.ts`, `fabrication*.ts`, `decors.ts`, `fal.ts` et `heygen/*` sont restés tels quels.
- **Tests :** aucun appel réseau, aucune vraie clé. Dans les tests, Claude « relié » veut dire : choisi, avec une clé d'essai, et un `fetch` qui refuse tout appel. Les tests vérifient aussi que le compteur d'appels reste à 0.

---

## Ce qui a été corrigé

### B1 · « Une idée » › « Écrire le texte » passe par le vrai générateur (Haute)

**Avant :** le bouton appelait `genererScripts`, qui renvoyait des textes types simulés, même avec Claude relié.

**Maintenant :**
- **Dans l'assistant.** « Écrire le texte » ouvre l'écran Sujet (`/ecrire/atelier`). L'idée y est déjà remplie, et l'adresse de **retour à la vidéo** suit (`?retour=/nouvelle/<format>?brouillon=<id>`). Si Will a déjà saisi quelque chose, le brouillon est enregistré avant de partir. Le texte s'écrit par la vraie chaîne, avec son prix et le pré-vol des crédits.
- **Sur la fiche du sujet.** Chaque version propose **« Utiliser dans ma vidéo »**. Le bouton ramène à l'assistant avec `variante=<id>`. Le texte de la version courante (ouverture, corps, fin) devient celui de la vidéo, **mot pour mot**, via `texteDeVersionPourVideo` (`src/services/scripts.ts`). Une vidéo déjà en fabrication n'est jamais modifiée. Le texte est enregistré au premier passage : `Assistant.tsx` ne prend plus un texte sans script pour un texte « déjà en base ».
- **Sécurité du retour.** Seule une adresse de l'assistant est acceptée (`retourValide`, dans `src/domaine/retour-video.ts`). Une adresse extérieure ou mal formée est ignorée.
- **Côté serveur.** `genererScripts` (l'ancien générateur simulé) **refuse** avec Claude relié : « Avec Claude relié, le texte s'écrit et se retouche dans « Écrire ». » Sans Claude, l'essai reste possible.
- **Nettoyage.** La génération automatique simulée et l'écran « J'écris trois versions… » sont retirés de `Script.tsx`.

### B2 · « En faire une vidéo » (Idées) mène à la vraie chaîne (Haute)

L'icône ouvre `/ecrire/atelier?idee=<id>&retour=/nouvelle/<format>`. Le parcours est le même que pour B1.

### B6 · « Importer un fichier » (ajout)

- **Où :** un bouton « Importer un fichier » sous la zone « Coller » (`ZoneColler.tsx`). On le retrouve sur l'écran « Votre vidéo » et dans l'onglet « Coller ».
- **Types acceptés :** `accept=".txt,.md,.docx,.pdf"`.
  - `.txt` et `.md` sont lus **dans le navigateur**. Pour `.md`, seules les marques de mise en forme sont retirées (titres, listes, gras, liens). Les mots restent.
  - `.docx` est lu par **mammoth** et `.pdf` par **unpdf**, **sur le serveur** (`src/services/import-texte.ts`, action `importerFichierAction`). Aucun appel extérieur.
- **Refus clairs :**
  - fichier de plus de 5 Mo : « Ce fichier dépasse 5 Mo : il est trop lourd. » ;
  - autre type : « Choisissez un fichier .txt, .md, .docx ou .pdf. » ;
  - fichier illisible : « Ouvrez-le, copiez le texte et collez-le. » ;
  - fichier vide.
- **Ensuite :** le texte suit **le même découpage** que le coller.
- **Dépendances :**
  - `pnpm add mammoth unpdf`, lockfile commité.
  - Les deux sont déclarés dans `serverExternalPackages`.
  - `experimental.serverActions.bodySizeLimit: "6mb"` dans `next.config.ts`, car la limite par défaut d'une action serveur est de 1 Mo.

### B8 · Découpage d'un texte collé (Moyenne)

Le nouveau module pur est `src/domaine/decoupage-colle.ts`. Le simulateur l'utilise, et Claude aussi, puisqu'il recopie `decouper`. Les règles :
- **Paragraphes gardés entiers.** S'il y a plusieurs paragraphes, l'unité de découpage est le paragraphe. Un paragraphe va toujours à un seul bloc.
- **Retours à la ligne gardés.** Deux lignes ne sont jamais réunies dans un même morceau.
- **Texte sans ponctuation.** Il est coupé en morceaux de taille égale, de 16 mots au plus, au lieu de donner un seul bloc.
- **Jamais un mot réécrit.** Un test vérifie que la suite des mots reste identique, mot pour mot : ponctuation, majuscules, chiffres, `\r\n` et tabulations compris.

### B9 · « Rien n'est payé » seulement sans Claude (Moyenne)

Sur la fiche sujet, plusieurs messages disaient « rien n'est payé » :
- le message après une matière ajoutée (« Ajouter et écrire », « Ajouter et reprendre ») ;
- le message après « Je lis », « Tu » ou « Autre format ».

Ils dépendent maintenant de `ecritureSimulee`, qui vaut `!claudeBranche()`. Avec Claude relié, le message dit simplement « écriture lancée ».

### B10 · /scripts/<id> : note et « Améliorer » (Basse)

Aucun rôle réel ne convient à un **texte seul** : les rôles juge et réécriture ont besoin du contexte d'une écriture (matières, défauts relevés par le code). La fiche ne les appelle donc pas.

- **Avec Claude relié**, la note et « Améliorer » (simulés) sont **masqués** dans `/scripts/<id>` et dans l'assistant.
- Côté serveur, ils sont **refusés** : `noterScriptEssai` et `ameliorerBloc`.
- Une nouvelle version enregistrée n'a plus de note inventée.
- **Texte rattaché à un sujet :** le bouton « Retoucher avec Claude, depuis le sujet » mène aux vraies retouches. « Autre accroche », « Plus court » et « Améliorer » passent par `executerRoleFacture`, avec leur prix affiché.
- **Texte seul :** « Corrigez le texte à la main (0 €), ou écrivez un nouveau sujet dans « Écrire ». »

### B11 · Prix calculés (Basse)

Plus aucun « 1,40 € », « 0,65 € » ou « 0,10 € » n'est écrit en dur dans `EcranSujet.tsx` et `FicheSujet.tsx`. Les prix viennent de :
- `prixLancement()`, qui fait plafond × `taux.usdEur` ;
- `prixLancement(true)` et `prixLancement("adresse")` ;
- `prixRetouche()`.

Le « déjà utilisé » de l'écriture en cours utilise lui aussi le taux du réglage. Avant, `0.93` était écrit en dur.

> **À décider par Will : le prix d'une retouche.** L'écran annonçait « au plus 0,10 € ». Mais une retouche réserve en réalité le plafond d'un **supplément**, soit 0,70 $ (`regenererVariante`, `PLAFOND_SUPPLEMENT_USD`). « Au plus » doit rester vrai. L'écran affiche donc maintenant ce plafond : environ 0,65 €. Le coût réel médian est bien plus bas : environ 0,03 à 0,20 $ selon la retouche. Pour annoncer moins, il faut d'abord baisser le plafond d'une retouche dans `boucle-generation.ts`. Ce n'est pas fait ici, car ça changerait la règle d'argent.

### B13 · Texte trop court (Basse)

Un texte de moins de 3 mots affiche **« Ce texte est trop court. »** (`verifierTexteColle`). Il n'est plus ignoré en silence. Exception : à la fermeture de la feuille, le reste non utilisé est essayé sans afficher de message.

### B14 · « Ranger pour moi » (Basse)

Il n'existe **pas encore de rôle Claude** pour ranger. Le bouton fait donc toujours un essai.
- **Avec Claude relié :** le bouton est **masqué**, et le service **refuse** (« … utilisez « Découper » »).
- **Sans Claude :** le bouton reste marqué « Essai ». Le faux prix « ≈ 0,01 € » est remplacé par « 0 € ».

### B16 · Code mort

`src/components/ecrire/Atelier.tsx` est supprimé. Il n'était importé nulle part.

---

## Preuve « rouge avant, vert après »

Les tests ajoutés sont `tests/c3-decoupage-colle.test.ts`, `tests/c3-import-fichier.test.ts` et `tests/c3-scripts-reels.test.ts`. Les fichiers d'essai sont `tests/fixtures/c3-script.docx` et `tests/fixtures/c3-script.pdf`.

Pour la preuve, les tests ont été lancés sur `origin/master` (`d186500`) dans une copie de travail à part. Les seuls ajouts dans cette copie étaient les modules purs nouveaux, pour que chaque test s'exécute.

| Test (sur master) | Résultat |
|---|---|
| B8 : une ligne = au moins un morceau | ✗ rouge |
| B8 : paragraphes gardés entiers | ✗ rouge |
| B8 : texte sans ponctuation découpé | ✗ rouge |
| B8 : mot pour mot | ✓ déjà vert (garde-fou) |
| B13 : la zone « Coller » affiche le message | ✗ rouge |
| B6 : bouton « Importer un fichier », `accept` | ✗ rouge |
| B1 : `generer` refusé avec Claude relié | ✗ rouge |
| B1 : la version revient dans la vidéo mot pour mot | ✗ rouge |
| B1 : écrans (assistant, Sujet, fiche, retour) | ✗ rouge |
| B2 : icône Idées → vraie chaîne | ✗ rouge |
| B10 : note et « Améliorer » refusés avec Claude | ✗ rouge |
| B10 : fiche script (masquage, renvoi au sujet) | ✗ rouge |
| B14 : « Ranger pour moi » refusé avec Claude | ✗ rouge |
| B14 : bouton marqué et masqué | ✗ rouge |
| B9 : message d'essai conditionnel | ✗ rouge |
| B11 : prix calculés | ✗ rouge |
| B16 : Atelier.tsx supprimé | ✗ rouge |

**Après correction, tout est vert.**

**Test existant adapté :** `tests/e2e1-console-ecrans.test.ts`, « en compact, aucune écriture ne part sans un toucher ». La génération automatique n'existe plus. Le test vérifie maintenant qu'il n'y a plus aucun lancement automatique et que seul le toucher « Écrire le texte » ouvre le générateur. La règle est donc plus stricte qu'avant.

## Contrôles

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | ✓ 0 erreur (après `npm ci` dans `studio-rendu/`, dont les dépendances manquaient au départ) |
| `npx eslint .` | ✓ 0 problème |
| `npx vitest run` complet | ✓ 180 fichiers ; 2 444 tests, dont 2 ignorés comme avant |
| `tests/garde-ecran.test.ts` | ✓ vert |
| `npx next build --webpack` | ✓ |
| Dockerfile | `pnpm install --frozen-lockfile` ✓. `mammoth` et `unpdf` (avec `jszip`) sont bien copiés dans `.next/standalone/node_modules`, et ils lisent les fichiers d'essai depuis ce dossier. Le démon Docker n'est pas disponible dans ce conteneur : l'image elle-même n'a pas été construite. |

## Ce qui reste (hors de cette correction)

- **Pastille de note dans « Mes scripts ».** Les scripts enregistrés avant cette correction gardent leur ancienne note d'essai. Elle n'est plus recalculée avec Claude relié, mais elle reste affichée.
- **Autres méthodes encore simulées.** `interpreterDemande`, `resoudreDistribution` et `resumerNouveaute` (veille) restent simulées. Ce ne sont pas des textes de script.
- **B3, B4, B5, B7, B12, B15 et B17 de l'audit** ne faisaient pas partie de cette commande.
