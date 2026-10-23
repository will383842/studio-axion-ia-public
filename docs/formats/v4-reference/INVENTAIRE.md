# Inventaire de la v4 · scène par scène

Source : `v4.html` (montage piloté par le temps), `voix4.json` (texte et heure de chaque mot), `v4.mp4` (41,24 s,
1080 × 1920, 30 i/s). Heures des plans relevées en exécutant `v4.html` (`window.pret`) ; heures des mots = `voix4.json`
÷ 1,08 (`TEMPO`, la voix est accélérée de 8 %). Un plan démarre au début d'un mot-repère moins une avance (colonne
« Départ »). Fin de la vidéo = fin du dernier mot + 1,5 s.

Tailles en px sur 1080 × 1920. Polices : **Anton** (« Cond », affiches, toujours en capitales, interligne 1,04) et
**Inter Bold** (« Texte », étiquettes, lignes, puces). Montserrat Black est livrée dans `polices/` mais **pas utilisée**.

## Éléments constants (la grammaire)

| Élément | Valeur |
|---|---|
| Fonds | **Sombre** `D` : dégradé radial 900 × 700 px centré à 50 % / 78 % : `#7A3418` → `#2A150B` (45 %) → `#0D0704` (80 %). **Ivoire** `I` : dégradé radial 1000 × 900 px à 50 % / 45 % : `#FBF8F3` → `#EFE9DF` (75 %). Les deux alternent. |
| Couleurs | nuit `#110A05`, orange `#C2532A` (accent sur ivoire), orange vif `#F0703C` (accent sur sombre, lueurs, fil, éclair), ivoire `#F4EFE7`, gris `#8A7C6E` (lignes sur ivoire), `#C9B8A6` (lignes sur sombre), vert `#22A55B` (coches), encre `#15100C`. |
| Étiquette `.lab` | Inter 28 px, capitales, approche 9 px, centrée, orange (vif sur sombre) ; à 250 px (étapes, avant, résultat), 330 ou 560 px ailleurs. |
| Affiche `.mm` | Anton, capitales, centrée sur 40–1 040 px, une ligne (`nowrap`), réduite de 4 px en 4 px si elle déborde (`data-fit`). Mot balisé `*mot*` en orange. |
| Lueur `.lueur` | `text-shadow: 0 0 60px rgba(240,112,60,.75), 0 0 140px rgba(240,112,60,.45)` sur les mots-clés des plans sombres. |
| Ligne `.ligne` | Inter 42 px (46–50 px en fin), centrée sur 60–1 020 px, gris. |
| Gabarit d'étape | « Étape 0n » à 250 px · titre Anton 190 px à 300 px · ligne Inter 42 px à 540 px · objet à partir de 640 px (téléphone 470 × 920 px à x 305). |
| Téléphone `.tel` | 470 × 920 px, coins 76 px, corps `#0C0C0E`, bord 14 px, écran à coins 62 px ; vrai écran glissé dedans ; **de biais** en 3D. |
| Puce `.puce` | pastille blanche, Inter 44 px, rond vert 56 px à coche blanche, ombre ; surgit avec rebond. |
| Fil `#fil` | orange vif, 6 px, de x 60 px à 960 px de long, à 150 px du bas (y ≈ 1 764) ; seulement sur les étapes : `960 × (n − 1 + avance) / 6`. |
| Sous-titres `#st` | Inter 42 px / 1,2, centrés sur 60–1 020 px, **à 1 600 px** (83 %), sous les objets ; mots forts en orange vif ; blanc cassé sur sombre, `#3A2F26` sur ivoire ; lots de 5 mots / 24 signes. |
| Éclair `#eclair` | voile orange vif, 0,55 → 0 en 0,14 s, au début de s2, s6 et s17. |
| Particules | 16 points de 8 px `#FFB38C` qui montent lentement, sur les plans sombres lumineux (s2, s6, s13, s20). |
| Ombres | ivoire : `0 60px 120px rgba(40,20,8,.35), 0 12px 30px rgba(40,20,8,.18)` ; sombre : `0 60px 130px rgba(0,0,0,.7)`. |

### Animations (fonctions de `v4.html`, reprises à l'identique par `studio-rendu/compositions/cas-concret/plans/commun.ts`)

| Nom | Effet |
|---|---|
| Entrée de plan | opacité 0,35 → 1 et zoom 1,04 → 1 en 0,2 s (courbe `doux`, cubique). Coupe franche entre plans. |
| `mots` | chaque mot entre à son tour : pas 0,09 s (0,1 à 0,16 selon le plan), durée 0,34 s, montée de 60 px, flou 12 px → 0. |
| `entrer` | objet : opacité ×2,5, montée de 90 px, zoom 0,93 → 1 (durée 0,35 à 0,45 s). |
| `biais` | perspective 1 900 px, rotation Y −11° (± 3° en sinus lent 0,9) et X 5° (± 1,6°, 0,7) : l'objet bouge toujours un peu. |
| `surgir` | puce ou coche : opacité ×3, zoom 0,6 → 1 avec rebond (dépassement 1,7), légère rotation (−5° à 5°). |
| `onde` | rond orange de 110 px qui grandit (0,4 → 1,4) et s'efface en 0,4 s : le doigt touche l'écran. |
| Courbes | `doux` (sortie cubique), `va` (entrée-sortie cubique), `rebond`. |

Rythme : 17 plans en 41,3 s (2,4 s par plan en moyenne), mais quelque chose bouge toutes les 0,3 à 1,6 s dans chaque
plan (mot, ligne, puce, coche, onde), toujours sur un mot de la voix.

## Les plans

« Fixe » = grammaire, identique quel que soit le script. « Variable » = ce qui dépend du contenu du cas.

| Plan | Heures | Départ | Fond | Type | Texte affiché | Objet et animation | Fixe / variable |
|---|---|---|---|---|---|---|---|
| s1 | 0,00–1,64 | 0 | sombre | accroche | « RECRUTEMENT · CAS RÉEL » (560 px) ; « On recrute » 230 px (630) ; « nos collaborateurs » 150 px (890) ; « *en…* » 230 px (1 080) | — ; trois lignes mot par mot, la 2e sur « collaborateurs », la 3e sur « en » | fixe : étiquette, lignes Anton empilées, mot par mot calé sur la voix ; variable : textes, tailles des lignes |
| s2 | 1,64–3,40 | « quinze » − 0,08 | sombre | chiffre | « 15 » 720 px orange vif lumineux (330) ; « minutes. » 230 px (1 090) ; pastilles « 0 CV à trier », « 0 relance », « 0 papier » (1 400) | le chiffre arrive flou (18 px) et grand (1,5 → 1) en 0,3 s ; pastilles à bord clair, l'une après l'autre (0,16 s) sur « Oui » ; éclair ; particules | fixe : chiffre géant, unité, 3 pastilles ; variable : nombre, unité, pastilles |
| s4 | 3,40–12,64 | « avant » − 0,1 | ivoire | liste « avant » | « AVANT » ; « C'était *ça.* » 170 px (300) | fiche blanche 860 px (560) : 6 rangées à case (Inter 50 px), chacune sur son verbe ; sur « Plus » la liste tremble et pâlit (40 %) ; pastille orange « +1 H » 170 px + « pour chaque personne » surgit (520, 1 150) | fixe : fiche à cases, tâches sur leur verbe, tremblement, pastille du total ; variable : tâches (6), total |
| s6 | 12,64–13,84 | « alors » − 0,1 | sombre | titre (bascule) | « Alors on a » 190 px (640) ; « tout *automatisé.* » 250 px lumineux (870) | éclair ; particules ; 2e ligne sur « tout », pas 0,16 s | fixe ; variable : textes |
| s7 | 13,84–15,16 | « voit » − 0,45 | ivoire | étape 01 | « ÉTAPE 01 » ; « L'*annonce* » ; « Elle la voit sur Facebook. » | téléphone de biais avec **l'annonce** (`rushes/pub.png`, 505 px de large, recadrée) qui zoome 1,02 → 1,12 et monte de 60 px pendant le plan | fixe : gabarit d'étape, téléphone ; variable : image |
| s8 | 15,16–16,86 | « s'inscrit » − 0,25 | ivoire | étape 02 | « L'*inscription* » ; « Toute seule. En vingt secondes. » | téléphone (biais inverse) : le formulaire se remplit (29 images `rushes/form/`, frappe jusqu'à « vingt ») ; puce « Inscrite » sur « vingt » + 0,15 s | fixe ; variable : film de frappe, puce |
| s9 | 16,86–18,74 | « reçoit » − 0,25 | sombre | étape 03 | « Les *e-mails* » ; « Ils partent tout seuls. » | pile de 2 notifications (900 × 190 px, icône « A » orange, « Axion-IA », sujet) ; la 1re sur « reçoit », la 2e sur « e-mails », coche verte 0,35 s après | fixe : notifications empilées, coches ; variable : sujets |
| s10 | 18,74–20,42 | « choisit » − 0,25 | ivoire | étape 04 | « Le *rendez-vous* » ; « Elle le choisit elle-même. » | téléphone : la page du rendez-vous défile (`rdv-entier.jpg`, de 900 à 1 560 px) ; onde sur « elle-même » ; sur « son » un 2e écran glisse de la droite (`rdv-2.jpg`), onde sur « rendez-vous » ; puce « Réservé sans nous » | fixe ; variable : écrans, points touchés |
| s11 | 20,42–22,59 | « oublie » − 0,48 | sombre | objet | « Elle *oublie ?* » 190 px (290) ; « Le rappel part tout seul. » (520, sur « rappel ») | téléphone écran nuit « 09:41 » ; la notification « Rappel : notre échange demain à 14:00 » tombe sur « rappel » (rebond) et le téléphone vibre (± 2,2°) | fixe ; variable : texte de la notification |
| s12 | 22,59–24,87 | « nous » − 0,1 | sombre | étape 05 | « La *visio* » ; « Là, c'est nous. » | anneau de 740 px (trait 30 px) qui se remplit en 0,55 s sur « Quinze », compteur 0 → 15 (340 px orange vif), « minutes » 80 px, petit battement | fixe : anneau + compteur ; variable : nombre |
| s13 | 24,87–25,97 | « c'est » − 0,08 | sombre | titre | « Notre seul » 230 px (650) ; « *travail.* » 330 px lumineux (920) | particules ; 2e ligne sur « travail » | fixe ; variable : textes |
| s14 | 25,97–29,44 | « derrière » − 0,1 | ivoire | étape 06 | « Le *contrat* » ; « Il part tout seul. » → « Elle signe sur son téléphone. » (sur « signe ») | contrat 620 × 800 px de biais, ses 8 lignes se tracent ; puce « Envoyé tout seul » sur « part » ; signature tracée en 0,7 s sur « signe » ; puce « Signé » sur « téléphone » | fixe ; variable : puces, ligne qui change |
| s16 | 29,44–30,50 | « dossier » − 0,28 | sombre | objet | « Dossier *classé.* » 230 px (330) | dossier orange 600 × 640 px : la feuille descend dedans, coche blanche à trait vert sur « classé » | fixe ; variable : — |
| s17 | 30,50–32,78 | « résultat » − 0,1 | ivoire | résultat | « RÉSULTAT » ; « Des heures *gagnées.* » 190 px ; « AVANT » / « MAINTENANT » ; « à chaque recrutement » (sur « chaque ») | barre noire « +1 H » (900 px, 130 px Anton) qui s'étire en 0,5 s ; barre orange « 15 MIN » (520 px, rebond) sur « heures » ; éclair | fixe : deux barres, libellés ; variable : valeurs |
| s18 | 32,78–35,82 | « dans » − 0,18 | sombre | question | « Et dans votre » 170 px (560) ; « *entreprise ?* » 290 px lumineux (770) ; « Quelle tâche pourrait tourner toute seule ? » Inter 50 px (1 140, sur « quelle ») | — | fixe ; variable : question |
| s19 | 35,82–37,67 | « écrivez » − 0,1 | ivoire | appel au mot | « POUR RECEVOIR LE PLAN » (330) ; « Écrivez » 250 px (390) ; « en *commentaire.* » 190 px (1 100) | champ de commentaire 900 × 260 px de biais : « PLAN » se tape (170 px orange) avec curseur, bouton d'envoi orange | fixe ; variable : mot |
| s20 | 37,67–41,31 | « envoie » − 0,32 | sombre | promesse | « On vous envoie » 170 px (560) ; « *le plan.* » 330 px lumineux (770) ; « de cette machine, en message privé » 46 px (1 200) ; « Axion-*IA* » 90 px (1 370) | particules ; signature à la fin | fixe ; variable : cadeau |

Pas de plan s3, s5 ni s15 (numérotation d'une version précédente).

## Sons

Bruitages posés par `v4.html` (`window.SONS`) : `illustration-forte` à chaque changement de plan, `impact` sur 7 mots
forts, `document` sur chaque tâche, `telephone` sur les notifications, `chiffre` sur les puces, une rafale sur la frappe
et sur le compteur de 15. Voix : `voix4.wav` (42,9 s avant tempo), **coupée net dans « machine »** (39,73 s : −20 dB,
puis silence numérique ; HeyGen date la fin du mot à 39,81 s), puis 1,5 s de silence.

## Ce que la v4 ne fait pas (et que le format fait)

- Aucune marque « axion-ia.com » en haut.
- Aucune zone sûre : objets jusqu'à 82 % de la hauteur, sous-titres à 83 %, fil à 92 %, texte sur 40–1 040 px.
