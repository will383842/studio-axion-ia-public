# CAL-14 — fait
Fait : origine à deux valeurs (OrigineEntree, ORIGINES_ENTREE), champs valideeLe/valideePar/refuseLe/motifRefus (facultatifs), estPubliable (garde « jamais publiée sans validation »), validerProposition (Studio seulement, depuis a_valider), refuserProposition (archive, motif facultatif, rien supprimé).
Fichiers : src/domaine/plan-editorial/types.ts, statuts.ts, tests/calendrier/cal-14-proposition.test.ts, ce journal.
Tests : rouge (8 échecs) puis vert ; fiche 9/9 ; calendrier + plan-editorial + src/domaine : 209 passés, 0 échoué. tsc : aucune erreur dans les fichiers touchés. Suite complète non lancée (consigne).
Dépendances : CAL-01 fusionnée (journal « bloqué », aucun code, rien à reprendre) ; L0-07 sur master.
Reste : l'écran (V2) ; brancher estPubliable sur peutProgrammer (hors fichiers autorisés).
Douteux : « équipe IA » retiré de l'origine selon le correctif (deux valeurs seulement) ; transitionner existant inchangé.
contrôle anti-fuite : vide
