# Lot 4c · note d'arbitrage : ancien chemin des « stop » et « Tout arrêter »

Avec `MOTS_ENABLED=1` et le parcours des messages privés **éteint** (`PARCOURS_CONVERSATION_ENABLED` absent ou faux), et aucune
opposition en file, `passageParcoursZernio` s'arrête dès le contrôle de l'interrupteur : l'ancien chemin `traiterOppositions` et
le balayage `appliquerToutArreter` **ne tournent pas** depuis ce passage. Rien n'est perdu : les événements restent `traite:false`
et seront pris dès que le parcours est allumé (ou si une opposition entre en file). À arbitrer : faut-il que ces deux étapes
tournent aussi quand seul `MOTS_ENABLED` est allumé ?

Autres règles du passage : « Tout arrêter » passe avant les conversations ; liste d'envoi vide ou titre absent = aucune
conversation traitée, mais les « stop » en file sont transmis et rattrapés (port construit sans liste d'envoi : écriture
impossible) ; aucun compte de lecture = alerte « opposition en attente », entrées conservées.
