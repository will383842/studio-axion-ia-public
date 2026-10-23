# TACHE V4-1 · Le format « Cas concret » doit fabriquer des vidéos du niveau de la v4

Dépôt `studio-axion-ia`, branche `cas-concret/v4-fidele` (déjà créée, depuis `master`). UNE PR vers `master`. Ne fusionne rien, ne déploie rien, **aucun appel réel** (HeyGen, Claude, R2 d'écriture). Tout en français. Lis d'abord `docs/REGLES-ROUTINES.md`.

## Pourquoi (décision de Will, 14/10/2026)

Will a jugé « catastrophiques » deux essais réels du format (vidéos `v-3a71b4a4dfea` et `v-581c8f8377b7`) : « le motion design ne va pas du tout, celui de la v4 était parfait ». **La v4 est la RÉFÉRENCE** de toutes les vidéos du format, quel que soit le script : mêmes polices, même mise en page, mêmes gabarits, même grammaire d'animation, même rythme. Seuls changent les contenus (textes, objets, écrans montrés) et les animations propres à chaque contenu.

La v4 est `docs/formats/v4-reference/v4.mp4` (41,2 s, 1080×1920, 30 i/s). Ses sources : `v4.html` (montage piloté par le temps), `voix4.json` (texte et heure de chaque mot de la voix), `voix4.js`, `polices/` (Anton, Inter, Montserrat), `rushes/` (annonce `pub.png`, pages du site, images de rendez-vous, séquence du formulaire), `planche-de-controle-v4.jpg`. Elle a été fabriquée hors du studio ; le studio a son propre moteur de dessin (`studio-rendu/compositions/cas-concret/`, `src/briques/ecrans-motion/`) qui NE reproduit PAS la v4.

## Écarts déjà MESURÉS entre la v4 et la dernière vidéo du format (images rapprochées, 14/10)

1. Les sous-titres passaient par-dessus les objets (corrigé en partie par la PR #171 : les objets s'arrêtent au-dessus de la bande ; effet de bord : objets ≈ 30 % de la hauteur contre ≈ 48 % dans la v4, tiers du bas vide).
2. L'écran « L'annonce » montre un téléphone VIDE : l'étape demande l'objet `telephone-capture` sans que personne ne lui fournisse l'image de l'annonce (la v4 y met `rushes/pub.png`).
3. Accroche chiffrée : la v4 met en avant « 15 MINUTES. » (grand chiffre orange lumineux, trois pastilles « 0 CV à trier / 0 relance / 0 papier ») ; le format met « 1 HEURE. » en avant.
4. Marque « axion-ia.com » en haut de chaque écran : absente de la v4 (à confirmer avec Will, ne change rien sans lui).
5. Durée : la v4 fait 41 s ; le format 48 s puis 56 s.
6. **Voix coupée net à la fin dans la v4 elle-même** : à 39,70 s la voix est à −21,6 dB, à 39,75 s silence numérique (−180 dB) : coupure au milieu du dernier mot (« machine »), puis 1,5 s de silence mort. Cause connue : l'heure de fin d'un mot rendue par HeyGen tombe 0,1 à 0,25 s trop tôt. Will l'a relevé : « le texte n'est pas dit jusqu'au bout ». À corriger DANS le format (voir MISSION C) ; la v4 reste le modèle de style, pas de ce défaut.

## MISSION A · Inventaire et mesure (d'abord, rien d'autre avant)

1. `docs/formats/v4-reference/INVENTAIRE.md` : la v4 scène par scène, d'après `v4.html` et `voix4.json` : heure de début et de fin, type de scène (accroche, liste « avant », titre, étape numérotée, objet, chiffre, résultat, question, fin), fond (sombre / ivoire), texte exact, objet montré, animations (entrée, sortie, flou, montée, courbes, durées), éléments constants (fil orange en bas, étiquette, gabarit d'étape), polices et tailles, couleurs. Pour chaque scène : ce qui est FIXE (grammaire) et ce qui dépend du contenu (variable).
2. Un **banc de mesure** `outils/v4-fidelite/` : (a) extrait des images de la v4 à des instants donnés (ffmpeg) ; (b) rend les mêmes instants avec le moteur du format à partir du MÊME texte et des MÊMES heures de mots (fiche équivalente à la v4, voir `src/formats/cas-concret/catalogue/recrutement-apporteurs.ts`) ; (c) compare image par image (SSIM par scène, planche côte à côte, rapport chiffré) ; (d) écrit `docs/formats/v4-reference/RAPPORT-ECARTS.md` : un score par scène et la liste des écarts. Si le rendu Remotion est impossible dans cet environnement (navigateur absent), dis-le clairement et fournis le banc prêt à tourner + une comparaison par composants (positions, tailles, polices, couleurs lues dans le code et dans `v4.html`).

## MISSION B · Mettre le dessin du format au niveau de la v4

À partir du rapport de la mission A, dans `studio-rendu/compositions/cas-concret/` et la mise en page qui l'alimente : reproduire la grammaire de la v4 (polices, tailles, couleurs, fils, gabarit d'étape, vrais écrans glissés dans un téléphone de biais, rythme d'un changement visible toutes les ~1,6 s, entrées mot par mot) pour que le format, nourri du script de la v4, redonne une vidéo proche de la v4 (cible : SSIM moyen mesuré ≥ 0,90 par scène, ou, à défaut, tableau des écarts restants et pourquoi). Règles :
- GÉNÉRALISER : rien de câblé sur le cas « recrutement » ; les gabarits prennent leurs textes, objets et écrans de la fiche. Les objets propres à un autre cas (autre automatisation) gardent le même style (même grammaire) avec leurs propres animations.
- **Corriger l'étape « L'annonce »** : l'objet `telephone-capture` doit recevoir une image d'annonce (champ du cas : `visuel.image` ou équivalent, avec repli) ; le cas `recrutement-apporteurs` pointe sur `rushes/pub.png` (à copier là où le studio sert ses images publiques/captures de façon légitime ; si une image doit être téléversée, décris la marche exacte, ne téléverse rien).
- Le test de la PR #171 (objets au-dessus des sous-titres) peut devoir changer : la v4 place ses sous-titres tout en bas, sous les objets. Choisis ce qui reproduit la v4 SANS passer sous les boutons des réseaux pour la zone sûre commune ; explique le choix et mesure-le.
- Ne casse AUCUN autre format (tableau animé, avocat, face caméra) : pas de modification de `src/briques/ecrans-motion/` qui change leur rendu sans test qui le prouve.

## MISSION C · La voix ne doit jamais être coupée avant la fin du texte

1. Dans le montage du format : ne jamais couper la voix à l'heure de fin d'un mot donnée par le fournisseur ; couper et raccorder seulement dans un silence MESURÉ (`silencedetect`), garder une courte fin naturelle.
2. **Contrôle bloquant avant livraison** : la dernière phrase du script doit être entièrement prononcée (comparer la durée sonore utile à l'heure de fin du dernier mot + marge, niveau sonore en fin de piste : une chute brutale à −60 dB ou moins en plein mot = refus), sinon l'étape échoue avec une phrase claire. Test avec la v4 comme cas rouge (la voix de la v4 est coupée net) et un cas vert.
3. NE TOUCHE PAS à `src/moteurs/*/recette-voix.ts` ni à la voix de référence (`docs/voix-reference/`, branche `voix/reference-et-fin-propre`) : une autre session y travaille. Avant d'ouvrir la PR, `gh pr list` et `gh pr diff --name-only` sur les PR ouvertes ; signale tout recouvrement dans la PR.

## Contraintes générales

- Opus pour toi ; tests rouges avant le code ; `pnpm exec tsc --noEmit`, eslint sur les fichiers touchés, vitest sur `tests/cas-concret` et sur tout ce que tu touches ; résultats EXACTS dans la PR (les rouges connus sur `master` : `tests/cas-concret/services/boucle.test.ts` ×2 à cause des fins de ligne Windows, plus des tests de services parfois instables sous charge : ne les attribue pas à ton travail sans les avoir rejoués sur `master`).
- Aucune dépense : pas d'appel HeyGen, Claude réel, ni écriture R2. Rendu simulé ou local seulement.
- N'invente aucun fait sur Axion-IA ; le texte de la v4 est celui validé par Will.
- À la fin, dans la PR : ce qui est mesuré, ce qui ne l'est pas, ce qui reste (liste honnête), et une phrase « PRÊTE : oui / non ».
