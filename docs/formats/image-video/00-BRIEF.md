# Brief — Générateur « Image → vidéo motion design » (demande de Will, 14/10/2026)

## Demande de Will (reformulée fidèlement)
1. Faire un AUDIT de tous les générateurs de vidéos existants du studio.
2. Créer un NOUVEAU générateur : à partir d'UNE image (infographie Axion-IA), écrire un script selon les meilleures pratiques fin 2026 pour accrocher et retenir jusqu'au bout (structure : accroche → douleur → début de réponse → explication → appel à commenter), qui explique le contenu de l'image de façon hyper compréhensible.
   - Si l'image décrit une AUTOMATISATION : la vidéo explique concrètement l'automatisation DE BOUT EN BOUT (chaque étape, chaque embranchement, les chiffres).
   - Vidéo en MOTION DESIGN hyper dynamique, moderne, très facile à comprendre : les animations REPRÉSENTENT le contenu de l'image (ce qui est dessiné dans l'image prend vie), extrêmement clair.
   - Doit tenir des images simples (liste de bénéfices) jusqu'aux automatisations hyper complexes (beaucoup d'étapes, embranchements).
   - Tout généré AUTOMATIQUEMENT, une version par réseau social.
3. « Vérifie bien toutes les briques nécessaires pour avoir des vidéos à la perfection. »
4. Une hiérarchie / équipe d'agents IA sur la tâche.

## Règles permanentes de Will à respecter (extraits mémoire)
- Tout en français. Expliquer simplement à Will (pas de jargon, pas de noms de fichiers dans ce qui lui est destiné).
- Référence de qualité motion design = la « v4 » (`Axion-IA\<dossier-de-plan-prive>\on-recrute-en-15-minutes-v4.mp4`, sources `sources\compo\v4.html`) : style « Hall Marketing », police Anton, un changement visible toutes les ~1,6 s, deux fonds qui alternent (sombre chaud / ivoire), orange pour UN mot, fils orange, objets redessinés simplifiés avec micro-animations (coches, curseurs), séquences 3-5 s max, sous-titres #15100c sur ivoire. Le format « Cas concret » du studio a été jugé parfait sur la vidéo v-f17775b9177a (14/10).
- Voix UNIQUE partout : clone HeyGen de Will `b22b1a358ca740eda753772ebaaf11f7`, moteur starfish, vitesse 1,1 ; référence d'intonation = secondes 25-30 de la v4. Couper la voix seulement dans un silence MESURÉ ; la dernière phrase doit être dite en entier.
- Bruitages OBLIGATOIRES ; PAS de musique ; aucune banque de stock payante.
- Jamais « machine » → « automatisation ». Jamais « Villeexemple » (« partout en France »). Jamais « Aucun gain garanti ». « axion-ia.com » visible sur tous les écrans. Jamais de faux cas client (situation type annoncée comme telle).
- Fins par réseau : Facebook/LinkedIn « le lien vous attend en premier commentaire » ; Instagram/TikTok « le lien est dans la bio/mon profil » ; mot à commenter (ex. « IA ») — la règle actuelle : mot à commenter seulement sur Instagram et pages Facebook (décision Usine) ; à vérifier dans le code.
- Agents : jamais Haiku. Tests lourds / typecheck / builds → routines CLOUD, jamais sur le PC. Rien fusionné ni déployé sans Will. Coordonner avec les sessions voisines (axion-ia-43 cas concret, axion-ia-ca interface claire, axion-ia-17 mises en ligne du studio).
- Ne dépenser aucun essai payant (voix/vidéo) sans accord de Will.

## Dépôt du studio
`<dossier utilisateur>\Documents\Projets\studio-axion-ia` — la branche LOCALE `master` a ~970 commits de retard : TOUJOURS lire `origin/master` (`git -C <dépôt> show origin/master:<chemin>`, `git -C <dépôt> grep -n <motif> origin/master -- <chemin>`, `git -C <dépôt> ls-tree -r --name-only origin/master`). Ne PAS faire de checkout, ne rien modifier dans ce dépôt.
Travaux déjà faits à lire : `Axion-IA\<dossier-de-plan-prive>\` (audit du matin, 5 rapports), `<dossier-de-plan-prive>\` (format cas concret), `<dossier-de-plan-prive>\`, `<dossier-de-plan-prive>\` (face caméra animée), `_CHARTE-VIDEO\`, `<dossier-de-plan-prive>\`.

## Les 6 images d'exemple fournies par Will (transcription exacte)
Charte commune des images : fond ivoire/crème, terracotta/orange (#C9471B env.) + noir, logo « Axion-IA.com » en tête, icônes au trait orange, cartes à coins arrondis, phrase-choc finale en bas.

### Image A — « Formation Axion-IA » (type : BÉNÉFICES / offre formation, carrée)
Titre : « FORMATION AXION-IA — Des bénéfices concrets, dès le premier jour. » Photo d'un formateur devant un paperboard « L'IA au service de vos résultats : Objectifs → Actions IA → Résultats », 3 participants.
Colonne « CE QUE VOUS GAGNEZ DÈS AUJOURD'HUI » (5 cartes avec icône) : Gain de temps immédiat (automatisez vos tâches répétitives, libérez jusqu'à plusieurs heures dès aujourd'hui) · Plus de clarté (structurez idées, données, actions avec des outils IA simples) · Meilleure productivité (processus optimisés, décisions plus rapides) · Réduction des coûts (moins d'erreurs, moins de pertes de temps) · Résultats concrets (actions applicables tout de suite, impact mesurable dès le 1er jour).
Encadré : « Une approche pratique, orientée résultats — des outils, des cas concrets et un accompagnement sur-mesure. » Bandeau CTA : « Formez-vous aujourd'hui, transformez vos résultats dès demain. » Pied : Cas concrets · Ateliers pratiques · Outils prêts à l'emploi · Accompagnement personnalisé.

### Image B — « Vous gagnez. Concrètement. » (type : BÉNÉFICES, paysage)
Logo Axion-IA.com. Sous-titre « Nos formations et interventions vous apportent des résultats visibles et durables. » 5 colonnes avec icône : Gagnez du temps (automatisez les tâches chronophages) · Prenez de meilleures décisions (IA + données, décider plus vite et plus juste) · Dépassez vos concurrents (innovez, optimisez, longueur d'avance) · Développez vos compétences (expertise, confiance) · Boostez votre performance (résultats et rentabilité durables). Signature : « Comprendre. Former. Transformer. »

### Image C — Chatbot support 24 h/24 (type : AUTOMATISATION À EMBRANCHEMENT)
« Message client entrant — 23h14 » → « Chatbot IA analyse la demande » → deux branches :
- Gauche (orange) « 80 % — Réponse connue » → Réponse générée → Envoyée en 4 sec → Ticket clôturé auto → « Résolu sans intervention humaine ».
- Droite (noir) « 20 % — Limite atteinte » → Email structuré auto (Objet / Contexte / Demande / Urgence) → Envoyé équipe concernée → Alerte Telegram « 🔔 Intervention requise » → Client informé « Réponse sous 2h ».
Bandeau chiffres : 80 % résolus instantanément · 0 demande perdue · 24h/24. Phrase finale : « Votre client a toujours une réponse. Même à 3h du matin. »

### Image D — Tri des e-mails (type : AUTOMATISATION ENTONNOIR 80/20)
« 20 e-mails entrants — Questions récurrentes » (20 enveloppes) → entonnoir « IA classe et répond » → 80 % répondus automatiquement (16 enveloppes cochées vertes, « Réponse en 2 minutes ») / 20 % pour vous (4 enveloppes, « Ceux qui comptent vraiment »). Chiffres : 80 % traités auto · 2h récupérées/jour · 0 question sans réponse. Phrase : « Vous lisez ce qui compte. L'IA gère le reste. »

### Image E — Classement des documents (type : AVANT / APRÈS)
Avant : sources Email, Scan, Drive, WhatsApp, USB → pile de documents en vrac (PDF, Word, Excel, images) → « Recherche : 23 min ». Centre : cercle IA « classe · renomme · archive · indexe ». Après : dossiers Clients, Fournisseurs, Contrats, Factures ; recherche « bon de commande Martin » → « Trouvé — 3 secondes ». Phrase : « Vous cherchez. Vous trouvez. En 3 secondes. »

### Image F — Saisie unique des commandes (type : AVANT / APRÈS chiffré)
Avant : Commande reçue → Saisie CRM 8 min + Saisie Compta 6 min + Saisie Stock 5 min → « 19 min/commande · risque erreur : élevé ». Après : Commande reçue — saisie 1 fois → IA saisie unique automatisée → CRM ✓ instantané, Compta ✓ instantané, Stock ✓ instantané → « 45 sec · risque erreur : zéro ». Bandeau : « 19 min économisées · Sur 20 cmd/jour = 6h récupérées ». Phrase : « Une saisie. Trois outils. Zéro erreur. »

Autres images de la même série sur disque : `Axion-IA\Images Axion-IA\Images cas concrets\` (19 cas concrets + `descriptif de chaque image.txt`) et `Axion-IA\Images Axion-IA\Formations & Interventions\`.

## Dossier de sortie de l'équipe
`<dossier utilisateur>\Documents\Projets\Axion-IA\<dossier-de-plan-prive>\`

## Coordination (reçu de axion-ia-ca, 14/10 soir)
Fichiers OCCUPÉS par le générateur « Face caméra animée » (code FA, branche interface-claire/lot-c, équipe en cours) : `studio-rendu/compositions/interface-claire/**`, `src/formats/facecam-animee/**`, `src/moteurs/montage-facecam-animee/**`, `src/domaine/facecam-animee/**`, `tests/facecam-animee/**`, `scripts/essai-realisateur.ts`, + une ligne chacun dans `Racine.tsx`, `src/formats/index.ts`, `src/formats/registre-codes.ts`, `src/moteurs/ids.ts`, `src/moteurs/index.ts`.
Pièges : (1) chaque `.tsx` de studio-rendu DOIT `import React from "react"` ; (2) cartes/étiquettes/fenêtres animées : RÉUTILISER interface-claire plutôt que refaire.

## Coordination (reçu de axion-ia-43, cas concret, 14/10 soir)
OCCUPÉS : `src/moteurs/montage-cas-concret/*` (voix.ts, ecriture.ts, fabriquer.ts, fin-de-voix.ts, modifier-script.ts, script-valide.ts, index.ts, outils.ts), `src/services/cas-concret-branchements.ts`, `cas-concret.ts`, `cas-concret-scripts.ts`, `src/components/formats/cas-concret/*`, `src/formats/cas-concret/*`. Ne pas toucher `recette-voix.ts` (autre session).
PARTAGÉS étendus (réutilisables, ne pas casser) : `src/fournisseurs/types.ts` + `heygen/voix.ts` (`nouvelleLecture` → force_regenerate), `src/briques/voix-maitre/machine.ts`, `src/briques/sous-titres/scene.ts`, `composition/parametres.ts`, `composition/montage.ts` (`passagesClairs`).
PIÈCES RÉUTILISABLES : détection d'hésitation + lecture neuve HeyGen (voix.ts) ; copie WAV du brut pour couper dans les vrais blancs (fabriquer.ts) ; contrôle de fin de voix (fin-de-voix.ts) ; banque des fins par réseau `src/briques/fins/banque.ts` (VALIDÉE par Will, ne pas modifier sans lui) ; validation + modification du script avant voix (modifier-script.ts, ValidationScript.tsx).
