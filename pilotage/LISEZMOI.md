# Pilotage de l'usine à contenu (kit public)

Ce dossier est une COPIE PUBLIQUE, produite par script. Données fictives seulement : aucun secret, aucun prix, aucun nom réel.

Source de vérité : les fiches, leur état et le fichier d'arrêt font foi dans le dépôt privé du fondateur. Chaque routine a ce dépôt dans ses sources, en lecture. Le Studio public ne reçoit qu'une copie expurgée produite par `node outils/gardes/fiches.mjs --expurger` : jamais une fiche brute. Si pilotage/LISEZMOI.md est absent, la routine s'arrête sans rien écrire.

## Contenu
- fiches/<ID>.md : une fiche par tâche (en-tête YAML : version, lot, phase, statut, dépendances, fichiers autorisés, critères, zone, manuel, validation_fondateur, proprietaire, depot, ci).
- journal/<ID>.md : journal de la fiche (10 lignes au plus), écrit par l'auteur.
- blocages/<ID>.md : fiche bloquée (echec-3 ou zone touchée), reprise par le fondateur seul.
- lots/*.json : fiches par lot, régénérées par le script. Le lot ne sert qu'à l'affichage.
- lots/externes.json : identifiants connus pour les dépendances mais non publiés ici.
- lots/retenues.json : fiches que le garde refuse encore (trop de fichiers, recoupement…) ; elles ne sont pas publiées et ne partent jamais tant que leur source n'est pas corrigée.
- consignes/auteur.md et consignes/relecteur.md : textes donnés aux routines.
- REGLES-DE-FER.md : les règles du fondateur, sur une page.

## Le garde des fiches
`node outils/gardes/fiches.mjs` contrôle les fiches (cycle, version, recoupement, zone, modèle, taille, dépôt, workflow, dépendance inconnue, lot, CI) et la copie publique (montants, champ de validation, chemins du dépôt privé). La liste des mots privés n'est JAMAIS dans ce dépôt, ni en clair ni en empreinte : elle est donnée à l'exécution (`--interdits <fichier>` ou la variable FICHES_INTERDITS_FICHIER, fichier tenu hors du dépôt). Sans elle, le garde fait ses autres contrôles et le dit ; `--expurger` refuse de travailler.

## Sens des champs
- zone = zernio | partagee | interface | aucune.
  - zernio : fiche de la session parcours viral. Jamais lancée ici ; on relève seulement sa PR ou sa note datée.
  - partagee : fichier de l'envoi partagé avec la session Zernio. La fiche est codée ici, APRÈS une annonce.
  - interface : fichier partagé avec la session interface du Studio (src/components/ui/**, libelles.ts, globals.css). Même règle d'annonce.
  - zone_interdite vaut oui seulement si zone = zernio.
- manuel = oui : geste d'une personne. Jamais lancée par une routine, relevée seulement.
- proprietaire : rempli quand une autre session ou le fondateur exécute la fiche ; une telle fiche n'est jamais lancée par une routine.
- validation_fondateur = oui : la routine code et ouvre la PR, qui reçoit le label attend-fondateur ; seul le fondateur fusionne. Cela ne veut pas dire « ne pas coder ».

## Choix de la fiche
1. Lire les fiches sur la branche principale du dépôt de pilotage, jamais sur une branche.
2. Si pilotage/ARRET existe : s'arrêter aussitôt sans rien écrire.
3. Prendre toute fiche a_faire, du dépôt et du couloir de la routine, dont les dépendances sont fusionnées, par ordre croissant du champ « ordre ».
4. N'écarter que : zone = zernio, manuel = oui, propriétaire externe, statut suspendu, fiche retenue. Une fiche partagee ou interface part seulement si son annonce dans le dépôt privé a reçu le mot « libre » de l'autre session.
5. Aucun fichier commun avec une branche usine/* ou une PR ouverte. Deux fiches qui partagent un fichier ne partent jamais ensemble.
6. Réserver en poussant la branche usine/<ID> ; si elle existe déjà, passer à la suivante.

## Labels
sensible-a-fusionner, relu, a-corriger, echec-1, echec-2, echec-3, bloque, attend-zone, attend-fondateur, manuel.

## ARRET
Deux endroits, l'un ou l'autre suffit : pilotage/ARRET dans le dépôt de code (posé par le coordinateur sans IA) et le fichier d'arrêt du dépôt privé (posé par le fondateur). Retiré seulement par le fondateur. Un agent ne compte rien lui-même : s'il voit ARRET, il s'arrête.

## Règle des 3 échecs
CI rouge après 2 corrections : label echec-N suivant et commentaire factuel, puis arrêt. Au 3e échec : label bloque, fichier blocages/, issue assignée au propriétaire du dépôt.

## Tout dans le cloud
Aucune installation, aucun build ni test sur le PC du fondateur : tout passe par les routines cloud et la CI publique. Un essai réel (serveur, clé, production) est une fiche manuelle.

## Fusion
Les PR sensibles (migration, envoi, interrupteur, argent, données de personnes, .github/, dépendance) portent sensible-a-fusionner et sont fusionnées par le fondateur, comme toute PR qui porte attend-fondateur. Les autres sont fusionnées par le coordinateur sans IA quand la CI est verte et que le relecteur a posé le label relu.
