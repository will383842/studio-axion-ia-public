# Page 2 de la vidéo v-fc3ac0c1d171 rendue par le moteur (ardoise, 9:16)

Rendu réel (Remotion, `TableauScene` → `PageTableau`, sous-titres « Pastille Axion » compris), fiche lue comme la
fabrication la lit, minutage réaliste, aucun appel payant :

    npx tsx tests/tableau/titre-seul/rendu-vfc3.mts --style ardoise

Page 2 du découpage réel : voix « Le compte rendu arrive enfin : quatre pages. On y cherche encore qui fait quoi. Alors
on refait la réunion. » ; écrit : le titre « Qui fait quoi », la phrase « On y cherche encore qui fait quoi. », puis
« Alors on refait la réunion. » ; un dessin (document) dit dès le début de la page. Les 4 instants sont lus sur le
plan de l'outil :

- `vfc3-ardoise-p02-1-debut.jpg` : juste après l'effacement, la craie se pose au début du titre (rien d'écrit avant
  d'être tracé) ;
- `vfc3-ardoise-p02-2-titre-en-cours.jpg` : « Qui fa… » sous la craie, au rythme de la voix ;
- `vfc3-ardoise-p02-3-titre-fini.jpg` : le titre entier, la craie à sa fin ;
- `vfc3-ardoise-p02-4-phrase-en-cours.jpg` : « On y cherche » déjà écrit, la craie passe à la 2e ligne. La phrase part
  0,13 s après la fin du titre (avant le correctif : 1,2 s, et la vidéo était refusée). Le dessin se trace juste
  après elle.

Note : les polices des plaquettes v4 (#339) sont chargées dès l'import du paquet de compositions, par `staticFile` ;
sans dossier public, tout rendu s'arrête (« 404 polices/Montserrat-900-latin.woff2 »). Le script donne leur dossier
comme dossier public à l'aperçu.
