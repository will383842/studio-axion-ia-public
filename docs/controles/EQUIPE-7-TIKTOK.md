# Équipe 7 · TikTok — rapport de contrôle

Branche `outils/tiktok`, partie de `origin/master` (d186500). Conception : `docs/conception/TIKTOK-SERIES-HASHTAGS.md`.

## « Votre marque » : automatique ou rappel ?

**Rappel.** Buffer ne permet pas de déclarer le contenu de marque TikTok. Vérifié dans le relevé complet du schéma de
Buffer du 03/10/2026 (`docs/buffer/schema-2026-10.json`) : les seuls champs TikTok de `createPost` sont `title` et
`isAiGenerated` ; aucun champ « brand », « commercial », « disclosure » ou « promotion » dans tout le schéma. Le
studio ne coche donc rien chez Buffer (et ne touche pas `isAiGenerated` : aucune étiquette IA). À la place :
- dans la **feuille d'envoi**, un encadré ambre en grand dès que TikTok est coché : « Dans TikTok : Divulgation du
  contenu → Votre marque » ;
- une **notification** (cloche, et téléphone ou e-mail selon vos réglages) avec la même phrase, après l'envoi ;
- la publication garde la trace (`votreMarque`) ; le brouillon reste la règle, rien n'est publié directement.

Un test rougit le jour où Buffer ajoutera ce champ (relevé du schéma vérifié) : il suffira alors de le cocher dans
`entreeCreerPost`.

## Comment Will s'en sert, pas à pas

1. **Vos hashtags** — Réglages › Mes réseaux › « Vos hashtags ». TikTok est déjà rempli : #IA #intelligenceartificielle
   #IAentreprise #ChatGPT #formationIA. Touchez × pour retirer, « #ajouter » pour ajouter. Un réseau vide reste libre.
   #fyp, #viral, #pourtoi, #foryou sont refusés.
2. **Créer une série** — Écrire › Scripts › bandeau « Séries » › « Nouvelle série » (ex. « L'IA qui fait gagner 1 h »).
   Un nom trop long pour tenir à l'écran est refusé avec une phrase claire.
3. **Rattacher un sujet** — Nouveau sujet : choisissez la série sous les réglages. L'épisode est numéroté tout seul.
4. **Rattacher une vidéo** — Fiche vidéo › kit : « Série » en haut (l'épisode s'affiche, « ép. 3 »). La fabrication
   suivante écrit le titre de la série sur la première ligne de l'encadré d'ouverture ; chaque texte de publication
   commence par « L'IA qui fait gagner 1 h · ép. 3 ».
5. **Votre marque** — même carte : « Cette vidéo met en avant Axion IA » (déjà cochée si le texte parle d'Axion IA ou
   de l'offre ; décochez si besoin). À l'envoi vers TikTok : brouillon dans Buffer, puis dans l'application TikTok,
   avant de publier : **Divulgation du contenu → Votre marque**.
6. **Retrouver une série** — Écrire › Séries : toucher une carte filtre les sujets ; la retoucher enlève le filtre.

## Ce qui est garanti par le code (pas seulement demandé à Claude)

| Règle | Où |
|---|---|
| Mots-dièse UNIQUEMENT dans « Vos hashtags » (3 à 5 sur TikTok) | `choisirDansFamille` : textes de Claude (`finaliserPublication`), textes d'essai (`texteEssai`), versions du générateur (`avecVosHashtags` dans `declinerVersion`), kit recopié d'une version (`resynchroniserKit`) |
| Jamais #fyp, #viral, #pourtoi, #foryou (et variantes) | idem + refus à la retouche (`modifierTexteKit`) + filet à l'envoi (`texteAEnvoyer`) |
| « intelligence artificielle », « IA en entreprise », « ChatGPT » ou « IA » dit avant 5 s (TikTok) | consigne du générateur ; contrôle **C10 quater** (`termesDuCompte`) : s'il manque, réécriture automatique de la version (étape 12), puis alerte visible si toujours absent |
| … écrit à l'écran | les sous-titres écrivent ce qui est dit ; l'encadré porte le mot-clé (C10, déjà là) |
| … écrit dans la description TikTok | `avecTermeDuCompte` : ligne neutre « Intelligence artificielle en entreprise. » ajoutée si aucun terme n'y est |
| Même titre de série à l'écran et en tête de description | `avecSerieALEcran` (commande de fabrication), `texteAEnvoyer` (en-tête) |

Constat avant renforcement : C10 garantissait déjà le **mot-clé du sujet** (dit avant 5 s, répété, dans l'encadré,
en première ligne), mais rien n'obligeait ce mot-clé à parler d'IA.

Pourquoi « dit avant 5 s » n'est pas bloquant : en bloquant, le contrôle rejetait le texte témoin validé par Will
(sujet « remplacer Excel », sans IA), et un C10 bloquant ne déclenche de toute façon aucune correction automatique.
Le choix retenu (réécriture automatique ciblée, puis alerte) renforce sans casser. **Si Will veut que ce soit
bloquant**, c'est une ligne : `"C10 quater": l("bloquant", null)` dans `niveaux.ts` (le témoin devra alors dire « IA »).

## Contrôles

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npx eslint .` | 0 erreur, 0 avertissement |
| `npx vitest run` (suite complète) | 179 fichiers passés, 1 ignoré ; **2453 tests passés**, 2 ignorés, 0 échec |
| `npx next build --webpack` | compilé, 14 pages générées, code 0 |
| Garde écran (`tests/garde-ecran.test.ts`) | 3/3, aucune exception ajoutée |
| Tests de l'équipe (`tests/e7-*.test.ts`) | 38/38 |

Note d'environnement : sur master comme ici, `tsc` et le build échouaient sur `studio-rendu` (modules `@remotion/*`
absents de ce conteneur). Les dépendances de `studio-rendu` ont été installées localement (`npm ci`, dossier ignoré
par git) : rien n'est commité à ce sujet. La documentation publique de Buffer était bloquée par le réseau du
conteneur ; le relevé du schéma du 03/10/2026 dans le dépôt fait foi.

Régression trouvée puis corrigée pendant le développement : en « bloquant », le contrôle « IA dite avant 5 s »
faisait échouer le texte témoin du générateur (`g3-controles`, `g3-cas-35h`) ; passé en C10 quater (alerte +
réécriture automatique), voir plus haut.

## Tests rouges avant le code

1. Commit `81dd8b6` (tests seuls, avant tout code) : les 3 fichiers échouent (modules absents).
2. Preuve de comportement : sur `81dd8b6`, avec seulement les nouveaux modules ajoutés (`reseaux/hashtags.ts`,
   `domaine/series.ts`, `domaine/votre-marque.ts`, `services/hashtags.ts`, `services/series.ts`) mais sans leur
   branchement : **22 tests rouges sur 38** (TikTok 3-5, #fyp retiré après Claude, consigne, terme d'IA dans la
   description, C10 quater, kit, retouche refusée, filet à l'envoi, épisodes, en-tête, encadré, rappel « Votre
   marque »…). Les 16 verts ne testent que les fonctions pures des nouveaux modules.
3. Après le code : 38/38.

## Fichiers touchés dans les zones des autres équipes (minimal)

- `src/services/fabrication.ts` (argent) : la commande est enveloppée par `avecSerieALEcran` (2 lignes + import).
- `src/services/notifications.ts` (production) : non modifié, seulement appelé (`creerNotification`).
- `src/components/generateur/EcranSujet.tsx`, `src/app/(studio)/ecrire/atelier/page.tsx` (série d'idées) : une
  propriété `series`, un état `serieId`, le composant `ChoixSerie` ; rien d'autre.
- Non touchés : `credits.ts`, `decors.ts`, `fal.ts`, `heygen/*`, `boucle.ts`, `sante`, `scripts.ts`, `ZoneColler`,
  `OngletIdees`, `personnages`, `distribution`, journal.

## Ce qui reste à Will

1. Dans TikTok, pour chaque brouillon « Votre marque » : Divulgation du contenu → Votre marque.
2. Ajuster « Vos hashtags » s'il le souhaite.
3. Créer ses séries et y rattacher sujets et vidéos.
