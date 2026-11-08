# Consigne commune des auteurs — studio (08/11/2026)

Dépôt : `C:\Users\Will\Documents\Projets\studio-axion-ia-public` (branche principale `master`, remote GitHub `will383842/studio-axion-ia-public`).
NE TRAVAILLE JAMAIS dans ce dossier directement (une autre branche y est en cours). Crée TA copie :

```
cd C:/Users/Will/Documents/Projets/studio-axion-ia-public
git fetch -q origin
git worktree add ../wt-<lot> -b <branche> <base>      # base indiquée dans ta mission
cd ../wt-<lot> && pnpm install --frozen-lockfile --prefer-offline
```

Lis d'abord `docs/REGLES-ROUTINES.md` et `AGENTS.md` (Next.js modifié : docs dans `node_modules/next/dist/docs/`).

Règles de Williams pour le studio (non négociables) :
- Interface 100 % en français simple, vouvoiement, très peu de texte. Jamais « Zernio », « Buffer », « kit », « variante », « trace », « API » dans un libellé.
- Rien ne bloque une vidéo : un défaut = remarque, jamais un refus. Aucun prix ni budget affiché.
- Pas d'entrée ni de carte grisée « Bientôt » sans moteur derrière.
- Aucun appel réel (Claude, HeyGen, fal.ai, ElevenLabs, Buffer, Zernio) dans les tests ; `fetch` interdit dans les tests.
- Test ROUGE d'abord pour un comportement neuf ; ne jamais supprimer un test ni ajouter `skip`. Un test existant qui encode une ancienne décision est mis à jour EN CITANT la nouvelle décision (date 08/11, Williams).
- Diff minimal ; ne reformate pas ce qui n'est pas concerné (le dépôt n'applique pas prettier). Fins de ligne LF.
- Ne touche QUE les fichiers listés dans ta mission. Si tu dois toucher un autre fichier : arrête-toi et dis-le dans ta réponse finale. Fichiers INTERDITS (PR ouverte #240 d'une autre session) : `src/app/(studio)/reglages/**`, `src/components/reglages/**` (sauf mention explicite), `src/app/(studio)/maquettes-generateur/**`, `src/app/(studio)/styleguide/**`, `src/components/videos/fiche/DemanderModification.tsx`, `src/components/videos/fiche/OngletRetouches.tsx`, `src/components/formats/**` (sauf mention explicite), et tout ce que `gh pr diff 240 --name-only` liste.

Vérification avant push :
- `pnpm vitest run <tests du lot + tests à rejouer>` : tout vert. Échecs DÉJÀ présents sur master (ne pas les corriger, les citer) : `tests/final-b-mobile.test.ts` (n° 10), `tests/facecam-animee/essai-reel.test.ts` (envoi par morceaux, 3 vidéos, file, FFmpeg), `tests/facecam-animee/lot-i.test.ts` (coupes), `tableau/creation` éventuels. Vérifie qu'un échec est préexistant en le rejouant sur master (`git stash` interdit dans un worktree partagé : utilise un 2e worktree ou `git show master:<fichier>`).
- `npx eslint <fichiers touchés>` : 0 erreur. `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "<tes fichiers>"` : aucune erreur dans tes fichiers (les erreurs `docs/**/prototypes` sont préexistantes).

Livraison :
- Commits d'une ligne en français (`feat(menu): …`), terminés par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `git push -u origin <branche>` puis `gh pr create --base master --title "<titre français>" --body "<résumé court, résultats EXACTS des commandes de test, fichiers partagés signalés>\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)"`.
- NE FUSIONNE RIEN, ne déploie rien, ne touche à aucun serveur.
- Réponse finale (≤ 12 lignes) : numéro de PR (lu, pas deviné), tête (sha), résultats de tests, ce qui reste, fichier hors liste éventuel. Puis supprime ton worktree : `git worktree remove ../wt-<lot> --force` (la branche reste poussée).

## En session cloud (prioritaire depuis le 08/11 soir)
Pas de worktree : la session cloud a son propre clone. `git fetch origin && git checkout <branche>` (ou `-b <branche> origin/master`), `pnpm install --frozen-lockfile`, puis la même méthode. Ne fusionne jamais : ouvre la PR et donne son numéro.
