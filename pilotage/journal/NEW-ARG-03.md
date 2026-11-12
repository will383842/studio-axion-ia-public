# NEW-ARG-03 — bloquée : dépendances non finales après 40 minutes
- Fait : rien de codé. Attente « à la chaîne » de 20 essais (2 min) épuisée.
- Bloque : `usine/L2-13` existe mais son journal dit encore « en cours » ; `usine/L2-13c` existe, journal encore « en cours ».
- Fichiers touchés : ce journal seulement.
- Tests : aucun lancé (0 passé, 0 échoué).
- Reste : toute la fiche (quota en quantités, plus de plafond par défaut, `budget_mensuel_cents` toléré, `plafond_cents` optionnel) ; relancer quand L2-13 puis L2-13c sont finales.
- Douteux : rien d'autre.
- contrôle anti-fuite : vide

## Corrections après relecture
- Constat « fiche non faite » : reporté. PILOTAGE : usine/L2-13 (journal « en cours », branche probablement abandonnée) et usine/L2-13c (bloquée sur L2-13) toujours non finales le 12/11 ; la série doit être reprise à L2-13. Rien codé, aucun fichier d'argent touché.
- Remarque RC-02 : dépendance documentaire (contrat d'échange du dépôt des plans), pas une dépendance de code du Studio ; à confirmer au relancement.
- Tests : 0 lancé, 0 écrit. contrôle anti-fuite : vide
