# Analyse de la vidéo de référence — format « Face caméra + cartes animées + B-roll »

**Source** : post LinkedIn de un créateur de référence, « 6 outils qui remplacent une équipe de 10 », vu le 14/10/2026.
**Objet de ce document** : décrire la vidéo assez précisément pour qu'un plan d'implémentation puisse reproduire EXACTEMENT ce type de vidéo, en série, avec Will filmé.
**Statut** : analyse (étape 1). Le plan d'implémentation (étape 2) reste à écrire, après validation de Will.

---

## Principes dictés par Will (14/10/2026) — priment sur tout le reste du document

1. **Toujours filmé : Will, sa vraie voix.** Jamais d'avatar HeyGen, jamais de voix de synthèse, et **pas la v4**. C'est un **nouveau générateur**.
2. **Nos couleurs et notre charte**, en réutilisant ce qui est déjà centralisé dans le studio (sous-titres, jetons de style), pas celles de la référence (cyan/navy/crème).
3. **Rendu similaire à la référence** : même niveau de densité, de finition et de dynamisme (un événement visuel toutes les 1 à 2 s).
4. **Les animations, le motion design et les effets sont créés EN FONCTION DU SCRIPT de chaque vidéo** et **changent à chaque vidéo**. Ce n'est PAS un catalogue de gabarits où l'on remplace le texte. Ce qui est décrit en §3 et §4 est le **vocabulaire visuel** de la référence (ce que ce style sait faire), pas une liste fermée.
5. **La façon de bouger peut aussi changer** d'une vidéo à l'autre (une carte peut tomber, glisser, se dessiner, se déplier…). **Ce qui ne bouge jamais, c'est la reconnaissance de la marque** : on doit reconnaître Axion-IA au premier coup d'œil, quel que soit le mouvement.
6. **Toujours aussi dynamique** : chaque vidéo doit tenir le rythme de la référence, quel que soit le script.
7. **Chaque apparition est calée sur les mots prononcés** (voix de Will transcrite mot à mot).

Conséquence sur l'architecture : (a) des **marqueurs de marque fixes** (couleurs, polices, formes, ton) ; (b) un **espace de variation autorisé** (types d'animation, mouvements, rythmes, effets) ; (c) un **« réalisateur » qui lit le script** et choisit, phrase par phrase, quoi montrer, comment, et à quel mot ; (d) un **contrôle qualité « reste dans la marque »** même quand les mouvements varient.

---

## 0. Ce que l'analyse a vraiment mesuré — et ce qu'elle n'a pas pu mesurer

**Mesuré (fiable)** : durée, format, image par image du début à la fin (une image par seconde sur 80 s, plus des plongées à 0,15–0,2 s sur trois transitions clés), texte de chaque carte, ordre et moment d'apparition de chaque élément, couleurs dominantes (échantillonnage de pixels).

**Non mesuré / à confirmer** :
- **Le son** : je ne l'entends pas. Voix, musique, bruitages (« pop », « whoosh », frappe clavier) : INCONNU. À écouter par Will, ou à faire transcrire. Le plan ne doit pas supposer de musique (la mémoire dit : pas de musique dans le studio).
- **Les polices exactes** : estimées à l'œil (voir §5), à confirmer avec une comparaison côte à côte.
- **Les courbes d'accélération exactes** : déduites de 3 images à 0,15–0,2 s d'écart, pas mesurées en continu.
- **Les valeurs hexadécimales** : arrondies par échantillonnage (pas de pipette sur la source). Marge d'erreur ±8 par canal.
- **Les chiffres affichés** (« +2 000 000 € », « −20 €/mois », « des centaines de RDV/mois ») sont des affirmations de l'auteur, non vérifiées.

---

## 1. Fiche technique

| Élément | Valeur observée |
|---|---|
| Format | **Vertical 9:16**, 720 × 1280 px (version LinkedIn ; produire en 1080 × 1920) |
| Durée | **80,17 s** |
| Plan principal | **Un seul plan fixe** de l'orateur, buste, regard dans l'objectif, fond mur uni beige-rosé, micro-cravate (bonnette grise visible en bas à droite de l'image) |
| Cadrage | Tête dans le tiers haut, épaules coupées en bas. Légères variations d'échelle d'un moment à l'autre (recadrage numérique) |
| Éclairage | Lumière naturelle douce, côté gauche, fond chaud |
| Éléments à l'écran | Barre de progression en haut, cartes animées, stickers, sous-titres mot à mot, fenêtres de B-roll |
| Fin | Carte de fin plein écran (fond crème) à partir de ≈79,4 s |

**Débit de parole** : très dense. Environ 200 mots pour 80 s (≈150 mots/min), sans silence long. Un mot-clé est mis en valeur toutes les 1 à 2 secondes.

---

## 2. Structure narrative (la « recette » en 7 blocs)

| Bloc | Temps | Rôle | Ce qui se passe à l'écran |
|---|---|---|---|
| **A. Accroche chiffrée** | 0 – 4 s | Preuve d'autorité en 1 phrase | Étiquette « CHIFFRE D'AFFAIRES » dont le compteur monte (+NNN NNN € → …|
| **B. Contraste** | 4 – 9 s | Petite équipe vs grande équipe | Étiquette « ÉQUIPE DE 2 » ; B-roll surf (« SURF TOUS LES JOURS ») ; icônes des 6 logos + « 6 OUTILS. » ; B-roll bureau open-space |
| **C. Outil 1 – Claude « Le rédacteur »** | 10 – 18 s | Présenter l'outil | Pastille « OUTIL 1/6 », logo, étiquette de rôle, carte chat qui se « tape », 3 puces, B-roll mains sur clavier, prix « −20 € / MOIS » |
| **D. Outil 2 – ChatGPT « Le designer »** | 18 – 26 s | idem | « OUTIL 2/6 », carte « CHATGPT · IMAGES » qui se remplit de 4 vignettes |
| **E. Outils 3, 4, 5, 6** | 26 – 60 s | idem, ≈8 s chacun | Notion (liste qui s'allonge), Systeme.io (frise verticale), Metricool (calendrier puis graphique en barres), Waalaxy (liste de prospects) |
| **F. Le calcul** | 60 – 70 s | Preuve par la comparaison | B-roll « RDV/mois » ; carte « LE CALCUL » avec 2 barres (coût vs ce que ça génère) ; B-roll liasses de billets ; B-roll noir et blanc « il y a quelques années… » ; icônes « 10 PERSONNES » barrées |
| **G. Appel à l'action** | 70 – 80 s | Récapitulatif + CTA mot-clé | Carte « MA STACK » (6 → « 10 outils au quotidien » avec 4 cadenas) ; carte « COMMENTAIRES » où « OUTILS » est tapé ; étiquette « COMMENTEZ « OUTILS » » ; carte de fin |

**Principe répétable** : *accroche chiffrée → contraste → N éléments numérotés (même gabarit à chaque fois) → calcul de valeur → CTA par mot-clé en commentaire.* Tout le contenu se loge dans ce squelette ; seul le sujet change.

---

## 3. Chronologie détaillée (sous-titres reconstitués + éléments visuels)

Les sous-titres sont lus sur les images ; ils sont **mot à mot** (un mot ou deux à la fois). Ce que dit réellement l'orateur n'est connu qu'à travers eux.

| t (s) | Sous-titre (mots affichés) | Élément visuel |
|---|---|---|
| 0,0 | « J'AI » | Face seule. Barre de progression en haut démarre |
| 1,0 | « DE 2 MILLIONS » (« 2 » dans un cadre cyan) | Étiquette **CHIFFRE D'AFFAIRES +NNN NNN €**, au-dessus de la tête, légèrement inclinée |
| 2,0 | « LANÇANT » | Compteur : **+1 993 732 €** |
| 3,0 | « LIGNE AVEC » | Compteur figé : **+2 000 000 €** (étiquette plus petite) |
| 4,0 | « PERSONNES » | Étiquette blanche **ÉQUIPE DE 2.** avec deux pictos « personne » |
| 4,4 – 4,8 | « PERSONNES ET » | Étiquette « ÉQUIPE DE 2 » : léger pulse (échelle) |
| 5,0 | « PERSONNES ET EN » | **Fenêtre B-roll** (surf) entre depuis la droite, légèrement inclinée, recouvre la moitié du visage |
| 5,2 – 5,4 | « ALLANT SURFER » | B-roll se redresse et se centre à gauche ; étiquette « SURF TOUS LES JOURS » apparaît en bas du B-roll |
| 6,0 | « TOUS LES JOURS » | B-roll sorti de l'écran à ≈6,5 s |
| 7,0 | « VOICI LES » | Face seule |
| 8,0 | « M'ONT PERMIS DE » | Étiquette **6 OUTILS.** + 5 logos en rangée (+ le 6ᵉ qui arrive) |
| 9,0 | « ÉQUIPE DE 10 » | B-roll open-space |
| 10,0 | « LE » | Pastille **OUTIL 1/6** (1 point plein sur 6) |
| 11,0 | « C'EST CLAUDE » | **Logo Claude** (tuile blanche + nom) en haut à gauche |
| 12,0 | « RÉDACTEUR » | Étiquette cyan **LE RÉDACTEUR** (avec picto stylo) |
| 12,2 | — | Logo et étiquette de rôle s'estompent (fondu, ≈0,2 s) |
| 12,3 – 12,8 | « NOUS AIDE À » | **Carte « CLAUDE #1 » tombe d'en haut** ; le message se tape lettre par lettre : « Écris le script de ma vidéo, l'email et la page de vente. » |
| 13,0 | « ÉCRIRE » | Message complet, curseur clignotant |
| 14,0 | « SCRIPTS » | Réponse en lignes grises (la 1ʳᵉ cyan) ; puce **Scripts** (coche) |
| 15,0 | « NOS PAGES DE » | Puces **Emails**, **Pages de vente** s'ajoutent |
| 16,0 | « SEULEMENT UNE » | B-roll : mains sur clavier |
| 17,0 | « MOIS » | **SEULEMENT −20 € / MOIS** au-dessus de la tête |
| 18,0 | « C'EST CHATGPT » | Pastille **OUTIL 2/6**, petit logo qui grossit en haut à gauche |
| 19,0 | « QUI EST » | Logo ChatGPT plein |
| 20,0 | « NOTRE DESIGNER » | Un panneau passe sur le bord droit (début du B-roll) |
| 21,0 | « CRÉATION » | B-roll (lettres « BALLOON » vertes dans un logiciel de design) |
| 22,0 | « D'IMAGES » | **Carte « CHATGPT · IMAGES #2 »**, 1ʳᵉ vignette « IMAGES » |
| 23,0 | « MOCKUPS VISUELS » | 2ᵉ « MOCKUPS », 3ᵉ « VISUELS PUB » (« Nouvelle formation. ») |
| 24,0 – 25,0 | « ET PENSE-BÊTE » | 4ᵉ vignette « FICHES PENSE-BÊTE » |
| 26,0 | « LINKEDIN » | Carte sortie, bande crème vide un instant, puis le visage remonte (§4.1) |
| 27,0 | « LE TROISIÈME » | Pastille **OUTIL 3/6** |
| 28,0 | « CLAIREMENT » | Logo **Notion** |
| 29,0 | « L'ENTREPRISE » | Étiquette **LE CERVEAU** |
| 30,0 – 35,0 | « TOUS NOS / NOS PROJETS / NOTRE CRM / DOCUMENTATION / PLANNING DE / SONT SUR » | Carte « **NOTION · QG #3** » : une ligne se **surligne** puis s'ajoute à chaque mot-clé prononcé (Process → Projets → CRM → Documentation → Planning de publication), avec case à cocher |
| 36,0 | « LE » | **OUTIL 4/6** |
| 37,0 | « SYSTEME.IO » | Logo Systeme.io |
| 38,0 | « ON Y A » | Étiquette **TOUT-EN-UN** (éclair) |
| 39,0 – 44,0 | « NOS PAGES DE VENTE / TUNNELS / MOYENS DE PAIEMENT / EMAILS / AUTOMATISATIONS » | Carte « **systeme #4** » : **frise verticale** à 5 étapes qui s'allument une à une (Pages de vente → Tunnels → Paiements → Emails → Automatisations). Un badge « • Paiement reçu » apparaît à 42 s |
| 45,0 | « C'EST » | **OUTIL 5/6** |
| 46,0 | « QUI EST » | Logo **Metricool** (jaune) |
| 47,0 | « MANAGER » | Étiquette **COMMUNITY MANAGER** |
| 48,0 – 49,0 | « TOUS NOS / CHAQUE » | Carte « **METRICOOL · PLANNING #5** » : grille Lun→Dim ; des pastilles de réseaux (LinkedIn, Instagram, Facebook, TikTok, YouTube) tombent dans les cases |
| 50,0 | « PLATEFORME ET » | B-roll (smartphone + ordinateur) |
| 51,0 – 53,0 | « SUIVRE TOUTES SUR PLATEFORMES » | Carte « **STATISTIQUES #5** » : graphique en barres qui grandit, puces « Portée / Engagement / Abonnés » avec flèches ↑ |
| 54,0 | « ET LE SIXIÈME » | **OUTIL 6/6** |
| 55,0 | « QUI AUTOMATISE » | Logo **Waalaxy** (alien bleu) + étiquette **PROSPECTION** (coupée par le bord droit pendant son entrée) |
| 56,0 | « PROSPECTION » | Carte « **WAALAXY · LinkedIn #6** » : liste de prospects, statuts « ENVOYÉ » / « INVITER » |
| 57,0 | « LINKEDIN » | Bande crème vide, visage plus bas |
| 58,0 – 59,0 | « DE CENTAINES » | B-roll (femme à l'ordinateur) puis B-roll (homme au casque) + étiquette **DES CENTAINES DE RDV / MOIS** |
| 60,0 | « DE » | Pictos « calendrier coché » qui s'ajoutent sur le B-roll (6 pictos) |
| 61,0 | « PAR MOIS » | |
| 62,0 – 63,0 | « COÛTENT… D'EUROS » | Carte « **LE CALCUL** » : colonne « COÛT » : « Quelques centaines € / mois » |
| 64,0 | « NOUS PERMETTENT » | 2ᵉ colonne « ÇA GÉNÈRE » : **Des milliers €** (barre cyan beaucoup plus haute) |
| 65,0 – 66,0 | « DE GÉNÉRER DES MILLIERS » | B-roll liasses de billets + étiquette **DES MILLIERS D'€** |
| 67,0 – 68,0 | « ENCORE… IL AURAIT FALLU » | B-roll **noir et blanc** open-space + étiquette « **IL Y A QUELQUES ANNÉES…** » |
| 69,0 | « DIX » | Étiquette **10 PERSONNES** |
| 70,0 | « ÇA » | 10 pictos, **barrés** d'un trait |
| 71,0 – 73,0 | « AI MONTRÉ / A / QUOTIDIEN » | Carte « **MA STACK** » : 5 logos puis le 6ᵉ ; titre « **6 OUTILS MONTRÉS.** » → « **10 OUTILS AU QUOTIDIEN.** » avec **4 tuiles cadenassées** |
| 74,0 | « OU » | Étiquette **COMMENTEZ** ; carte « **COMMENTAIRES** » : champ de saisie |
| 75,0 | « VOUS ENVOIE LA » | Le mot **OUTILS** est tapé dans le champ et le commentaire se publie (cœur) |
| 76,0 – 79,0 | « DES / AVEC / UTILISER / GRATUITEMENT » | Étiquette **COMMENTEZ « OUTILS »** + sous-étiquette « **10 OUTILS + LIENS GRATUITS** » ; flèche → (invite à « continuer ») en bas à droite |
| 79,4 – 80,2 | — | **Carte de fin** plein écran : « **Marque-Réf.** » + 6 logos + « un créateur de référence » + bouton « **COMMENTEZ « OUTILS »** » |

---

## 4. Grammaire de motion (les mécanismes à reproduire)

### 4.1 Le « décalage de mise en page » — la signature visuelle
Quand une carte est affichée, la **vidéo de l'orateur est poussée vers le bas** et une **bande crème** (≈ 22 % de la hauteur) apparaît en haut, derrière la carte.
- Entrée (≈ 12,3 s) : la carte **tombe du haut** avec dépassement léger (elle descend un peu trop puis se pose), ≈ 0,3 s.
- Sortie (≈ 26,0 s) : la carte part, la **bande crème reste une image**, puis le visage **remonte** à sa place (≈ 0,2 s).
- Pendant l'affichage de la carte, **les sous-titres passent juste sous la carte** (≈ 48 % de la hauteur) au lieu du bas.
- Les B-roll, eux, **ne poussent pas** le visage : ils s'**incrustent par-dessus**.

### 4.2 Les sous-titres
- **Mot à mot**, en majuscules, police très grasse. **Un mot sur deux** environ est mis en valeur : mot-clé dans un **cadre cyan** (texte sombre), les autres en **blanc à contour sombre**.
- Taille variable selon l'importance (« CLAIREMENT » petit ; « AUTOMATISATIONS » énorme, incliné légèrement).
- Position : bas du tiers central (≈ 65 % de la hauteur), **remontent à ≈ 48 %** quand une carte occupe le haut.
- Pas de fond de bande : texte directement sur l'image.

### 4.3 La barre de progression (haut de l'écran)
Fine ligne **cyan sur navy**, tout en haut, qui avance sur 80 s. Elle est **divisée par un petit trait** (segment cyan plein, reste navy).

### 4.4 La pastille « OUTIL n/6 »
Gélule navy en haut centre, texte blanc « OUTIL 3/6 » + **6 points** (pleins = cyan, vides = gris). Apparaît 1 s avant le logo de l'outil, reste jusqu'à l'outil suivant. **Elle se déplace avec le haut de l'écran** (elle est visible aussi quand la bande crème est vide).

### 4.5 Le logo d'outil + l'étiquette de rôle
- **Tuile blanche arrondie** avec le logo, légende en dessous (« CLAUDE »), **inclinée de −3° environ**, en haut à gauche. Entrée en **grossissant depuis un point** (≈ 0,3 s).
- **Étiquette de rôle** cyan (« LE RÉDACTEUR », « LE CERVEAU », « TOUT-EN-UN », « COMMUNITY MANAGER », « PROSPECTION »), à droite du logo, **légèrement inclinée**, avec picto.
- Les deux **s'estompent ensemble** juste avant l'entrée de la carte (≈ 0,2 s).

### 4.6 Les cartes (le cœur du format)
Gabarit unique, décliné en 7 contenus :
- **En-tête cyan** avec petit logo + titre en majuscules (ex. « CLAUDE », « NOTION · QG », « METRICOOL · PLANNING ») à gauche, **numéro « #n »** dans une pastille navy à droite.
- **Corps crème**, texte navy, picto/trait fin.
- **Contour navy épais** (≈ 2–3 % de la largeur) + **ombre portée dure en bas à droite** (pas de flou) : style « néo-brutaliste ».
- **Coins arrondis** (≈ 10 px sur 720).
- Largeur ≈ 80 % de l'écran, hauteur ≈ 25–30 %, **centrée horizontalement** (légère inclinaison à l'entrée, puis à plat).
- **Le contenu se construit au rythme de la voix** : chaque élément (puce, ligne, vignette, case) apparaît **au moment précis où le mot correspondant est prononcé** (± 0,2 s). C'est ce qui donne l'effet « le dessin suit la parole ».
- Types de contenu : chat qui se tape (curseur) · liste qui s'allonge avec surlignage · frise verticale qui s'allume · grille calendrier avec pastilles qui tombent · graphique en barres qui monte · liste de lignes avec statuts · comparaison 2 barres · grille de logos avec cadenas.

### 4.7 Les étiquettes (stickers) au-dessus de la tête
Rectangles/gélules cyan ou blancs, texte navy en majuscules, **contour navy + ombre dure**, **inclinaison ±2–4°**, au niveau du haut du crâne. Exemples : « CHIFFRE D'AFFAIRES +2 000 000 € », « ÉQUIPE DE 2. », « 6 OUTILS. », « SEULEMENT −20 € / MOIS », « DES CENTAINES DE RDV / MOIS », « 10 PERSONNES ». Entrée en **« pop »** (dépassement d'échelle), ≈ 0,25 s.
- Le **compteur** de l'accroche est animé (valeur qui monte) : valeur de départ → valeur finale en 3 s.

### 4.8 Les B-roll
- **Fenêtre arrondie** (≈ 55 % de la largeur, ratio proche du 4:5), **contour navy fin**, légère **inclinaison à l'entrée**, entre **depuis le côté droit** (≈ 0,2 s), se redresse, **sort de même**.
- Durée **1 à 3 s** chacune, **toujours en lien avec le mot prononcé** (surf, open-space, clavier, billets…).
- Légende courte en étiquette cyan, **sur** le B-roll (« SURF TOUS LES JOURS », « DES CENTAINES DE RDV / MOIS », « IL Y A QUELQUES ANNÉES… »).
- Les B-roll sont des **vidéos stock** (certaines générées/retouchées : liasses de billets d'allure synthétique).
- L'un d'eux (open-space noir et blanc) est **désaturé** pour signifier « le passé ».

### 4.9 Carte de fin
Fond crème plein écran, marque (« Marque-Réf. » avec point vert), rangée de logos, pseudo, **bouton cyan** « COMMENTEZ « OUTILS » ». ≈ 0,8 s seulement (apparition **sèche**, presque sans transition).

### 4.10 Rythme global
- **Un événement visuel toutes les 1 à 2 s** (nouveau sous-titre mis en valeur, nouvelle puce, nouveau sticker).
- Jamais plus de **3 s** sans changement visuel majeur.
- **Alternance** : face seule (≈ 2 s) → carte (≈ 6–8 s) → face seule → B-roll… pour éviter la lassitude.
- **Redondance utile** : chaque info importante est dite, écrite en sous-titre ET montrée dans une carte/sticker.

---

## 5. Direction artistique (à figer en « charte de format »)

| Rôle | Valeur observée | À figer |
|---|---|---|
| **Cyan principal** (en-têtes, mots-clés, barre de progression) | ≈ `#4DD6EA` (échantillon `#58D8E8`) | Pipette sur la source |
| **Navy** (contours, textes, ombres, fond des pastilles) | ≈ `#0B1226` (très sombre, bleuté) | idem |
| **Crème** (corps des cartes, bande haute, fond de fin) | ≈ `#FBF8EC` (échantillon `#F8F8E8`) | idem |
| **Jaune** (tuile Metricool uniquement) | ≈ `#E8EB4A` | Marque tierce, pas de la charte |
| **Blanc** (mots non-clés, tuiles de logo) | `#FFFFFF` | |
| **Police titres/sous-titres** | Sans-serif **géométrique très grasse, majuscules**, chasse large (type *Bricolage Grotesque ExtraBold*, *Lexend* ou *Outfit Black*) | **À identifier précisément** |
| **Police corps des cartes** | Sans-serif **semi-grasse** lisible à petite taille (type *Plus Jakarta Sans* / *DM Sans* Bold) | **À identifier** |
| **Contour** | ≈ 3 px à 720 de large (≈ 4–5 px en 1080) | |
| **Ombre** | Décalage dur ≈ (+4, +4) px à 720, **navy plein, sans flou** | |
| **Rayon** | ≈ 10 px à 720 (≈ 15 px en 1080) | |

**Cohérence** : toutes les couleurs hors visage sont dans un vocabulaire de 4 teintes (cyan, navy, crème, blanc). La couleur de chaque outil n'apparaît que dans sa tuile de logo.

---

## 6. Ce que Will doit filmer — cahier des charges de tournage

1. **Vertical 9:16, 4K si possible** (1080×1920 minimum), **un seul plan fixe**, sans coupe — tout le dynamisme vient du montage ajouté.
2. **Buste**, tête dans le **tiers supérieur**, **laisser ≈ 25 % libre en haut** (c'est là que passent les cartes et stickers) et la **zone sous la poitrine libre** (sous-titres).
3. **Fond uni, clair et chaud** (mur beige) à 1–1,5 m derrière, **aucun objet** ; vêtement **sombre uni** (contraste avec le fond ET avec les sous-titres blancs).
4. **Lumière douce de face/côté** (fenêtre), pas de contre-jour. Éviter les reflets de lunettes.
5. **Micro-cravate** visible ou non, mais **son propre** (pas le micro du téléphone).
6. **Regard dans l'objectif tout du long** ; le texte vient d'un **téléprompteur** (la mémoire note : téléprompteur iPad OK).
7. **Parler vite et net**, **geste des mains** autorisé (cela donne de la vie ; il en existe dans la référence), **pas de pause > 0,5 s** (elles sont coupées au montage).
8. **Chaque phrase = un mot-clé fort** qui deviendra le mot cyan. Écrire le script **avec les moments visuels marqués** : `[CARTE]`, `[STICKER]`, `[B-ROLL]`.
9. **Durée cible 60–90 s** → **≈ 180–230 mots**.
10. **Durée de prise** : tourner **2 à 3 prises** complètes, garder la meilleure.

---

## 7. Éléments à produire (inventaire de la bibliothèque)

| Famille | Éléments | Variables par vidéo |
|---|---|---|
| **Gabarit de carte** | 1 coque (en-tête, numéro, corps, ombre) | titre, logo, numéro |
| **Contenus de carte** (≥ 8 types) | chat tapé · liste surlignée · frise verticale · calendrier · barres · liste de statuts · comparaison 2 barres · grille de logos | textes, valeurs, minutage sur les mots |
| **Stickers** | 3 styles : cyan, blanc à picto, navy (« COMMENTEZ ») | texte, picto, angle |
| **Pastille de progression** | 1 | n et N |
| **Logo + rôle** | 1 | logo, nom, rôle |
| **Compteur animé** | 1 | début, fin, durée |
| **Fenêtre B-roll** | 1 | clip, légende, durée |
| **Sous-titres mot à mot** | 1 moteur | transcription alignée au mot, mots-clés marqués |
| **Barre de progression** | 1 | durée |
| **Carte de fin** | 1 | marque, logos, mot-clé |
| **Transitions** | décalage de mise en page ; entrée de B-roll ; apparition sèche | — |

---

## 8. Points d'attention propres à Axion-IA (à régler AVANT le plan)

1. **Ne pas copier le fond de la vidéo** : pas les mêmes outils, pas les mêmes chiffres, pas la même marque. On reprend **le gabarit** (structure + mécaniques), pas les contenus ni la charte « Marque-Réf ».
2. **Charte** : la référence est cyan/navy/crème. Axion-IA a ses chartes (terracotta pour les pièces clients, charte des posts Buffer pour les réseaux). **Décision à prendre par Will** : charte du format = celle des posts Buffer (fond `#110A05`, mot-clé `#B44F29`, ivoire `#E9DCC8`) ?
3. **Revendications chiffrées** : l'accroche « +2 000 000 € de CA » est une promesse forte. Pour Axion-IA, tout chiffre affiché doit être **réel et justifiable** (règle DGCCRF déjà actée, jamais « gain garanti », jamais « Villeexemple »).
4. **Logos d'outils tiers** (Claude, ChatGPT, Notion…) : usage « descriptif » d'ordinaire toléré, mais à valider. Pas de logo de client sans accord (déjà éteints pour la DGCCRF).
5. **Voix** : « une seule voix partout » — ici c'est **Will lui-même** qui parle, donc pas de souci de voix de synthèse. Le format est donc **différent** des formats « avatar » déjà mis au point.
6. **Rapport avec les formats existants** : ce format recoupe (a) la **« publicité face caméra »** (analyse un créateur de référence), (b) le **« tableau animé »**, (c) la **« preuve par l'automatisation »**. À trancher : **cinquième format à part** (recommandé : le côté « cartes qui se construisent sur la parole » est distinct) ou variante d'un existant.
7. **Contrainte PC** : tout calcul lourd (rendu vidéo, transcription) → **cloud**, jamais le PC (ordre permanent).

---

## 9. Questions ouvertes pour Will (à trancher avant l'étape 2)

1. **Le son de la référence** : peux-tu l'écouter et me dire si (a) il y a de la musique, (b) il y a des bruitages sur les cartes/stickers ? Je ne l'entends pas.
2. **Charte** : cyan/navy/crème comme la référence, ou charte Axion-IA (§8.2) ?
3. **Sujet de la 1ʳᵉ vidéo** : quelle série d'éléments numérotés (« 6 outils », « 5 automatisations », « 4 erreurs »…) ?
4. **Format à part ou variante** d'un format existant (§8.6) ?
5. **Outil de montage cible** : le studio existant (génération côté serveur, voir le sous-index studio) ou autre ? Cela change la façon d'écrire les animations.

---

## 10. Ce que couvrira l'étape 2 (plan d'implémentation) — aperçu, pas encore décidé

1. Script type + **balisage des moments** (carte / sticker / B-roll) lisible par la machine.
2. **Transcription alignée mot à mot** de la prise de Will (pour le minutage des sous-titres et des apparitions).
3. **Bibliothèque de composants animés** (cartes, stickers, pastille, compteur, B-roll, fin) paramétrables.
4. **Moteur d'assemblage** : prise de Will + composants + sous-titres + B-roll → vidéo 1080×1920.
5. **Banque de B-roll** (stock, génération) classée par thème.
6. **Contrôle qualité** : image par image contre la référence (mêmes zones, mêmes durées d'entrée).
7. **Gabarit de série** : un fichier de description par vidéo (titre, N éléments, textes, mots-clés), pour en faire « de nombreuses ».

> Aucune de ces décisions n'a été prise. Ce document se limite à décrire la référence.
