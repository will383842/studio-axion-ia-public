# Format « Cas concret MD » (code CC)

**État au 12/10/2026 : en chantier, statut `masque`.** Invisible des menus et de « Nouvelle vidéo » tant que Will ne l'a pas passé en `actif`. Branche d'intégration : `cas-concret/integration`.

## But

Will écrit une phrase dans une case. Le studio fabrique seul une vidéo verticale de 40 à 60 s, sans visage, qui raconte **un cas concret et sa résolution par l'une des offres d'Axion-IA** (formation, audit, intégration, coaching), pour amener des entreprises à commenter ou à réserver un diagnostic.

- **Porte A (version 1)** : un cas du catalogue réel d'Axion-IA, validé par Will.
- **Porte B (version 2)** : ce que Will décrit librement ; aucun écran réel, aucune affirmation « chez nous ».

Référence visuelle et sonore : la vidéo « on recrute en 15 minutes », validée par Will le 11/10. Ses pièces sont dans `tests/cas-concret/temoin/reference/` (mots horodatés, plans, texte, 12 images, page de montage `v8-a.html`).

## Pièces demandées

La fiche du format (`src/formats/cas-concret/index.ts`) les déclare dans `pieces` : habillage `charte-duo/1` (deux fonds, sombre et ivoire), sons du catalogue validé, fin par la bibliothèque « Appels » (jamais écrite par le format ni par Claude), voix maître, rendu par scènes, contrôle de l'image finale. L'écran déclare : attente générique, aucune retouche, pas de monteur, coûts visibles.

| Pièce | Où |
|---|---|
| Cas du catalogue (7 cas : formation, audit, intégration ; coaching sans cas) | `src/formats/cas-concret/catalogue/` |
| Offres, nature d'une intégration, recettes | `cas.ts`, `recette.ts` (voir « Offres » plus bas) |
| Fiche d'écrans `fiche-ecrans/1`, règles R01 à R22 | `src/moteurs/montage-cas-concret/fiche.ts`, `regles.ts` |
| Plan des fins, liens suivis, textes de publication | `fins.ts`, `publication.ts` |
| Voix, calage, captures, contrôles | `voix.ts`, `calage.ts`, `captures.ts`, `controles.ts` |
| Chaîne de fabrication | `fabriquer.ts`, `etapes.ts` (brique commune `chaine-scenes`) |
| Moteur au contrat commun | `index.ts` (`montage-cas-concret`) |
| Compositions de rendu | `studio-rendu/compositions/cas-concret/` |
| Fiche témoin et planche de contrôle | `tests/cas-concret/temoin/` |
| Service de lancement, raccords, vue de la fiche vidéo | `src/services/cas-concret.ts`, `cas-concret-branchements.ts`, `cas-concret-vue.ts` |

## Étapes

Durée visée : moins de 15 minutes. Coût visé : moins de 1 € par vidéo, montré sur le bouton « Fabriquer la vidéo » avant le clic.

| # | Étape | Ce qui se passe | Reprise après panne |
|---|---|---|---|
| 0 | Lancement (service) | Cas choisi, réseaux, mot, montant confirmé : la vidéo est créée en brouillon | Un brouillon resté sans travail est repris, pas recréé |
| 1 | L'écriture | Claude écrit la fiche d'écrans à partir du cas (appels bornés) | Fiche gardée : jamais réécrite |
| 2 | La relecture | Les 22 règles ; un refus arrête avant tout appel de voix | Empreinte de la fiche |
| 3 | Les vrais écrans | Captures du site, ou repli | Une capture déjà déposée n'est pas refaite |
| 4 | La voix | Une prise par fin ; budget vérifié avant chaque lecture | Chaque prise payée est gardée |
| 5 | Le calage | Heure de chaque écran sur les mots | Pur |
| 6 | Les écrans | Un fichier par écran | Seuls les écrans changés sont rendus |
| 7 | Les finitions | Un fichier par fin (réseaux de même fin : un seul fichier) | État de chaque composition gardé |
| 8 | La vérification | Rapport en phrases | Toujours refaite |

## Règles

- **Fiche** : 22 règles nommées, pures et bloquantes (ordre des écrans, durée d'un écran, rythme, fonds alternés, textes courts, marque présente, mots interdits, vouvoiement, nombres tirés des faits du cas, aucun témoignage, aucun usage réel, aucun prix, phrase de conformité, aucun appel dans le corps, visuels connus, nombre d'écrans, durée totale, sigles).
- **Fins** : tirées de la table des fins, une seule demande par fin (X6, ci-dessous) ; deux réseaux qui disent et montrent la même fin partagent un fichier. Une suite dont une ligne n'est pas utilisable revient à la fin « diagnostic » de son réseau.
- **Mot à commenter** : un mot par vidéo, 2 à 24 lettres ou chiffres. Il n'est dit que sur les comptes où il est branché (X6) ; un mot dit est refusé s'il est déjà dit par une autre vidéo du format.
- **Cas** : valide s'il porte la validation de Will dans le code, ou si sa validation (réglage `casConcret.validations`) porte l'empreinte courante et a moins de 180 jours. Un cas modifié redevient « à valider ».
- **Vidéo d'essai** : un cas non validé peut être fabriqué en essai ; la fiche vidéo porte « Essai : cas à confirmer par Will, ne pas publier » et n'offre ni texte ni lien.
- **Publication** : aucun bouton de publication ni de programmation. Les textes, les liens suivis et le premier commentaire sont à copier à la main.
- **Voix** : celle inscrite dans la distribution de la vidéo par le lancement (voix effective de l'avocat, `voixDeReference`) ; les raccords n'en choisissent jamais une autre.
- **Vocabulaire** : aucun nom, logo ou avis de client ; vouvoiement partout.

## Les refus et leurs tests

Quatre refus sont couverts par des **tests de service** et non par des tests d'interface. Ce sont des phrases rendues par les services ; l'écran se contente de les afficher.

| Refus affiché | Où il est produit | Test |
|---|---|---|
| « Votre voix n'est pas prête. » | lancement (`preparerEtLancer`) et raccords (avant toute dépense) | `tests/cas-concret/services/lancement`, `tests/cas-concret/services/branchements` |
| « Le studio n'est pas relié (voix, fichiers ou rendu). » | raccords, en production, avant toute dépense | `tests/cas-concret/services/branchements` |
| « Budget du mois atteint. » | réservation du budget avant chaque lecture de voix et chaque écriture | `tests/cas-concret/services/lancement`, `tests/cas-concret/services/branchements` |
| « Ce cas a changé : relisez-le avant de fabriquer. » | lancement : l'empreinte du cas a changé depuis sa validation | `tests/cas-concret/services/lancement` |

**X7 · un seul contrôle avant le prix.** Tout refus possible SANS appel payant est calculé par UNE fonction pure, `refusAvantPrix` (`src/moteurs/montage-cas-concret/avant-prix.ts`) : cas absent, cas invalide (« Ce cas est incomplet : reprenez-le avant de fabriquer. »), chiffre sans source (« Un chiffre du cas n'a pas sa source : complétez-le avant de fabriquer. »), cas changé, aucun réseau, mot mal formé, cas non validé hors essai, voix pas prête, mot déjà pris, phrase de conformité absente du cas (« Ce cas parle de conformité sans la phrase validée : ajoutez-la au cas ou retirez cette mention. »), réseau sans fin utilisable (« Aucune fin utilisable pour LinkedIn : décochez ce réseau. »). Elle est appelée par `estimerCas` (la feuille « Votre vidéo » l'affiche avant le prix et rend « Fabriquer » inactif), par `preparerEtLancer` (même phrase, rien n'est créé) et par le moteur (`refusAuLancement`, sur ce que la commande porte, avant toute réservation). Test : `tests/cas-concret/x7/avant-prix.test.ts`.

Les autres refus (mot déjà pris, aucun réseau) sont aussi produits par le service de lancement. « Mot déjà pris » ne peut arriver que pour un mot branché : aucun essai d'interface ne le montre (rien n'est branché), le test de service le couvre.

## Ce qui est en version 2

Retouche libre (sans opérations) · correction des sous-titres seule · un autre format d'image ou une autre fin sans refaire la vidéo · maquette · objets supplémentaires (six objets, décision D3 : hors portage) · envoi en brouillon dans Buffer, par réseau. Jusque-là, `reexporter`, `recalquer` et `maquette` répondent « viendra en version 2 ». Le reste de la phase 2 (porte B, retouches par opérations et par discussion, document promis, relevés, écran fourni, quatorze cas en plus) est porté sur master derrière six réglages éteints : voir « Portage de la phase 2 » plus bas.

## Essai réel

Voir `docs/formats/cas-concret-essai.md`.

## Offres (X5, 12/10)

Automatisation et intégration sont **une seule offre** : `integration`. Les offres sont `formation`, `audit`, `integration`, `coaching`.
- Un cas d'intégration peut porter une **nature** (`automatisation` ou `outils-relies`), montrée en clair sur sa carte (« Automatisation », « Outils reliés »). Elle n'entre pas dans le classement de la case ; elle choisit seulement le cadeau de l'offre (`documentPromis.finCadeauId`) : « toute la structure de cette automatisation » (validée) pour une automatisation, « le schéma de cette intégration » (non validée) sinon. Depuis X6, la fin au mot ne dit plus ce cadeau (« Je vous envoie la structure complète. »).
- La recette `integration` garde les deux tournures (étapes qui tournent seules ; outils reliés, donnée qui passe seule) et choisit d'après les étapes du cas : une étape montrant des outils reliés donne la seconde.
- La recette `coaching` est minimale (douleur du dirigeant, déroulé de l'accompagnement, résultat). Aucun cas au catalogue ; l'offre n'a pas de cadeau : sa fin est toujours la fin « diagnostic ». Sa pastille n'apparaît que lorsqu'un cas validé la porte.
- Le mot « automatisation » reste le mot à dire dans les scripts, jamais « machine ».

## Alignements Usine et tableau animé (X4, 12/10)

- **Le mot est éteint par défaut** : il n'est dit que là où le cadeau est réellement envoyé. La feuille « Votre vidéo » montre « Avec le mot », décoché, avec une seule phrase : « À cocher seulement si vous envoyez vous-même le document à chaque personne qui écrit le mot. » Sans action de Will, la fin est la fin « diagnostic » (X6).
- **Lien suivi** : le code de version de la vidéo (« 0042-CC-FB » : numéro de version sur quatre chiffres, `CC`, code du réseau) est posé dans `utm_content`, après `lienSuivi` (pièce commune non modifiée).
- **Voix** : toujours la voix HeyGen déjà en service : la voix EFFECTIVE du format de l'avocat (`voixDeReference`, une seule fonction, par `voixPourFormat` parmi les voix de HeyGen : celle désignée dans Personnages › Voix › Par format si elle est prête, sinon la voix habituelle ; `FOURNISSEUR_VOIX_CAS_CONCRET`). X8 (12/10, essai réel en ligne) : aucune désignation explicite n'est exigée ; « Habituelle · Ma voix HeyGen » suffit. Le refus ne subsiste que si aucune voix prête de HeyGen n'est disponible ; la feuille « Votre vidéo » dit alors « Votre voix n'est pas prête : ouvrez Personnages, Voix, et vérifiez que votre voix HeyGen est reliée et prête. » avec le lien vers l'onglet « Voix » (`CONSIGNE_VOIX_CAS_CONCRET`, `avant-prix.ts`). Vitesse 1,1. Le corps et chaque fin, en sons bruts, sont raccordés puis traités ensemble par la recette du tableau animé (`src/moteurs/montage-cas-concret/recette-voix.ts`, valeurs recopiées et comparées par un test) : blancs resserrés, `atempo` 1,08, passe-haut, compresseur, un seul `loudnorm` sur l'ensemble, fondu de sortie et silence final. Le contrôle des prises du format reste inchangé.

## Fins par réseau (X6, 12/10)

Réponse de l'Usine, déléguée par Will. `/fr/diagnostic` est un diagnostic en ligne à faire soi-même (une dizaine de questions, moins de 3 minutes, gratuit, sans inscription), pas une prise de rendez-vous : « Réservez votre diagnostic gratuit » n'est plus dit, écrit ni publié. **Une seule demande par fin.** Lien : `/fr/diagnostic` pour tous les réseaux, par `lienSuivi`.

Aujourd'hui (aucun mot branché), la fin « diagnostic » partout :

| Réseau | Dit | À l'écran |
|---|---|---|
| Instagram, TikTok | « Faites votre diagnostic gratuit en quelques minutes. » puis « Le lien est dans mon profil. » | « Diagnostic gratuit · lien dans le profil » |
| Facebook | … puis « Le lien est en commentaire. » | « Diagnostic gratuit · lien en commentaire » |
| LinkedIn | … puis « Le lien est en premier commentaire. » | « Diagnostic gratuit · lien en commentaire » |

Instagram et TikTok partagent leur fichier : trois fichiers au plus pour les quatre réseaux. Deux écrans : l'écran « diagnostic » (« Faites votre *diagnostic gratuit* », « en quelques minutes ») puis l'écran « lien » (bulle, signature « Axion-IA »). Les écrans « appel-mot » et « promesse » ne servent plus qu'à la fin au mot.

- **Textes de publication** : la ligne d'appel dit le diagnostic puis le lien ; premier commentaire « Votre diagnostic gratuit, en quelques minutes : <lien> » (Facebook, LinkedIn) ; Facebook porte en plus « À poser à la main : Buffer ne pose pas de premier commentaire sous un Reel Facebook. »
- **Fin au mot** (Instagram et Facebook seulement, là où le mot est branché, et si Will coche « Avec le mot ») : sur Facebook, « Écrivez {MOT} en commentaire. » puis « Je vous envoie la structure complète. » ; sur Instagram (X7, décision de Will du 12/10 : l'abonnement est obligatoire pour recevoir le cadeau), une seule phrase, « Abonnez-vous et écrivez {MOT} en commentaire : je vous l'envoie. » (ligne `fin-ig-mot-abonnement`, 10 mots dits, sous la règle des 12 : elle n'a pas été coupée en deux), avec l'écran « appel-mot » seul. Aucun lien annoncé. TikTok : jamais de mot. LinkedIn : la fin « diagnostic », et en dernière ligne du texte du post « Écrivez {MOT} si vous voulez la structure complète : je vous l'envoie. » quand la vidéo porte le mot.
- **Validation** : ces phrases sont des propositions de l'Usine, utilisables par ce format, tracées « proposée par l'Usine sur délégation de Will, 12/10/2026 » dans `src/briques/fins/table-diagnostic.ts`. Will les validera une à une dans la banque de fins commune. Les anciennes lignes y restent, désactivées (« remplacée le 12/10/2026 »).

### Le mot branché, par mot et par compte

- Réglage du studio `casConcret.motsBranches` (paramètres, pas le code). **Vide aujourd'hui.** TikTok et LinkedIn ne sont jamais branchés.
- **Contrat figé avec l'Usine (X7)** : une ligne `{ mot: "GUIDE", reseau: "instagram" | "facebook", compte?: "williamsjullin", etat: "non_branche" | "branche", le: "AAAA-MM-JJ" }`. `compte` est l'identifiant public du compte sur le réseau, en minuscules (Will a deux comptes Facebook : la page Axion-IA et « Williams Jullin »). Une ligne sans `compte` vaut pour tous les comptes du réseau ; une ligne avec `compte` l'emporte, pour ce compte, sur la ligne sans compte. Le réglage accepte ces lignes (un tableau) ou l'ancienne forme (mot → réseau → état) ; `lignesDuReglage` rend la forme du contrat.
- Lecture : `motBranchePour(mot, reseau, compte?, reglage)` (`src/formats/cas-concret/mots-branches.ts`) ; le service la sert sous la forme d'un lecteur `(mot, reseau, compte?) => boolean` (`lecteurMotsBranches`), qu'une liste lue chez l'Usine pourra remplacer sans autre changement.
- **Tant que le studio ne sait pas à quel compte une sortie est destinée**, la feuille « Votre vidéo » et le lancement lisent la ligne SANS compte ; à défaut, le mot est considéré non branché. Une ligne posée pour un seul compte ne rend donc pas encore le mot disponible.
- Une vidéo ne prend la fin au mot que pour les sorties destinées à un compte où ce mot est branché ; les autres gardent la fin « diagnostic ». Les comptes retenus sont posés au lancement dans `entrees.casConcret.motSur`.
- Feuille « Votre vidéo » : « Avec le mot » est actif seulement si le mot écrit est branché sur au moins un réseau coché, sinon grisé avec « Disponible quand l'envoi du document sera en place. » Actif, la feuille dit sur quels réseaux le mot sera dit. Si, sur un compte, plus d'une vidéo du format sur trois des 7 derniers jours porte déjà un mot : « Le mot est déjà dans plus d'une vidéo sur trois cette semaine sur ce compte. » (avertissement, jamais un blocage).

**Marche à suivre pour brancher un mot** (sur signal de la session de l'Usine, après un essai réussi de l'outil d'envoi) : aucun écran de réglage n'existe. Appeler, dans une session du studio connectée, `poserBranchementMot("IA", "instagram", "branche")` (`src/services/cas-concret-mots.ts` ; la date du jour est posée, l'action est écrite au journal). Pour un seul compte : `poserBranchementMot("IA", "facebook", "branche", "2026-10-12", "williamsjullin")` (sans effet sur la feuille tant que le compte d'une sortie n'est pas connu, ci-dessus). Pour débrancher : le même appel avec `"non_branche"`. Le réglage se relit par `etatMotsCasConcret()`.

### Refaire une vidéo avec l'autre fin

Le corps ne dépend pas de la fin : une vidéo déjà faite peut être refaite avec l'autre fin (par exemple quand son mot vient d'être branché) sans redire ni rendre de nouveau le corps. La chaîne reprend la prise du corps déjà retenue (même texte, même voix : même empreinte) et les écrans du corps déjà déposés ; seule la nouvelle fin est lue, ses écrans rendus et le fichier assemblé (test : `tests/cas-concret/x6/x6.test.ts`). La prise du corps est reprise depuis le journal de la fabrication ; une fabrication repartie d'un journal vide relit le corps (les écrans, eux, sont retrouvés par leur empreinte). Aucun bouton « Refaire avec l'autre fin » n'est construit.

## Durée estimée sur la voix réelle (X7, 12/10)

L'écriture estime la durée dite en **caractères par seconde**, avec la valeur du tableau animé calée sur la voix réelle et la même recette (`CARACTERES_PAR_SECONDE_TABLEAU`, 20,5, lue dans `src/domaine/duree-tableau.ts`). Le débit en mots (3,4 mots par seconde) s'écartait de plus de 5 % de cette estimation sur 5 des 7 cas (de −8,4 % à +7,5 %). La visée ne change pas : la vidéo la plus courte de 45 à 55 s. Les règles par écran (durée d'un écran, rythme) et la borne de refus de la durée totale (35 à 65 s) restent comptées en mots.

Quand la matière d'un cas est courte, l'écriture ajoute des écrans qui ne portent AUCUN fait nouveau : une question plus développée, un écran « titre » de transition qui redit la promesse (« En résumé : … »), la reprise d'une étape en deux écrans (le geste, puis la tâche « avant » qu'il évite). La consigne donnée à Claude le dit. Tests : `tests/cas-concret/x7/durees.test.ts` (7 cas × réseaux × avec et sans le mot, sortie la plus courte de 45 à 55 s en caractères) et `tests/cas-concret/fabriquer/x1-sept-cas.test.ts` (simulation de bout en bout : toutes les sorties de 40 à 65 s).

## Claude désigne, le code remplit (X9, 13/10)

Premier essai réel (vidéo `v-3a71b4a4dfea`) : l'écriture était refusée deux fois pour « champ « valeur » : champ obligatoire absent » sur les écrans à chiffre. Avant la validation du schéma, la passe `completerFiche` (`src/moteurs/montage-cas-concret/champs-du-cas.ts`) pose désormais tout ce que le studio possède ou calcule : l'en-tête de la fiche, l'identifiant et la marque de chaque écran, l'étiquette de l'accroche, le numéro et le total des étapes, le repli d'un vrai écran, et surtout la **valeur** d'un écran « chiffre » et des barres d'un « resultat », tirée du fait désigné par `faitId`. Une valeur rendue par Claude qui diffère de celle du fait est remplacée ; l'écart est noté au journal de l'étape. Un `faitId` absent, inconnu ou sans nombre reste un refus (« nombres des faits »), renvoyé à Claude au second essai. Le classement de chaque champ (créé par Claude, tiré du cas, calculé) est `CLASSEMENT_CHAMPS` ; la consigne ne demande que les champs de Claude et montre un exemple complet de chaque écran à chiffre (`EXEMPLES_ECRANS_A_CHIFFRE`, vérifié par un test).

Écriture refusée : la réponse brute du dernier essai (20 000 caractères au plus) est gardée dans le détail technique de l'étape, lisible par le pli « Détail technique » (`DetailTechniqueCasConcret`). « Réessayer » relit d'abord les réponses déjà payées, puis fait au plus un nouvel appel (voir X12). Le montant à confirmer est celui que le lancement réserve (ligne « Textes des réseaux » comprise). L'onglet « Sous-titres » dit « Le texte arrive après l'écriture » tant que la fiche n'est pas écrite (`TexteDitCasConcret`), puis les vrais sous-titres arrivent avec le résultat. Tests : `tests/cas-concret/x9/`.

## Cas sans fait chiffré (24/10)

Les 96 cas du stock n'ont aucun fait chiffré. Le premier essai réel d'un de ces cas a échoué : la consigne exigeait que chaque barre du « resultat » désigne un fait chiffré, et Claude répondait `PREUVE_MANQUANTE`. Désormais, quand aucun fait du cas ne porte de valeur (`casSansFaitChiffre`), la consigne le dit (paragraphe « SANS FAIT CHIFFRÉ ») : aucun nombre dit ou écrit, aucun écran « chiffre », et le « resultat » reste obligatoire (R04) mais dit le gain en mots, ses barres « avant » et « maintenant » étant `{ "libelle" }` seuls. `completerFiche` pose lui-même leur hauteur de dessin (`HAUTEURS_BARRES_SANS_FAIT`, 100 et 20), jamais affichée en nombre : la barre porte son libellé. Le patron de résultat « chiffre » n'est pas tiré pour ces cas, et la reformulation d'une phrase sans fait ne reçoit aucun nombre. Inchangés : R04, R12 (aucun nombre dans les libellés), le schéma, le budget, la limite de 2 appels, et l'exigence d'un `faitId` pour tout cas qui a au moins un fait chiffré.

## Quand un rendu rate (X10, 12/10)

Incident du tableau animé du 12/10 (le rendu d'une scène de sa seconde sortie avait raté ; la fabrication est restée « en cours » 30 minutes, sans erreur). Notre format sort un fichier par fin : le même piège y a été cherché et fermé.

**Un échec l'emporte toujours sur « déjà fait ».** Une étape qui rate est montrée en échec, même si elle était déjà passée pendant ce travail (une entrée changée l'a fait refaire). La fabrication ne reste jamais « en cours » sans étape qui avance.

**Chaque attente a une fin.**
- Écrans et finitions : délai de garde commun (`fournisseurs/rendu/garde.ts`, 15 minutes par défaut, réglable par `STUDIO_RENDU_SANS_NOUVELLE_MIN`). Un rendu en cours qui n'avance plus, ou que le serveur de rendu ne connaît plus (redémarrage), part une fois de plus sous un autre identifiant, puis l'étape s'arrête en échec.
- Captures du site, recette et raccord de la voix, mesure des blancs, analyse et nettoyage de la voix : même délai de garde, puis deux nouveaux essais (`-e1`, `-e2`), puis l'échec. Une capture qui rate prend son dessin de repli, sans arrêter la vidéo.
- Appels à Claude (écriture, reformulation) : 6 minutes sans réponse, puis l'échec (X2).
- Après un redémarrage du studio ou du serveur de rendu, un travail en cours reprend là où il en était : une demande que le serveur ne connaît plus est soumise de nouveau, jamais attendue.

**Ce que Will lit.** Une phrase qui nomme la fin concernée, par exemple « L'étape « Les écrans » n'a pas abouti. Le rendu d'un écran de la fin pour LinkedIn n'a pas abouti. Vous pouvez réessayer cette étape seule. » Quand le rendu ne répondait plus : « Le serveur de rendu n'a plus donné de nouvelle. » Jamais un identifiant ni le message brut du serveur (ils restent dans le détail technique).

**Ce que fait « Réessayer ».** Seul ce qui a raté repart, sous un nouvel identifiant (le serveur garde un échec 24 heures, et ne relance jamais un rendu figé) : l'écran raté, la fin dont le montage a raté, le raccord ou le traitement de voix raté. Ce qui est fait reste fait : le corps et les voix déjà payées ne sont jamais relus, les écrans et fins déjà rendus jamais refaits. Un contrôle final bloquant (un fichier hors des mesures attendues) n'offre pas « Réessayer » : la phrase du contrôle dit ce qui ne va pas.

Tests : `tests/cas-concret/moteur/x10-echecs.test.ts` (écran d'une autre fin, raccord de voix et montage de la deuxième fin, voix d'une fin refusée, contrôle d'une sortie, ordre échec avant « déjà fait ») et `tests/cas-concret/services/branchements/x10-garde.test.ts` (délai de garde, `-e1` puis `-e2` puis échec, rendus figés de bout en bout, serveur de rendu redémarré).

## « Réessayer cette étape » a toujours un effet (X12, 13/10)

Constat en ligne : vidéo `v-3a71b4a4dfea` arrêtée à « L'écriture », le bouton « Réessayer cette étape » ne faisait rien de visible.

**Ce qui se passait.**
- Côté studio : après une écriture refusée, la relance rejouait les deux mêmes réponses refusées, sans nouvel appel ; la fabrication s'arrêtait de nouveau à l'identique, avec la même phrase. Si la consigne avait changé depuis (travail créé avant une mise en ligne), elle relançait au contraire deux appels payés sans le dire. Un journal plus ancien ou incomplet pouvait aussi faire échouer la relance elle-même (« Un souci est survenu »).
- Côté écran : le suivi commun de la fiche (`SuiviTravail`) ne relit l'état d'un travail arrêté que toutes les 15 secondes, ne dit rien quand la relance est acceptée, et une erreur pendant l'appel (action serveur introuvable après une mise en ligne, file du routeur bloquée) restait muette.

**Ce que fait « Réessayer » maintenant.** Le même travail repart sur la même vidéo ; seules les étapes en échec sont refaites, ce qui est payé reste payé (X9, X10). Pour l'écriture : les réponses déjà payées (y compris celles d'un journal écrit par une version antérieure du code) sont relues et jugées avec les règles du jour, X9 complétant la valeur des écrans à chiffre. Si l'une passe, aucun appel. Sinon, **un** nouvel appel avec la consigne du jour. La phrase d'arrêt l'annonce avant le clic : « « Réessayer » relit d'abord les réponses déjà payées avec les règles du jour ; si elles restent refusées, un nouvel essai d'écriture coûte environ 0,29 €. » Quand Claude est réel, ce prix est aussi demandé dans la feuille « Confirmer ce prix » avant la relance. Ensuite, le seuil habituel du studio s'applique au reste.

**Ce que voit Will.** Le suivi du format (`SuiviCasConcret`) relance par une adresse fixe (`/cas-concret/relance`), sans passer par une action serveur. Pendant la relance, le bouton passe en attente. Ensuite, toujours une phrase à côté du bouton : « Relance envoyée : l'étape « L'écriture » reprend. », « Nouvel essai fait : l'étape s'est de nouveau arrêtée. », ou le refus (budget, crédit, « La fabrication a déjà repris », studio injoignable, délai dépassé). La progression est relue tout de suite après la relance. Un arrêt sans réessai (relecture refusée, calage, vérification bloquante, cas introuvable) propose « Reprendre le cas ».

**Raccord à poser (fichier commun, hors de cette tâche).** Dans `src/app/(studio)/videos/[id]/page.tsx`, la fiche d'une vidéo de ce format doit afficher `SuiviCasConcret` au lieu de `SuiviTravail`, comme `SuiviTableau` pour le tableau animé. Sans ce raccord, la correction côté studio s'applique déjà (relecture des réponses, un nouvel appel, journal ancien accepté), mais l'écran reste celui du suivi commun.

Tests : `tests/cas-concret/x12/` (reprise de l'écriture, journal d'ancienne forme, matrice étape × motif × bouton, pièces de l'écran) et `tests/e2e-ui/cas-concret-reessayer.spec.ts` (X12-01 : clic, relance, nouvel essai dit ; X12-02 : refus, studio injoignable, réponse illisible).

## Portage de la phase 2 (PR #167 portée par lots sur master, 18/10)

La phase 2 de #167 n'est pas fusionnée : elle est portée lot par lot (plan `PLAN-PORTAGE-PHASE-2.md`, PR #395), toujours **sur la voie de master** (script validé « À relire », variété par graine, mises en page L6, prix « au plus », voix, « Demander une modification » commune, liens L2-07). En cas de doute, master prime. **Rien n'est allumé par le code** : Will allume chaque réglage lui-même (ordre conseillé D6 : `catalogueEtendu` → `documentPromis` → `ecranFourni` → `porteB` → `retouches` ; les deux derniers déclenchent des appels payants). **`casConcret.releves` reste éteint jusqu'au lot du code unique de lien suivi (plan `PLAN-CODE-UNIQUE-LIEN-SUIVI.md`)** : voir plus bas.

| Réglage (paramètre du studio) | Éteint (défaut) | Allumé |
|---|---|---|
| `casConcret.catalogueEtendu` | la page montre les 8 cas de master | les 14 cas ajoutés apparaissent aussi (« à valider » tant qu'ils n'ont pas de script validé) |
| `casConcret.porteB` | pas de case de texte libre ; `demarrerPorteB` refuse sans appel | case « Faire la vidéo de ce cas » (description → cas, garde d'honnêteté, chiffres « à confirmer ») |
| `casConcret.retouches` | « Demander une modification » garde la réponse commune (« pour ce changement, il faut refaire la vidéo », prix) ; le moteur refuse toute retouche | retouche par opérations, comprise par discussion |
| `casConcret.documentPromis` | ni bloc ni page ; la route `/cas-concret/document/<vidéo>` répond 404 ; la phrase « Document promis : à préparer » reste dans « Vos fichiers » | brouillon, page imprimable, correction contrôlée, validation datée |
| `casConcret.ecranFourni` | ni « Fournir cet écran », ni page ; la fabrication ignore tout écran fourni | dépôt d'une image masquée et attestée |
| `casConcret.releves` | pas de bloc « Relevés » ; le site n'est pas lu | lecture seule des visites et vues, par publication. `casConcret.releves` reste éteint jusqu'au lot du code unique de lien suivi (plan `PLAN-CODE-UNIQUE-LIEN-SUIVI.md`) : le numéro de version est compté par vidéo, les visites se mélangent |

**Invariants testés** (`tests/cas-concret/portage/`) : aucun code n'allume un réglage ; le document promis ne part jamais tout seul (aucun import d'envoi, aucun bouton « Envoyer », « Je valide ce document » pose une date et une ligne au journal, rien d'autre) ; aucune publication ni notification n'est créée ; les relevés sont par publication (vidéo × réseau), jamais par personne.

### Retouche (P5, P6)
- **Par opérations** (`retouches.ts`, liste fermée : changer une phrase, un chiffre, le mot, sans le mot, retirer ou déplacer une étape) : appliquée à la fiche gardée de la version d'avant, revalidée par les règles R01 à R23 avant tout lancement. Seules les prises de voix dont le texte change sont relues (une prise déjà payée est reprise tant que son empreinte est celle de la voix d'aujourd'hui), seuls les écrans dont l'empreinte change sont rendus ; la mise de variété d'avant est gardée.
- **Prix** : la réservation d'une retouche est le coût exact de son aperçu (`estimerRetoucheCasConcret`), « au plus » comme la vidéo (mêmes lectures maximales, ressemblance comprise), jamais l'écriture, toujours sous le prix de la vidéo. L'estimation reçoit les opérations par un paramètre optionnel du contrat commun (`ContexteEstimationRetouche`). Sans opération, c'est le corps relu au pire. La voix d'une retouche est plafonnée à cette réservation, y compris à « Réessayer ».
- **Par discussion** : la phrase de Will passe par « Demander une modification » (pas de seconde boîte). Un appel Claude **détaché** la traduit en opérations (statut « en cours », relu par l'écran) ; le studio montre ce qui change, ce qui est refait et le prix ; rien ne part sans « Confirmer ». Hors liste, ou refusée par une règle : une phrase claire et le prix pour refaire la vidéo.
- **Déplacer une étape** : reste dans le catalogue, mais la règle « ordre du fonctionnement » (R23) la refuse toujours ; la phrase le dit (« les étapes se montrent dans l'ordre du cas »).
- **Raccord du réglage** : `refusRetouche` du moteur est synchrone, la lecture du réglage ne l'est pas ; les services relisent `casConcret.retouches` avant chaque chemin qui interroge le moteur (`preparerReglagesMoteur`) et le moteur lit la dernière valeur connue (éteint tant qu'elle n'a pas été lue). Le recalque des sous-titres reste refusé pour ce format.

### Document promis et relevés (P7, P8, P9)
- Le brouillon est fait par le code à partir du cas (aucun appel Claude), sur deux pages A4 au plus, sans prix ni chiffre absent du cas ni mot interdit. Sur la fiche de la vidéo, `BlocDocument` et `BlocReleves` se montent sous « Vos fichiers » ; chacun se garde lui-même (réglage éteint : rien).
- Relevés : une ligne par réseau, clé « code de version du réseau | réseau » (`utm_campaign` = `0042-CC-IG`, `utm_source` = le réseau, `codeVersionCasConcret`), code affiché = celui de la version choisie, visites des liens de toutes les versions numérotées de la vidéo additionnées (le lien d'une version déjà publiée ne change pas quand une retouche devient la version choisie) ; un lien = une vidéo : un ancien lien (sans numéro de suivi) commun à plusieurs vidéos est signalé (« Ancien lien commun à plusieurs vidéos : ses visites ne sont pas comptées. ») et non compté, vues de toutes les publications publiées du réseau, lecture du site gardée 3 minutes ; sans numéro ou sans lecture : « pas encore de mesure ».
- **Avant d'allumer `casConcret.releves`** : les nouvelles versions ont un `numeroSuivi` unique dans tout le studio (compteur atomique, #510), donc un code de lien comme `0042-CC-IG` désigne une seule vidéo. Les anciens liens (sans `numeroSuivi`) communs à plusieurs vidéos sont signalés et NON comptés. Ce qui reste avant d'allumer le réglage est une décision de Will.
  Limites connues :
  - (a) la phrase « Ancien lien » peut s'afficher pour une version récente créée sans `numeroSuivi` par un chemin hors `creerFabrication`/recalque ; le comptage reste juste, l'exclusion est une prudence ;
  - (b) une vidéo supprimée pour de bon ne compte plus comme propriétaire : ses anciennes visites pourraient être attribuées à la vidéo qui partageait son ancien lien ;
  - (c) la carte code→vidéos ignore le réseau : des visites sont perdues si deux anciennes V1 de réseaux différents partagent un code.
- **Lien du document promis** : sans suivi (page de diagnostic simple). #167 y posait un lien `utm_*` écrit à la main avec l'ancien code `cc-<cas>-<id>` ; la garde T4 de master l'interdit. Un lien suivi propre au document demande une décision de Will (nouvelle source de suivi dans `construireLienSuivi`).
- Le détail technique X9 (`TexteDitCasConcret`, `DetailTechniqueCasConcret`) n'est pas monté sur la fiche (décision D4).

### Écran fourni, porte B, catalogue (P2 à P4)
Voir `docs/formats/cas-concret/` et les tests `tests/cas-concret/{images-fournies,description,services/porte-b,catalogue}`. Les appels Claude de la porte B et de la discussion passent tous par `ecritureClaudeCasConcret` (socle de Will, pré-vol du budget, plafond propre, appels détachés) ; en simulation, rien n'est payé.

### Vérification de bout en bout sans appel payant
`tests/cas-concret/portage/recette-phase-2.test.ts` : réglages éteints (404, réponses de master, aucun appel), puis allumés dans le double (retouche proposée sans rien lancer, document validé sans rien envoyer, relevés lus par un lecteur double), `fetch` interdit. Les parcours d'interface (390 et 1440 px) sont dans `tests/e2e-ui/cas-concret-phase2-eteint.spec.ts` (réglages éteints, serveur de développement en simulation) : l'absence du bouton « Faire la vidéo de ce cas » avec une vraie phrase dans la case (porte B éteinte) et la route de l'écran fourni fermée pour un cas existant. **Non vérifié par l'interface** aussi : le lien « Fournir cet écran » dans la feuille d'un cas (le seul cas à étape derrière une connexion, `cycle-de-formation`, est un cas ajouté, caché tant que `catalogueEtendu` est éteint) ; la fiche d'une vidéo du format (blocs « Document promis » et « Relevés »), car la base de démonstration ne contient aucune vidéo `cas-concret` et en fabriquer une prend plus de deux minutes et demie par taille d'écran ; ces blocs sont couverts par les tests de la page (`ecrans/page-video`), de `vueCasConcret` et la recette ; les parcours « allumés » ne peuvent pas tourner sur un serveur de simulation tant qu'aucun réglage ne peut y être allumé sans toucher à la base : ils sont couverts au niveau des services.
