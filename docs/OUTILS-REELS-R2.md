# Lot R2 — Textes de publication écrits par Claude (chemin de dépense contrôlé)

> 03/10/2026 · branche `outils/r2` depuis `03d297b` (production) · plan : `<dossier-de-plan-prive>/PLAN-OUTILS-REELS-2026-10-03.md`, constat C9, lot R2.
> Aucun appel Claude réel pendant le lot : toutes les réponses sont servies par un faux `fetch` (`injecterClaudePourEssai`), sans clé.

## Ce que ça change pour Will

- Quand Claude est choisi pour « Textes de publication » (Réglages > Connexions, ou `FOURNISSEUR_TEXTE_RESEAUX=claude` avec `ANTHROPIC_API_KEY`), Claude écrit les textes **une seule fois par vidéo, à la fin de sa première fabrication**, et **seulement pour les réseaux par défaut** (LinkedIn, Instagram, TikTok, YouTube Shorts par défaut). Une retouche ou un recalque ne relance jamais Claude ; un réseau non écrit (crédit, plafond, réponse refusée) garde son texte d'essai et ne repart que par « Réécrire ».
- Le prix est annoncé **au lancement** : la feuille de fabrication montre « Textes des réseaux · environ X € (compris dans le total) ». Ce montant est engagé sur le budget, mais il **ne bloque jamais la vidéo** : la vidéo part toujours ; si le crédit Claude manque (ou si Claude échoue), les textes restent en version d'essai.
- **Ouvrir une vidéo ne coûte jamais rien** (C9 corrigé) : l'affichage du kit n'appelle jamais Claude.
- Chaque texte porte son origine : « Écrit par Claude », « Texte d'essai », « Retouché par vous », « Texte de la version ».
- Le bouton dit le prix **avant** le geste, au pire (reprise comprise) : « Réécrire · jusqu'à environ 0,07 € ». « Réécrire » est refusé sur le réseau d'une vidéo de version (son texte vient du sujet) et, Claude choisi, sur une vidéo d'exemple.
- Le journal du studio se lit en mots simples (aucun code d'évaluation, marqueur, expression ni nom de modèle) ; le détail technique va au journal du serveur.
- Un texte que Will a retouché n'est **jamais** remplacé tout seul ; « Réécrire » sur ce texte demande d'abord « Vous avez retouché ce texte. Le remplacer par un nouveau texte ? ».
- La fin du texte (mention si elle est activée sur la vidéo, crédits) est ajoutée par le code, exactement comme aujourd'hui (`composerLegende`) ; Claude ne l'écrit jamais. Mention coupée : rien n'est ajouté.

## Coût

| | Estimation (Sonnet 5.5, effort bas) |
|---|---|
| Un réseau | ≈ 0,011 $ (pire cas réservé ≈ 0,035 $ × 1,2) |
| Une vidéo, 4 réseaux par défaut | **≈ 0,045 $** (pire cas 0,14 $) |
| Une reprise ciblée (sortie refusée) | un appel de plus, compté |
| Plafond par vidéo | **0,30 $** (réglage `claude.plafondKitUsd`) |

Estimation = coût de l'entrée + un quart de `maxTokens` en sortie (rôle jamais mesuré au banc G4, règle de `generateur/roles/estimation.ts`). Le vrai coût sera relevé lors de la vérification payante (≈ 0,05 $, avec l'accord de Will).

## Chemin de la dépense (une seule porte)

`services/depense-claude-video.ts` · `executerRolePourVideo(videoId, role, entree, { etape })`, qui réutilise `generation-claude.ts` (exports ajoutés : `claudeActif(type)`, `sousVerrouMois`, `taux`, `ligne`, `coutReelUsd`, `attendre`, `attenteSurcharge`) et la brique Crédits :

1. Claude non choisi pour les textes, ou clé absente → simulation, 0 $.
2. **Sous le verrou du mois** (le même que l'écriture des sujets), d'un seul tenant :
   plafond de la vidéo (dépensé + réservé + pire cas × 1,2 ≤ 0,30 $) → limite Claude du mois → pré-vol (budget du studio, solde Claude suivi) → réservation rattachée à la vidéo.
3. Appel hors verrou ; dépense réelle `anthropic` sur la vidéo (`DepenseEnregistree.videoId`), réservation consommée.

Refus net (facturation, clé, modèle, surcharge après 3 essais) → réservation rendue. Coupure après l'envoi → réservation **gardée** (l'appel a pu être facturé), comptée dans le mois et dans le plafond de la vidéo, soldée le mois suivant. La clé n'apparaît jamais (`masquerSecrets`, test).

Rien ne repart seul : un texte arrêté (plafond, limite, crédit) garde son texte d'essai.

## Rôle `publication` (`generateur/roles/publication.ts`, PUR)

- Entrée : texte validé de la vidéo (seule source des faits), réseau, place laissée par la fin, mots-dièse permis, règles datées citées (une règle archivée ne part plus ; `hyp-*` = hypothèse), adresse « vous »/« tu ».
- Sortie validée (zod) : `premiereLigne`, `texte`, `motsDiese`, `titres?`, `justifications`.
- **Évaluations écrites avant la consigne.** Critiques (la réponse est refusée, une reprise ciblée avec `<corrections_demandees>`, puis le texte actuel est gardé) : PUB-01 nombre absent de la vidéo · PUB-02 récit client inventé · PUB-03 mention ou crédits écrits par le modèle · PUB-04 adresse · PUB-05 longueur · PUB-06 tournure interdite (classe A) · PUB-07 lien inventé. Corrigées par le code et notées au journal : PUB-08 mots-dièse · PUB-09 titres · PUB-10 1re ligne · PUB-11 règle citée.
- `simuler` = la logique du rédacteur simulé, à l'identique (`corpsTexteSimule`, partagé) ; testé réseau par réseau, au « vous » et au « tu ».
- La consigne ne nomme aucun réseau (les règles arrivent en données).

## Garde-fous du kit (`services/publications.ts`)

- `genererKit(videoId, { autoriserDepense, reseaux })` : `false` par défaut ; seul `travaux.creerKitSiAbsent` (suites de fabrication) passe `true`.
- Claude n'écrit qu'un **texte d'essai intact** (égal au texte d'essai d'aujourd'hui, sans source ni drapeau) : jamais un texte de Claude, d'une version, ou retouché — même une retouche ancienne sans drapeau.
- Jamais pour une vidéo d'exemple ni pour une vidéo de version (son texte vient déjà du générateur).
- Retouche pendant l'écriture : le texte de Claude n'est posé que si le texte n'a pas bougé (`poserSiInchange`, sous le verrou du kit) ; sinon la version de Will est gardée et c'est noté au journal.
- Création du kit, retouches, textes de Claude et resynchronisation des versions passent sous un même verrou local (deux affichages simultanés ne créent plus deux kits).

## Preuves

- **ROUGE sur 03d297b** (test écrit avant le code, lancé sur le code de production) : « suites de fabrication : Claude écrit SEULEMENT les réseaux par défaut » → `expected [] to deeply equal [ 'instagram', 'linkedin', 'tiktok', 'youtube-shorts' ]`. Vert après.
- « obtenirKit avec Claude choisi : zéro appel » : vert sur 03d297b (le danger n'existe qu'une fois Claude branché) ; **rouge prouvé par mutation** (affichage passé à `autoriserDepense: true` → 4 appels).
- Mutation « verrou retiré » sur le plafond par vidéo → 3 appels au lieu de 1 (rouge) ; restauré → vert.
- Mutation « garde des retouches retirée » → 2 tests rouges ; restauré → vert.
- `tests/r2-textes-publication.test.ts` (23 tests) · `tests/r2-role-publication.test.ts` (26 tests).
- `npx tsc --noEmit -p .` = 0 · eslint des fichiers touchés = 0 · `npx vitest run --maxWorkers=2` complet vert (voir le rapport du lot).

## Points d'intégration (autres lots)

- `fournisseurs/index.ts` : la ligne `"texte-reseaux"` reçoit `...texteReseauxClaude()` ; l'import existant de `./claude/inscription` est étendu (même ligne). Rien d'autre.
- R0 (`Connexions.tsx`, `optionsConnexion`) : l'implémentation `claude` du type `texte-reseaux` est inscrite si `ANTHROPIC_API_KEY` existe ; son `ecrire` reste la simulation (aucune dépense possible hors du chemin contrôlé).
- R1 (`envoyerVersBuffer`) : non touché ; il lit `obtenirKit`, qui ne dépense jamais.
- `VueKitReseau` gagne `origine?` et `prixReecriture?` ; `TexteReseau.source` gagne `"claude"`.

## Pour activer (opérateur, après accord de Will)

1. `ANTHROPIC_API_KEY` déjà présente sur le serveur (générateur).
2. Choisir Claude pour « Textes de publication » dans Réglages > Connexions (R0), ou `FOURNISSEUR_TEXTE_RESEAUX=claude`.
3. Vérification payante unique (≈ 0,05 $) : une vidéo prête, regarder les 4 textes et la dépense sur la fiche.

## Relecture du 03/10 (exactitude, simplicité) — corrections

| N° | Défaut | Correction | Test rouge prouvé sur 2d9fb62 |
|---|---|---|---|
| 1 | Une suite « finition » arrive après chaque travail : Claude relancé sur les textes restés en essai (échec, plafond) | `KitPublication.ecritureAuto` (une fois par vidéo, réservé sous le verrou du kit, réseaux non écrits notés) ; suite marquée `textes` seulement après une fabrication | facturation puis 2ᵉ suite → 1 appel au lieu de 3 ; refus ×2 → 8 au lieu de 16 ; retouche → 0 au lieu de 3 ou 4 |
| 2 | Journal du studio avec codes `PUB-xx`, marqueurs, modèles | libellé en clair par évaluation (`libelle`, `libellesDesEchecs`), détail au journal du serveur | journal contenait `PUB-01` |
| 3 | Mot-dièse porteur d'un lien | `FORME_MOT_DIESE` : filtre de `motsDiesePropres` ; mots-dièse évalués (nombres, liens, tournures) | `#www.site.com` passait |
| 4 | « Réécrire » payé puis effacé (réseau d'une version) ; payé sur un exemple | refus `TEXTE_DE_VERSION`, `VIDEO_EXEMPLE` (Claude choisi), sans appel | 1 appel au lieu de 0 |
| 5 | Prix affiché = estimation réaliste | 2 × pire cas (reprise comprise), « jusqu'à ≈ » | 2 centimes < 6 |
| 6 | Appel interrompu soldé : sort du plafond de la vidéo | dépense ESTIMÉE (datée du mois de l'appel) comptée par `engageClaudeVideoCentimes` | 2 < 6 |
| 7 | Écriture automatique sans prix annoncé | ligne « Textes des réseaux » dans `apercuFabrication` et le lancement (`verifierEtReserver`), écran `BlocCout` | ligne absente |
| 8 | Plafond en dollars à l'écran | dit en euros (`usdVersEur`) ; limite du mois sans montant | message en $ |
| 9 | Doublons | `placeDuCorps`, `finDuTexte` (domaine, aussi la simulation), `titresDemandes` (depuis `CHAMPS_PUBLICATION`), `TITRE_CARACTERES_MAX`, `MESSAGE_CLE_REFUSEE`, `formaterUsd`, `creerVerrou` | — (comportement inchangé) |
| 10 | Octets NUL dans `cleSaisie` | échappement `\u0000` (même valeur) ; le fichier est du texte pour git | — |

« Fabriquer les N » (versions par réseau) n'a pas de ligne « Textes des réseaux » : Claude n'écrit jamais le texte d'une vidéo de version (il vient du générateur).

## 2ᵉ relecture du 03/10 (exactitude, simplicité) — corrections

| Lettre | Défaut | Correction | Test rouge prouvé |
|---|---|---|---|
| a | La ligne « Textes des réseaux » passait par le contrôle des crédits du lancement : sans crédit Claude, « Crédit Claude insuffisant » bloquait la vidéo ; un budget juste suffisant pour la vidéo seule la bloquait aussi | `LigneCout.facultative` (ligne des textes) : comptée dans le total annoncé et engagée sur le budget (`engagerBudget`), jamais dans le refus budget/confirmation (`centimesBloquants`), le contrôle ni la réservation des crédits (`lignesBloquantes`). À la fin, le chemin des textes contrôle lui-même : faute de crédit, version d'essai | « crédit Claude absent : la fabrication part quand même » (rouge : `Crédit Claude insuffisant`), « budget juste suffisant » (rouge : `depasse` vrai) ; mutations « contrôle des crédits sans filtre » → 2 rouges, « réservation sans filtre » → 1 rouge |
| b | Nombre d'essais recopié (`tour <= 2`, « essai N sur 2 », `ESSAIS_AU_PIRE = 2`) | `ESSAIS_TEXTE_PUBLICATION` (rôle `publication`), seule définition, importée par la boucle, le journal et le prix de « Réécrire » ; tests sur la constante | constante absente (rouge) |
| c | « Textes des réseaux · ≈ X € » ne disait pas qu'il était compris dans le total | « Textes des réseaux · environ X € (compris dans le total) » | texte de l'écran (rouge) |

Relecture « simplicité » de 1b4058b (finitions) : une seule règle de tri (`estFacultative`, utilisée par `lignesBloquantes` et `centimesBloquants` ; ce dernier part du total, qui n'est pas toujours la somme des lignes) ; séparateur de la fin défini une fois (`SEPARATEUR_FIN`, `textes-publication.ts`), `placeDuCorps` en tire sa longueur ; « Réécrire · jusqu'à environ X € » ; « Reste ce mois après la vidéo » jamais négatif ; test du prix au pire cas fusionné avec celui des essais (constante et taux importés).
