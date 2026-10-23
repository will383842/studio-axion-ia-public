# Fiche témoin de la vidéo 1 (T1, T1b)

Prouve que le portage reproduit la vidéo validée par Will, avant toute dépense.

- `fiche-temoin.ts` : la fiche d'écrans écrite à la main (17 écrans du corps, textes mot pour mot de `reference/texte.txt`), la fin (la fin Facebook d'aujourd'hui depuis X6 : le diagnostic, puis le lien en commentaire, tirée de la table des fins ; `motsDitsTemoin` garde la voix de la référence pour le corps et pose les mots de cette fin à la suite) et `ecransCales` (fiche calée → écrans de la brique `ecrans-motion`). Les vrais écrans (publicité, formulaire, page du rendez-vous) sont les fichiers de `reference/rushes/` (`capturesTemoin`) ; la bande des sous-titres est celle du format (`BANDE_SOUS_TITRES_CAS_CONCRET`, 8 %, `src/formats/cas-concret/index.ts`), appliquée par `proprietesTemoin` ; les barres du résultat (« +1 H », « 15 MIN ») sont tirées des faits du cas par la chaîne (`texteBarre`) ; la page du rendez-vous part du calendrier (`departPage` de e09).
- `temoin.test.ts` : forme, texte, règles (dérogations nommées et pinnées par écran), calage sur `reference/mots.json`, propriétés et contrôle avant rendu (aucun refus), f02, f03, résultat, vrais écrans.
- `planche.mts` : rend 12 images fixes aux instants des `reference/ref-<t>.jpg` par la racine du rendu et les pose à côté de la référence.
- `planche/` : la dernière planche commitée. `temoin-<t>.jpg` (1080 × 960, référence à gauche, studio à droite, sans cadre ajouté) et `zones-<t>.jpg` (la même, avec la zone de texte en bleu et la bande des sous-titres en rose).

## Commandes

Tests :

    pnpm vitest run tests/cas-concret/temoin

Planche (routine cloud ou serveur, jamais le PC de Will ; rendu local gratuit, sans voix ni service payant) :

    npm --prefix studio-rendu ci
    pnpm exec tsx tests/cas-concret/temoin/planche.mts [dossier de sortie]

Sortie par défaut : `tests/cas-concret/temoin/planche/` (plus `planche-temoin.jpg`, vue d'ensemble, non commitée). Navigateur : `STUDIO_RENDU_NAVIGATEUR=/chemin/chrome`, sinon celui de Playwright. Le film du formulaire est assemblé par `ffmpeg` (variable `FFMPEG`, sinon celui du système, sinon celui de Remotion).

## À savoir

- Les sous-titres ne sont pas dessinés sur la planche (ils sont posés au montage) : la référence les montre.
- Dérogations : voir le commentaire de `DEROGATIONS_TEMOIN` ; la fiche refuse R03, R07, R08, R12, R17, jamais à cause du texte validé qu'on aurait changé.
