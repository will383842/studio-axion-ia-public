# Studio vidéo Axion-IA — plan d'implémentation de la console (version 2)

> Version 2 — 2026-10-01. Remplace la version 1 et son avenant.
> Ce qui a changé : plusieurs personnages (pas seulement Will), formats et durées multiples, galerie par format, kit de publication pour les réseaux, préparation des futurs moteurs, **une seule passe de vérification** pour aller vite.
> Périmètre : **la console seule**, complète, avec des **simulations** à la place des moteurs. **Aucun moteur n'est construit.**
> Adresse visée : **studio.axion-ia.com**, accessible de partout, protégée par mot de passe.

---

## PARTIE A — Pour Will, en clair

### Ce qu'on construit maintenant : la console

Une application en ligne, **pensée d'abord pour le téléphone**. Voici son menu :

| Menu | À quoi ça sert |
|---|---|
| 🏠 **Accueil** | Gros bouton « Nouvelle vidéo », vidéos en cours, dernières vidéos |
| ➕ **Nouvelle vidéo** | Choisir un format, une durée, puis se laisser guider |
| ✍️ **Scripts** | L'atelier d'écriture, adapté à chaque format |
| 🎬 **Formats** | Un onglet par format. Chaque onglet montre **ses vidéos terminées** |
| 📁 **Mes vidéos** | Toutes les vidéos, **rangées par format**, à télécharger ou partager |
| 👥 **Personnages** | Vous, et d'autres personnes ou personnages : leur visage, leur voix |
| 🎨 **Bibliothèque** | Tout ce qui donne le style : couleurs, logo, polices, **LUT** (le traitement des couleurs), sous-titres, **images et vidéos d'illustration**, musiques, **bruitages**, **habillage** (début, fin, logo animé), **styles de montage**, décors |
| 🧩 **Mes modèles** | Un réglage complet qui vous plaît, enregistré pour être réutilisé en un clic |
| 💡 **Idées** | Le carnet de sujets |
| ⚙️ **Réglages** | Mot de passe, comptes reliés, budget |

### Les formats prévus dès maintenant

Chaque format a son onglet. Seul « type avocat » sera simulé de bout en bout. Les autres affichent « bientôt », avec leur présentation.

1. ⚖️ **Vidéo type avocat** : face caméra, fond noir, très rythmé
2. 🎙️ **Podcast type interview** : interview à deux personnes, plusieurs plans
3. 🎬 **Vidéo type Créateur B** : onglet prévu, à préciser plus tard
4. ◧ **Écran partagé** : votre double d'un côté, et de l'autre des images, un écran qui défile ou une démonstration
5. ✨ **Motion design** : animations, textes et schémas qui bougent, sans visage
6. 📱 **Vidéo UGC** : style « avis client » filmé au téléphone
7. 🤳 **Vidéo selfie** : face caméra au téléphone, naturel
8. ➕ **Et tous les suivants** : on en ajoute un quand on veut, sans rien casser

**Chaque format choisit ses durées** (par exemple 15 s, 30 s, 60 s, 3 min, 20 min pour un podcast) **et ses formats d'image** (vertical pour TikTok et Reels, carré, horizontal pour YouTube).

### Plusieurs personnages, pas seulement vous

La console range des **personnages**. Chacun a ses visages (plusieurs angles, tenues, décors) et sa voix :
- **vous** ;
- **d'autres personnes réelles**, toujours avec leur **accord enregistré** (c'est obligatoire) ;
- des **personnages inventés**.

Un podcast pourra donc mettre deux personnages face à face.

### Les vidéos terminées

- Une page **« Mes vidéos »**, avec un **onglet par format**.
- Chaque vidéo a son **kit de publication** :
  - le bouton **Télécharger**, dans chaque format d'image ;
  - un **texte de publication** et des **mots-dièse** prêts, adaptés à chaque réseau (LinkedIn, Instagram, Facebook, TikTok, YouTube), à copier en un geste ;
  - **Envoyer vers Buffer** (simulé pour l'instant) ;
  - un **lien de partage privé**.

### Les images d'illustration et le style : comment ça marchera

- **Une bibliothèque commune** : vos images, vidéos d'illustration, LUT, musiques et bruitages.
- **Chaque format a son style par défaut** : quelle LUT, quels sous-titres, quel rythme, quel habillage.
- **Chaque moteur choisit automatiquement** les images d'illustration selon le script. Dans l'aperçu plan par plan, **vous remplacez** celles qui ne vous plaisent pas.
- **Retouches** : sur une vidéo terminée, vous pouvez dire « refais ce plan » sans tout refaire.
- **Miniature** : chaque vidéo a son image de couverture, modifiable.

### Des « briques communes » pour un rendu toujours identique

Chaque savoir-faire est construit **une seule fois**, au meilleur niveau. Chaque format les **assemble** selon sa recette : **sous-titres, voix, visage, étalonnage (LUT), images d'illustration, son (musique, bruitages, volume), habillage, export par réseau, contrôle qualité**.

- Un même type de vidéo a **toujours le même rendu**.
- Une amélioration (par exemple les sous-titres) **profite à tous les formats**.
- Le **réalisme** se gagnera dans ces briques, plus tard, avec les moteurs. Mais une seule fois pour tous.

Dès maintenant, la console prévoit la place d'une **note de qualité** sur chaque vidéo : synchronisation des lèvres, son, sous-titres, réalisme.

### Ce qui viendra APRÈS la console (déjà prévu dans sa structure)

La console est construite pour accueillir ces moteurs **sans être refaite**. On les créera **un par un**, en cherchant la perfection pour chacun :

1. **Le générateur de scripts** : les meilleurs scripts possibles pour chaque format. Il s'appuiera sur des scripts de référence, sur votre façon de parler, et plus tard sur les résultats de vos vidéos publiées.
2. **Le moteur de visage** : un double parfait de vous ou d'un autre personnage.
3. **Le moteur de voix** : votre voix parfaite, avec une liste de prononciations (« Axion-IA », les noms propres).
4. **Un moteur de montage par format** : d'abord « type avocat », puis les autres, un par un.

### Durée et vérification

- **Une seule passe de contrôle**, faite par un responsable qualité : il assemble, teste les parcours principaux, photographie chaque écran et corrige. Pas de relecteurs multiples.
- **Durée estimée de la construction : une demi-journée à une journée de travail des agents.**
- À la fin, je vous envoie les photos des écrans. Vous essayez et vous corrigez.

### Ce que ça coûte

**Rien de plus pour la console** : elle tournera sur votre serveur actuel.

---

## PARTIE B — Plan technique (pour l'équipe d'agents)

### B.1 Principes non négociables

1. **Mobile d'abord** : conçu à 390 px, puis élargi à 1440 px. Une vidéo lancée en **≤ 6 touches** depuis l'accueil.
2. **Une action principale par écran**, collée en bas sur mobile.
3. **Très peu de texte** : cartes, icônes, gros chiffres, vignettes, aperçus, micro-animations. Will a rejeté des écrans « blocs de texte, vieillots » (30/09) : c'est l'échec à éviter.
4. **Français partout**, en première personne (« Mes vidéos »), avec vouvoiement dans les messages. Mots interdits à l'écran : job, render, prompt, token, API, upload, pipeline, workflow, mock, fictif, dashboard, avatar (dire « double » ou « personnage »).
5. **Les écrans ne connaissent aucun format, aucun moteur, aucun fournisseur en dur.** Tout est généré depuis les **registres** (B.6). Ajouter un format = ajouter un dossier.
6. **Écrans → services → dépôts et fournisseurs.** Remplacer une simulation par un vrai moteur ne touche aucun écran.
7. **Rien d'unique sur le serveur** : image construite sur GitHub Actions, base dans son propre conteneur, fichiers sur R2. Le site axion-ia.com n'est jamais touché.
8. **Couleurs des publications réseaux de Will** (noir chaud + orange, relevés sur Buffer le 01/10), passées par des jetons.
9. **Vitesse de construction** : une seule passe qualité, des tests ciblés sur les parcours principaux, pas d'exhaustivité.

### B.2 Pile technique

| Couche | Choix |
|---|---|
| Cadre | **Next.js 16** (App Router), React 19, TypeScript strict. ⚠️ Lire `node_modules/next/dist/docs/` avant de coder (`proxy.ts`, paramètres asynchrones…) |
| Style | Tailwind CSS 4 + jetons CSS |
| Composants | Primitives `radix-ui`, feuilles du bas `vaul`, toasts `sonner`, icônes `lucide-react`, animations `motion` |
| Formulaires | `react-hook-form` + `zod` (le schéma de réglages de chaque format génère son formulaire) |
| Données V1 | **Dépôts en mémoire + données de démonstration**, derrière des interfaces `Depot…`. Prisma + Postgres (conteneur `studio-db`) à la mise en ligne, sans toucher les écrans. Docker est absent en local |
| Fichiers | V1 : `public/demo/`. Ensuite : R2 privé, URL signées |
| Travaux longs | Table `Travail` à étapes, interface `FileDeTravaux`. V1 en mémoire ; ensuite boucle en base, BullMQ si besoin |
| Sessions | Cookie `httpOnly`, `Secure`, `SameSite=Lax`, signé `jose` HS256 |
| Mot de passe | Empreinte **argon2id** encodée en base64 dans `STUDIO_PASSWORD_HASH_B64` (le `$` brut serait mangé par l'expansion des `.env` de Next). Script `scripts/hacher-mot-de-passe.mjs`. **Jamais en clair**, nulle part |
| Tests | Vitest (logique critique) + Playwright (parcours principaux, mobile et bureau) |
| Installable | PWA (manifeste + icônes) |

### B.3 Hébergement (lot de mise en ligne, après la console)

- Dépôt privé `will383842/studio-axion-ia`. Dossier local `<dossier utilisateur>\Documents\Projets\studio-axion-ia`.
- GitHub Actions → image **privée** `ghcr.io/will383842/studio-axion-ia` → application Coolify `axion-studio` + conteneur `studio-db` séparé, sur le serveur actuel.
- DNS `studio.axion-ia.com` dans Cloudflare, proxifié. `noindex` partout, `robots.txt` en `Disallow: /`.
- Sauvegarde quotidienne de la base, vérifiée, copiée vers R2 sous le préfixe `studio/sauvegardes/` (réalisé à l'audit D, `deploiement/sauvegarder.sh`). **Rien n'est purgé automatiquement dans R2** (ordre permanent de Will) ; seule exception, décidée par Will le 17/10 : la suppression MANUELLE d'une vidéo, confirmée (« Supprimer définitivement »), efface ses fichiers propres de R2 et de la base, dépenses gardées ; seules les copies LOCALES de plus de 14 jours déjà présentes dans R2 sont retirées du disque du serveur.

### B.4 Sécurité

1. Mot de passe seul (pas de double authentification, ordre de Will). « Rester connecté » : 30 jours, sinon 12 heures.
2. 5 échecs en 15 minutes par IP, puis attente de 15 minutes. Temps de réponse constant.
3. `src/proxy.ts` protège tout sauf `/connexion`, `/v/[code]`, `/api/sante` et les fichiers statiques. **Chaque action serveur et chaque route `/api` revérifie la session** : le proxy ne suffit pas.
4. Changement du mot de passe dans Réglages : l'ancien est exigé, la nouvelle empreinte prime sur la variable d'environnement, les autres sessions sont coupées.
5. En-têtes : `X-Robots-Tag: noindex, nofollow`, CSP, `frame-ancestors 'none'`, `Referrer-Policy: same-origin`.
6. **Personnages réels autres que Will** : impossible de créer un double ou une voix sans **preuve d'accord** (case + document déposé + date). Mention « Réalisé avec l'IA » activée par défaut sur chaque vidéo (règle européenne en vigueur depuis le 02/08/2026).

### B.5 Système de design « Studio »

Couleurs relevées au pixel sur les visuels Buffer :

| Jeton | Valeur |
|---|---|
| `--fond` | `#16120F` |
| `--surface-1` / `--surface-2` | `#1F1A16` / `#2A2420` |
| `--trait` | `#3A322C` |
| `--texte` / `--texte-doux` | `#F3EDE4` / `#B8ADA0` (contraste AA vérifié) |
| `--orange` / `--orange-vif` | `#C65A2E` / `#E07040` |
| états | vert sauge, ambre, rouge brique |
| lueur | dégradé radial orange à 10–18 % |

- **Typographie** : titres en grotesque épaisse, proche des visuels (« 5 TÂCHES QUE L'IA… »). Texte en Manrope.
- **Formes et mouvement** : rayons de 16 px pour les cartes, boutons en pastille. Animations de 200 à 300 ms, `prefers-reduced-motion` respecté.
- **Accessibilité** : cibles de 44 px, focus orange visible, vrais `<button>`, libellés sur les icônes.
- **Gabarit** : barre latérale de 264 px sur ordinateur (repliable). Sur mobile, **onglets en bas** : Accueil · Vidéos · ➕ central · Personnages · Plus, et feuilles du bas pour le reste.
- **Composants (`src/components/ui/`)** : Bouton, Carte, CarteFormat, VignetteVideo (s'adapte au ratio), PastilleEtat, SelecteurPastilles (durées, ratios), BarreEtapes, ProgressionEtapes, FeuilleBas, Dialogue, Onglets, Champ, ZoneTexte, Interrupteur, ZoneDepot, LecteurVideo, Toast, EtatVide, Squelette, Menu, JaugeBudget, CartePersonnage, EnTetePage, BarreActionCollee, Lueur, BoutonCopier. Page `/styleguide`.

### B.6 Architecture évolutive : les registres

#### 1. Registre des formats (`src/formats/<id>/`) — le cœur de l'évolutivité

```ts
export interface DefinitionFormat {
  id: string; nom: string; accroche: string; icone: string;
  statut: "actif" | "bientot" | "masque";
  famille: "face-camera" | "conversation" | "ecran-partage" | "motion" | "ugc" | "autre";
  durees: { valeursSec: number[]; parDefautSec: number };   // ex. [15,30,45,60,90]
  ratios: ("9:16" | "1:1" | "4:5" | "16:9")[];               // le premier = par défaut
  miseEnPage: "plein-ecran" | "ecran-partage-haut-bas" | "ecran-partage-cote" | "incrustation" | "multi-plans";
  personnages: { min: number; max: number; roles?: string[] }; // podcast : 2, ["hôte","invité"] ; motion : 0
  entrees: EntreeFormat[];   // ce que l'utilisateur doit fournir, en plus du script :
                             // "medias-illustration" | "capture-ecran" | "page-a-faire-defiler" | "produit" | "logo-client" | "musique"
  etapes: EtapeAssistant[];  // composées depuis la BIBLIOTHÈQUE D'ÉTAPES :
                             // "sujet" | "script" | "distribution" | "medias" | "reglages" | "apercu" | "fabrication"
  reglages: ZodSchema;       // génère le formulaire de l'étape Réglages
  recetteScript: RecetteScript; // B.6.4
  stylesParDefaut: {         // ids d'éléments de la Bibliothèque ; modifiables à l'étape Réglages
    lut?: string; sousTitres?: string; styleMontage?: string; habillage?: string;
    ambianceMusique?: string; fond?: string;
  };
  illustrations: "auto" | "manuel" | "aucune"; // "auto" : le moteur choisit selon le script, Will remplace à l'Aperçu
  moteur: string;            // clé du registre des moteurs
  exemples: { vignette: string; video: string; titre: string }[];
}
```

**Formats déclarés en V1** :

| id | Nom | Statut | Durées | Ratios | Personnages | Mise en page |
|---|---|---|---|---|---|---|
| `avocat` | Vidéo type avocat | **actif (simulé)** | 30–90 s | 9:16, 1:1, 16:9 | 1 | plein écran, 2 angles |
| `podcast` | Podcast type interview | bientôt | 3–30 min + extraits courts | 16:9, 9:16 | 2 (hôte, invité) | multi-plans |
| `createur-b` | Vidéo type Créateur B | bientôt | à définir | 9:16 | 1 | à définir |
| `ecran-partage` | Écran partagé | bientôt | 30–90 s | 9:16 | 1 | haut/bas |
| `motion` | Motion design | bientôt | 15–60 s | 9:16, 16:9 | 0 | plein écran |
| `ugc` | Vidéo UGC | bientôt | 15–45 s | 9:16 | 1 | plein écran |
| `selfie` | Vidéo selfie | bientôt | 15–60 s | 9:16 | 1 | plein écran |

- Un format « bientôt » a son onglet, sa fiche (présentation, exemples, ce qu'il faudra fournir), sa galerie vide et un bouton « Me prévenir ». Il n'a pas d'assistant.
- **Le menu, la page « Nouvelle vidéo », les onglets de « Mes vidéos », les filtres et l'assistant sont générés depuis le registre.**
- Un **test** vérifie que chaque format inscrit est complet et cohérent (ratios non vides, durées triées, étapes connues, moteur existant).

#### 2. Bibliothèque d'étapes de l'assistant (`src/assistant/etapes/`)

Chaque étape est un composant autonome qui lit la définition du format :

| Étape | Rôle |
|---|---|
| `sujet` | Sujet + durée + ratio (pastilles venant du format) |
| `script` | Éditeur par blocs selon la recette du format (voir 6.4) |
| `distribution` | Choisir le ou les personnages, le rôle, l'angle, la tenue, le décor |
| `medias` | Déposer ou choisir les entrées propres au format (images d'illustration, capture d'écran, page à faire défiler, produit) |
| `reglages` | Formulaire généré depuis le schéma du format |
| `apercu` | Plan de montage visuel plan par plan, coût et durée estimés |
| `fabrication` | Progression en direct, puis lien vers la vidéo |

Un futur format qui demande une étape nouvelle l'ajoute **à la bibliothèque**, sans toucher aux autres.

#### 3. Registre des moteurs (`src/moteurs/`)

```ts
interface MoteurVideo {
  id: string;
  estimer(commande): Promise<{ dureeFabricationSec: number; coutEstime: Montant }>;
  lancer(commande): Promise<IdTravail>; // les étapes et la progression vont dans Travail
}
```

V1 : `moteur-simulation`. Il enchaîne des étapes crédibles qui dépendent du format (« Voix → Visage → Montage → Sous-titres → Finitions »), en ~25 s accélérées, avec échec simulable. Il produit **une sortie par ratio demandé**, à partir des vidéos de démonstration.

#### 4. Recette de script (`RecetteScript`) — prépare le futur générateur robuste

```ts
interface RecetteScript {
  blocs: { id: string; nom: string; couleur: string; consigne: string; dureeCibleSec: [number, number] }[];
  // avocat : accroche, question, réponse, explication, fin
  // podcast : ouverture, question hôte, réponse invité ×N, relance, conclusion
  // écran partagé : accroche, démonstration pas à pas, résultat, appel
  regles: string[];          // règles d'écriture du format
  criteres: { id: string; nom: string; poids: number }[]; // accroche, clarté, rythme, durée, appel à l'action
  references: string[];      // ids de scripts de référence (bibliothèque)
  motsParSeconde: number;    // pour estimer la durée
}
```

- **En V1**, le fournisseur de scripts simulé produit des scripts de bonne qualité, différents selon le format et le sujet, à partir de gabarits, avec des notes cohérentes.
- **Plus tard**, le vrai générateur lira la recette, les **scripts de référence** (une section de la bibliothèque de scripts), le **style de Will** (ses scripts validés, ses expressions, ses mots interdits) et, en dernier, les **résultats des vidéos publiées**. La console prévoit dès maintenant les emplacements : onglet « Références » et section « Ma façon de parler » dans Scripts.

#### 4 bis. Briques communes de fabrication (`src/briques/`) — même rendu pour un même format

Les moteurs de format **n'implémentent pas** les savoir-faire : ils **orchestrent** des briques partagées, chacune avec un contrat stable et une implémentation simulée en V1.

| Brique | Contrat (entrée → sortie) | Réglage venant du format / de la Bibliothèque |
|---|---|---|
| `sous-titres` | piste audio + texte → horodatage **mot par mot** (alignement forcé) → piste stylée | style de sous-titres, mots en accent, position dans les **zones sûres** de chaque réseau, nombre de mots par ligne |
| `voix` | texte + voix + prononciations → piste audio | réglages de la voix |
| `visage` | piste audio + visage (angle, tenue, décor) → plan vidéo | angle, cadrage |
| `etalonnage` | plan vidéo + LUT → plan étalonné | LUT par défaut du format |
| `illustrations` | script découpé en plans → choix d'illustrations (auto) | mots-clés, bibliothèque, mode auto/manuel |
| `son` | voix + musique + bruitages → mixage **normalisé** (cible de volume constante, voix toujours au-dessus de la musique) | ambiance musicale, bruitages du style de montage |
| `habillage` | vidéo + éléments de marque → titres, logo, début, fin, carte finale | habillage du format |
| `export` | montage → une sortie par ratio, aux réglages de chaque réseau, recadrage intelligent | ratios du format |
| `controle-qualite` | sortie → note /100 et alertes (synchronisation des lèvres, niveau sonore, débordement de sous-titres, zones sûres, durée) | seuils par format |

- La **recette de montage** d'un format (V1 : simple liste d'étapes du moteur simulé) décrit **l'ordre et les réglages des briques**. Elle est enregistrée avec la version de chaque brique utilisée, pour qu'une vidéo puisse être **refaite à l'identique**.
- Le **profil de rendu** d'un format (LUT, sous-titres, rythme, habillage, son, export) est versionné. Changer le profil change toutes les **futures** vidéos du format, pas les anciennes.
- La console V1 affiche, sur chaque fiche vidéo, la **note de qualité** et ses alertes (valeurs simulées), et dans Bibliothèque > Sous-titres, des styles animés avec aperçu.

#### 5. Registre des fournisseurs (`src/fournisseurs/`)

| Interface | Rôle | Réel prévu plus tard |
|---|---|---|
| `FournisseurScript` | écrire, noter, améliorer | Claude (API Anthropic) |
| `FournisseurVisage` | créer un double depuis des vidéos, suivre sa préparation, le tester | HeyGen Avatar V (ou mieux à ce moment-là) |
| `FournisseurVoix` | copier une voix, lire un texte, prononciations | ElevenLabs |
| `FournisseurMontage` | assembler selon la mise en page du format | Remotion |
| `FournisseurIllustration` | choisir automatiquement les images et vidéos d'illustration selon le script, ou en générer | banque d'images Axion, Higgsfield |
| `FournisseurEtalonnage` | appliquer une LUT, harmoniser les couleurs | ffmpeg / Remotion |
| `FournisseurMiniature` | proposer des miniatures | générateur d'images |
| `FournisseurPublication` | envoyer vers Buffer | Buffer |
| `FournisseurTexteReseaux` | écrire le texte de publication et les mots-dièse par réseau | Claude |

Choix simulation ou réel par variable (`FOURNISSEUR_VOIX=simulation|elevenlabs`). Réglages > Connexions affiche « Simulation » / « Relié » / « À relier ».

### B.7 Modèle de données

| Entité | Champs principaux |
|---|---|
| `Personnage` | id, nom, nature (`moi`, `reel`, `invente`), photo, **accord** {case, document, date} (obligatoire si `reel`), principal (bool) |
| `Visage` | id, personnageId, nom (« Face, chemise noire »), angle (`face`, `trois-quarts`, `profil`), tenue, decor, statut (`brouillon`, `en_preparation`, `pret`, `echec`), qualite (note /100 + conseils), fichiers[], fournisseur, versionFournisseur |
| `Voix` | id, personnageId, nom, langue, minutesEnregistrees, statut, reglages {vitesse, stabilite, emotion}, fichiers[] |
| `Prononciation` | id, mot, prononciation (« Axion-IA » → « axion i-a ») |
| `ElementBibliotheque` | type (`couleurs`, `logo`, `police`, `lut`, `style-sous-titres`, `illustration-image`, `illustration-video`, `musique`, `bruitage`, `habillage`, `style-montage`, `decor`, `fond`), nom, motsCles[], valeur JSON, fichier, licence, formatsParDefaut[] |
| `Modele` | id, nom, formatId, dureeSec, ratios, distribution, stylesChoisis, reglages, creeDepuisVideoId |
| `Plan` | id, videoId, version, ordre, debutSec, finSec, texte, personnage/angle, illustrationId, zoom, transition |
| `Retouche` | id, videoId, planId, consigne, statut, versionProduite |
| `Miniature` | id, videoId, fichier, titre, choisie |
| `Script` | id, formatId, sujet, version, parentId, blocs JSON (selon la recette), notes JSON, favori, reference (bool), creeLe |
| `Video` | id, formatId, profilRenduVersion, noteQualite {globale, levres, son, sousTitres, realisme, alertes[]}, titre, statut (`brouillon`, `en_file`, `en_fabrication`, `prete`, `echec`, `archivee`), dureeCibleSec, ratios[], scriptId, distribution JSON, entrees JSON, reglages JSON, mentionIA, coutEstime, coutReel, dates |
| `Sortie` | id, videoId, ratio, resolution, fichier, vignette, dureeSec, taille |
| `KitPublication` | videoId, textes par réseau {linkedin, instagram, facebook, tiktok, youtube} {texte, motsDiese[]}, titreYoutube |
| `Publication` | id, videoId, reseau, statut (`brouillon`, `programmee`, `publiee`), date, via (`buffer`, `manuel`) |
| `Partage` | id, videoId, code, expireLe, revoqueLe, vues, telechargementAutorise |
| `Travail` | id, type (`fabrication`, `preparation-visage`, `preparation-voix`, `generation-script`), cibleId, etapes JSON, statut, erreur, dates |
| `Idee`, `Session`, `TentativeConnexion`, `Parametre`, `Evenement` | comme en version 1 |

**Données de démonstration** : Will en personnage principal (2 visages prêts : face + trois quarts ; 1 voix prête), 1 personnage inventé (« Clara, l'animatrice »), 1 personnage réel en attente d'accord (pour montrer le blocage), la marque Axion, 3 LUT (« Axion chaud » par défaut, « Neutre », « Cinéma contrasté ») avec vignettes avant/après générées par ffmpeg, 4 musiques, 6 bruitages, 12 illustrations (images et vidéos), 2 habillages, 3 styles de montage (calme, rythmé, très rythmé), 2 modèles, **14 vidéos** (surtout « avocat », plus quelques exemples d'autres formats pour remplir les galeries), 8 idées, 8 scripts dont 3 de référence, 2 partages, 3 publications, coûts sur 3 mois, 6 prononciations. **3 vidéos de démonstration** générées avec ffmpeg (noir + lueur orange + grand titre crème, sans visage réel), en 9:16, et au moins une en 16:9.

### B.8 Les écrans

| # | Route | Écran | L'essentiel | Action principale |
|---|---|---|---|---|
| 1 | `/connexion` | Connexion | logo, mot de passe avec œil, « rester connecté » | Entrer |
| 2 | `/` | Accueil | carte « Nouvelle vidéo » avec lueur ; en cours (progression en direct) ; « Reprendre le brouillon » ; dernières vidéos ; alertes (voix manquante…) ; jauge du budget | Nouvelle vidéo |
| 3 | `/nouvelle` | Choisir un format | grille de cartes-formats (aperçu animé, durées, ratios) ; les « bientôt » visibles | Choisir |
| 4 | `/nouvelle/[format]` | **Assistant** | étapes générées depuis le format (bibliothèque B.6.2), barre d'étapes, bouton collé en bas, brouillon sauvé à chaque étape | Suivant → Fabriquer |
| 5 | `/formats` | Formats | grille de tous les formats, avec le nombre de vidéos de chacun | Ouvrir |
| 6 | `/formats/[id]` | **Onglet d'un format** | en-tête (présentation, durées, ratios) ; **galerie des vidéos terminées de ce format** ; scripts de ce format ; « Nouvelle vidéo de ce format » ou « Me prévenir » | Nouvelle vidéo |
| 7 | `/videos` | **Mes vidéos** | **onglets par format** (+ « Toutes ») ; filtres statut et ratio ; recherche ; tri ; sélection multiple (télécharger, archiver) | Ouvrir |
| 8 | `/videos/[id]` | Fiche vidéo | lecteur (ratio réel) ; **Retouches** (liste des plans, « refaire ce plan » avec une consigne, nouvelle version, versions comparées) ; **Miniature** (3 propositions, choix, titre de couverture) ; « Enregistrer comme modèle » ; **kit de publication** : Télécharger (choix du ratio), texte par réseau + mots-dièse avec Copier, Envoyer vers Buffer (réseaux + date, simulé), Lien privé ; onglets Script · Distribution · Réglages · Historique ; coût | Télécharger / Publier |
| 9 | (feuille) | Partager | durée du lien, téléchargement autorisé, Copier, partage natif du téléphone, liens actifs avec vues, Révoquer | Copier le lien |
| 10 | `/v/[code]` | Page publique | lecteur seul aux couleurs Axion, télécharger si autorisé, `noindex`, page « lien expiré » soignée (410) | Lire |
| 11 | `/scripts` | **Atelier de scripts** | choix du format ; sujet, cible, ton, durée ; **3 versions** ; blocs colorés selon la recette ; notes (accroche, clarté, rythme, durée) ; Améliorer ce bloc / Plus percutant / Plus court ; onglets **Mes scripts · Références · Ma façon de parler** | Générer |
| 12 | `/scripts/[id]` | Fiche script | éditeur par blocs, versions comparées, durée estimée en direct, « Créer la vidéo avec ce script » | Créer la vidéo |
| 12b | `/modeles` | Mes modèles | cartes de modèles (format, durée, ratio, personnage, styles, musique) ; « Utiliser » ouvre l'assistant prérempli ; créer un modèle depuis une vidéo réussie | Utiliser |
| 13 | `/personnages` | Personnages | cartes : photo, nature (moi / réel / inventé), visages prêts, voix prête, alertes d'accord | Ajouter un personnage |
| 14 | `/personnages/[id]` | Fiche personnage | onglets **Visages** (angles, tenues, décors, état, qualité /100 et conseils, guide de tournage illustré, dépôt, « Tester ») · **Voix** (enregistrer dans le navigateur avec texte à lire, dépôt, minutes, langue, réglages, « Écouter un essai ») · **Accord** (si personne réelle) | Ajouter un visage / Enregistrer ma voix |
| 15 | `/bibliotheque` | Bibliothèque | onglets : Couleurs et polices · Logo · **LUT** (vignette avant/après sur une image type, import `.cube`, LUT par défaut par format) · Sous-titres (styles animés avec aperçu) · **Illustrations** (images et vidéos, mots-clés, recherche, import) · Musiques (ambiance, tempo, licence) · **Bruitages** · **Habillage** (intro, fin, logo animé, carte finale avec appel à l'action, grand titre) · **Styles de montage** (rythme, zooms, transitions — préréglages) · Décors · Prononciations ; **aperçu en direct d'une image de vidéo** avec les choix appliqués | Ajouter |
| 16 | `/idees` | Idées | ajout en une ligne, format suggéré, « Transformer en script » ou « en vidéo » | Ajouter |
| 17 | `/reglages` | Réglages | Mot de passe · Appareils · Connexions (Simulation) · Budget et coûts · Mention IA · Réseaux par défaut · Journal · À propos | — |
| 18 | `/styleguide` | Composants | connecté seulement | — |
| 19 | États | 404, erreur, hors ligne, chargement | illustrés, une phrase, un bouton | Revenir |

**Transverses** : cloche de notifications (vidéo prête…) ; progression en direct (interrogation toutes les 2 s, simple et robuste) ; brouillons ; bandeau hors ligne ; PWA installable.

### B.9 Une seule passe de qualité (rapide)

Le **responsable qualité** fait tout, une fois, à la fin :

1. `tsc` + ESLint + `next build` au vert.
2. **Tests ciblés uniquement** :
   - Vitest : registre des formats complet, moteur simulé (états), limitation des essais, session ;
   - Playwright, mobile et bureau : connexion → assistant avocat → fabrication → fiche vidéo → lien public → révocation ; route protégée sans session.
3. **Captures** de chaque écran en 390 px et 1440 px (`docs/captures/`). Il **les regarde** et corrige ce qui se voit.
4. Commit et envoi sur GitHub.

Pas de relecteurs multiples, pas de critique séparée. Les retours de Will feront la suite.

### B.10 L'équipe (légère)

```
ARCHITECTE ── socle, design system, coquille, registres, données, connexion, contrat
     │
3 DÉVELOPPEURS EN PARALLÈLE (fichiers disjoints, aucun build, aucun commit)
  A · Accueil, Nouvelle vidéo, Assistant + bibliothèque d'étapes, Formats (onglets + galeries)
  B · Personnages (visages, voix, accord), Bibliothèque (LUT, illustrations, habillage, styles…), Atelier de scripts, Idées, Mes modèles
  C · Mes vidéos (onglets par format), Fiche vidéo (retouches, miniature, kit de publication), Partage, page publique, Réglages, Notifications
     │
RESPONSABLE QUALITÉ ── assemblage, tests ciblés, captures, corrections, commit
```

5 agents en tout. Sous 1 Go de mémoire libre, on attend avant de lancer.

### B.11 Les lots

| Lot | Contenu | Durée indicative (agents) |
|---|---|---|
| 1. Architecte | socle, design system, coquille, connexion, registres, données de démonstration, routes squelettes, contrat | 1 à 2 h |
| 2. Écrans (×3 en parallèle) | B.8 complet | 2 à 3 h |
| 3. Qualité | B.9 | 1 à 2 h |
| 4. Remise à Will | captures + lien local, puis remarques | — |
| 5. Mise en ligne | B.3 : studio.axion-ia.com | 2 à 3 h |

**Ensuite seulement**, chaque moteur est un chantier à part, cherché à la perfection, dans cet ordre :
1. générateur de scripts (avocat d'abord) ;
2. voix ;
3. visage ;
4. montage « type avocat » ;
5. les autres formats, un par un.

### B.12 Risques et parades

| Risque | Parade |
|---|---|
| Un futur format ne rentre pas dans le registre | Étapes, entrées et réglages sont ouverts ; on ajoute une étape à la bibliothèque, on ne réécrit pas l'assistant |
| Design jugé vieillot | Exigence B.1-3, captures regardées avant envoi ; les jetons permettent de changer d'ambiance en un fichier |
| Usage du visage ou de la voix d'autrui | Accord obligatoire et bloquant, journal d'activité |
| Vidéos longues (podcast de 30 min) | Travaux à étapes, notification à la fin, sorties multiples |
| Construction trop longue | Une seule passe qualité, tests ciblés |
| Mémoire de la machine | 3 développeurs au maximum en parallèle |


---

## AVENANT 2 — Vérification complète du plan (2026-10-01) — PRIME sur tout ce qui précède

Trois experts ont relu le plan en parallèle (production vidéo, architecture des futurs moteurs, usage et parcours) et ont trouvé **48 manques**. Tout est trié ci-dessous. Le détail brut est dans `VERIFICATION-2026-10-01.json`, à côté de ce plan.

### AV2.1 Navigation (remplace le menu de B.5 et de la partie A)

- **Onglets du bas sur mobile** : Accueil · Vidéos · ➕ · Écrire · Plus.
  - « **Écrire** » réunit Idées et Scripts (onglets : Idées · Mes scripts · Références · Ma façon de parler).
  - « **Plus** » ouvre une grille de tuiles : Personnages, Bibliothèque, Mes modèles, Calendrier, Réglages.
- **Barre latérale sur ordinateur** : Accueil · Nouvelle vidéo · Mes vidéos (avec la liste des formats dessous, chacun menant à son onglet de galerie) · Calendrier · Écrire · Personnages · Bibliothèque · Mes modèles · Réglages.
- `/formats/[id]` = l'onglet du format dans Mes vidéos (galerie + fiche du format). `/formats` renvoie vers `/videos`.
- `/nouvelle` commence par une rangée « Recommencer comme… » (mes modèles), puis la grille des formats.
- Sur mobile, la Bibliothèque s'ouvre sur une **grille de tuiles** par type, pas sur 11 onglets.
- **Recherche globale** (loupe dans l'en-tête) : Vidéos · Scripts · Idées · Bibliothèque, via `ServiceRecherche`.

### AV2.2 Contrat des futurs moteurs (structure, à poser par l'architecte)

1. **`CommandeFabrication`**, typée et versionnée (`versionContrat: 1`). Elle est construite par un service unique `construireCommande(videoId)` et contient :
   - le format et `versionFormat`, la durée, les ratios ;
   - le script résolu ;
   - la distribution, avec les identifiants chez les fournisseurs ;
   - les styles résolus : LUT + intensité, sous-titres, habillage, style de montage, profil de son, musique ;
   - les entrées, les réglages validés, les plans ;
   - la mention IA et le budget maximum.

   **Un moteur ne lit que la commande, jamais les dépôts.** Le moteur simulé la consomme déjà.
2. **`VersionVideo`** { numero, parentVersionId, commande figée, statut, travailId, coutReel, choisie }. Les sorties, les plans et les retouches sont rattachés à une version.
3. **`Fichier`** unique { cleStockage, mime, taille, sha256, durée, dimensions, fps, origine, statut }.
   - Partout, on utilise des `fichierId`.
   - Interface `StockageFichiers` { preparerDepot, confirmerDepot, urlLecture }.
   - Clés de stockage : `studio/{env}/{type}/{entiteId}/{fichierId}.{ext}`.
   - V1 : en mémoire + `public/demo`.
4. **Travaux à étapes dépendantes** :
   - `Travail` { statut, tentatives, cleIdempotence, fournisseurUtilise, idExterne, erreur {code, reessayable, messagePourWill, detailTechnique} } ;
   - `EtapeTravail` { cle, dependDe[], statut, progression, sortieFichierIds[], coutReel } ;
   - `MoteurVideo.etapes(commande)` décrit le graphe des étapes ;
   - « **Réessayer** » ne relance que les étapes en échec ;
   - le moteur expose aussi `retoucher(versionId, planIds, consigne)`, `reexporter(versionId, ratio|reseau)` et `maquette(commande)`.
5. **Conservation des éléments intermédiaires** : entité `Piste` (voix, plan du double, illustration, musique, mixage, master) + `projetMontage` (la ligne de temps) sur la version. Une retouche ne repaie que ce qui change.
6. **`RessourceFournisseur`** { entite, entiteId, fournisseur, idExterne, versionModele, statut, accordId } : les identifiants des doubles et des voix chez HeyGen, ElevenLabs, etc.
7. **Capacités** déclarées par chaque moteur et fournisseur : durée max, ratios, langues, retouche par plan, mode asynchrone, accord exigé. L'assistant grise ce qui n'est pas possible.
   - `resoudreFournisseur()` cherche d'abord le réglage en base, puis la variable d'environnement, puis se rabat sur la simulation.
8. **`versionFormat`** enregistrée sur Video, Modele et Script, et `migrerReglages()` sur le format.
9. **Coûts** :
   - `LigneCout` par étape : fournisseur, unité, quantité, prix, estimé ou réel ;
   - `Montant` en centimes avec la devise ;
   - `lancer` refuse si le budget du mois serait dépassé ; au-delà d'un seuil, une confirmation est demandée.
10. **Crochets des fournisseurs** : route `/api/crochets/[fournisseur]`. Elle est exemptée de session mais vérifiée par signature, avec `EvenementFournisseur` pour dédoublonner et une interrogation de secours. V1 : répond 501.
11. **Conteneur `studio-worker`** (même image, autre commande) pour exécuter la file : le serveur web ne fait qu'enfiler les travaux. Le rendu lourd sera délégué (Remotion Lambda ou machine dédiée), à trancher au chantier montage.
12. **Tests de contrat partagés** (`testerMoteurVideo`, `testerFournisseurVoix`…). La simulation les passe dès V1, et chaque fournisseur réel devra les passer.

### AV2.3 Production vidéo (structure + ce qui se voit dès V1)

1. **Registre des réseaux** (`src/reseaux/`) : LinkedIn, Instagram, Facebook, TikTok, YouTube, YouTube Shorts.
   - Pour chacun : ratios, durée max, réglages d'export, niveau sonore cible, **zones protégées par ratio**, longueur de légende et nombre de mots-dièse, miniature, étiquette IA.
   - Le kit de publication avertit (« Trop longue pour Shorts ») et compte les caractères.
2. **Texte à l'écran ≠ sous-titres** :
   - `Plan.texteEcran` {texte, position, style} et `motsEnValeur[]` ;
   - côté format : `accrocheVisuelle` {titreFixe, position} ;
   - à l'Aperçu : bouton « **Afficher les zones des réseaux** » (calque TikTok/Reels/Shorts, composant `CalqueZonesReseaux`) et témoin orange si un texte déborde.
3. **Sous-titres modifiables** :
   - entité `SousTitres` : segments horodatés mot à mot, version, langue ;
   - fiche vidéo : onglet « Sous-titres » (toucher un mot pour le corriger) et export `.srt` / `.vtt` dans le kit ;
   - les prononciations imposent la graphie (« Axion-IA »).
4. **Son** :
   - type `profil-son` dans la Bibliothèque : volume de la musique, baisse sous la voix, traitement de la voix, densité de bruitages, niveau cible ;
   - `FournisseurSon` ;
   - onglet « Son » avec 3 préréglages : Voix claire, Rythmé avec bruitages, Podcast.
5. **Étalonnage en deux temps** :
   - d'abord harmoniser les sources (IA, banque, rush) ;
   - puis appliquer la LUT créative, avec une **intensité de 0 à 100** et une cible (personnage, illustrations, rushs) ;
   - ordre de priorité : plan > vidéo > visage > format ;
   - onglet LUT : curseur d'intensité sur l'avant / après ; le `.cube` est validé à l'import.
6. **Images d'illustration** :
   - côté format : `illustrations` { mode auto/manuel/aucune, couvertureCible %, dureePlanSec, sourcesAutorisees, affichage } ;
   - côté plan : `Plan.illustration` { source, elementId, requete issue du script, **verrouille**, candidats } ;
   - **un choix de Will n'est jamais écrasé par le moteur** ;
   - à l'Aperçu : pastille de source (« IA » si générée) et bouton « Remplacer » filtré par les mots-clés du plan ;
   - règle de décision : Bibliothèque → défaut du format → modèle → réglages de la vidéo → choix par plan. Le moteur ne remplit que les cases laissées en « auto ».
7. **Script annoté pour le montage** :
   - `blocs[].segments[]` { texte, angle, titreEcran, emphase, intention d'illustration, zoom, pause, rôle } ;
   - la recette déclare les annotations qu'elle utilise ;
   - l'éditeur les montre en **pastilles discrètes** sous chaque phrase ;
   - les plans sont dérivés des segments.
8. **Rushs réellement tournés** :
   - entité `Rush`, entrée de format `rushs`, et `Plan.sourceImage` (double, rush, illustration, motion) ;
   - l'étape Distribution propose « mon double / mes images filmées » si le format l'autorise ;
   - zone de dépôt simulée.
9. **Composition propre à chaque ratio** : `miseEnPageParRatio` + `ratioMaitre`, et `Plan.cadrage` {pointInteret, zoom}. À l'Aperçu, des pastilles de ratio permettent de voir le même plan en 9:16, 1:1 et 16:9.
10. **Maquette rapide** avant la fabrication coûteuse : bouton secondaire « Voir une maquette rapide » à l'Aperçu (statut `maquette`).
11. **Mention IA** détaillée { incrustee, position, durée, texte, dansLegende }. Le kit ajoute la phrase à la légende et rappelle de cocher « Contenu généré par l'IA » sur le réseau.
12. **Droits et licences** sur chaque élément : type, usage commercial, réseaux, crédit obligatoire, expiration, preuve.
    - pastille sur les cartes ;
    - témoin ambre bloquant dans le kit si la licence est à vérifier ou expirée ;
    - crédits ajoutés automatiquement à la légende.
13. **« Avant de publier »** : une carte à 5 cases (Image, Son, Sous-titres, Mention IA, Droits), en partie précochées par le rapport de qualité (simulé). Le bouton Publier s'active ensuite. Le rapport de qualité est rangé sur `Sortie`.
14. **Miniatures par réseau** : aperçu grille Instagram 4:5 et YouTube 16:9, par recadrage.
15. Entité **`Marque`** et `marqueId` partout. Une seule marque « Axion », sélecteur masqué.

### AV2.4 Usage et parcours (V1)

1. **Statut éditorial**, distinct du statut technique, sur Video (`a_relire`, `validee`, `programmee`, `publiee`) et sur Script (`brouillon`, `valide`).
2. **Calendrier** (`/calendrier`, finition de niveau 3) : liste par jour sur mobile, semaine sur ordinateur, et « À programmer » en bas.
3. **Accueil** :
   - bloc « **Aujourd'hui** » (à relire, à programmer, publications du jour) ;
   - carrousel « **Brouillons** » ;
   - « **En cours** » : tous les travaux, les échecs en rouge avec Réessayer ;
   - champ « **Une idée ?** » ;
   - carte « **Prêt pour une vraie vidéo ?** » (visage, voix, LUT, logo).
4. **Les simulations se voient** :
   - pastille ambre « Essai » sur les boutons d'un fournisseur simulé ;
   - toast « Essai : rien n'a été envoyé à Buffer » ;
   - `Publication.via = 'simulation'`, jamais affichée comme programmée.
5. **Six touches au maximum** :
   - une étape dont tout a une valeur par défaut s'affiche **repliée** en une ligne, avec « Modifier » ;
   - à partir de l'étape Script, « **Fabriquer avec les réglages habituels** » mène directement à l'Aperçu ;
   - « Créer la vidéo » depuis un script ou une idée ouvre l'assistant prérempli ;
   - le test Playwright compte les touches.
6. **Coût en gros chiffre à l'Aperçu**, et feuille de confirmation au-delà du seuil.
7. **Données de démonstration repérées** (`estDemo`). Interrupteur « Afficher les exemples » dans Réglages : il masque sans supprimer. Un état vide propre partout.
8. **Structure seulement** :
   - `Notification` + `FournisseurNotification` (notification sur le téléphone ou e-mail plus tard ; Réglages > Notifications présent) ;
   - `Serie` (filtre « Série » dans Mes vidéos) et `lotId` sur Travail (fabrication en série « bientôt ») ;
   - vidéos dérivées (`sourceVideoId`, `typeDerive`, `langue`), avec l'action « Décliner » marquée « bientôt » ;
   - `Publication` { sortieId, texte, idExterne, urlPubliee, erreur, stats } et onglet « Résultats » (chiffres de démonstration). C'est la base du futur générateur qui apprendra de ce qui marche.
9. **Reporté** : le partage vers le studio depuis le téléphone (`share_target`) et la dictée vocale des idées. Ils seront ajoutés à la mise en ligne.

### AV2.5 Niveaux de finition (pour tenir les délais)

| Niveau | Écrans |
|---|---|
| **1 — parfait** | Connexion, Accueil, Nouvelle vidéo, Assistant avocat (avec Aperçu), Mes vidéos et onglets de format, Fiche vidéo + kit de publication, Personnages |
| **2 — complet mais générique** | Bibliothèque (un composant commun `ListeElements` ; seuls les onglets LUT, Illustrations et Sous-titres sont spécifiques), Écrire (scripts, idées), Mes modèles, Réglages |
| **3 — fonctionnel minimal** | Retouches (liste de plans + consigne), Miniature (choix parmi 3), Calendrier, Résultats, Styleguide |

### AV2.6 Lots et durée (remplace B.10 et B.11)

| Lot | Contenu | Durée indicative |
|---|---|---|
| 1. Architecte | socle ; design system **+ composants partagés** (ListeElements, ListeAvecFiltres, FeuilleBas, BarreActionCollee, CalqueZonesReseaux) ; coquille AV2.1 ; connexion ; **tous les registres** (formats, étapes, moteurs, fournisseurs, briques, réseaux) ; **contrat AV2.2** ; modèle de données complet ; démonstration ; routes squelettes ; `ARCHITECTURE.md` | 2 à 3 h |
| 1b. Point de direction | captures de l'Accueil et de la Fiche vidéo à 390 px envoyées à Will. **Non bloquant** : les développeurs démarrent, et les remarques s'appliquent quand elles arrivent | — |
| 2. Écrans (×3) | **A** : Accueil, Nouvelle vidéo, Assistant + étapes, Écrire (scripts, idées), Mes modèles · **B** : Personnages, Bibliothèque · **C** : Mes vidéos et onglets de format, Fiche vidéo (kit, sous-titres, retouches, miniature, résultats), Partage, page publique, Calendrier, Réglages, Notifications, Recherche | 3 à 4 h |
| 3. Qualité (une passe) | B.9 + contrats partagés + blocage budgétaire + comptage des touches | 1 à 2 h |
| 4. Mise en ligne | B.3 + `studio-worker` : **studio.axion-ia.com protégé**, avant la remise | 2 à 3 h |
| 5. Remise à Will | **lien à ouvrir sur son téléphone** + captures | — |

**Durée totale estimée : une à deux journées de travail des agents.**

### AV2.7 Toutes les briques sont facultatives (demande de Will, 01/10)

- **Par format** : chaque `DefinitionFormat` déclare `briques: Partial<Record<IdBrique, "active" | "desactivee" | "au-choix">>`. Les briques concernées sont : sous-titres, etalonnage, illustrations, son (musique et bruitages), habillage, texte à l'écran, mention IA incrustée. Le moteur **saute** une brique désactivée. Le test du registre accepte un format sans aucune brique facultative, par exemple « Vidéo brute ». Seule la mention IA reste exigée **dans la légende** des vidéos réalistes, même si elle n'est pas incrustée.
- **Par vidéo** : à l'étape Réglages, chaque brique `au-choix` ou `active` a un **interrupteur** (« Sous-titres », « Couleurs de cinéma (LUT) », « Musique »…). L'état choisi est enregistré dans `CommandeFabrication.styles` (`null` = brique coupée).
- **Par modèle** : un modèle enregistre aussi les briques coupées.
