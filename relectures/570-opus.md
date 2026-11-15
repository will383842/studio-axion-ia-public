# Relecture PR 570 — fiche DUREE-PAR-RESEAU

**VERDICT : OK — FUSION POSSIBLE sur la tête complète f2a624b45d0f338aee35be8111266f0c0a80077e**

(branche usine/DUREE-PAR-RESEAU ; base de fusion 6da382d ; fusion avec origin/master f98e77a sans conflit)

## Critères de la fiche

| Critère | Résultat |
|---|---|
| Fichiers modifiés = exactement les 8 de la fiche | OK (8/8, aucun autre) |
| src/reseaux/index.ts et src/app/(studio)/calendrier/page.tsx non modifiés | OK |
| scripts/echecs-connus.json non modifié | OK |
| Limite par réseau avec source (cellule, URL, date) | OK : Facebook → cellule `reseaux.facebook.reseau.format_video`, https://zernio.com/openapi.json, 2026-11-12 ; le test lit le JSON et compare URL et date |
| « limite non vérifiée », jamais un chiffre inventé | OK : TikTok, Instagram, YouTube Shorts, LinkedIn → `limiteSec: null` (cellules « inconnu » ou absentes du relevé) |
| Facebook = REEL_FACEBOOK_DUREE_SEC.max importée | OK : import depuis zernio-corps.ts ; 61 s → alerte, 60 s → aucune (test et sonde) |
| Alerte non bloquante | OK : composant d'affichage seul, aucune condition sur un bouton ; phrase finit par « Rien n'est bloqué. » |
| Commande (ReglagesSujet) : durée visée = cibleParDefautSec, sinon zoneSec[1] ; FormatEcrivable.dureeViseeSec rempli par donnees.ts | OK |
| Calendrier (ApercuPublication) : VisuelApercu.dureeSec rempli par charger-medias.ts ; durée inconnue → rien | OK (dépôt en échec ou durée absente → entrée inchangée) |
| Aucun appel réel | OK : module pur, test hors réseau (8/8 verts) |
| tsc / eslint non régressés | OK : 146 erreurs tsc et 434 problèmes eslint, identiques avant/après ; aucun dans les fichiers touchés |
| Vouvoiement, mots simples, aucun nom de personne | OK (aucun tutoiement, aucun prénom dans le diff ni les messages de commit) |

## Mutations à la main (non poussées)

Tuées (le test échoue) : `<=` → `<` sur la limite ; limite Facebook 90 en dur ; chiffre donné à un réseau non vérifié ; date de source changée ; zoneSec[0] au lieu de zoneSec[1] ; chiffre dans la phrase « non vérifiée » ; filtre des alertes retiré.
Survit : durée 0 ou négative (`dureeSec <= 0` → `< -1`) — cas limite sans effet pratique.

## Observations non bloquantes (à reprendre plus tard si souhaité)

1. src/domaine/duree-par-reseau.ts:59 — gravité faible. La phrase dit « la limite est de 60 s (source : zernio.com) » alors que la cellule citée indique « 3 à 90 s » ; 60 s est un choix de prudence (commentaire de zernio-corps.ts:23). C'est ce que la fiche demande, mais la phrase pourrait dire « 60 s par prudence ».
2. src/domaine/duree-par-reseau.ts:59 — gravité faible. Date affichée au format 2026-11-12 ; « 12 novembre 2026 » serait plus simple à lire.
3. src/domaine/duree-par-reseau.ts:47 — gravité faible. Un réseau hors liste (ex. « youtube » dans le calendrier) s'affiche en code brut minuscule (« youtube : limite non vérifiée. »).
4. src/app/(studio)/calendrier/charger-medias.ts:32 — gravité faible. La durée du calendrier est la durée visée de la commande (`dureeCibleSec`), aucune durée réelle n'existant sur `Video` ; le câblage calendrier et commande n'a pas de test (la fiche n'exige que le test pur).
5. Gravité faible. Comme la durée visée est presque toujours connue, quatre lignes « limite non vérifiée » s'afficheront à chaque commande tant que le relevé n'aura pas d'autres chiffres.
