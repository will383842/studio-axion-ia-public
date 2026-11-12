# CAL-01 : origine de la date dans la fiche du calendrier (FAIT, 12/11/2026)
- Repris de usine/CAL-01 + origin/master (L4-03, L4-04, L7-11, L4-06, RC-35, L1-05 inclus). Maquette lue : date et heure de Paris, geste « Déplacer au… ». CORRECTIF du 12/11 16 h 50 appliqué. Test autorisé d'office : tests/calendrier/cal-01-origine-date.test.tsx.
- Fichiers : src/domaine/plan-editorial/origine-date.ts (nouveau : ecritureDatePermise, libelleOrigineDate), FicheEntree.tsx (champ origineDate, ligne « Date choisie par vous » / « Date proposée par l'usine »), le test. types.ts inchangé : OrigineEntree y est déjà seule définie (CAL-14).
- Critère « date choisie à la main jamais écrasée » : tenu, test cal-01-origine-date.test.tsx lignes 14-42 (usine sur vous refusé ; entrée sans origine protégée ; origine illisible refusée ; rejeu accepté).
- Critère « la fiche affiche choisie par vous / proposée par l'usine » : tenu, test lignes 44-63 (y compris sans origine et date illisible).
- Critère « une seule définition dans types.ts » : tenu, test ligne 64 (origine-date.ts l'importe, ne la redéfinit pas).
- CORRECTIF 11/11 « usine réservée en V1 » : tenu, une entrée sans origine s'affiche « choisie par vous » (ligne 57) ; rien n'alimente « usine ».
- Tests : nouveau fichier rouge sans le code (import absent, puis libellés absents), vert ensuite ; tests/calendrier + calendrier-fiche : 15 fichiers, 249 passés, 0 échoué. Suite complète non lancée (consigne).
- PILOTAGE : les actions de décalage (DecalerEntree.tsx, actions du calendrier) et d'ajout (AjouterEntree.tsx) devront appeler ecritureDatePermise dans leurs propres fiches ; aucune n'est modifiée ici.
- contrôle anti-fuite : vide
