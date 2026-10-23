# 50 · Plan d'architecte — générateur « Une image → une vidéo motion design par réseau »

Architecte de l'équipe « Image → vidéo », 14/10/2026 (soir). Plan seulement : rien n'a été construit, testé, rendu ni payé.
Code vérifié en **lecture seule** sur `origin/master` **769aedae** (#203) du dépôt `studio-axion-ia` et sur `origin/interface-claire/lot-c` (fc4c3272, non fusionnée). Chemins relatifs à ce dépôt. Appuis : `00-BRIEF`, `10-AUDIT`, `20-INVENTAIRE`, `30-RECHERCHE`, `40-SCRIPTS-ET-STORYBOARDS`.
2ᵉ passe (après `60-CRITIQUE`) revérifiée sur `origin/master` **0b427109** (#204 : déplacement du banc d'écriture vers `tests/banc-ecriture/`, sans effet sur ce plan).

---

## Corrections après critique (2ᵉ passe, 14/10 soir)

Chaque point de `60-CRITIQUE` est traité ci-dessous ; le corps du plan a été corrigé en place (sections citées). Les choix marqués « défaut » sont décidés par la direction et modifiables par Will (`52-DECISIONS`).

**Point 0 · « 103 .tsx sans React » = fausse alerte.** Constat retiré (§ 0.3). Le rendu de prod (`npm ci --omit=dev`, sans typescript) compile en JSX classique et `reactShim` pose `globalThis.React` APRÈS le chargement des compositions : seul un JSX **évalué au niveau module** casse (cas `elements.tsx`, #201). Aucun des 105 fichiers concernés n'en contient. Correction : nos `.tsx` gardent `import React`, et le test (L7/L10) **refuse tout JSX au niveau module sans import React** sur notre dossier, en bundlant comme la prod (sans typescript). Aucune alerte envoyée à 43/17.

**B1 · Shorts impossible avec les pièces empruntées.** Vérifié : `ReseauCas = "facebook" | "instagram" | "tiktok" | "linkedin"` (`formats/cas-concret/index.ts:51`), `DemandePlanDesFins.offre` obligatoire (`fins.ts:26`), `codeVersionCasConcret` écrit le code du format CC (`fins.ts:51`), `fin-tt-lien-profil` limitée à `["tiktok"]`. Correction (§ 0.3, § 6, L14) : **`planDesFinsIV` propre** dans `montage-image-video/fins.ts`, type `ReseauIV` à 5 réseaux, qui lit la banque en lecture seule (`finPour`, `TABLE_FINS_DIAGNOSTIC`, lignes `fin-ty-*` de la banque Usine pour Shorts, ex. `fin-ty-lien-profil` dont `reseaux` couvre `youtube-shorts`) ; `codeVersionIV` (« 0042-IV-YS ») ; `planDesFins` du cas concret n'est plus emprunté. `offre` entre dans la carte (`CarteImage.offre`, déduite du type d'image, corrigeable à l'écran Déposer).

**B2 · Appel à commenter absent par défaut.** Correction (§ 4, § 6) : une **question de commentaire propre à l'image** (écrite par Claude, validée par Will avec le script, ex. « Et chez vous, combien de messages attendent jusqu'au lendemain ? ») est dite **avant la fin réseau** sur Instagram, Facebook, TikTok et Shorts — les réseaux où la banque admet une fin de type « question » (`fin-if-question`, `fin-ty-question-tache`) ; **jamais sur LinkedIn** (dite nulle part, mise dans le texte du post sur le patron de `fin-li-question`). La question appartient au segment de fin (pas au corps commun), elle n'est donc rendue que dans les versions concernées. Si la question générée échoue aux contrôles, repli sur la phrase de la banque.

**B3 · La caméra ne montre jamais le schéma entier.** Correction (§ 5, K02, Q15, Q21) : la vue d'ensemble n'est plus un dézoom de caméra mais une **scène dédiée « Ensemble »** (K21) : le schéma redessiné à l'échelle de l'écran **sans texte à lire** (pastilles, couleurs, flèches, chiffres-clés seulement), ou l'image source elle-même en plein cadre. Zoom de caméra borné 0,8-1,6 sur la toile (plus de 0,55). Nouveau contrôle : **taille de texte effective = taille × zoom ≥ plancher de la charte** à chaque instant où un texte est à l'écran.

**B4 · Déclencheurs de bruitage fermés.** Vérifié : `DeclencheurBruitage` (`domaine/types.ts:1748`) repris dans `briques/intensite/bruitages.ts:69`, `intensite/types.ts:115`, `donnees/bruitages.ts:23`, `SonDuPlan.tsx:10`. Correction (§ 5, L4) : **aucune modification du type partagé**. Nos 6 « sortes » sont rattachées aux 5 déclencheurs existants, comme le fait déjà le cas concret (`DECLENCHEUR_DE`) : séparation et souffle de caméra → `illustration-forte`, chute et frappe → `document`, coche → `chiffre`, alerte → `telephone`. On commence avec les **20 sons existants** ; des variantes nouvelles (5, 6…) sous ces mêmes déclencheurs ne sont fabriquées que si l'écoute de Will les juge insuffisants, dans un lot coordonné (L4 bis : `outils/bruitages/fabriquer.mts`, `public/bruitages/manifeste.json`, ajout dans `SONS_BANQUE` de `donnees/bruitages.ts`). L'écoute de Will couvre les **20 sons existants** (tous « à vérifier ») + d'éventuelles variantes.

**I1 · `nombresDe` perd les unités.** Correction (§ 2, L1) : extracteur propre `chiffresDe(texte) → { brut, valeur, unite }[]` dans `domaine/image-video/chiffres.ts`, testé sur toutes les chaînes des 6 images (« 23h14 », « 24h/24 », « 4 sec », « 19 min/commande », « 20 cmd/jour », « 1er jour », « 6h », « 0 demande »). Ni `nombresDe` du cas concret ni celui de `domaine/preuves-saisie.ts:91` ne sont empruntés pour la carte ; `texteAvecNombres` reste emprunté pour passer le texte dit (lettres) en chiffres avant comparaison.

**I2 · Lecture d'image.** Correction (§ 1, L5) : chaque lecture reçoit l'image entière **+ 4 tuiles agrandies ×2** (quadrants avec recouvrement de 10 %) ; conversion en PNG côté serveur de tout format reçu (`ImageClaude` n'accepte que JPEG/PNG) ; **refus explicite** si l'image est trop petite (< 800 px de côté), si moins de 3 textes sont lus, ou si le type n'est reconnu par aucune des deux lectures (« Je ne reconnais pas ce type d'image : choisissez-le » — Will peut alors imposer le type).

**I3 · Q19 mesuré sur le mixage échoue (son de clôture).** Correction (§ 7) : silence de fin ≥ 300 ms et dernier mot mesurés sur la **piste voix seule** de chaque version ; le fichier final ne sert qu'à vérifier que la voix finit ≥ 1,5 s avant la fin et que la piste voix mixée est bien celle contrôlée (empreinte).

**I4 · Whisper invente sur les silences.** Correction (§ 7, Q18) : transcription de la **voix seule**, bornée à la durée de voix, filtrage d'une liste de phrases parasites connues (« Sous-titres réalisés par… », « Merci d'avoir regardé »…), et tout mot transcrit hors des bornes de voix est ignoré.

**I5 · Un panoramique compterait comme changement.** Correction (§ 7, Q14) : ne comptent que l'apparition d'un nœud, d'un chiffre ou d'un objet, une coche, et un changement de fond ou de scène. Les mouvements de caméra ne comptent pas.

**I6 · D1 contredisait Will (12/10).** Correction (§ 6, `52`) : sur LinkedIn la vidéo **ne dit rien** à la fin (`banque.ts:82-88` : `dit: ""`), lien et question dans le texte du post / premier commentaire. Plus de question à Will.

**I7 · Promesses non sourcées.** Correction (§ 4, Q05 bis) : pour toute image d'automatisation, annonce **obligatoire** « situation type » / « exemple » (dite au début de l'explication et écrite à l'écran). Contrôle des **formules absolues** (« zéro erreur », « 0 demande perdue », « dès le premier jour », « toujours », « jamais », « 100 % », « garanti ») : la formule est signalée et une **reformulation prudente est proposée à Will à la validation du script** (« presque plus d'erreurs de saisie »…) ; Will choisit, rien n'est remplacé en silence.

**I8 · L10 refaisait l'extraction d'images.** Correction (L10 remplacé, L13) : on réutilise l'opération existante du serveur de rendu (`soumettre("controle", { parametres: { etape: "images", instants } })`, appelée par `montage-facecam/chaine.ts:778`) — aucune opération nouvelle, aucune mise en ligne du serveur de rendu. L10 devient « **rendu fidèle à la prod** » : les images fixes de la galerie sont rendues en cloud depuis un paquet **construit comme la prod** (`npm ci --omit=dev`, sans typescript), sinon elles ne prouvent rien.

**I9 · « Mot pour mot » contre « interdits ».** Règle de priorité (§ 4) : **1. interdits permanents de Will** (machine, Villeexemple, aucun gain garanti, faux client, Certifexemple) — toujours bloquants, même dans la phrase-choc, avec une reformulation proposée ; **2. formules absolues** — signalées, Will tranche ; **3. mot pour mot** de la phrase-choc — s'applique à la version validée par Will (stockée dans la carte) ; **4. rien d'inventé** — un chiffre ou un mot ajouté par Will dans la carte ou le script devient une source (marqué « ajouté par Will ») et n'est pas refusé. Chaque conflit produit un message à Will en une phrase.

**Mineurs.** M1 : sortes ≠ déclencheurs, résolu par la table de rattachement (B4). M2 : 19 lots (L1-L18, L9 scindé en L9a/L9b, L10 remplacé) + L4 bis conditionnel, coûts unifiés partout (≈ 1,05 €, au plus ≈ 2,20 € ; très complexe ≈ 1,45 € / 3 €, § 9). M3 : **photos de vraies personnes jamais reprises** (image A) : la carte marque le nœud `photoPersonnes: true`, la scène redessine le contenu utile (le paperboard « Objectifs → Actions IA → Résultats ») sans personne. M4 : les 12 micro-objets K11 sont **à dessiner** (lot L9 scindé en L9a/L9b). M5 : test L1 déterministe (faux schéma figé en fixture, égalités départagées par id). M6 : plafond de durée **par réseau** (§ 3 et § 6).

**Coordination ajoutée** : `src/domaine/types.ts` et `src/donnees/bruitages.ts` rejoignent la liste des fichiers à ne pas toucher sans coordination. Le mot « machine » dans le modèle de ton (`src/donnees/generateur/modeles-will.ts:24`, W09) est **signalé à la session propriétaire**, pas modifié par nous ; notre contrôle Q08 le bannit déjà de nos scripts, et l'exemple de ton est passé à Claude avec la consigne explicite de ne pas reprendre ce mot.

---

## 0. Décision d'architecture : un FORMAT À PART (code « IV »), qui emprunte au cas concret sans le toucher

### 0.1 Ce qui a été comparé

| Critère | (A) « Porte image » du cas concret | (B) Nouveau format `image-video` (code IV) | (C) Reprendre la coquille « motion » (code MO) |
|---|---|---|---|
| Fichiers à modifier | `fiche.ts`, `regles.ts`, `cas.ts`, `fabriquer.ts`, `ecriture.ts`, `ValidationScript.tsx`… **tous OCCUPÉS par axion-ia-43** | Aucun fichier occupé ; 5 lignes de raccord, posées en dernier et coordonnées | `formats/autres.ts` + données de démo |
| Contrat d'entrée | `CasConcret` = catalogue écrit à la main, `faits` avec `source`/`preuve`, recette **par offre**, **3 à 7 étapes linéaires** (`etapes.min(3).max(7)`) | Une **carte de l'image** validée par Will (graphe : nœuds, liens, branches, chiffres) | — |
| Modèle de rendu | Écran par écran (`CasConcretEcran`, union FERMÉE de 12 types, `ecrans-motion/types.ts`) | Écrans v4 **réutilisés tels quels** pour l'émotion + **toile continue avec caméra virtuelle** pour les schémas | — |
| Risque pour l'existant | Élevé : le cas concret vient d'être jugé parfait (v-f17775b9177a) ; toute retouche le met en jeu | Nul sur le cas concret (import seul de fonctions pures) | Le format `motion` porte en démo des **musiques** (`mus-pulse`, Epidemic Sound), un profil son « volumeMusique 30 », un style de montage par défaut : contraire à « jamais de musique » |
| Schémas complexes (11+ blocs, 2 branches) | Impossible sans casser la borne 3-7 et l'union fermée | Prévu dès le départ | — |

`fiche.ts` prévoit bien `ORIGINES = ["porte-a", "porte-b"]` (catalogue / texte libre). Une « porte C » serait l'idée naturelle, mais elle obligerait à rouvrir le contrat du cas concret (types d'écran, bornes, règles R02-R23) au moment où une autre session le stabilise.

### 0.2 Décision
**(B) Nouveau format `image-video`, code de classement `IV`, moteur `montage-image-video`.**
- Il **importe** (sans jamais les modifier) les pièces pures déjà au point : voix et fin de voix, fins par réseau, textes de publication, extraction des nombres, interdits, ton v4, compositions v4 (socle et 12 types), bibliothèque « interface claire ».
- Tous ces emprunts passent par **un seul fichier** `src/moteurs/montage-image-video/emprunts.ts`. Il ré-exporte les symboles empruntés et est **épinglé par des tests**. Si axion-ia-43 change une signature, un seul fichier casse, de façon visible.
- Le code `MO` / format `motion` reste tel quel (réservé, non touché).

### 0.3 Les emprunts vérifiés dans le code (import seul)

| Emprunt | Symbole(s) sur `origin/master` | Fichier (propriétaire) |
|---|---|---|
| Voix corps + fins, relecture neuve si « euh », reprise sans repayer | `avancerVoixCasConcret`, `etatInitialVoixCasConcret`, `repriseVoixCasConcret`, `controlerPrise`, `REGLES_BLANCS_CAS_CONCRET`, `LECTURES_CORPS_MAX`=3, `LECTURES_FIN_MAX`=2 | `src/moteurs/montage-cas-concret/voix.ts` (axion-ia-43) |
| Fin de voix mesurée, coupes dans les vrais blancs | `lireWav`, `silencesMesures`, `controlerFinDeVoix`, `recalerCoupesSurSilences`, `REGLES_FIN_DE_VOIX` | `…/fin-de-voix.ts` (axion-ia-43) |
| Fins par réseau | **`planDesFins` n'est PLUS emprunté** (4 réseaux, `offre` obligatoire, code « CC » : B1). Seuls `motValide`, `FINS_MOT_AVEC_ENVOI` (patron) sont lus ; `planDesFinsIV`, `liensSuivisIV`, `codeVersionIV` sont écrits chez nous | `…/fins.ts` (axion-ia-43) |
| Banque des fins validée (lecture) | `TABLE_FINS_DIAGNOSTIC`, `finPour`, `RESEAUX_SANS_APPEL_A_COMMENTER`, lignes Usine `fin-ty-*` (Shorts), `fin-if-question`, `fin-ty-question-tache`, `fin-li-question` (patron du texte LinkedIn) | `src/briques/fins/*` (**ne jamais modifier `banque.ts`**) |
| Textes de publication | `textesDePublication`, `premierCommentaireDiagnostic`, consignes « où poser le lien » | `…/publication.ts` (axion-ia-43) |
| Nombres et interdits | `texteAvecNombres`, `UNITES_NOMBRE`, `MOTS_INTERDITS_FORMAT` (**`nombresDe` n'est plus emprunté** : il perd unités et heures, I1 ; extracteur propre `chiffresDe`) | `…/regles.ts` (axion-ia-43) |
| Ton v4 | `EXEMPLE_TON_V4` | `…/ecriture.ts` (axion-ia-43) |
| Bruitages (règles de pose) | `poserBruitages`, `SORTES_BRUITAGE`, `DECLENCHEUR_DE` (patron « sorte → déclencheur existant » ; nos sortes rattachées aux 5 déclencheurs, B4) | `…/bruitages.ts` (axion-ia-43) |
| Socle de Will | `chargerSocleWill`, `blocsSocleWill` | `src/services/socle-will.ts` |
| Ressemblance à la voix v4 (secondes 25-30) | `src/briques/voix-maitre/reference.ts`, `src/services/voix-ressemblance.ts` | commun |
| HeyGen | `fournisseurs/heygen/voix.ts` (`nouvelleLecture` → `force_regenerate`, 0,03 ¢ $/caractère) | commun (**`recette-voix.ts` jamais modifié**, seulement lu via la voix du cas concret) |
| Écrans v4 « émotion » | composition `CasConcretEcran` + types `accroche`, `chiffre`, `titre`, `resultat`, `objet`, `appel-mot`, `promesse`, `lien` (`src/briques/ecrans-motion/types.ts`) | `studio-rendu/compositions/cas-concret/**` (import) |
| Socle v4 | `Fond`, `MotParMot`, `Ligne`, `Eclair`, `Surgir`, `Marque`, `FilEtapes`, `plans/commun.ts` (`progres`, `doux`, `rebond`), objets `EMail`, `Chrono`, `DossierClasse`, `TelephoneNotification`, `BarresAvantApres`, `BouclierCoche`, `OutilsRelies`… | idem |
| Interface claire | `Icone` + `NOMS_ICONES`, `EtiquetteCompteur` + `ticsCompteur`, `mouvement.ts` (`progression`, `rebond`, `sortie`), cartes `ListeCochee`, `Statuts`, `Calcul`, `ChatTape` | `studio-rendu/compositions/interface-claire/**` (axion-ia-ca, import seul) |
| Réalisateur à plan contrôlé (patron) | boucle « Opus → zod → vérification → 3 essais guidés par les erreurs exactes → repli par règles fixes » | `origin/interface-claire/lot-c` : `realisateur/index.ts` (non fusionné → patron recopié tant que lot-c n'est pas fusionné ; import après fusion) |
| Comparaison texte dit / texte attendu | `occurrences`, `jetonsDits`, `memeMot`, `nombreEnLettres`, `tokens` | `src/briques/coupes/texte.ts` |
| Transcription Whisper | route `transcrire` (`fournisseurs/facecam/client.ts`, `studio-aligneur/aligneur/transcrire.py`) | commun |
| Relecture par l'image (patron) | `instantsDeControle`, `IMAGES_RELECTURE_MAX`=24 | `src/moteurs/montage-facecam/relecture.ts` |
| Extraction des images du fichier final (I8) | opération existante `controle`, `etape: "images"` (appel `soumettre("controle", …)`, `montage-facecam/chaine.ts:778`) | serveur de rendu (aucune opération nouvelle) |
| Mise en page, mesures | `controlerMiseEnPage`, `controleContraste`, `controleZoneSure`, `controleBandeSousTitres`, `controlerMesures` | `src/briques/controle-image/*` |
| Zones sûres par réseau | `obtenirReseau`, `zoneProtegeeCombinee` (9:16 bas : IG/FB 30 %, TT 26 %, YS 20 %, LI 14 %) | `src/reseaux/index.ts` |
| Coût annoncé avant | `tarifDe`, `pireCasUsd` (Opus 5.5 : 4 $ / 20 $ par million de jetons) | `src/fournisseurs/claude/tarifs.ts` |
| Image vers Claude | `ImageClaude` (JPEG/PNG base64) | `src/fournisseurs/claude/client.ts` |

**React (corrigé)** : l'ancien constat « 103 `.tsx` sans React » était une **fausse alerte** (voir « Corrections », point 0) : seul un JSX évalué au niveau module casse en prod. Nos fichiers importent React, et un test refuse tout JSX de niveau module sans import React, en bundlant comme la prod. Aucune alerte aux autres sessions.

---

## 1. Chaîne de bout en bout

```
 [1] Dépôt de l'image (Mes images / dépôt par morceaux, R2)
        │
 [2] LECTURE  — image convertie en PNG ; refus si < 800 px, < 3 textes lus ou type inconnu (I2)
        │        2 lectures Claude Opus vision indépendantes (image entière + 4 tuiles ×2)  ──►  fusion par le code  ──►  écarts
        │        + chiffres ré-extraits PAR LE CODE depuis les textes lus (`chiffresDe` : brut, valeur, unité)
        │        + type et complexité recalculés PAR LE CODE depuis le graphe ; photos de personnes repérées (jamais reprises)
        ▼
 [3] CARTE DE L'IMAGE (carte-image/1) affichée sur l'image  ──►  Will corrige / valide  (empreinte figée)
        │        validation OBLIGATOIRE pour les 10 premières vidéos, puis facultative (réglage `validationCarte`)
        │                       ▲ (aucun appel payant avant cette validation, sauf les 2 lectures)
        ▼
 [4] DURÉE ET PARCOURS calculés depuis la carte (classe simple / moyenne / branches / très complexe)
        │        très complexe : une vidéo en chapitres (défaut) ; plafond de durée PAR RÉSEAU (§ 3)
        ▼
 [5] ÉCRITURE — 1 appel Opus (≤ 2 avec relance guidée) : fiche-image/1 = texte dit + écrans typés reliés aux ids de la carte
        │        recette par type d'image sur l'ossature : accroche → douleur → début de réponse → explication de bout
        │        en bout (« situation type » annoncée si automatisation) → phrase-choc (validée) → [question de
        │        commentaire propre à l'image, sauf LinkedIn] → [fin du réseau, prise dans la banque]
        │        socle de Will + ton v4 + 2 accroches (A/B) ; contrôles BLOQUANTS avant de montrer à Will ;
        │        formules absolues et conflits « mot pour mot / interdits » présentés à Will avec une reformulation
        ▼
 [6] VALIDATION DU SCRIPT par Will (écran par écran : texte dit, texte écran, ce qui s'anime), modification, prix annoncé
        │
 [7] VOIX HeyGen (clone unique, starfish, 1,1) : corps lu UNE fois, une lecture par fin DISTINCTE
        │        euh → lecture neuve (≤ 3 corps, ≤ 2 fin) ; ressemblance v4 ; WAV obligatoire (pas de repli MP3)
        │        alignement forcé (aligneur) → heure de chaque mot ; tempo ×1,08 ; coupes dans les silences mesurés
        ▼
 [8] MISE EN SCÈNE (code, déterministe) : fiche + heures des mots → ligne de temps
        │        écrans « émotion » → props `CasConcretEcran` ; schéma → toile + trajectoire de caméra ;
        │        vue d'ensemble = scène dédiée « Ensemble » (K21), jamais un dézoom illisible
        │        chaque nœud / flèche / chiffre apparaît sur SON mot (avance 0,1-0,3 s) ; rythme vérifié
        │        bruitages posés (sortes rattachées aux 5 déclencheurs existants) ; sous-titres hors zones masquées
        ▼
 [9] RENDU studio-rendu (Remotion + FFmpeg, notre serveur) : corps rendu UNE fois + une fin par fin distincte
        │        (+ version courte taillée dans la même voix si un réseau dépasse son plafond, § 3)
        │        assemblage voix + bruitages (pas de musique), −14 LUFS ; piste voix seule gardée pour les contrôles
        ▼
[10] CONTRÔLES (porte unique) sur CHAQUE version : écoute (Whisper sur la voix seule vs script), fin entière, chiffres dits ET montrés,
        │        rien d'inventé, rythme, contraste, débordement, zones, mesures, relecture des images finales par Claude
        │        face à l'image source  ──►  REFUS si un contrôle bloquant échoue (phrase simple pour Will)
        ▼
[11] LIVRAISON : un fichier par réseau + texte de publication + premier commentaire + lien suivi
               dépôt Drive manuel pour vérification des premières vidéos ; Buffer en BROUILLON seulement
```

Machine à états reprenable (patron `montage-cas-concret/index.ts` + `briques/chaine-scenes`) : `lecture → carte-a-valider → ecriture → script-a-valider → voix → mise-en-scene → rendu → controles → prete | refusee`. Une voix payée n'est jamais relue. Une étape refusée garde tout ce qui précède.

---

## 2. Schéma de la « carte de l'image » (contrat `carte-image/1`)

Emplacement : `src/domaine/image-video/carte.ts` (zod, PUR, importable côté client). Un changement de forme = nouvelle version, jamais une retouche.

```ts
export const VERSION_CARTE_IMAGE = "carte-image/1";

/** Types reconnus. Une image peut en combiner deux (ex. AVANT_APRES dont chaque côté est une CHAINE). */
export type TypeImage =
  | "benefices"        // liste de N cartes (A, B)
  | "chaine"           // N étapes linéaires
  | "embranchement"    // 1 nœud de décision → 2-3 branches (C)
  | "entonnoir"        // N entrées identiques → filtre → sorties chiffrées (D)
  | "avant-apres"      // deux groupes opposés (E, F)
  | "convergence"      // N sources → 1 moteur → sortie
  | "tableau-de-bord"  // tuiles d'indicateurs
  | "chronologie";     // frise horodatée

export type RoleNoeud = "declencheur" | "etape" | "decision" | "sortie" | "resultat" | "benefice" | "source" | "moteur" | "indicateur";
export type CouleurImage = "orange" | "noir" | "vert" | "neutre";
export type Acteur = "auto" | "humain" | "inconnu";

export interface ChiffreCarte {
  id: string;                 // « c01 »
  brut: string;               // tel qu'écrit : « 80 % », « 23h14 », « 19 min », « 24h/24 »
  valeur: number | null;      // 80 ; null pour « 24h/24 » (non numérique simple)
  unite: "%" | "min" | "sec" | "h" | "heure" | "jour" | "€" | "nombre" | "autre";
  dansNoeud?: string;         // id du nœud qui le porte
  dansLien?: string;          // ou id du lien (« 80 % — Réponse connue »)
  dansBandeau?: boolean;
  aDire: boolean;             // défaut true ; Will peut passer à false (« affiché seulement »)
  lu: "les-deux" | "une-seule"; // concordance des 2 lectures
}

export interface NoeudCarte {
  id: string;                 // « n01 »
  libelle: string;            // texte EXACT de l'image
  detail?: string;            // ligne secondaire exacte
  role: RoleNoeud;
  icone?: string;             // ce que Claude voit (« enveloppe », « horloge »), traduit par la table d'icônes
  couleur: CouleurImage;
  acteur: Acteur;
  groupe?: string;            // id de groupe (branche, avant, après, colonne)
  ordre: number;              // ordre de lecture (flèches, sinon haut→bas, gauche→droite)
  quantite?: number;          // objets dessinés en nombre (20 enveloppes) → nuée / entonnoir
  sousElements?: string[];    // « Objet / Contexte / Demande / Urgence »
  exemple?: boolean;          // nom d'illustration (« Martin ») → toujours dit « par exemple »
  photoPersonnes?: boolean;   // photo de vraies personnes (image A) → JAMAIS reprise : on redessine le contenu utile
  ajoutWill?: boolean;        // ajouté ou corrigé par Will : devient une source (I9)
}

export interface LienCarte {
  id: string;                 // « l01 »
  de: string;                 // id nœud
  vers: string;               // id nœud
  etiquette?: string;         // « 80 % — Réponse connue »
  part?: number;              // 80 (pour 80 %) si la flèche porte une part
  couleur: CouleurImage;
  style: "plein" | "pointille";
}

export interface GroupeCarte {
  id: string;                 // « g-avant », « g-branche-a »
  sorte: "branche" | "avant" | "apres" | "colonne" | "sources" | "sorties";
  titre?: string;
  noeuds: string[];
  majoritaire?: boolean;      // branche orange / plus grosse part → racontée en premier
}

export interface CoherenceCarte {
  calcul: string;             // « 8 + 6 + 5 = 19 », « 19 × 20 min = 6 h 20 ≠ 6 h »
  ok: boolean;                // false = SIGNALÉ à Will, JAMAIS corrigé ; le script dit ce qui est écrit
}

export interface CarteImage {
  version: typeof VERSION_CARTE_IMAGE;
  image: { cle: string; empreinte: string; largeur: number; hauteur: number; orientation: "portrait" | "paysage" | "carre" };
  types: [TypeImage] | [TypeImage, TypeImage];  // principal, secondaire éventuel
  offre: Offre;               // B1 : déduite du type (formation / automatisation…), corrigeable à l'écran Déposer
  automatisation: boolean;    // vrai → annonce « situation type » obligatoire (I7)
  titre: string;
  sousTitre?: string;
  phraseChoc: string;         // texte EXACT du bas de l'image
  phraseChocValidee?: string; // version retenue par Will si la phrase contient un interdit ou une formule absolue (I9) ;
                              // c'est elle que le contrôle « mot pour mot » compare
  formulesAbsolues: { texte: string; ou: string; proposition: string; choixWill?: "garder" | "reformuler" }[]; // I7
  signature?: string;         // « Comprendre. Former. Transformer. »
  noeuds: NoeudCarte[];       // 1..40
  liens: LienCarte[];         // 0..60
  groupes: GroupeCarte[];
  bandeauChiffres: string[];  // ids de ChiffreCarte
  chiffres: ChiffreCarte[];   // inventaire COMPLET, ré-extrait par le code
  pied: string[];             // mentions de bas d'image (« Cas concrets · Ateliers pratiques… »)
  coherence: CoherenceCarte[];
  lecture: {
    ecarts: { champ: string; lectureA: string; lectureB: string }[];  // désaccords entre les 2 lectures
    alertes: string[];        // « chiffre dans un seul des deux », « flèche sans source »…
  };
  validation?: { par: "will"; le: string; empreinteCarte: string };   // absente = carte non validée
}

/** Calculé par le code (jamais par Claude) — voir § 3. */
export interface ComplexiteCarte {
  noeuds: number; liens: number; branches: number; niveauxDecision: number;
  chiffresADire: number; unitesNarratives: number;
  classe: "simple" | "moyenne" | "branches" | "tres-complexe";
  dureeCibleSec: number; fourchetteSec: [number, number]; motsCorps: [number, number];
  chapitres: { titre: string; noeuds: string[]; essentiel: boolean }[];  // vide sauf « tres-complexe » ;
                              // essentiel=false → chapitre détachable (branche minoritaire, détails), retiré des versions courtes
}
```

`Offre` est importé en type seul depuis `formats/cas-concret/cas.ts` (via `emprunts.ts`). `chiffresDe` (`domaine/image-video/chiffres.ts`, I1) rend `{ brut, valeur, unite }` et reconnaît heures (« 23h14 »), plages (« 24h/24 »), unités composées (« min/commande », « cmd/jour »), ordinaux (« 1er jour ») et zéros écrits (« 0 demande »).

Contrôles du code sur la carte (avant de la montrer à Will), aucun appel Claude :
- **Graphe** : tout lien pointe vers des nœuds existants, aucun nœud isolé hors `benefices` et `tableau-de-bord`, au plus 1 cycle.
- **Type** : un `embranchement` exige un nœud à ≥ 2 sorties. Un `entonnoir` exige `quantite` ≥ 2 en entrée et 2 sorties chiffrées. Un `avant-apres` exige deux groupes `avant` et `apres`.
- **Chiffres** : `chiffres` est recalculé par `chiffresDe` sur chaque libellé, détail et étiquette. Un chiffre lu par une seule des deux lectures porte `lu: "une-seule"` et passe en alerte.
- **Formules absolues** : repérées par le code dans tous les textes de la carte (liste : « zéro erreur », « 0 … perdu(e) », « dès le premier jour », « toujours », « jamais », « 100 % », « garanti », « aucun risque ») → `formulesAbsolues` avec une proposition prudente.
- **Photos de personnes** : un nœud `photoPersonnes` n'est jamais montré tel quel ; seul son contenu utile est redessiné.
- **Cohérence** : parts d'un même nœud dont la somme vaut 100 %, sommes « a + b + c = total », produits annoncés.

---

## 3. Règles de durée (calculées depuis la carte)

Débit de référence **3,4 mots/s** (voix HeyGen de Will à 1,1, puis tempo ×1,08), recalibré le 18/10/2026 sur deux vraies voix (3,52 et 3,27 mots/s mesurés ; 2,75 au départ, trop lent). Les mots de chaque classe sont durée × débit, arrondis : `DEBIT_MOTS_PAR_SEC` et `BORNES_CLASSE` (`src/domaine/image-video/complexite.ts`). Le corps va de l'accroche à la phrase-choc. Après le corps : la question de commentaire (≈ 3 s, sauf LinkedIn) puis la fin du réseau (2 à 5 s ; 0 s sur LinkedIn, où rien n'est dit).

**Unités narratives (U)** : chaque nœud `etape`, `sortie`, `resultat` ou `benefice` compte pour 1. Les étapes automatiques consécutives sans chiffre comptent ensemble pour 1. Chaque branche ajoute 1 (transition et retour). Une `nuée` ou un `entonnoir` comptent 2.
**C** = nombre de chiffres à dire. **B** = branches. **D** = niveaux de décision. **N** = nœuds.

| Classe | Déclencheur (premier qui s'applique, du bas vers le haut) | Corps visé | Mots du corps |
|---|---|---|---|
| **simple** | `benefices` ≤ 5 cartes, ou `avant-apres` ≤ 6 nœuds, B = 0, C ≤ 4 | **30-40 s** | 102-136 |
| **moyenne** | `chaine` 4-7 étapes, `entonnoir`, `convergence`, `avant-apres` chiffré, C ≤ 9, B = 0 | **40-50 s** | 136-170 |
| **branches** | B = 2 (ou 3), D = 1, N ≤ 14, C ≤ 12 | **48-56 s** (total ≤ 64 s avec question et fin) | 163-190 |
| **très complexe** | U > 9 **ou** C > 12 **ou** N > 14 **ou** D ≥ 2 **ou** B ≥ 3 | **chapitres : 60-78 s** (total ≤ 86 s, sous les 90 s de Facebook) | 204-265 |

Cible dans la classe : `cible = bas + (haut − bas) × min(1, (U/9 + C/12) / 2)`, arrondie à 1 s. Le script est refusé si sa durée estimée sort de la fourchette de ±10 %. Après la voix, la durée mesurée doit rester dans la fourchette de la classe, sinon la vidéo est refusée avec la phrase : « la voix dépasse de x s : raccourcissez telle partie ».

Répartition du corps :
- accroche ≤ 3 s, terminée avant 3 s ;
- douleur ≤ 8 s ;
- début de réponse ≤ 4 s, avec annonce du nombre (« deux chemins », « cinq choses », « trois blocs ») ;
- explication : 55 à 65 % du corps ;
- résultat chiffré + phrase-choc ≤ 9 s.

**Très complexe : UNE vidéo en chapitres** (décidé par défaut, modifiable par Will ; réglage `decoupage`, `deux-videos` reste possible mais n'est plus construit dans la première version — il passe en lot ultérieur si Will le demande) :
- Une seule vidéo, jusqu'à 78 s de corps, découpée en 2 à 3 chapitres. Le repère « 1/3 », « 2/3 », « 3/3 » reste affiché en haut.
- Chaque chapitre s'ouvre par la **scène « Ensemble »** (1 à 1,5 s, schéma réduit sans texte à lire, bloc du chapitre allumé), puis la caméra entre dans le bloc. Une petite boucle ouverte est posée toutes les 20 s au plus.
- Chapitres calculés par le code, de façon déterministe : groupes de la carte, sinon coupe du chemin principal en blocs de 3 à 5 unités ; égalités départagées par id. Chaque chapitre est marqué `essentiel` (chemin principal, résultat) ou non (branche minoritaire, détails).
- L'écriture rend tout chapitre non essentiel **détachable** : il commence et finit sur une phrase complète, et rien après lui n'y fait référence (contrôle du script).

**Plafond de durée PAR RÉSEAU** (durée totale = corps + question + fin) :

| Réseau | Plafond conseillé | Limite dure |
|---|---|---|
| TikTok | 60 s | — |
| YouTube Shorts | 60 s | — |
| LinkedIn | 60 s | — |
| Instagram Reels | 90 s | — |
| Page Facebook | 90 s | 90 s (registre) |

Règle appliquée à chaque version, après la voix (durées MESURÉES) :
1. durée ≤ plafond conseillé → livrée telle quelle ;
2. dépassement ≤ 15 % du plafond conseillé et sous la limite dure → livrée avec la mention « un peu longue pour ce réseau » (verdict orange, non bloquant) ;
3. au-delà → **version courte** pour ce réseau : on retire les chapitres non essentiels (du dernier au premier) en coupant la MÊME voix dans les silences mesurés aux bornes de chapitre, repères renumérotés (« 1/2 », « 2/2 ») ; aucun appel payant, un rendu de corps supplémentaire seulement. La version courte passe tous les contrôles (Q04 se lit alors sur les nœuds des chapitres gardés, et la carte de livraison dit ce qui a été retiré) ;
4. si la version courte dépasse encore le plafond conseillé de plus de 15 %, ou n'existe pas (aucun chapitre détachable) → **ce réseau n'est pas livré**, avec la phrase « Trop longue pour TikTok (74 s) : raccourcissez le script ou retirez ce réseau ».

Pour les classes simple, moyenne et branches, les bornes du tableau ci-dessus gardent le total sous 64 s : au pire la règle 2 s'applique.

---

## 4. Script : recettes par type (sur une seule ossature)

Fiche écrite par Claude : `fiche-image/1`, définie dans `src/domaine/image-video/fiche.ts`. Chaque écran porte :
- `texteDit` : chiffres en lettres ;
- `partie` : `accroche | douleur | debut-reponse | explication | resultat | phrase-choc` ;
- `scene` : sorte de scène (§ 5) ;
- `refs` : ids des nœuds, liens et chiffres de la carte ;
- `textesEcran` : `*mot*` = mot orange, un seul par écran ;
- `surMot` : événements visibles, chacun calé sur un mot dit ;
- `fond` : `sombre` ou `ivoire`.

| Type | Parcours (repris des storyboards A-F validés en interne) |
|---|---|
| benefices | accroche (question en « vous » ou « N choses ») → douleur → « voici ce qui change, un par un » + compteur 1/N → 1 bénéfice = 1 phrase titre + 1 phrase concrète + 1 micro-objet qui JOUE le bénéfice → récapitulatif (les N cartes en ligne = l'image reconstituée) → phrase-choc |
| chaine | accroche (chiffre ou situation) → douleur → « N étapes, zéro intervention » → fil orange d'étape en étape, caméra qui suit, repère « 3/5 » → résultat chiffré → phrase-choc |
| embranchement | accroche (heure ou situation) → douleur → « deux chemins » → entrée + décision → branche **majoritaire d'abord** jusqu'au bout → **retour visible** au nœud de décision → branche minoritaire → scène « Ensemble » (tout le schéma, sans texte à lire) → bandeau de chiffres → phrase-choc |
| entonnoir | accroche (volume) → douleur → « et si l'IA faisait le tri ? » → les N objets tombent au rythme de la voix → sorties avec compte ET pourcentage → bandeau → phrase-choc |
| avant-apres | accroche (chiffre AVANT le plus douloureux) → avant entier (chiffres qui s'additionnent) → bascule « Maintenant… » (volet + changement de fond) → après entier → duel de chiffres → phrase-choc |
| convergence | sources en rafale (une par mot) → moteur → sortie |
| tableau-de-bord | 2 ou 3 indicateurs dits, les autres seulement affichés (`aDire: false` validé par Will), plus le point d'attention |
| chronologie | heures dites dans l'ordre, frise qui avance |

Règles d'écriture (codées, contrôles 4 à 12 du § 7) :
- phrases de 12 mots au plus, au présent, en « vous » ;
- chiffres en lettres dans le texte dit, en chiffres à l'écran ;
- jamais de faux client : « situation type », « par exemple » ;
- **image d'automatisation** (`carte.automatisation`) : annonce **obligatoire** « Voici une situation type. » (ou « Exemple : … ») au début de l'explication, et l'étiquette « Situation type » écrite à l'écran sur le premier plan du schéma (I7) ;
- phrase-choc reprise **mot pour mot** (version validée par Will, `phraseChocValidee` si elle existe) ;
- **aucune phrase d'appel dans le corps** ;
- **question de commentaire** (`questionCommentaire`, champ de la fiche) : UNE question en « vous », ≤ 12 mots, propre au contenu de l'image (ex. chatbot : « Et chez vous, combien de messages attendent jusqu'au lendemain ? »), sans mot à commenter, sans lien, sans promesse. Elle est dite après la phrase-choc, au début du segment de fin, sur Instagram, Facebook, TikTok et Shorts ; sur LinkedIn elle n'est **ni dite ni affichée** : elle va dans le texte du post (patron `fin-li-question`). Repli si elle échoue aux contrôles : phrase de la banque (`fin-if-question` / `fin-ty-question-tache`) ;
- **2 accroches** de familles différentes (chiffre, question, ratio), Will choisit.

**Ordre de priorité des règles (I9)** — appliqué par le code, chaque conflit donne un message à Will en une phrase :
1. **Interdits permanents** (« machine », « Villeexemple », « aucun gain garanti », faux client, « certifié / Certifexemple ») : toujours bloquants, **même dans la phrase-choc de l'image** ; le studio propose une reformulation (« automatisation » pour « machine »…), Will la valide ou la réécrit.
2. **Formules absolues** (« zéro erreur », « 0 demande perdue », « dès le premier jour »…) : signalées avec une reformulation prudente proposée (« Une saisie. Trois outils. Presque plus d'erreurs. ») ; Will choisit « garder » ou « reformuler » à la validation du script. Non bloquant une fois tranché, bloquant tant que ce n'est pas tranché.
3. **Mot pour mot** de la phrase-choc : comparé à la version retenue par Will.
4. **Rien d'inventé** : comparé à la carte ET aux ajouts de Will (un chiffre tapé par Will dans la carte ou le script est marqué « ajouté par Will » et accepté).

**Photos de personnes** (image A) : jamais reprises ni détourées ; la scène redessine seulement le contenu utile (paperboard « Objectifs → Actions IA → Résultats » en dessin maison).

---

## 5. Bibliothèque de composants à créer (charte v4 `charte-duo/1`, Anton + Inter Bold)

Dossier : `studio-rendu/compositions/image-video/`. **Chaque `.tsx` commence par `import React from "react";`**. Un test parcourt le dossier et **refuse tout JSX évalué au niveau module** dans un fichier sans import React (le seul cas qui casse en prod, #201), puis bundle le dossier comme la prod (`jsx: "transform"`, sans typescript) et charge le paquet sans `globalThis.React` posé.
- Types de props PURS, sans alias `@/`, dans `src/briques/schema-motion/types.ts`, sur le modèle de `ecrans-motion/types.ts`.
- Une seule composition inscrite : `ImageVideoScene` (scène = une séquence continue).
- Les écrans « émotion » restent rendus par `CasConcretEcran`, sans copie.

| # | Composant | Ce qu'il anime | Réemploi |
|---|---|---|---|
| K01 | **Toile** | Grande surface (jusqu'à 3 × 3 écrans) où le schéma est posé une fois. Nœuds absents tant que leur mot n'est pas dit, déjà vus en grisé à 35 % | `Fond` v4 |
| K02 | **Caméra** | Panoramique et zoom d'un nœud à l'autre selon des images clés calculées (départ 0,2-0,3 s avant le mot, courbe douce, échelle **0,8 à 1,6**, vitesse plafonnée à 1,2 écran/s). **Pas de dézoom d'ensemble** : la vue d'ensemble est la scène K21 (B3). Taille effective de chaque texte (taille × zoom) ≥ plancher de la charte | `doux`, `progres` |
| K03 | **Nœud** | Carte arrondie (icône au trait + libellé Anton + détail Inter). Surgit avec rebond ; état actif, vu, fait (coche verte) ; couleur orange, noir ou neutre comme l'image | `Surgir`, `Icone` |
| K04 | **FlècheCourbe** | Flèche qui se dessine entre deux nœuds quelconques (bézier, pointe qui arrive en dernier), pleine ou pointillée, avec étiquette optionnelle | `Ligne` (logique) |
| K05 | **Embranchement** | Le fil se sépare en Y (ou en 3) ; étiquettes de part (« 80 % » orange, « 20 % » noir) qui comptent ; branche active allumée, l'autre atténuée ; retour visible au nœud de décision | K04, `EtiquetteCompteur`, `ticsCompteur` |
| K06 | **Entonnoir** | N objets (enveloppes, documents) tombent un à un au rythme de la voix ; l'entonnoir tourne ; deux sorties qui se remplissent avec leur compte et leur % | K07 |
| K07 | **Nuée** | 2 à 30 objets identiques en grille ; cascade de coches vertes ou de dorures ; compteur « 16/20 » | `ListeCochee` (logique), objet `EMail` miniature |
| K08 | **ÉcranPartagé** | Avant (noir) et après (orange) côte à côte ; volet de bascule ; les deux colonnes se répondent ligne à ligne | `BarresAvantApres` pour le duel final |
| K09 | **Additionneur** | Minuteurs qui montent (0→8, 0→6, 0→5), puis l'addition « 8 + 6 + 5 = 19 » qui se pose | `Chrono`, `EtiquetteCompteur` |
| K10 | **CarteBénéfice** | Icône + titre + ligne, entrée en cascade ; récapitulatif « N cartes en ligne » qui reconstitue l'image | `Icone`, `MotParMot` |
| K11 | **MicroObjet** | Une petite scène qui joue le bénéfice : horloge qui tourne à l'envers, jauge, cible, post-it qui se rangent, marches d'escalier. Banque FERMÉE de 12, choisie par Claude dans la fiche. **Les 12 sont à dessiner** (aucun n'existe tel quel ; M4) | style des dessins maison `src/briques/dessins/registre` (droits tenus) |
| K12 | **BandeauChiffres** | 2 à 4 chiffres qui claquent un par un (compteurs), sur fond sombre | `types/Chiffre` (rythme), `EtiquetteCompteur` |
| K13 | **RepèreChapitre** | Pastille « 2/3 » ou « Étape 3/5 » en haut, qui avance | `FilEtapes` |
| K14 | **Recherche** | Barre de recherche dont le texte se tape, puis « Trouvé — 3 s » + coche | `ChatTape` (logique de frappe) |
| K15 | **Alerte** | Notification qui tombe et secoue l'écran (« 🔔 Intervention requise ») | objet `TelephoneNotification` |
| K16 | **E-mail structuré** | E-mail dont les lignes se remplissent sur leurs mots (Objet, Contexte, Demande, Urgence) | objet `EMail` |
| K17 | **Dossiers** | 4 dossiers qui s'ouvrent ; chaque feuille vole dans le sien sur son mot | objet `DossierClasse` |
| K18 | **Sources** | Icônes de sources qui surgissent une par mot et lâchent chacune une feuille ; fils pointillés qui convergent | K04 |
| K19 | **PhraseChoc** | Phrase-choc mot à mot sur fond sombre, dernier mot en lueur, logo | `MotParMot` (`lueur`), `Eclair` |
| K20 | **Galerie** | Composition d'essai qui montre K01-K21 sur les 6 images du jeu d'essai, pour que Will juge à l'image sans rien payer | — |
| K21 | **Ensemble** (B3) | Vue d'ensemble plein écran : le schéma redessiné à l'échelle de l'écran **sans texte à lire** (pastilles numérotées, couleurs, flèches, 1 à 3 chiffres-clés en grand), bloc courant allumé ; variante « image source en plein cadre » pour le récapitulatif final. Sert aux ouvertures de chapitre et au retour après les branches | K03 réduit, K04 |

**Icônes** : une table unique « ce que Claude voit » → nom, dans `src/domaine/image-video/icones.ts`. Elle s'appuie sur `NOMS_ICONES` de l'interface claire et, en complément, sur Lucide (licence ISC) via `scripts/motion/generer-icones.mjs`. Un nom inconnu est refusé à l'écriture : pas de rond par défaut.
**Disposition des nœuds sur la toile** : calcul maison, pur et testé (`src/briques/schema-motion/disposition.ts`), en couches par profondeur et en colonnes par branche, sans dépendance externe. Elle garde la topologie et les couleurs de l'image, pas ses pixels.

**Bruitages** (obligatoires, CC0, banque du studio `donnees/bruitages.ts` : 20 sons = 5 déclencheurs × 4 variantes, tous « à vérifier » aujourd'hui). **Le type partagé `DeclencheurBruitage` n'est pas modifié (B4).** Six sortes nouvelles, propres à notre moteur, **rattachées aux déclencheurs existants** (même mécanisme que `DECLENCHEUR_DE` du cas concret) :

| Sorte (chez nous) | Moment | Déclencheur existant |
|---|---|---|
| `separation` | le fil qui se divise | `illustration-forte` (souffle court) |
| `camera` | mouvement de caméra marqué (pas chaque panoramique) | `illustration-forte` |
| `chute` | un objet qui tombe dans l'entonnoir | `document` (papier) |
| `frappe` | recherche ou e-mail qui se tape | `document` |
| `coche` | coche verte, en série | `chiffre` (tic) |
| `alerte` | petite sonnette | `telephone` (vibration) |

Plus les sortes v4 déjà rattachées (`souffle`, `pop`, `papier`, `vibration`, `tic`, `cloture`). Seuls les sons **validés par Will** sont posés (comme le cas concret) ; s'il en valide trop peu, la vidéo est refusée par Q20 plutôt que livrée muette. Si l'écoute montre qu'un moment n'a pas de son juste, des **variantes nouvelles sous le même déclencheur** (variante 5, 6…) sont fabriquées dans un lot coordonné (L4 bis) — jamais un déclencheur nouveau sans lot commun avec les sessions qui tiennent `domaine/types.ts`, `briques/intensite/*`, `donnees/bruitages.ts` et `SonDuPlan.tsx`.
- Pose automatique : un son par changement de plan, un par chiffre-choc, un par objet qui se pose, des rafales pour les compteurs ; jamais deux sons à moins de 0,1 s ; un son de clôture 1,5 s avant la fin.
- Les sons de l'interface claire (`whoosh-in`, `drop_00x`…) sont **absents du dépôt** (vérifié : `studio-rendu/public/` non suivi). Ils ne sont pas utilisés.

**Sous-titres** : brique `briques/sous-titres` (#15100c sur ivoire, ivoire sur sombre, sans ombre), groupes de 3 à 5 mots, mot fort en orange.
- Position : **au-dessus de la zone masquée de tous les réseaux visés**. Le calcul utilise `zoneProtegeeCombinee` ; pour un 9:16 visant IG et FB, le bas des sous-titres est à 68 % de la hauteur.
- Le contenu animé tient entre 9 % et 62 % de la hauteur.
- Un corps unique sert tous les réseaux 9:16 : rendu une seule fois, il réduit le coût et les écarts.

---

## 6. Versions par réseau

Le corps est rendu une fois en 9:16 (LinkedIn compris : vertical comme les autres, décidé par défaut). Seul le segment de fin change, par réseau : question de commentaire (sauf LinkedIn) puis fin de la banque, avec ses écrans, sa voix et son texte de publication. Les fins sont **prises telles quelles** dans la banque validée, regroupées par segment identique par **`planDesFinsIV`** (le nôtre, 5 réseaux, B1) : un fichier par segment distinct, plus une version courte là où le plafond l'exige (§ 3).

| Réseau | Ratio | Plafond conseillé | Question de commentaire | Fin dite (banque, lecture seule) | Mot à commenter | Où va le lien | Texte de publication |
|---|---|---|---|---|---|---|---|
| TikTok | 9:16 | 60 s | dite | `fin-ty-diagnostic-gratuit` + `fin-tt-lien-profil` | jamais | profil | accroche reprise en 1ʳᵉ ligne, 3-5 lignes, 3-5 mots-dièse |
| Instagram Reels | 9:16 | 90 s | dite | mot branché : `fin-ig-mot-abonnement` ; sinon `fin-if-diagnostic-gratuit` + `fin-ig-lien-profil` | oui, **si** mot + cadeau branchés | bio ou aucun | idem + « commentez {MOT} » si fin au mot |
| Page Facebook | 9:16 | 90 s (limite dure) | dite | mot branché : `fin-if-mot` + `fin-if-envoi-structure` ; sinon `fin-if-diagnostic-gratuit` + `fin-fb-lien-commentaire` | oui, **si** branché | 1ᵉʳ commentaire **posé à la main** (Buffer ne le pose pas sous un Reel) | idem |
| LinkedIn | 9:16 | 60 s | **ni dite ni affichée** (dans le texte du post) | **rien dit, rien affiché** (décision de Will du 12/10, `banque.ts:82-88`, `dit: ""`) : la vidéo s'arrête sur la phrase-choc + logo | jamais (garde `RESEAUX_SANS_APPEL_A_COMMENTER`) | 1ᵉʳ commentaire, posé à la main | question propre à l'image + « Le lien du diagnostic gratuit est en premier commentaire. » (patron `fin-li-question` / `fin-li-rdv-texte`) ; mot en dernière ligne seulement s'il est branché, jamais « commentez » |
| YouTube Shorts | 9:16 | 60 s | dite | `fin-ty-diagnostic-gratuit` + `fin-ty-lien-profil` (ligne Usine dont `reseaux` couvre `youtube-shorts` ; `fin-tt-lien-profil` est limitée à TikTok) | jamais | profil / description | titre ≤ 60 car. + description |

**Cadeau du mot à commenter** (décidé par défaut) : l'image source en grand format + une page « comment ça marche » de l'automatisation. Tant que ce cadeau n'existe pas réellement et que le mot n'est pas branché, **aucune promesse d'envoi** : fin « diagnostic » partout (garde de `planDesFinsIV`, testée).

**Question + fin = deux demandes** : la règle de la banque (« une fin ne fait plus qu'une demande », 12/10) visait la fin elle-même ; la question est une invitation à répondre, pas une demande d'action. Réglage `appelCommentaire: "question-puis-fin" | "fin-seule"` (défaut `question-puis-fin`), pour revenir en arrière d'un clic si Will le juge trop chargé.

Le lien est suivi (`liensSuivisIV`, `utm_content` = code version « 0042-IV-YS » écrit par `codeVersionIV`). Les interdits sont contrôlés sur le texte du post ET sur le premier commentaire (nouveau). La publication se fait par **téléchargement ou brouillon Buffer seulement** : deux défauts Buffer sont toujours ouverts (fichier choisi par ratio, premier commentaire déclaré envoyé mais jamais transmis).

---

## 7. Contrôles qualité (porte unique : la vidéo est REFUSÉE si un contrôle bloquant échoue)

Chaque contrôle tourne sur **chaque version** (corps + chaque fin), jamais sur la seule première sortie. Un refus produit une phrase simple pour Will (« Le chiffre 4 secondes est dit mais jamais montré : je refais l'écran 9 »). Rien n'est corrigé en silence.

| # | Contrôle | Seuil | Quand | Bloquant |
|---|---|---|---|---|
| Q01 | Deux lectures de l'image concordantes | 0 écart non tranché par Will | après lecture | **oui** (jusqu'à validation de la carte) |
| Q02 | Cohérence arithmétique de la carte | sommes, parts, produits | après lecture | non : signalé à Will, dit tel qu'écrit |
| Q03 | Carte validée par Will, empreinte inchangée | empreinte égale | avant écriture | **oui** |
| Q04 | **Rien d'oublié (texte)** : chaque chiffre `aDire`, chaque nœud, chaque branche est dit | 100 % | script | **oui** |
| Q05 | **Rien d'inventé** : aucun nombre hors carte et hors ajouts de Will (numérotation « un… cinq » et comptes visibles exceptés) ; aucune promesse absente de l'image ; nombres lus par `chiffresDe` (unités comprises) | 0 | script, écrans, post, question | **oui** |
| Q05 bis | **Promesses (I7)** : image d'automatisation → « situation type » / « exemple » dit ET affiché ; chaque formule absolue de la carte et du script tranchée par Will (« garder » ou « reformuler ») | 100 % | script | **oui** tant que non tranché |
| Q06 | Phrase-choc mot pour mot (version retenue par Will), juste avant le segment de fin | identique (casse et ponctuation ignorées) | script + écoute | **oui** |
| Q07 | Ossature complète : 6 parties dans l'ordre ; accroche ≤ 8 mots, finie avant 3 s ; annonce du nombre dans le début de réponse | présence + bornes | script + calage | **oui** |
| Q08 | Interdits : « machine(s) », « Villeexemple », « aucun gain garanti », « certifié / Certifexemple », faux client (« un client a… »), nom d'exemple sans « par exemple » — **prioritaires sur le mot pour mot** (I9) ; la question de commentaire est contrôlée aussi | 0 | script, question, écrans, post, 1ᵉʳ commentaire | **oui** |
| Q08 bis | Question de commentaire : présente dans les versions IG/FB/TT/YS, **absente (ni dite ni affichée) de LinkedIn** ; ≤ 12 mots, sans mot à commenter ni lien ; aucune fin LinkedIn dite | règles | script + chaque version | **oui** |
| Q09 | Phrases ≤ 12 mots ; un seul mot orange par écran ; chiffres en lettres dans le texte dit | 100 % | script | **oui** |
| Q10 | Durée du script dans la fourchette de la classe | ±10 % | script | **oui** |
| Q11 | Durée mesurée après la voix ; **règle du plafond par réseau** (§ 3 : livrée / mention « un peu longue » / version courte / réseau non livré) ; jamais au-delà d'une limite dure (Facebook 90 s) | fourchette de la classe ; plafonds § 3 | après voix, par version | **oui** (règle 4 et limite dure) ; mention seule pour la règle 2 |
| Q11 bis | Version courte : chapitres retirés tous non essentiels, coupes dans des silences mesurés aux bornes de chapitre, aucune phrase ne renvoie à un chapitre retiré | règles | après voix | **oui** |
| Q12 | Mise en scène : chaque nœud, lien, branche et chiffre de la carte a au moins un événement à l'écran | 100 % | mise en scène | **oui** |
| Q13 | **Chiffre dit = chiffre montré** : chaque chiffre dit apparaît à l'écran entre −0,3 s et +0,6 s autour de son mot | 100 % | mise en scène | **oui** |
| Q14 | **Rythme** : écart entre deux changements visibles. **Ne comptent que** : apparition d'un nœud, d'un chiffre ou d'un objet, une coche, un changement de fond ou de scène (I5). Les mouvements de caméra **ne comptent pas** | max ≤ 2,4 s ; moyenne 1,5-2,2 s ; aucun plan > 5 s (scène « Ensemble » ≤ 1,5 s) | mise en scène | **oui** |
| Q15 | Caméra : vitesse ≤ 1,2 écran/s, zoom 0,8-1,6, nœud parlé entièrement dans le cadre au moment de son mot ; **taille de texte effective (taille × zoom) ≥ plancher de la charte** pour tout texte visible (B3) ; chaque image à embranchement ou chapitrée a au moins une scène « Ensemble » | bornes | mise en scène | **oui** |
| Q16 | Voix : hésitation → lecture neuve (≤ 3 corps, ≤ 2 par fin) ; ressemblance à la référence v4 | seuils de `voix-maitre/reference` | voix | **oui** au-delà des relances |
| Q17 | Son brut en WAV disponible pour les coupes (**pas de repli MP3 silencieux**) | WAV présent | voix | **oui** |
| Q18 | **Écoute** : transcription Whisper de la **piste voix seule** de chaque version (telle qu'envoyée au mixage), bornée à la durée de voix ; phrases parasites connues filtrées (« Sous-titres réalisés par… », « Merci d'avoir regardé »…), mots hors bornes ignorés (I4) ; comparée au script validé. Le fichier final est relié à cette piste par son empreinte | ≥ 97 % des mots retrouvés dans l'ordre ; 100 % des chiffres entendus ; 0 mot ajouté de plus de 2 mots consécutifs | après rendu, chaque version | **oui** |
| Q19 | **Fin dite en entier**, mesurée sur la **piste voix seule** (I3 : le son de clôture du mixage fausserait la mesure) : dernier mot entendu + silence mesuré ≥ 300 ms après lui avant la coupe ; puis sur le fichier final : voix finie ≥ 1,5 s avant la fin (position connue par la ligne de temps) ; **jamais sauté** si la donnée manque (= refus) | 3 conditions | après rendu, chaque version | **oui** |
| Q20 | Bruitages : ≥ 1 son par changement visible (Q14) ; aucun silence total > 1,5 s ; seuls des sons **validés par Will** ; aucune piste de musique | seuils | mise en scène + fichier | **oui** |
| Q21 | Contraste texte/fond ≥ 4,5:1 ; taille ≥ plancher de la charte ; débordement 0 px ; texte dans la zone sûre de CHAQUE réseau visé | `controlerMiseEnPage` | mise en scène | **oui** |
| Q22 | Sous-titres hors zones masquées de chaque réseau visé ; jamais sur un texte d'écran | 0 recouvrement | mise en scène | **oui** |
| Q23 | Défauts visibles : texte sur texte, objet vide, objet sous les sous-titres, phrase en double | 0 | mise en scène | **oui** (indicatif dans le cas concret) |
| Q24 | Mesures du fichier : −14 LUFS ±1, crête ≤ −1 dBTP, aucune image noire ou figée > 0,5 s, 1080 × 1920, 25 i/s | `controlerMesures` | fichier | **oui** |
| Q25 | « axion-ia.com » visible sur chaque plan | 100 % | mise en scène | **oui** |
| Q26 | **Relecture des images finales par Claude face à l'image source** (images extraites par l'opération existante `controle` / `etape: "images"`, I8 ; une extraction ratée = refus, jamais « livrée sans relecture » comme en face caméra) : jusqu'à 24 images clés du fichier final (une par nœud, une par charnière, une par chiffre-choc, la fin) + l'image source. Questions fermées : tout est-il montré ? quelque chose de faux ? illisible ? hors charte ? | toute réponse « faux », « manque » ou « illisible » | après rendu | **oui** (les simples suggestions sont indicatives) |
| Q27 | Textes de publication : lien suivi présent là où la fin le promet ; longueur par réseau ; interdits (Q08) | règles | livraison | **oui** |
| Q28 | Débit voix mesuré | 2,9-3,9 mots/s (3,4 ±15 %) | après voix | non (sert à recalibrer) |

En cas de refus après Q18-Q26, une seule reprise automatique est permise, uniquement si elle ne coûte rien (rendu ou remise en scène). Une relecture de voix payante n'est jamais relancée sans l'accord de Will.

---

## 8. Interface (onglet « Image → vidéo »)

Patron : pages et composants du cas concret (`src/app/(studio)/cas-concret/`, `components/formats/cas-concret/*`), **copiés comme patron, jamais modifiés**. Peu de texte, des blocs, des visuels.

1. **Déposer**
   - Glisser l'image ou la choisir dans Mes images.
   - Cocher les réseaux, tous les cinq par défaut.
   - L'offre concernée (formation, automatisation…), pré-remplie d'après l'image, corrigeable (B1).
   - « Avec le mot » seulement si un mot et un cadeau réel sont branchés.
2. **Voici ce que j'ai compris**
   - L'image à gauche. À droite, la carte en blocs : étapes numérotées, branches en couleur, chiffres en pastilles.
   - Les écarts entre les deux lectures sont surlignés en jaune.
   - Will corrige un texte, un chiffre, l'ordre ou une branche, et coche « affiché seulement » si besoin.
   - Bandeau : « Image à embranchement · vidéo d'environ 55 s ».
   - Bouton **Valider la carte**. Étape obligatoire pour les 10 premières vidéos ; ensuite le réglage `validationCarte: "toujours" | "si-doute"` (défaut automatique `si-doute` après 10 cartes validées sans correction de fond) ne l'affiche que s'il y a un écart entre les deux lectures, une alerte ou une formule absolue.
3. **Le script**
   - Une ligne par écran : texte dit, texte écrit, une vignette de ce qui s'anime.
   - Deux accroches au choix.
   - La question de commentaire, modifiable.
   - Les phrases trop affirmatives surlignées, chacune avec sa version prudente proposée : « garder » ou « prendre la version prudente » (I7, I9).
   - Modification en place.
   - Prix annoncé : « environ 1 €, au plus 2,20 € ».
   - Bouton **Valider et fabriquer**. La voix n'est payée qu'après ce clic.
4. **Fabrication** : étapes avec leur état (voix → mise en scène → rendu → contrôles), aperçu dès qu'il existe.
5. **Vos vidéos**
   - Une carte par réseau : la vidéo, un verdict vert ou rouge en une phrase, le texte du post, le premier commentaire, l'endroit où poser le lien.
   - Boutons « Télécharger » et « Brouillon Buffer ».
   - Un refus dit quoi et propose « Refaire cette partie ».

---

## 9. Coûts estimés par vidéo (tarifs du code : Opus 5.5 = 4 $ / 20 $ par million de jetons ; HeyGen 0,03 ¢ $ par caractère ; rendu et transcription sur nos serveurs)

| Poste | Habituel | Au plus |
|---|---|---|
| Lecture de l'image (2 lectures Opus vision, image + 4 tuiles ≈ 10 k jetons d'entrée, ~4 k de sortie chacune ; une relance au plus) | 0,24 $ | 0,36 $ |
| Écriture du script (socle de Will en cache, ~8 k de sortie ; 1 à 2 appels) | 0,25 $ | 0,50 $ |
| Voix du corps (~800 caractères ; 1 à 3 lectures) | 0,25 $ | 0,75 $ |
| Voix des segments de fin (question + fin ; 3 segments distincts en moyenne, ~160 caractères ; 1 à 2 lectures) | 0,15 $ | 0,30 $ |
| Relecture des images finales (24 images + l'image source ; 1 à 2 appels) | 0,25 $ | 0,50 $ |
| Rendu, assemblage, versions courtes, transcription Whisper, contrôles | 0 $ (nos serveurs) | 0 $ |
| **Total par vidéo, toutes versions réseau comprises** | **≈ 1,14 $ ≈ 1,05 €** | **≈ 2,41 $ ≈ 2,20 €** |
| Très complexe (chapitres, jusqu'à 86 s) | ≈ 1,45 € | ≈ 3,00 € |

(Taux retenu : 1 $ ≈ 0,92 €.) Le prix est annoncé et réservé avant chaque appel payant (`pireCasUsd`, plafonds). Les essais se font en **simulation**, sans dépense.

**Premiers essais réels — plafonds fermes soumis à Will** (le moteur s'arrête au plafond, il ne le dépasse jamais) :
| Étape | Contenu | Habituel | Plafond |
|---|---|---|---|
| 1 | Lecture des 6 images d'exemple (aucune vidéo) | ≈ 1,35 € | **2,00 €** |
| 2 | Une vraie vidéo complète (le chatbot), 5 réseaux, lecture déjà payée | ≈ 0,85 € | **2,00 €** |
| 3 | Les 5 autres vidéos complètes | ≈ 4,25 € | **9,50 €** |
| **Total** | | **≈ 6,45 €** | **13,50 €** |

Chaque étape attend le feu vert de Will sur la précédente.

---

## 10. Risques et parades

| Risque | Gravité | Parade |
|---|---|---|
| Claude lit mal l'image (ordre des flèches, chiffre rattaché au mauvais bloc) | critique | Double lecture, chiffres ré-extraits par le code, carte validée par Will (toujours au début), jeu d'essai des 6 images avec attendus écrits à la main |
| Schéma complexe illisible ou caméra qui donne le tournis | élevé | Disposition calculée et testée ; vitesse et zoom bornés (0,8-1,6) ; taille de texte effective contrôlée ; vue d'ensemble en scène dédiée « Ensemble » sans texte à lire ; galerie K20 jugée par Will avant tout réel |
| Les fichiers empruntés au cas concret changent de signature | moyen | Un seul fichier `emprunts.ts` épinglé par des tests ; liste des symboles envoyée à axion-ia-43 ; `planDesFins` et `nombresDe` ne sont plus empruntés |
| Rendu de prod cassé par un JSX de niveau module sans React | critique (tous les formats) | Test qui refuse ce cas sur notre dossier + bundle construit comme la prod (sans typescript) ; galerie rendue depuis ce paquet (L10) |
| Conflits sur les 5 fichiers de raccord partagés (FA y ajoute aussi sa ligne) | moyen | Raccords dans un lot à part, posé en dernier, après accord d'axion-ia-ca ; format `masque` d'ici là |
| Bruitages non validés à l'oreille (les 20 existants sont tous « à vérifier ») | élevé (vidéo refusée par Q20) | Will écoute les 20 sons existants dans la Bibliothèque avant le premier réel ; variantes nouvelles seulement si besoin (L4 bis coordonné) |
| Type partagé des bruitages modifié par erreur | moyen (5 fichiers d'autres sessions) | Interdit : rattachement de nos sortes aux 5 déclencheurs existants |
| Sons de l'interface claire absents du dépôt | moyen | Non utilisés |
| Durée réelle de la voix plus longue que prévu | moyen | Débit recalibré sur la première voix ; refus Q11 avec la partie à raccourcir, avant tout rendu ; version courte par réseau (§ 3) |
| Contradiction LinkedIn | — (réglé) | Rien n'est dit à la fin de la vidéo LinkedIn (décision de Will du 12/10) |
| Mot à commenter promis sans cadeau réel | élevé (promesse non tenue) | Fin « diagnostic » tant que le cadeau (image en grand + page « comment ça marche ») n'existe pas et que le mot n'est pas branché |
| Promesse trop forte (« zéro erreur ») ou faux cas | élevé (DGCCRF, « ne pas trop s'engager ») | Annonce « situation type » obligatoire ; formules absolues tranchées par Will (Q05 bis) |
| Photo de vraies personnes reprise sans accord | élevé (droit à l'image) | Jamais reprise ; contenu utile redessiné |
| Whisper qui invente sur les silences | moyen (faux refus) | Transcription de la voix seule, bornée, filtrée (Q18) |
| Buffer : mauvais fichier, premier commentaire jamais posé | élevé | Téléchargement ou brouillon seulement ; consigne manuelle affichée |
| Limites des réseaux non vérifiées à la source officielle | faible | Plafonds par réseau dans une seule table (§ 3), total ≤ 86 s ; à revérifier avant de coder en dur |
| Écart de charte : orange des images (#C9471B environ) contre orange vidéo (#C2532A) | faible | La charte vidéo v4 prime (déjà validée) ; la relecture Q26 ne juge pas la nuance |
