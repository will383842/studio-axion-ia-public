# ADR-0013 · Frontière entre l'usine et le Studio

- Statut : brouillon (à valider par le fondateur)
- Date : 2026-11-11
- Chantier : usine à contenu, décision D8-07
- Liens : ADR-0001, ADR-0004, ADR-0010

## Contexte

L'usine fabrique des contenus ; le Studio les relit, les programme et les envoie. Si les deux parlent au diffuseur, les garde-fous d'envoi sont contournables.

## Décision

- L'usine ne parle jamais à Zernio : ni lecture, ni écriture, ni clé.
- Le Studio est le seul à envoyer. Toute sortie passe par la garde sortante du Studio (chemins autorisés, mots interdits, cibles explicites, ADR-0004).
- L'usine remet des contenus au Studio sous un contrat de données versionné ; le Studio les valide avant tout usage.
- Les interrupteurs d'envoi sont éteints par défaut ; seul un geste daté du fondateur les allume.
- Rien de privé ne traverse la frontière vers le dépôt public.

## Conséquences

- Positives : une seule porte de sortie, donc un seul endroit à auditer.
- À surveiller : test qui échoue si le code de l'usine référence un client du diffuseur.
