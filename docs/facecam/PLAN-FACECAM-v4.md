# PLAN FACE CAMÉRA — v4 (09/10/2026) — DOCUMENT QUI PRIME

> Ce document PRIME sur toute autre version. Il applique les corrections de l'équipe de vérification (architecte, UX, garant des attentes de Will, exécution rapide, complétude, qualité vidéo). Pour le reste, la référence détaillée reste PLAN-IMPLEMENTATION-FACECAM.md (v3 + ajouts). Décision de Will du 09/10 : agent monteur à vocabulaire OUVERT (« divise l'écran », « rajoute un générique »…).

# Synthèse de l'architecte : plan face caméra v3 → v4

J'ai lu le plan en entier (644 lignes), sans le modifier : `<dossier utilisateur>\Documents\Projets\Axion-IA\<dossier-de-plan-prive>\facecam\PLAN-IMPLEMENTATION-FACECAM.md`. Les numéros de ligne cités plus bas sont ceux de la v3.

## A) POUR WILL

1. Vous n'aurez plus 8 étapes. Vous validez le texte, vous filmez, vous envoyez depuis l'iPhone, et le studio monte tout seul. Vous recevez « Votre vidéo est prête », vous regardez, vous validez.
2. Tous les réglages se font automatiquement. Si vous voulez corriger quelque chose, c'est possible depuis la vidéo prête, mais rien ne vous oblige à y toucher.
3. Vous réglez votre « look » (lumière, teint, dents) une seule fois. Toutes vos vidéos suivantes lui ressembleront.
4. Aucun prix n'apparaît nulle part. Seuls restent le total du mois et un plafond de sécurité. Si le plafond est atteint, la vidéo sort quand même, en version plus simple.
5. Votre monteur comprend vos consignes, dites à voix haute (en commençant par « Monteur, … ») ou écrites. Les cartes animées sur mesure écrites par Claude sont allumées dès le départ.
6. Les effets où l'on vous « découpe » ne s'appliquent jamais tout seuls. Ils restent disponibles quand vous les demandez.
7. Qualité de l'image : l'image ne perd plus de finesse à chaque étape, il n'y a plus de bandes sur le mur, le rythme est plus vif et le son a un réglage de pro.
8. On démarre tout de suite avec les choix conseillés, sans attendre vos réponses. Chaque choix se changera plus tard d'un toucher.
9. Le chantier est mené par deux équipes en parallèle. Il y a une seule mise en ligne, à la fin, annoncée avant à la session qui s'occupe du studio. Comptez 4 à 5 jours.
10. Ce qui viendra après : le changement de décor Higgsfield, les formats carrés et horizontaux, la main en 3D et la vitre qui se brise.

## B) PLAN v4 — CORRECTIONS

### Bloquant

1. **En-tête l.5-6.**
   - Remplacer « notamment sur le fond flou ou décroché, qui est refusé » par : « Fond décroché, flou et détourage : jamais PAR DÉFAUT, possibles À LA DEMANDE de Will (L11) et pour le décor Higgsfield (L10). »
   - Remplacer « L0 (maquettes) et L0b (mesures) d'abord. Aucun code de production avant les réponses de Will » par : « On code tout de suite avec les valeurs par défaut de la section Décisions. Chacune se change ensuite dans Réglages, sans recoder. »

2. **Décisions l.19.** Ligne Fond : « Pas de décroché, pas de flou ni de liseré PAR DÉFAUT. Le fond est seulement assombri de 10 à 15 %. Détourage possible à la demande. »

3. **L1 l.142-146 (identifiant du format).** Écrire : « Format `facecam`, code FC. La famille `face-camera` n'est pas modifiée. `recetteFaceCamera` n'est jamais touchée, car l'avocat en hérite. » Supprimer « même identifiant que la famille… un test vérifie… ». Pour la v1, `ratios: ["9:16"]`.

4. **Architecture §1 l.31.** Supprimer l'ajout dans `MOTEUR_PRISES_FILMEES` et l'interrupteur `moteur.facecam.jeLis`. Écrire : « Seul `format.moteur = "montage-facecam"` est renseigné (IDS_MOTEURS et MOTEURS). `deciderJeLis` rend directement ce moteur. Le chemin de l'avocat n'est pas touché. »

5. **Architecture §8 l.66-67 (données).** Remplacer par : « `Video.entrees.facecam = { pisteVisageCle, transcriptionCle, masquesCle, coupes:{auto[],retablies[]}, image:{lumiere,couleurs,mine,dents}, passages[], consignes[] }`. Les données lourdes (points du visage, masques, transcription au mot, piste de cadrage) vont sur R2 en json.gz. Le document Video ne garde que les clés. Pas de nouveau type de Bibliothèque, pas de migration : le catalogue d'effets est une constante du code. »
   - Raison : la table `documents` est chargée en entier au démarrage, dans un conteneur limité à 1 Go.

6. **Architecture §6-7 l.55-64 (conteneur et calculs lourds).** Remplacer par : « On étend le `studio-aligneur` existant, sans créer de nouveau conteneur. Routes ajoutées : `/transcrire` (faster-whisper small int8), `/visages` (FaceLandmarker et Hands), `/image` (passe image), `/son` (DeepFilterNet) et `/segmenter` (à la demande). Chaque route travaille sur disque, par tranches de 30 s, un travail lourd à la fois, avec `cpu_shares` bas et `mem_limit` à 3,5 Go. `studio-rendu` ne reçoit aucune nouvelle opération, aucune nouvelle file et aucun changement de contrat. »
   - Ajouter : « Avant le lot B, vérifier que le profil `calage` est actif en prod (`COMPOSE_PROFILES`) et relever `docker stats` sur l'hôte. »

7. **Architecture §5 et L5 (passe image).** Remplacer « passe FFmpeg qui utilise ces masques » par : « Une seule passe Python : décodage ffmpeg, puis OpenCV et masques interpolés à chaque image, puis encodage ffmpeg. Elle ne traite que la bande utile (environ 1600×2160 avec la marge de zoom) et enchaîne débruitage, lumière, bonne mine, dents, couleurs et LUT. Elle produit un fichier intermédiaire 10 bits quasi sans perte (x264 10 bits, crf 8 au plus) stocké sur R2. Les réglages Lumière, Couleurs, Mine et Dents ne relancent que cette passe, jamais les masques. »

8. **Chaîne d'encodage (nouveau §, à insérer après « Qualité d'image »).** Écrire : « Une seule compression 8 bits, à la composition finale : 1080×1920, H.264 high, 16 à 20 Mb/s, `aq-mode=3`, avec un tramage léger. Les opérations existantes `assemblage` et `composition` reçoivent un paramètre FACULTATIF `source10bits` ; s'il est absent, le comportement de l'avocat ne change pas. Contrôle : aucune bande visible sur le fond. »

9. **Architecture §7, MD et L6 (opérations neuves).** Supprimer `preparer-rush`, `image-masques`, `assemblage-facecam`, `motion-design` et la file `video`. Écrire :
   - « Les cartes sont de nouvelles `<Composition id="Carte…">` dans `Racine.tsx`, rendues par l'opération `composition` existante. »
   - « Le paramètre facultatif `sourcePreCadree` est ajouté à `scene.ts` et `parametres.ts`. »
   - « La préparation du rush (rotation, HLG→SDR avec `zscale` et tonemap hable, 25 i/s) se fait dans la route `/image`. »

10. **MD-0 et MD-0 bis l.231-250.** Remplacer par : « Pas d'HyperFrames en v1 ; il reste noté en veille. Une composition Remotion `CarteSurMesure` reçoit HTML, CSS et une timeline GSAP écrits par Claude. Ils s'affichent dans une iframe isolée (sandbox, sans réseau, polices et GSAP locaux), et la timeline est calée sur l'image Remotion par `tl.seek(frame/25)`. Garde-fous : 3 à 8 s, zones sûres, texte d'au moins 3 % de la hauteur, jetons de la charte imposés, image de contrôle relue, sinon repli sur le modèle fixe. ACTIVÉE par défaut (D13 = oui). »

11. **Prix, partout (l.327, 394, 454, 517, 573, et P10 l.339).**
   - Supprimer « devis », « prix affiché », « accord demandé » et « coût affiché avant ».
   - Ajouter dans L1 : « Pour le format facecam, `estimer()` renvoie 0, l'AccordPrix est automatique, et le bloc Coût d'Express, la ConfirmationPrix de l'Aperçu et le montant de DemanderModification sont masqués (drapeau `sansPrix` du format). Seuls restent le total du mois et le plafond, dans Réglages. »
   - Ajouter : « Plafond atteint = la vidéo sort quand même en version simple (règles par défaut, modèles fixes, sans relecture Claude), avec la mention "Plafond du mois atteint — relever ?" ». Ajouter un test unitaire de ce cas.

12. **L1 l.147 et L7 l.314 (parcours).** Remplacer par : « Étapes `["express","fabrication"]` comme l'avocat, sans nouvelle clé dans CLES_ETAPES. Parcours : texte → séance iPad → envoi depuis l'iPhone → fabrication automatique → notification → "Votre vidéo" → Valider et publier. Coupes, Image, Cartes et Sous-titres deviennent des feuilles FACULTATIVES de "Votre vidéo". » Supprimer « étape x / 8 ».

13. **L1 l.151-155 (réception).** Remplacer par : « Le fichier de l'iPhone est déposé comme prise de la version (multipart existant) dans `entrees.prises`. Pas de `rushId` ni d'étape distribution propre au format. »
   - Ajouter : « Si la définition ou le codec reçus sont inférieurs à ceux attendus (photothèque recompressée par iOS), afficher : "Votre iPhone a réduit la vidéo : renvoyez-la depuis l'app Fichiers". »
   - Ajouter : écran maintenu allumé pendant l'envoi (Wake Lock), « Envoi en pause à 63 % — Reprendre » sur l'accueil, `TAILLE_MAX` portée à 15 Go pour facecam.

14. **L11 Architecture l.614-618 (agent monteur).** Remplacer par : « Pas d'agent avec outils. Un appel Claude reçoit la transcription horodatée, les consignes et le catalogue. Il renvoie un JSON validé (schéma Zod) : une liste d'`OperationMontage` étendue (`ajouterCarte{modele|html}`, `zoom`, `ecranPartage`, `miseEnPage{cote|vignette}`, `couleurs`, `son`, `masquerPersonne`, `texteDerriere`, `vitesse`, `arretImage`, `titre`, `generique`). Le moteur l'applique par `retoucher()`. Les images de contrôle sont relues en un appel, avec 1 correction au plus. La boucle de fond pilote le tout. »
   - Le vocabulaire reste ouvert : toute consigne inconnue devient `ajouterCarte{html}`.

15. **L11 (consignes dites à voix haute).** Écrire : « Seule une phrase qui commence par "Monteur" est une consigne ; pas d'impératif implicite. Les consignes sont repérées AVANT les coupes, y compris dans les passages jetés. Chaque passage de consigne devient une coupe de type `consigne`. Contrôle : aucune consigne audible dans la version finale. »
   - Supprimer « garder la consigne audible » de la v1.
   - l.540 : remplacer par « effets annoncés à voix haute : refusés PAR DÉFAUT, possibles via "Monteur, …" (L11). »

16. **Détourage, une seule règle (l.138, 292, 322, 448, 536, 572, 608-612).** Écrire partout : « Jamais par défaut, à la demande, sans demande de confirmation. »
   - « Cache-moi / fais-moi revenir » = fondu vers la plaque vide (3 s filmées au début). Sans plaque, on reconstruit une médiane des images où Will a bougé ; si c'est impossible, on le dit.
   - « Texte entre le mur et moi » (A14) = segmentation MediaPipe affinée par différence avec la plaque, calculée sur les seules secondes demandées.
   - Pas de RVM (GPL-3) ni de MatAnyone.
   - Bords ratés : on livre la variante sans détourage, avec « Effet non réussi — Réessayer ».

### Important

17. **L5 l.225-228 (écran Image).** Remplacer par : « Look Will de référence, réglé une fois au premier essai (lumière, teint, dents) puis appliqué à chaque vidéo par correspondance de couleur Lab sur la peau et le mur, calculée une fois par vidéo. Feuille facultative "Retoucher l'image" : avant/après glissé, 3 crans Moins / Juste / Plus, "Garder pour les prochaines vidéos". Pas de curseurs 0-100. »
   - Contrôles :
     - ΔE00 avec la référence inférieur à 4 sur la peau ;
     - teinte sur la ligne des tons chair (± 5°) ;
     - texture de la peau gardée à 60-80 % ;
     - luminance des dents inférieure au blanc des yeux, effet seulement bouche ouverte, fondu de 3 images ;
     - gains fixes pour toute la vidéo (pas de pompage).

18. **L4 l.199-203 (rythme et jump cuts).**
   - Équilibré = un changement toutes les 2 à 3 s, jamais plus de 6 s.
   - Chaque coupe de nettoyage change la taille du plan d'au moins 12 % (alternance 100 / 115 %). Un même cadre n'est toléré qu'une fois sur 4, et seulement si la tête bouge de moins de 3 %.
   - Seuil des silences : 0,25 s, avec 0,10 à 0,15 s de respiration (tranche l.526).

19. **Grammaire de montage (nouvelle constante du code, L4).** Elle s'impose aussi aux cartes sur mesure et à l'agent.
   - Coupe franche pour au moins 90 % des raccords.
   - Punch-in instantané.
   - Zoom flou : 2 au plus par vidéo.
   - Entrée de l'écran partagé en 8 à 10 images, avec une courbe unique.
   - Jamais de fondu sur le visage.
   - Zoom lent : 3 % par seconde au plus.

20. **L2 (son).** Ajouter : passe-haut à 80 Hz, présence à 3-5 kHz, dé-esseur, compression pour une plage de 4 LU au plus, DeepFilterNet mélangé à 85 %, fondu de 10 à 20 ms à CHAQUE coupe, ton de pièce continu. D11 : ajouter un micro-cravate sans fil (30-60 €).

21. **L6 (B-roll et cartes).**
   - B-roll accordés au Look Will (même LUT et même cible), 1,2 à 2,5 s. Refusés : filigrane, texte en anglais, regard caméra.
   - Charte motion = jetons du code imposés à tous les modèles (Poppins dans la vidéo ; l'interface du studio reste en Manrope).
   - Flou de mouvement sur les cartes.
   - La v1 compte 5 modèles (liste, chiffre, avant/après, ligne de temps, deux colonnes) plus `CarteSurMesure`. Le modèle 12 (titre plein écran) n'est jamais automatique, seulement à la demande.

22. **L6 (sous-titres).** Groupes de 1 à 4 mots coupés par sens, calés sur une coupe si elle tombe à moins de 0,2 s, horodatages pris dans l'aligneur. Dans l'écran partagé : sous-titre à la jonction, jamais sur la bouche.

23. **L4 (cadrage par calque).**
   - Moitié basse : yeux à 35-40 % de la demi-hauteur.
   - Côté : visage entre 35 et 45 % de la largeur.
   - Vignette : 28 à 35 % de la largeur, calculée sur la source 4K.
   - Image 0 : visage en pleine phrase, titre déjà affiché. Fin : 6 à 8 images après le dernier mot, avec un fondu audio de 50 ms.

24. **L7 (contrôles et pannes).**
   - Contrôles machine avant Claude : `blackdetect`, `freezedetect`, image isolée à une coupe, `ebur128`, synchro son-image, sous-titres alignés sur les coupes.
   - Relecture Claude ciblée : chaque coupe, chaque carte, chaque écran partagé, les 3 premières secondes, la dernière image.
   - Règle de panne : une brique ratée n'empêche jamais la livraison (« 1 élément non fait — Réessayer »).

25. **L7 (états et notifications).** Créer l'enum `EtatFacecam`, chaque état avec son libellé et le geste suivant :
   - envoi en cours ;
   - envoi coupé ;
   - fichier réduit par iOS ;
   - HDR ou Log ;
   - montage en 4 étapes parlantes ;
   - texte non retrouvé (bascule en vidéo libre) ;
   - visage introuvable ou image trop sombre ;
   - plafond atteint ;
   - effet raté ;
   - consigne non comprise ;
   - prête ;
   - publiée.

   Ajouter : « Prête vers 14 h 20 », notification pour une vidéo prête comme pour un échec (les notifications du téléphone sont allumées une fois), et les boutons « Arrêter » et « Revenir à la version d'avant » (`annulerTravail`, `parentVersionId`).

26. **« Mes demandes » l.551-556 et l.572-573.**
   - Champ facultatif « Une demande pour le monteur ? » avec le micro (`Dictee`), sur l'écran d'envoi.
   - Sur « Votre vidéo » : « J'ai compris 3 consignes », chacune avec Annuler.
   - « Une remarque ici » s'applique sans confirmation ; l'ancienne version reste visible pendant le recalcul.
   - Les règles « Appliquer aux prochaines » sont regroupées dans Réglages, sous « Mes habitudes ».
   - Bouton « Que puis-je demander ? » qui propose des exemples à toucher.

27. **Idée adoptée d'un créateur de référence.** « Vérifier mon cadre » n'est plus obligatoire : proposé au premier tournage seulement. Par défaut, le studio analyse automatiquement les 3 premières secondes de la vraie vidéo dès sa réception.

28. **L1 l.148-149 (statuts).** Le format reste `masque` pendant le chantier et passe directement en `actif` au déploiement. Selfie passe en `masque` (une ligne). Créateur B n'est pas touché.

29. **Garde-fous de non-régression (Architecture §3-4).** « Dans le code de l'avocat, uniquement des paramètres FACULTATIFS : absents, le comportement est celui d'aujourd'hui. »

30. **Décisions ouvertes l.497-509.** Remplacer par des valeurs prises par défaut :
   - D1 : une seule ouverture ;
   - D2 : oui ;
   - D3 : oui ;
   - D4 : caméra arrière ;
   - D5 : titre fixe pendant toute la vidéo (supprimer le doublon « D5 éclairage ») ;
   - D7 : aucune musique ;
   - D8 : plus tard ;
   - D9 : clés à créer par Will, avec repli sur Mes images et les captures du site ;
   - D10 et D12 : coupées ;
   - D11 : conseil seulement ;
   - D13 : activée.

### Mineur

31. **l.358.** « …comparée à un créateur de référence, un créateur de référence et un créateur de référence », au cours d'un seul essai réel montré à Will.

32. **P10 l.339.** « Option décor FLUX 3 ≈ 1 crédit/s, soit environ 4 à 10 € par vidéo de 90 s ; hors v1. »
   - L10 (après la v1) : tout ou rien par vidéo ; image de référence du décor obligatoire (Kling Omni Edit) ; passage APRÈS L5, sur le cadre déjà traité ; 24 i/s gardé sans changer la vitesse ; zooms limités à 110 % ; fournisseur `higgsfield` côté serveur avec sa clé ; solde vérifié avant de lancer.

33. **Fichiers liés.** `FICHE-STYLE` l.196 et l.248 marquées « abandonné (08/10) ». `FEUILLE-DE-ROUTE` l.59 renvoie vers ce plan.

34. **L5 (calcul).** Débruitage renforcé limité à la boîte du visage, sur la seule bande utile.

## C) PARCOURS UTILISATEUR CIBLE

1. **Générateur (téléphone).** Will lit son texte et touche « Valider le texte » (1 toucher). Il peut ajouter une annotation sur une phrase, mais ce n'est pas obligatoire.
2. **iPad (téléprompteur).** Le texte est déjà chargé. Un écran de départ montre 4 pictogrammes : iPhone à l'horizontale, 3 s sans vous, lampe à 45°, « Monteur, … ». Will touche « C'est parti » (1 toucher) et filme avec l'appareil photo de l'iPhone.
3. **iPhone, écran « Envoyer ma vidéo de : <titre> ».** Il ouvre la photothèque, choisit la dernière vidéo et l'envoi part (2 touchers). Une case facultative permet de dicter une demande au monteur.
   - Automatique : écran maintenu allumé, reprise de l'envoi, contrôle du fichier, analyse des 3 premières secondes avec alerte s'il y a un problème.
4. **Attente.** Le montage avance en 4 étapes parlantes (Le son, Les coupes, L'image, Les sous-titres et cartes), avec « Prête vers 14 h 20 » et « Vous pouvez fermer ».
   - Automatique : coupes, son, Look Will, cadrage, rythme, cartes, consignes « Monteur », écrans partagés, B-roll, contrôles et relecture, notification.
5. **« Votre vidéo ».** Le lecteur est en haut. En dessous : « 3 passages retirés, 2:11 devient 1:34 », puis « J'ai compris 3 consignes » avec Annuler. Will touche « Valider et publier » puis confirme la programmation Buffer déjà réglée (2 touchers).
   - En option seulement, en feuilles du bas : Coupes (Rétablir), Retoucher l'image (3 crans), Cartes, Sous-titres, Une remarque ici, Revenir à la version d'avant.

Au total, environ 7 touchers. Le premier usage ajoute seulement la validation du Look Will, une fois.

## D) MODE D'EXÉCUTION AUTOPILOT

### Branches

- Une seule branche longue `feat/facecam` sur studio-axion-ia, créée depuis `origin/master`.
- Les sous-branches des sessions y sont fusionnées sans revue.
- Rebasage sur master une fois par jour.
- Une seule PR vers master, à la fin.

### Lots

| Lot | Contenu | Qui | Durée |
|---|---|---|---|
| A. Fondations | format facecam (masque), Selfie masqué, moteur inscrit, `sansPrix` et `estimer` = 0, `TAILLE_MAX` à 15 Go, `entrees.facecam` (clés R2), squelette des 5 routes de studio-aligneur et client TS, double de simulation, enum `EtatFacecam`. Tous les fichiers communs sont touchés en une seule fois. Plus 1 h de vérification sur le serveur (`COMPOSE_PROFILES`, `docker stats`), à faible priorité. | session 1 | 1 j |
| B. Chaîne vidéo | transcription, consignes « Monteur », coupes (F0), son complet, visages, réalisation et rythme, grammaire, passe image 10 bits avec Look Will, contrôles machine | session 1 | 2,5 j |
| C. Habillage | 5 cartes plus CarteSurMesure, jetons de la charte, écran partagé par passages, `sourcePreCadree`, `source10bits`, sous-titres, B-roll accordés, cadrage par calque | session 2, en parallèle de B dès que A est fusionné | 2 j |
| D. Parcours et agent | envoi iPhone et états, notifications, « Votre vidéo » et ses feuilles, agent monteur JSON, remarque à l'instant, relecture Claude, plafond en version simple, cache-moi et texte derrière | session 2 après C (ou la première session libre) | 1,5 à 2 j |
| E. Fin | rebasage, suite complète, PR, déploiement, essai réel, passage en actif | contrôleur local | ½ j |

### Où le travail tourne

- Le code, les tests et les essais d'image sur des extraits de 15 s se font en sessions CLOUD : 2 sessions de développement au plus.
- Une seule session locale légère sert de contrôleur (coordination, rebasage, déploiement). Rien de lourd sur le PC ; le verrou `verrou-lourd.txt` est respecté.

### Tests gardés (liste courte)

1. `testerMoteurVideo` avec facecam ajouté.
2. Les tests de l'avocat existants (composition, découpage, nettoyage, report), en non-régression.
3. La concordance des contrats studio-rendu, inchangés.
4. Les coupes sur le cas F0.
5. « L'original n'est jamais modifié ».
6. « Plafond atteint : aucun appel Claude et la vidéo sort ».
7. La suite Vitest complète et `npm run verifier`, une seule fois, en cloud, avant la PR.

Il n'y a aucune relecture humaine.

### Déploiement unique

1. ListAgents, puis SendMessage à la session studio. Vérifier qu'aucun rendu ni montage n'est en cours et obtenir son accord sur un créneau.
2. Choisir un créneau à plus de 30 min de 12 h 07, 17 h 07 et 22 h 07.
3. Fusionner la PR.
4. Lancer `bash /opt/studio-axion-ia/source/deploiement/mettre-a-jour.sh`, qui fait la sauvegarde, le tag `precedente` et les contrôles de santé.
5. En cas d'échec : `revenir.sh`.
6. Monter IMG_7747 de bout en bout, valider le Look Will avec Will, puis passer le format en actif.

### Règles avec les autres sessions

- Coordination à 3 moments seulement : au départ (annonce de la branche et de la liste des fichiers communs touchés), au rebasage quotidien et avant le déploiement.
- Jamais de redémarrage d'un conteneur studio en dehors du déploiement annoncé.
- Aucun fichier du site axion-ia n'est touché.

### Durée

Environ 7 jours de travail, soit 4 à 5 jours au calendrier.

## E) À SUPPRIMER DU PLAN

**Démarrage et validations**
- La règle « aucun code avant les réponses de Will ».
- L0 (validation des maquettes) et L0b (mesures, licences, Apple Log).
- La validation de chaque modèle de carte en vidéo de 5 s, celle de chaque effet L11b, et la condition « 3 exemples » pour la carte sur mesure.
- Le banc d'essai sur 3 vidéos et le statut « bientôt » : un seul essai réel, montré à Will.

**PR et mises en ligne**
- « Une PR par lot », les mises en ligne aux heures fixes et le message avant chaque PR.

**Architecture**
- Le conteneur `studio-vision` et ses 5 fichiers de déploiement.
- Les opérations `preparer-rush`, `image-masques`, `assemblage-facecam` et `motion-design`, ainsi que la file `video`.
- Les types de Bibliothèque `motion` et `plan` et leur migration.
- Le bouton « Garder ce modèle ».
- MD-0 (HyperFrames contre Remotion) et HyperFrames en v1.
- RVM, MatAnyone et le comparatif de détourage.
- Le double branchement `MOTEUR_PRISES_FILMEES` plus l'interrupteur `jeLis`.

**Parcours et écrans**
- Les 8 étapes, les clés `coupes` et `image` dans CLES_ETAPES, et « étape x / 8 ».
- Les curseurs de 0 à 100 et les boutons de format.
- Les devis, prix, accords de coût et blocs Coût.
- L'étape obligatoire « Vérifier mon cadre ».

**Reporté après la livraison**
- L'import Google Drive.
- L'option « 2 prises » et l'alternance d'angle.
- Les ratios 4:5, 1:1 et 16:9, avec l'écran partagé 45/55.
- Les modèles 6 à 13.
- L'option « garder la consigne audible ».
- L8, L9, L10 (Higgsfield) et L11b (main 3D, vitre qui se brise).

**Tests**
- Playwright, les tests Python et les familles Vitest autres que les 7 tests gardés.

**Veille**
- L'inscription dans la page Veille et la vérification des versions à chaque lot.
## ⭐ CORRECTIF 09/10 (Will) — Motion design : qualité EXTRÊME et CENTRALISÉ pour tous les formats (PRIME sur B.10, B.21 et E)

**1. Centralisé : une brique commune, comme les sous-titres.**
- Nouvelle brique **`src/briques/motion/`** : catalogue, schémas des données de chaque modèle, choix automatique d'un modèle d'après une phrase, jetons de charte.
- Ses compositions vivent dans **`studio-rendu/compositions/commune/motion/`**, rendues par l'opération `composition` existante.
- **Tout format peut s'en servir** : facecam, avocat (paramètre facultatif ; sans lui, l'avocat ne change pas), podcast, écran partagé, motion design sans visage, et tout format futur. Un modèle ajouté est disponible partout.
- **« Garder ce modèle » est RÉTABLI** :
  - une carte sur mesure réussie s'enregistre dans la bibliothèque commune ;
  - son code HTML / CSS / GSAP est stocké sur R2, avec un petit index de quelques Ko dans les données, pour ne pas alourdir la table chargée en mémoire ;
  - elle devient réutilisable dans toutes les vidéos et tous les formats.
- Écran « Mes animations » dans la Bibliothèque du studio : voir, renommer, retirer.

**2. Qualité extrême : barre de niveau « studio de motion design ».**
- **Système de design motion** commun (jetons) :
  - charte Axion (sombre chaud, orange, crème) ; Poppins dans la vidéo ;
  - grille et marges ; hiérarchie typographique en 4 tailles ;
  - **courbes d'animation signature** (ressorts, ease-out expo) et durées types (entrée 300-500 ms, sortie 200-300 ms) ;
  - décalage entre éléments de 60-90 ms.
- **Principes obligatoires dans chaque modèle** :
  - anticipation et chute ;
  - mouvement secondaire (fond qui vit, particules ou lumière discrète) ;
  - **flou de mouvement** ;
  - profondeur (légère parallaxe ou 3D) ;
  - typographie cinétique (mots qui se construisent) ;
  - icônes vectorielles animées (traits qui se dessinent) ;
  - chiffres qui comptent ;
  - aucun élément figé plus de 1,5 s ;
  - **25 i/s** (cadence du studio) ;
  - rendu vectoriel net.
- **3D autorisée** dans les modèles et les cartes sur mesure (Three.js en WebGL logiciel, dans l'iframe GSAP, temps de rendu mesuré).
- **Références de niveau** :
  - explications façon Vox ;
  - lancements façon Apple ;
  - gros titres orange façon un créateur de référence (fiche de style) ;
  - modèle Kurzgesagt pour la fluidité ;
  - « proche, sans copier ».
- **Contrôle qualité automatique** de chaque carte avant usage :
  - image de contrôle relue par Claude (lisibilité, débordement, équilibre, visage jamais caché) ;
  - texte d'au moins 3 % de la hauteur ;
  - zones sûres.
- **Validation par Will RÉTABLIE pour les modèles de base** (qualité avant vitesse) :
  - chaque modèle du catalogue lui est montré en **vidéo de 5 s** (planche de toutes les cartes animées en une seule page) avant son activation ;
  - les cartes sur mesure, elles, passent seulement le contrôle automatique.
- **V1 : 6 modèles d'excellence** :
  1. liste ;
  2. chiffre qui compte ;
  3. avant / après ;
  4. ligne de temps ou feuille de route qui avance avec la parole ;
  5. comparaison deux colonnes avec la zone commune ;
  6. titre ou générique.

  Puis `CarteSurMesure` pour tout le reste. Mieux vaut 6 modèles parfaits que 12 moyens. Les modèles 7 à 13 suivent après.

**Lot C mis à jour** :
- la brique `motion` commune est construite EN PREMIER du lot C ;
- planche de validation des 6 modèles présentée à Will avant d'aller plus loin ;
- branchement facultatif de l'avocat sur la brique.

## ⭐ PRÉCISION 09/10 (Will) — Les animations se créent AUSSI à la demande, en discutant avec Claude
La bibliothèque n'est qu'un **point de départ**. Les animations se créent de **trois façons**, toutes reliées à la brique commune `motion` :
1. **Automatiquement** : en lisant le texte, Claude repère ce qui mérite une animation (liste, chiffre, comparaison, processus…) et utilise un modèle, ou en **crée une sur mesure**.
2. **À la demande** : par la consigne « Monteur, … » dite pendant le tournage, ou par la case « Vos demandes ».
3. **En discutant** : sur « Votre vidéo », un panneau **« Discuter avec mon monteur »** (un vrai fil de discussion, au clavier ou au micro).
   - Will écrit, par exemple : « à 0:32 fais une animation qui montre les 3 étapes en escalier, plus dynamique, en orange ».
   - Claude **génère l'animation sur mesure** (HTML / CSS / GSAP, 3D possible), contrôle son image, la pose au bon mot, et répond en une phrase avec un aperçu.
   - Will peut enchaîner : « plus lent », « enlève l'icône », « garde ce modèle ».
   - Chaque échange crée une **nouvelle version**, et l'ancienne reste accessible.

Le fil de discussion remplace et regroupe « Une remarque ici » et « Vos demandes » sur l'écran « Votre vidéo » (lot D). Il s'appuie sur le même appel Claude que l'agent monteur (JSON d'opérations + `ajouterCarte{html}`), avec l'historique de la conversation.

## ⭐ DÉCISION 09/10 (Will, après la planche) — Style validé + un style « Spectaculaire » au choix
- **Planche des 6 modèles VALIDÉE** (« c'est bien, ça me va »). Corrections à faire :
  1. **mode plein écran** : contenu recentré et agrandi, sans grand vide en bas ; le placement en haut reste pour la moitié haute de l'écran partagé ;
  2. **textes des listes plus grands** (≥ 4 % de la hauteur en plein écran) ;
  3. données d'exemple de la planche en lien avec Axion (la « fuite » = du **temps perdu** pour un dirigeant, pas une fuite d'eau).
- **Deux styles dans la brique commune `motion`, mêmes modèles, mêmes données** :
  - **« Sobre »** = le style validé, par défaut ;
  - **« Spectaculaire »** = même charte, plus d'impact :
    - vraie profondeur 3D (Three.js : cartes en perspective, légère rotation de caméra, parallaxe en couches) ;
    - balayages de lumière et halos sur les mots clés, particules et poussières lumineuses ;
    - typographie cinétique géante (mots qui s'écrasent, s'étirent, rebondissent) ;
    - transitions d'entrée et de sortie plus fortes (zoom à travers, masque qui se déchire, éclat), flou de mouvement marqué ;
    - chiffres qui explosent en éclats à l'arrivée ;
    - bruitages synchronisés facultatifs ;
    - toujours lisible, jamais plus de 1 effet fort à la fois.
- **Choix du style** : automatique selon l'intensité (Sobre et Équilibré → « Sobre » ; Très dynamique → « Spectaculaire »), ou à la demande (« Monteur, fais ça en spectaculaire », fil de discussion, « Mes habitudes »). Réglable par vidéo, par carte, ou « pour les prochaines ».
- Les cartes sur mesure (`CarteSurMesure`) reçoivent aussi le style demandé dans leur consigne.
- **Planche « Spectaculaire »** des 6 modèles, à montrer à Will en vidéo de 5 s, comme la première.
