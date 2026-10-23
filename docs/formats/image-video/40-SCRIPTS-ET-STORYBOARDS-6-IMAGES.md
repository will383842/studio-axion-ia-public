# 40 — Scripts et storyboards des 6 images (A à F) + méthode générale

Rôle : scénariste-storyboarder de l'équipe « Image → vidéo ». Rédigé le 14/10/2026.
Sources lues : `00-BRIEF.md` ; texte et composition de la v4 (`voix4.mjs`, `compo/v4.html`) ; banque des fins du studio
(`origin/master:src/briques/fins/banque.ts`, lecture seule) ; 3 images de la série « cas concrets » pour éprouver la méthode
(appel d'offres en 6 étapes, rapport hebdomadaire à 6 sources, saisie unique = image F).

---

## 0. Conventions communes à toutes les vidéos

**Format** : vertical 1080 × 1920, grammaire de la v4 : police Anton (titres), un changement visible toutes les ~1,6 s,
deux fonds qui alternent, UN mot en orange par plan, fils orange qui relient, objets redessinés simplifiés (pas de
copie de l'image) avec micro-animations (coches, curseurs, compteurs), sous-titres discrets #15100c sur ivoire.
« axion-ia.com » visible en permanence (petit, en haut ou en bas, sur tous les plans).

**Fonds** : `S` = sombre chaud (plans d'émotion : accroche, bascule, chiffre-choc, phrase-choc) ;
`I` = ivoire (plans d'explication : étapes, schémas, listes). On alterne à chaque changement de PARTIE, pas à chaque scène.

**Synchronisation** : chaque élément apparaît sur le mot qui le nomme (horodatage mot à mot de la voix, comme `q(mot)`
dans la v4). Un plan commence ~0,1 s avant son premier mot.

**Bruitages** (familles déjà présentes dans `sources/sons`, aucune banque payante) :
`TR` = illustration-forte (changement de plan, vol. 0,22) · `IMP` = impact (chiffre-choc, mot fort, 0,55) ·
`DOC` = document (feuille, carte, ligne qui se pose, 0,30) · `TEL` = telephone (notification, message, 0,50) ·
`CHF` = chiffre (tic de compteur, coche, frappe ; en rafale pour un compteur qui défile, 0,16-0,50).
Familles qui manqueraient (à fabriquer nous-mêmes, libres de droits) : `GLISSE` (objet qui coulisse / tombe),
`ALERTE` (petite sonnette), `COCHE` dédiée. En attendant : `GLISSE` → `DOC`, `ALERTE` → `TEL`, `COCHE` → `CHF`.

**Chiffres** : toujours écrits EN LETTRES dans le texte dit (la voix les lit mieux), et affichés en chiffres à l'écran.

**Fins par réseau** (phrases reprises telles quelles de la banque validée ; une fin = UNE seule demande dite, règle du 12/10) :

| Réseau | Phrase dite après la phrase-choc | Code banque | Écran final |
|---|---|---|---|
| Instagram | « Abonnez-vous et écrivez {MOT} en commentaire : je vous l'envoie. » | `fin-ig-mot-abonnement` | « Abonnez-vous et écrivez {MOT} en commentaire » |
| Page Facebook | « Écrivez {MOT} en commentaire. Je vous l'envoie. » | `fin-if-mot-envoi` | « Écrivez {MOT} en commentaire » |
| LinkedIn | la QUESTION propre à l'image (ci-dessous), puis « Le lien est en premier commentaire. » | `fin-li-lien-commentaire` (table cas concret) | « Diagnostic gratuit · lien en commentaire » |
| TikTok / YouTube Shorts | la QUESTION propre à l'image, puis « Le lien est dans mon profil. » | `fin-tt-lien-profil` / `fin-ty-lien-profil` | « Diagnostic gratuit · lien dans le profil » |

Points à faire trancher par Will (je n'ai rien changé) :
- Base 7 de l'Usine : sur LinkedIn la cellule « dit » est VIDE (rien n'est dit, la demande va dans la légende), alors que
  la table du cas concret fait dire « Le lien est en premier commentaire. ». J'ai suivi la table du cas concret.
- Le {MOT} promet un envoi : il faut qu'un {CADEAU} réel existe pour chaque image (ex. « le schéma complet », phrase
  validée `fin-if-envoi-structure` : « Je vous envoie la structure complète. »). Mots proposés : A `FORMATION`, B `IA`,
  C `CHATBOT`, D `TRI`, E `CLASSEMENT`, F `SAISIE`.
- Le brief dit pour Facebook « le lien vous attend en premier commentaire » : cette phrase (`fin-fb-lien`) est
  DÉSACTIVÉE dans la banque depuis le 12/10 (remplacée). Sur une page Facebook, la fin au mot prime.

**Durée** : estimée à 2,75 mots/s (fourchette 2,6-2,9 à vitesse 1,1 ; la v4 tenait ~2,9 mots/s après resserrage des
blancs). Le « corps » = accroche → phrase-choc ; la fin ajoute 2 à 4 s selon le réseau.

---

## Image A — « Formation Axion-IA » (bénéfices, offre formation)

### A.1 Type détecté + carte de l'image
- **Type** : `BENEFICES_LISTE` (liste verticale de 5 cartes) + `OFFRE` (encadré méthode + bandeau d'appel + pied à 4 mentions).
- **Carte** :
  - titre : « FORMATION AXION-IA » / sous-titre : « Des bénéfices concrets, dès le premier jour. »
  - visuel : photo formateur + 3 participants ; paperboard « L'IA au service de vos résultats : Objectifs → Actions IA → Résultats » (mini-chaîne de 3 nœuds réutilisable comme transition)
  - liste « CE QUE VOUS GAGNEZ DÈS AUJOURD'HUI » (ordre haut → bas) :
    1. Gain de temps immédiat — automatisez vos tâches répétitives, libérez jusqu'à plusieurs heures dès aujourd'hui (icône horloge)
    2. Plus de clarté — structurez idées, données, actions avec des outils IA simples
    3. Meilleure productivité — processus optimisés, décisions plus rapides
    4. Réduction des coûts — moins d'erreurs, moins de pertes de temps
    5. Résultats concrets — actions applicables tout de suite, impact mesurable dès le 1er jour
  - encadré méthode : « Une approche pratique, orientée résultats — des outils, des cas concrets et un accompagnement sur-mesure. »
  - bandeau d'appel (= phrase-choc) : « Formez-vous aujourd'hui, transformez vos résultats dès demain. »
  - pied : Cas concrets · Ateliers pratiques · Outils prêts à l'emploi · Accompagnement personnalisé
  - **chiffres** : « 1er jour » (et « 5 » bénéfices, implicite). AUCUN chiffre d'heures : « plusieurs heures » reste flou → ne pas chiffrer.

### A.2 Script voix
```voix
Une formation IA qui sert dès le premier jour. Oui, le premier.
Vous connaissez la formation classique : beaucoup de théorie, et le lundi, rien ne change.
Chez Axion-IA, on fait l'inverse.
Un : vous gagnez du temps. Vos tâches répétitives s'automatisent, et vous libérez jusqu'à plusieurs heures.
Deux : plus de clarté. Vos idées, vos données, vos actions, enfin rangées, avec des outils simples.
Trois : plus de productivité. Des processus plus fluides, des décisions plus rapides.
Quatre : moins de coûts. Moins d'erreurs, moins de temps perdu.
Cinq : des résultats concrets. Des actions à appliquer tout de suite, et un impact que vous mesurez dès le premier jour.
Comment ? Des cas concrets, des ateliers pratiques, des outils prêts à l'emploi, et un accompagnement sur mesure.
Formez-vous aujourd'hui. Transformez vos résultats dès demain.
```
Question (LinkedIn, TikTok) : « Et vous, quelle tâche aimeriez-vous ne plus jamais faire à la main ? »
Mot (Instagram, Facebook) : `FORMATION`.

### A.3 Storyboard
| # | Texte dit | À l'écran (ce qui prend vie) | Fond | Orange | Son |
|---|---|---|---|---|---|
| 1 | « Une formation IA qui sert dès le premier jour. » | Mots qui montent un à un ; un calendrier « J1 » se pose, page qui claque | S | premier | TR, IMP sur « premier » |
| 2 | « Oui, le premier. » | « 1er JOUR » géant qui grossit (flou → net), lueur | S | 1er | IMP |
| 3 | « …la formation classique : beaucoup de théorie… » | Une pile de feuilles de cours qui s'empile, un bâillement-curseur qui clignote | I | théorie | DOC ×3 |
| 4 | « …et le lundi, rien ne change. » | Calendrier « LUNDI », la pile tremble puis grise | I | lundi | IMP sourd |
| 5 | « Chez Axion-IA, on fait l'inverse. » | La pile se retourne (rotation 180°), devient le paperboard « Objectifs → Actions IA → Résultats » : les 3 flèches se dessinent | S | inverse | TR, CHF ×3 sur les flèches |
| 6 | « Un : vous gagnez du temps. » | Carte 1 (horloge) glisse ; aiguilles qui tournent à l'envers | I | temps | DOC, CHF |
| 7 | « Vos tâches répétitives s'automatisent… plusieurs heures. » | 3 petites tâches identiques défilent puis se cochent seules ; bulle « jusqu'à plusieurs heures » | I | automatisent | CHF ×3 (coches) |
| 8 | « Deux : plus de clarté. Vos idées, vos données, vos actions… » | Carte 2 ; 3 post-it en vrac qui se rangent dans 3 colonnes au mot « rangées » | I | clarté | DOC ×3 |
| 9 | « Trois : plus de productivité… décisions plus rapides. » | Carte 3 ; une jauge qui monte, un curseur qui clique « Décider » | I | productivité | CHF |
| 10 | « Quatre : moins de coûts. Moins d'erreurs, moins de temps perdu. » | Carte 4 ; 2 croix rouges qui s'effacent, pièce qui reste dans la tirelire | I | coûts | IMP léger |
| 11 | « Cinq : des résultats concrets… » | Carte 5 ; cible + flèche qui se plante | I | concrets | IMP |
| 12 | « …un impact que vous mesurez dès le premier jour. » | Mini-graphe qui monte, étiquette « J1 » | I | premier | CHF |
| 13 | « Comment ? » | Les 5 cartes rétrécissent en colonne à gauche (récapitulatif, 1 s) | S | Comment | TR |
| 14 | « Des cas concrets, des ateliers… un accompagnement sur mesure. » | Les 4 mentions du pied tombent une par une comme des badges | S | sur mesure | DOC ×4 |
| 15 | « Formez-vous aujourd'hui. » | Bandeau CTA qui se déroule, mot à mot | S | aujourd'hui | IMP |
| 16 | « Transformez vos résultats dès demain. » | « demain » en lueur ; logo Axion-IA | S | demain | IMP |
| 17 | Fin réseau | Écran de fin propre au réseau (champ de commentaire où {MOT} se tape lettre à lettre, comme la v4) | I | {MOT} | CHF en rafale |

### A.4 Accroche alternative (test A/B)
« Vous avez déjà suivi une formation… qui n'a rien changé le lundi ? » (douleur d'abord, puis « Celle-ci sert dès le premier jour. »)

---

## Image B — « Vous gagnez. Concrètement. » (bénéfices)

### B.1 Type détecté + carte de l'image
- **Type** : `BENEFICES_LISTE` horizontale (5 colonnes égales, aucune flèche, aucun chiffre).
- **Carte** :
  - titre : « Vous gagnez. Concrètement. » / sous-titre : « Nos formations et interventions vous apportent des résultats visibles et durables. »
  - colonnes (gauche → droite) : 1 Gagnez du temps (automatisez les tâches chronophages) · 2 Prenez de meilleures décisions (IA + données, plus vite et plus juste) · 3 Dépassez vos concurrents (innovez, optimisez, longueur d'avance) · 4 Développez vos compétences (expertise, confiance) · 5 Boostez votre performance (résultats et rentabilité durables)
  - phrase-choc / signature : « Comprendre. Former. Transformer. »
  - **chiffres** : aucun (seulement « 5 » colonnes). → l'accroche ne peut PAS être un chiffre : question directe.

### B.2 Script voix
```voix
L'IA, tout le monde en parle. Mais concrètement, vous y gagnez quoi ?
Vous voyez vos concurrents s'y mettre, et vous ne savez pas par où commencer.
Voici ce que nos formations et nos interventions changent. Pour de vrai, et pour longtemps. Cinq choses.
Un. Vous gagnez du temps : les tâches qui vous mangent la journée s'automatisent.
Deux. Vous décidez mieux : l'IA, plus vos données, pour décider plus vite et plus juste.
Trois. Vous prenez une longueur d'avance : vous innovez, vous optimisez, vous dépassez vos concurrents.
Quatre. Vous montez en compétences. Et en confiance.
Cinq. Votre performance grimpe : des résultats et une rentabilité qui durent.
Comprendre. Former. Transformer.
```
Question (LinkedIn, TikTok) : « Et vous, des cinq, lequel vous manque le plus ? »
Mot (Instagram, Facebook) : `IA`.

### B.3 Storyboard
| # | Texte dit | À l'écran | Fond | Orange | Son |
|---|---|---|---|---|---|
| 1 | « L'IA, tout le monde en parle. » | Bulles de conversation qui se multiplient tout autour de « IA » | S | IA | TR, TEL ×3 (bulles) |
| 2 | « Mais concrètement, vous y gagnez quoi ? » | Les bulles s'effacent, reste « ? » géant | S | quoi | IMP |
| 3 | « Vous voyez vos concurrents s'y mettre… » | 3 silhouettes de boutiques qui s'allument une à une | I | concurrents | CHF ×3 |
| 4 | « …et vous ne savez pas par où commencer. » | Un curseur qui hésite entre 3 chemins (flèches qui clignotent) | I | commencer | DOC |
| 5 | « Voici ce que nos formations… changent. Pour de vrai, et pour longtemps. » | Titre « Vous gagnez. *Concrètement.* » mot à mot | S | Concrètement | TR, IMP |
| 6 | « Cinq choses. » | « 5 » qui se pose, 5 emplacements vides en ligne | S | Cinq | CHF ×5 |
| 7 | « Un. Vous gagnez du temps… s'automatisent. » | Colonne 1 monte du bas ; horloge dont l'aiguille accélère puis se cale | I | temps | DOC, CHF |
| 8 | « Deux. Vous décidez mieux… plus vite et plus juste. » | Colonne 2 ; « IA » + icône données qui fusionnent → un bouton « Décider » coché | I | mieux | DOC, CHF |
| 9 | « Trois. Vous prenez une longueur d'avance… » | Colonne 3 ; deux flèches en course, la nôtre (orange) passe devant | I | avance | GLISSE→DOC, IMP |
| 10 | « Quatre. Vous montez en compétences. Et en confiance. » | Colonne 4 ; marches d'escalier qui se construisent, une étoile au sommet | I | confiance | DOC ×3 |
| 11 | « Cinq. Votre performance grimpe… qui durent. » | Colonne 5 ; graphe en hausse qui reste haut | I | grimpe | CHF |
| 12 | (fin de la liste) | Dézoom : les 5 colonnes côte à côte = l'image entière reconstituée (1,2 s) | I | — | TR |
| 13 | « Comprendre. » | Mot seul, plein écran | S | Comprendre | IMP |
| 14 | « Former. » | Mot seul | S | Former | IMP |
| 15 | « Transformer. » | Mot seul en orange, lueur ; logo | S | Transformer | IMP fort |
| 16 | Fin réseau | Écran de fin | I | {MOT} / « cinq » | CHF |

### B.4 Accroche alternative (test A/B)
« Cinq choses changent quand vos équipes savent se servir de l'IA. » (promesse chiffrée de liste, très bonne rétention : le spectateur attend le n° 5).

---

## Image C — Chatbot de support 24 h/24 (automatisation à embranchement)

### C.1 Type détecté + carte de l'image
- **Type** : `EMBRANCHEMENT` (1 entrée → 1 nœud de décision → 2 branches de longueurs 4 et 4, sans retour) + bandeau de chiffres + phrase-choc.
- **Carte** :
  - n1 « Message client entrant — 23h14 » (déclencheur, horodaté)
  - n2 « Chatbot IA analyse la demande » (DÉCISION)
  - branche A (orange, majoritaire) — étiquette « 80 % — Réponse connue » : A1 Réponse générée → A2 Envoyée en 4 sec → A3 Ticket clôturé auto → A4 « Résolu sans intervention humaine »
  - branche B (noir, minoritaire) — étiquette « 20 % — Limite atteinte » : B1 Email structuré auto (Objet / Contexte / Demande / Urgence) → B2 Envoyé équipe concernée → B3 Alerte Telegram « 🔔 Intervention requise » → B4 Client informé « Réponse sous 2h »
  - bandeau : 80 % résolus instantanément · 0 demande perdue · 24h/24
  - phrase-choc : « Votre client a toujours une réponse. Même à 3h du matin. »
  - **chiffres à dire (9)** : 23h14 · 80 % · 4 sec · 20 % · 2h · 80 % · 0 · 24h/24 · 3h

### C.2 Script voix
```voix
Vingt-trois heures quatorze. Un client vous écrit.
Vous, vous dormez. Lui, il attend. Et demain matin, il a peut-être déjà vu ailleurs.
Sauf si quelqu'un lui répond. Tout de suite.
Son message arrive. Le chatbot lit la demande. Et là, deux chemins.
Quatre-vingts pour cent du temps, la réponse est connue. Il l'écrit, il l'envoie en quatre secondes, et le ticket se ferme tout seul. Personne n'a bougé.
Les vingt pour cent restants, il atteint sa limite. Alors il prépare un e-mail propre : l'objet, le contexte, la demande, l'urgence.
L'e-mail part à la bonne équipe. Une alerte tombe sur Telegram : intervention requise.
Et le client est prévenu : réponse sous deux heures.
Résultat : quatre-vingts pour cent résolus tout de suite. Zéro demande perdue. Vingt-quatre heures sur vingt-quatre.
Votre client a toujours une réponse. Même à trois heures du matin.
```
Question (LinkedIn, TikTok) : « Et chez vous, combien de messages attendent jusqu'au lendemain ? »
Mot (Instagram, Facebook) : `CHATBOT`.

### C.3 Storyboard (caméra virtuelle qui suit le flux)
| # | Texte dit | À l'écran | Fond | Orange | Son |
|---|---|---|---|---|---|
| 1 | « Vingt-trois heures quatorze. » | Téléphone dans le noir, l'horloge « 23:14 » s'allume | S | 23:14 | TR, IMP |
| 2 | « Un client vous écrit. » | Notification qui tombe du haut, l'écran vibre | S | écrit | TEL |
| 3 | « Vous, vous dormez. Lui, il attend. » | Écran partagé : lune + « Zzz » / bulle « … » qui clignote sans fin | S | attend | CHF lent ×3 |
| 4 | « Et demain matin, il a peut-être déjà vu ailleurs. » | La bulle s'éloigne et sort du cadre | S | ailleurs | GLISSE→DOC |
| 5 | « Sauf si quelqu'un lui répond. Tout de suite. » | Bascule de fond ; un fil orange part de la bulle vers le bas | I | Tout de suite | TR, IMP |
| 6 | « Son message arrive. Le chatbot lit la demande. » | Caméra sur n1 (carte « Message client entrant · 23h14 ») ; le fil se dessine jusqu'à n2 ; n2 « Chatbot IA » avec une loupe qui balaie le texte | I | lit | DOC, CHF |
| 7 | « Et là, deux chemins. » | Le fil se SÉPARE en deux (Y) ; étiquettes « 80 % » (orange) et « 20 % » (noir) apparaissent ; dézoom pour voir les deux branches 1 s | I | deux | IMP |
| 8 | « Quatre-vingts pour cent du temps, la réponse est connue. » | Caméra glisse sur la branche orange ; jauge circulaire qui se remplit à 80 % | I | 80 % | CHF en rafale (compteur 0→80) |
| 9 | « Il l'écrit, il l'envoie en quatre secondes… » | A1 : bulle de réponse qui se tape ; A2 : chronomètre 0→4 s, avion papier qui part | I | quatre secondes | CHF ×4, TEL |
| 10 | « …et le ticket se ferme tout seul. Personne n'a bougé. » | A3 : ticket qui se plie et se coche ; A4 : badge « Résolu sans intervention humaine » | I | tout seul | CHF (coche), IMP |
| 11 | « Les vingt pour cent restants, il atteint sa limite. » | Caméra REMONTE au nœud n2 (retour visible) puis descend la branche noire ; jauge 20 % | I | limite | TR, CHF |
| 12 | « Alors il prépare un e-mail propre : l'objet, le contexte, la demande, l'urgence. » | B1 : e-mail dont les 4 lignes se remplissent sur les 4 mots (Objet, Contexte, Demande, Urgence) | I | propre | DOC ×4 |
| 13 | « L'e-mail part à la bonne équipe. » | B2 : l'e-mail glisse vers une icône « équipe » qui s'allume | I | équipe | GLISSE→DOC |
| 14 | « Une alerte tombe sur Telegram : intervention requise. » | B3 : téléphone, notification « 🔔 Intervention requise » qui secoue l'écran | I | alerte | TEL (ALERTE) |
| 15 | « Et le client est prévenu : réponse sous deux heures. » | B4 : bulle côté client « Réponse sous 2h » + coche | I | deux heures | TEL, CHF |
| 16 | (transition) | Dézoom complet : tout le schéma visible, les deux branches allumées (1,2 s) | I | — | TR |
| 17 | « Résultat : quatre-vingts pour cent résolus tout de suite. » | Bascule ; « 80 % » géant | S | 80 % | IMP |
| 18 | « Zéro demande perdue. Vingt-quatre heures sur vingt-quatre. » | « 0 » qui claque, puis horloge 24h qui fait un tour complet | S | Zéro | IMP, CHF en rafale |
| 19 | « Votre client a toujours une réponse. » | Phrase-choc mot à mot | S | toujours | IMP |
| 20 | « Même à trois heures du matin. » | Horloge « 03:00 », une coche verte s'y pose | S | trois heures | IMP fort |
| 21 | Fin réseau | Écran de fin | I | {MOT} | CHF |

### C.4 Accroche alternative (test A/B)
« Huit messages clients sur dix n'ont pas besoin de vous. » (chiffre-choc d'abord ; enchaîner sur « Et pourtant, à vingt-trois heures quatorze… »).

---

## Image D — Tri des e-mails (entonnoir 80/20)

### D.1 Type détecté + carte de l'image
- **Type** : `ENTONNOIR_REPARTITION` (N objets identiques → filtre → 2 sorties chiffrées) + bandeau + phrase-choc.
- **Carte** :
  - entrée : « 20 e-mails entrants — Questions récurrentes » (20 enveloppes dessinées)
  - filtre : entonnoir « IA classe et répond »
  - sortie 1 : 80 % répondus automatiquement — 16 enveloppes cochées vertes — « Réponse en 2 minutes »
  - sortie 2 : 20 % pour vous — 4 enveloppes — « Ceux qui comptent vraiment »
  - bandeau : 80 % traités auto · 2h récupérées/jour · 0 question sans réponse
  - phrase-choc : « Vous lisez ce qui compte. L'IA gère le reste. »
  - **chiffres à dire (9)** : 20 · 80 % · 16 · 2 minutes · 20 % · 4 · 80 % · 2h/jour · 0
  - contrôle de cohérence : 16 + 4 = 20 ✓ ; 16/20 = 80 % ✓

### D.2 Script voix
```voix
Vingt e-mails ce matin. Et toujours les mêmes questions.
Vous répondez, vous copiez, vous collez. Et pendant ce temps, ceux qui comptent vraiment attendent au fond de la boîte.
Et si l'IA faisait le tri pour vous ?
Les vingt e-mails arrivent. Ils passent tous dans le même entonnoir. L'IA les lit, les classe, et répond.
Seize sur vingt, c'est quatre-vingts pour cent, reçoivent leur réponse automatiquement. En deux minutes.
Les quatre autres, les vingt pour cent qui restent, arrivent chez vous. Ceux qui comptent vraiment.
Au bout du compte : quatre-vingts pour cent traités tout seuls. Deux heures récupérées par jour. Et zéro question sans réponse.
Vous lisez ce qui compte. L'IA gère le reste.
```
Question (LinkedIn, TikTok) : « Et vous, combien d'e-mails par jour posent la même question ? »
Mot (Instagram, Facebook) : `TRI`.

### D.3 Storyboard
| # | Texte dit | À l'écran | Fond | Orange | Son |
|---|---|---|---|---|---|
| 1 | « Vingt e-mails ce matin. » | Compteur de boîte de réception qui défile 0 → 20, enveloppes qui pleuvent | S | 20 | TR, CHF en rafale ×20 |
| 2 | « Et toujours les mêmes questions. » | Les 20 enveloppes portent toutes le même « ? » | S | mêmes | IMP |
| 3 | « Vous répondez, vous copiez, vous collez. » | Curseur qui fait Ctrl+C / Ctrl+V en boucle, de plus en plus vite | I | collez | CHF ×3 |
| 4 | « …ceux qui comptent vraiment attendent au fond de la boîte. » | Une enveloppe dorée s'enfonce sous la pile | I | vraiment | GLISSE→DOC |
| 5 | « Et si l'IA faisait le tri pour vous ? » | Bascule ; l'entonnoir orange descend du haut | S | tri | TR, IMP |
| 6 | « Les vingt e-mails arrivent. Ils passent tous dans le même entonnoir. » | Les 20 enveloppes tombent une à une dans l'entonnoir (cadence = débit de la voix) | I | entonnoir | DOC en rafale léger |
| 7 | « L'IA les lit, les classe, et répond. » | L'entonnoir tourne ; 3 mots « lit · classe · répond » s'allument tour à tour | I | répond | CHF ×3 |
| 8 | « Seize sur vingt, c'est quatre-vingts pour cent… » | Sortie gauche : 16 enveloppes sortent et s'alignent en grille 4×4, compteur « 16/20 » puis « 80 % » | I | 80 % | CHF ×16 |
| 9 | « …reçoivent leur réponse automatiquement. En deux minutes. » | Chaque enveloppe reçoit une coche verte en cascade ; chrono « 2 min » | I | deux minutes | CHF (coches), IMP |
| 10 | « Les quatre autres, les vingt pour cent qui restent, arrivent chez vous. » | Sortie droite : 4 enveloppes glissent vers une icône « Vous » ; « 20 % » | I | chez vous | GLISSE→DOC ×4 |
| 11 | « Ceux qui comptent vraiment. » | Les 4 enveloppes deviennent dorées, petite lueur | I | vraiment | IMP léger |
| 12 | (transition) | Dézoom : entonnoir + 2 sorties, image entière (1 s) | I | — | TR |
| 13 | « Au bout du compte : quatre-vingts pour cent traités tout seuls. » | Bascule ; « 80 % » géant | S | 80 % | IMP |
| 14 | « Deux heures récupérées par jour. » | Sablier qui se retourne, « +2 h / jour » | S | deux heures | CHF, IMP |
| 15 | « Et zéro question sans réponse. » | « 0 » qui claque | S | zéro | IMP |
| 16 | « Vous lisez ce qui compte. » | Phrase-choc 1/2 | S | compte | IMP |
| 17 | « L'IA gère le reste. » | Phrase-choc 2/2, « IA » en lueur ; logo | S | reste | IMP fort |
| 18 | Fin réseau | Écran de fin | I | {MOT} | CHF |

### D.4 Accroche alternative (test A/B)
« Seize de vos e-mails sur vingt n'ont pas besoin de vous. »

---

## Image E — Classement des documents (avant / après)

### E.1 Type détecté + carte de l'image
- **Type** : `AVANT_APRES` avec moteur central (sources multiples → chaos → IA en 4 verbes → ordre → preuve par une recherche).
- **Carte** :
  - AVANT — sources (5) : Email · Scan · Drive · WhatsApp · USB → pile en vrac de 4 types (PDF, Word, Excel, images) → « Recherche : 23 min »
  - CENTRE — cercle IA, 4 verbes : classe · renomme · archive · indexe
  - APRÈS — 4 dossiers : Clients · Fournisseurs · Contrats · Factures ; barre de recherche « bon de commande Martin » → « Trouvé — 3 secondes »
  - phrase-choc : « Vous cherchez. Vous trouvez. En 3 secondes. »
  - **chiffres à dire (2 + 1 répété)** : 23 min · 3 secondes (·3 secondes)
  - **mention d'exemple** : « Martin » = nom d'exemple → toujours annoncé « par exemple », jamais présenté comme un vrai client.

### E.2 Script voix
```voix
Vingt-trois minutes. Pour retrouver un seul document.
Il est arrivé par e-mail ? Par scan ? Sur le Drive ? Sur WhatsApp ? Sur une clé USB ?
Résultat : une pile en vrac. Des PDF, des Word, des Excel, des images.
Maintenant, regardez ce qui se passe quand l'IA s'en occupe.
Chaque document qui arrive passe par elle. Elle le classe. Elle le renomme. Elle l'archive. Et elle l'indexe, pour le retrouver ensuite.
Tout part dans le bon dossier : clients, fournisseurs, contrats, factures.
Vous cherchez, par exemple, le bon de commande Martin. Trouvé. En trois secondes.
Avant : vingt-trois minutes. Après : trois secondes.
Vous cherchez. Vous trouvez. En trois secondes.
```
Question (LinkedIn, TikTok) : « Et vous, combien de temps pour retrouver votre dernière facture ? »
Mot (Instagram, Facebook) : `CLASSEMENT`.

### E.3 Storyboard
| # | Texte dit | À l'écran | Fond | Orange | Son |
|---|---|---|---|---|---|
| 1 | « Vingt-trois minutes. » | Chrono qui défile vite 00:00 → 23:00 | S | 23 | TR, CHF en rafale |
| 2 | « Pour retrouver un seul document. » | Une seule feuille au centre, loupe qui tourne autour | S | seul | IMP |
| 3 | « Il est arrivé par e-mail ? Par scan ? » | Icônes Email puis Scan qui surgissent à gauche, chacune lâche une feuille | I | e-mail | TEL, DOC |
| 4 | « Sur le Drive ? Sur WhatsApp ? Sur une clé USB ? » | Icônes Drive, WhatsApp, USB surgissent en rythme (une par mot) ; feuilles qui tombent | I | USB | DOC ×3 |
| 5 | « Résultat : une pile en vrac. » | Les feuilles s'entassent de travers, la pile vacille | I | vrac | DOC ×4, IMP |
| 6 | « Des PDF, des Word, des Excel, des images. » | 4 étiquettes de format collées sur la pile, une par mot | I | images | CHF ×4 |
| 7 | « Maintenant, regardez ce qui se passe quand l'IA s'en occupe. » | Bascule ; cercle IA orange qui apparaît, la pile est aspirée vers lui | S | IA | TR, IMP |
| 8 | « Chaque document qui arrive passe par elle. » | Caméra suit une feuille qui entre dans le cercle | I | chaque | GLISSE→DOC |
| 9 | « Elle le classe. Elle le renomme. » | Les 4 verbes autour du cercle s'allument un à un : la feuille reçoit un onglet couleur, puis son nom se réécrit (« scan_0034.pdf » → « Facture-2026-10.pdf », nom fictif) | I | renomme | CHF ×2 |
| 10 | « Elle l'archive. Et elle l'indexe, pour le retrouver ensuite. » | La feuille rentre dans une boîte ; une étiquette-index se pose | I | indexe | DOC, CHF |
| 11 | « Tout part dans le bon dossier : clients, fournisseurs, contrats, factures. » | 4 dossiers s'ouvrent en ligne ; les feuilles volent chacune dans le sien, sur le mot | I | bon dossier | DOC ×4 |
| 12 | « Vous cherchez, par exemple, le bon de commande Martin. » | Barre de recherche ; le texte se tape ; petite étiquette « exemple » | I | exemple | CHF en rafale (frappe) |
| 13 | « Trouvé. En trois secondes. » | Le dossier s'ouvre, le document sort et s'agrandit ; coche ; chrono « 3 s » | I | Trouvé | IMP, CHF |
| 14 | « Avant : vingt-trois minutes. » | Bascule ; barre noire longue « 23 MIN » qui s'étire (comme le résultat de la v4) | S | 23 | DOC |
| 15 | « Après : trois secondes. » | Barre orange minuscule « 3 S » | S | trois | IMP |
| 16 | « Vous cherchez. Vous trouvez. » | Phrase-choc mot à mot | S | trouvez | IMP |
| 17 | « En trois secondes. » | « 3 secondes » en lueur ; logo | S | trois secondes | IMP fort |
| 18 | Fin réseau | Écran de fin | I | {MOT} | CHF |

### E.4 Accroche alternative (test A/B)
« Combien de temps pour retrouver un document chez vous ? Ici : trois secondes. »

---

## Image F — Saisie unique des commandes (avant / après chiffré)

### F.1 Type détecté + carte de l'image
- **Type** : `AVANT_APRES` en 2 colonnes, chacune un petit schéma (AVANT = 1 → 3 parallèles → convergence ; APRÈS = 1 → moteur IA → 3 parallèles).
- **Carte** :
  - AVANT : « Commande reçue » → 3 saisies en parallèle : CRM 8 min · Compta 6 min · Stock 5 min → convergence → « 19 min/commande · risque erreur : élevé »
  - APRÈS : « Commande reçue — saisie 1 fois » → « IA saisie unique automatisée » → CRM ✓ instantané · Compta ✓ instantané · Stock ✓ instantané → « 45 sec · risque erreur : zéro »
  - bandeau : « 19 min économisées · Sur 20 cmd/jour = 6h récupérées »
  - phrase-choc : « Une saisie. Trois outils. Zéro erreur. »
  - **chiffres à dire (11)** : 19 · 8 · 6 · 5 · élevé · 1 fois · 45 sec · zéro · 19 · 20 · 6h (+ « trois outils »)
  - contrôle de cohérence : 8+6+5 = 19 ✓. 19 × 20 = 380 min = 6 h 20 ; l'image dit « 6h » → on dit « six heures » comme l'image (arrondi prudent, on ne recalcule pas à la hausse). À signaler, ne pas corriger.

### F.2 Script voix
```voix
Dix-neuf minutes. Pour saisir une seule commande.
La commande arrive. Vous la tapez dans le CRM : huit minutes. Puis dans la compta : six minutes. Puis dans le stock : cinq minutes.
Trois fois la même chose. Et à chaque fois, un risque d'erreur. Élevé.
Maintenant, la même commande, avec l'IA.
Vous la saisissez une seule fois. L'IA la reprend, et la remplit toute seule dans les trois outils.
Le CRM : fait. La compta : faite. Le stock : fait. Instantanément.
Quarante-cinq secondes en tout. Risque d'erreur : zéro.
Dix-neuf minutes économisées par commande. Sur vingt commandes par jour, ça fait six heures récupérées.
Une saisie. Trois outils. Zéro erreur.
```
Question (LinkedIn, TikTok) : « Et chez vous, combien de fois tapez-vous la même information ? »
Mot (Instagram, Facebook) : `SAISIE`.

### F.3 Storyboard
| # | Texte dit | À l'écran | Fond | Orange | Son |
|---|---|---|---|---|---|
| 1 | « Dix-neuf minutes. » | « 19 MIN » géant qui grossit | S | 19 | TR, IMP |
| 2 | « Pour saisir une seule commande. » | Un caddie seul, petite icône commande | S | seule | DOC |
| 3 | « La commande arrive. » | Bascule ivoire ; carte « Commande reçue » en haut ; le fil orange descend et se divise en 3 | I | arrive | TR, TEL |
| 4 | « Vous la tapez dans le CRM : huit minutes. » | Carte « Saisie CRM » ; clavier qui tape, chrono qui monte 0 → 8 | I | huit | CHF en rafale |
| 5 | « Puis dans la compta : six minutes. » | Carte « Saisie Compta » ; chrono 0 → 6 ; la carte CRM reste grisée à côté | I | six | CHF en rafale |
| 6 | « Puis dans le stock : cinq minutes. » | Carte « Saisie Stock » ; chrono 0 → 5 | I | cinq | CHF en rafale |
| 7 | « Trois fois la même chose. » | Les 3 cartes clignotent ensemble, « ×3 » ; les fils convergent vers le bas | I | Trois | IMP |
| 8 | « Et à chaque fois, un risque d'erreur. Élevé. » | Addition 8 + 6 + 5 = 19 qui se pose ; triangle d'alerte qui tremble « risque : élevé » | I | Élevé | DOC ×3, IMP |
| 9 | « Maintenant, la même commande, avec l'IA. » | Volet qui balaie l'écran (AVANT glisse à gauche) ; bascule ; cercle IA avec le petit robot qui cligne des yeux | S | IA | TR, IMP |
| 10 | « Vous la saisissez une seule fois. » | Carte « Commande reçue — saisie 1 fois », un seul coup de clavier | I | une seule | CHF ×1 |
| 11 | « L'IA la reprend, et la remplit toute seule dans les trois outils. » | Le fil entre dans le cercle IA puis en ressort en 3 fils simultanés | I | toute seule | GLISSE→DOC |
| 12 | « Le CRM : fait. La compta : faite. Le stock : fait. » | Les 3 cartes CRM / Compta / Stock apparaissent et se cochent, une par mot | I | fait | CHF (coche) ×3 |
| 13 | « Instantanément. » | Les 3 étiquettes « instantané » s'allument ensemble | I | Instantanément | IMP léger |
| 14 | « Quarante-cinq secondes en tout. Risque d'erreur : zéro. » | Chrono 45 s ; bouclier coché « risque : zéro » | I | zéro | CHF, IMP |
| 15 | (transition) | Écran partagé AVANT | APRÈS, l'image entière reconstituée (1,2 s) | I | — | TR |
| 16 | « Dix-neuf minutes économisées par commande. » | Bascule ; compteur « 19 min » | S | économisées | IMP |
| 17 | « Sur vingt commandes par jour, ça fait six heures récupérées. » | 20 petits caddies qui s'alignent, puis se fondent en « 6 H » | S | six heures | CHF ×20 léger, IMP |
| 18 | « Une saisie. » | Phrase-choc 1/3 | S | saisie | IMP |
| 19 | « Trois outils. » | 2/3 | S | Trois | IMP |
| 20 | « Zéro erreur. » | 3/3, lueur ; logo | S | Zéro | IMP fort |
| 21 | Fin réseau | Écran de fin | I | {MOT} | CHF |

### F.4 Accroche alternative (test A/B)
« Vous tapez la même commande trois fois ? » (douleur-question, puis « Dix-neuf minutes, à chaque fois. »)

---

## Comptage des mots et durées (corps, sans la fin réseau)

Comptage automatique fait sur les blocs `voix` ci-dessus (mots séparés par des espaces ; « e-mail », « Axion-IA » = 1 mot).
Durée estimée = mots ÷ 2,75 (fourchette ÷ 2,9 à ÷ 2,6). La fin ajoute ≈ 2-4 s.

| Image | Mots (corps) | Durée estimée | Fourchette | + fin réseau ≈ |
|---|---|---|---|---|
| A — Formation | 136 | 49 s | 47-52 s | 52-54 s |
| B — Vous gagnez | 112 | 41 s | 39-43 s | 43-45 s |
| C — Chatbot 24 h/24 | 142 | 52 s | 49-55 s | 54-57 s (limite haute : si la voix réelle dépasse 55 s, couper « Personne n'a bougé. » et « Tout de suite. ») |
| D — Tri des e-mails | 116 | 42 s | 40-45 s | 44-47 s |
| E — Classement | 113 | 41 s | 39-43 s | 43-46 s |
| F — Saisie unique | 112 | 41 s | 39-43 s | 43-46 s |

Toutes les durées sont des estimations : la vraie durée sort de la voix générée (non lancée : aucun essai payant sans accord de Will).

---

## MÉTHODE GÉNÉRALE — de n'importe quelle image à un script + storyboard

### 1. Lire l'image, jamais son nom de fichier
Constaté sur la série « cas concrets » : les noms de fichiers ne correspondent PAS au contenu (le fichier
« pipeline-commercial-leads » montre un appel d'offres, « onboarding-rh » un rapport hebdomadaire, « reclamations-clients »
est l'image F). Le générateur lit l'IMAGE (vision) et ignore le nom.

### 2. Produire d'abord la « carte de l'image » (structure figée, vérifiable)
```
type            BENEFICES_LISTE | CHAINE | EMBRANCHEMENT | ENTONNOIR_REPARTITION | AVANT_APRES | CONVERGENCE | TABLEAU_DE_BORD | CHRONOLOGIE (une image peut en combiner 2)
titre, sous_titre, phrase_choc (bas de l'image), signature
noeuds[]        { id, libelle_exact, icone, role: declencheur|etape|decision|sortie|resultat, chiffres[], auto|humain }
liens[]         { de, vers, etiquette (ex. « 80 % — Réponse connue »), couleur (orange = branche principale) }
bandeau_chiffres[]
exemples[]      noms propres d'illustration (« Martin ») → marqués EXEMPLE
chiffres[]      inventaire COMPLET : valeur + unité + où (nœud/lien/bandeau)
coherence[]     calculs vérifiables (16+4=20 ; 8+6+5=19 ; 19×20=380 min ≠ « 6h ») → signalés, JAMAIS corrigés
```
Ordre de lecture = sens des flèches ; sans flèche : haut → bas, gauche → droite.

### 3. Parcours selon le type (ce qui prend vie)
| Type | Parcours de la voix | Animation de référence |
|---|---|---|
| BENEFICES_LISTE | Numéroter « Un… Cinq » (attente du dernier = rétention), 1 bénéfice = 1 phrase titre + 1 phrase concrète | carte qui monte + 1 micro-objet qui JOUE le bénéfice (horloge, jauge, cible) |
| CHAINE (N étapes) | « D'abord… ensuite… et là… » ; 1 étape = 1 phrase ≤ 12 mots | fil orange qui se dessine d'étape en étape, caméra qui suit, coche à chaque étape faite |
| EMBRANCHEMENT | Annoncer « deux chemins », branche MAJORITAIRE (orange) d'abord jusqu'au bout, RETOUR visible au nœud de décision, puis l'autre branche | le fil se sépare en Y, dézoom 1 s, caméra qui remonte avant la 2ᵉ branche |
| ENTONNOIR_REPARTITION | volume d'entrée → filtre → chaque sortie avec son compte ET son pourcentage | objets qui tombent dans l'entonnoir au rythme de la voix, comptés à la sortie |
| AVANT_APRES | Avant entier (chiffres qui s'additionnent) → bascule « Maintenant… » → Après entier → duel de chiffres | volet / changement de fond à la bascule, barres « avant / maintenant » (gabarit v4) |
| CONVERGENCE (N sources → moteur) | citer les sources en rafale (1 par mot), puis le moteur, puis la sortie | sources qui s'allument une à une, fils pointillés qui convergent |
| TABLEAU_DE_BORD | ne dire que 2-3 indicateurs + le point d'attention ; les autres affichés sans être dits | tuiles qui se remplissent, flèches de tendance qui se tracent |
| CHRONOLOGIE | heures dites dans l'ordre (« dimanche vingt-trois heures… lundi six heures ») | frise qui avance, horloge |

### 4. Schémas complexes (10 à 15 étapes, plusieurs embranchements)
1. **Caméra virtuelle** : on ne montre jamais tout le schéma lisible d'un coup. Gros plan sur le nœud parlé, la caméra
   glisse le long du fil vers le suivant ; dézoom de 1 à 1,5 s seulement aux charnières (après l'embranchement, en fin
   d'explication) pour que le spectateur garde la carte en tête.
2. **Révélation progressive** : un nœud n'existe à l'écran qu'à partir du mot qui le nomme ; les nœuds déjà vus
   restent en grisé derrière (repères).
3. **Regroupement** : les étapes automatiques consécutives sans chiffre se disent en UNE phrase-rafale (« Les critères,
   les références, le chiffrage : tout se fait seul. ») et s'animent en cascade de coches. Les étapes HUMAINES et les
   étapes CHIFFRÉES ne se regroupent jamais. Cible : 7 unités narratives au plus.
4. **Embranchements multiples** : branche orange/majoritaire d'abord ; chaque retour au nœud de décision est montré ;
   au-delà de 2 niveaux de décision, on résume la branche mineure en 1 phrase (sans omettre ses chiffres).
5. **Budget** : corps 35-55 s (≈ 95-150 mots) + fin. Scène 1,5-4 s, moyenne 1,6-2 s. Le budget se répartit : accroche
   ≤ 3 s, douleur ≤ 8 s, début de réponse ≤ 3 s, explication 55-65 %, chiffres + phrase-choc ≤ 8 s.
6. **Trop dense → 2 vidéos.** Déclencheurs (un seul suffit) : explication > 150 mots après regroupement ; > 12
   chiffres distincts ; > 9 unités narratives ; > 2 niveaux de décision. Découpe : **Vidéo 1** = accroche + douleur +
   chemin principal + chiffres-clés (« la suite dans la prochaine vidéo ») ; **Vidéo 2** = rappel 3 s du schéma +
   branches secondaires + résultat complet. Chaque vidéo doit rester compréhensible seule. Sinon (préférence Will à
   confirmer) : une version « survol » de 45 s pour les réseaux + une version longue pour YouTube.

### 5. Choisir l'accroche (1 à 3 s, ≤ 8 mots)
Ordre de priorité, sur la carte de l'image :
1. le **chiffre AVANT le plus douloureux** (temps perdu, durée) : « Dix-neuf minutes. Pour une seule commande. »
2. une **heure / scène concrète** : « Vingt-trois heures quatorze. Un client vous écrit. »
3. un **volume** qui parle au quotidien : « Vingt e-mails ce matin. »
4. image SANS chiffre (bénéfices) : **question directe en « vous »** ou promesse de liste numérotée.
La variante A/B prend toujours une AUTRE famille (chiffre ↔ question ↔ ratio « seize sur vingt n'ont pas besoin de vous »).
Interdit en accroche : un chiffre qui n'est pas dans l'image, une promesse de gain.

### 6. Règles d'écriture (contrôlées automatiquement avant toute voix)
- Phrases ≤ 12 mots, présent, « vous », verbes d'action ; chiffres EN LETTRES ; pas de jargon (« CRM » toléré s'il est
  écrit sur l'image).
- **Inventaire des chiffres** : chaque chiffre de la carte figure dans le script (sinon : rejet), et le script ne
  contient AUCUN chiffre absent de la carte (hors numérotation « un, deux… » et « trois outils » déduit d'un compte
  visible). Les incohérences de l'image sont dites telles qu'écrites et signalées à Will.
- Mots interdits : « machine », « Villeexemple », « aucun gain garanti », « certifié » (Certifexemple), tout nom présenté comme
  un vrai client (« Martin » → « par exemple »), toute promesse non écrite sur l'image.
- La phrase-choc de l'image est reprise MOT POUR MOT, juste avant la fin réseau.
- Une seule demande dite à la fin (banque des fins, jamais réécrite) ; la dernière phrase doit être dite EN ENTIER.

### 7. Règles de mise en image
- Un changement visible toutes les ~1,6 s (apparition, coche, compteur, mouvement de caméra).
- Ce qui est DESSINÉ dans l'image prend vie (enveloppes qui tombent, fil qui se divise, chrono qui défile) : on
  redessine simplifié, on ne colle pas l'image. L'image entière n'apparaît qu'en dézoom de charnière.
- Fond sombre chaud = émotion (accroche, bascule, chiffres-choc, phrase-choc) ; ivoire = explication. Changement de
  fond à chaque changement de partie.
- UN mot orange par plan = le mot qui porte le chiffre ou le bénéfice.
- Bruitage obligatoire à chaque changement de plan (`TR`), à chaque chiffre-choc (`IMP`), à chaque objet qui se pose
  (`DOC`, `TEL`), à chaque coche ou compteur (`CHF`, en rafale pour un compteur). Jamais de musique.
- « axion-ia.com » visible sur tous les plans.
