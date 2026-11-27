Encart vidéo, côté Studio : thèmes fermés et longueurs du site contrôlés avant l'envoi (éteint par défaut)

## Ce que fait la PR
- Nouveau module pur `bornes-site.ts` : la liste fermée des 5 thèmes du site, le rapprochement d'une rubrique saisie à la main vers un thème, et les bornes de longueur du site (titre 20 à 60, résumé 400 à 1 500, « À retenir » 20 à 200, question 10 à 160, réponse 40 à 600).
- Nouveau contrôle bloquant SITE-18, qui dit où est le défaut. Il n'est actif que si `bornesDuSite` est vrai dans l'entrée des contrôles ; par défaut c'est éteint, donc rien ne change aujourd'hui.
- Les longueurs sont comptées brutes, comme le site (aucune espace retirée). SITE-18 ne répète pas un champ déjà signalé par SITE-10 ou SITE-11.
- Hors périmètre (série suivante) : contrôle « personnage qui témoigne », champ `description`.

## Base
`master`.

## Tests
- `tests/site-videos/encart-3-bornes-site.test.ts` (l'interrupteur était rouge avant le branchement).
- `tests/site-videos` : 293 tests verts ; lint ciblé propre.

Relecture opus : trois tours. Tours 1 et 2 « À corriger » (libellé du thème, longueur brute, doubles signalements), corrigés. Tour 3 « À corriger » : il restait un double signalement SITE-10 / SITE-18 sur les textes vides ; correctif appliqué ensuite (SITE-18 ignore un texte vide, deux tests ajoutés), non revu par opus (limite de trois tours atteinte).

VERDICT OPUS : À CORRIGER (tour 3 : double signalement des textes vides ; corrigé après coup, à faire revoir)
