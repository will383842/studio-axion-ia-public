# Journal du lot K — « Effet réaliste par IA » (09/10/2026)

Branche `feat/facecam-k`, partie de `origin/feat/facecam`, qui y a été refusionnée en cours de route (lots I2 et F2,
puis la mission Z). `origin/feat/facecam-j` (brique `options-payantes`, `JOURNAL-J.md` présent) a été fusionnée dès le
départ, puis une seconde fois : **sa brique est utilisée**, aucun point d'entrée provisoire n'a été nécessaire.
Référence : décision de Will du 09/10 (« les objets 3D composés ne font pas réaliste »), journaux E1, I2, D, H, J.
**Rien n'a été fusionné dans master. Aucune PR, aucun déploiement, aucun serveur touché. Aucun appel réel : Claude,
Higgsfield et le studio-aligneur sont des doubles ; le réseau est interdit dans les tests.**

## Ce que Will peut faire maintenant
Après la génération, dans « Discuter avec mon monteur » : « Rajoute au bon endroit un téléphone dans ma main et
jette-le sur l'écran ».
1. Le monteur (UN appel Claude, ou la version simple) prépare l'effet : le **bon endroit**, la **consigne vidéo en
   anglais**, la **durée** (3 à 8 s). Rien n'est posé, rien n'est dépensé.
2. Il répond avec la **carte de confirmation** (brique J) et un **aperçu** : l'image fixe du moment choisi, l'instant
   (« À 0:42 »), la phrase dite à cet instant, ce que l'effet fera, puis
   « Effet réaliste par IA — option payante, environ X € pris sur vos crédits Higgsfield. [Confirmer] [Annuler] ».
   « **Changer de moment** » pré-remplit « Plutôt à 0: » ; Will peut aussi écrire « plutôt à 0:42 » ou « plutôt quand
   je dis Certifexemple » : la carte est refaite, l'ancienne demande est annulée (rien dépensé).
3. **Annuler** → la vidéo reste gratuite. **Confirmer** → une nouvelle version part avec l'effet ; l'ancienne reste
   visible ; le monteur répond « … la nouvelle sera prête vers 14 h 35 ».
4. Fabrication : passage extrait de la passe image → Higgsfield (Kling Omni Edit si une image de référence existe —
   logo Axion, objet de Mes images —, sinon FLUX 3 Video Edit ; découpe ≤ 15 s) → contrôle du retour (durée, lèvres
   sur la voix d'origine, visage présent et ressemblant, raccords de couleur avant / après) → reposé dans la piste
   montée (retour à 25 i/s sans changer la vitesse, couleurs accordées sur l'origine = Look Will réappliqué, fondu de
   raccord de 0,2 s, plan large pendant l'effet) → habillage.
5. Objet **jeté sur l'écran** : la **vitre brisée** (lots F3 / I) s'enchaîne à l'impact, avec son bruitage de verre.
6. Échec ou refus → **version gratuite** (le téléphone ou le logo en 3D du lot I / I2 sur la paume quand l'objet le
   permet, sinon rien) et « **Effet non réussi — Réessayer** » ; Réessayer redemande une confirmation dans le fil.
7. « Que puis-je demander ? » : « Mets un téléphone dans ma main et jette-le sur l'écran », « Fais apparaître le logo
   Axion dans ma main, en réaliste », « Une tasse de café sur le bureau, en réaliste » (**réaliste, payant**) ; les
   effets 3D restent proposés (**en 3D, gratuit**) et servent de repli.

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/briques/effet-realiste/` (nouveau, PUR) | `demande.ts` : repère une action réaliste (« réaliste », « en vrai », « par IA », ou une action que la 3D ne sait pas faire : jeter vers l'écran, poser sur le bureau) ; « en 3D » reste gratuit, « ultra réaliste » reste l'option I2, une négation ne déclenche rien ; lit l'objet, la main, l'impact, le bruitage, la durée. `moment.ts` : **bon endroit** (un seul morceau sans coupe ; jamais au milieu d'une phrase clé — accroche, conclusion, chiffre, « retenez » —, le passage s'arrête avant elle s'il garde 3 s ; de préférence quand Will nomme l'objet, en début de phrase ou après une pause ; plan large mesuré ; hors d'un autre effet fort) ; vérifie le choix de Claude, respecte l'instant ou le mot donné par Will. `consigne.ts` : consigne anglaise (celle de Claude, ou écrite d'après la demande) + **règles de préservation toujours ajoutées** (visage, lèvres, voix, décor, lumière identiques ; physique, ombres, flou de mouvement). `fabrication.ts` : passe injectée (un essai, jamais de nouvel essai automatique), contrôle du retour, ligne de dépense. `enchainement.ts` : passages conditionnels (vitre si réussi, 3D si raté), plan du cadrage avec les morceaux `effet`, plan large pendant l'effet. |
| `src/briques/monteur/effet-realiste.ts` (nouveau) | Opération commune `effetRealisteIA { consigne, ancre, debutMot, instantSec, dureeSec, consigneVideo, objet, imageReference, finitSurEcran, sonSuggere, raisonMoment }`, règle lue par Claude, exemples mentionnés, relecture tolérante. |
| `src/moteurs/montage-facecam/monteur/effet-realiste.ts` (nouveau) | `preparerEffetRealiste` (moment vérifié, consigne finale, vitre brisée et repli 3D préparés par `appliquerEffetSpecial`, donc avec leurs garde-fous), version simple par règles, passage posé à la confirmation, lecture d'un passage. |
| `src/services/effet-realiste-ia.ts` (nouveau) | Carte avec aperçu (image fixe de la prise par l'étape `images` existante du studio-aligneur, 25 s au plus ; sans aligneur réel : instant et phrase seuls), « Changer de moment », entrées à la confirmation, réponse « Prête vers », **passe de fabrication** (jamais sans accord porté par la version ; aucune nouvelle carte créée depuis la fabrication ; effet déjà payé repris sans repayer ; Décor IA appliqué → non lancé), images de référence (Mes images **vérifiées** seulement, copie floutée si elle existe), « Réessayer ». Réglage caché `facecam.effetRealiste` = `{ reel: false }`. |
| `studio-aligneur/aligneur/decor.py` | Étape `reposer` : paramètres FACULTATIFS `original`, `fonduSec`, `accorderCouleurs` → gain et décalage par canal (moyenne / écart type aux bords du passage, bornés 0,8-1,25 et ±0,12), `lutrgb` en 16 bits, fondu `blend` avec l'origine aux deux bouts, vitesse inchangée. Absents : identique au Décor IA. `image.py` : le cadrage lit aussi un plan `effets` et les morceaux `effet`. |

## Ajouts minimaux dans les fichiers existants
- Brique J : option `effet-realiste-ia` (registre : devis Higgsfield du passage ; carte nommée « Effet réaliste par IA —
  option payante, … » ; les autres options gardent leur phrase) ; `DemandeConfirmation.details` (facultatif : l'effet
  préparé) ; `VueCarteConfirmation.apercu` ; détection au monteur.
- `services/options-payantes.ts` : `demanderOptionPayante(…, { details, remplacerOuverte })`, `demandeOuverte`, et à la
  confirmation de cette option : l'effet entre dans les entrées + réponse « Prête vers ». `options-payantes-higgsfield.ts` :
  accepte `effet-realiste-ia`.
- Monteur face caméra : schéma ajouté **en fin** de vocabulaire, réparateur, catalogue (entrée avant les effets 3D,
  exclue des exemples de base), règles fixes, `appliquerOperations` → `aConfirmer` (jamais posé), `piloterMonteur` →
  `aConfirmer`. Le libellé 3D devient « Objet en 3D dans ma main (gratuit) ».
- `services/monteur-facecam.ts` : « plutôt à … », l'effet passe par le monteur (les autres options J gardent leur
  raccourci), carte dans la réponse, pas de nouvelle version si seul l'effet a été préparé ; consigne dite au tournage
  → carte dans le fil ; vue : effet raté, exemples mentionnés ; « Réessayer » d'un effet réaliste.
- Chaîne : étape 5 ter (après le décor, avant le cadrage) ; `planCadrage` (décor et / ou effets) ; retouche : partie
  `effets` (seule la piste montée est refaite). `dependances.ts`, `facecam-branchements.ts` : raccord du service.
- `briques/decor/passe.ts`, `services/decor-passages.ts` : 4ᵉ paramètre facultatif de `deposerPassage`.
- Écrans : `CarteOptionPayante` (aperçu + « Changer de moment »), `FilMonteur` (exemples mentionnés), `VotreVideoFacecam`
  (« Réessayer » d'un effet réaliste : « Confirmez dans le fil »).
- `tests/facecam-effets-speciaux.test.ts` : l'ordre attendu du vocabulaire gagne `effetRealisteIA` en fin de liste.

## Tests
- `src/briques/effet-realiste/effet-realiste.test.ts` (33) : demande (10 phrases dont 3D, ultra réaliste, négation),
  bon endroit (objet nommé, phrases clés, coupe, plan serré, effet occupé, choix de Claude gardé / refusé, instant de
  Will, vidéo trop courte), consigne anglaise et règles, modèle et découpe, devis et carte, fabrication sur le double
  (FLUX, Kling + image, Kling sans image → FLUX, refus sans nouvel essai, lèvres, visage, durée, raccord, demande
  invalide sans aucun envoi, panne), enchaînements, plan du cadrage, plan large.
- `tests/k-effet-realiste.test.ts` (10, dépôts en mémoire, `fetch` interdit) : Claude choisit le moment en 1 appel et
  rien n'est posé ; carte avec aperçu sans version ni réseau ; « plutôt à 0:05 » ; Annuler ; Confirmer (effet + vitre
  + 3D, jeton dans les entrées, « prête vers ») ; **aucune fabrication sans accord, même en réel, et aucune nouvelle
  carte** ; fabrication confirmée (dépense comptée, fenêtre gardée) puis reprise sans repayer ; échec → repli,
  « Réessayer » → nouvelle carte ; Décor IA ; retouche limitée à la piste montée.
- `tests/k-chaine-effet-realiste.test.ts` (4) : chaîne complète (doubles) réussie, ratée, en panne, sans la passe.
- `studio-aligneur/tests/test_decor.py` (+3, unittest, FFmpeg réel) : gains de couleur, graphe sans changement de
  vitesse, reposer avec accord et fondu sur de petites vidéos de synthèse. (Les 2 tests de mesures du lot G demandent
  numpy, absent de ce conteneur : rouges avant comme après.)
- Vérifications : `tsc --noEmit` racine 0 erreur ; `eslint .` 0 problème ; Vitest ciblés verts (J, F3, D, H, décor,
  I2…). Vitest complet : ci-dessous.

## Résultats exacts (fin de session)
- `pnpm install --frozen-lockfile`, `next typegen` ; `tsc --noEmit` (racine) : **0 erreur** ; `eslint .` : **0 problème**.
  `studio-rendu/` n'est pas touché par ce lot (non revérifié ici : dépendances Remotion non installées).
- Vitest complet : **3 338 réussis, 3 échecs, 3 sautés (3 344) ; 270 fichiers verts, 2 en échec, 1 sauté (273)**, 605 s.
  Les 3 échecs sont des **délais de 5 s dépassés** sous la charge de la suite complète, déjà connus :
  `e2e-verif1-bc-serie` (2, JOURNAL-E / H) et `garde-ecran` (1, JOURNAL-J). Relancés seuls : **14/14** et **6/6 verts**.
- Lot K seul : 33 + 10 + 4 tests Vitest verts ; `studio-aligneur` : 3 nouveaux tests verts (FFmpeg réel).

## Essai réel conseillé (Will, une seule fois, avant d'ouvrir le réel)
1 passage de **5 s** sur une vraie prise de Will (« Monteur, mets un téléphone dans ma main et jette-le sur l'écran »),
FLUX 3 Video Edit (sans image de référence) puis, si le rendu plaît, Kling Omni Edit avec une photo du téléphone.
- Coût estimé : FLUX 5 s ≈ **5 crédits ≈ 0,25 €** ; Kling 5 s ≈ **10 crédits ≈ 0,50 €** (crédit à 5 c€, prix du lot E1
  **à recaler sur la facture** : `optionsPayantes.prixCreditHiggsfieldCentimes`). Les deux essais : **< 1 €**.
- À regarder : la main reste-t-elle la main de Will (doigts), les lèvres collent-elles, le téléphone traverse-t-il
  vraiment vers l'objectif, la vitre brisée tombe-t-elle au bon moment (impact = fin du passage − 0,5 s), le raccord
  de couleur est-il invisible.
- Pour l'allumer : `facecam.effetRealiste` = `{ "reel": true }`, `HIGGSFIELD_API_KEY` et `HIGGSFIELD_API_URL` posées,
  studio-aligneur réel. Chaque effet reste confirmé une fois (garde serveur du lot J).

## Points à valider / reste
1. **API Higgsfield** : tout le contrat reste **supposé** (E1, `API.md`) ; Kling Omni Edit accepte-t-il une action
   (pas seulement un décor) avec image de référence ? À vérifier lors de l'essai.
2. **Seuils** : lèvres 80 ms, visage 0,85 / 90 % (E1), raccord de couleur ΔE ≤ 6 — la mesure `ecartRaccordAvant/Apres`
   n'est **pas encore calculée** par l'étape `mesurer` (champs facultatifs : absents, seul le contrôle E1 joue).
3. **Fondu** : il mélange avec le passage EXTRAIT (720 × 1280, 8 bits) mis à la taille de la fenêtre : sur 0,2 s,
   invisible a priori ; à regarder à l'essai.
4. **Décor IA + effet sur la même vidéo** : l'effet n'est pas lancé (il ramènerait le vrai décor sur son passage).
5. **Consigne dite au tournage** : la carte part dans le fil sur la version choisie au moment de la fabrication.
6. **Plan large** : le plan entier qui chevauche l'effet est élargi (pas coupé à l'effet) ; à revoir si un plan long
   change de cadre trop tôt.
7. **Coût** : le devis ne compte pas de marge ; la garde (lot J) revérifie le plafond au moment de dépenser.
8. **Plusieurs serveurs** : même limite que le lot J (file en mémoire pour consommer le jeton).
