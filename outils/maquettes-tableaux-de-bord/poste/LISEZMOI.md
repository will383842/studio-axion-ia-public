# Poste de capture : où tourne le navigateur

Le film de navigation d'une maquette (T-EXT-03) se fabrique dans un navigateur (Playwright). Ce navigateur tourne **uniquement** dans une session cloud ou en CI. **Jamais sur le PC de Williams.**

## Procédure d'un pilote (routine cloud)

1. Ouvrir une session cloud neuve sur `studio-axion-ia-public`, puis `pnpm install --frozen-lockfile`.
2. Vérifier le poste :
   `pnpm exec tsx outils/maquettes-tableaux-de-bord/poste/verifier-poste.mts --sortie <dossier hors dépôt>`
   - Code 0 : le poste est bon, `poste.json` est écrit.
   - Code 7 : il manque quelque chose, la liste s'affiche ; ne rien capturer.
   - Si un Chromium est déjà dans la session et que Playwright ne trouve pas le sien, indiquer son chemin avec `CAPTURE_CHROMIUM=<chemin>`. Ne jamais lancer `playwright install` d'une autre version.
3. Lancer la capture (`capturer.mts`, T-EXT-03) avec le même `--sortie` hors dépôt et `--poste <…/poste.json>` : l'empreinte du poste entre dans l'empreinte du film (même poste + même scénario + même voix = même film, réutilisé).
4. Garder ensemble : `poste.json`, `rapport.json`, `navigation.json`, `navigation.mp4`.

Le vérificateur ne lance pas le navigateur, ne fait aucune requête réseau et n'appelle pas le Studio. Il coûte 0 €.

## Interdit

- Le PC de Williams (le vérificateur et la capture refusent : « Capture interdite ici : seulement dans le cloud ou la CI, jamais sur le PC. »).
- Un dossier envoyé par un client dans une session de travail.
- Toute adresse `http` ou `https` dans une maquette.

## Après l'ouverture

Avant d'accepter des dossiers de clients, un conteneur de capture figé (sans réseau, utilisateur sans droits) est construit par will-dc : voir la demande 51b de la fiche T-EXT-51. Tant qu'il n'existe pas, aucun dossier de client n'est ouvert.

Dans le conteneur de capture, la garde reconnaît `CAPTURE_CONTENEUR=true` seulement si `/.dockerenv` ou `/run/.containerenv` existe (la capture l'applique ; le vérificateur de poste sera branché par une fiche suivante, d'ici là le conteneur garde `CI=true`). Les liens symboliques dans une maquette sont refusés (chemin réel).
