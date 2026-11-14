# ATR-01 : entrée automatique des commentaires LinkedIn page et TikTok (FAIT, 14/11/2026)
- Branche usine/ATR-01 depuis master. Fichiers : src/services/a-traiter-entree.ts (nouveau), tests/a-traiter/atr-01-entree.test.ts (nouveau), ce journal.
- Dépendances L7-26 (file durable) et RC-40 (opposition) : non trouvées comme fiches ni modules dédiés sur master ; code contre l'interface injectée PortsEntree (file.existe/ajouter, oppositions.estOpposee), sans effet par défaut. À brancher par la session parcours viral.
- Une seule fonction exposée : recevoirCommentaire(commentaire, ports). Aucun fichier zernio* ni mots-* touché ; seul import : domaine/guide-reseau/opposition (pur).
- Critères 1 à 5 : tenus, un test chacun (carte complète, rejeu, opposition et « stop », faux client qui échoue à toute écriture, lien https seul).
- Lecture seule : le module n'a aucun port d'écriture réseau ; le test tend un faux client et vérifie zéro appel.
- Test rouge d'abord (module absent). Mutation temporaire restaurée pour chaque comportement (rejeu, opposition, stop, registre illisible, lien, sans mot, réseau, e-mail, mot) : chaque mutation fait échouer un test.
- Registre d'opposition illisible : rien d'écrit, résultat « reessai ».
- Aucune donnée de personne conservée (ni identifiant, ni e-mail, ni pseudo dans l'extrait).
