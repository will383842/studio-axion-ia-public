# Lot R8 — Montage réel des vidéos avocat

> Branche `outils/r8` = `outils/paquet2` + fusion de `outils/r7` + fusion de `outils/r7e` (apparue pendant le lot) +
> le lot R8. Aucun appel réseau réel, aucune clé, aucune dépense : tout est vérifié avec des fournisseurs doublés.

## Ce qui est fait

### 1. L'interrupteur « Montage réel des vidéos avocat »

Réglages › Connexions › carte **Montage** › « Montage réel des vidéos avec votre double ». **Éteint par défaut.**

- Il n'est proposé (actionnable) que si **tout est « Relié »** : double (visage), voix, textes de publication, serveur
  de rendu (studio-rendu, `STUDIO_RENDU_URL`) et stockage des fichiers (R2 : le moteur en a besoin pour la voix, le
  double et la vidéo). Sinon la ligne dit en une phrase ce qui manque, par exemple « Il faut d'abord relier la voix et
  le serveur de rendu. »
- Allumer ouvre d'abord une feuille avec le **prix d'une vidéo de 45 s**, ligne par ligne ; « Allumer » ou « Rester en
  essai ».
- **Retour arrière en un clic** : couper l'interrupteur (aucune feuille). Rien n'est effacé : les vidéos déjà lancées
  gardent leur moteur (figé dans leur commande) et vont au bout ; les suivantes repartent en essai. Se rallume à tout
  moment (le prix est remontré). Chaque geste est consigné au Journal.
- Décision unique, pure et testée : `deciderMontageReel` (`src/moteurs/index.ts`), lue par la carte Montage ET au
  lancement (`moteurAuLancement`, `src/services/reglages.ts`), aussi pour les versions par réseau
  (`fabrication-reseaux.ts`). Un moteur déjà réel par `moteur.avocat` / `MOTEUR_AVOCAT` reste tel quel (inchangé).
- Les vidéos « je lis » gardent leur propre interrupteur (lot R6), indépendant.

### 2. Le prix

- **Avant d'allumer** : vidéo de référence de 45 s (`src/moteurs/montage-avocat/prix-reel.ts`, pur) — voix HeyGen au
  caractère (16 caractères par seconde parlée), double HeyGen Avatar V à la seconde (angle principal, plus le second
  angle sur sa part quand deux avatars prêts existent : ligne « Votre avatar, second angle »), textes des
  réseaux par Claude (même estimation réaliste que le lancement, réseaux par défaut), montage/sous-titres/couleurs/son/
  miniature gratuits (notre serveur). Au taux du studio.
- **Avant chaque lancement** : l'Aperçu montre le prix de CETTE vidéo et demande toujours la confirmation (feuille
  « Votre avatar parle » quand le double est payé, sinon « Cette vidéo sera montée pour de vrai »). Côté serveur, un
  lancement monté pour de vrai par l'interrupteur est **refusé sans confirmation**, quel que soit le seuil
  (`lancerSousVerrou`, `src/services/fabrication.ts`).

### 3. Garde rouge

L'interrupteur est **indisponible tant que le double n'est pas prêt** :
- aucun double réel choisi pour un personnage (Personnages › « Votre double HeyGen » : visage HeyGen « prêt », relié) ;
- ou le studio ne fait pas parler l'avatar (réglage R7e « Votre avatar parle dans le studio » éteint, ce qui est le
  cas par défaut).

Dans les deux cas la phrase renvoie vers **« Ma vidéo HeyGen »** (faire la vidéo dans l'application HeyGen, puis la
rattacher à sa version). La garde est tenue à trois endroits : l'écran (interrupteur grisé), le réglage (refus serveur
`MONTAGE_REEL_INDISPONIBLE`) et le lancement (même si le réglage était posé à la main, la décision laisse l'essai). Le
moteur garde en plus ses propres refus R7/R7e (double d'essai, double non validé, réglage éteint figé dans la commande).

### 4. Le chemin complet

Allumé, rien de neuf n'était à écrire dans le moteur : le chemin existait par morceaux (R1 à R7e). R8 le câble et le
**prouve de bout en bout** à travers les vrais services : script → voix HeyGen → double(s) HeyGen (angle principal +
passages du second angle) → montage studio-rendu (nettoyage, sous-titres calés, couleurs, son, composition) →
miniature (studio-rendu) → kit des réseaux (Claude) → brouillon Buffer.

### 5. Format de sortie

1080×1920 (9:16). Le double est demandé en `1080p` (HeyGen ne rend pas l'avatar au-delà) ; aucun texte ne promet de 4K
(vérifié par test).

### Correction faite à la fusion de R7e

La correction sécurité de `paquet2` ne recopie plus le texte brut d'une erreur HeyGen dans le message (il peut contenir
la clé). Or R7e reconnaissait le refus « sans fond » à ce texte : le repli automatique sur le fond uni ne marchait plus
une fois fusionné (2 tests R7e rouges). Le refus est désormais classé dans le client HeyGen (`sansFondImpossible`),
le message reste propre ; les tests R7e repassent au vert.

## Comment l'allumer (en ligne)

1. Relier (Coolify + Réglages › Connexions) : HeyGen (`HEYGEN_API_KEY`, `FOURNISSEUR_VISAGE=heygen`,
   `FOURNISSEUR_VOIX=heygen` ou la voix HeyGen reliée au personnage), Claude pour les textes (`ANTHROPIC_API_KEY`,
   choix « Claude » sur « Textes de publication »), studio-rendu (`STUDIO_RENDU_URL`, `STUDIO_RENDU_CLE`), R2 (variables
   R2 et `FOURNISSEUR_STOCKAGE=r2`). Redémarrer le conteneur (prévenir la session qui gère le studio).
2. Personnages › « Votre double HeyGen » : choisir le double créé dans l'application HeyGen (un par angle).
3. Réglages › Connexions : allumer « Votre avatar parle dans le studio » (R7e).
4. Carte Montage : allumer « Montage réel des vidéos Avocat », lire le prix, confirmer.
5. Pour revenir en arrière : couper le même interrupteur.

## Coût

Vidéo de 45 s, taux 0,90 € pour 1 $ (relevés du 03/10/2026) :

| Cas | Double payé | Total |
|---|---|---|
| **Un angle** (un seul avatar prêt) | 45 s → 2,84 € | **environ 3,08 €** |
| **Deux angles**, répartition « principal » (85 / 15, par défaut) | 45 s + ⌈45 × 0,15 × 1,3 + 2⌉ = 11 s → 2,84 € + 0,69 € | **environ 3,77 €** |
| Deux angles, répartition « égale » (50 / 50) | 45 s + 32 s → 2,84 € + 2,02 € | environ 5,10 € |

Toujours : voix 0,19 € · textes des réseaux (4 réseaux) 0,05 € · montage, sous-titres, couleurs, son, miniature 0 €.
L'étape 2 fait choisir un avatar **par angle** : dès que les deux sont prêts, la feuille « Allumer » compte le second
angle (répartition par défaut du format, même règle que l'estimation de la vidéo). Le prix exact de chaque vidéo (sa
durée, sa répartition) est montré et confirmé avant son lancement. Buffer (brouillon) : 0 €.

## Preuves

- `tests/r8-montage-reel.test.ts` (14 tests, configuration de production) : décision pure (éteint par défaut, tout
  relié, ce qui manque), **garde rouge** (aucun double ; avatar qui ne parle pas dans le studio ; refus serveur ;
  réglage forcé en base → la vidéo part quand même en essai ; aucune demande payante chez HeyGen), **prix** (valeurs
  exactes), phrases d'écran simples et sans 4K.
- `tests/r8-bout-en-bout.test.ts` (11 tests) : un seul `fetch` doublé (studio-rendu en HTTP, HeyGen, R2 signé en
  local, Claude, Buffer ; toute autre adresse fait échouer) ; le chemin complet par les vrais services ; puis une panne
  à chaque étape — voix, nettoyage, envoi et suivi du double, composition (échec net → « Réessayer »), composition
  (serveur indisponible), miniature, Claude surchargé, Buffer (réponse perdue) — la vidéo va au bout, **une** lecture
  de voix payée, **un** rendu payé par pièce du double, **un** texte par réseau, **un** brouillon ; retour arrière.
- Mutations (chaque garde cassée seule → test ROUGE, puis restaurée) :

  | Mutation | Résultat |
  |---|---|
  | garde rouge retirée de la décision | 3 tests rouges |
  | refus serveur du réglage retiré | 2 rouges |
  | réglage « avatar parle » ignoré | 1 rouge |
  | prix : débit parlé faux (15 au lieu de 16) | 1 rouge |
  | prix : double oublié | 1 rouge |
  | confirmation du prix au lancement retirée | 10 rouges |
  | interrupteur ignoré (allumé par défaut) | 2 rouges |

- Contrôles (tête de branche) : `npx tsc --noEmit` propre (racine et studio-rendu), `npx eslint .` propre,
  `npx vitest run` complet vert (173 fichiers réussis, 1 sauté ; 2387 tests, 2 sautés), `npx next build --webpack`
  réussi. `tests/garde-ecran.test.ts` vert.

## Ce qui reste à vérifier en réel (avec les clés, sur une première vidéo)

- **Rendu HeyGen réel** : premier `POST /v3/videos` Avatar V sur le son du studio (lèvres calées), `webm` transparent
  accepté pour le double de Will (sinon repli « fond uni » de R7e) ; prix réellement débité à la seconde sur le
  porte-monnaie (comparer au 2,84 € annoncé pour 45 s).
- **Voix HeyGen clonée** : coût réel au caractère comparé à l'estimation (16 caractères par seconde).
- **studio-rendu** : composition réelle 1080×1920 avec la piste webm transparente du double et les passages du second
  angle ; miniature tirée de la vraie vidéo.
- **Claude** et **Buffer** : déjà vérifiés aux lots R2 et R1 ; à revoir sur cette première vidéo (brouillon visible dans
  Buffer, texte du kit).
- Prix des textes des réseaux : estimation (≈ 0,05 € pour 4 réseaux) à comparer au relevé Claude.
- Le double et la voix : un seul paiement après une reprise (vérifier sur les relevés HeyGen qu'aucun rendu n'est
  facturé deux fois).

## Corrections après relecture

Relecture `docs/controles/RELECTURE-R8-68ed386.md` (branche `relectures/r8-68ed386`) : EXACTITUDE (argent) **REFUS**
(2 vrais défauts, 3 petits), SÉCURITÉ **pas de veto**. Avant les corrections, `origin/outils/r7e` (`ee94c78`, corrections
R7e acceptées) a été fusionnée dans `outils/r8` (fusion `--no-ff`, sans conflit, rien perdu).

### Vrais défauts (argent)

1. **Un accord donné en essai servait pour un montage réel** — corrigé.
   - Le moteur annoncé au moment de l'accord est **figé** : `lancementEnAttente.moteurId` (« lancer dès que
     possible » : `garderEnAttente`, `mettreEnAttenteDeCredit`, version qui attendait sa mère puis du crédit) et
     `declinaison.moteurConfirme` (versions qui suivent leur mère, figé au geste confirmé de « Fabriquer les N »).
   - `lancerSousVerrou` (`src/services/fabrication.ts`) : une commande montée pour de vrai par l'interrupteur, lancée
     sur un accord donné plus tôt (`confirmationDifferee`), part **seulement** si c'est ce moteur-là qui a été confirmé.
     Accord donné pour un autre moteur (l'essai) ou ancienne attente qui n'en dit rien → `CONFIRMATION_REQUISE`.
     `lancerVideosEnAttente` remet alors la vidéo en brouillon et prévient Will (« … n'a pas pu partir » : « Cette
     vidéo sera maintenant montée pour de vrai : X €. Ouvrez-la pour voir ce prix et confirmer. ») ; une version qui
     suivait sa mère n'attend plus sa mère, reste en brouillon et Will est prévenu de même.
   - Les lancements directs (Aperçu, « Fabriquer les N », « Fabriquer cette version », « Fabriquer en entier »,
     « 2e ouverture ») montrent le prix du moteur du moment juste avant le geste : inchangés.
   - Accord donné en réel puis interrupteur coupé : la vidéo part en essai (moins cher), rien n'est redemandé.
2. **Le prix de 45 s ignorait le second angle** — corrigé. `prixVideoReelle` reçoit `partSecondAngle` ; la carte
   Montage (et le Journal de l'allumage) compte, quand un personnage a deux avatars réels prêts (angle principal et
   second angle de la recette), la répartition par défaut du format, avec la même règle que la brique visage
   (⌈d × part × 1,3 + 2⌉ s) et la ligne « Votre avatar, second angle ». La ligne principale s'appelle désormais
   « Votre avatar » (même mot que le réglage R7e).

### Petits défauts

3. Feuille « Cette vidéo sera montée pour de vrai » : le bouton « Confirmer et fabriquer » ne porte plus la pastille
   d'essai (`essai={!donnees.budget.double && !donnees.budget.montageReel}`, `src/assistant/etapes/Apercu.tsx`).
4. « 2e ouverture » : le prix affiché est estimé par `estimerVersion`, le même chemin que le lancement (double, second
   angle…), comme « Fabriquer les N », au lieu d'une commande légère à un angle. Reste à comparer en réel au montant
   réservé sur la première 2e ouverture montée pour de vrai.
5. Documentation « Coût » : cas un angle / deux angles chiffrés (tableau ci-dessus).

Hors périmètre, non modifié : la remarque sécurité sur `erreurRendu` (`src/fournisseurs/heygen/rendus.ts`, texte de
HeyGen recopié) et les deux défauts connus de R7e.

### Tests (chacun ROUGE avant correction)

`tests/r8-correctifs.test.ts` (9 tests, fournisseurs doublés, aucun appel réel, aucune clé réelle) et deux
assertions ajoutées à `tests/e2e1-moteur-02-variante-attend-credit.test.ts` (moteur confirmé gardé par les versions
qui suivent leur mère et par leur attente de crédit). Preuve : le code corrigé retiré (`git stash -- src`), les mêmes
tests donnent **9 échecs sur 10** :

| Test | Sans la correction |
|---|---|
| attente confirmée en essai → interrupteur allumé → `lancerVideosEnAttente` | la vidéo part (`[Array(1)]` au lieu de `[]`) |
| ancienne attente sans moteur | la vidéo part |
| version qui suit sa mère, confirmée en essai | le lancement réussit au lieu de `CONFIRMATION_REQUISE` |
| accord donné en réel | aucun moteur gardé avec l'attente |
| prix pur, second angle (85 / 15 → 69 c€ ; égale → 202 c€) | aucune ligne de second angle |
| carte Montage, deux avatars prêts (mêmes secondes que l'estimation : 45 + 11) | second angle absent |
| carte Montage, un seul avatar | ancien libellé |
| bouton de la feuille « montée pour de vrai » | pastille d'essai |
| « Fabriquer les N » : moteur confirmé gardé (e2e1-moteur-02) | `undefined` au lieu de `montage-avocat` |

Seul le test « accord en réel, puis interrupteur coupé → part en essai » passait déjà (comportement à garder).

Aussi : le contrôle « jamais de 4K » de `tests/r8-bout-en-bout.test.ts` échouait parfois au hasard (une signature R2
tirée au hasard contenait « 2160 ») : les adresses signées et les identifiants sont retirés avant la recherche ; les
réglages envoyés (résolution, taille) restent contrôlés.

### Contrôles (après corrections)

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` (racine) | propre |
| `npx tsc --noEmit` (studio-rendu) | propre |
| `npx eslint .` | propre (0 erreur, 0 avertissement) |
| `npx vitest run` (complet) | vert : 175 fichiers réussis, 1 sauté ; 2406 tests réussis, 2 sautés |
| `tests/garde-ecran.test.ts` | vert |
| `npx next build --webpack` | réussi |
| Clés dans le diff | aucune (valeurs factices d'essai seulement) |
