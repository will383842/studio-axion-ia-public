# Relecture PR 582 : FB-REEL-b (Reels Facebook à l'envoi, avertissement du kit)

## VERDICT : À CORRIGER (un seul point, mineur) sur la tête complète 058730330ff98c2b9d2463e5667410d595af8271

Après correction du point 1 (une ligne de test), la PR est fusionnable : le reste est conforme à la fiche.

### À corriger
1. `tests/publication/fb-reel-envoi.test.ts:13` : `process.env.FOURNISSEUR_PUBLICATION = "buffer";` ajoute une mention de Buffer
   alors que la règle du lot est « aucune mention de Buffer ». **Gravité : mineure.** La ligne est inutile : une sonde jetable
   (ligne retirée, rien d'autre de changé) donne quand même 7 tests sur 7 verts, puisque le test passe `outil: "zernio"`
   explicitement. Correctif : supprimer la ligne.

### Suivis non bloquants (hors fichiers autorisés de la fiche)
2. `src/services/publications.ts:444` : l'avertissement Reel réutilise le code `legende-trop-longue`, qui ne correspond pas à son sens
   (ce n'est pas un texte trop long). Le choix est expliqué en commentaire et il est volontairement non bloquant : seuls `trop-longue` et
   `ratio-absent` désactivent un envoi (`src/components/publication/FeuilleEnvoyerBuffer.tsx:77`, vérifié). Un code propre au Reel
   demande le registre `src/reseaux/index.ts`, qui ne fait pas partie des fichiers autorisés. **Gravité : mineure, à reprendre dans une fiche ultérieure.**
3. Affichage : `KitPublication.tsx:267` recalcule les avertissements côté client avec `verifierPourReseau` seulement. Le texte de
   l'avertissement Reel n'apparaît donc pas dans le panneau Facebook. Il ne se voit que par la pastille d'alerte de l'onglet
   (`KitPublication.tsx:137`, qui lit la liste du serveur). Le critère de la fiche (« figure dans `avertissements` du réseau Facebook du kit ») est
   rempli côté données. HSH-01c touchera `KitPublication.tsx` : bon moment pour afficher ce texte. **Gravité : moyenne pour l'ergonomie, hors fiche.**
4. Défaut déjà présent sur master, sans lien avec la PR : `tests/a-publier-premier-commentaire-zernio.test.ts` (« cohérence … lecture sans
   modification ») échoue aussi sur master be7d73c, avec 3 occurrences de `firstComment` dans `zernio-corps.ts` contre 2 attendues depuis #572.
   Ce test est un critère de HSH-01c : à régler avant HSH-01c.

## Vérifications
- Tête : `git rev-parse origin/usine/FB-REEL-b` = 058730330ff98c2b9d2463e5667410d595af8271. Base = master be7d73c, à jour (contient #572 et #581).
- Diff limité aux 2 fichiers autorisés de la fiche (`src/services/publications.ts`, `tests/publication/fb-reel-envoi.test.ts`, nouveau).
- Branchement à l'envoi (`publications.ts:984`) : Facebook reçoit `format` = ratio de `sortieConseillee` et `dureeSec` = durée réelle.
  YouTube Shorts garde exactement le même comportement (condition `youtube-shorts || facebook`). Les autres réseaux ne reçoivent toujours rien.
  Aucun autre fournisseur que Zernio ne lit `format` ou `dureeSec`. C'est `zernio-corps.ts:219` (déjà en place, issu de #581) qui pose `contentType: "reel"`.
- Reel hors règles (4:5, 2,9 s, 60,1 s) : l'avertissement de FB-REEL-a est dans `avertissements` du réseau Facebook seulement. Il n'y a ni code
  bloquant ni refus. La vidéo part comme vidéo ordinaire, sans `contentType`. C'est ce que demande la fiche (« sans bloquer la saisie ni l'envoi »).
- Sonde jetable : le nouveau test lancé sur le code de master échoue (6 sur 7 rouges). Il prouve donc bien le branchement.
- Contrat HSH-01c non glissé : la PR ne touche ni `texteAEnvoyer`, ni `commentairePour`, ni `placerHashtags`.
- Tests ciblés (tête complète, conteneur neuf) : `tests/zernio`, `tests/youtube-zernio`, `tests/publication`, `socle-aucun-appel-reel`,
  `a-publier-par-reseau` : 219 fichiers et 3391 tests verts (7 « todo »). Note d'environnement : `imp1-exporter` se bloque si l'entrée standard
  reste ouverte. Avec `< /dev/null`, il est vert (sur master comme sur la PR).
- Aucun appel réel : `fetch` est simulé et Zernio passe par le faux serveur (clé fictive, comptes « exemple »). Aucune publication,
  aucune suppression de données, aucun message privé.
- `scripts/echecs-connus.json` inchangé. Aucun nom de personne dans le diff ni dans les messages de commit.
- Contrôles GitHub sur 0587303 : 9 sur 9 verts, dont « build réel (contexte Docker) ».
