# Relecture PR 568 — fiche MAQ-01 (maquettes hors calendrier)

**VERDICT : À CORRIGER** (tête relue : `88ee47c2eb5822ee33018734213becb1eec88ce8`, branche `usine/MAQ-01-v2`)

1. **Ce n'est pas la dernière version des maquettes.** Les 5 fichiers de la PR sont identiques, à l'octet près, à ceux de `usine/MAQ-01-propre` (commit `c4cbc161` du 11/11, 20 h 23 UTC). Le 12/11, une correction a été faite sur `usine/MAQ-01` (commit `bc821af3`) : écran renommé « Mes quantités », avis « Vide » sans pause, étape d'accord, bouton « Placer dans À publier ». C'est cette version corrigée que le plan privé du 12/11 décrit comme présentée au fondateur pour validation. La PR remet donc sur master une version plus ancienne, sans ces corrections. À faire : soit reporter les corrections du 12/11 sur les seuls chemins de la fiche (en retirant le lien Google Fonts de cette version, puisqu'aucune ressource externe n'est permise), soit écrire noir sur blanc que la validation du 14/11 concerne bien la version du 11/11.
2. **Aucune trace écrite de la validation du 14/11.** Le dépôt privé ne contient aucune validation de MAQ-01 : la fiche est toujours en `statut: a_faire`, et la coordination du 14/11 ne mentionne que la maquette des quotas. Or la fiche exige que le fondateur « valide par écrit avant tout code ». Il faut ajouter cette trace (date, version validée, SHA) dans le dépôt privé avant de fusionner.

## Contrôles effectués (tous conformes)
- Diff limité à 5 fichiers, tous dans `fichiers_autorises` de la fiche. Aucun code applicatif. `scripts/echecs-connus.json` n'est pas touché.
- Aucun prix (ni €, ni $, ni « euros », ni montant), aucun libellé « Buffer », aucune étiquette « Essai ».
- Vouvoiement partout, phrases courtes et mots simples. La mention « Maquette fictive : rien n'est branché, rien ne part. » figure sur les 4 pages.
- Aucun nom de personne ni nom du fondateur dans le diff. L'auteur du commit est générique.
- HTML bien formé (balises toutes fermées) : aucun script, aucune ressource externe, liens relatifs seulement. Ouverture dans Chromium en `file://` : 4 pages chargées, 0 erreur de console, 0 requête externe.
- Test `tests/maquettes/maq-01-maquettes.test.ts` relancé à part : 35/35 verts.
- CI de la tête `88ee47c` : 8 contrôles sur 8 en succès.
- Remarque : la PR est encore en brouillon (draft).
