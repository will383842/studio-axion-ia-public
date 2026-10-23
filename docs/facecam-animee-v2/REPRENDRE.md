# REPRENDRE — générateur « Face caméra animée » (15/10/2026)

> ## ⭐ CONSIGNE DE WILL POUR CETTE NOUVELLE SESSION (15/10 soir) — À APPLIQUER EN PRIORITÉ
> « Il faut de la **DIVERSITÉ**, du **MODERNE**, des animations **au top**, selon les **meilleurs designs de fin 2026 / 2027**. Il faut que ce soit selon les **meilleures pratiques des réseaux sociaux**, **exceptionnel et moderne**. »
>
> Concrètement :
> 1. **Recherche d'abord** (web) les tendances de motion design et de montage des vidéos courtes en fin 2026 / 2027 (TikTok, Reels, Shorts, LinkedIn) et les meilleures pratiques de rétention. Croise les sources, distingue ce qui est sourcé de ce qui est supposé, et écris une synthèse avec des exemples concrets.
> 2. **Le directeur artistique** refait son standard à partir de cette recherche et des retours de Will (§ 5 ter : emplacements, formes et mouvements variés, énergie, moments « coup de poing »). Le niveau visé n'est plus seulement la vidéo de référence : c'est **le meilleur du moment**.
> 3. **Designers, puis critique, puis corrections**, avec des planches à montrer à Will **avant** toute intégration. Will choisit.
> 4. Toujours dans la charte de Will et dans ses décisions (§ 2).



*À lire en premier par une nouvelle session. Répondre à Will en français, simplement, et finir chaque réponse par « ⏳ J'attends de vous : … ».*

## 1. Ce qu'on construit
Un **nouveau générateur du studio**, indépendant : Will dépose **sa prise filmée (sa voix, son visage)**, le studio la monte dans le **style de la vidéo de référence LinkedIn** (`reference/reference-linkedin.mp4`) : cartes d'interface claires, étiquettes, mini-vidéos dans des fenêtres, sous-titres mot à mot, bruitages. **Claude Opus (le « réalisateur »)** décide de la mise en scène d'après ce que Will dit.

## 2. Décisions de Will (ne pas rediscuter)
Mémoire : `face-camera-animee-decisions-style-will.md`. En bref :
- Charte des posts Buffer (ivoire #E9DCC8, encre #110A05, orange #B44F29, sable #BFA88B ; Montserrat ExtraBold / Inter). **Aucune musique**, bruitages obligatoires, aucune banque payante.
- Un objet cache le visage **entier ou rien**, jamais à moitié. Le **visage reste visible au début** de la vidéo.
- **Aucun zoom** ni mouvement de caméra sur sa prise. Il **garde** la descente de son image quand une carte, une fenêtre ou une étiquette arrive.
- Le compteur **défile** jusqu'au chiffre dit.
- **20 cartes de niveau « meilleurs monteurs »** : les 10 d'origine (jugées « bas de gamme ») redessinées, plus 10 nouvelles.
- Vidéo 5 jugée **trop répétitive** : il faut **beaucoup plus de familles de motion design** et des règles de diversité.
- **Les vidéos arrivent dans le STUDIO, plus dans le Drive.** La vidéo 5 a été la dernière au Drive. Will supprimera lui-même les essais du Drive ; ne pas les supprimer.

## 3. Où est le code
- Dépôt studio : `<dossier utilisateur>\Documents\Projets\studio-interface-claire`, **branche `interface-claire/lot-c`** (poussée, **pas fusionnée**). Dernier commit de la passe 4 : `d9e90060`.
- Déjà dans master : #188 (socle FA, format masqué), #196 (lot B), #201 (correctif import React).
- Rendu : `studio-rendu/compositions/interface-claire/` (VideoAnimee = rendu universel depuis un plan ; cartes/ ; variantes/ ; motion/ ; cadrage.ts ; sons/ = bruitages CC0).
- Plan : `src/domaine/facecam-animee/plan.ts`. Réalisateur : `src/moteurs/montage-facecam-animee/realisateur/` (consigne, contrôles, rythme.ts, règles fixes). Images : `.../images/` (Pexels/Pixabay). Tests : `tests/facecam-animee/` (255 au vert à la passe 4).
- Outils : `scripts/essai-realisateur.ts`, `scripts/approvisionner-fenetres.ts`, `scripts/mesure-rythme.ts`. Mesure : `dynamisme.py`, copié dans `planche-v1/outils/`.

## 4. Où on en est
| Vidéo | Gros mouvements/min | Remarque |
|---|---|---|
| Référence | 109 (84 sans ses zooms) | cible |
| v5 (`cinquieme-video-passe-4-2026-10-15.mp4`, Drive) | **89** | meilleure ; mais répétitive, design des cartes bas de gamme |

Documents de suivi :
- `ARCHITECTURE-PERFECTION-2026-10-14.md` : diagnostics et revues des passes 1 à 4, avec la liste « ce qui reste ».
- `CARTES-20-PREMIUM-2026-10-15.md`
- `DIVERSITE-MOTION-2026-10-15.md`

## 5. En cours au moment d'écrire (workflows de la session précédente)
- **20 cartes premium** (wf_77ce83ab-cba) : planche attendue dans `cartes-20\` (avant/après + nouvelles).
- **Diversité** (wf_dc8d1d3f-7fe) : 12 familles de motion design hors cartes dans `interface-claire/motion/`, règles de diversité dans le réalisateur. Planche attendue dans `motion-12\`.

**Si ces dossiers ne contiennent pas de planche**, le workflow a été interrompu. Lire les journaux (`~/.claude/projects/<projet-local>-Documents-Projets-Axion-IA/55133bef-9581-493b-a484-fae7fb25910a/subagents/workflows/<id>/journal.jsonl`) ou relancer depuis les scripts (`.../workflows/scripts/`).

## 5 bis. MIS EN PAUSE par Will le 15/10 vers 14 h 45
Les deux workflows ont été ARRÊTÉS (pas finis) :
- **Diversité** (wf_dc8d1d3f-7fe) : 9 agents sur 10 finis. Il ne manquait que la planche. Pour reprendre : `Workflow({scriptPath: "<dossier utilisateur>\.claude\projects\<projet-local>-Documents-Projets-Axion-IA\55133bef-9581-493b-a484-fae7fb25910a\workflows\scripts\face-camera-animee-diversite-wf_dc8d1d3f-7fe.js", resumeFromRunId: "wf_dc8d1d3f-7fe"})`. Les agents finis repartent du cache (même session seulement). Dans une autre session, faire la planche à la main à partir des fichiers de `interface-claire/motion/` et de `DIVERSITE-MOTION-2026-10-15.md`.
- **20 cartes premium** (wf_77ce83ab-cba) : directeur artistique, 5 designers et critique faits ; corrections des 5 designers en cours au moment de l'arrêt, puis la planche. Reprise : même procédé avec `face-camera-animee-20-cartes-premium-wf_77ce83ab-cba.js` et `resumeFromRunId: "wf_77ce83ab-cba"`. Dans une autre session : relancer les corrections à partir de la critique (journal.jsonl du workflow), puis faire la planche.
- Le code produit (`cartes/*.tsx` redessinées, `variantes/`, `motion/`, réalisateur) est sur le disque, **NON commité** : vérifier `import React`, tests et tsc, puis commiter sur `interface-claire/lot-c`.

## 5 ter. RETOUR DE WILL SUR LES PLANCHES PROVISOIRES (15/10 soir) — NOUVELLE CONSIGNE PRIORITAIRE
Planches provisoires : `cartes-20-provisoire\planche-cartes-provisoire.jpg` et `motion-12-provisoire\planche-motion-provisoire.jpg`.

Retour de Will : « j'ai l'impression qu'il n'y a que le même style, sans motion design sur le côté, et toujours carré ; il faut du pep's et de l'énergie ».

À la reprise, les designers doivent :
- **varier les EMPLACEMENTS** : haut, côté gauche ou droit, bas, autour de la tête, plein écran, diagonale ; jamais deux fois de suite au même endroit ;
- **varier les FORMES** : cercles, rubans en biais, autocollants inclinés, flèches, éclats, aplats plein écran ; moins de rectangles à contour ;
- **varier les MOUVEMENTS** : jaillissement, balayage, rotation, élastique, petite secousse de l'élément à l'impact, cascades ;
- ajouter des **moments « coup de poing »** : aplat orange plein écran avec un mot géant, puis retour sur Will.

Les règles déjà décidées restent valables : charte, visage entier ou couvert entièrement, aucun zoom de la prise, visage visible au début. Le directeur artistique doit refaire son standard en ce sens, et le réalisateur doit avoir des règles de variété d'EMPLACEMENT et de FORME, en plus des types.

## 6. Prochaines étapes
1. **Montrer les deux planches à Will** (images) : il choisit les cartes et familles à garder. Retirer les autres du catalogue du réalisateur.
2. **Commiter** le travail des deux équipes sur `interface-claire/lot-c` : vérifier `import React` dans chaque .tsx, ainsi que tests et tsc.
3. **Lot I — brancher le générateur dans le studio** (accepté par Will). **À faire en routine CLOUD Anthropic** (environnement `env_01HLFCKaF8ebi2jvvTRVo5kB`), demande de Will du 15/10 : libérer le PC. Ensuite, les vidéos sont fabriquées par le serveur du studio, plus par le PC. Il faut :
   - assembler l'étape images en production (`etapeImagesStudio`, rien ne la branche encore) ;
   - faire servir les médias et les sons au rendu de prod par `servirDossier`, avec des URL complètes au lieu de `staticFile` ;
   - appeler le **vrai Opus** par l'API du studio ;
   - lever `refusAuLancement` ;
   - format visible pour Will seulement ;
   - PR, coordination avec les sessions studio (prévenir avant toute fusion ou mise en ligne), fusion, mise en ligne par la session qui gère le studio.
4. Premier vrai essai **dans le studio** sur IMG_7747. Plus tard, sur le script « par où commencer » v3 (`scripts\script-par-ou-commencer-v3.md`) quand Will l'aura filmé.
5. Puis les lots G (retouches par la conversation) et H (contrôle final avant de montrer).

## 7. Pièges connus
- Chaque `.tsx` de studio-rendu **doit** importer React : la prod compile le JSX en mode classique (#201).
- PC limité : un seul calcul lourd à la fois (verrou `<dossier utilisateur>\Documents\Projets\Axion-IA\verrou-lourd.txt`). Après un rendu Remotion, supprimer les `%LOCALAPPDATA%\Temp\remotion-*` créés. Le disque C est souvent presque plein.
- Ne jamais faire `git worktree remove` sur un worktree dont `node_modules` est une jonction : retirer la jonction d'abord.
- `Icone` (`interface-claire/elements.tsx`) est utilisé par le format Image → vidéo (session axion-ia-9e) : **ne pas changer sa signature**.
- Les clés Pexels/Pixabay sont dans `<dossier utilisateur>\Documents\Projets\generation_videos\.env`. Ne jamais les afficher ni les recopier.
- Les agents qui « jouent Opus » ne prouvent pas ce que fera le vrai Opus. Le vrai test se fait une fois branché au studio.
