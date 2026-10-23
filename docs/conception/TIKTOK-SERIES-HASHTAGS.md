# Équipe 7 · TikTok comprend que le compte parle d'IA — conception

Demande de Will (validée) : (1) une famille de mots-dièse fixe par réseau, (2) des séries reconnaissables,
(3) « Votre marque » pour les vidéos qui mettent Axion IA en avant. Brouillon Buffer : toujours la règle.
Aucune mention « IA » imposée sur les vidéos, aucun étiquetage IA ajouté.

## 0. Ce qui existe déjà (relevé avant d'écrire)

| Sujet | Où | État |
|---|---|---|
| Mot-clé dit avant 5 s, répété, dans l'encadré, en 1re ligne | `domaine/controles-script/structure.ts` (C10, bloquant) | garanti pour **le mot-clé du sujet**, mais rien n'oblige ce mot-clé à parler d'IA |
| Mots-dièse TikTok 3-4 | `reseaux/ecriture.ts` (`motsDiese`) | nombre seulement, aucune liste |
| Mots-dièse des textes (Claude) | `generateur/roles/publication.ts` (`motsDiesePropres`, PUB-08) | forme `#mot`, pas de liste, pas d'interdits |
| Mots-dièse du générateur (versions par réseau) | `generateur/chaine.ts` (`declinerVersion`) | libres |
| Séries | entité `Serie` (collection `series`), `Video.serieId`, `ScriptMaitre.brief.serieId` | existent, **aucun écran pour en créer**, aucun numéro d'épisode |
| Encadré d'ouverture « Thème : ACCROCHE » | `briques/composition/encadre.ts` (`partiesTitre`), `CommandeFabrication.encadreTexte` | la ligne « Thème : » sert de titre de série sans toucher au dessin |
| Envoi Buffer | `fournisseurs/publication/buffer.ts` (`createPost`, `saveToDraft: true`) | brouillon par défaut |
| « Votre marque » chez Buffer | `docs/buffer/schema-2026-10.json` (relevé du 03/10/2026) | **n'existe pas** : `TikTokPostMetadataInput` = `title`, `isAiGenerated` seulement ; aucun champ « brand », « commercial », « disclosure » dans tout le schéma |

Conclusion « Votre marque » : **rappel**, pas de case automatique (impossible par l'API de Buffer à ce jour).
`isAiGenerated` n'est PAS touché (Will ne veut pas d'étiquetage IA).

## 1. Modèle de données (JSON, ajouts purs, aucune migration)

Stockage « documents » (`documents(collection, id, data jsonb)`) : un champ facultatif en plus ne demande rien.

```ts
// Paramètre (collection parametres) — « Vos hashtags »
"hashtags.parReseau": Partial<Record<IdReseau, string[]>>
// défaut : { tiktok: ["#IA", "#intelligenceartificielle", "#IAentreprise", "#ChatGPT", "#formationIA"] }
// réseau absent ou liste vide : libre (comportement d'aujourd'hui) ; TikTok : 3 au moins.

// Serie (existe) — ajouts
interface Serie { nom; formatId /* "" : tous formats */; description?; dernierEpisode?: number; archiveLe?: DateIso }

// ScriptMaitre (sujet) — ajout ; brief.serieId existe déjà
episodeSerie?: number

// Video — serieId existe déjà ; ajouts
episodeSerie?: number
metEnAvantAxion?: boolean   // absent : déduit du texte (pré-cochée si le texte parle d'Axion IA / de l'offre)

// Publication — ajout
votreMarque?: boolean       // envoi TikTok d'une vidéo « Votre marque » : rappel à faire dans TikTok
```

Numéro d'épisode : `dernierEpisode + 1` sous le verrou du studio, jamais réutilisé (un sujet retiré ne libère pas son
numéro). Une série sans compteur (série d'exemple) part du plus grand épisode déjà connu.

Série d'une vidéo (une seule règle, PURE, `domaine/series.ts` : `serieEffective`) : la série posée sur la vidéo,
sinon celle du sujet d'où vient sa version (`variante.scriptMaitreId → brief.serieId`, épisode du sujet). Les
vidéos d'un même sujet (une par réseau) portent donc le même épisode.

## 2. Où chaque règle s'applique

### 2.1 Famille de mots-dièse — `src/reseaux/hashtags.ts` (PUR, une seule source)

- `HASHTAGS_PAR_DEFAUT`, `estInterdit()` (#fyp, #viral, #pourtoi, #foryou et leurs variantes : `foryoupage`, `fypシ`,
  `viralvideo`…), `famillePour(reseau, reglage)`, `choisirDansFamille(proposes, famille, [min, max])`,
  `validerFamille(saisie)`.
- `choisirDansFamille` : garde, dans l'ordre proposé, ceux de la famille (graphie de la famille), complète dans
  l'ordre de la famille jusqu'au minimum, coupe au maximum ; sans famille : retire seulement les interdits.
- TikTok passe de 3-4 à **3-5** (`ecriture.ts`).

Appliquée PAR LE CODE, après Claude, à chaque sortie :

| Chemin | Point d'application |
|---|---|
| Textes de publication écrits par Claude | `finaliserPublication` (rôle publication) ; consigne + liste dans `<reseau>` ; PUB-08 dit « hors famille » |
| Textes d'essai (gratuits) | `texteEssai` (`services/publications.ts`) |
| Générateur (versions par réseau, Claude) | `declinerVersion` (`generateur/chaine.ts`) ; liste dans la consigne de déclinaison |
| Kit recopié d'une version (anciennes versions comprises) | `resynchroniserKit` |
| Retouche à la main dans le kit | interdits refusés (phrase claire) ; la famille n'est pas imposée à Will |
| Envoi vers Buffer | interdits retirés en dernier filet, quel que soit le texte |

### 2.2 « Intelligence artificielle », « IA en entreprise », « ChatGPT » (renforcement)

Relevé : C10 garantit le **mot-clé du sujet** (dit avant 5 s, écrit dans l'encadré et en 1re ligne), pas un terme
d'IA. Renforcement pour TikTok :
- `ecriture.ts` : `termesDuCompte` (TikTok) = intelligence artificielle, IA en entreprise, ChatGPT, IA.
- **Dit à voix haute** : nouveau contrôle **C10 quater** (version TikTok) : un de ces termes dit avant 5 s. La consigne
  du générateur le demande ; s'il manque, l'étape 12 (corrections automatiques) fait réécrire la version avec cette
  consigne ; s'il manque encore, une alerte reste visible sur la version. *Révision pendant le développement* : en
  « bloquant », il rejetait le texte témoin validé par Will (sujet Excel, sans IA) et un C10 bloquant ne déclenchait de
  toute façon aucune correction automatique ; l'alerte + correction est plus utile.
- **Écrit à l'écran** : ce qui est dit est écrit par les sous-titres ; l'encadré porte le mot-clé (C10).
- **Description** : le texte TikTok contient un de ces termes — consigne à Claude, et sinon le code ajoute une ligne
  neutre « Intelligence artificielle en entreprise. » (`avecTermeDuCompte`) ; les mots-dièse de la famille
  l'écrivent aussi.

### 2.3 Séries

- Service `services/series.ts` : `listerSeries`, `creerSerie(nom)`, `rattacherSujet(sujetId, serieId|null)`,
  `rattacherVideo(videoId, serieId|null)`, `serieDeVideo(videoId)`.
- Nom : 2 à 40 caractères, sans « : » (il couperait l'encadré), et **il doit tenir sur la ligne de thème de l'encadré**
  (largeur mesurée en Inter Bold 54 px ≤ 70 % de l'image) : « L'IA qui fait gagner 1 h » tient (658 px sur 684).
- À l'écran : `encadreAvecSerie` → `CommandeFabrication.encadreTexte = "<Série> : <accroche>"` ; la composition
  dessine déjà la ligne « Thème : » au-dessus de l'accroche (aucun changement du rendu). Branché en une ligne dans
  `construireCommande` (`services/fabrication.ts`). Format sans encadré : rien ne change.
- En tête de description : `enteteSerie` → « L'IA qui fait gagner 1 h · ép. 3 », première ligne du texte envoyé à
  Buffer (tous les réseaux), montrée au-dessus de l'éditeur du kit (non modifiable, comme la fin du texte).

### 2.4 « Votre marque »

- `parleDAxion(texte)` (PUR) : « Axion IA », « Axion-IA », « axion-ia.com », « notre offre / nos formations / notre
  accompagnement ». Case pré-cochée si vrai ; le choix de Will (`metEnAvantAxion`) prime ensuite.
- Envoi TikTok d'une vidéo cochée : brouillon (inchangé) + `Publication.votreMarque` + notification « Dans TikTok :
  Divulgation du contenu → Votre marque » ; la feuille d'envoi montre le même rappel en grand dès que TikTok est coché.

## 3. Écrans (peu de texte, aucun terme technique)

- **Réglages › Mes réseaux** : sous les pastilles, « Vos hashtags » : une ligne par réseau (logo + pastilles
  supprimables + champ « Ajouter »). TikTok prérempli. Vide = « Libre ».
- **Écrire › Scripts** : bandeau « Séries » (cartes défilantes : nom, nombre d'épisodes) + « Nouvelle série ».
  Toucher une série filtre la liste des sujets (filtre « Série » existant).
- **Nouveau sujet (atelier)** : pastilles « Série » (Aucune · séries · + Nouvelle) ; épisode attribué au lancement.
- **Fiche sujet** : rien de nouveau (la série s'y lit dans le filtre).
- **Vidéo › kit** : carte compacte en tête : « Série » (sélecteur, « ép. 3 ») et case « Cette vidéo met en avant
  Axion IA ». En-tête de série au-dessus du texte de chaque réseau.
- **Feuille d'envoi** : rappel ambre « Dans TikTok : Divulgation du contenu → Votre marque » si TikTok est coché et la
  case cochée.

## 4. Tests (écrits d'abord, rouges avant le code)

- `tests/e7-hashtags.test.ts` : défaut TikTok, interdits (y compris variantes), choix dans la famille (complément,
  graphie, plafond 5), validation du réglage, `finaliserPublication` sans #fyp même si Claude en donne, texte d'essai
  TikTok, terme d'IA dans la description, consigne qui liste la famille, C10 quater TikTok sans terme d'IA avant 5 s.
- `tests/e7-series.test.ts` : nom valide / trop large / avec « : », épisodes 1, 2, 3 jamais réutilisés, série d'une
  vidéo par son sujet, encadré « Série : accroche » qui tient sans alerte « attention », en-tête de description.
- `tests/e7-votre-marque.test.ts` : détection, choix de Will prioritaire, entrée `createPost` TikTok sans champ
  inventé, rappel et notification à l'envoi (simulation, aucun réseau), brouillon conservé.
- Garde écran (`tests/garde-ecran.test.ts`) : passe sans exception nouvelle.

## 5. Risques

- **Autres équipes en parallèle** : `fabrication.ts` (argent) touché d'**une** ligne ; `notifications` (production)
  seulement appelée ; `OngletIdees`, `scripts.ts`, `credits.ts`, `heygen/*` non touchés.
- **C10 quater pour TikTok** : un texte TikTok qui ne dit pas « IA » avant 5 s part en réécriture ciblée (étape 12),
  puis reste signalé ; jamais bloquant (un sujet validé peut ne pas parler d'IA). Les autres réseaux ne changent pas.
- **Textes d'essai déjà posés** : un ancien kit garde son texte ; seuls les nouveaux textes suivent la famille.
- **Largeur de l'encadré** : nom de série limité par la mesure réelle de la police ; refus clair à la création.
- **Buffer** : si Buffer ajoute un jour un champ « contenu de marque » TikTok, le brancher dans `entreeCreerPost`
  (un test le signale : le relevé du schéma est vérifié).

## 6. Ce qui reste à Will

1. Dans TikTok, à chaque brouillon « Votre marque » : Divulgation du contenu → Votre marque (Buffer ne sait pas le
   faire).
2. Ajuster « Vos hashtags » s'il le souhaite (Réglages › Mes réseaux).
3. Créer ses séries (Écrire › Séries › Nouvelle série) et y rattacher sujets et vidéos.
