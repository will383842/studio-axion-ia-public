# TACHE V4-2 · Même échelle que la v4, une fin par réseau, écriture calée sur la v4

Dépôt `studio-axion-ia`, branche `cas-concret/v4-fidele-2` (déjà créée, depuis `master` à jour : la PR #176 de V4-1 est fusionnée). UNE PR vers `master`. Ne fusionne rien, ne déploie rien, **aucun appel réel** (HeyGen, Claude, écriture R2). Tout en français. Lis d'abord `docs/REGLES-ROUTINES.md`, `cas-concret/TACHE-V4-1.md` (contexte, toujours valable), `docs/formats/v4-reference/INVENTAIRE.md`, `RAPPORT-ECARTS.md` et le compte rendu de la PR #176.

## Décisions de Will (14/10/2026)

1. **« Option 1 comme la v4 »** : les vidéos du format utilisent TOUT l'écran comme la v4 (objets jusqu'à ≈ 82 % de la hauteur, sous-titres ≈ 83 %, fil ≈ 92 %, texte sur toute la largeur), pas la zone sûre commune des réseaux (bas 30 %). Les boutons des réseaux pourront recouvrir une partie du bas : Will l'accepte, la v4 a été publiée telle quelle.
2. **La fin dépend du réseau** (« c'est la fin qu'il fallait faire attention »). Une vidéo par groupe de réseaux avec SA fin : Facebook et LinkedIn « le lien vous attend en premier commentaire » ; Instagram et TikTok « le lien est dans la bio » (les liens des commentaires n'y sont pas cliquables). Références : `docs/formats/v4-reference/v10-facebook-linkedin.mp4`, `v10-instagram-tiktok.mp4`, `PUBLIER.md`. Chaque fin doit être DITE EN ENTIER (aucune coupure en plein mot).
3. La v4 reste LA référence de style (« presque parfaite ») ; ses défauts connus : voix coupée net en fin de fichier (déjà contrôlée par `fin-de-voix.ts`, PR #176).

## MISSION D · L'échelle et la géométrie de la v4 (cœur de la tâche)

- Le format doit rendre ses écrans avec la géométrie de la v4 : échelle 1,0 (titre d'étape ≈ 190 px, téléphone ≈ 49 % de la hauteur), sous-titres à ≈ 83 %, fil à ≈ 92 %, centre horizontal exact (le décalage de 65 px vers la gauche vient de la zone sûre de TikTok : le supprimer). Utilise `docs/formats/v4-reference/INVENTAIRE.md` et le banc `outils/v4-fidelite/` pour viser ces valeurs.
- **Propre au cas concret** : une zone « pleine image » passée par `fabriquer.ts` à `proprietesEcrans` pour ce format seulement ; NE MODIFIE PAS le comportement des autres formats (tableau animé, avocat, face caméra) ; si tu touches `src/briques/ecrans-motion/`, un test doit prouver que leurs rendus ne changent pas.
- Garde la règle « les objets sont au-dessus des sous-titres, jamais dessous » (c'est aussi l'ordre de la v4). Adapte le test de la PR #171 (`tests/cas-concret/fidelite-v4/zone-objets.test.ts`) et `tests/cas-concret/fabriquer/raccords.test.ts` à la nouvelle zone, avec la raison dans le test.
- Cible mesurée : recouvrement des formes (IoU) moyen ≥ 0,80 sur les 17 plans de la v4, aucun plan sous 0,60, avec le banc de V4-1 ; rapporte le tableau avant / après dans `RAPPORT-ECARTS.md`. Tu ne peux pas juger le mouvement : dis-le.
- Reprends aussi, si l'échelle le permet : l'annonce recadrée et zoomée comme dans la v4 (point 5 du reste à faire de V4-1) ; le second écran qui glisse au rendez-vous (point 6) ; sinon liste-les comme restants. **L'image de l'annonce est DÉJÀ déposée** dans le stockage (`visuels-cas-concret/recrutement-apporteurs/annonce.png`, vérifiée identique à `rushes/pub.png`) : ne cherche pas à la téléverser.

## MISSION E · Une fin par réseau

La banque commune des fins (`src/briques/fins/banque.ts`, validée phrase par phrase par Will, ne la modifie pas) porte déjà les fins par réseau. Vérifie et corrige la chaîne du cas concret :
1. Une fabrication pour plusieurs réseaux produit bien UNE sortie par réseau (ou par groupe de réseaux de même fin), chacune avec la fin de la banque pour CE réseau (Facebook/LinkedIn : lien en premier commentaire ; Instagram/TikTok : lien dans la bio ; respecte les règles LinkedIn existantes de la banque). Compare aux deux références v10.
2. Chaque sortie passe SÉPARÉMENT le contrôle `controlerFinDeVoix` (V4-1) : la dernière phrase de CETTE sortie est entièrement dite ; sinon l'étape voix échoue avec la phrase claire déjà prévue.
3. Les liens suivis (`utm_source` par réseau) suivent `PUBLIER.md`.
4. Tests : une fabrication simulée à 4 réseaux → 2 fins distinctes aux bons mots ; une fin coupée sur UNE sortie seulement refuse cette sortie ; les autres formats inchangés. Dis ce que tu ne peux pas vérifier sans la vraie voix.

## MISSION F · L'écriture suit la v4 (sans appel payant)

Les essais réels ont donné : accroche « 1 HEURE. » au lieu de « 15 MINUTES. » (la promesse du cas), durée de 48 à 56 s au lieu de 41 s, texte plus sec que la v4 (la v4 : « Oui, quinze minutes. Avant, c'était ça : … Alors on a tout automatisé. »). Améliore `CONSIGNE_ECRITURE` et ce qui l'entoure (`src/moteurs/montage-cas-concret/ecriture.ts`, `fiche-fixe`, exemples) pour que, pour n'importe quel cas :
- l'accroche (e01 puis le premier chiffre) mette en avant la PROMESSE du cas (ex. « 15 minutes »), pas le « avant » ;
- la durée visée de la sortie la plus courte soit proche de celle de la v4 (≈ 40 à 45 s pour ce cas), sans dépasser 50 s ;
- le ton reprenne celui de la v4 (voir `docs/formats/v4-reference/voix4.json` : tournures parlées, rythme, « Alors on a tout automatisé »), avec un exemple de la v4 dans la consigne si utile.
Les règles dures (faits, nombres, R01 à R22) ne changent pas ; les tests existants doivent rester verts ; ajoute des tests rouges d'abord sur ce qui se teste sans modèle (consigne contient l'exemple, bornes de durée, ordre accroche→promesse). **Tu ne peux pas vérifier la qualité du texte rendu par le vrai modèle** : n'invente rien, dis-le et prévois comment Will la jugera (un essai réel payant avec son accord).

## Contraintes générales

- Opus ; tests rouges avant le code ; `pnpm exec tsc --noEmit`, eslint sur les fichiers touchés, vitest sur `tests/cas-concret` et ce que tu touches ; résultats EXACTS dans la PR. Rouges connus à ne pas t'attribuer sans les avoir rejoués sur `master` : `tests/cas-concret/services/boucle.test.ts` ×2 (fins de ligne Windows) et des tests de services instables sous charge.
- Ne touche PAS à `src/moteurs/*/recette-voix.ts` ni `docs/voix-reference/` (autre session, PR #174). Avant d'ouvrir la PR : `gh pr list` + `gh pr diff --name-only` sur les PR ouvertes (#174, #167…) et signale tout recouvrement.
- Aucune dépense ; n'invente aucun fait sur Axion-IA.
- À la fin, dans la PR : mesuré / pas mesuré / reste à faire, et « PRÊTE : oui / non ».
