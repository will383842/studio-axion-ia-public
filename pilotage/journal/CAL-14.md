# CAL-14 — fait
Fait : origine à deux valeurs (OrigineEntree, ORIGINES_ENTREE), champs valideeLe/valideePar/refuseLe/motifRefus (facultatifs), estPubliable (garde « jamais publiée sans validation »), validerProposition (Studio seulement, depuis a_valider), refuserProposition (archive, motif facultatif, rien supprimé).
Fichiers : src/domaine/plan-editorial/types.ts, statuts.ts, tests/calendrier/cal-14-proposition.test.ts, ce journal.
Tests : rouge (8 échecs) puis vert ; fiche 9/9 ; calendrier + plan-editorial + src/domaine : 209 passés, 0 échoué. tsc : aucune erreur dans les fichiers touchés. Suite complète non lancée (consigne).
Dépendances : CAL-01 fusionnée (journal « bloqué », aucun code, rien à reprendre) ; L0-07 sur master.
Reste : l'écran (V2) ; brancher estPubliable sur peutProgrammer (hors fichiers autorisés).
Douteux : « équipe IA » retiré de l'origine selon le correctif (deux valeurs seulement) ; transitionner existant inchangé.
contrôle anti-fuite : vide

## Corrections après relecture (avis opus-v1-y2)
- Contournement a_valider → valide par transitionner : corrigé (refusé pour tout auteur, renvoi vers validerProposition) — tests/calendrier/cal-14-proposition.test.ts, « transitionner refuse a_valider → valide », « aucun chemin… sans trace ».
- Origine non contrôlée à l'exécution : corrigé (validerCreneau refuse toute origine hors ORIGINES_ENTREE) — test « validerCreneau refuse une origine venue d'ailleurs ».
- Instant `le` non contrôlé : corrigé (validerProposition et refuserProposition exigent un instant ISO UTC valide) — tests « exige un instant ISO UTC valide », « le refus exige un instant… ».
- Refus sans auteur : corrigé (refuserProposition(c, auteur, motif, le), réservé au Studio) — test « seul le fondateur refuse ». Aucun autre appelant dans src.
- Re-validation héritant de l'ancienne trace : corrigé (retour en a_valider/propose efface valideeLe/valideePar) — tests « efface l'ancienne trace », « re-validation ne reprend pas ».
- Fichier hors fichiers_autorises, ajouté comme la consigne le permet : tests/plan-editorial/service.test.ts (une ligne de test passait par le contournement a_valider → valide ; elle utilise maintenant validerProposition).
- Reporté, PILOTAGE : brancher estPubliable dans peutProgrammer (src/services/plan-editorial.ts, hors fichiers, CORRECTIF requis) ; CAL-01 non réalisée (depend_de) ; creerCreneau peut encore créer un créneau directement « valide » sans trace (même fichier hors liste).
Tests : calendrier + plan-editorial + cadence + src/domaine : 253 passés, 0 échoué ; cal-14 sans le code : 10 rouges sur 17 ; eslint : 0 erreur. contrôle anti-fuite : vide
