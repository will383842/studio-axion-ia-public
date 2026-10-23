# Analyse de la 2ᵉ vidéo de référence LinkedIn (un créateur de référence) : « l'équipe d'agents IA »

*16/10/2026, par le directeur artistique motion design. Lecture seule : aucun code, aucun livrable v3 n'a été modifié.*

**Source** : `reference/nouvelles-2026-10-16/reference-video-locale.mp4`, 79,16 s, 720 × 1280, 30 i/s, son stéréo 44,1 kHz.
**Planches** (gardées) : `reference/nouvelles-2026-10-16/analyse-linkedin/`
- `planche-01.jpg` à `planche-14.jpg` : 4 i/s, 6 s par planche, temps écrit sur chaque vignette ;
- `zoom-coupes-30ips.jpg` et `zoom-entrees-30ips.jpg` : 30 i/s autour des sorties, entrées et coupes ;
- `echelle-visage.jpg` : 32 instants avec une grille de 10 %, pour suivre le cadrage de la prise ;
- `zoom-typo.jpg` : sous-titres et étiquettes à la taille réelle ;
- `spectre-*.png` : spectrogrammes du son ;
- `v3-selection-1ips.jpg` : la sélection v3 de Will, pour comparer.

**Étiquettes** : **[MESURÉ]** veut dire vu sur les images ou mesuré par ffmpeg. **[SUPPOSÉ]** veut dire déduit, non vérifié.

---

## 0. Ce qui est NOUVEAU par rapport à la 1ʳᵉ vidéo (« 6 outils », `ANALYSE-VIDEO-REFERENCE.md`)

| # | 1ʳᵉ vidéo (6 outils) | Cette vidéo (équipe d'agents) | Conséquence pour Will |
|---|---|---|---|
| 1 | Liste numérotée « OUTIL n/6 » avec les logos des outils | **Un produit fictif qui sert de fil rouge** (« BUSINESS OS ») : une même interface revient **3 fois**, la carte « COMMANDE » (18 s, 28,5 s, 42 s) | Un **composant récurrent** crée la série dans la vidéo. Le spectateur reconnaît la carte et anticipe : il lit plus vite. |
| 2 | Pas de personnages | **12 personnages** (photo ronde + prénom + métier) : badges « AGENT n/12 » au-dessus de la tête, grille, réseau, étoiles | L'idée abstraite (« des agents IA ») devient **des gens**. C'est très efficace, mais ce sont visiblement des **visages générés** [SUPPOSÉ]. |
| 3 | 9 B-roll de stock | **Seulement 3 B-roll de stock** (open space 38 s, clavier 56,7 s, homme aux écouteurs 70,8 s). À la place, **3 preuves produit** : un vrai carrousel feuilleté (23,8-27,4 s), une vraie page web qui défile (33,8-36,4 s), une vraie vidéo générée (46-48,7 s) | **La preuve remplace l'ambiance.** C'est plus fort que le stock, et c'est faisable chez Will (captures de ses vrais outils). |
| 4 | Étiquettes cyan ou blanches | **Nouvelle étiquette « interjection »** : plaque **encre**, texte **cyan**, avec un point final (« REGARDEZ. », « ATTENTION. »). Plus des étiquettes de **relance** cyan (« ET PLUS LOIN. », « TOUT SEULS. ») | Ces étiquettes **découpent la vidéo en chapitres** sans carte de titre. |
| 5 | Compteur de chiffre d'affaires | **Beaucoup de compteurs** : 6 → 9 → 12 agents, chrono 0:46 → 2:00, montage 12 → 96 %, 5 étoiles qui se remplissent, mois 1 → 4 | Un **chiffre qui bouge** fait un événement toutes les 0,25 s sans rien ajouter à l'écran. |
| 6 | Chat qui se tape | **Ligne de commande** : menu déroulant d'autocomplétion, saisie lettre par lettre, puis envoi | C'est le geste « je pilote un logiciel ». |
| 7 | CTA = une étiquette + une carte de fin | **CTA en pile** : « COMMENTEZ « SYSTÈME » », puis **3 bénéfices cochés** qui s'empilent dessous (74,8 s, 75,5 s, 77,5 s), plus une flèche ronde en bas à droite | La fin reste animée pendant **4 s** au lieu d'être figée. |
| 8 | Son non analysé | **Son analysé** : pas de musique, et des **carillons** aux moments de réussite (§ B.6) | Cela confirme le choix de Will : pas de musique, des bruitages. |
| 9 | Structure en liste (6 × 8 s) | **Structure en démonstration** : promesse → interface → 3 commandes en direct → mise en garde (« ATTENTION. ») → méthode → mémoire → CTA | Le gabarit « liste » n'est pas obligatoire. Le même vocabulaire visuel tient sur une **démonstration**. |
| 10 | Carte de fin : apparition sèche | Carte de fin : **panneau crème qui monte du bas** en 4-5 images et pousse la prise, puis un contenu en cascade | — |

**Ce qui ne change pas** (et fait donc le « style du créateur de référence ») : les 4 couleurs (cyan, encre, crème, blanc), les contours encre et l'**ombre dure**, la **descente de la prise sous la carte**, les sous-titres mot à mot avec plaques cyan, la barre de progression en haut, et le contenu des cartes qui se construit **au mot près**.

---

## (a) Chronologie seconde par seconde

Présentateur : un seul plan fixe, buste, tee-shirt noir, micro-cravate DJI visible, mur beige-rosé. « Carte » veut dire **mode carte** : la prise descend d'environ 0,30 H (les yeux passent de 0,31 H à environ 0,62 H) et une bande crème occupe le haut [MESURÉ, planches 01-02]. Les sous-titres sont listés en partie seulement (citations courtes).

| t (s) | Présentateur | Animation | Texte à l'écran | Effet / remarque |
|---|---|---|---|---|
| 0,0-1,2 | Plein cadre | **Étiquette double** au-dessus de la tête : petite plaque encre « CLAUDE M'A CRÉÉ » + plaque cyan « UNE ÉQUIPE D'AGENTS IA », inclinée d'environ -3° | ST : « CLAUDE », « M'A », « UNE ÉQUIPE »… | Pop de 0,09 à 0,29 s (≈ 6 i) avec un léger dépassement [MESURÉ 30 i/s]. **Promesse écrite dès l'image 3.** |
| 1,25-3,4 | Plein cadre, mains actives | **Rangée de 7 portraits ronds** (cascade de 0,25 s), légende « QUI GÈRE MON BUSINESS » en dessous | « GÈRE », « BUSINESS », « VOUS MONTRE », « RESSEMBLE » | Sortie en 2-3 i (3,42-3,49 s) |
| 3,5-3,75 | **Descend** (≈ 4 i) | Carte qui tombe du haut, inclinée, puis se pose (≈ 5 i) | « VOICI » | Bande crème en haut |
| 3,75-6,25 | Carte | Carte « BUSINESS OS · MON ÉQUIPE », pastille « 12 ACTIFS » ; **des mini-fiches d'agents tombent en pile** (3, puis 5, puis 8, puis 12) | « INTERFACE », « CLAUDE GÈRE », « TOUS MES AGENTS » | 1 fiche toutes les ≈ 0,25 s |
| 6,25-7,5 | Carte | La pile **se range en grille 4 × 3** en 0,25 s, puis les métiers s'écrivent sous les prénoms | « ILS SONT RANGÉS », « ET CHACUN A » | Désordre → ordre, sur le mot « rangés » |
| 7,5-7,9 | Carte | Étiquette « UN VRAI MÉTIER » qui se pose **sur** la grille | « UN VRAI MÉTIER » | Superposition |
| 7,92-8,1 | **Remonte, plus serré** | La carte part vers le haut en 4-5 i | — | **Recadrage serré** au retour de la prise (§ b) |
| 8,25-14,5 | Plein cadre | **6 badges successifs** au-dessus de la tête : « AGENT 1/12 Claire », puis Hugo, Léo, Inès, Sarah, Paul. Photo ronde + prénom ; le **métier** s'ajoute 0,25 s plus tard dans une pastille cyan | « RESPONSABLE MARKETING », « RÉDACTEUR », « GRAPHISTE », « WEBDESIGNER », « COMMERCIALE », « L'ANALYSTE » | Un badge par seconde. Entrée par glissement latéral, sortie en fondu-réduction ≈ 4 i |
| 14,75-17,0 | Carte | Carte « MON ÉQUIPE » : les portraits se remplissent ; **compteur 6 → 9 → 12** « AGENTS IA » ; étiquette « GÈRENT MON BUSINESS » | « C'EST UNE PARTIE DES 12 », « AGENTS QUI GÈRENT » | Compteur calé sur le chiffre dit |
| 17,0-17,9 | **Remonte, plus serré** | Étiquette **interjection** : plaque encre, « REGARDEZ. » en cyan | « MAINTENANT », « REGARDEZ » | Carte sortie en 3 i |
| 18,0-21,0 | Carte | Carte « CLAUDE · BUSINESS OS / COMMANDE » : 4 boutons (/carrousel, /site-web, /video, /newsletter) ; étiquette « UNE SEULE COMMANDE » ; menu déroulant ; saisie lettre par lettre | « JE TAPE UNE SEULE COMMANDE », « PAR EXEMPLE », « CARROUSEL », « AVEC MON IDÉE » | Le texte tapé suit la voix |
| 21,25-23,6 | Carte | Carte « L'ÉQUIPE AU TRAVAIL / CARROUSEL » : 3 lignes (Claire, Hugo, Léo) qui **s'allument tour à tour** ; mini-vignettes du carrousel | « CLAIRE CHOISIT L'ANGLE », « HUGO ÉCRIT », « LÉO MET EN PAGE » | Statut « en cours » → « fait » |
| 23,66-23,9 | Remonte | La carte part en 3 i ; **une publication LinkedIn arrive de la droite** en 3-4 i | — | Enchaînement sans temps mort |
| 23,9-27,4 | **Couvert** | **Vrai carrousel feuilleté** : ≈ 11 pages en 3,5 s (≈ 3 pages/s) ; étiquettes « CARROUSEL ENTIER », « À MA CHARTE », « PRÊT À PUBLIER » | « CARROUSEL ENTIER AVEC MA CHARTE », « PRÊT À RELIRE ET À PUBLIER » | Preuve produit. Sortie vers la gauche en 4 i |
| 27,5-28,4 | Plein cadre | Étiquette de relance « ET PLUS LOIN. » | « ET JE VAIS PLUS LOIN » | — |
| 28,5-29,5 | Carte | Carte commande n° 2 : saisie « /site-web », envoi, bulle de message | « JE TAPE SITE WEB » | Même carte qu'à 18 s : **motif récurrent** |
| 29,75-33,4 | Carte | Carte « VOTRE SITE · CONSTRUCTION… » : maquette fil de fer ; l'avatar d'Hugo (« ÉCRIT ») puis celui d'Inès (« MET EN PAGE ») ; les blocs se remplissent en encre et cyan | « AUTOMATIQUEMENT », « HUGO ÉCRIT », « TEXTES », « INÈS », « EN PAGE AVEC MES COULEURS » | Les couleurs arrivent sur « couleurs » |
| 33,5-36,4 | **Couvert** | **Vraie page web** dans une fenêtre de navigateur (« FAIT PAR HUGO + INÈS »), qui **défile** ; étiquettes « 1 HEURE » (avec horloge) et « RIEN À FAIRE » (encre) ; encart « DÉMO BUSINESS OS » | « ÇA PREND UNE HEURE », « RIEN À FAIRE », « ILS FONT » | Preuve produit |
| 36,5-37,9 | Plein cadre | Étiquette « TOUT SEULS. » | « TOUT SEULS », « PAS BESOIN D'ALLER » | — |
| 38,0-39,4 | **Couvert** | **B-roll de stock** : open space, étiquette blanche « UNE AGENCE » ; étiquette « 2 000 € » qui se fait **barrer** | « PAYER UNE AGENCE », « 2 000 EUROS » | — |
| 39,5-41,8 | Carte | Carte « AGENCE VS MES AGENTS » : à gauche, « MOIS 1 → MOIS 4 » s'empilent ; à droite, « MES AGENTS 1 H » s'allume | « TRAVAIL PENDANT DES MOIS » | Comparaison qui se construit |
| 42,0-43,9 | Carte | Carte commande n° 3 : étiquette « DERNIÈRE COMMANDE », saisie « /video », réponse « Jade s'en occupe » | « ET UNE DERNIÈRE COMMANDE », « JE TAPE VIDÉO » | 3ᵉ retour du motif |
| 44,0-44,9 | Plein cadre | Badge « Jade · RÉALISATRICE VIDÉO » | « ET JADE MA RÉALISATRICE » | — |
| 45,0-45,9 | Carte | Carte « MONTAGE · JADE » : pistes vidéo, texte et musique, tête de lecture ; **12 → 38 → 69 → 96 %** en 0,75 s | « VIDÉO », « ME SORT » | Compteur rapide |
| 46,0-48,7 | **Couvert** | **Vraie vidéo générée**, dans un cadre de téléphone encre (« MONTÉ PAR JADE ») : typo cinétique vert citron, cubes 3D, avatar, étiquettes « SANS ME FILMER », « SANS SAVOIR MONTER », « OPUS 5.5 » | « MA VIDÉO SANS ME FILMER », « MA VOIX », « SANS SAVOIR MONTER » | Seule couleur hors charte (vert citron `#CBFB3E`), mais **dans** la preuve. Sortie à gauche en 4 i |
| 48,75-49,7 | Plein cadre (serré ?) | Interjection « ATTENTION. » (encre / cyan) | « MAIS ATTENTION » | **Bascule du récit** |
| 49,75-53,0 | Plein cadre | Badge « AGENT BASIQUE » (silhouette grise) + **chrono 0:46 → 1:33 → 2:00** ; il se transforme en « AGENT EXPERT » (photo) ; **5 étoiles** se remplissent | « CRÉER UN AGENT », « ÇA PREND DEUX MINUTES », « EXPERT » | Avant / après dans le même badge |
| 53,25-56,5 | Carte | Carte « 2 MINUTES VS EXPERT » : 2 colonnes ; signe **≠** dans un rond encre ; les 3 coches de droite s'allument | « CRÉER EN DEUX MINUTES », « NE TRAVAILLERA JAMAIS COMME UN » | — |
| 56,6-58,5 | **Couvert** | **B-roll de stock** : mains sur un clavier ; étiquette « TOUTES MES MÉTHODES » | « J'AI APPRIS TOUTES MES MÉTHODES » | — |
| 58,75-60,0 | Carte | Carte « MES MÉTHODES · 6 AGENTS » : nœud central, 6 avatars autour, pointillés qui se tracent, coches | « TRAVAIL À CHACUN DE MES AGENTS » | Schéma en réseau |
| 60,0-61,2 | Plein cadre | Badge « Hugo · LE RÉDACTEUR » | « HUGO PAR EXEMPLE », « IL VA ÉCRIRE » | — |
| 61,25-64,2 | Carte | Carte « HUGO ÉCRIT EN 4 TEMPS » : 4 tuiles (COMPRENDRE, CONSTRUIRE, CISELER, CONTRÔLER) qui **s'allument en cyan au mot près** | Les 4 verbes, un par un | 1 tuile toutes les ≈ 0,75 s |
| 64,5-68,7 | Carte | Carte « MÉMOIRE DES AGENTS » : 4 cases cochées tour à tour (Positionnement, Client idéal, Offres, Façon d'écrire) ; pastille « EN MÉMOIRE » | « ILS GARDENT EN MÉMOIRE », « VOTRE POSITIONNEMENT »… | — |
| 69,0-70,5 | Plein cadre | Étiquette double « ILS NE REPARTENT / JAMAIS DE ZÉRO. » | « REPARTENT JAMAIS DE ZÉRO » | — |
| 70,8-72,0 | **Couvert** | **B-roll de stock** coupé **en 1 image** (sans transition) ; étiquette « ADAPTÉS À VOTRE BUSINESS » | « ADAPTÉS À VOTRE BUSINESS » | — |
| 72,0-73,9 | Carte | Carte « COMMENTAIRES » : « SYSTÈME » tapé, publié, puis une notification encre « Nouveau message : le webinaire complet » | « COMMENTEZ SYSTÈME », « VOUS ENVOIE », « WEBINAIRE » | Simulation du parcours du spectateur |
| 74,25-78,1 | Plein cadre | **CTA en pile** : « COMMENTEZ « SYSTÈME » », puis 3 lignes cochées (« LE WEBINAIRE COMPLET », « VOTRE ÉQUIPE D'AGENTS IA », « AVEC CLAUDE ») ; flèche ronde cyan en bas à droite | ST jusqu'à « AVEC CLAUDE » | 1 ligne par bénéfice dit |
| 78,16-79,16 | Remplacé | **Carte de fin** : panneau crème qui monte du bas en 4-5 i ; cascade : bouton cyan, pseudo, logo « Marque-Réf. », 7 portraits | « COMMENTEZ « SYSTÈME » » | ≈ 1 s seulement |

**Barre de progression** : présente du début à la fin, en haut (≈ 5 px sur 1 280, soit 0,4 % H). Segment cyan plein, le reste en encre [MESURÉ].

---

## (b) La rapidité, en chiffres

### b.1 Densité des événements

| Mesure | Valeur | Statut |
|---|---|---|
| **Événements graphiques** (entrée, étape de contenu, sortie ; sous-titres non compris), comptés sur les planches à 4 i/s | **≈ 204 en 79 s, soit ≈ 2,6 par seconde, un toutes les ≈ 0,39 s** | MESURÉ (comptage manuel, ±10 %) |
| **Changements de sous-titre** | ≈ 3 par seconde (19 changements sur les 24 vignettes de 0 à 6 s) | MESURÉ sur échantillon |
| **Changements de « bloc »** (mise en page qui change : carte, prise couverte, prise seule, fin) | **29 blocs**, un nouveau toutes les **≈ 2,7 s** | MESURÉ |
| **Plus long moment avec la prise et les sous-titres SEULS** | **≈ 0,5 s** (8,0 s ; 14,5 s ; 27,4 s ; 37,8 s ; 53,0 s ; 68,8 s ; 70,6 s…). En pratique, il y a **presque toujours** un objet au-dessus de la tête. | MESURÉ |
| Détection de scène ffmpeg (score par image) | 1,9 changement/s au seuil 0,04 ; 0,76/s au seuil 0,08 ; 0,45/s au seuil 0,10 ; 0 au-dessus de 0,30. Écart médian de 0,27 s au seuil 0,04. | MESURÉ. **Peu fiable ici** : les éléments sont petits face au plein cadre, d'où des scores faibles. **Le comptage manuel fait foi.** |
| Débit de parole | ≈ 3,3 à 5 mots/s selon les passages (10 mots entre 0 et 2 s ; 14 mots entre 60 et 64,25 s), soit ≈ 200 à 260 mots/min | Estimé d'après les sous-titres. **Il est possible que la voix soit accélérée** [SUPPOSÉ]. |
| Silences | **Aucun silence de plus de 0,12 s** sous -40 dB sur toute la durée | MESURÉ (silencedetect). Les pauses ont été coupées au montage [SUPPOSÉ]. |

### b.2 Répartition du temps (sur 79 s)

| Mise en page | Durée | Part |
|---|---|---|
| **Mode carte** (prise descendue, carte en haut) | ≈ 36 s | **≈ 46 %** |
| **Prise plein cadre + objet au-dessus de la tête** (étiquette, badge, rangée) | ≈ 28 s | ≈ 36 % |
| **Visage couvert** (carrousel, page web, vidéo, 3 B-roll) | ≈ 13,5 s en 6 passages | ≈ 17 % |
| Carte de fin | ≈ 1 s | ≈ 1 % |

Le visage n'est **jamais couvert avant 23,7 s** [MESURÉ]. C'est compatible avec la règle de Will (rien sur le visage avant 5 s).

### b.3 Vitesse des entrées et sorties, comptées en images à 30 i/s [MESURÉ, `zoom-*-30ips.jpg`]

| Geste | Durée |
|---|---|
| Pop d'étiquette (petit → taille finale, léger dépassement) | **5-6 images** (0,09 → 0,29 s) |
| Mot de sous-titre qui « grossit » en apparaissant | ≈ 4 images |
| Descente de la prise en mode carte | ≈ 4 images |
| Chute de la carte depuis le haut | ≈ 5 images |
| **Sortie de carte vers le haut** | **3 à 5 images** |
| Sortie d'une fenêtre (carrousel, téléphone) vers la gauche | **4 images** |
| Entrée d'une fenêtre par la droite | 3-4 images |
| Sortie d'un badge (fondu et réduction) | ≈ 4 images |
| B-roll de 70,8 s | **coupe franche en 1 image** |
| Panneau de fin qui monte du bas | 4-5 images |

**Règle qui ressort** : les entrées durent **≤ 6 images**, les sorties **≤ 5 images**. Rien ne « flotte ». Tout ce qui sort part **plus vite** que ce qui entre.

### b.4 Durée d'affichage

- **Étiquettes au-dessus de la tête** : 0,9 à 1,5 s (« REGARDEZ. » 0,7 s ; « ATTENTION. » ≈ 1 s ; « TOUT SEULS. » ≈ 1,4 s). Le CTA, lui, reste 3,9 s mais grossit en continu.
- **Badges d'agent** : ≈ 1 s chacun (6 badges en 6,25 s).
- **Cartes** : de 1 s (« MONTAGE ») à 5,5 s (« COMMANDE » puis « ÉQUIPE AU TRAVAIL »). Une carte reste **rarement plus de 0,5 s sans qu'une de ses lignes bouge**.
- **Fenêtres sur le visage** : 1,2 à 3,6 s.

### b.5 Coupes et zooms sur le présentateur — point sensible pour Will

- **Coupes franches de la prise** : aucune visible. Le plan reste continu à l'œil [MESURÉ]. L'absence de silences suggère des coupes de pauses, masquées par les éléments [SUPPOSÉ].
- **Zoom : OUI, il y en a.** Ce sont des **recadrages serrés par palier**, sans zoom progressif : au **retour de la prise après une carte**, elle revient **plus grosse** (la ligne des yeux passe d'environ 0,31 H à 0,34-0,36 H, et le visage paraît ≈ 10 à 20 % plus gros) à **8,1 s** et à **17,2 s**, et probablement à 48,8 s. L'amplitude est **estimée sur grille** (±5 %), pas mesurée au pixel [MESURÉ pour l'existence, SUPPOSÉ pour l'amplitude]. La 1ʳᵉ vidéo faisait la même chose (12,1-12,4 s, § B.1 du standard v3).
- **D'où vient l'énergie sans zoom ?** Pour au moins 90 %, des éléments eux-mêmes : (1) un objet **au-dessus de la tête presque en permanence** ; (2) la **descente et la remontée de la prise**, permises chez Will ; (3) les **compteurs et coches** qui bougent toutes les 0,25 s ; (4) des **sorties en 3-5 images** ; (5) des **mains très mobiles** chez le présentateur (geste à chaque phrase). **Le zoom n'est donc pas nécessaire** : il ne sert ici qu'à « relancer » la prise après une carte. Chez Will, on peut le remplacer par la remontée de la prise avec un léger rebond (sans changer d'échelle), ce que le standard autorise déjà.

---

## (c) Typographie des sous-titres et des étiquettes [MESURÉ sur `zoom-typo.jpg`, ±10 %]

| Élément | Mesure |
|---|---|
| **Police** | Sans-serif géométrique **Black / Heavy**, en capitales, avec une chasse large et des « R », « S » et « G » ronds. Elle est **très proche de Montserrat Black** [SUPPOSÉ : forme identique à l'œil, sans fichier de police]. **Bonne nouvelle** : Will utilise déjà Montserrat (ExtraBold). Passer en **Black (900)** suffit pour s'en rapprocher. |
| **Casse** | Capitales partout, ponctuation gardée sur les étiquettes (« REGARDEZ. », « TOUT SEULS. »). |
| **Taille** | Hauteur des capitales ≈ **0,044 à 0,049 L** (≈ 48-53 px en 1 080 de large). Un mot de 9 lettres sur plaque (« CARROUSEL ») occupe ≈ **0,62 L**. En comparaison, la v3 de Will fait ≈ 0,042 L en capitales, mais **3 mots** à la fois. Par caractère, la référence est **≈ 1,4 fois plus grande**. |
| **Nombre de mots** | **1 à 2 mots** (rarement 3). Le mot suivant apparaît d'abord **petit**, puis grossit. |
| **Trois états de mot** | (1) **ordinaire** : blanc `#FCFDFF`, contour encre ≈ 2 px à 720 et petite ombre dure ; (2) **mot en couleur** : texte cyan `#5BE2E4` avec contour encre ; (3) **mot fort** : **plaque cyan pleine**, texte encre, contour encre ≈ 3 px, **ombre dure** décalée en bas à droite (≈ 4 px à 720), coins ≈ 6 px, inclinaison de -1 à -2°. |
| **Mise en valeur** | Environ **1 mot sur 2** est en cyan (texte ou plaque). Ce sont les noms, les verbes d'action et les chiffres. |
| **Entrée** | Le mot grossit depuis ≈ 50 % de sa taille en ≈ 4 images. Pas de fondu. |
| **Position** | Plein cadre : centre des sous-titres à **≈ 0,66-0,67 H**, centré, sur le tee-shirt noir. En mode carte : **juste sous la carte**, vers ≈ 0,46-0,48 H. Les sous-titres ne passent **jamais** sur le visage. |
| **Fond** | Aucun bandeau : le texte est posé directement sur le tee-shirt noir, ce qui fait **fond sombre naturel** (`#191E25`). |
| **Étiquettes (stickers)** | Mêmes polices. Texte encre sur plaque cyan **ou** texte cyan sur plaque encre (interjections). Pré-étiquette éventuelle en petit (blanc sur encre). Largeur de 0,40 à 0,70 L. Inclinaison de -3° à +2°. Contour et ombre dure. |
| **Cartes** | En-tête cyan, titre en capitales Black (petit, ≈ 0,02 L), corps crème, texte de ligne en sans-serif grasse plus petite (≈ 0,018-0,022 L). **C'est le seul endroit où la référence descend sous 26 px** (en 1 080). |

---

## (d) Couleurs et recommandation sur l'orange

### d.1 Couleurs de la référence [MESURÉ : pixels échantillonnés avec ffmpeg crop + rawvideo, couleur dominante par zone]

| Rôle | Hex mesuré | Remarque |
|---|---|---|
| **Cyan** (plaques, mots, en-têtes, barre) | **`#5BE1E6`** (de `#5BE0E5` à `#5CE2E4`) | La 1ʳᵉ analyse donnait `#4DD6EA`, à l'œil. La valeur mesurée ici est plus verte et plus claire. |
| **Encre** (contours, ombres, plaques interjection) | **`#000E22`** | Très sombre, bleutée |
| **Crème** (bande, corps des cartes, fin) | **`#F9F5ED`** | |
| **Blanc** (mots ordinaires, tuiles) | `#FCFDFF` / `#FEFEFF` | |
| Vert citron (seulement dans la vidéo générée de 46 s) | `#CBFB3E` | Hors charte, contenu de preuve |
| Mur | `#D5C2B7` | Beige rosé chaud |
| Tee-shirt | `#191E25` | Le fond sombre des sous-titres |
| Texte de la carte de fin | `#030101` | Quasi noir |

### d.2 L'orange de Will : trop foncé ? **Oui, pour l'écran.**

L'orange de la charte est **`#B44F29`** (`charte.ts`, standard v3 § 0). Dans la v3, les plaques utilisent en plus le dégradé `orangeChaud #BC6441 → orangeProfond #934122`, donc **encore plus sombre en bas**.

| | Cyan de la référence `#5BE1E6` | Orange de Will `#B44F29` |
|---|---|---|
| Teinte / saturation / luminosité (HSL) | 182° / 74 % / **63 %** | 16° / 63 % / **43 %** |
| Luminance relative (WCAG) | **0,62** | **0,15** (4 fois moins) |
| Contraste avec la couleur sombre de la marque | 12,3:1 sur l'encre `#000E22` | **3,8:1** sur l'encre `#110A05` |
| Contraste avec le vêtement | **10,7:1** sur le tee-shirt noir | **1,9:1** sur le sweat bleu roi de Will (`#02428C`, mesuré sur la sélection v3) |
| Contraste avec la couleur claire | Texte encre sur cyan : 12,3:1 | Texte ivoire `#E9DCC8` sur orange : **3,8:1** |

**Diagnostic** [MESURÉ pour les chiffres, SUPPOSÉ pour l'effet perçu] : ce qui fait « sauter » la référence, ce n'est pas la teinte cyan, c'est **la lumière** : un accent **très clair** (luminance 0,62) posé sur du **très sombre**, avec du **texte sombre dessus**. L'orange de Will est un orange **brique / terre cuite** de luminosité moyenne. Sur un sweat bleu, il a presque la même luminance que le fond (1,9:1) : à taille téléphone, les mots orange **ne ressortent que par la teinte**, pas par la lumière. Et le texte ivoire sur une plaque orange n'a que 3,8:1.

**Recommandation** :
1. Ajouter un **« orange écran » `#E8743F`** (HSL 19° / 79 % / 58 %, luminance 0,30). Il est réservé à la vidéo : plaques de mot fort, mots en couleur, en-têtes de carte, barre de progression.
   - Texte **encre `#110A05` sur `#E8743F`** : **6,6:1** (au lieu de 3,8:1 pour ivoire sur `#B44F29`).
   - `#E8743F` sur le sweat bleu : 3,2:1, et ≈ 5,8:1 avec un contour encre.
   - Même famille de teinte (16° → 19°) : on **reconnaît toujours la marque**, en plus lumineux.
2. **Garder `#B44F29`** pour ce qu'il fait bien : l'**ombre** des plaques (à la place de l'ombre encre), le bas du dégradé, les contours, et tous les documents imprimés ou clients (charte terracotta).
3. **Inverser le texte des plaques** : **encre sur orange clair**, comme la référence (encre sur cyan), au lieu d'ivoire sur orange foncé.
4. Si Will juge `#E8743F` trop « mandarine », le palier intermédiaire est **`#D9643A`** (luminance ≈ 0,23 ; encre dessus : 5,3:1).
5. ⚠️ Le standard v3 dit « **aucune nouvelle teinte** » [WILL]. Ajouter `#E8743F` est donc **une décision à faire valider par Will**, idéalement sur un extrait vidéo côte à côte : `#B44F29` vs `#E8743F`.

Note sur le crème : la référence utilise un crème **presque blanc** (`#F9F5ED`), alors que l'ivoire de Will (`#E9DCC8`) est nettement plus beige. Les cartes de Will paraîtront donc **plus « papier » et moins « écran »**. Pour les corps de carte en vidéo, un ivoire éclairci (≈ `#F6EFE4`) se rapprocherait de la référence sans quitter la marque [SUPPOSÉ, à valider].

---

## (e) Les 10 procédés qui rendent la vidéo dynamique (par impact décroissant)

1. **Il y a toujours un objet au-dessus de la tête.** Étiquette, badge, rangée de portraits : la prise « nue » ne dure jamais plus de ≈ 0,5 s. *C'est le procédé n° 1 et il ne demande aucun zoom.*
2. **Le contenu des cartes bouge toutes les 0,25-0,75 s, au mot près.** Ligne qui s'allume, case cochée, pile qui tombe, saisie lettre par lettre. Une carte n'est jamais une image fixe.
3. **Le changement de mise en page toutes les ≈ 2,7 s.** Carte → plein cadre + étiquette → visage couvert → carte… La descente et la remontée de la prise rythment l'ensemble.
4. **Les compteurs et les jauges** : 6 → 9 → 12, 0:46 → 2:00, 12 → 96 %, étoiles, mois 1 → 4. Un chiffre qui défile, c'est un événement « gratuit » toutes les 0,25 s.
5. **Les sous-titres mot à mot, très gros, sur fond sombre**, avec 1 mot sur 2 en cyan et des mots qui grossissent à l'apparition. ≈ 3 changements/s.
6. **Les preuves produit plein visage** : le carrousel feuilleté à 3 pages/s, la page web qui défile, la vidéo générée. La vidéo dans la vidéo, mais **réelle**.
7. **Les sorties en 3-5 images**, avec un enchaînement immédiat : une carte part en haut, la suivante arrive aussitôt de la droite (23,66 → 23,9 s).
8. **Les personnages récurrents** (12 agents, prénoms, métiers) et le **motif récurrent** (la carte « COMMANDE » vue 3 fois). On suit une histoire, pas une liste.
9. **Les interjections de chapitre** : « REGARDEZ. », « ET PLUS LOIN. », « ATTENTION. », « TOUT SEULS. ». Ce sont des relances courtes (≈ 1 s), qui changent la couleur de la plaque (encre au lieu de cyan).
10. **Les carillons sur les moments de réussite**, plus des petits clics probables. Et des mains toujours en mouvement chez le présentateur (geste à chaque phrase) [observé ; l'effet est SUPPOSÉ].

(Le recadrage serré au retour d'une carte existe aussi, mais il arrive **loin derrière** : 2 ou 3 occurrences en 79 s.)

### Le son [MESURÉ sauf mention]

- **Musique : non.** L'énergie mesurée descend à **-52 / -58 dB** entre certaines phrases (fenêtres de 50 ms). Le niveau médian est de -17,7 dB, et il n'y a **aucune ligne tonale continue** sur les spectrogrammes. Un fond musical tiendrait un plancher de -30 à -40 dB.
- **Loudness** : **-13,0 LUFS** intégrés, LRA 2,0 LU (voix très compressée, niveau « réseaux sociaux »).
- **Bruitages : oui.** On voit sur les spectrogrammes des **sons tonals de 0,3 à 0,8 s, avec des harmoniques nettes vers 1 050, 2 100, 4 200 et 11 300 Hz**. Ce sont des « dings » ou carillons [nature SUPPOSÉE]. On en compte au moins à 33,3 s (révélation de la page web), 45,9 s (vidéo de Jade), 68,4 s (« EN MÉMOIRE »), 74,7 s, 75,3 s et 77,4 s (les coches du CTA). Il y a aussi une **suite de notes en escalier** vers 73,4-74,2 s (commentaire publié, puis notification) et un **son qui monte** (≈ 1,2 → 2,6 kHz) vers 78,4-79 s, sur la carte de fin.
- Les **clics ou « pops »** brefs sur les étiquettes et la saisie sont **probables, mais non séparables** des consonnes de la voix sur le spectrogramme [SUPPOSÉ].
- **Conclusion** : ce sont des bruitages **rares et réservés aux moments de réussite** (≈ 6 à 10 en 79 s), et non un « pop » sur chaque élément. C'est conforme à la règle de Will : pas de musique, des bruitages.

---

## (f) Ce qui manque au générateur de Will par rapport à cette référence

Base : `STANDARD-DA-V3-2026-10-16.md`, `CRITIQUE-V3-2026-10-16.md` (moyenne 6,3/10), extraits `planche-v3/lotA…lotE`, sélection `planche-v3/selection-v3-14-elements.mp4` (37,6 s, regardée à 1 i/s).

| # | Manque | Constat | À faire (chiffré) |
|---|---|---|---|
| 1 | **L'objet permanent au-dessus de la tête** | Dans la sélection v3, Will est **seul** (avec des sous-titres) sur ≈ 10 des 38 vignettes à 1 i/s, soit environ **1 s sur 4** (par exemple à 8 s, 11 s, de 14 à 16 s, à 19 s, 24 s, 35 s et 37 s), avec des plages de **2-3 s** d'affilée. C'est une démonstration et non un vrai montage, mais l'écart est net : la référence ne le laisse jamais seul plus de 0,5 s. | Ajouter une **famille « au-dessus de la tête »** : étiquette, badge personnage, rangée de pastilles, compteur. Zone y 0,03 → 0,13 H, **au-dessus** de la zone interdite Z (0,12 H). Elle est compatible avec « rien sur le visage avant 5 s ». **Règle : prise nue ≤ 0,5 s.** |
| 2 | **Les sous-titres trop petits et trop bavards** | v3 : 2-3 mots, ≈ 0,042 L par capitale, mot clé en texte orange. Référence : 1-2 mots, ≈ 1,4 fois plus grand, 1 mot sur 2 sur une plaque. | Passer à **1-2 mots**, **Montserrat Black**, **capitales de 0,045-0,05 L**, et le mot fort sur une **plaque pleine** (encre sur orange écran). Le mot suivant grossit depuis 50 % en 4 images. |
| 3 | **L'accent trop sombre** | Orange `#B44F29` : luminance 0,15 et 1,9:1 sur le sweat bleu (§ d.2). | **Orange écran `#E8743F`** + texte encre (à valider par Will). |
| 4 | **Le contenu qui bouge dans les cartes** | La critique v3 relève que « presque tous les éléments restent figés 1 à 2 s ». | Règle de la référence : **une étape de contenu toutes les ≤ 0,75 s** pendant qu'une carte est affichée (coche, ligne, compteur, saisie). Les cartes existantes (`ListeCochee`, `Statuts`, `Calcul`, `Calendrier`…) le savent déjà : il faut **les caler plus serré** sur les mots. |
| 5 | **Les compteurs** | Un seul en v3 (`widget-chiffre` / `eclat-chiffre`). | Faire du compteur un **réflexe** : chaque chiffre dit (durée, nombre, pourcentage, étoiles) devient un compteur de 0,5 à 1 s, dans un badge ou une carte. |
| 6 | **Les personnages et le motif récurrent** | La v3 enchaîne des éléments tous différents (c'est la règle de diversité). La référence, elle, **répète** volontairement une carte (3 fois « COMMANDE ») et des personnages. | Ajouter au « réalisateur » la notion de **motif récurrent** : un composant qui revient 2-3 fois dans une vidéo, avec un contenu différent. La règle de diversité s'applique **entre vidéos**, pas forcément à l'intérieur d'une vidéo. *Personnages : uniquement des personnes réelles avec leur accord, ou des pictos. Pas de faux visages présentés comme une vraie équipe (prudence DGCCRF).* |
| 7 | **Les preuves produit** | La v3 a beaucoup de B-roll de stock (chantier, atelier, devis), dont une partie floue ou molle selon la critique. La référence n'en a que 3 et **montre le vrai produit**. | Pour Axion-IA : de **vraies captures** (console, CRM, e-mail de relance reçu, devis généré, calendrier rempli) dans une fenêtre qui **défile ou se feuillette** (≈ 3 pages/s). `Fenetre.tsx` sait déjà faire défiler une capture [EXISTANT]. **Une preuve réelle vaut mieux que trois B-roll.** |
| 8 | **Les interjections de chapitre** | Absentes de la v3. | Étiquette **encre + texte orange écran**, 1 à 2 mots + point (« REGARDEZ. », « ATTENTION. »), ≈ 1 s, sur les mots charnières du script. C'est un élément très peu coûteux. |
| 9 | **Le CTA en pile** | v3 : la fin n'est pas traitée dans la sélection. | Un CTA + **3 bénéfices cochés** qui s'ajoutent sur les mots dits, une flèche, puis le panneau de fin qui **monte du bas** en 4-5 images. |
| 10 | **Des sorties plus sèches** | La critique v3 relève des disparitions sèches et des restes d'une image. | Entrées ≤ 6 images, sorties ≤ 5 images, et l'élément suivant entre **dans la même image** que la fin de la sortie (référence : 23,66 → 23,79 s). |
| 11 | **La répartition du temps** | Inconnue en v3 (ce sont des extraits). | Viser la référence : **≈ 45 % en mode carte, ≈ 35 % plein cadre avec objet au-dessus de la tête, ≈ 15-20 % visage couvert**, un changement de bloc toutes les ≈ 2,7 s. Ce sont des chiffres **vérifiables par code** dans le plan de montage. |
| 12 | **Le son** | La critique v3 note que les lots B, C et E sont **muets**. | Pas besoin d'un son par élément : la référence en met **≈ 6 à 10** (« ding » sur les réussites : coche finale, révélation, CTA). Plus des clics discrets sur la saisie [SUPPOSÉ]. |
| 13 | **Ce qu'il ne faut PAS copier** | Le recadrage serré au retour de carte (8,1 s, 17,2 s) est **interdit** chez Will. | Le remplacer par la **remontée de la prise avec un léger rebond**, déjà permise (« garde la descente »). La référence montre que le zoom n'est pas la source principale d'énergie (§ b.5). |

**En une phrase** : la v3 cherche l'effet **dans chaque élément** (verre, perspective, formes). La référence obtient « hyper dynamique » **par la densité et la continuité** : toujours un objet au-dessus de la tête, des cartes dont le contenu bouge tout le temps, des compteurs, des sous-titres énormes à 1-2 mots, et un accent **très lumineux**. Pour Will, le plus rentable est d'ajouter ces quatre couches (au-dessus de la tête, contenu vivant, compteurs, sous-titres plus gros et orange écran) **avant** de raffiner encore la matière des éléments.
