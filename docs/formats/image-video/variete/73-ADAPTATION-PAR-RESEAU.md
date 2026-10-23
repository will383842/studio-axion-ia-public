# 73 · Image → vidéo : une adaptation par réseau (15/10/2026)

**Décision de Will du 15/10.** La vidéo Image → vidéo (IV) n'est plus « la même pour tous » : elle est adaptée **à chaque réseau**. En plus de la version verticale 9:16 (TikTok, Reels Instagram, YouTube Shorts, Reels Facebook), on ajoute une **version 4:5 (1080 × 1350)** pour **LinkedIn** et le **fil Facebook**. Cette décision remplace la décision B4 du 52 (« LinkedIn en vertical, le presque carré plus tard »).

**Où on en est aujourd'hui** (inventaire 71, § 15, et code) : l'IV sort **une seule image verticale 1080 × 1920 pour les 5 réseaux** ; seuls la fin, le plafond de durée et les liens changent. La fiche des réseaux du studio connaît déjà le 4:5 en 1080 × 1350 et ses zones protégées pour LinkedIn et Instagram (`src/reseaux/index.ts`), mais **le moteur IV ne fabrique pas encore de 4:5**, et **le fil Facebook n'a pas encore de zones protégées en 4:5**. Tout ce qui suit est donc une proposition à valider, pas une fonction existante.

---

## 1. Réseau par réseau

Durées : ce sont les **propositions** du document 70 (§ 4, « Durées de travail proposées »), pas des normes officielles. Le moteur garde ses plafonds actuels (60 s TikTok, Shorts, LinkedIn ; 90 s Instagram et Facebook).

| Réseau | Format | Durée conseillée (doc 70) | Ce qui change | Zones protégées (marges sans texte important) |
|---|---|---|---|---|
| **TikTok** | 9:16 · 1080 × 1920 | **21 à 34 s** (guide pub TikTok, § 4) | Accroche **dès la 1re seconde**, message principal avant 3 s (TikTok, § 2). Fin bouclable. Question « commentez » en fin. | haut 10 %, bas 26 %, droite 18 %, gauche 4 % |
| **YouTube Shorts** | 9:16 · 1080 × 1920 | **20 à 45 s**, construit pour boucler (§ 4) | Mesuré en « regardé ou passé » (§ 2) : pas d'écran vide au début. La boucle compte. | pas de fiche Shorts dans le code : on garde les marges du vertical IV actuel (sous-titres entre 60 et 67 % de la hauteur) |
| **Reels Instagram** | 9:16 · 1080 × 1920 | **15 à 45 s**, fait pour être envoyé à quelqu'un (§ 4) | Les 3 premières secondes comptent (Instagram, § 2). Un chiffre ou une phrase qu'on a envie d'envoyer. | haut 14 %, bas 30 %, droite 16 %, gauche 6 % |
| **Reels Facebook** | 9:16 · 1080 × 1920 | **15 à 30 s**, avec son et sous-titres (§ 4) | Les sous-titres font regarder 12 % plus longtemps (Meta, § 4). « Le lien est en commentaire. » | haut 14 %, bas 30 %, droite 16 %, gauche 6 % |
| **LinkedIn** | **4:5 · 1080 × 1350** | **30 à 60 s**, plus dense (§ 4) ; au-delà de 3 min, les publics seniors décrochent (LinkedIn, § 4) | **Rythme plus posé**, chiffres mis en avant. **Pas de question « commentez »** : la vidéo s'arrête sur la phrase-choc et le logo (règle déjà en place). **Son coupé par défaut** (« la plupart des membres regardent sans le son », LinkedIn, § 4) → **sous-titres indispensables**. | haut 4 %, bas 10 % (barre de lecture), côtés 4 % |
| **Fil Facebook** | **4:5 · 1080 × 1350** | **15 à 30 s** (même source que les Reels Facebook ; Meta conseille un message en 15 s ou moins, § 2) | Vidéo vue en défilant, souvent sans le son → **sous-titres indispensables**, image forte d'entrée. « Le lien est en commentaire. » | pas encore dans le code : on propose les marges de LinkedIn (haut 4 %, bas 10 %, côtés 4 %), à vérifier |

**À savoir honnêtement** : nos vidéos IV durent aujourd'hui entre 30 et 56 s pour la plupart (78 s pour les plus complexes). Elles dépassent donc souvent les durées conseillées pour Instagram, Facebook et TikTok. Voir la question 2 en fin de document.

---

## 2. Les variantes conseillées ou déconseillées par réseau

Codes du document 72.

- **TikTok, Shorts, Reels (9:16)** : ouvertures qui « claquent » : **OUV-A** résultat d'abord, **OUV-D** question à l'écran. **FIN-C boucle** très utile sur Shorts et TikTok. **TYP-B** un mot géant à la fois et **SOU-C** sous-titres appuyés vont bien aux vidéos courtes. **CHI-A** compteur et **CHI-C** duel de tailles marchent bien.
- **LinkedIn et fil Facebook (4:5)** : ouvertures plus « sérieuses » : **OUV-B** avant / après d'un coup, **OUV-E** détail puis recul. Chiffres : **CHI-D chiffre géant** et **CHI-B jauge**, très lisibles sans le son. Caméra : **CAM-B** vue d'ensemble d'abord ou **CAM-D** plan fixe qui se construit (moins de mouvement, plus de lecture). Fin : **FIN-B** tout le schéma puis la phrase, ou **FIN-D** le chiffre qui reste. Matière **MAT-B** papier, sous-titres **SOU-A** calme ou **SOU-B**.
- **Déconseillé sur LinkedIn** : **TYP-B** (un mot géant à la fois, trop nerveux), **SOU-C** (trop appuyé), **FIN-C** (la boucle sert peu ici). **CAM-E** côte à côte : à éviter en 4:5 si les deux branches deviennent trop étroites pour être lues.
- **Ouverture par réseau, sans repayer la voix** (72, § 5, point 6) : l'**image** d'ouverture peut changer d'un réseau à l'autre (par exemple OUV-A sur TikTok, OUV-B sur LinkedIn), car la voix reste la même. Seule condition : l'image doit coller aux mots dits pendant ces 3 premières secondes.

---

## 3. Passer du 9:16 au 4:5 sans refaire la vidéo

- **Même voix, même ordre, même script** : une seule voix payée. Le 4:5 est une **autre mise en page** de la même vidéo, pas une nouvelle vidéo.
- **On perd surtout de la place vide.** Le 4:5 fait 570 px de moins en hauteur. En 9:16, une grande partie du haut et du bas est déjà réservée aux boutons des applis (jusqu'à 30 % en bas sur Instagram). Sur LinkedIn, ces marges sont bien plus petites (4 % en haut, 10 % en bas). Le schéma peut donc garder **presque la même taille**.
- **L'en-tête se resserre** (moins haut, titre sur une ligne si possible).
- **La bande des sous-titres se resserre** et remonte juste au-dessus de la barre de lecture (les 10 % du bas restent libres).
- **Le schéma est recadré** : il peut prendre toute la largeur (pas de boutons à droite sur LinkedIn), et la caméra cadre un peu plus large pour les schémas à branches.
- **Les écrans de texte** (ouverture, chiffres, phrase-choc) sont recomposés, pas coupés : mêmes mots, taille ajustée.
- **Ce qu'on ne doit jamais couper** : un chiffre et son unité ; une étape du schéma ou une branche (même la petite branche « 20 % ») ; le mot orange ; la phrase-choc ; les sous-titres ; la mention « situation type » ; le logo et « axion-ia.com ».

Les planches à venir montreront le même passage sur 4 écrans clés de l'image du chatbot (ouverture, schéma, chiffres, fin), en 9:16 et en 4:5 côte à côte : `planche/planche-4x5-linkedin-facebook.jpg`.

---

## 4. Ce que Will a à décider

1. **Facebook** : on publie **deux** versions (Reel en 9:16 **et** fil en 4:5) ou une seule ? Si une seule, laquelle ?
2. **Durée** : on garde **une seule durée** pour tous les réseaux (35 à 55 s en général), ou on fait une **version plus courte** (vers 30 s) pour TikTok, Reels et Facebook, avec la même voix et des passages retirés ?
3. **Ouverture par réseau** : on change l'image d'ouverture selon le réseau (par exemple chiffre qui claque sur TikTok, avant / après sur LinkedIn), ou on garde la même partout ?
