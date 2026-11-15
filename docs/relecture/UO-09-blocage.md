# UO-09 : blocage (15/11/2026)

Tâche : contrôle des formats à chaque lancement et matrice générateur × réseau dans la CI.

## Constat
- Aucune fiche UO-09 dans le dépôt de plans privé (usine/fiches-a-lancer, usine/fiches, fiches/ : absents ou sans UO-09). Seules existent la ligne du registre (statut « a_faire », dépend de L1-01 et L0-17, taille S) et deux mentions dans l'audit bout-en-bout vidéo et la coordination.
- Le registre dit « fichiers et critères écrits le 15/11/2026 », mais ces critères ne sont écrits nulle part (recherche sur tout le dépôt et ses branches distantes).
- `src/domaine/formats/` n'existe pas encore dans ce dépôt.

## Pourquoi je m'arrête
Sans critères d'acceptation (liste des formats, règles par réseau, forme de la matrice, contrat de `controle-lancement.ts`), écrire le test rouge reviendrait à inventer la spécification d'une zone partagée.

## Pour débloquer
Le concepteur doit déposer la fiche UO-09 (critères, signatures attendues, liste générateurs × réseaux) dans le dépôt de plans privé. La session auteur pourra alors repartir sur usine/UO-09.

Aucun code applicatif touché ; scripts/echecs-connus.json inchangé.
