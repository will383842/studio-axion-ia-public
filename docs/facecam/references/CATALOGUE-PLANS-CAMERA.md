# Catalogue des plans et mouvements de caméra — brique commune `plans` (consigne pour la session qui implémente)

> 08/10/2026, demande de Will : « rajouter tous ceux qui sont modernes et qui permettent de faire une vidéo dynamique, utilisables dans les différents types de vidéos ».
> Point de départ : la démo « une caméra → multicam » (Seedance 2.5 via Higgsfield) et la bibliothèque Eyecannndy (≈ 130 techniques, consultation manuelle, pas de connecteur).
> Maquette à valider par Will : `Maquette-plans-camera.html` (même dossier). **Rien n'est codé. Ne rien implémenter avant le feu vert de Will sur la maquette.**

## La règle qui ne se discute pas

**Quand le double PARLE à l'écran, seuls les plans de la famille C sont permis.** Un modèle qui « refilme » une scène sous un autre angle refait la bouche à son propre rythme : les lèvres ne collent plus à la voix (constaté dans la démo : jusqu'à 1,3 s d'écart). Les plans générés (famille B) sont donc **toujours muets** : illustrations, accroches, transitions, plans de coupe pendant que la voix continue.

## Les trois familles

| Famille | Fabrication | Coût | Sur la parole ? |
|---|---|---|---|
| **A. Effets de montage** | brique Montage (Remotion / FFmpeg) | 0 € | oui |
| **B. Plans générés** | Seedance / Kling, commandés via Higgsfield ou fal.ai (on **commande** leurs mouvements tout faits, on ne les refabrique pas) | payant à l'unité, **devis avant chaque lancement** | **non, toujours muets** |
| **C. Cadrages du double** | looks HeyGen par angle + recadrage au montage | déjà compté dans le double | oui |

## A. Effets de montage (gratuits)

| # | Nom Axion | Nom courant | Ce qu'on voit | Formats |
|---|---|---|---|---|
| A1 | Zoom coup de poing | punch-in | zoom net de 10-20 % sur un mot fort | tous sauf motion |
| A2 | Zoom lent | slow push | rapprochement continu à peine visible | tous |
| A3 | Coupe sèche | jump cut | on retire les blancs dans la même prise | selfie, UGC, podcast |
| A4 | Accélération-ralenti | speed ramp | le plan file puis ralentit sur le moment clé | illustrations, motion |
| A5 | Arrêt sur image | freeze frame | l'image se fige, un texte ou un chiffre apparaît | tous |
| A6 | Écran partagé | split screen | deux images côte à côte ou haut/bas | écran partagé, podcast |
| A7 | Image dans l'image | picture-in-picture | le double en vignette sur une capture | écran partagé, tutoriels |
| A8 | Changement de format | ratio switch | le cadre se resserre ou s'élargit en cours de vidéo | selfie, motion |
| A9 | Filé | whip pan | glissement flou ultra-rapide entre deux plans | UGC, selfie, motion |
| A10 | Flash | light flash | éclair blanc d'une image sur une coupe | motion, accroches |
| A11 | Rafale | quick cuts | 4-6 plans très courts en 1-2 s | accroches, motion |
| A12 | Raccord de forme | match cut | une forme devient une autre au même endroit (cercle → horloge) | motion, illustrations |
| A13 | Secousse | camera shake | petite secousse sur un impact ou un chiffre choc | UGC, motion |
| A14 | Texte derrière la personne | text behind subject | un grand mot placé ENTRE le décor et le double (le double est sans fond) | selfie, avocat (rare), UGC |
| A15 | Écrans flottants | floating UI | captures d'outils IA qui flottent en relief autour du double | écran partagé, motion, selfie |
| A16 | Photo en relief | parallax 2.5D | une image fixe prend de la profondeur | tous (illustrations) |
| A17 | Typographie animée | kinetic type | des mots plein écran qui s'animent au rythme de la voix | motion, accroches |
| A18 | Loupe | magnification | agrandissement d'une zone d'écran (un bouton, un chiffre) | tutoriels, écran partagé |
| A19 | Collage | mixed media | découpes, papier, formes superposées | motion |
| A20 | Boucle parfaite | infinite loop | la dernière image raccorde avec la première (revisionnage) | vidéos très courtes |
| A21 | Masque qui passe | object wipe | un objet traverse l'écran et révèle le plan suivant | motion, UGC |
| A22 | Bandeau nom | lower third | le prénom et le nom d'un **invité** apparaissent 3 s en bas | **podcast uniquement**, pour présenter un invité. ⛔ **Jamais dans l'avocat** ni dans les vidéos courtes « naturelles » (selfie, UGC) : décision de Will, 08/10, « ça fait trop marketing, les spectateurs risquent de sortir ». Jamais de bandeau « Williams Jullin · Axion-IA ». La marque n'apparaît qu'à la fin, pendant la dernière phrase (règle du format avocat déjà écrite). |
| A23 | Chiffres et graphiques animés | data animation | un chiffre qui compte jusqu'à sa valeur, une barre qui monte, une courbe qui se dessine | écran partagé, motion, avocat (chiffre choc) |

## B. Plans générés (payants, toujours muets)

| # | Nom Axion | Nom courant | Ce qu'on voit | Usage type Axion |
|---|---|---|---|---|
| B1 | Drone qui plonge | FPV drone | vol rapide qui traverse un open space et fonce vers un écran | accroche |
| B2 | Vertigo | dolly zoom | le sujet reste fixe, le décor s'étire | moment « prise de conscience » |
| B3 | Travelling avant | dolly push-in | la caméra avance lentement vers un bureau, un écran | ouverture |
| B4 | Tour d'objet | arc / orbit | la caméra tourne autour d'un ordinateur, d'un dossier | présentation d'un outil |
| B5 | Vue du dessus | overhead / top-down | à la verticale d'un bureau, de mains au clavier | illustration |
| B6 | Contre-plongée | low angle / worm's-eye | vue d'en bas, effet puissant | illustration |
| B7 | Vue subjective | first-person POV | « à travers les yeux » de la personne au bureau | UGC, illustration |
| B8 | Vue depuis l'objet | object POV | la caméra est « dans » l'écran et regarde l'utilisateur | illustration IA |
| B9 | Traversée | pass through | la caméra passe à travers un écran, une vitre | transition |
| B10 | Portail | object portal | on entre dans l'écran et on ressort dans une autre scène | transition |
| B11 | Macro | macro / probe lens | très gros plan sur un clavier, une puce, un stylo | illustration |
| B12 | Ralenti publicité | high-speed | café versé, feuilles qui volent, au ralenti net | accroche |
| B13 | Temps figé | bullet time | la scène est figée, la caméra tourne autour | accroche |
| B14 | Accéléré | hyperlapse / time-lapse | un bureau du matin au soir en 3 s | « gagner du temps » |
| B15 | Métamorphose | morphing | une pile de papiers devient un tableau de bord | avant / après |
| B16 | Miniature | tilt-shift / scale shift | un open space vu comme une maquette | illustration |
| B17 | Montée | crane / pedestal | la caméra s'élève au-dessus de la scène | fin de vidéo |
| B18 | Bascule de netteté | rack focus | la netteté passe du premier plan au fond | illustration |
| B19 | Lévitation | levitation | des objets de bureau flottent | motion, accroche |
| B20 | Changement de lumière | relight | même plan, la nuit devient le jour (retouche image par image) | harmoniser des plans |
| B21 | Plan muet du double | cinematic avatar (HeyGen) | Will qui entre dans un bureau, feuillette un dossier, sans parler | illustration (P3 de l'audit avatar) |

Règles de fabrication (tirées de la démo, à respecter) :
- clips de **4 à 7 s**, jamais un long passage d'un coup (sinon décalage de 1-2 s) ;
- chaque action datée **en secondes locales** dans la demande ;
- la lumière décrite **avec les mêmes mots** dans tous les plans d'une même vidéo ;
- en vue subjective, dire où est chaque objet (« à DROITE », « à GAUCHE ») ;
- **la voix d'origine est toujours reposée par-dessus** ; le son généré ne sert qu'au contrôle.

## C. Cadrages du double (sûrs pendant la parole)

| # | Nom | Fabrication |
|---|---|---|
| C1 | Trois-quarts large | look HeyGen |
| C2 | Trois-quarts serré | look HeyGen dédié (pas un zoom : HeyGen plafonne à 1080p) |
| C3 | Presque de face | look HeyGen |
| C4 | Profil | look HeyGen |
| C5 | Plan poitrine / plan large | recadrage au montage |
| C6 | Décor changé | le double est sans fond : décor au choix |

Interdits sur la parole : vertigo, tour d'objet, contre-plongée générée, toute « re-prise de vue » d'un passage parlé.

### C7 ⭐ Multicaméra (demande de Will, 08/10) — l'effet « plusieurs caméras sur un plateau »

**Ce qu'on voit :** la vidéo semble tournée par 2 à 4 caméras en même temps ; le montage passe d'un angle à l'autre pendant que Will parle, comme une émission ou un podcast pro.

**Pourquoi les lèvres restent justes :** chaque angle est un look HeyGen fabriqué **avec la même voix, au même instant** (même fichier audio, même durée). Toutes les « caméras » sont donc calées sur la même horloge : on coupe de l'une à l'autre sans aucun décalage. C'est l'inverse de la démo Seedance, où l'angle est réinventé et la bouche décroche.

**Les caméras disponibles :**
- caméra 1 = trois-quarts large (angle principal) ;
- caméra 2 = presque de face ;
- caméra 3 = profil ;
- caméra 4 = trois-quarts serré (look dédié, net) ;
- en plus, chaque caméra donne un plan large et un plan poitrine par recadrage (gratuit) → jusqu'à 8 « valeurs de plan ».

**Règles de coupe (le « réalisateur » automatique) :**
- on change d'angle **entre deux phrases ou sur une respiration**, jamais au milieu d'un mot ;
- durée d'un angle : Sobre 6-10 s, Équilibré 4-6 s, Très dynamique 2-4 s ;
- jamais deux fois de suite le même angle avec le même cadrage ;
- l'accroche (3 premières secondes) reste sur l'angle principal ; un mot fort peut déclencher le passage au plan serré ;
- dans le format avocat : angle principal ≈ 85 % du temps (règle déjà écrite dans le plan du double) ;
- pour le podcast à deux : plan sur celui qui parle, plan large des deux, plan de réaction de celui qui écoute.

**Coût :** chaque caméra supplémentaire = une fabrication HeyGen de plus, **mais seulement sur les passages où elle apparaît** (on découpe le texte par passage, on ne refait pas toute la vidéo par angle). Le studio affiche le surcoût avant de lancer. Réglage : nombre de caméras 1 / 2 / 3 / 4.

**Variante sans double (vidéo filmée en vrai avec une seule caméra) :** recadrages large / poitrine / serré sur la prise (gratuit, si la prise est en 4K) + plans générés muets (famille B) sur les passages sans visage parlant, en suivant la méthode de la démo (clips de 4-7 s, voix d'origine reposée).

**Contrôle :** le contrôle qualité vérifie à chaque changement d'angle que la bouche, la voix et le geste raccordent.

## Dosage par intensité (réglage déjà prévu Sobre / Équilibré / Très dynamique)

| | Sobre | Équilibré | Très dynamique |
|---|---|---|---|
| Effets A par minute | 2-3 | 5-8 | 10-15 |
| Plans B par vidéo | 0-1 | 1-2 | 3-5 |
| Règle | jamais deux effets forts sur la même coupe | un effet fort toutes les 4-6 s | un changement visuel toutes les 2-3 s |

Toujours : **un plan fort dans les 3 premières secondes** (accroche) ; jamais zoom + flash + bruitage sur la même coupe (déjà écrit dans la feuille de route, 2 bis).

## Défaut par format (proposition, à valider par Will)

| Format | Intensité | Effets proposés |
|---|---|---|
| Avocat | Sobre | **C7 à 3 caméras** (08/10, Will : « pourquoi pas 3 ? ») = trois-quarts large (principale, la plus présente) + **trois-quarts serré net** (look dédié, remplace le zoom qui deviendrait flou car HeyGen plafonne à 1080p) + second angle face ou profil sur 10-20 % des plans, fidèle aux vidéos de l'avocat de référence mesurées (`FICHE-STYLE-AVOCAT.md`). Pas de 4ᵉ angle : ça ferait « plateau télé » et plus « interview ». C1-C5, A1 rare, A2, A5, A14 rare ; **pas de transitions** (décision de Will) |
| Podcast à deux | Sobre / Équilibré | **C7 à 3-4 caméras**, A3, A6, A1, C1-C4 |
| Écran partagé | Équilibré | A6, A7, A15, A18, A5 |
| UGC | Équilibré / Très dynamique | A3, A9, A13, A14, B7 (pas de multicaméra : le style « téléphone » est à une seule caméra) |
| Selfie | Équilibré / Très dynamique | C7 à 2 caméras (option), A1, A3, A8, A14, A15 |
| Motion design | Très dynamique | A4, A10-A12, A17, A19, A21, B1, B9, B10, B15 |

## Contrôle (après fabrication)

Chaque vidéo passe le **contrôle qualité** (brique 10) inspiré de « Watch » : quelques images par plan + transcription datée, Claude vérifie (sous-titres calés, texte coupé, image noire, plan généré raté, lèvres). Fiche « 3 points à corriger, à 0:12, 0:47, 1:05 » avant validation par Will.

## Branchement : tout est centralisé (décision 08/10)

- Chaque plan du catalogue est **un élément de la Bibliothèque commune** (type `plan`), comme les styles de sous-titres, les LUT et les bruitages. Il est construit **une seule fois** dans la brique Montage (A, C) ou commandé à l'outil connecté (B).
- Chaque format (moteur) **ne recopie rien** : il pointe vers les plans voulus dans ses `stylesParDefaut` (tableau « Défaut par format » ci-dessus). Un nouveau format choisit ses plans dans le même catalogue ; un nouveau plan ajouté au catalogue devient disponible pour tous les formats.
- Will garde la main à chaque vidéo : il ajoute ou retire des plans dans la tuile « Plans ».
- Les plans comptent dans le **régulateur d'intensité global** (`INTENSITE-ET-BRUITAGES.md`) : zooms, bandeaux, plans générés, changements d'angle et bruitages sont additionnés, pour qu'aucune vidéo ne soit surchargée.

## Interface (voir maquette)

Dans le bloc Style de chaque vidéo : tuile **« Plans »** → grille de cartes avec aperçu animé de 2 s, filtre par famille, coût affiché sur les plans B, cadenas sur les plans interdits pendant la parole. Le format pré-coche ses effets par défaut ; Will en ajoute ou en retire.
