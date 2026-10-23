# Lot D · adaptations gratuites par réseau

**État : code posé, réglage COUPÉ, rien n'est allumé. Lot G2 : seule la COUPE du segment facultatif est branchée (voir « Branchement G2 ») ; le reste n'est pas branché.**

## Le réglage

`adaptations_reseaux.actif` (`src/reseaux/adaptations.ts`), `false` par défaut. Seul `true` strict l'allume. Coupé, chaque
fonction rend l'identité (aucune adaptation). Toutes reçoivent aussi `origine` : « will » (script collé par Will) = pris à l'identique. Coût : 0 (fonctions pures, aucun appel Claude ni HeyGen).

## Les adaptations (une fonction pure testée chacune)

| Fonction | Rôle | Source de la règle |
|---|---|---|
| `segmentsFacultatifsRetenus` | s'applique UNIQUEMENT APRÈS `segmentRetenu` / `assemblerBlocs`, sur une liste déjà filtrée (TikTok, Instagram, Facebook, Shorts n'ont déjà aucun facultatif). Seule nouveauté : le plafond de durée LinkedIn (zone 32-60 s). Réglage coupé = identité de ce que le code actuel retient, pas « tout garder » | `hyp-zones-reseau` (hypothèse) |
| `boucleVisuelle` | (`null` = rien à changer quand le réglage est coupé, `false` = pas de boucle) la fin rejoint l'accroche : oui TikTok/Instagram/Shorts, non LinkedIn, Facebook sauf après question | `hyp-ecriture-reseau` (hypothèse) |
| `habillageReseau` | marges des sous-titres et de l'encadré hors de la zone recouverte par le réseau (zone + 2 points, gauche et droite séparées) ; LinkedIn : sous-titres obligatoires | zones du registre ; `li-sous-titres` (opinion) |
| `ratioReseau` | ratio préféré du réseau s'il est disponible (LinkedIn : 9:16, voir plus bas) ; jamais 16:9 (YouTube long hors périmètre) ; `null` si le registre du réseau n'en permet aucun | registre `reseaux/index.ts` |

## Règles datées et sourcées (Shorts / Reels jusqu'à 3 min)

- `ys-shorts-3min-2024` : Short jusqu'à 3 min depuis le 15/10/2024 (annonce du 03/10/2024), niveau *observé*. **Sources
  secondaires uniquement** (tubefilter, esports.gg) : la page d'aide YouTube n'a pas été relue, d'où `aRevoirLe`.
- `ig-reels-3min-2025` : Reels jusqu'à 3 min, annonce d'Adam Mosseri en janvier 2025 (vers le 20/01 : les sources secondaires divergent entre le 17, 18, 20 et 21/01) ; `source.date` = date de l'article cité (21/01/2025).
- Les plafonds `dureeMaxSec` de `ecriture.ts` citent maintenant ces règles. 180 s reste un PLAFOND, jamais un plancher.

## Hypothèses non sourcées : restent OFF

`hyp-voix-acceleree-tiktok` (`vitesseVoix` rend toujours 1) et `hyp-resultat-d-abord` (`ordreScript` ne change jamais
l'ordre). Même réglage allumé. Les allumer demande une source ET l'accord de Will.

## Répétition générale

`tests/reseaux/repetition-generale/lot-d.test.ts` : ffmpeg local encode trois vrais segments 9:16 (30 s + 2 × 8 s), le plan
est appliqué pour les cinq réseaux, le montage est réellement assemblé (concat), la durée relue par ffprobe (30 s ou 46 s
selon le réseau). Ce ne sont pas des vidéos du studio : elles sont synthétiques mais réellement encodées, sans réseau ni
coût. Le test est ignoré (`skip`) si ffmpeg est absent.

## Points à trancher par Will

- **LinkedIn 9:16 ou 4:5 : à trancher par Will.** Le registre donne à LinkedIn `ratioPrefere` 4:5, `ecriture.ts` et la règle
  `li-video-2026` disent « vertical 9:16 par défaut ». Décision prise en attendant : `ratioReseau` garde 9:16 et
  n'utilise PAS `ratioPrefere` pour LinkedIn (pas de 4:5 silencieux). 4:5 n'est rendu que s'il est le seul ratio disponible.

## Branchement G2 (fait)

`corpsAdapte` (`src/services/fabrication-reseaux.ts`, appelé par `blocsDeLaVersion`, donc par la commande, le prix, le contrôle et l'état de chaque version) lit `adaptations_reseaux.actif` et appelle `adapterBlocsDuCorps` (`src/reseaux/adaptation-derivation.ts`, pur). Coupé (défaut) : le corps est rendu tel quel (même référence). Le plafond de 60 s LinkedIn porte sur la VIDÉO ENTIÈRE : la durée de l'ouverture et de la fin s'ajoute à celle du corps, estimée avec le même débit que la commande (`debitVoix`, débit HeyGen mesuré × vitesse de la voix). Ce débit est celui de la voix de la VIDÉO (`distribution[0].voixId`) sur tous les chemins : commande, estimation (voix de la distribution par défaut), contrôle réel, raccord et coût complet ; seul `planFabricationSujet` ne lit que l'ouverture et la fin, donc aucun débit. Preuve : `tests/reseaux/adaptations-debit-controle-raccord.test.ts`. Jamais adapté : script collé par Will (un bloc `colle-`), format avocat, réseau hors déclinaison ; jamais coupé non plus : un segment qui porte `sourceTexte` (matière saisie par Will, y compris dans le générateur où le texte collé devient une matière). Toute erreur (lecture du réglage comprise) : retombe sur le corps d'avant. Aucun appel payant, aucun rendu.

**Le branchement ne dort pas forcément** : `src/generateur/chaine.ts` (~l.670) marque un segment facultatif dès que Claude le signale, quel que soit `segmentsFacultatifsMax`. Réglage allumé, la coupe peut donc agir sur des scripts du générateur existants.

**Limites connues (non corrigées)** : (1) le script enregistré pour la vidéo (`videoDeVersion`, ~l.605) n'est pas coupé : seule la commande l'est ; (2) `v.dureeEstimeeSec` (durée affichée dans le plan « Fabriquer les N ») ignore la coupe, alors que le prix, lui, en tient compte.

**Pas branché** : `ratioReseau` (les ratios sont décidés par `ratiosDeLaMere`/`ratiosVersion`, partagés avec la mère et le prix : aujourd'hui la version LinkedIn sort en 4:5, ce qui contredit « LinkedIn 9:16 par défaut » ; à trancher par Will avant de toucher) ; `boucleVisuelle` et `habillageReseau` (aucun champ de `CommandeFabrication` ne les porte : il faudrait toucher `src/domaine/types.ts` et les moteurs/`studio-rendu`, hors périmètre) ; `src/services/fabrication.ts` (gelée).

## RÉPÉTITION GÉNÉRALE à faire avant d'allumer

À faire sur de VRAIS fichiers (règle de Will), réglage allumé sur une copie d'essai, jamais sur une vidéo réelle d'abord :

1. **LinkedIn, script de la machine avec 2 segments facultatifs** dont le total dépasse 60 s : vérifier que la version LinkedIn n'a que les facultatifs qui tiennent (le premier gardé, le suivant coupé), que la durée relue par ffprobe reste ≤ 60 s, que la voix et les sous-titres n'ont pas de trou ni de mot coupé au raccord.
2. **LinkedIn, facultatifs qui tiennent** : la version est identique à celle réglage coupé (même durée, même texte).
3. **TikTok, Instagram, Facebook, Shorts** : aucun changement attendu (aucun facultatif) ; comparer texte dit et durée avec le réglage coupé.
4. **Script collé par Will** (n'importe quel réseau) : texte et durée strictement identiques réglage allumé et coupé.
5. **Avocat** : identique, réglage allumé et coupé.
6. **Prix annoncé** avant « Fabriquer » : cohérent avec la durée réellement fabriquée (le prix lit le même corps).
7. **Réversibilité** : éteindre le réglage et refabriquer redonne exactement la version d'avant.
