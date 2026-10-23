# Règles communes des sessions cloud (routines) du studio

Toute routine lancée sur ce dépôt lit ce fichier en premier. Les consignes de la routine ne répètent pas ce qui est ici.

## Toujours
- Répondre et écrire en **français**. Interface : vouvoiement, très peu de texte.
- **Ne rien fusionner dans master, ne rien déployer, ne toucher à aucun serveur.** La session studio (locale) fusionne et met en ligne.
- **Aucun appel réel** à Claude, HeyGen, Higgsfield, fal.ai, ElevenLabs, Buffer : doubles de test, `fetch` interdit dans les tests.
- Partir de `origin/master` à jour ; une branche par mission ; PR vers master avec un résumé court et les **résultats exacts** des commandes.
- Test **rouge d abord** pour tout défaut corrigé ; ne jamais supprimer un test ni ajouter de `skip`.
- Fins de ligne LF (ne pas convertir les fichiers).

## Économie (forfait)
- Lancer les **tests ciblés** pendant le travail ; la suite Vitest **complète une seule fois**, à la fin.
- `tsc --noEmit` (après `next typegen`) et `eslint` sur les **fichiers touchés**.
- Diff minimal ; ne pas reformater ce qui n est pas concerné.
- Avant de toucher un fichier partagé (fiche vidéo, monteur, habillage, compose), vérifier les PR ouvertes qui le touchent (`gh pr list`, `gh pr diff --name-only`) et le signaler dans la PR.

## Modèle conseillé par type de mission (choisi par la session studio)
Règle : **jamais Haiku**. Opus pour le difficile, Sonnet pour tout le reste.
| Mission | Modèle |
|---|---|
| Conception, débogage difficile, chaîne vidéo, argent | Opus |
| Tout le reste : corrections ciblées, réconciliation de branches, rapports, vérifications, surveillance, relevés | Sonnet |
