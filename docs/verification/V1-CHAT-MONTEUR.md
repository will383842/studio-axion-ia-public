# Vérif V1 — chat du monteur après la création de la vidéo

Date : 10/10. Branche `verif/v1-chat-monteur`, partie de `origin/master` à jour (85655d2).

Conditions de la vérification :

- Aucun appel réel : `fetch` global interdit, pas de HeyGen ni de Higgsfield.
- Claude est **doublé**. Le double est le vrai client SSE et le vrai chemin de dépense, servis par un faux `fetch`. Il lit la transcription envoyée, comme le ferait Claude.
- Rien n'a été fusionné ni déployé, et aucun serveur n'a été touché.

Exigence de Will : « que l'on puisse bien modifier ou rajouter des choses depuis le chat après que la vidéo ait été créée ».

## Banc d'essai

`tests/v1-chat-monteur.test.ts` contient 30 scénarios bout en bout. Chaque scénario suit la même chaîne :

1. service `discuterAvecMonteur` ;
2. Claude doublé ;
3. opérations ;
4. nouvelle version, par retouche partielle ;
5. contrôle de l'état final de la version.

Ce contrôle porte sur trois choses :

- les entrées de la version ;
- les cartes réellement posées par `habillageFacecam`, dont les cartes automatiques ;
- les parties refaites, calculées par `partiesARefaire`.

La vidéo de départ est IMG_7747 v2, avec les données réelles du fixture :

- l'alignement réel jusqu'à « … la bonne fuite. » ;
- puis la fin bégayée entendue par Whisper (« Quel que soit votre taille. Si vous sentez que du temps, » redit) ;
- les coupes du studio de la prod, avec la reprise de fin **non** retirée, comme en prod.

`lancerRetouche` est remplacé par une version « en fabrication » de même forme que la vraie, mais sans moteur.

## Scénarios et résultats

« KO avant » signifie que le scénario échouait sur master. Tous sont OK après les correctifs.

| # | Phrase de Will (telle quelle) | Attendu | Avant | Après |
|---|---|---|---|---|
| 1 | (n'importe quel message) | Claude voit la transcription montée **et** les cartes automatiques posées | KO (cartes auto invisibles) | OK |
| 2 | « a 0:32 montre les 3 etapes » | carte des étapes à 0:32 ; seul l'habillage est refait ; les autres cartes restent | KO (les 8 cartes auto disparaissaient) | OK |
| 3 | « rajoute plein d'animations au debut stp » | 3 éléments dans les 20 premières secondes, habillage seul | OK | OK |
| 4 | « deplace la carte des etapes a 0:45 » | une seule carte, à 0:45 (retirer + poser) | OK | OK |
| 5 | « deplace la carte des 3 etapes plutot a 0:45 » avec un effet réaliste en attente | va au monteur, l'effet payant n'est pas déplacé | KO (pris pour « changer le moment de l'effet ») | OK |
| 6 | « enleve la carte sur les relances a la main » | carte auto retirée, et elle ne revient pas | KO (impossible : la carte était inconnue du monteur) | OK |
| 7 | Feuille « Cartes » → Retirer une carte auto | la carte est listée et se retire sans Claude | KO | OK |
| 8 | « sur la carte du diagnostic ecris plutot 45 min offertes » | carte auto remplacée au même endroit par le nouveau texte | KO (carte auto inconnue) | OK |
| 9 | « remets le debut que tu as coupé » | passage rétabli ; assemblage et habillage refaits ; les cartes posées suivent leurs mots (+14,88 s) | KO (cartes restées à l'ancien temps) | OK |
| 10 | « coupe l'hésitation a 0:41 » | coupe demandée ; les cartes d'après sont recalées | KO (même défaut) | OK |
| 11 | « je bégaie vers la fin, enlève les répétitions » | première tentative coupée, phrase complète gardée, « Quel que soit » une seule fois | OK | OK |
| 12 | « plus de plans de camera stp, ça manque de rythme » | 5 zooms, jamais la multicaméra payante | OK | OK |
| 13 | « plus lumineux et bonne mine » | lumière +, mine + ; seuls l'image et l'habillage sont refaits | OK | OK |
| 14 | « dans les sous titres ecris Certifexemple et pas Calliopi » | mot corrigé sans Claude, habillage seul ; correction **gardée** à la retouche suivante | KO (le message partait à Claude, sans réponse possible) | OK |
| 15 | « corrige Kaliopy par Certifexemple dans les sous-titres » | « pas trouvé », aucune version | KO | OK |
| 16 | « mets les sous titres en jaune » | réponse claire, aucune carte inventée | KO | OK |
| 17 | « change le decor, mets un bureau moderne » → Annuler | carte de confirmation, aucune version, rien de payé, aucun réseau | OK | OK |
| 18 | « jette mon telephone sur l'ecran en vrai » → Annuler | carte effet réaliste, rien de payé | OK | OK |
| 19 | « change le decor et a 0:32 montre les 3 etapes » | carte payante **et** carte des étapes faite ; Claude ne reçoit que la partie gratuite | KO (la partie gratuite était perdue) | OK |
| 20 | « fais le truc la » | Claude dit quoi préciser, aucune version, jamais « souci » | OK | OK |
| 21 | « qsdkjqsd » avec Claude en panne | « Je n'ai pas compris » **avec des exemples** | KO (phrase nue) | OK |
| 22 | Message de prod de Will¹, avec Claude | décomposé : zooms, animations au début, répétition coupée, UNE version | OK | OK |
| 23 | Consigne envoyée à Claude | elle dit de traiter chaque point, malgré les fautes de frappe ; répétitions ; cartes-auto | KO | OK |
| 24 | Message de prod de Will¹, **Claude en panne** (cas du 10/10) | la version simple fait aussi les 3 points | KO (« Je n'ai pas compris ») | OK |
| 25 | « plus lumineux stp », en version simple | lumière + | KO (« lumineux » inconnu) | OK |
| 26 | 3 messages envoyés **pendant** le recalcul | la dernière version contient les 3 changements ; historique transmis ; 6 messages au fil | KO (le 2e repartait de la version choisie : le 1er était perdu) | OK |
| 27 | Versions terminées une à une | chaque message repart de la dernière ; les consignes s'empilent | OK | OK |
| 28 | Une ancienne retouche finit après la plus récente | la plus récente reste choisie | KO | OK |
| 29 | Redémarrage (modules rechargés) | fil, carte payante en attente et dernière version retrouvés | KO (même cause que n° 26) | OK |
| 30 | La nouvelle version ne peut pas partir (crédit) | le message et la raison restent dans le fil | KO (exception : message perdu) | OK |

¹ Message de prod de Will : « IL MAnque pplusierus plan de caméra. ET BEAUCOUP D4ANIMATION AU DEBUT; PUIS VERS LA FIN de la video je bégueille et je reprned des memes phrase. fixe ce probleme ».

Réponses lues par Will (extraits du test) :

- Prod, sans Claude : « Le monteur complet n'a pas pu traiter cette demande ; j'ai appliqué la version simple. […] C'est fait : 8 changements de cadre ajoutés ; mouvements de cadre ajoutés au début, entre les cartes déjà posées ; phrase redite retirée vers la fin. »
- Charabia : « Je n'ai pas compris : pouvez-vous reformuler ? Par exemple : « à 0:32 montre les 3 étapes », « coupe l'hésitation à 0:41 », « plus lumineux » ou « enlève les répétitions vers la fin ». »

## Défauts trouvés et corrigés

Pour chaque défaut, le test a d'abord été écrit rouge.

**D1. Messages enchaînés pendant le recalcul : le précédent était perdu.**

Cause : chaque geste repartait de la version **choisie**, qui reste l'ancienne pendant toute la fabrication.

Correction : le monteur repart de la dernière version en fabrication (travail en cours) plus récente que la version choisie (`versionCourante`, `services/monteur-facecam.ts`).

**D1 bis. Une ancienne retouche pouvait remplacer une plus récente.**

Cause : une retouche plus ancienne qui finit après une plus récente devenait la version choisie.

Correction : `versionPlusRecentePrete` (`services/travaux.ts`) garde la plus récente.

**D2. Cartes déplacées après une coupe ou un rétablissement fait au chat.**

Cause : après « coupe » ou « rétablis » au chat, les éléments déjà posés gardaient leur ancien temps monté. Ils se retrouvaient décalés de la durée coupée ou rétablie. La feuille « Coupes » recalait, le chat non.

Correction : `piloterMonteur` recale les passages sur leurs ancres dès que les coupes changent.

**D3. Cartes automatiques invisibles pour le chat et effacées par l'ajout d'une carte.**

Cause : les cartes automatiques (`planifierCartesAuto`) n'existaient qu'à l'habillage, ce qui avait trois conséquences :

- le chat ne les voyait pas, donc il ne pouvait ni les retirer, ni les déplacer, ni changer leur texte ;
- la feuille « Cartes » ne les listait pas ;
- surtout, **une seule carte demandée au chat les supprimait toutes** : l'habillage prenait « les cartes du monteur, sinon les automatiques ».

Corrections :

- l'habillage pose les cartes du monteur **plus** les cartes automatiques qui ne les croisent pas et que Will n'a pas retirées (`cartesPosees`, partagée avec les formats 4:5, 1:1 et 16:9) ;
- l'identifiant `auto-…` d'une carte automatique est tiré de son contenu, donc il reste stable après une coupe ;
- la chaîne livre ces cartes dans `entrees.facecam.cartesAuto` ;
- le monteur les voit comme éléments `carte-auto` ;
- `retirer` les range dans `facecamMonteur.cartesAutoRetirees`, et « Annuler » les rétablit ;
- la feuille « Cartes » les liste et les retire.

**D4. Sous-titres impossibles à changer depuis le chat.**

Cause : la demande partait à Claude, qui n'a pas d'opération pour les sous-titres. Un réparateur pouvait même en faire une **carte**.

Corrections :

- « écris X et pas Y » et « remplace Y par X » deviennent `facecamMonteur.correctionsSousTitres`, appliquées par le studio sans Claude ;
- chaque habillage les réapplique (`corrigerMots`), donc la correction n'est pas perdue à la retouche suivante, et seul l'habillage est refait ;
- un mot absent donne une réponse claire, de même qu'une demande de style ;
- le réparateur ne transforme plus jamais une opération « sous-titres » en carte.

**D5. La version simple ne comprenait pas le message de prod de Will.**

Cause : le message réel de Will (« Je n'ai pas compris » en prod) n'était pas compris par la version simple, qui ne lisait qu'une règle par message. Elle ne savait faire ni « plusieurs plans de caméra », ni « beaucoup d'animation au début », ni « je bégaie ».

Correction : nouveau module pur `monteur/regles-simples.ts`, qui fait quatre choses :

- il découpe le message en points (phrases, « puis », morceaux reliés par « et ») ;
- il lisse les fautes de frappe (« D4 » = « D' » sur un clavier AZERTY) ;
- il repère la zone dite (« au début », « vers la fin ») ;
- il traduit trois demandes d'ensemble : changements de cadre répartis, animations dans les trous libres (sinon des mouvements de cadre), phrases redites (la première tentative est coupée).

Autres ajustements :

- « lumineux » est compris ;
- les réglages d'image sont dits en mots simples (« Image plus lumineuse », plus jamais « (lumiere) ») ;
- une réponse « pas compris » donne toujours des exemples.

**D5 bis. Consigne de Claude.**

La consigne demande désormais :

- de traiter **chaque** point d'un message ;
- de lire malgré les fautes de frappe ;
- de couper la première tentative d'une phrase redite ;
- de poser des zooms pour « plus de plans de caméra » ;
- d'utiliser les `carte-auto` pour retirer ou déplacer une carte automatique ;
- de ne jamais poser de carte pour les sous-titres.

**D6. Demande mêlée gratuit + payant : la partie gratuite était perdue.**

Cause : avec une option payante dans le message, tout le message partait en carte de confirmation.

Correction : le point payant donne sa carte, le reste est traité par le monteur, avec une seule réponse (`separerDemande`).

**D7. Déplacer une carte pouvait déplacer l'effet réaliste en attente.**

Cause : « déplace la carte… plutôt à 0:45 » était pris pour « changer le moment de l'effet réaliste » dès qu'un effet payant attendait sa confirmation.

Correction : `estChangementDeMoment` ignore une phrase qui nomme un autre élément (carte, titre, zoom…).

**D8. Message perdu quand la nouvelle version ne pouvait pas partir.**

Cause : si la nouvelle version ne pouvait pas partir (crédit, retouche indisponible), l'erreur remontait avant l'écriture du fil. Le message de Will était perdu.

Correction : le fil garde le message et la raison exacte.

## Vérifications

- `tests/v1-chat-monteur.test.ts` : 30 tests verts. Avant les correctifs, 19 des 29 tests de départ étaient rouges ; le n° 15 a été ajouté ensuite.
- Ciblés face caméra, monteur, lots J et K, schémas Claude, `src/briques` et `src/moteurs` : 50 fichiers, 664 tests, tous verts.
- `next typegen` puis `tsc --noEmit` : 0 erreur. `eslint .` : 0 problème.
- Suite complète Vitest, lancée une fois : 282 fichiers (280 verts, 1 rouge, 1 ignoré) ; 3473 tests (3469 verts, 1 rouge, 3 ignorés).
  - Le test rouge est `e2e-verif1-bc-serie` (« CORRECTEUR FINAL A ») : il a dépassé le délai de 5 s sous la charge de la suite complète.
  - Relancé seul, il passe : 14 tests sur 14.
  - Il porte sur la série de scripts du générateur et ne touche aucun fichier modifié ici.

## Défauts restants (non corrigés ici)

**R1. Correction de mots dans l'éditeur « Sous-titres » perdue à la retouche suivante.**

Une correction faite dans l'éditeur (toucher un mot, puis « Appliquer à la vidéo » : recalque) est perdue à la retouche **suivante** du monteur. L'habillage régénère alors les sous-titres depuis la transcription.

Ce défaut existait avant cette vérification. Les corrections faites **au chat** sont, elles, durables (D4). Piste : ranger aussi les corrections de l'éditeur dans `correctionsSousTitres`.

**R2. Style des sous-titres non réglable.**

La taille, la couleur et la place des sous-titres ne se règlent ni au chat ni ailleurs : elles sont fixes pour le face caméra. Le chat le dit clairement.

**R3. Réponses de la vraie API Claude non vérifiées.**

La qualité réelle de la décomposition par Claude (scénarios 22 et 23) n'est vérifiée qu'avec un double. La consigne est en place, mais elle reste à confirmer sur la vraie API (aucun appel réel ici).

**R4. Version simple : animations au début sans place libre.**

Quand des cartes occupent déjà tout le début, la version simple ajoute des mouvements de cadre plutôt que des cartes. Elle le dit à Will.

**R5. « Revenir à la version d'avant » saute une version.**

Une version créée pendant qu'une autre se fabrique a pour parent la version choisie (le moteur réutilise ses fichiers déjà faits). « Revenir à la version d'avant » saute donc la version intermédiaire.
