# Vidéos sur le site — plan d'exécution des lots studio S1 à S4

> Version 1 du 18/10/2026. **Plan seulement** : rien n'est construit, rien n'est publié.
> Source : `docs/site-videos/PLAN-VIDEOS-SUR-LE-SITE.md` (validé par Will). Ses « Corrections après l'audit A4 » **priment** ; ses « Décisions de Will » ne sont **pas** rediscutées ici.
> Destinataire : la session Sonnet qui exécutera S1, S2, S3 puis S4, **dans cet ordre, à la lettre**.

---

## 0. En 10 lignes (pour Will)

1. **Rien ne part sur le site** au terme de ces 4 lots : tous les interrupteurs restent éteints et l'envoi reste en **site factice** (simulation).
2. **S1** fabrique, pour chaque vidéo prête, son **passeport web** (titre, résumé, transcription, chapitres, vignette, sous-titres), rangé **dans le kit de publication** existant : aucune nouvelle table, aucune migration.
3. **S1** ajoute aussi **Réglages → Sur le site** : un interrupteur par générateur, **tous éteints**, avec le conseil du plan affiché à côté.
4. **S2** écrit les **contrôles avant publication** : mots interdits lus dans la **liste unique** (`src/domaine/qualite-script/`), réglages réels du site pour Certifexemple et les avis, droits, sous-titres, vignette, durée, page pauvre.
5. **S3** ajoute dans la fiche vidéo le bloc **« Sur le site »** (case par vidéo, feuille de relecture, « Retirer du site ») et la page **« Sur le site »** du studio. Testé avec un **site factice**.
6. **S4** écrit l'**envoi signé** et la **copie des fichiers publics** (MP4, vignette JPEG, `.vtt`), avec noms versionnés, contrôle « lecture immédiate » (`+faststart`), rejeu sans doublon, et branche la **suppression définitive** sur la dépublication.
7. S4 s'arrête **avant** tout vrai envoi : le vrai client HTTP est écrit et testé contre le site factice, jamais branché. Le brancher sera une décision de Will, après les lots W1 et W2 du site.
8. Aucun appel payant : la rédaction du passeport par Claude existe, mais derrière un réglage **éteint**, et seulement sur un geste de Will dont le prix est affiché avant.
9. Aucune PR ouverte ne touche les fichiers de ces lots. Seul point de friction : la **fiche vidéo** (`src/app/(studio)/videos/[id]/page.tsx`), que l'harmonisation des écrans va aussi modifier. S3 y ajoute **une ligne** et met tout le reste dans un composant à part.
10. Sept décisions vous attendent (§ 8). Aucune ne bloque S1 ni S2.

---

## 1. Ce que j'ai lu dans le code (état de `master` au 18/10)

| Sujet | Constat | Conséquence pour les lots |
|---|---|---|
| Kit de publication | `KitPublication` (`src/domaine/types.ts:1052`) : textes par réseau, `credits`, 5 cases `avantDePublier`. Créé une fois par `kitOuCreation` sous `sousVerrouKit` (`src/services/publications.ts:103`), lu par `obtenirKit` (l.307), qui ne dépense jamais. | Le passeport devient un **champ du kit** (`passeportWeb`), créé par le même chemin (« nouvelle colonne du même kit », plan § 5). L'état sur le site (`site`) vit aussi dans le kit. |
| Stockage des données | Postgres : une ligne JSON par document et par collection (`src/donnees/postgres/index.ts:25`). | Ajouter un **champ facultatif** au kit ne demande **aucune migration**. Ne **pas** créer de collection : sinon il faudrait toucher `COLLECTIONS`, `Depots`, la mémoire, la démo et la suppression. |
| Suppression définitive | `supprimerVideosDefinitivement` (`src/services/videos.ts:385`) : refus vérifiés **sous le verrou** (`refusSuppression`), plan appliqué en un lot, stockage vidé **après**, hors verrou. Le kit part avec la vidéo (`planifierSuppression`). | La dépublication doit avoir lieu **avant** le verrou (appel réseau), et un **refus** `SUR_LE_SITE` doit couvrir la course (§ 6, S4). L'état `site` doit être lu **avant** que le kit soit effacé. |
| Réglages | Clés libres dans `parametres`, lues et écrites par `lireParametre` / `ecrireParametre` (`src/services/_commun.ts:47`). Interrupteurs par format déjà faits sur ce modèle : `moteur.<format>.jeLis`, `moteur.<format>.montageReel` (`src/services/reglages.ts:203-363`). | Mêmes gestes pour `siteGenerateurs.<formatId>` et `siteAuto.<formatId>`, défaut `false`, journalisés. |
| Page Réglages | `SECTIONS` (`src/app/(studio)/reglages/page.tsx:42`) contient déjà **« Votre site »** (`votre-site` : pages d'axion-ia.com lues par le studio). | Nouvelle section **« Sur le site »** (`sur-le-site`), placée juste après « Votre site ». Ne pas mélanger les deux. |
| Fiches de format | `DefinitionFormat` (`src/formats/types.ts`). Blocs de recette : avocat `accroche/promesse/coeur/preuve/appel/boucle` ; cas concret `accroche/etape*/resultat/question` ; tableau `accroche/geste*/preuve/resultat` ; face caméra `accroche/corps/appel` ; face caméra animée `accroche/probleme/corps/appel` ; image → vidéo `accroche/douleur/explication*/phrase-choc` ; podcast `ouverture/question-hote*/reponse-invite*/relance*/conclusion` (`*` = répétable). | Deux champs **facultatifs** ajoutés : `site` (conseil) et `chapitresWeb` (découpage). Facultatifs pour ne toucher ni `autres.ts` ni les formats masqués ; un test exige qu'ils soient déclarés pour chaque format **actif**. |
| Écran vidéo | `ecranVideo.publication: "aucune"` pour **cas concret** et **image → vidéo** (`src/formats/cas-concret/index.ts:152`, `image-video/index.ts:122`) : pas d'onglet de publication. | Le bloc « Sur le site » **ne dépend pas** de `ecranVideo.publication` : le cas concret est prioritaire pour le site (plan § 1). Il dépend seulement de l'interrupteur du générateur. |
| Script, minutage | `Video.scriptId` → `Script` → `BlocScript { blocRecette, segments[] }` ; `texteScript(blocs)` (`src/domaine/derivations.ts:17`). Sous-titres : `SegmentSousTitres.mots[]` horodatés (`MotHorodate`), tirés du texte validé ; `sousTitresDeLaVideo` (`src/services/telechargements.ts`) ne rend jamais vide. | Transcription = `texteScript` du script validé. Chapitres = début du premier mot de chaque bloc, retrouvé en **comptant les mots** dans les mots horodatés (méthode commune, valable pour tous les générateurs). |
| `.vtt` | `exporterVtt(segments)` (`src/briques/sous-titres/export.ts:30`) : fabriqué **à la demande** par `/api/sous-titres/[id]`, jamais stocké. | S4 le fabrique au moment de publier et le **dépose comme fichier** (correction A4 n° 10). |
| Vignettes | `dimensionsMiniature` : 16:9 = 1280×720, 9:16 = 1080×1920 (`src/domaine/miniatures.ts:15`). Système v2 (`src/domaine/vignettes.ts`), gabarit `axion-v2` derrière `miniature.gabarit` (éteint, défaut `r4`). `interditsVignette(titre)` réutilise déjà la liste unique. | La vignette du site est la **miniature choisie** de la vidéo (`Video.miniatureChoisieId`), quel que soit le gabarit. Ne pas allumer `miniature.gabarit`. Pas de bibliothèque d'image dans le studio (`sharp` absent) : **JPEG seulement** côté studio ; l'AVIF est fait par `next/image` sur le site (décision D3). |
| Lecture immédiate | `+faststart` posé par `studio-rendu` (`studio-rendu/src/composition/ffmpeg.ts:10`) et contrôlé (`src/briques/composition/controles.ts:29`, mesure `faststart`) **pour les moteurs qui passent par cette composition**, pas forcément pour tous. Le stockage sait lire le début d'un fichier (`StockageFichiers.lireDebut`). | S4 **vérifie** le fichier lui-même (atome `moov` avant `mdat`) et **bloque** sinon. Le studio ne réencode rien (pas de ffmpeg côté serveur web) : décision D4. |
| Signature | `signatureCrochet(secret, donnee)` = HMAC-SHA256 hexadécimal, comparaison `timingSafeEqual` (`src/services/crochets.ts:19`). | Réutilisée telle quelle pour signer les appels au site. |
| Interdits | **Liste unique** : `src/domaine/qualite-script/regles/interdits.ts` → `LISTE_INTERDITS`, `interditsCommuns()` (portée 4 écrivains : « Villeexemple », « aucun gain garanti », « certifié Certifexemple »), `interditsDans(texte, ecrivain)`, `interditsTousEcrivains(texte)`. Écrivains : `"ecrire" \| "tableau" \| "cas-concret" \| "image-video"`. Témoignages : `MOTS_TEMOIGNAGE` (`src/moteurs/montage-cas-concret/regles.ts:624`). | S2 **importe** ces fonctions. **Aucune** liste recopiée, aucun mot écrit en dur dans les nouveaux fichiers (un test le vérifie). |
| Certifexemple, avis | `CERTIFEXEMPLE_CERTIFICATION_OBTENUE` et `avisPublies` **n'existent pas dans le studio** (recherche sur tout le dépôt : aucune occurrence hors du plan). Ce sont des réglages **du site**. Le dépôt du site n'est pas accessible à cette session (accès refusé). | Le studio les **lit chez le site** par un appel signé (`GET …/reglages`, § 7), à chaque publication. Injoignable ou inconnu = **interdit** (on ne publie pas). Nom exact à confirmer par la session W1 (prérequis P3). |
| Clients, logos | Aucune liste de clients dans le studio. Entrée de format `logo-client` (`src/formats/types.ts:36`), données sensibles `logo-client` (`src/domaine/types.ts:486`). | S2 : refus si la vidéo a une entrée `logo-client` ou des mots de témoignage quand les avis sont éteints, plus une **case de relecture** obligatoire « Aucun client nommé, aucun logo ». |

---

## 2. Règles communes aux 4 lots

- Lire d'abord `AGENTS.md` et `docs/REGLES-ROUTINES.md`. Pour ce qui touche Next.js (pages, actions serveur), lire le guide concerné dans `node_modules/next/dist/docs/` avant d'écrire.
- **Une branche par lot**, partie de `origin/master` à jour : `site/s1-passeport`, `site/s2-controles`, `site/s3-fiche`, `site/s4-envoi`. Une PR par lot, **jamais fusionnée** par la routine.
- **Chaque étape = un commit**, dans l'ordre du tableau du lot. Pour chaque étape : écrire d'abord le test, le lancer, **le voir rouge** (copier la ligne d'échec dans le message de commit : `Rouge d'abord : <nom du test> — <message>`), puis écrire le code, le voir vert. Pousser après chaque commit.
- Tests ciblés pendant le travail (`npx vitest run <fichier>`), la suite complète **une seule fois** à la fin du lot ; `npx next typegen && npx tsc --noEmit` ; `npx eslint` sur les fichiers touchés. Résultats exacts dans la PR.
- **Aucun** `fetch` dans les tests : le vrai client reçoit un `fetch` injecté, remplacé par le **site factice** (§ 7.6).
- **Aucun** réglage allumé, **aucun** fournisseur réel choisi, **aucune** clé ajoutée aux variables d'environnement de production.
- Rien n'est écrit en dur pour un générateur dans le code commun : le code commun lit `site` et `chapitresWeb` dans la fiche du format (interdit n° 9 de `AJOUTER-UN-FORMAT.md` : un format ne publie pas lui-même).
- Textes de l'interface : vouvoiement, très peu de mots, aucun jargon (« Sur le site », « Retirer du site », « En ligne sur le site ↗ »).
- Fins de ligne LF.

---

## 3. Lot S1 — Passeport de la vidéo + interrupteurs

**Fini quand :** pour une vidéo prête de chaque générateur actif (avocat, face caméra, face caméra animée, tableau animé, cas concret, image → vidéo), le passeport est rempli et ses chapitres tombent sur les bons blocs ; Réglages → Sur le site montre un interrupteur par générateur, tous éteints. **Aucun appel payant.**

### 3.1 Fichiers

| Fichier | Nature |
|---|---|
| `src/domaine/site-videos/types.ts` | **nouveau**, PUR : `PasseportWeb`, `ChapitreWeb`, `EtatSite`, `ConseilSite`, `RegleChapitresWeb` |
| `src/domaine/site-videos/chapitres.ts` | **nouveau**, PUR : `chapitresWeb(...)` |
| `src/domaine/site-videos/passeport.ts` | **nouveau**, PUR : `passeportDEssai(...)`, `slugWeb(...)`, `titreWebDEssai(...)` |
| `src/domaine/site-videos/index.ts` | **nouveau**, réexports |
| `src/domaine/types.ts` | 2 champs facultatifs sur `KitPublication` : `passeportWeb?`, `site?` (import de type depuis `site-videos/types.ts`) |
| `src/formats/types.ts` | 2 champs facultatifs sur `DefinitionFormat` : `site?: ConseilSite`, `chapitresWeb?: RegleChapitresWeb` |
| `src/formats/avocat/index.ts`, `facecam/index.ts`, `facecam-animee/index.ts`, `tableau-anime/index.ts`, `cas-concret/index.ts`, `image-video/index.ts`, `podcast/index.ts` | 2 lignes de données chacun (§ 3.3) |
| `src/formats/index.ts` | `conseilSite(format)` (défaut `"non"`) et `regleChapitresWeb(format)` (défaut : un chapitre par bloc) |
| `src/services/site-videos.ts` | **nouveau**, serveur : `passeportDeLaVideo`, `modifierPasseport`, `lireReglagesSite`, `definirSiteGenerateur`, `definirSiteAuto` |
| `src/services/publications.ts` | `kitOuCreation` : pose `passeportWeb` d'essai à la création ; `obtenirKit` : complète un kit ancien sans passeport (même verrou, gratuit) |
| `src/generateur/roles/passeport-web.ts` | **nouveau** : rôle Claude « passeport » (étape 9, derrière réglage éteint) |
| `src/components/reglages/SurLeSite.tsx` | **nouveau** : la carte des interrupteurs |
| `src/app/(studio)/reglages/actions-site.ts` | **nouveau** : actions serveur des interrupteurs |
| `src/app/(studio)/reglages/page.tsx` | 1 entrée dans `SECTIONS` + 1 lecture + 1 carte |
| `tests/site-videos/s1-*.test.ts` | **nouveaux** |

### 3.2 Types (à recopier tels quels)

```ts
// src/domaine/site-videos/types.ts — PUR, importable côté client.
import type { DateIso, Id, Ratio } from "@/domaine/types";

/** Conseil du plan (section 1) : jamais une décision ; la décision est le réglage `siteGenerateurs.<formatId>`. */
export type ConseilSite = "oui" | "au-cas-par-cas" | "non";

/** Comment un format découpe ses chapitres web. Absent : un chapitre par bloc de la recette, libellé = nom du bloc. */
export interface RegleChapitresWeb {
  /** Blocs jamais montrés comme chapitre : ils sont rattachés au chapitre précédent (ex. avocat « boucle »). */
  rattaches?: string[];
  /** Libellé par bloc (absent : `BlocRecette.nom`). Un bloc répétable est numéroté : « Étape 1 », « Étape 2 »… */
  libelles?: Record<string, string>;
}

export interface ChapitreWeb {
  /** Secondes, arrondies au dixième. Le premier vaut 0. Deux chapitres n'ont jamais le même début. */
  debutSec: number;
  finSec: number;
  libelle: string;
  /** Bloc de recette d'origine (traçabilité, jamais envoyé au site). */
  blocRecette: string;
}

/** Origine d'un champ : écrit par le studio (essai, gratuit), par Claude, ou retouché par Will (sa retouche gagne). */
export type OrigineChampWeb = "essai" | "claude" | "will";

export interface PasseportWeb {
  /** Monte de 1 à chaque changement envoyable (texte, chapitres, version choisie). Sert au rejeu sans doublon. */
  version: number;
  /** 60 caractères au plus, sans code interne (« 0005-FC-TT-L · »), sans « | Axion IA ». */
  titreWeb: string;
  /** 2-3 phrases, 160 à 300 caractères conseillés. */
  resume: string;
  /** Texte validé complet (jamais une écoute). */
  transcription: string;
  /** Vide si la vidéo dure moins de 30 s ou si moins de 2 chapitres (correction A4 n° 4). */
  chapitres: ChapitreWeb[];
  /** 3 points « À retenir » (correction A4 n° 9). Vide dans l'essai : la publication est alors bloquée (S2). */
  aRetenir: string[];
  /** 2 ou 3 questions-réponses visibles (correction A4 n° 9). Vide dans l'essai. */
  questions: { question: string; reponse: string }[];
  /** Thème du site (proposé, validé par Will). Vide dans l'essai. */
  rubrique: string;
  motsCles: string[];
  /** Repris du kit (`KitPublication.credits`). */
  credits: string[];
  /** Lien conseillé vers une page service ou formation (adresse relative du site), facultatif. */
  lienService?: string;
  /** Sortie à publier : par défaut celle du ratio maître (`video.ratios[0]`), sans réseau, la plus grande. */
  sortieId?: Id;
  ratio: Ratio;
  /** La vidéo montre-t-elle un double ou une voix générée ? (mention IA affichée par le site, correction A4 n° 2.) */
  contenuGenere: boolean;
  origines: Partial<Record<"titreWeb" | "resume" | "aRetenir" | "questions" | "rubrique" | "motsCles" | "chapitres", OrigineChampWeb>>;
  modifieLe: DateIso;
}

/** État de la vidéo sur le site (posé par S3/S4 ; absent = jamais publiée). */
export interface EtatSite {
  /** Case « Sur le site » de la fiche (décochée par défaut). */
  choisie: boolean;
  etat: "hors-ligne" | "envoi-en-cours" | "en-ligne" | "retrait-en-cours" | "retiree" | "echec";
  /** Version du passeport réellement en ligne. */
  versionEnLigne?: number;
  /** Adresse de la page rendue par le site (`/fr/videos/<slug>`). */
  url?: string;
  /** Clés publiques déposées et pas encore effacées (toutes versions confondues). */
  fichiersPublics: string[];
  /** Retirée parce que son générateur a été éteint : à republier quand il est rallumé. */
  retireeParGenerateur?: boolean;
  derniereErreur?: string;
  modifieLe: DateIso;
}
```

`KitPublication` reçoit (ajout pur, commentaire d'une ligne) :

```ts
  /** Vidéos sur le site, lot S1 : le passeport web (fabriqué une fois, retouchable). */
  passeportWeb?: PasseportWeb;
  /** Vidéos sur le site, lots S3-S4 : la case et l'état en ligne. */
  site?: EtatSite;
```

`DefinitionFormat` reçoit, dans un bloc commenté « Vidéos sur le site (lot S1, ajouts purs) » :

```ts
  /** Conseil « aller sur le site » (plan site-videos § 1) ; la décision est le réglage `siteGenerateurs.<id>`. Absent : « non ». */
  site?: ConseilSite;
  /** Découpage des chapitres web. Absent : un chapitre par bloc de la recette. */
  chapitresWeb?: RegleChapitresWeb;
```

### 3.3 Données par format (une ou deux lignes chacune)

| Format | `site` | `chapitresWeb` |
|---|---|---|
| `avocat` | `"oui"` | `{ rattaches: ["boucle"] }` |
| `facecam` | `"au-cas-par-cas"` | absent (accroche / corps / appel) |
| `facecam-animee` | `"au-cas-par-cas"` | absent |
| `tableau-anime` | `"oui"` | `{ libelles: { geste: "Écran" } }` (« Écran 1 », « Écran 2 »… : « une entrée par écran », plan § 2) |
| `cas-concret` | `"oui"` | absent (« Étape 1 », « Étape 2 »… : nom du bloc numéroté) |
| `image-video` | `"non"` (« plutôt non, sauf exception ») | absent |
| `podcast` | `"oui"` | `{ rattaches: ["relance"] }` |
| `autres.ts` (avis client, selfie, etc.) | **non touché** : défaut `"non"` | — |

Le conseil « avis client filmé : non tant que les avis sont éteints » est tenu par le défaut `"non"` **et** par le contrôle S2 sur les avis.

### 3.4 Réglages (tous éteints)

| Clé | Type | Défaut | Qui l'écrit |
|---|---|---|---|
| `siteGenerateurs.<formatId>` | booléen | `false` | Réglages → Sur le site (S1) |
| `siteAuto.<formatId>` | booléen | `false` | Réglages → Sur le site (S1), grisé tant que le générateur est éteint |
| `site.passeportParClaude` | booléen | `false` | **Personne dans ces lots** (Will seul, plus tard) |
| `site.lienDansYoutube` | booléen | `false` | **Personne dans ces lots** (S4 étape 10 le lit seulement) |
| `fournisseur.site` | identifiant | `null` = simulation (site factice) | **Personne dans ces lots** |

`definirSiteGenerateur(formatId, false)` sur un générateur qui a des vidéos en ligne : en S1, il écrit seulement le réglage. Le retrait en masse est ajouté en **S4 étape 8**.

### 3.5 Règles des fonctions pures

- `titreWebDEssai(video)` : `titreSansCodeInterne(video.titre)` (`src/domaine/miniatures.ts:96`), espaces normalisées, coupé au dernier mot entier ≤ 60 caractères, sans point final.
- `slugWeb(titre)` : minuscules, accents retirés, tout ce qui n'est pas `[a-z0-9]` → `-`, tirets doublés et de bord retirés, 60 caractères au plus coupés sur un tiret, **sans date**. Proposé au site, qui reste maître de l'adresse finale.
- `passeportDEssai({ video, blocs, segments, format, sortie, credits, contenuGenere, maintenant })` : `titreWeb` = essai ; `resume` = deux premières phrases de la transcription coupées à 300 caractères ; `transcription` = `texteScript(blocs)` ; `chapitres` = `chapitresWeb(...)` ; `aRetenir`, `questions`, `rubrique`, `motsCles` = vides ; `version: 1` ; toutes les origines `"essai"`.
- `chapitresWeb({ blocs, recette, regle, mots, dureeSec })` :
  1. Si `dureeSec < 30` → `[]`.
  2. Pour chaque bloc du script, son nombre de mots (`compterMots` de `derivations.ts`) ; le début du bloc = `debutSec` du mot de rang cumulé dans la suite des `MotHorodate` aplatie des segments ; si les mots manquent (sous-titres absents ou plus courts), répartir au prorata des mots sur `dureeSec`.
  3. Les blocs de `regle.rattaches` sont fusionnés dans le chapitre précédent.
  4. Libellé : `regle.libelles[bloc]` sinon `BlocRecette.nom` ; un bloc `repetable` est numéroté à partir de 1 ; un bloc non répétable n'est jamais numéroté.
  5. Premier début forcé à 0 ; deux chapitres à moins de 1 s d'écart → le second est fusionné dans le premier ; `finSec` = début du suivant, le dernier finit à `dureeSec`.
  6. Moins de 2 chapitres au bout du compte → `[]`.

### 3.6 Étapes (1 commit chacune, test rouge d'abord)

| # | Test écrit d'abord (fichier · cas) | Code |
|---|---|---|
| S1.1 | `tests/site-videos/s1-types.test.ts` · « un kit sans passeport reste valable » (un `KitPublication` de la démo, sans les nouveaux champs, passe `tsc` et `obtenirKit` le rend) | Types § 3.2, champs facultatifs du kit et du format |
| S1.2 | `tests/site-videos/s1-chapitres.test.ts` · avocat 45 s (6 blocs, `boucle` rattachée → 5 chapitres, premier à 0) ; cas concret 3 étapes (« Étape 1/2/3 ») ; tableau 2 gestes (« Écran 1/2 ») ; vidéo de 25 s → `[]` ; deux blocs à 0,4 s d'écart → fusionnés ; sous-titres absents → prorata ; un seul bloc → `[]` | `chapitres.ts` |
| S1.3 | `tests/site-videos/s1-passeport.test.ts` · titre à code interne → code retiré ; titre de 80 caractères → ≤ 60, mot entier ; slug sans accent ni date ; transcription = texte validé exact ; résumé ≤ 300 caractères | `passeport.ts` |
| S1.4 | `src/formats/registre.test.ts` (ajout d'un cas, pas de suppression) · « chaque format **actif** déclare `site` » et « chaque bloc cité dans `chapitresWeb` existe dans sa recette » | Données § 3.3, `conseilSite`, `regleChapitresWeb` |
| S1.5 | `tests/site-videos/s1-kit.test.ts` · à la création du kit, `passeportWeb` existe (version 1, origines « essai ») ; un ancien kit sans passeport le reçoit à l'affichage ; **aucun** fournisseur `texte-reseaux` ni `script` appelé (double qui lève s'il est appelé) ; une vidéo **non prête** n'en reçoit pas | `publications.ts` (`kitOuCreation`, `obtenirKit`), `services/site-videos.ts#passeportDeLaVideo` |
| S1.6 | `tests/site-videos/s1-retouche.test.ts` · `modifierPasseport` : origine → `"will"`, `version` +1 ; retouche identique → version inchangée ; titre > 60 refusé (`ErreurStudio`) ; écriture sous `sousVerrouKit` (deux retouches simultanées : les deux champs gardés) | `modifierPasseport` |
| S1.7 | `tests/site-videos/s1-reglages.test.ts` · tous les interrupteurs `false` sur une base vide ; `definirSiteGenerateur` exige la session, refuse un format inconnu ou masqué, journalise ; `definirSiteAuto(x, true)` refusé si `siteGenerateurs.x` est éteint | `lireReglagesSite`, `definirSiteGenerateur`, `definirSiteAuto` |
| S1.8 | `tests/site-videos/s1-reglages-ui.test.ts` (rendu serveur du composant, comme les autres tests d'écran du dépôt) · une ligne par format actif, le conseil (« Conseillé », « Au cas par cas », « Déconseillé ») affiché, tous les interrupteurs éteints ; aucune ligne pour un format masqué | `SurLeSite.tsx`, `actions-site.ts`, section `sur-le-site` dans `reglages/page.tsx` |
| S1.9 | `tests/site-videos/s1-role-claude.test.ts` · le rôle rend titre, résumé, 3 « À retenir », 2-3 questions, rubrique, mots-clés ; réponse invalide → reprise ciblée puis échec propre ; réglage `site.passeportParClaude` éteint → **aucun appel** même sur le geste ; **jamais** à l'affichage. Double de test du fournisseur, aucun appel réel | `src/generateur/roles/passeport-web.ts` sur le modèle de `rolePublication` ; geste `reecrirePasseport(videoId)` avec prix affiché avant (même calcul que `prixReecriture`) |

---

## 4. Lot S2 — Contrôles avant publication

**Fini quand :** un passeport contenant « Villeexemple » ou « Aucun gain garanti » est refusé avec un message clair, et chaque contrôle de la liste ci-dessous a son test rouge puis vert.

### 4.1 Fichiers

| Fichier | Nature |
|---|---|
| `src/domaine/site-videos/controles.ts` | **nouveau**, PUR : `controlerAvantSite(entree): ResultatControlesSite` |
| `src/services/site-videos.ts` | `controlesDeLaVideo(videoId)` : rassemble l'entrée (lecture seule) |
| `tests/site-videos/s2-*.test.ts` | **nouveaux** |

### 4.2 Entrée et sortie

```ts
export interface ReglagesDuSite {
  /** Lu chez le site (`GET /api/interne/videos/reglages`, S4). `null` : inconnu ou injoignable = traité comme `false`. */
  certifexempleCertificationObtenue: boolean | null;
  avisPublies: boolean | null;
}

export interface EntreeControlesSite {
  formatId: string;
  ecrivain: EcrivainInterdits | null; // avocat, facecam, facecam-animee, podcast → "ecrire" ; tableau-anime → "tableau" ; cas-concret → "cas-concret" ; image-video → "image-video" ; table dans `site-videos.ts`, jamais dans le code commun d'un format
  passeport: PasseportWeb;
  generateurAllume: boolean;            // siteGenerateurs.<formatId>
  videoPrete: boolean;
  typeDerive?: Video["typeDerive"];
  autreVersionEnLigne: boolean;         // une autre vidéo du même `scriptMaitreId` (ou même `sourceVideoId`) est en ligne
  dureeSec: number;
  sousTitres: boolean;                  // segments non vides
  vignette: { largeur: number; hauteur: number } | null;
  entreeLogoClient: boolean;            // `video.entrees` contient une entrée `logo-client`
  licencesABloquer: number;             // `obtenirVideo(...).licencesABloquer.length`
  avantDePublier: KitPublication["avantDePublier"];
  mentionIAActive: boolean;
  caseAucunClient: boolean;             // case de la feuille S3 « Aucun client nommé, aucun logo »
  reglagesSite: ReglagesDuSite;
}

export interface ControleSite {
  code: string;                 // « SITE-01 »…
  gravite: "bloquant" | "avertissement";
  ok: boolean;
  message: string;              // une phrase, vouvoiement, sans jargon
  champ?: keyof PasseportWeb;
}
export interface ResultatControlesSite { publiable: boolean; controles: ControleSite[] }
```

`publiable` = aucun contrôle **bloquant** en échec. Les avertissements s'affichent mais ne bloquent jamais (Will décide).

### 4.3 La liste exacte des contrôles

Texte contrôlé = `titreWeb`, `resume`, `transcription`, libellés des `chapitres`, `aRetenir`, questions et réponses, `motsCles`, `rubrique`, chacun séparément (le message dit **où**).

| Code | Contrôle | Gravité | Source (jamais une copie) | Message si échec |
|---|---|---|---|---|
| SITE-01 | Interdits communs : « Villeexemple », « aucun gain garanti », « certifié Certifexemple » | bloquant | `interditsCommuns()` : on applique **chacun de leurs tests** (`Object.values(i.tests)`) | « Le résumé contient « Villeexemple » : écrivez « partout en France ». » (formule de remplacement prise du libellé quand elle existe, sinon « retirez-le ») |
| SITE-02 | Interdits de l'écrivain du générateur | bloquant | `interditsDans(texte, ecrivain)` (ignoré si `ecrivain` est `null`) | « Le titre contient « … » : retirez-le. » |
| SITE-03 | Revendication Certifexemple | bloquant | `interditsTousEcrivains(texte)` **et**, si `reglagesSite.certifexempleCertificationObtenue !== true`, le mot « Certifexemple » isolé via l'entrée « Certifexemple » de `LISTE_INTERDITS` (portée image → vidéo) | « Pas de mention de Certifexemple tant que la certification n'est pas obtenue. » |
| SITE-04 | Avis et témoignages | bloquant | si `reglagesSite.avisPublies !== true` : `MOTS_TEMOIGNAGE` (`montage-cas-concret/regles.ts`) dans le texte, ou `formatId === "avis-client"` | « Les avis clients sont coupés : retirez « … ». » |
| SITE-05 | Logo ou nom de client | bloquant | `entreeLogoClient` **ou** case `caseAucunClient` non cochée | « Cochez « Aucun client nommé, aucun logo » après avoir vérifié. » |
| SITE-06 | Droits (images, polices, voix) | bloquant | `licencesABloquer === 0` **et** case `avantDePublier.droits` | « Une licence n'est pas en règle : … » |
| SITE-07 | Cases « Avant de publier » du kit | bloquant | `casesRequises(mentionIAActive).every(...)` (`src/formats/index.ts:108`), réutilisé tel quel | « Cochez d'abord : Image, Son… » (`phraseVerifications`) |
| SITE-08 | Sous-titres présents (le `.vtt` sera fabriqué en S4) | bloquant | `sousTitres` | « Il faut des sous-titres pour le site. » |
| SITE-09 | Vignette présente, 1200 px de large au moins pour l'affiche 16:9 | bloquant | `vignette` | « Il manque la vignette du site. » |
| SITE-10 | Page pauvre : résumé non vide, **3** « À retenir », **2 ou 3** questions-réponses, rubrique choisie | bloquant | `passeport` | « Ajoutez 3 points « À retenir » et 2 questions. » |
| SITE-11 | Titre web : 1 à 60 caractères, pas de code interne | bloquant | `titreCommenceParCodeInterne` (`miniatures.ts:91`) | « Le titre fait 72 caractères : 60 au plus. » |
| SITE-12 | Générateur allumé (`siteGenerateurs`) | bloquant | réglage | « Les vidéos « Tableau animé » ne vont pas sur le site (Réglages › Sur le site). » |
| SITE-13 | Vidéo prête | bloquant | `videoPrete` | « La vidéo n'est pas prête. » |
| SITE-14 | Pas une variante (`typeDerive` ∈ `variante-accroche`, `variante-reseau`, `autre-ratio`, ou une autre version du même sujet déjà en ligne) | bloquant | `typeDerive`, `autreVersionEnLigne` | « Une autre version de cette vidéo est déjà sur le site. » |
| SITE-15 | Durée ≥ 30 s | **avertissement** | `dureeSec` | « Vidéo de 22 s : courte pour une page. Vous décidez. » |
| SITE-16 | Chapitres : aucun si < 30 s, débuts distincts, premier à 0 | bloquant | `passeport.chapitres` | « Deux chapitres commencent au même moment. » |
| SITE-17 | Mention IA (contenu généré) connue | avertissement | `passeport.contenuGenere` | « Le site affichera « Vidéo réalisée avec un double numérique ». » |

Le « fichier MP4 en lecture immédiate » (`+faststart`) n'est **pas** contrôlé en S2 (il faut lire le fichier) : c'est S4.3, avec le même format de message.

### 4.4 Étapes

| # | Test écrit d'abord | Code |
|---|---|---|
| S2.1 | `s2-interdits.test.ts` · « Villeexemple » dans la transcription → SITE-01 en échec, message nomme « la transcription » ; « Aucun gain garanti » dans le résumé → échec ; « certifiée Certifexemple » dans un chapitre → échec ; texte propre → tout vert | SITE-01, SITE-02, structure `controlerAvantSite` |
| S2.2 | `s2-liste-unique.test.ts` · **garde-fou** : `controles.ts` n'écrit aucune chaîne « villeexemple », « gain garanti », « certifexemple », « témoignage » (lecture du fichier source, insensible à la casse) ; ajouter une entrée de test à `LISTE_INTERDITS` par un double de module change le verdict | aucun code : c'est un **garde-fou** (pas un défaut corrigé), seule exception à « rouge d'abord » ; il est vert dès son écriture, et on le prouve en le faisant échouer une fois à la main (ajouter « villeexemple » dans `controles.ts`, constater le rouge, retirer) — le dire dans le message de commit |
| S2.3 | `s2-reglages-site.test.ts` · « Certifexemple » seul : refusé si `certifexempleCertificationObtenue` est `false` **ou `null`**, accepté si `true` ; « certifié Certifexemple » refusé **même si `true`** (revendication interdite tant que la règle de Will tient) ; « témoignage » refusé si `avisPublies` `false`/`null`, accepté si `true` | SITE-03, SITE-04 |
| S2.4 | `s2-clients-droits.test.ts` · entrée `logo-client` → SITE-05 ; case non cochée → SITE-05 ; licence en défaut → SITE-06 ; mention IA coupée → 4 cases suffisent (SITE-07) | SITE-05 à SITE-07 |
| S2.5 | `s2-fichiers-page.test.ts` · sans sous-titres, sans vignette, vignette 1080×1920 seule (pas d'affiche 16:9) → bloqué ; 2 « À retenir » → bloqué ; titre 61 caractères → bloqué | SITE-08 à SITE-11 |
| S2.6 | `s2-selection.test.ts` · générateur éteint, vidéo non prête, `variante-reseau`, autre version en ligne → bloqué ; 25 s → **avertissement seul**, `publiable` reste vrai si le reste passe ; chapitres en double → bloqué | SITE-12 à SITE-17 |
| S2.7 | `s2-service.test.ts` · `controlesDeLaVideo` assemble l'entrée depuis la base de démo **sans écrire** (comparaison de la base avant / après) et **sans appeler** le site quand `reglagesSite` est fourni par un double ; site injoignable (double qui lève) → `null` pour les deux réglages, donc SITE-03/04 stricts | `controlesDeLaVideo` |

---

## 5. Lot S3 — Bloc et feuille « Sur le site », page « Sur le site »

**Fini quand :** le parcours complet (cocher → relire → publier → « En ligne sur le site ↗ » → republier → retirer) passe de bout en bout contre le **site factice**, et la page « Sur le site » liste ce qui est en ligne par générateur.

### 5.1 Fichiers

| Fichier | Nature |
|---|---|
| `src/components/videos/fiche/BlocSurLeSite.tsx` | **nouveau** : état, case « Sur le site », boutons |
| `src/components/videos/fiche/FeuilleSurLeSite.tsx` | **nouveau** : feuille de relecture (titre, résumé, À retenir, questions, chapitres, rubrique, version, aperçu, contrôles S2) |
| `src/app/(studio)/videos/[id]/actions-site.ts` | **nouveau** : actions serveur (`cocherSurLeSite`, `modifierPasseportAction`, `publierSurLeSite`, `retirerDuSite`) |
| `src/app/(studio)/videos/[id]/page.tsx` | **une ligne** : `<BlocSurLeSite videoId=… />` dans la colonne de la fiche, sous la barre d'actions, rendu **quel que soit** `ecranVideo.publication` ; plus l'appel de lecture `vueSurLeSite(videoId)` dans le `Promise.all` existant |
| `src/app/(studio)/sur-le-site/page.tsx` | **nouveau** : liste par générateur (titre, date, version en ligne, lien ↗, « Retirer ») ; vues « — » tant que le site ne les remonte pas |
| entrée de menu latéral | **une ligne** dans le menu existant, visible seulement si au moins un générateur est allumé |
| `src/services/site-videos.ts` | `vueSurLeSite`, `cocherSurLeSite`, `publierSurLeSite`, `retirerDuSite`, `listerEnLigne` (S3 : contre le fournisseur `site` en **simulation**) |
| `src/fournisseurs/site/types.ts`, `src/fournisseurs/site/simulation.ts` | **nouveaux** : contrat `FournisseurSite` et **site factice** (§ 7.6) — posés dès S3 pour tester le parcours ; le vrai client vient en S4 |
| `src/fournisseurs/types.ts`, `src/fournisseurs/index.ts` | type de fournisseur `"site"` ajouté (simulation seule en S3) |
| `tests/site-videos/s3-*.test.ts` | **nouveaux** |

### 5.2 Ce que voit Will

- **Bloc absent** si le générateur est éteint (cas par défaut : rien ne change dans la fiche aujourd'hui).
- Générateur allumé, vidéo prête : case **« Sur le site »** (décochée). Cochée → bouton **« Relire et publier »**.
- Feuille : champs retouchables ; pastilles des contrôles S2 (vert / rouge / ambre) ; « Publier sur le site » **désactivé** tant qu'un contrôle bloquant échoue ; la raison est écrite au-dessus du bouton. Case « Aucun client nommé, aucun logo ». « Réécrire avec Claude (≈ x €) » visible seulement si `site.passeportParClaude` est allumé.
- En ligne : « **En ligne sur le site ↗** » (lien `EtatSite.url`), « Mettre à jour » si le passeport a changé depuis `versionEnLigne`, « **Retirer du site** » (confirmation en une phrase : « La page disparaîtra du site. La vidéo reste dans le studio. »).
- En simulation : pastille « Essai » (`PastilleEssai`, déjà utilisée) et lien vers une adresse factice `https://site-factice.invalid/fr/videos/<slug>`.

### 5.3 Parcours testé avec le site factice (`tests/site-videos/s3-parcours.test.ts`)

Base de démo, une vidéo avocat prête, fournisseur `site` = simulation.

1. Générateur éteint → `vueSurLeSite` = `{ visible: false }`. `publierSurLeSite` → refus `GENERATEUR_ETEINT`.
2. `definirSiteGenerateur("avocat", true)` → bloc visible, case décochée, `EtatSite` absent.
3. `publierSurLeSite` sans cocher → refus `NON_CHOISIE`.
4. Cocher → passeport d'essai : contrôles en échec SITE-10 (À retenir) et SITE-05 → refus `CONTROLES`, **aucun** appel au site factice (compteur à 0).
5. Remplir le passeport (3 À retenir, 2 questions, rubrique), cocher les 5 cases, cocher « Aucun client » → `publierSurLeSite` → site factice : 1 publication reçue, signature valable ; `EtatSite.etat = "en-ligne"`, `versionEnLigne = passeport.version`, `url` rendue par le factice.
6. Republier **sans changement** → le factice reçoit le même passeport, répond « inchangé » ; toujours **1** page chez le factice (pas de doublon).
7. Retoucher le résumé → `version` +1 → « Mettre à jour » → le factice a **1** page, en version 2, `modifieLe` changé, **même** adresse.
8. Ajouter « Villeexemple » au titre → refus `CONTROLES` ; la page en ligne reste en version 2.
9. `retirerDuSite` → factice : page « retirée » (il répondra 410) ; `EtatSite.etat = "retiree"` ; republier ensuite est possible (même adresse).
10. Le site factice tombe en panne (double qui lève) pendant `publierSurLeSite` → `EtatSite.etat = "echec"`, `derniereErreur` lisible, aucune exception non gérée, la fiche s'affiche.
11. Deux `publierSurLeSite` simultanés → **un seul** envoi (verrou du kit + état `envoi-en-cours`).

### 5.4 Étapes

| # | Test écrit d'abord | Code |
|---|---|---|
| S3.1 | `s3-fournisseur.test.ts` · le site factice refuse une signature fausse, un horodatage de plus de 5 min, un nonce rejoué ; rejeu de la même version = « inchangé » ; version plus basse = refus 409 ; retrait d'une vidéo inconnue = succès (idempotent) | `fournisseurs/site/types.ts`, `simulation.ts`, inscription du type `"site"` |
| S3.2 | `s3-service.test.ts` · étapes 1 à 4 du parcours | `vueSurLeSite`, `cocherSurLeSite`, `publierSurLeSite` (refus) |
| S3.3 | `s3-parcours.test.ts` · étapes 5 à 11 | `publierSurLeSite`, `retirerDuSite`, verrou, états |
| S3.4 | `s3-fiche-ui.test.ts` · bloc absent générateur éteint ; présent pour **cas concret** malgré `ecranVideo.publication: "aucune"` ; bouton désactivé avec la raison ; « En ligne sur le site ↗ » | `BlocSurLeSite.tsx`, `FeuilleSurLeSite.tsx`, `actions-site.ts`, la ligne dans `page.tsx` |
| S3.5 | `s3-page-sur-le-site.test.ts` · liste par générateur, vidéos retirées absentes, menu caché si tout est éteint | `sur-le-site/page.tsx`, entrée de menu |

---

## 6. Lot S4 — Envoi signé, fichiers publics, dépublication

**Fini quand (version de ce plan) :** tout le contrat de § 7 est implémenté côté studio et prouvé contre le **site factice** ; la suppression définitive d'une vidéo en ligne la retire d'abord du site factice (qui répond 410) ; **aucun** octet n'est envoyé à un vrai site ni à un vrai seau R2. Le critère du plan d'origine (« une vraie vidéo publiée sur l'environnement de test du site ») devient le **premier geste de Will** après W1-W2 (§ 9.3).

### 6.1 Fichiers

| Fichier | Nature |
|---|---|
| `src/domaine/site-videos/contrat.ts` | **nouveau**, PUR : `corpsPasseport(...)` (le JSON exact envoyé), `chaineASigner(...)`, `clesPubliques(...)`, `VERSION_CONTRAT = 1` |
| `src/domaine/site-videos/mp4.ts` | **nouveau**, PUR : `lectureImmediate(octets: Uint8Array): "oui" \| "non" \| "inconnu"` (atome `moov` avant `mdat`) |
| `src/fournisseurs/site/http.ts` | **nouveau** : vrai client (reçoit `fetch` et `stockagePublic` injectés) ; inscrit comme implémentation **prévue**, jamais choisie par défaut |
| `src/fournisseurs/site/types.ts` | complété : `StockagePublic` (`copierDepuisPrive`, `deposerTexte`, `existe`, `supprimer`) |
| `src/services/site-videos.ts` | `publierSurLeSite` complet (fichiers, envoi, nettoyage), `retirerDuSite` complet, `retirerTout(formatId)` / `republierTout(formatId)`, `publicationAuto(videoId)` |
| `src/services/videos.ts` | `supprimerVideosDefinitivement` : retrait du site **avant** le verrou (§ 6.4) |
| `src/services/suppression-video.ts` | `refusSuppression` : nouveau refus `SUR_LE_SITE` |
| `src/services/travaux.ts` | **une ligne** : `publicationAuto(videoId)` juste après `genererKit(videoId, { autoriserDepense: textes })` (l.392, finitions de `executerSuites`) |
| `docs/site-videos/contrat/` | **nouveau** : exemples JSON du contrat (`passeport.exemple.json`, `reponse-publication.exemple.json`, `reponse-retrait.exemple.json`, `reglages.exemple.json`, `signature.exemple.md`), **générés par un test** et vérifiés par lui : la session W1 les prend comme référence |
| `tests/site-videos/s4-*.test.ts` | **nouveaux** |

### 6.2 Ordre d'une publication (`publierSurLeSite`)

Tout ce qui suit se fait **hors** du verrou global du studio ; l'état `envoi-en-cours` posé sous `sousVerrouKit` empêche un double envoi.

1. Relire `ReglagesDuSite` chez le site (`GET …/reglages`). Échec → `null` (contrôles stricts).
2. Contrôles S2. Un bloquant → refus, rien n'est copié.
3. Lire les 64 premiers Ko de la sortie (`stockage.lireDebut`) → `lectureImmediate`. `"non"` → refus « Le fichier ne se lit pas tout de suite en ligne : refaites l'export. » ; `"inconnu"` (stockage sans `lireDebut`, simulation) → avertissement seulement.
4. Calculer les clés publiques **versionnées** (§ 7.4). Copier MP4 et JPEG du stockage privé vers le stockage public (`copierDepuisPrive`), déposer le `.vtt` (`exporterVtt` des segments de `sousTitresDeLaVideo`). Ajouter chaque clé à `EtatSite.fichiersPublics` **avant** l'envoi.
5. Vérifier les 3 objets (`existe`, taille > 0).
6. `POST /api/interne/videos` signé.
7. Succès → `etat = "en-ligne"`, `versionEnLigne`, `url`. Puis effacer les fichiers publics des versions **antérieures à la précédente** (on garde la version précédente tant que le cache du site peut encore la servir ; elle part à la publication suivante ou au retrait).
8. Échec → `etat = "echec"`, `derniereErreur` ; les fichiers de **cette** version sont effacés (aucun orphelin), les clés retirées de `fichiersPublics`.

### 6.3 Retrait (`retirerDuSite`)

1. `DELETE /api/interne/videos/<idStudio>` signé. 200 ou 404 = succès (idempotent).
2. Effacer **tous** les `fichiersPublics` (le site ne touche jamais aux fichiers : décision D2).
3. `etat = "retiree"`, `fichiersPublics = []`.
4. Échec réseau → 3 essais (1 s, 2 s, 4 s), puis `etat = "echec"` et erreur `SITE_INJOIGNABLE`.

### 6.4 Branchement sur la suppression définitive

Dans `supprimerVideosDefinitivement(ids)` (`src/services/videos.ts:385`) :

1. **Avant** `sousVerrou` : pour chaque vidéo dont le kit a `site.etat` ∈ `en-ligne`, `envoi-en-cours`, `retrait-en-cours`, `echec` (avec `versionEnLigne` posée) → `retirerDuSite(id)`. Un échec → `ErreurStudio("SITE_INJOIGNABLE", "« … » est encore sur le site, qui ne répond pas : réessayez dans quelques minutes.")` ; **rien n'est effacé** (aucune page orpheline, plan § 3.4).
2. **Sous le verrou**, `refusSuppression` ajoute : kit avec `site.etat` ∈ `en-ligne`, `envoi-en-cours`, `retrait-en-cours` → refus `SUR_LE_SITE` (« … vient d'être publiée sur le site : réessayez. »). Cela couvre une publication lancée entre l'étape 1 et le verrou.
3. Le kit (et donc `EtatSite`) part ensuite avec la vidéo, comme aujourd'hui. Les fichiers publics ont déjà été effacés à l'étape 1.
4. Une vidéo jamais publiée : **aucun** appel au site (test).

« La suppression attend et réessaie » (plan § 3.4) est tenu ainsi : 3 essais courts, puis refus clair et Will relance. Une file de réessais en fond est la décision D5.

### 6.5 Interrupteurs par générateur (plan § 2 bis, points 3)

- `definirSiteGenerateur(x, false)` → `retirerTout(x)` : chaque vidéo en ligne du générateur est retirée (§ 6.3), marquée `retireeParGenerateur = true`. Les échecs restent `echec` et sont listés sur la page « Sur le site » avec « Réessayer ». Rien n'est effacé dans le studio.
- `definirSiteGenerateur(x, true)` → `republierTout(x)` : chaque vidéo `retireeParGenerateur` est republiée (contrôles S2 refaits ; un refus la laisse hors ligne avec sa raison).
- `siteAuto.x` allumé : après les finitions d'une nouvelle vidéo de `x`, `publicationAuto` coche la case et publie **seulement** si tous les contrôles bloquants passent ; sinon une notification « À relire avant le site » (aucun envoi). Le passeport d'essai échoue toujours à SITE-10 : le mode auto ne publie donc rien tant que Claude n'écrit pas le passeport (`site.passeportParClaude`, éteint). C'est voulu.

### 6.6 Étapes

| # | Test écrit d'abord | Code |
|---|---|---|
| S4.1 | `s4-contrat.test.ts` · `corpsPasseport` produit exactement les champs de § 7.3 (ni `blocRecette`, ni `origines`, ni identifiant de fichier privé) ; écrit puis compare `docs/site-videos/contrat/*.json` (le test échoue si le fichier diffère : le contrat ne bouge jamais en silence) | `contrat.ts`, dossier `contrat/` |
| S4.2 | `s4-signature.test.ts` · vecteur fixe (secret, horodatage, nonce, corps) → signature attendue ; corps modifié d'un octet → signature différente ; même fonction que `signatureCrochet` | `chaineASigner` |
| S4.3 | `s4-mp4.test.ts` · octets `ftyp`+`moov`+`mdat` → `"oui"` ; `ftyp`+`free`+`mdat`+`moov` → `"non"` ; atome de taille 1 (64 bits) lu correctement ; octets tronqués → `"inconnu"` ; aucune lecture hors limites | `mp4.ts` |
| S4.4 | `s4-cles.test.ts` · clés versionnées (§ 7.4), une version différente ou un fichier différent → clé différente ; même entrée → même clé ; aucune clé hors du préfixe `medias/videos/` | `clesPubliques` |
| S4.5 | `s4-publication.test.ts` · ordre § 6.2 contre le site factice et un stockage public factice : 3 objets déposés **avant** le POST, `Cache-Control: public, max-age=31536000, immutable`, `Content-Type` exacts ; POST en échec → fichiers de cette version effacés ; republication → anciens fichiers gardés une version, puis effacés | `publierSurLeSite` complet |
| S4.6 | `s4-retrait.test.ts` · § 6.3 : DELETE puis fichiers effacés ; 404 = succès ; 3 essais puis `SITE_INJOIGNABLE` | `retirerDuSite` complet |
| S4.7 | `s4-suppression.test.ts` (nouveau fichier ; **aucun** test existant `suppression-video-*.test.ts` modifié ni supprimé) · vidéo en ligne supprimée → DELETE reçu par le factice **avant** l'effacement, factice répond 410 ensuite ; site injoignable → rien n'est effacé, erreur claire ; publication lancée pendant la suppression → refus `SUR_LE_SITE` ; vidéo jamais publiée → 0 appel | `videos.ts`, `suppression-video.ts` |
| S4.8 | `s4-generateur.test.ts` · éteindre « avocat » retire ses 2 vidéos en ligne et pas celles du tableau ; rallumer les republie ; un échec reste listé | `retirerTout`, `republierTout`, appel depuis `definirSiteGenerateur` |
| S4.9 | `s4-auto.test.ts` · `siteAuto` éteint → rien ; allumé + passeport d'essai → notification, **0** envoi ; allumé + passeport complet → 1 envoi | `publicationAuto`, une ligne dans les suites |
| S4.10 | `s4-youtube.test.ts` · `site.lienDansYoutube` éteint → texte YouTube du kit inchangé ; allumé (dans le test seulement) et vidéo en ligne → description YouTube complétée du lien de la page et des chapitres en horodatage `0:00 Accroche` (même découpage que le site, correction A4 n° 4) ; **aucun** envoi Buffer | complément de `obtenirKit` / texte YouTube |
| S4.11 | `s4-client-http.test.ts` · le vrai client, avec un `fetch` injecté qui **est** le site factice : en-têtes, signature, délai borné (10 s, `AbortSignal.timeout`), réponses 401/409/410/5xx traduites en phrases ; variables `SITE_VIDEOS_URL` / `SITE_VIDEOS_SECRET` absentes → fournisseur « à relier », jamais d'appel | `fournisseurs/site/http.ts`, inscrit « prévu » |

---

## 7. Contrat d'échange studio → site (version 1)

Ce contrat est **le prérequis que le studio impose aux lots W1-W4**. Il est figé par les fichiers de `docs/site-videos/contrat/` (S4.1). Toute modification = nouvelle `versionContrat`, décidée des deux côtés.

### 7.1 Principes

- Le studio **appelle**, le site **répond**. Le site n'appelle jamais le studio.
- Le site ne **touche jamais** aux fichiers publics : il les lit (adresses du passeport). Le studio dépose et efface (décision D2).
- Variables : studio `SITE_VIDEOS_URL` (ex. `https://axion-ia.com`), `SITE_VIDEOS_SECRET` ; site : le même secret. Seau public : variables `R2_PUBLIC_*` (studio seul).

### 7.2 Signature

En-têtes de chaque appel :
- `x-axion-horodatage` : secondes Unix ;
- `x-axion-nonce` : 16 octets aléatoires en hexadécimal ;
- `x-axion-signature` : `HMAC-SHA256(secret, "<horodatage>.<nonce>.<MÉTHODE>.<chemin>.<sha256 hex du corps>")` en hexadécimal (corps vide → sha256 de la chaîne vide).

Le site refuse (401) : signature fausse (comparaison en temps constant), horodatage à plus de 300 s, nonce déjà vu dans les 10 dernières minutes.

### 7.3 Points d'accès

| Méthode et chemin | Corps | Réponse |
|---|---|---|
| `GET /api/interne/videos/reglages` | — | `200 { versionContrat: 1, certifexempleCertificationObtenue: boolean, avisPublies: boolean }` |
| `POST /api/interne/videos` | passeport (ci-dessous) | `200 { statut: "publiee", slug, url, versionPasseport, inchange: boolean }` ; `409` si `versionPasseport` < version connue ; `422 { erreurs: string[] }` si un champ est invalide |
| `DELETE /api/interne/videos/<idStudio>` | — | `200 { statut: "retiree" }` (aussi si déjà retirée) ; `404` si jamais connue (le studio le traite comme un succès) |

Corps du `POST` :

```json
{
  "versionContrat": 1,
  "idStudio": "vid_…",
  "versionPasseport": 3,
  "slugPropose": "automatiser-ses-devis-en-10-minutes",
  "titre": "…", "resume": "…", "transcription": "…",
  "aRetenir": ["…", "…", "…"],
  "questions": [{ "question": "…", "reponse": "…" }],
  "chapitres": [{ "debutSec": 0, "finSec": 6.4, "libelle": "Accroche" }],
  "rubrique": "…", "motsCles": ["…"],
  "generateur": "avocat", "langue": "fr",
  "dureeSec": 47.2, "largeur": 1080, "hauteur": 1920,
  "contenuGenere": true,
  "publieLe": "2026-…Z",
  "urlVideo": "https://axion-ia.com/medias/videos/…/…-v3-1a2b3c4d.mp4",
  "urlVignette": "https://axion-ia.com/medias/videos/…/…-v3-5e6f7a8b.jpg",
  "largeurVignette": 1280, "hauteurVignette": 720,
  "urlVtt": "https://axion-ia.com/medias/videos/…/…-v3-9c0d1e2f.vtt",
  "credits": ["…"],
  "lienService": "/fr/…"
}
```

Règles que le site doit tenir (prérequis W1) : idempotence par `(idStudio, versionPasseport)` ; même `idStudio` = même page et même adresse (le `slug` n'est fixé qu'à la **première** publication) ; `modifieLe` mis à jour quand la version monte ; une vidéo retirée garde sa ligne (`statut = retiree`) et sa page répond **410**.

Écarts voulus avec le plan d'origine (§ 3.3 et § 4.1) : `urlVignetteAvif` et `urlVignetteJpg` deviennent **une seule** `urlVignette` JPEG (l'AVIF est fait par `next/image`, décision D3) ; pas d'`embedUrl` (correction A4 n° 1) ; ajouts `aRetenir`, `questions`, `contenuGenere`, `versionContrat`, dimensions de la vignette.

### 7.4 Fichiers publics

- Clé : `medias/videos/<idStudio>/<slug>-v<versionPasseport>-<8 premiers caractères du sha256 du contenu>.<mp4|jpg|vtt>`. Le sha256 vient de `Fichier.sha256` quand il existe (`confirmerDepot` le rend), sinon du contenu (`.vtt`).
- Adresse publique : `https://axion-ia.com/` + clé (même domaine, correction A4 n° 5 : règle Cloudflare `/medias/*` vers un R2 public **dédié**, jamais le seau privé du studio).
- `Cache-Control: public, max-age=31536000, immutable` (noms versionnés : jamais de purge, correction A4 n° 6).
- `Content-Type` : `video/mp4`, `image/jpeg`, `text/vtt; charset=utf-8`.
- MP4 : H.264 + AAC, 1080p au plus, **`moov` avant `mdat`** (`-movflags +faststart`), vérifié par S4.3 ; jamais réencodé par le studio web.
- La **même** `urlVignette` sert partout (affiche, JSON-LD, plan du site, `og:image`).

### 7.5 Prérequis imposés aux lots du site (à transmettre, pas à faire ici)

| # | Prérequis | Lot site |
|---|---|---|
| P1 | Les 3 points d'accès de § 7.3, signature § 7.2, idempotence, 409/410/422 | W1 |
| P2 | Table avec `idStudio` unique, `versionPasseport`, `statut`, slug figé à la première publication, colonnes `aRetenir`, `questions`, `contenuGenere`, `urlVignette` (une seule) | W1 (migration de base) |
| P3 | `GET …/reglages` lit **les vrais réglages du site** (nom à confirmer : `CERTIFEXEMPLE_CERTIFICATION_OBTENUE`, `avisPublies`) et ne les copie pas | W1 |
| P4 | Le site **ne dépose ni n'efface** de fichier ; il ne garde aucun secret R2 en écriture | W1 |
| P5 | Règle Cloudflare `/medias/*` → R2 public dédié ; CSP `media-src 'self'` ; `.vtt` servi en `text/vtt` | W1 + Will (Cloudflare) |
| P6 | Retrait = 410 + sortie du plan du site vidéo, de `llms.txt` et des encarts « En vidéo » **dans la même opération** (correction A4 n° 8) | W2-W4 |
| P7 | Chapitres affichés seulement s'ils sont dans le passeport (le studio applique déjà la règle des 30 s) ; jamais `?t=` dans l'adresse canonique | W2 |
| P8 | Mention IA affichée quand `contenuGenere` est vrai ; créateur = l'organisation | W2 |
| P9 | Exemples JSON de `docs/site-videos/contrat/` repris tels quels dans les tests du site | W1 |

### 7.6 Le site factice

`src/fournisseurs/site/simulation.ts` exporte `creerSiteFactice({ secret, maintenant })` qui :
- vérifie la signature, l'horodatage et le nonce **exactement** comme § 7.2 (même fonction que le client) ;
- garde en mémoire les pages (`idStudio` → `{ slug, version, statut, modifieLe }`) et un compteur d'appels par point d'accès ;
- rend `url = https://site-factice.invalid/fr/videos/<slug>` (domaine `.invalid` : impossible à joindre par erreur) ;
- expose `reglages` modifiables par le test (défaut : `certifexempleCertificationObtenue: false`, `avisPublies: false`) ;
- expose `fetch(url, init)` (pour tester le vrai client sans réseau) et les méthodes directes (pour le fournisseur de simulation) ;
- peut être mis « en panne » (`panne: "injoignable" | "500" | "lent"`).

Un `creerStockagePublicFactice()` garde les objets en mémoire (clé, octets, type, `Cache-Control`).

---

## 8. Décisions à Will

| # | Question | Ma recommandation | Bloque |
|---|---|---|---|
| D1 | Le critère « une vraie vidéo publiée sur l'environnement de test du site » (S4 du plan d'origine) devient un geste séparé, fait **après** W1-W2 et sur votre accord | Oui : ces lots ne doivent rien envoyer | rien |
| D2 | Le **studio** seul dépose et efface les fichiers publics ; le site ne fait que les lire (le plan d'origine disait que le site les efface) | Oui : un seul détenteur de la clé d'écriture, moins de risque | S4 et W1 |
| D3 | Vignette **JPEG seule** envoyée (1280×720 pour l'affiche), l'AVIF étant fait par `next/image` ; les recadrages 4:3 et 1:1 plus tard | Oui | S4 et W1 |
| D4 | Fichier qui ne se lit pas tout de suite (`moov` après `mdat`) : **bloquer** et refaire l'export, plutôt qu'ajouter une opération de réécriture dans `studio-rendu` | Bloquer d'abord ; ajouter l'opération seulement si ça arrive souvent | rien |
| D5 | Site injoignable pendant une suppression : refus clair et vous relancez (3 essais courts), plutôt qu'une file de réessais en fond | Refus clair d'abord | rien |
| D6 | Affiche 16:9 d'une vidéo verticale : qui la fabrique ? Le gabarit v2 (`miniature.gabarit`) l'aurait ; en `r4`, une vidéo 9:16 n'a qu'une miniature 1080×1920, donc SITE-09 bloque | Fabriquer l'affiche 16:9 avec le système de vignettes v2 (son lot 2), sans allumer le réglage pour les réseaux ; d'ici là, SITE-09 bloque les vidéos verticales | publication réelle seulement |
| D7 | Créer le seau R2 public dédié et la règle Cloudflare `/medias/*` (geste à faire par vous, au moment du branchement) | Oui, au moment du branchement | branchement seulement |

---

## 9. Vérification de bout en bout avec le site factice

### 9.1 Test unique de fin (`tests/site-videos/s4-bout-en-bout.test.ts`, écrit en dernier, une fois S1-S4 verts)

1. Base de démo, une vidéo prête par générateur actif ; fournisseurs `site` et stockage public = factices.
2. Vérifier que, sans rien toucher : aucun bloc visible, 0 appel au factice, tous les réglages `false`.
3. Allumer « avocat » et « tableau animé » **dans le test** ; remplir et publier une vidéo de chacun.
4. Vérifier chez le factice : 2 pages, corps conformes à `docs/site-videos/contrat/passeport.exemple.json` (mêmes clés), 6 objets publics, `moov` avant `mdat` pour les 2 MP4 de test.
5. Republier sans changement → 0 page de plus, 0 objet de plus.
6. Retoucher → version 2, même adresse, objets v1 gardés, v2 ajoutés.
7. Éteindre « tableau animé » → sa page retirée (410), ses objets effacés ; « avocat » intact.
8. Supprimer définitivement la vidéo avocat → DELETE avant l'effacement, 410, plus aucun objet public, kit et vidéo effacés, dépenses gardées.
9. Compter les appels réels : `fetch` global remplacé par un double qui **lève** → jamais appelé.

### 9.2 À la main, en local (simulation), par la session qui livre S3 et S4

`npm run dev`, connecté, base en mémoire : allumer un générateur, publier une vidéo d'exemple, voir « En ligne sur le site ↗ » (adresse `.invalid`), retirer, supprimer. Captures dans la PR. Puis **éteindre** le générateur avant de fermer.

### 9.3 Plus tard, hors de ces lots (pour mémoire)

Après W1-W2 et sur votre accord : seau public créé (D7), variables posées sur le studio de test, `fournisseur.site` choisi, une vidéo publiée sur l'environnement de test du site, retrait constaté (410), suppression constatée.

---

## 10. Risques

| Risque | Parade |
|---|---|
| Collision avec l'harmonisation des écrans sur la fiche vidéo | S3 n'ajoute **qu'une ligne** à `videos/[id]/page.tsx` ; tout le reste vit dans `BlocSurLeSite.tsx` (§ 11) |
| Chapitres faux quand les sous-titres ne suivent pas le texte (fabrication simulée, sous-titres approximatifs) | Prorata en secours, contrôle SITE-16, chapitres retouchables dans la feuille |
| Page pauvre publiée | SITE-10 bloquant ; le mode auto ne publie rien avec un passeport d'essai |
| Copie d'un mauvais fichier (sortie d'un réseau, avec sa fin propre) | Sortie par défaut = ratio maître **sans** réseau ; choix visible dans la feuille |
| Page orpheline après suppression | Retrait **avant** le verrou + refus `SUR_LE_SITE` sous le verrou + test S4.7 |
| Double envoi (deux onglets) | État `envoi-en-cours` sous `sousVerrouKit` + idempotence du site |
| Envoi réel par erreur | Fournisseur réel « prévu », jamais choisi ; domaine `.invalid` du factice ; `fetch` interdit dans les tests (S4.11, § 9.1-9) |
| Liste d'interdits recopiée ou divergente | Imports seulement + test garde-fou S2.2 |
| Certifexemple / avis lus de travers | Lus chez le site, `null` = interdit, test S2.3 ; nom exact confirmé par W1 (P3) |
| Fichiers publics orphelins après échec | Effacement des fichiers de la version en échec (S4.5) ; `fichiersPublics` tenu à jour avant chaque envoi |
| Kit effacé avant la lecture de l'état site | Lecture de `EtatSite` en étape 1 de la suppression, avant tout effacement |

---

## 11. PR ouvertes et ordre qui évite les collisions

Relevé du 18/10 (11 PR ouvertes ; fichiers par `git diff --name-only origin/master...<branche>`, et par l'API GitHub pour les PR trop anciennes pour avoir une base commune) :

| PR | Branche | Fichiers communs avec S1-S4 |
|---|---|---|
| #370 | `usine/l1-05-voix-epinglee-tableau` | aucun |
| #363 | `controle/posts-buffer` | aucun |
| #341 | `image-video/rythme-email-alerte` | aucun |
| #318, #317 | `ecriture/*` (docs) | aucun |
| #316 | `claude/exemple-illustratif-page-de-plus` | aucun |
| #313 | `image-video/variete-assemblage` | aucun (diff vide) |
| #280, #260, #241 | maquettes du tableau | aucun |
| #167 | `cas-concret/integration` (ancienne, sans base commune avec `master`) | **`src/app/(studio)/videos/[id]/page.tsx`** |

Branches sans PR à surveiller : `studio/harmonisation-plan` (seul fichier : `docs/harmonisation-ecrans/AUDIT.md`, aucun code), dont les lots à venir toucheront la fiche vidéo et les écrans des générateurs ; `studio/generateurs-grises` est déjà dans `master`.

**Fichiers partagés que ces lots touchent** (à re-vérifier par `gh pr list` / `gh pr diff --name-only` au début de **chaque** lot, et à signaler dans la PR) : `src/domaine/types.ts`, `src/formats/types.ts`, `src/formats/index.ts`, les 7 fiches de format, `src/services/publications.ts`, `src/services/videos.ts`, `src/services/suppression-video.ts`, `src/app/(studio)/reglages/page.tsx`, `src/app/(studio)/videos/[id]/page.tsx`, `src/fournisseurs/types.ts`, `src/fournisseurs/index.ts`.

**Ordre :**
1. **S1 et S2** peuvent partir tout de suite : ils ne touchent pas la fiche vidéo. S2 part de `master` **après** la fusion de S1 (il lit `PasseportWeb`).
2. **S3** attend que le premier lot de code de l'**harmonisation des écrans** soit fusionné (ou, si Will préfère ne pas attendre, que la session d'harmonisation confirme qu'elle ne touche pas la colonne de la fiche ce jour-là). Dans tous les cas : une seule ligne dans `page.tsx`, posée juste après `<BarreActionsVideo …>`, et rebasée en dernier.
3. **S4** après S3. Il touche `videos.ts` et `suppression-video.ts` : vérifier qu'aucune PR de la suppression définitive n'est ouverte à ce moment-là.
4. **#167** est ancienne et sans base commune : si elle est reprise, c'est elle qui se recale sur `master` après S3, pas l'inverse.
