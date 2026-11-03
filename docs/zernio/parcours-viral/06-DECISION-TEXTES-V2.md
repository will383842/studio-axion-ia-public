# Décision du 03/11/2026 · parcours « commentez un mot », textes v2

Cette décision remplace les points de l'ADR (document 01) et du brouillon (document 05) qui prévoyaient une question d'accord, un double accord par e-mail, des boutons Oui / Non et le mot STOP dans les textes. Le reste de l'ADR est inchangé.

## Règles
- Le parcours livre le guide et rien d'autre : **aucune question « voulez-vous recevoir d'autres informations »**, aucun double accord, aucune réponse Oui / Non / Sans réponse, aucune newsletter ni suite pour ces personnes.
- **Aucune mention STOP** dans les textes. Si la personne écrit d'elle-même « stop » ou « arrêtez » : tout s'arrête **en silence** (aucun message), la personne est mise à l'écart, rien n'est supprimé.
- Une personne déjà opposée : aucune réponse, aucun guide (le travail de fond ne lit pas son run et n'appelle pas le site).
- Lancement : le mot **GUIDE** seul. Un mot inconnu reçoit GUIDE (si GUIDE n'est pas configuré, ou si la liste est illisible, la carte va dans « À traiter » et rien n'est envoyé).
- Tout reste derrière les interrupteurs existants, éteints par défaut.

## Contrat envoyé au site
Le champ `accord` (et `versionTexteM2`) **n'est plus envoyé**. Le site doit accepter leur absence ; un ancien corps qui les porte reste valide (rétro-compatibilité). `versionTexteM1` porte le numéro de version du texte, par exemple `mp-m1-v2`.

## Textes validés
Source unique : `contrats/dictionnaire-textes-mp.v2.json` (empreinte vérifiée par `tests/zernio/mp-v2.test.ts`), lu par `src/domaine/guide-reseau/textes-mp.ts`. Chaque message privé s'ouvre par « Message automatique envoyé par Axion IA. ». Identifiants : `mp-m1-v2` et variantes `-a` à `-e`, `mp-recu-v2`, `mp-m2-v1` (adresse illisible, une seule fois, si la personne a répondu dans les 23 h), `mp-lien-v2`, `mp-pub-igfb-v1` (réponse publique Instagram / Facebook), `mp-pub-lien-v1` (LinkedIn / TikTok, réponse publique seule). **Toute modification d'un texte = une nouvelle version** (nouvel identifiant), inscrite au registre de preuve.
