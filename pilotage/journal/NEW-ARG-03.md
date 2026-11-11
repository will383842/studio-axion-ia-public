# NEW-ARG-03 — bloquée : dépendances non finales après 40 minutes
- Fait : rien de codé. Attente « à la chaîne » de 20 essais (2 min) épuisée.
- Bloque : `usine/L2-13` existe mais son journal dit encore « en cours » ; `usine/L2-13c` existe, journal encore « en cours ».
- Fichiers touchés : ce journal seulement.
- Tests : aucun lancé (0 passé, 0 échoué).
- Reste : toute la fiche (quota en quantités, plus de plafond par défaut, `budget_mensuel_cents` toléré, `plafond_cents` optionnel) ; relancer quand L2-13 puis L2-13c sont finales.
- Douteux : rien d'autre.
- contrôle anti-fuite : vide
