# CORRECTEUR RÉEL 2 — 1re vraie vidéo avocat (04/10) : illustrations, décor HeyGen, cadrages, fin, avatar déjà payé, looks par consigne

Branche `outils/reel2` (depuis `master` ee9c3f1). `src/briques/composition/montage.ts` non touché. Aucun appel réseau
réel, aucune clé : HeyGen, banques, stockage et service de rendu sont doublés dans les tests.

## 1 — Illustrations (tâche 1 + A)

**Cause.** Un texte COLLÉ n'est jamais réécrit : aucun segment n'avait d'« intention d'illustration ». Les plans de
l'Aperçu (`plansDepuisScript`) ne posaient une illustration que sur une intention écrite (générateur) → 9 plans
« double » sur 9, la cascade n'avait rien à chercher, la commande partait sans illustration, le moteur n'en plaçait aucune.

**Correction.** `intentionsAutomatiques` (`src/domaine/illustrations.ts`, pur, sans dépense) : si le script n'a AUCUNE
intention, ~1 segment sur 3 qui nomme un objet concret reçoit une intention faite de ses propres mots ; jamais le
premier ni le dernier segment, ni l'accroche, l'appel ou la boucle, jamais deux voisins, jamais une personne. Mode
« auto » seulement. Vocabulaire bureautique ajouté (Excel/tableur → « spreadsheet computer screen », clavier, logiciel,
fichier, alerte, tableau de bord…). La cascade reste la même : **clips vidéo verticaux Pexels puis Pixabay d'abord**
(gratuits), sinon « à fabriquer » (fal.ai : image puis clip de 5 s, payé, compté dans le prix). Durée 1,5-2,5 s, jamais
avant 3 s, ≤ 25 % du temps. Le moteur ne fabrique jamais plus que ce que le prix accepté compte. Vidéo d'essai (moteur
simulé) : aucune banque interrogée.

**Preuves.** `tests/reel2-illustrations-texte-colle.test.ts` (6) : texte collé 90 mots → Rapide → Aperçu → commande →
découpage du moteur réel : ≥ 1 illustration, aucune avant 3 s, jamais plus que payé ; texte « Excel » → requête
« spreadsheet ». ROUGE : correction retirée → 2 rouges ; vocabulaire retiré → 1 rouge.

## 2 — Décor fait dans HeyGen (tâche 2)

- **Relier un look existant** : Bibliothèque › Décors › un décor réaliste › « Relier un look HeyGen ». Lecture
  GRATUITE de tous les looks privés du compte (`GET /v3/avatars/looks?ownership=private`, sans filtre de type : le
  groupe « New Avatar » 1c22241239ce4e8591d4d63a463e5c28 en fait partie), choix de l'angle, « Relier ce look ». Le look
  est relu (`GET /v3/avatars/looks/{id}`, terminé, Avatar V), son aperçu copié chez nous en vignette (hôtes HeyGen
  seulement, taille plafonnée), décor « À vérifier » jusqu'à « Valider sur capture ».
- **Rendu** : décor relié ET validé → HeyGen rend l'avatar SUR ce look, en mp4 AVEC son fond (`avecSonFond` : ni
  `background`, ni webm transparent, pas de repli fond uni). Composition par `lookReel` (piste opaque, aucun décor posé
  derrière, aucun liseré) ; les recadrages (B) et les illustrations (A) s'appliquent pareil sur cette piste.
- **Prix** : même tarif à la seconde (estimation identique avec ou sans décor relié, testé).
- **Refus avant toute dépense** : décor pas validé ; vidéo à deux angles dont le second n'a pas de look.
- **F4** : sur un look de décor, `reference_look_id` = look FILMÉ de Will (ses gestes appris) ; consigne de gestes par
  défaut : tête stable, petits gestes sous la poitrine ; trois quarts : regard vers l'interlocuteur ; presque de face :
  regard dans l'objectif.

**Preuves.** `tests/reel2-decor-look-heygen.test.ts` (10) : lecture seule, liaison + vignette + validation, refus
(look pas prêt, hors compte, décor posé par le studio, angle inconnu), corps du rendu, moteur complet (rendu sur le look,
référence des gestes, composition opaque sans liseré, 12,48 s au même tarif). ROUGE : code retiré → 7 rouges ;
mutations `pistesDepuisLook`, garde de validation, référence des gestes → rouges.

## 3 — Recadrages francs (B)

Réglage « Votre avatar est filmé » : **À la taille** (défaut, valeurs d'avant 1 / 1,2) ou **En pied** : large ×1,4
(≈ mi-cuisse), poitrine ×2,0, serré visage ×2,6 sur les mots en valeur ; centre de l'image sur le haut du corps (18 %) ;
alternance large / serré franche (écart ≥ 25 % au lieu de 15-20 %). Au-delà de ×2,6 : alerte « l'image peut perdre en
netteté ». Preuves : `tests/reel2-cadrage-en-pied.test.ts` (4), ROUGE sans la correction → 3 rouges.

## 4 — Une vraie fin (E)

Par défaut : fin ≈ 1,2 s après le dernier mot ; le son maître reçoit un silence de fin (≈ 1,3 s au total, l'avatar finit
bouche fermée ; `silenceFinSec` appliqué par `studio-rendu`, opération de nettoyage) ; l'image s'éteint au noir et le son
en fondu (au plus 1 s, jamais avant le dernier mot). La fin ne dépasse jamais le son : sur un son déjà rendu (vidéo du
04/10 : 0,45 s après « Excel »), fondu de 0,45 s au lieu d'une coupe sèche. Option « Fin en boucle » : 0,4-0,6 s, sans
fondu. Preuves : `tests/reel2-fin.test.ts` (5, rouges avant) ; `decoupage.test.ts` R11 et R4 mis à jour.
⚠️ `studio-rendu` doit être redéployé pour le silence de fin et le fondu (un ancien conteneur ignore ces paramètres :
fin d'avant, sans casse).

## 5 — Ne pas repayer l'avatar (C)

Constat : refaire la vidéo réutilisait la voix (audio maître) mais RENDAIT ET PAYAIT de nouveau le double. Correction :
`doubleDejaRenduDepuis` (domaine) retrouve, dans les fabrications terminées de la vidéo, le rendu fait sur le même
audio maître ; le moteur le reprend s'il a le même look, le même fond et le même passage (aucun envoi HeyGen, aucune
ligne « Double » au prix affiché ni au coût réel). Il suffit de relancer « Fabriquer » sur la même vidéo (même texte,
même voix). Un changement de décor relié, de fond ou de texte refait le rendu (prix affiché, accord). Preuves : 2 tests
dans `reel2-decor-look-heygen.test.ts` (mutation → rouge).

## 6 — Looks créés par le studio (F1, F2, F3, F5 — décision de Will du 04/10)

- **F1** : `LOOKS_HEYGEN_PAR_LE_STUDIO` devient la valeur par défaut (éteint) d'un réglage « Créer vos décors avec
  HeyGen » (Réglages › Connexions › Double), relu par le fournisseur avant chaque création. Création :
  `POST /v3/avatars` type `prompt`, `avatar_group_id` lu sur le look filmé (gratuit), `avatar_id` = look filmé,
  `aspect_ratio` 9:16, clé d'idempotence.
- **F2** : Plateau › « Décrivez » (« bureau moderne, costume bleu, debout ») → « Créer ce décor avec HeyGen » : consigne
  anglaise (tenue, décor, debout/assis, cadrage tête-taille, vertical 9:16), feuille « Confirmer ce prix », décor
  rangé dans la Bibliothèque (réutilisable), choisi pour la vidéo, « À vérifier » ; à l'ouverture de « Mes décors », les
  looks terminés sont suivis (gratuit) et leur aperçu devient la vignette.
- **F3** : « Aussi un second angle » : même pièce, caméra à 30° sur le côté, regard vers l'interlocuteur (trois quarts) +
  presque de face (objectif).
- **F5** : le prix d'un look par consigne n'est pas documenté : montant provisoire (1 crédit ≈ 1 $ par angle,
  `CENTIMES_USD_PAR_LOOK`, `src/domaine/decors.ts`) toujours montré avec « Prix annoncé par HeyGen : à confirmer sur le
  premier essai. » ; accord exigé, budget et crédit contrôlés, dépense notée.

Preuves : `tests/reel2-looks-par-consigne.test.ts` (4) : éteint → aucun appel ; consigne et prix ; sans accord →
refus ; avec accord et second angle → 2 créations dans le groupe de Will, décor à vérifier, dépense, vignette quand prêt.
ROUGE : code retiré → 4 rouges. `b1-decors.test.ts` ajusté (lecture du look de base avant la création).

## Ce que Will doit faire

1. **Refaire la vidéo Excel** sur la même vidéo : Plateau › Style : « Votre avatar est filmé » → **En pied** ; garder
   la fin par défaut. « Fabriquer » : l'avatar n'est pas repayé (prix sans ligne « avatar »), seules d'éventuelles
   illustrations à fabriquer sont comptées. Les plans déjà ouverts sont gardés : modifier une phrase recalcule les
   illustrations.
2. **Pour être « dans » un décor HeyGen** : soit créer le look dans l'application HeyGen (avatar « New Avatar »,
   vertical, Avatar V) puis Bibliothèque › Décors › décor réaliste › « Relier un look HeyGen » › « Valider sur
   capture » ; soit allumer Réglages › Connexions › Double › « Créer vos décors avec HeyGen » et utiliser « Décrivez ».
   La vidéo suivante est rendue sur ce look (nouveau rendu payé, prix affiché et accord).
3. Au premier look créé par le studio, relever le prix réel dans le portefeuille HeyGen pour régler
   `CENTIMES_USD_PAR_LOOK`.
4. Redéployer `studio-rendu` (silence de fin, fondu au noir).

## Contrôles

- `npx tsc --noEmit` (racine et `studio-rendu`) : aucune erreur hors mammoth/unpdf.
- `npx eslint` sur tous les fichiers touchés : propre.
- Suite complète finale : 12 fichiers en échec, **tous déjà en échec sur master** (mammoth/unpdf absents, et tests
  d'intégration instables sous charge) : c3-import-fichier, c3-scripts-reels, e2e-verif1-bc-import,
  e2e-verif1-bc-script-video, e2e-verif1-bc-serie, e2e-verif1-g-import-autonome, final-b-image-rendu-fichiers,
  final-b-import-autonome, final-b-mise-a-jour-sante, garde-ecran, paquet4-relecture-securite,
  paquet4-rerelecture-securite. Lancés seuls, ces fichiers échouent autant ou moins que sur master (vérifié sur ee9c3f1).

## Limites connues

- L'angle « principal » du format avocat est « trois quarts » : si le look filmé de Will regarde l'objectif, la
  consigne de gestes « regard vers l'interlocuteur » peut le faire détourner les yeux ; à juger sur la première vidéo.
- Le corps exact de `POST /v3/avatars` (type prompt) suit la documentation relue le 02/10 et les indications du 04/10
  (`avatar_group_id`) ; `reference_look_id` dans `POST /v3/videos` n'a pas été vérifié en réel.
