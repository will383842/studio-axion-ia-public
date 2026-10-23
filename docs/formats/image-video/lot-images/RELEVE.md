# Image → vidéo · LOT D'IMAGES — relevé de l'exécution (L1 à L11)

Exécution du plan `PLAN.md` (branche `image-video/lot-images`, PR vers master). Rien n'est allumé : le lot n'a aucun
réglage propre ; sans l'accord d'essai réel du format (`imageVideo.accordEssaiReel`, éteint) le moteur refuse chaque
lancement (`IV_FORMAT_MASQUE`) et le lot se met en pause « format » avant toute dépense.

## Ce qui a été posé

| Étape | Quoi | Où |
|---|---|---|
| L1 | Domaine pur du lot (prix, taille 2 à 10, prochaine vidéo, statuts, issues, compteurs) | `src/domaine/image-video/lot.ts` |
| L2 | Porte « carte » automatique : validée par le contrôle, ou mise de côté (`demande.lot`, `miseDeCote`) | `fabrication.ts` |
| L3 | Porte « script » automatique : S2 formule, S1 à trancher, S4 prix inconnu, S5 plafond, S3 porte de Will | `fabrication.ts` |
| L4 | Le moteur lit `lot` ; « Mise de côté : motif » à la porte ; codes inchangés | `moteurs/montage-image-video/index.ts` |
| L5 | Crédit et budget réservés pour le lot : `reserverLot`, `transfererDuLot`, `rendreAuLot`, `libererLot` | `services/credits.ts`, `couts.ts` |
| L6 | Service du lot : dépôt, séquenceur, arrêter, reprendre, refaire ; une ligne dans la boucle | `services/image-video-lot.ts`, `boucle.ts` |
| L7 | Accord de la voix d'une vidéo du lot, borné par son prix accordé | `services/image-video.ts` |
| L8 | Dépôt multiple (2 à 10 images) | `Depot.tsx`, `DepotLot.tsx`, `actions.ts` |
| L9 | Page du lot, lots récents au dépôt, retour au lot et phrase de mise de côté | `SuiviLot.tsx`, `lot/[lotId]/page.tsx` |
| L10 | « Lien privé » dans Vos vidéos (Image → vidéo) et Vos fichiers (Cas concret) | `PartagerVideo.tsx`, `BoutonLienPrive.tsx` |
| L11 | Notification de fin de lot, essai de bout en bout, ce relevé | `tests/image-video/lot/bout-en-bout.test.ts` |

## Essai de bout en bout simulé (0 appel réseau)

Cinq images, la vraie boucle de fond et le vrai moteur, outils simulés, un redémarrage du serveur pendant la 3e vidéo.

| # | Image | Issue | Engagé dans sa caisse |
|---|---|---|---|
| 1 | propre | faite | 1,44 € |
| 2 | deux lectures qui divergent | mise de côté (carte) | 0,44 € (lecture seule) |
| 3 | propre (redémarrage au milieu) | faite | 1,44 € |
| 4 | formule « Zéro erreur garanti » dans le script | mise de côté (script) | 0,94 € (lecture + écriture) |
| 5 | propre | faite | 1,44 € |

- Jamais deux fabrications Image → vidéo actives en même temps ; ordre 1, 2, 3, 4, 5.
- Aucune voix lue pour les vidéos 2 et 4. Somme des caisses (5,70 €) sous le prix accordé (18,35 €).
- Réservation et engagement du lot libérés à la fin ; une seule notification « Lot terminé : 3 faites, 2 mises de côté ».
- La carte de la vidéo 2 validée par Will : la vidéo reprend et devient faite ; elle seule est comptée parmi les cartes validées.
- Un lien privé est créé sur la première vidéo faite.

## Ce qu'il faut savoir (écarts au plan)

1. **Jeu d'essai.** Les fixtures A, C, D, F ont des formules trop affirmatives (la carte est mise de côté, ce qui est le bon
   comportement) et E est refusée par Q21 dans la chaîne simulée : seule B traverse proprement. L'essai de bout en bout
   utilise donc des variantes de B (autres fichiers, même contenu) au lieu de A, C et E.
2. **Ordre S2 avant S1.** Une formule absolue est aussi « à trancher » pour l'écriture ; pour que S2 ait son propre motif,
   elle est testée avant S1. De même C5 (formule) et C4 (chiffre lu une fois) ne sont pas confondus avec C3 (alerte).
3. **C6 / S3** (la porte de Will lève une erreur sur la carte ou le script tels que proposés) sont des filets : la carte
   telle que proposée ne peut pas échouer sans passer par C1, et S3 est testé par une question de commentaire refusée.
4. **Compteur de pannes.** Une mise de côté par une porte remet le compteur à 0 (« pannes de suite » = consécutives) ; une
   même panne relue à un autre tour n'est comptée qu'une fois.
5. **Lot terminé ou arrêté.** Les statuts de ses vidéos continuent d'être relus (les 10 lots les plus récents) : une vidéo
   mise de côté que Will valide ou relance repasse « faite » ; la vidéo en cours d'un lot arrêté va au bout.
6. **Code de refus** gardé dans `miseDeCote.code` (nécessaire pour reconnaître une panne) : champ ajouté à `VideoDuLotIV`.
7. **L7.** L'accord de la voix en lot était déjà le coût de la voix elle-même ; il est maintenant borné par le prix accordé
   pour la vidéo (une voix plus chère que cet accord est refusée au lieu d'être payée).
8. **Lancement.** Le séquenceur appelle `lancerFabricationConfirmee` (sans session) ; si le lancement échoue avant la
   création du travail, la part transférée revient au lot.
9. **Tests existants adaptés** : le libellé du dépôt (« Déposez une ou plusieurs images »), la ligne de `VosFichiers`
   (`page-video.test.ts`) et le chemin de la feuille « Partager » (`e2e1-console-ecrans.test.ts`).

## À regarder au vrai essai

- Part des vidéos mises de côté (contrôle trop sévère ?) et pourquoi : le motif est dans le lot (`miseDeCote.motif`).
- Prix « au plus » du lot contre ce qui a été réellement engagé (voix comprise).
- Mémoire du studio pendant un lot de 10 images (une seule fabrication à la fois).
