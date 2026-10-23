# Cas concret MD · essai réel

Mode d'emploi pour la **session locale du studio**, après le feu vert de Will sur la dépense. Il sert aux essais 1 à 4 (une vidéo par offre). **Rien n'est publié** pendant l'essai : ni Buffer, ni réseau.

## 1. Avant de commencer

- Le format est en ligne, statut `masque` : l'écran se visite par son adresse, `/cas-concret` (aucun lien dans les menus).
- Voix HeyGen prête (Personnages › Voix) : celle désignée pour « Vidéo type avocat », sinon la voix habituelle. Budget du mois non atteint. Stockage et rendu reliés : sinon la fabrication est refusée avant toute dépense.
- Dépense attendue : moins de 1 € par vidéo (le montant est sur le bouton).

## 2. Parcours dans l'interface

### Essai n° 1 : la vidéo témoin

1. Ouvrir `/cas-concret`.
2. Écrire « Fais la vidéo sur le recrutement des apporteurs » : la carte « Recrutement des apporteurs » arrive en premier. L'ouvrir (ce cas est déjà valide).
3. Laisser les 4 réseaux cochés. « Avec le mot » est grisé (aucun mot n'est branché) : la vidéo finit sur le diagnostic.
4. Cliquer sur **« Fabriquer la vidéo »** après avoir lu le montant, puis suivre la fiche vidéo (`/videos/<id>`) étape par étape.
5. Quand les fichiers sont prêts, **ne rien publier** : télécharger les fichiers, ne rien copier ailleurs.
6. Lancer la planche de contrôle sur le serveur (§ 4) et la joindre aux relevés.

### Essais n° 2, 3, 4 : formation, audit, intégration

Même parcours pour `compte-rendu-dicte`, `audit-une-journee` et `devis-signe-alerte`, par **« Fabriquer un essai »** (la session valide le cas au nom de l'essai). La fiche vidéo porte la pastille « Essai : cas à confirmer par Will, ne pas publier ». Vérifier à l'écoute :

- aucune phrase ne dit « chez nous » pour un cas de posture « offre » ;
- la fin dit « Faites votre diagnostic gratuit en quelques minutes. » puis la phrase du lien du réseau ; jamais « Réservez » ;
- seuls des faits écrits sur le site sont dits.

## 3. Quoi relever

À reporter dans la section « Résultats » ci-dessous.

| Relevé | Comment | Cible |
|---|---|---|
| Durée de chaque étape et total | fiche vidéo, journal | total < 15 min |
| Coût | « Ce que la vidéo a coûté », comparé à Réglages › Budget | < 1 € |
| Mémoire du rendu | `docker stats studio-rendu` pendant « Les écrans » et « Les finitions » | pic < 3 Go |
| Durée et dimensions de chaque fichier | fiche vidéo | 40 à 60 s ; 1080 × 1920 |
| Volume, crête | rapport | −14 ± 1 ; ≤ −1,5 |
| 12 images clés par fichier | commande du § 5 | marque présente, rien hors zone, sous-titres lisibles sur les deux fonds |
| Voix : pire écart, débit, prises rejetées, reformulations | journal de la voix | écart ≤ 450 ms ; 3,0 à 3,9 mots par seconde |
| Distribution des écarts entre mots | journal | sert à régler les trois seuils |
| Captures : faites ou remplacées | rapport | l'agenda de `/fr/appel` s'affiche-t-il ? |
| Aucun envoi réel | console du site, candidatures du jour | aucune fiche « Camille » ; `requetesBloquees` relevé |
| Reprise | arrêter le rendu une fois, relancer | voix non relue, coût 0 |
| Écart avec la vidéo 1 | lecture côte à côte | même texte ; mise en page resserrée ; liste « avant » en deux écrans ; sous-titres à contour |

## 4. Planche de contrôle (rendu local, gratuit)

Sur le serveur ou dans une routine cloud, jamais sur le PC de Will. Aucune voix, aucun service payant.

    npm --prefix studio-rendu ci
    pnpm exec tsx tests/cas-concret/temoin/planche.mts [dossier de sortie]

La planche pose, à côté de chaque image de la référence (`tests/cas-concret/temoin/reference/ref-<t>.jpg`), l'image rendue au même instant. Navigateur : `STUDIO_RENDU_NAVIGATEUR=/chemin/chrome`, sinon celui de Playwright. Film du formulaire : `ffmpeg` (variable `FFMPEG`).

## 5. Extraire les 12 images clés d'un fichier

Aux mêmes instants que la référence (0,8 · 2,5 · 6 · 13 · 14,8 · 16 · 19,5 · 23,5 · 27 · 32 · 41 · 47 s) :

    for t in 0.8 2.5 6 13 14.8 16 19.5 23.5 27 32 41 47; do
      ffmpeg -y -ss $t -i video.mp4 -frames:v 1 cle-$t.png
    done

Une image de plus à la dernière seconde (`-sseof -1`) montre la tenue de l'écran de fin :

    ffmpeg -y -sseof -1 -i video.mp4 -frames:v 1 cle-fin.png

## 6. Si quelque chose casse

- Panne en cours de route : relancer l'étape depuis la fiche vidéo (« Réessayer »). Les étapes faites et la voix déjà payée sont reprises, le coût de la reprise est nul.
- Refus avant la voix (fiche refusée) : lire le rapport en phrases, corriger le cas ou la fiche, relancer.
- Tout défaut constaté devient une tâche de correction : test rouge d'abord, PR vers `cas-concret/integration`.

## 7. Résultats

À remplir par la session locale, un tableau par essai (offre, cas, date, relevés du § 3, remarques).

| Essai | Cas | Offre | Date | Total | Coût | Remarques |
|---|---|---|---|---|---|---|
| 1 | `recrutement-apporteurs` | intégration (automatisation) | | | | |
| 2 | `compte-rendu-dicte` | formation | | | | |
| 3 | `audit-une-journee` | audit | | | | |
| 4 | `devis-signe-alerte` | intégration | | | | |
