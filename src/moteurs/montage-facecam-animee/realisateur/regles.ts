/**
 * CONTRÔLES DU PLAN DE MISE EN SCÈNE (lot C, plan § 4.3 et § 4.5 ; cahier « perfection » de l'architecte du 14/10) — PURS.
 *
 * `verifierPlan(plan, mots, options)` relit un plan `plan-facecam-animee/1` contre la transcription et rend des messages
 * PRÉCIS en français : ce sont eux qui repartent tels quels vers Claude Opus pour le nouvel essai. Seuils mesurés sur la
 * vidéo de référence (ANALYSE-COMPLETE-v2 § 3 à § 6, ARCHITECTURE-PERFECTION § 1 et § 4.3) :
 * - forme (schéma zod), instants dans la vidéo, début avant fin, sous-éléments dans leur objet ;
 * - ANCRAGE : chaque sous-élément tombe à ± 0,15 s du début d'un mot dit ;
 * - durées : carte 1,5 à 6,5 s, fenêtre 1 à 3 s, calque 0,8 à 4 s ; jamais deux cartes, ni une carte et une fenêtre, ni
 *   deux fenêtres en même temps ;
 * - DENSITÉ : bande (cartes) 40 à 50 % du temps ; une rupture forte (entrée de carte, de fenêtre ou de calque) toutes
 *   les 2,8 s en moyenne au plus ;
 * - RYTHME COMPTÉ COMME LA MESURE (revue passe 3 du 15/10, `rythme.ts`) : chaque événement vaut la SURFACE d'écran qu'il
 *   change ; 85 gros mouvements (≥ 5 % de l'image) par minute au moins et aucun trou de plus de 0,7 s sans changement
 *   visible (≥ 1 % de l'image ; le temps sous une mini-vidéo, pendant le défilement d'un compteur ou sur l'écran de fin
 *   ne compte pas). Une puce, une icône, une coche ne font ni gros mouvement ni fin de trou ;
 * - LITTÉRALITÉ : chaque carte et chaque fenêtre renseigne « illustre » (mots EXACTS dits autour de l'objet) ; la
 *   « recherche » d'une fenêtre décrit une scène (3 mots porteurs au moins : sujet + action + lieu) ; titre de carte =
 *   nom d'une chose (4 mots au plus, ni virgule ni mot de liaison en tête) ; une carte (TOUS les types) ne recopie
 *   pas plus de 50 % des mots dits pendant qu'elle est à l'écran ; un mot de la carte est dit dans la seconde qui
 *   précède son entrée ; une fenêtre ne montre pas une MÉTAPHORE (horloge, sablier, goutte, ampoule…) dont le mot n'est
 *   pas dit ; quand la phrase nomme une personne ou une action, la recherche montre une personne et CETTE action ; la
 *   recherche reprend au moins un mot de « illustre » ; passe 3 : la recherche dit QUI fait QUOI (une action qui se
 *   filme : jamais « sent », « pense »…) et OÙ (avertissement) ; « chercher / trouver » et « temps libre » (après-midi,
 *   week-end) sont des actions STRICTES ; chaque vignette d'une grille montre la chose dite sur son mot (ni
 *   pictogramme générique, ni fiche sans icône) ;
 * - MINI-VIDÉOS : une fenêtre toutes les 14 s au moins (conseil : 10 s), 60 % de vidéos, 70 % « sur-le-visage »
 *   (le défaut), la moitié au moins enchaînées ≤ 0,3 s après une carte ou une fenêtre ;
 * - CADRAGE — DÉCISION DE WILL DU 15/10 (« il faut supprimer le zoom car ça bouge trop ») : AUCUN zoom coupé ni
 *   mouvement de cadrage (« zooms » vide, « mouvements » absent ou vide, refus sinon) ; le dynamisme vient des
 *   animations elles-mêmes : un calque au moins toutes les 3 s quand le visage est seul (revue finale du 14/10) ;
 * - VARIÉTÉ : jamais deux fois de suite le même type de carte ni la même entrée ; 4 types au moins au-delà de 60 s ;
 *   premier objet différent de celui de la vidéo précédente (erreur) ; suites de types, de cadrages et recherches de
 *   médias déjà vues dans les 5 vidéos précédentes (avertissements) ;
 * - NIVEAUX : 3 sous-éléments datés au moins par carte ; jamais vide (1er sous-élément ≤ 0,2 s après l'entrée) ni
 *   immobile (≤ 0,8 s entre deux sous-éléments, avertissement au-delà de 0,7 s) — revue passe 2 du 15/10 ;
 * - TEXTES : jamais « Villeexemple », « gain garanti », « Certifexemple », « certifié » ; aucun chiffre affiché qui ne soit pas
 *   dit ; icônes de la liste autorisée ; une étiquette de 2 mots ou plus ne double jamais mot pour mot le sous-titre
 *   affiché au même moment (revue passe 3 ; barrée, chiffre, glisse, tuile exceptés) ;
 * - FIN : l'écran de fin ne coupe pas le dernier mot (début ≥ fin du dernier mot − 0,3 s).
 * - DIVERSITÉ (retour de Will sur la vidéo 5, 15/10 : « c'est presque toujours les mêmes choses qui reviennent » ; règles
 *   R1 à R7 du directeur artistique, `controlerDiversite`) : 15 familles (fenêtre, étiquette, carte + 12 motions),
 *   ouverture sur le visage entier, temps de visage, enchaînements, plafonds, variété par minute, bruitages, historique.
 *   Chaque message commence par son code (« R3a — … ») ; un plan qui échoue sur R1, R3a, R4a ou R5a n'est pas RENDU
 *   (`rendable: false`). Les anciens seuils qui contredisaient ces règles sont alignés : bande 8 à 35 % (5 cartes au plus),
 *   une fenêtre toutes les 20 s au pire (6 au plus), la moitié au plus « sur-le-visage » (au lieu de 70 % au moins).
 */
import { CADRAGE_FENETRE_DEFAUT, schemaPlanFacecamAnimee, type CalquePlan, type CartePlan, type FenetrePlan, type MotionPlan, type PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { apparitionsDuPlan, CATALOGUE_FAMILLES, DIVERSITE, estFamilleMotion, facteurDuree, FAMILLES, familleDeSon, familleDuSon, plafondFamille, type Apparition, type Famille } from "./familles";
import { EPS } from "@/briques/intensite/orchestrateur";
import { iconeAutorisee } from "./icones";
import { controlerDiversiteV2, estRendableV2, historiqueV2 } from "./regles-v2";
import { controlerDiversiteV3, estRendableV3, historiqueV3 } from "./regles-v3";
import { historiqueV4 } from "./historique-v4";
import { controlerDiversiteV4, estRendableV4 } from "./regles-v4";
import { rythmePrevu, type PicPrevu } from "./rythme";
import { bruitagesDuPlan } from "./sons";
import { etiquetteDoubleSousTitre, groupesSousTitres } from "./sous-titres";
import { estMotOutil, estNombreDit, motsInterditsDans, nettoyer, nombresDansTexte, nombresDits, ponctuationFinale, sansElision, simplifier, valeurEnLettres, type MotTranscrit } from "./mots";

/** Seuils (référence : 26 ruptures fortes en 80 s, bande 46 % du temps, cartes de 1,5 à 6,3 s, 11 fenêtres en 80 s). */
export const SEUILS = Object.freeze({
  toleranceAncrageSec: 0.15,
  carte: { min: 1.5, max: 6.5 },
  fenetre: { min: 1, max: 3 },
  calque: { min: 0.8, max: 4 },
  /** Motions (15/10) : 0,6 à 4 s (un mot géant ou un trait dessiné peut être un coup bref). */
  motion: { min: 0.6, max: 4 },
  /**
   * Bande (cartes à l'écran). Avant le 15/10 : 40 à 50 % (référence 46 %). Les règles de diversité plafonnent les cartes
   * à 5 pour 90 s (R4b) et exigent le visage à sa place 45 % du temps au moins (R2a) : 8 à 35 %.
   */
  bande: { min: 8, max: 35 },
  /**
   * Une rupture forte (ENTRÉE de carte, de fenêtre ou de calque) toutes les 2,4 s en moyenne (avertissement au-delà) ;
   * erreur au-delà de 2,8 s (référence : ≈ 3 s). Depuis le 15/10 il n'y a plus de zooms : seules les entrées d'objets
   * comptent ; les SORTIES sont des événements (trous) mais pas des ruptures.
   */
  secondesParRupture: 2.4,
  secondesParRuptureMax: 2.8,
  /**
   * Aucun moment de plus de 0,7 s sans changement VISIBLE à la mesure (≥ 1 % de l'image, `rythme.ts`). Revue passe 2 du
   * 15/10 : référence 0,64 s, vidéo 3 : 1,12 s (seuil précédent : 1 s). Passe 3 : compté comme la mesure (la vidéo 4 se
   * croyait à 0,69 s et en mesurait 1,20).
   */
  trouMaxSec: 0.7,
  /**
   * GROS MOUVEMENTS (≥ 5 % de l'image, comme `dynamisme.py`) prévus par minute : 85 au moins (référence sans ses zooms :
   * 83,8 à 97,1 ; vidéo 3 : 64,5 ; vidéo 4 : 58,1), viser 90 (avertissement entre les deux).
   */
  grosMouvementsParMinuteMin: 85,
  grosMouvementsParMinuteVise: 90,
  /**
   * Hors cartes et fenêtres : un calque (étiquette, badge, tuile, compteur…) au moins toutes les 3 s (ERREUR, revue finale
   * du 14/10 : la référence fait vivre des étiquettes autour de la tête en continu, « OUTIL 1/6 », logos, rôles).
   */
  calqueHorsCartesMaxSec: 3,
  /**
   * Mini-vidéos (Will 14/10 ; référence : 11 fenêtres en 80 s). Depuis les règles de diversité (15/10) : 6 fenêtres au
   * plus pour 90 s (R4b), donc une toutes les 20 s au pire (16 visées) ; la moitié au plus « sur-le-visage » (R4d, contrôlé
   * avec la diversité) ; « enchaînée » = entre 0 à 0,3 s après la sortie d'une carte, d'une fenêtre ou d'une motion.
   */
  fenetres: { secondesParFenetre: 16, secondesParFenetreMax: 20, partVideoMin: 0.6, enchaineeMaxSec: 0.3, partEnchaineesMin: 0.5 },
  /** DÉCISION DE WILL DU 15/10 (« il faut supprimer le zoom car ça bouge trop ») : aucun zoom coupé ni mouvement de cadrage. */
  zoomsAutorises: false,
  /** Littéralité : une carte liste / frise / grille ne recopie pas plus de 50 % des mots dits pendant qu'elle est là (contrôlé dès 4 mots dits). */
  copieSousTitresMax: 0.5,
  copieMotsDitsMin: 4,
  /** Un texte de carte de 3 mots ou plus est un bout de phrase (compté dans la recopie) ; 1 ou 2 mots, le nom d'une chose. */
  copieMotsParBoutMin: 3,
  titreMotsMax: 4,
  /** « illustre » : mots dits entre 2 s avant l'objet et 1 s après sa fin. */
  illustreAvantSec: 2,
  illustreApresSec: 1,
  /** Un mot de la carte (titre ou contenu) est dit entre 1 s avant son entrée et son 1er sous-élément (0,4 s après). */
  motCleAvantEntreeSec: 1,
  motCleApresEntreeSec: 0.4,
  /** La « recherche » d'une fenêtre : 3 mots porteurs au moins (sujet + action + lieu). */
  rechercheMotsMin: 3,
  typesMinSiPlusDe60s: 4,
  sousElementsMinParCarte: 3,
  /** Frise : une puce au plus par étape (rendu : deux puces débordent de la carte). */
  pucesParEtapeMax: 1,
  /**
   * Une carte n'est jamais vide : 1er sous-élément daté ≤ 0,2 s après son entrée (revue passe 2 du 15/10 ; avant : 0,4 s).
   * Le rendu le garantit aussi pour un ancien plan (`contenuAvance`, Carte.tsx) et ne dessine plus d'emplacement vide :
   * une ligne, une vignette ou une tuile apparaît AVEC son contenu, sur son mot.
   */
  carteVideMaxSec: 0.2,
  /** … ni immobile : 0,8 s au plus entre deux sous-éléments successifs (avertissement au-delà de 0,7 s ; avant : 1,5 / 1,2 s). */
  carteImmobileMaxSec: 0.8,
  carteImmobileConseilSec: 0.7,
  finAvantDernierMotSec: 0.3,
});

/** Mots de tête qui font d'un titre une phrase abstraite (« Ou peut-être », « Partout, le même réflexe »). */
export const TETES_TITRE_ABSTRAIT: readonly string[] = Object.freeze(["ou", "et", "mais", "alors", "donc", "puis", "partout", "peut-etre", "si", "quand", "comme", "pourquoi", "comment", "car", "enfin", "bref", "voila", "voici", "ensuite", "aussi", "toujours", "jamais", "parfois", "souvent"]);

/** Ce qu'une vidéo précédente a utilisé (anti-répétition), dans l'ordre. */
export interface HistoriqueVideo {
  titre?: string;
  types: readonly string[];
  entrees: readonly string[];
  /** Recherches de médias des fenêtres. */
  recherches?: readonly string[];
  /** Ancien champ (suite des échelles de cadrage) : lu sans erreur, plus utilisé depuis la suppression des zooms (15/10). */
  echelles?: readonly number[];
  /** Premier objet de la vidéo (`signatureObjet`) : « carte:liste », « fenetre:video », « calque:etiquette »… */
  premier?: string;
  /** Historique des familles (R7, `historique-motion.json`) : suite des familles dans l'ordre, et leurs débuts (s). */
  familles?: readonly string[];
  debutsFamilles?: readonly number[];
  /** Apparitions par famille et par type (contenu de carte, type de calque, famille de motion, vidéo / photo). */
  comptesFamilles?: Readonly<Record<string, number>>;
  comptesTypes?: Readonly<Record<string, number>>;
  /** Durée de la vidéo (plafonds de R4b ramenés à la durée, pour R7d). */
  duree?: number;
  /** Éléments « v2 énergie » (D13, 16/10) : emplacement et forme du premier élément, type du premier coup de poing, lots présents. */
  premierV2?: { emplacement: string; forme: string };
  premierCoupV2?: string;
  lotsV2?: readonly number[];
  /** Éléments « v3 » (D13, 16/10) : emplacement et famille du premier élément, id du premier coup de poing. */
  premierV3?: { emplacement: string; famille: string };
  premierCoupV3?: string;
  /** Plaquettes « v4 » (19/10) : leurs ids dans l'ordre (répétitions comprises) et l'id de la première, lus par la consigne seulement. */
  plaquettesV4?: readonly string[];
  ouvertureV4?: string;
}

export interface OptionsVerification {
  /** Les 5 dernières vidéos (la plus récente en premier). */
  historique?: readonly HistoriqueVideo[];
  /** Plaquettes v4 INTERDITES dans ce plan (repli « sans vidéo », règle D16). */
  interdites?: readonly string[];
}

export interface MesuresPlan {
  ruptures: number;
  rupturesParMinute: number;
  /** Plus long trou PRÉVU par le modèle de surface (`rythmePrevu`) : ce que la mesure trouvera sur le rendu. */
  plusLongTrouSec: number;
  /** Gros mouvements PRÉVUS par minute (sur toute la durée, comme `dynamisme.py`). */
  grosMouvementsParMinute: number;
  /** Trous prévus de plus de 0,7 s. */
  trousPrevus: number;
  pourcentageBande: number;
  typesCartes: string[];
  cartes: number;
  fenetres: number;
  calques: number;
  /** Zooms coupés et mouvements de cadrage du plan : toujours 0 dans un plan accepté (refusés depuis le 15/10). */
  zooms: number;
  mouvements: number;
  sousElements: number;
  /** Fenêtres vidéo (mini-vidéos) ; parts (0 à 1) de vidéos, de « sur-le-visage », d'enchaînées ≤ 0,3 s après une carte ou une fenêtre. */
  fenetresVideo: number;
  partFenetresVideo: number;
  partSurLeVisage: number;
  partFenetresEnchainees: number;
  /** Motions du plan (15/10). */
  motions: number;
  /** Mesures des règles de diversité R1 à R7. */
  diversite: MesuresDiversite;
}

export interface MesuresDiversite {
  apparitions: number;
  /** Familles différentes, dans l'ordre de première apparition. */
  familles: string[];
  nombreFamilles: number;
  /** Familles parmi les 12 motions. */
  famillesNouvelles: number;
  /** Part de la famille la plus utilisée (0 à 1) et cette famille. */
  partFamilleMax: number;
  familleLaPlusUtilisee: string | null;
  /** Plus longue suite de la même famille (1 = jamais deux fois de suite) et nombre d'enchaînements A → A. */
  repetitionMax: number;
  memeFamilleDeSuite: number;
  /** Familles différentes au moins, sur les fenêtres glissantes de 60 s et de 20 s. */
  famillesMinPar60s: number;
  famillesMinPar20s: number;
  premierObjetSec: number | null;
  premiereCouvertureVisageSec: number | null;
  premiereCarteSec: number | null;
  premierPleinEcranSec: number | null;
  /** Parts du temps (0 à 1) : visage couvert, visage à sa place (ni couvert ni poussé). */
  partVisageCouvert: number;
  partVisageEnPlace: number;
  intervalleMoyenSec: number;
  plusLongSansEvenementSec: number;
  /** Part du bruitage le plus fréquent (famille de son : drop, tick, whoosh…). */
  partSonMax: number;
  sonLePlusFrequent: string | null;
}

export interface ResultatVerification {
  erreurs: string[];
  avertissements: string[];
  mesures: MesuresPlan;
  /** Faux si le plan échoue sur R1, R3a, R4a ou R5a : il n'est pas rendu (règle du directeur artistique). */
  rendable: boolean;
}

/** Codes dont l'échec interdit le rendu. */
/** (Les règles « v2 énergie » D0, D1, D3, D4, D9 et D10 bloquent aussi : voir `CODES_BLOQUANT_RENDU_V2` ; les décisions fixes de Will « v3 », D0 et V1 à V7 : `CODES_BLOQUANT_RENDU_V3`.) */
export const CODES_BLOQUANT_RENDU = Object.freeze(["R1", "R3a", "R4a", "R5a"]);
/** Le plan peut-il être rendu, vu ses erreurs ? */
export const estRendable = (erreurs: readonly string[]) => !erreurs.some((e) => /^R1[a-e] — |^R3a — |^R4a — |^R5a — /.test(e)) && estRendableV2(erreurs) && estRendableV3(erreurs) && estRendableV4(erreurs);

const UN_GENRE = { carte: "une carte", fenetre: "une fenêtre", calque: "un calque", motion: "une motion" } as const;

/** « 12,40 s » */
export const sec = (x: number) => `${x.toFixed(2).replace(".", ",")} s`;
const pct = (x: number) => `${x.toFixed(1).replace(".", ",")} %`;
const v = (x: number) => String(x).replace(".", ",");

/* ---------------- Lecture des objets du plan ---------------- */

/** Un instant porté par un objet (sous-élément). `ancre` : doit tomber sur un début de mot. */
export interface SousElement {
  chemin: string;
  a: number;
  ancre: boolean;
}

export interface ObjetPlan {
  genre: "carte" | "fenetre" | "calque" | "motion";
  /** Nom lisible : « carte 3 (liste) », « fenêtre 2 », « calque 5 (étiquette) ». */
  nom: string;
  index: number;
  debut: number;
  fin: number;
  sous: SousElement[];
  textes: { chemin: string; texte: string }[];
  nombres: { chemin: string; valeur: number }[];
  icones: { chemin: string; nom: string }[];
}

/** Clés d'instant dans le contenu d'une carte (tous des sous-éléments ; `saisie.fin` est une fin de frappe). */
const CLES_INSTANT = new Set(["a", "cocheA", "iconeA", "baseA", "totalA", "barreA", "barreTotalAvantA", "bascule", "jaimeA", "debut", "fin", "eclatA", "barreGaucheA"]);
/** Nombres AFFICHÉS dans une carte ou une motion (les autres sont des réglages : hauteur, colonnes, niveau de jauge…). */
const CLES_NOMBRE_AFFICHE = new Set(["valeur", "jusqua"]);
/** Chaînes qui ne s'affichent pas (types, icônes, réglages des motions). */
const CLES_NON_AFFICHEES = new Set(["type", "icone", "appli", "forme", "mode", "fond", "couleur", "cote"]);

function parcourirContenu(x: unknown, chemin: string, o: ObjetPlan) {
  if (Array.isArray(x)) {
    x.forEach((v, i) => parcourirContenu(v, `${chemin}[${i}]`, o));
    return;
  }
  if (!x || typeof x !== "object") return;
  for (const [cle, v] of Object.entries(x)) {
    const c = `${chemin}.${cle}`;
    if (typeof v === "number") {
      if (CLES_INSTANT.has(cle)) o.sous.push({ chemin: c, a: v, ancre: !(cle === "fin" && chemin.endsWith(".saisie")) });
      else if (CLES_NOMBRE_AFFICHE.has(cle)) o.nombres.push({ chemin: c, valeur: v });
    } else if (typeof v === "string") {
      if (cle === "icone") o.icones.push({ chemin: c, nom: v });
      else if (!CLES_NON_AFFICHEES.has(cle)) o.textes.push({ chemin: c, texte: v });
    } else if (Array.isArray(v) && cle === "jours") {
      v.forEach((j, i) => typeof j === "string" && o.textes.push({ chemin: `${c}[${i}]`, texte: j }));
    } else parcourirContenu(v, c, o);
  }
}

const NOMS_CALQUES: Record<CalquePlan["type"], string> = { etiquette: "étiquette", glisse: "étiquette qui glisse", compteur: "compteur", logos: "rangée de logos", tuile: "tuile" };

function objetCarte(c: CartePlan, i: number): ObjetPlan {
  const o: ObjetPlan = { genre: "carte", nom: `carte ${i + 1} (${c.contenu.type})`, index: i, debut: c.debut, fin: c.fin, sous: [], textes: [{ chemin: "titre", texte: c.titre }], nombres: [], icones: [{ chemin: "icone", nom: c.icone }] };
  parcourirContenu(c.contenu, "contenu", o);
  return o;
}

function objetFenetre(f: FenetrePlan, i: number): ObjetPlan {
  const o: ObjetPlan = { genre: "fenetre", nom: `fenêtre ${i + 1}`, index: i, debut: f.debut, fin: f.fin, sous: [], textes: [], nombres: [], icones: [] };
  if (f.noirEtBlancA !== undefined) o.sous.push({ chemin: "noirEtBlancA", a: f.noirEtBlancA, ancre: true });
  if (f.etiquette) {
    o.sous.push({ chemin: "etiquette.a", a: f.etiquette.a, ancre: true });
    o.textes.push({ chemin: "etiquette.texte", texte: f.etiquette.texte });
  }
  return o;
}

function objetCalque(c: CalquePlan, i: number): ObjetPlan {
  const o: ObjetPlan = { genre: "calque", nom: `calque ${i + 1} (${NOMS_CALQUES[c.type]})`, index: i, debut: c.debut, fin: c.fin, sous: [], textes: [], nombres: [], icones: [] };
  switch (c.type) {
    case "etiquette":
      o.textes.push({ chemin: "texte", texte: c.texte });
      if (c.sousTexte) o.textes.push({ chemin: "sousTexte", texte: c.sousTexte });
      c.icones?.forEach((x, k) => {
        o.icones.push({ chemin: `icones[${k}].nom`, nom: x.nom });
        o.sous.push({ chemin: `icones[${k}].a`, a: x.a, ancre: true });
      });
      if (c.barreA !== undefined) o.sous.push({ chemin: "barreA", a: c.barreA, ancre: true });
      break;
    case "glisse":
      o.textes.push({ chemin: "texte", texte: c.texte });
      if (c.icone) o.icones.push({ chemin: "icone", nom: c.icone });
      break;
    case "compteur":
      for (const k of ["prefixe", "suffixe", "legende"] as const) if (c[k]) o.textes.push({ chemin: k, texte: c[k]! });
      o.nombres.push({ chemin: "a", valeur: c.a });
      // Le départ du défilement (souvent 0) n'est qu'un instant de passage ; un autre départ est affiché.
      if (c.de !== 0) o.nombres.push({ chemin: "de", valeur: c.de });
      break;
    case "logos":
      c.logos.forEach((x, k) => {
        o.icones.push({ chemin: `logos[${k}].icone`, nom: x.icone });
        o.sous.push({ chemin: `logos[${k}].a`, a: x.a, ancre: true });
      });
      break;
    case "tuile":
      o.textes.push({ chemin: "legende", texte: c.legende });
      o.icones.push({ chemin: "icone", nom: c.icone });
      break;
  }
  return o;
}

function objetMotion(m: MotionPlan, i: number): ObjetPlan {
  const o: ObjetPlan = { genre: "motion", nom: `motion ${i + 1} (${m.famille})`, index: i, debut: m.debut, fin: m.fin, sous: [], textes: [], nombres: [], icones: [] };
  parcourirContenu(m.contenu, "contenu", o);
  return o;
}

/** Tous les objets du plan (cartes, fenêtres, calques, motions), avec leurs sous-éléments, textes, nombres et icônes. */
export function objetsDuPlan(plan: Pick<PlanFacecamAnimee, "cartes" | "fenetres" | "calques"> & { motions?: readonly MotionPlan[] }): ObjetPlan[] {
  return [...plan.cartes.map(objetCarte), ...plan.fenetres.map(objetFenetre), ...plan.calques.map(objetCalque), ...(plan.motions ?? []).map(objetMotion)];
}

/**
 * ANCIEN calcul (passe 2) — le contrôle compte désormais comme la mesure (`rythmePrevu`, `rythme.ts`) ; gardé pour les
 * outils qui veulent la liste brute des instants.
 * Instants de tous les événements visuels : entrées, sous-éléments ancrés et SORTIES des objets (triés). La sortie d'une
 * carte, d'une fenêtre ou d'une étiquette est un gros mouvement à l'écran (la prise remonte, l'objet part : mesuré sur
 * la vidéo 2). Depuis le 15/10, plus aucun zoom ni mouvement de cadrage.
 */
export function evenementsVisuels(plan: Pick<PlanFacecamAnimee, "cartes" | "fenetres" | "calques">): number[] {
  const t: number[] = [];
  for (const o of objetsDuPlan(plan)) {
    t.push(o.debut, o.fin);
    for (const s of o.sous) if (s.ancre) t.push(s.a);
  }
  return t.sort((x, y) => x - y);
}

/** Les 3 tranches de 10 s qui comptent le moins de gros mouvements prévus : « 40-50 s (3), 60-70 s (4)… ». */
function passagesCalmes(pics: readonly PicPrevu[], duree: number): string {
  const n = Math.max(1, Math.floor(duree / 10));
  const parTranche = Array.from({ length: n }, (_, k) => ({ k, g: pics.filter((p) => p.t >= k * 10 && p.t < (k + 1) * 10).reduce((s, p) => s + p.gros, 0) }));
  return parTranche
    .sort((x, y) => x.g - y.g || x.k - y.k)
    .slice(0, 3)
    .map(({ k, g }) => `${k * 10}-${k * 10 + 10} s (${Math.round(g)})`)
    .join(", ");
}

/** Durée cumulée de la bande (union des cartes), en secondes. */
function dureeBande(plan: PlanFacecamAnimee): number {
  const iv = plan.cartes.map((c) => [Math.max(0, c.debut), Math.min(plan.duree, c.fin)] as const).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0;
  let [ca, cb] = [-1, -1];
  for (const [a, b] of iv) {
    if (a > cb) {
      if (cb > ca) total += cb - ca;
      [ca, cb] = [a, b];
    } else cb = Math.max(cb, b);
  }
  if (cb > ca) total += cb - ca;
  return total;
}

/** Défilement d'un compteur sans durée précisée (même valeur que le rendu, `EtiquetteCompteur`). */
const DEFILEMENT_COMPTEUR_DEFAUT_SEC = 1.5;
/** Part du défilement comptée comme mouvement continu (la fin, très ralentie, ne l'est plus). */
const DEFILEMENT_COMPTEUR_VIF = 0.7;

/**
 * Ce qui BOUGE en continu ou a sa propre règle (le temps passé dessous ne compte pas dans un trou) : les MINI-VIDÉOS
 * (fenêtres `video`), les CARTES (règle « carte jamais immobile », 0,8 s au plus entre deux sous-éléments) et le
 * DÉFILEMENT d'un compteur (ses chiffres changent à chaque image ; 70 % de sa durée, la fin ralentie exclue).
 */
export function couvertureMouvement(plan: Pick<PlanFacecamAnimee, "cartes" | "fenetres" | "calques">): { debut: number; fin: number }[] {
  const compteurs = plan.calques.flatMap((c) =>
    c.type === "compteur" && c.de !== c.a ? [{ debut: c.debut, fin: Math.min(c.fin, c.debut + (c.dureeDefilement ?? DEFILEMENT_COMPTEUR_DEFAUT_SEC) * DEFILEMENT_COMPTEUR_VIF) }] : [],
  );
  return [...plan.fenetres.filter((f) => f.video), ...plan.cartes, ...compteurs];
}

/** Ce qui couvre l'image (cartes, et fenêtres selon la règle) : de simples intervalles. */
export interface Couverture {
  cartes: readonly { debut: number; fin: number }[];
}

/** Temps hors des intervalles couverts sur [a, b]. */
function horsCartes(plan: Couverture, a: number, b: number): number {
  let t = Math.max(0, b - a);
  const iv = plan.cartes.map((c) => [Math.max(a, c.debut), Math.min(b, c.fin)] as const).filter(([x, y]) => y > x).sort((x, y) => x[0] - y[0]);
  let fin = a;
  for (const [x, y] of iv) {
    const debut = Math.max(x, fin);
    if (y > debut) t -= y - debut;
    fin = Math.max(fin, y);
  }
  return t;
}

/**
 * Silences d'un genre d'événement HORS CARTES : entre deux de ces événements posés hors cartes (et depuis 0 / jusqu'à
 * l'horizon), le temps passé hors cartes : [durée hors cartes, début, fin].
 */
export function silencesHorsCartes(plan: Couverture, horizon: number, instants: readonly number[]): [number, number, number][] {
  const dansCarte = (t: number) => plan.cartes.some((c) => t >= c.debut - EPS && t <= c.fin + EPS);
  const points = [0, ...instants.filter((t) => t >= 0 && t <= horizon && !dansCarte(t)), horizon].sort((x, y) => x - y);
  const r: [number, number, number][] = [];
  for (let i = 1; i < points.length; i++) r.push([horsCartes(plan, points[i - 1], points[i]), points[i - 1], points[i]]);
  return r;
}

/**
 * Silences de CALQUES quand le visage est seul : dans chaque moment continu sans carte ni fenêtre, le plus long écart
 * entre son début, les entrées de calques et sa fin : [durée, début, fin]. La sortie d'une carte ou d'une fenêtre est
 * elle-même un gros mouvement : le compte repart de zéro à chaque moment libre.
 */
export function silencesDeCalques(plan: Pick<PlanFacecamAnimee, "cartes" | "fenetres" | "calques"> & { motions?: readonly MotionPlan[] }, horizon: number): [number, number, number][] {
  const objets = [...plan.cartes, ...plan.fenetres].map((o) => [Math.max(0, o.debut), Math.min(horizon, o.fin)] as const).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const libres: [number, number][] = [];
  let t = 0;
  for (const [a, b] of objets) {
    if (a > t + EPS) libres.push([t, a]);
    t = Math.max(t, b);
  }
  if (horizon > t + EPS) libres.push([t, horizon]);
  const r: [number, number, number][] = [];
  for (const [a, b] of libres) {
    // Une motion (15/10) fait vivre le visage comme un calque.
    const pts = [a, ...[...plan.calques, ...(plan.motions ?? [])].map((c) => c.debut).filter((x) => x > a + EPS && x < b - EPS), b].sort((x, y) => x - y);
    for (let i = 1; i < pts.length; i++) r.push([pts[i] - pts[i - 1], pts[i - 1], pts[i]]);
  }
  return r;
}

/* ---------------- Littéralité, fenêtres, cadrage ---------------- */

/** Forme comparable d'un mot porteur (sans accents, élision ni pluriel, 6 lettres au plus) ; null pour un mot-outil. */
export function racine(w: string): string | null {
  if (estMotOutil(w)) return null;
  const n = simplifier(sansElision(nettoyer(w)));
  if (n.length < 3 && !/\d/.test(n)) return null;
  return n.replace(/(s|x)$/, "").slice(0, 6);
}

/** Racines des mots porteurs d'un texte (« Relances à la main » → relanc, main). */
export function racinesDe(texte: string): string[] {
  return texte
    .split(/[\s.,;:!?…«»"“”()/]+/)
    .map(racine)
    .filter((x): x is string => !!x);
}

/** Cadrage effectif d'une fenêtre (absent : « sur-le-visage », le défaut du plan). */
export const cadrageDe = (f: Pick<FenetrePlan, "cadrage">) => f.cadrage ?? CADRAGE_FENETRE_DEFAUT;

/** Un changement de cadrage (zoom coupé ou mouvement). */
export interface Coupe {
  debut: number;
  fin: number;
  echelle: number;
  nom: string;
  mouvement?: string;
}

/** Changements de cadrage (zooms coupés et mouvements) triés dans le temps. */
export function coupesDuPlan(plan: Pick<PlanFacecamAnimee, "zooms" | "mouvements">): Coupe[] {
  return [
    ...plan.zooms.map(([debut, fin, echelle], i): Coupe => ({ debut, fin, echelle, nom: `zoom ${i + 1}` })),
    ...(plan.mouvements ?? []).map((m, i): Coupe => ({ debut: m.debut, fin: m.fin, echelle: m.echelle, nom: `mouvement ${i + 1} (${m.type})`, mouvement: m.type })),
  ].sort((x, y) => x.debut - y.debut);
}

/** Signature du premier objet du plan (genre + type) : « carte:liste », « fenetre:video », « calque:etiquette »… */
export function premierObjet(plan: Pick<PlanFacecamAnimee, "cartes" | "fenetres" | "calques"> & { motions?: readonly MotionPlan[] }): string | null {
  const tous = [
    ...plan.cartes.map((c) => ({ debut: c.debut, sig: `carte:${c.contenu.type}` })),
    ...plan.fenetres.map((f) => ({ debut: f.debut, sig: `fenetre:${f.video ? "video" : "photo"}` })),
    ...plan.calques.map((c) => ({ debut: c.debut, sig: `calque:${c.type}` })),
    ...(plan.motions ?? []).map((m) => ({ debut: m.debut, sig: `motion:${m.famille}` })),
  ].sort((x, y) => x.debut - y.debut);
  return tous[0]?.sig ?? null;
}

/**
 * Ce qu'un plan laisse dans l'historique (anti-répétition des 5 vidéos suivantes) : types, entrées, recherches, ouverture,
 * et depuis le 15/10 la suite des FAMILLES et les comptes par famille et par type (R7, `historique-motion.json`).
 */
export function historiqueDuPlan(plan: Pick<PlanFacecamAnimee, "cartes" | "fenetres" | "calques"> & { motions?: readonly MotionPlan[]; elementsV2?: PlanFacecamAnimee["elementsV2"]; elementsV3?: PlanFacecamAnimee["elementsV3"]; elementsV4?: PlanFacecamAnimee["elementsV4"]; duree?: number }, titre?: string): HistoriqueVideo {
  const cartes = [...plan.cartes].sort((x, y) => x.debut - y.debut);
  const premier = premierObjet(plan);
  const apparitions = apparitionsDuPlan(plan);
  const comptes = (cle: (a: Apparition) => string) => apparitions.reduce<Record<string, number>>((r, a) => ((r[cle(a)] = (r[cle(a)] ?? 0) + 1), r), {});
  return {
    ...(titre ? { titre } : {}),
    types: cartes.map((c) => c.contenu.type),
    entrees: cartes.map((c) => c.entree),
    recherches: [...plan.fenetres].sort((x, y) => x.debut - y.debut).map((f) => f.recherche),
    ...(premier ? { premier } : {}),
    familles: apparitions.map((a) => a.famille),
    debutsFamilles: apparitions.map((a) => arrondi(a.debut, 2)),
    comptesFamilles: comptes((a) => a.famille),
    comptesTypes: comptes((a) => `${a.famille}:${a.type}`),
    ...(plan.duree !== undefined ? { duree: plan.duree } : {}),
    ...historiqueV2(plan.elementsV2),
    ...historiqueV3(plan.elementsV3),
    ...(plan.elementsV4?.length ? historiqueV4(plan.elementsV4) : {}),
  };
}

/**
 * Textes d'une carte qui ne comptent pas dans la recopie : le titre (le nom de la chose), la DEMANDE tapée d'une carte
 * chat (référence, exemple 4 : la demande reprend les choses dites, une puce par chose) et le MOT-CLÉ tapé d'une carte
 * commentaire (dit par Will).
 */
const TEXTES_HORS_RECOPIE = new Set(["titre", "contenu.message.texte", "contenu.saisie.texte"]);

/**
 * Un texte de carte est un BOUT DE PHRASE (« Soirées sur les devis », « Relances à la main », « Chiffres trop tard »)
 * dès 3 mots ; 1 ou 2 mots, c'est le NOM d'une chose (« Devis », « Compte rendu », « Bonne fuite »), exactement ce que la
 * consigne demande (un nom par élément, une puce par chose dite : référence, exemple 4). Seuls les bouts de phrase
 * comptent dans la recopie : sinon la carte modèle de la référence (« scripts, emails, pages de vente » → 3 puces) serait
 * refusée (passe 2 : sur la vidéo 2, la carte « Bilan » jugée littérale par l'architecte ressortait à 100 %).
 */
export const estBoutDePhrase = (texte: string) => texte.trim().split(/[\s/]+/).filter((w) => /[\p{L}\d]/u.test(w)).length >= SEUILS.copieMotsParBoutMin;

/**
 * Part des mots porteurs DITS pendant une carte (TOUS les types) qui se retrouvent dans ses BOUTS DE PHRASE (textes de
 * 3 mots ou plus ; titre, demande d'un chat et mot-clé d'un commentaire exclus) ; null quand moins de 4 mots porteurs
 * sont dits.
 */
export function copieCarte(c: CartePlan, mots: readonly MotTranscrit[]): { part: number; copies: number; dits: number } | null {
  const dits = new Set(mots.filter((m) => m.a >= c.debut - EPS && m.a <= c.fin + EPS).flatMap((m) => racinesDe(m.w)));
  if (dits.size < SEUILS.copieMotsDitsMin) return null;
  const o = objetCarte(c, 0);
  const affichees = new Set(o.textes.filter((t) => !TEXTES_HORS_RECOPIE.has(t.chemin) && estBoutDePhrase(t.texte)).flatMap((t) => racinesDe(t.texte)));
  const copies = [...dits].filter((r) => affichees.has(r)).length;
  return { part: copies / dits.size, copies, dits: dits.size };
}

/* ---------------- Littéralité des fenêtres : métaphores, personnes, actions ---------------- */

/** Mots d'un texte, minuscules sans accents ni élision, coupés aux traits d'union (« s'échappe » → « echappe »). */
export function motsSimples(texte: string): string[] {
  return texte
    .split(/[\s.,;:!?…«»"“”()/]+/)
    .map((w) => simplifier(sansElision(nettoyer(w))))
    .flatMap((w) => w.split(/[-'’]/))
    .filter(Boolean);
}

/**
 * Objets-MÉTAPHORES (diagnostic du 14/10 : horloge pour « le temps qui s'échappe », goutte pour « colmater », sablier
 * pour « du temps vous échappe ») : interdits dans la recherche d'une fenêtre SAUF si l'un des mots `dits` est prononcé
 * pendant la fenêtre (entre 2 s avant et 1 s après).
 */
export const METAPHORES: readonly { objet: string; montre: RegExp; dits: RegExp }[] = Object.freeze([
  { objet: "horloge", montre: /^(horloges?|pendules?|reveils?|chronometres?|chronos?|minuteurs?|cadrans?|trotteuses?)$/, dits: /^(horloges?|pendules?|reveils?|chronometres?|chronos?|minuteurs?)$/ },
  { objet: "sablier", montre: /^sabliers?$/, dits: /^sabliers?$/ },
  { objet: "goutte ou robinet", montre: /^(gouttes?|robinets?|fuites?|fuit|fuient|tuyaux?|tuyauteries?)$/, dits: /^(gouttes?|robinets?|fuites?|fuit|fuient|tuyaux?|plombiers?|plomberie)$/ },
  { objet: "ampoule", montre: /^ampoules?$/, dits: /^(ampoules?|lampes?)$/ },
  { objet: "puzzle", montre: /^puzzles?$/, dits: /^puzzles?$/ },
  { objet: "engrenage", montre: /^(engrenages?|rouages?)$/, dits: /^(engrenages?|rouages?)$/ },
  { objet: "boussole", montre: /^boussoles?$/, dits: /^boussoles?$/ },
  { objet: "cible", montre: /^(cibles?|flechettes?)$/, dits: /^(cibles?|flechettes?)$/ },
  { objet: "échiquier", montre: /^(echiquiers?|echecs|pions?)$/, dits: /^(echiquiers?|echecs|pions?)$/ },
  { objet: "labyrinthe", montre: /^labyrinthes?$/, dits: /^labyrinthes?$/ },
  { objet: "iceberg", montre: /^icebergs?$/, dits: /^icebergs?$/ },
  { objet: "fusée", montre: /^fusees?$/, dits: /^fusees?$/ },
  { objet: "phare", montre: /^phares?$/, dits: /^phares?$/ },
  { objet: "montagne", montre: /^(montagnes?|sommets?|alpinistes?)$/, dits: /^(montagnes?|sommets?|alpinistes?)$/ },
  { objet: "escalier", montre: /^(escaliers?|echelles?)$/, dits: /^(escaliers?|echelles?)$/ },
  { objet: "tempête", montre: /^(tempetes?|orages?|eclairs?)$/, dits: /^(tempetes?|orages?)$/ },
  { objet: "flamme", montre: /^(flammes?|incendies?|extincteurs?)$/, dits: /^(flammes?|incendies?|feu|feux)$/ },
  { objet: "bouée", montre: /^(bouees?|ancres?|naufrages?)$/, dits: /^(bouees?|ancres?|naufrages?)$/ },
  { objet: "balance", montre: /^balances?$/, dits: /^(balances?|peser|pese)$/ },
  { objet: "loupe", montre: /^loupes?$/, dits: /^loupes?$/ },
  { objet: "cadenas", montre: /^(cadenas|cles?|clefs?|serrures?)$/, dits: /^(cadenas|cles?|clefs?|serrures?)$/ },
  { objet: "tirelire", montre: /^tirelires?$/, dits: /^tirelires?$/ },
  { objet: "graine", montre: /^(graines?|semis|bourgeons?)$/, dits: /^(graines?|semer|semis)$/ },
  { objet: "menottes", montre: /^(menottes?|boulets?)$/, dits: /^(menottes?|boulets?)$/ },
  { objet: "hamster", montre: /^hamsters?$/, dits: /^hamsters?$/ },
]);

/** Villes (la carte de France n'en nomme jamais : Axion-IA travaille partout en France). */
export const VILLES = /^(paris|lyon|marseille|villeexemple|toulouse|lille|bordeaux|nantes|nice|strasbourg|montpellier|rennes|reims|toulon|dijon|angers|nimes|annecy|chambery|valence|clermont|tours|metz|nancy|rouen|caen|brest|limoges|amiens|perpignan|besancon|orleans|mulhouse)$/;

/** Les métaphores d'une recherche dont aucun mot déclencheur n'est dit (`dits` : mots prononcés, déjà simplifiés). */
export function metaphoresDe(recherche: string, dits: readonly string[]): string[] {
  const montres = motsSimples(recherche);
  return METAPHORES.filter((m) => montres.some((w) => m.montre.test(w)) && !dits.some((w) => m.dits.test(w))).map((m) => m.objet);
}

/** Personnes NOMMÉES dans une phrase (« un dirigeant qui… », « les équipes »). */
export const PERSONNES_DITES =
  /^(dirigeant|dirigeante|patron|patronne|gerant|gerante|salarie|salariee|employe|employee|equipe|collaborateur|collaboratrice|client|cliente|prospect|commercial|commerciale|commerciaux|comptable|secretaire|assistant|assistante|artisan|manager|recrue|candidat|candidate|stagiaire|formateur|formatrice|apprenant|apprenante|associe|associee|personne|gens|famille|enfant|femme|homme|collegue|technicien|technicienne|vendeur|vendeuse|livreur|livreuse|chef|directeur|directrice|responsable|entrepreneur|entrepreneuse|fondateur|fondatrice|consultant|consultante|utilisateur|utilisatrice|ouvrier|ouvriere|medecin|avocat|avocate|infirmier|infirmiere|conseiller|conseillere|independant|independante|freelance|personnel|fournisseur|partenaire|eleve|etudiant|etudiante|enseignant|enseignante|plombier|electricien|boulanger|coiffeur|coiffeuse|agriculteur|agricultrice)s?$/;
/** Ce qui MONTRE une personne dans une recherche : les mêmes, plus des mains, une silhouette, quelqu'un. */
export const PERSONNES_MONTREES = new RegExp(`${PERSONNES_DITES.source}|^(mains?|silhouettes?|quelqu|quelquun|gens|groupe|groupes)$`);

/**
 * ACTIONS concrètes : quand « illustre » contient un verbe `dit`, la recherche contient un mot `montre` de la même action
 * (diagnostic : « un dirigeant qui voulait recruter » illustré par « papiers administratifs » = refusé).
 */
export const ACTIONS_CONCRETES: readonly { action: string; dit: RegExp; montre: RegExp; exemple: string; strict?: boolean }[] = Object.freeze([
  // STRICTES (passe 3, revue du 15/10) : ni une autre chose de la phrase ni la personne seule ne suffisent, la scène
  // montre CETTE action (« trouver la fuite » ≠ un clavier ou un tableau blanc ; « leur après-midi » = des gens qui
  // partent ou profitent, pas des mains et des cartes).
  { action: "chercher", strict: true, dit: /^(trouv(e|es|ent|er|ez|ons|ait|aient)|cherch\w*|identifi\w*|repere\w*|reper(er|ez|ons)|detect\w*|diagnostiqu\w*|debusqu\w*|traqu\w*)$/, montre: /^(cherch\w*|trouv\w*|identifi\w*|repere\w*|reper(er|ez|ons|ent)|detect\w*|diagnostiqu\w*|inspect\w*|examin\w*|analys\w*|verifi\w*|fouill\w*|audit\w*|epluch\w*|controle\w*|scrut\w*|debusqu\w*|traqu\w*)$/, exemple: "consultant qui examine les comptes avec le dirigeant au bureau" },
  { action: "profiter de son temps libre", strict: true, dit: /^(midi|week|weekend|vacances|conges?|loisirs?|libres?|repos)$/, montre: /^(part|partent|partir|parti|partis|quitt\w*|sort(ent|ir|ie|ies)?|rentr\w*|profit\w*|familles?|enfants?|parcs?|plages?|balad\w*|promen\w*|jardin\w*|vacances|loisirs?|terrasses?|velos?|randonn\w*|repos\w*|detend\w*|amis|repas|dejeun\w*|mang\w*|pique|nique|piscines?|sport\w*|courent|courir)$/, exemple: "salariés qui quittent le bureau en riant l'après-midi" },
  { action: "recruter", dit: /^(recrut\w*|embauch\w*)$/, montre: /^(recrut\w*|embauch\w*|entretiens?|candidats?|candidates?|cv)$/, exemple: "dirigeant qui fait passer un entretien d'embauche" },
  { action: "appeler", dit: /^(appel|appels|appeler|appelle|appellent|appelez|appelons|appelait|appele|rappel\w*|telephon\w*)$/, montre: /^(appel\w*|appell\w*|rappel\w*|telephon\w*|smartphones?|combines?|casque)$/, exemple: "artisan qui répond au téléphone dans son atelier" },
  { action: "écrire", dit: /^(ecri\w*|tap(e|es|ent|er|ez|ons|ait|aient|ee|ees)|redig\w*|saisi\w*)$/, montre: /^(ecri\w*|tap\w*|redig\w*|saisi\w*|claviers?|stylos?)$/, exemple: "mains qui tapent un texte sur un clavier au bureau" },
  { action: "signer", dit: /^sign(e|es|ent|er|ez|ons|ait|ee|ees|ature|atures)$/, montre: /^(sign\w*|contrats?|stylos?)$/, exemple: "dirigeant qui signe un contrat sur son bureau" },
  { action: "livrer", dit: /^(livr(e|es|ent|er|ez|ons|ait|ee|ees|aison|aisons)|expedi\w*|colis)$/, montre: /^(livr\w*|expedi\w*|colis|cartons?|camions?|camionnettes?)$/, exemple: "livreur qui dépose un colis devant une boutique" },
  { action: "former", dit: /^form(e|es|ent|er|ez|ons|ait|ee|ees|ation|ations|ateur|ateurs|atrice)$/, montre: /^(form\w*|cours|ateliers?|apprenants?|stagiaires?|enseign\w*|apprend\w*)$/, exemple: "formateur qui explique à un groupe de salariés en salle" },
  { action: "se réunir", dit: /^(reuni\w*|reunion\w*)$/, montre: /^(reuni\w*|reunion\w*)$/, exemple: "équipe en réunion autour d'une table" },
  { action: "facturer", dit: /^(factur\w*|encaiss\w*|pay(e|es|ent|er|ez|ons)|paie|paient)$/, montre: /^(factur\w*|encaiss\w*|pai\w*|pay\w*|caisses?|terminal|billets?)$/, exemple: "commerçant qui encaisse un client à la caisse" },
  { action: "relancer", dit: /^relanc\w*$/, montre: /^(relanc\w*|appel\w*|appell\w*|telephon\w*|mails?|emails?|courriels?|ecri\w*|tap\w*)$/, exemple: "commerciale qui relance un client au téléphone" },
  { action: "vendre", dit: /^(vend(re|s|ons|ez|ent|u|ue|us|ues|ait)|ventes?|vendeur\w*|vendeuse\w*)$/, montre: /^(vend\w*|ventes?|clients?|clientes?|boutiques?|magasins?|comptoirs?|caisses?)$/, exemple: "vendeuse qui conseille une cliente en boutique" },
  { action: "négocier", dit: /^negoci\w*$/, montre: /^(negoci\w*|poignees?|contrats?|reunion\w*)$/, exemple: "deux dirigeants qui négocient autour d'une table" },
  { action: "planifier", dit: /^planifi\w*$/, montre: /^(planifi\w*|plannings?|agendas?|calendriers?)$/, exemple: "personne qui remplit un planning mural" },
  { action: "conduire", dit: /^(condui\w*|deplac\w*)$/, montre: /^(condui\w*|deplac\w*|voitures?|camions?|routes?|volant|trains?)$/, exemple: "artisan qui conduit sa camionnette vers un chantier" },
  { action: "calculer", dit: /^calcul\w*$/, montre: /^(calcul\w*|calculatrices?|tableurs?|chiffres?|comptab\w*)$/, exemple: "comptable qui calcule sur un tableur" },
  { action: "répondre", dit: /^repond\w*$/, montre: /^(repond\w*|appel\w*|appell\w*|telephon\w*|mails?|emails?|messages?|claviers?|tap\w*|ecri\w*)$/, exemple: "assistante qui répond aux mails sur un ordinateur" },
  { action: "imprimer", dit: /^imprim\w*$/, montre: /^imprim\w*$/, exemple: "personne qui récupère des feuilles à l'imprimante" },
  { action: "classer", dit: /^(class(e|es|ent|er|ez|ons|ait|ee|ees)|archiv\w*|rang(e|es|ent|er|ez|eons|eait))$/, montre: /^(class\w*|archiv\w*|rang\w*|dossiers?|classeurs?|etageres?|armoires?)$/, exemple: "secrétaire qui range des dossiers dans une armoire" },
  { action: "programmer", dit: /^(programm\w*|cod(e|es|ent|er|ez|ons))$/, montre: /^(programm\w*|cod\w*|developp\w*|claviers?)$/, exemple: "développeur qui tape du code sur deux écrans" },
  { action: "fabriquer", dit: /^(fabriqu\w*|produi(re|s|t|sent|sez|sons))$/, montre: /^(fabriqu\w*|produ\w*|ateliers?|usines?|machines?|ouvriers?|ouvrieres?)$/, exemple: "ouvrier qui assemble une pièce dans un atelier" },
  { action: "réparer", dit: /^repar(e|es|ent|er|ez|ons|ait|ation|ations)$/, montre: /^(repar\w*|outils?|ateliers?|techniciens?|mecanicien\w*)$/, exemple: "technicien qui répare une machine dans un atelier" },
  { action: "accompagner", dit: /^(accompagn\w*|coach\w*)$/, montre: /^(accompagn\w*|coach\w*|conseil\w*|consultants?|consultantes?|formateurs?|formatrices?|expliqu\w*|entretiens?|reunion\w*)$/, exemple: "consultant qui explique un tableau à un dirigeant" },
  { action: "auditer", dit: /^(audit\w*|analys\w*)$/, montre: /^(audit\w*|analys\w*|tableaux?|graphiques?|ecrans?|documents?|dossiers?|chiffres?)$/, exemple: "consultant qui analyse des graphiques sur un écran" },
  { action: "automatiser", dit: /^automatis\w*$/, montre: /^(automat\w*|robots?|machines?|logiciels?|ecrans?)$/, exemple: "écran d'un logiciel qui remplit un tableau tout seul" },
  { action: "regarder", dit: /^regard(e|es|ent|er|ez|ons|ait|aient|ee|ees)$/, montre: /^(regard\w*|ecrans?|tableaux?|ordinateurs?|consult\w*|examin\w*|observ\w*|lit|lisent)$/, exemple: "dirigeant qui regarde un tableau de bord sur son ordinateur" },
]);

export interface ExigenceScene {
  /** « personne » ou le nom de l'action. */
  quoi: string;
  /** Le mot de « illustre » qui l'exige. */
  mot: string;
  exemple: string;
}

/** Ce que la recherche d'une fenêtre doit montrer et ne montre pas : une personne nommée, une action nommée. */
export function exigencesScene(illustre: string, recherche: string): ExigenceScene[] {
  const dits = motsSimples(illustre);
  const montres = motsSimples(recherche);
  const manque: ExigenceScene[] = [];
  const personne = dits.find((w) => PERSONNES_DITES.test(w));
  if (personne && !montres.some((w) => PERSONNES_MONTREES.test(w))) manque.push({ quoi: "personne", mot: personne, exemple: `${personne} qui…` });
  // Plusieurs actions dites (« on audite et on automatise ») : la fenêtre en montre AU MOINS UNE, ou une autre CHOSE
  // nommée (« un outil de plus, une embauche de plus » → l'outil). Une personne seule ne suffit pas (« un dirigeant qui
  // voulait recruter » → « dirigeant à son bureau » est refusé).
  const toutes = ACTIONS_CONCRETES.map((a) => ({ a, mot: dits.find((w) => a.dit.test(w)) })).filter((x): x is { a: (typeof ACTIONS_CONCRETES)[number]; mot: string } => !!x.mot);
  // Actions STRICTES : la scène montre CETTE action, rien d'autre ne la remplace.
  for (const { a, mot } of toutes) if (a.strict && !montres.some((w) => a.montre.test(w))) manque.push({ quoi: a.action, mot, exemple: a.exemple });
  const nommees = toutes.filter(({ a }) => !a.strict);
  const porteur = (w: string) => w.length >= 3 && !estMotOutil(w) && !PERSONNES_MONTREES.test(w) && !toutes.some(({ a }) => a.dit.test(w));
  const chosesDites = new Set(dits.filter(porteur).map((w) => w.slice(0, 4)));
  // La personne COMPLÉMENT de l'action (« embaucher deux secrétaires ») est une chose montrée ; le SUJET (« un dirigeant
  // qui voulait recruter ») ne l'est pas.
  const premiereAction = dits.findIndex((w) => nommees.some(({ a }) => a.dit.test(w)));
  const complements = new Set(premiereAction < 0 ? [] : dits.slice(premiereAction + 1).filter((w) => PERSONNES_DITES.test(w)).map((w) => w.slice(0, 4)));
  const montreUneChose = montres.some((w) => (porteur(w) && chosesDites.has(w.slice(0, 4))) || (PERSONNES_DITES.test(w) && complements.has(w.slice(0, 4))));
  if (nommees.length && !montreUneChose && !nommees.some(({ a }) => montres.some((w) => a.montre.test(w)))) {
    const { a, mot } = nommees[0];
    manque.push({ quoi: a.action, mot, exemple: a.exemple });
  }
  return manque;
}

/**
 * Verbes qui ne se FILMENT pas (passe 3 : « dirigeant qui sent le temps lui échapper ») : sentir, penser, rêver,
 * comprendre… Une scène dit ce que la personne FAIT, de façon visible.
 */
export const ACTIONS_INVISIBLES = /^(sent|sentent|sentir|ressen\w*|pense|pensent|penser|reflechi\w*|imagin\w*|reve|revent|rever|comprend\w*|realise|realisent|decouvre|decouvrent|espere|esperent|souhait\w*|veut|veulent|voulait|desire|desirent|subit|subissent|vit|vivent|perd|perdent|craint|craignent|doute|doutent|ennui\w*|stresse|stressent|angoiss\w*|apprecie|aime|aiment|sait|savent|croit|croient|regrette|regrettent)$/;
/** Mots qui suivent « qui » sans être le verbe (pronoms, négation). */
const AVANT_VERBE = /^(se|s|ne|n|lui|leur|les|le|la|l|y|me|m|te|t|nous|vous)$/;
/** Lieux (« où ») : préposition de lieu suivie d'un mot, ou nom de lieu. */
const PREPOSITIONS_LIEU = /^(dans|sur|au|aux|a|en|devant|chez|autour|derriere|sous|pres|face|depuis|entre)$/;
const NOMS_LIEU = /^(bureaux?|ateliers?|chantiers?|cuisines?|boutiques?|magasins?|entrepots?|usines?|salles?|parcs?|maisons?|voitures?|camions?|camionnettes?|routes?|rues?|plages?|jardins?|terrasses?|restaurants?|cafes?|caisses?|comptoirs?|open|space|cabinets?|garages?|hangars?|fermes?|champs?|ecoles?|hopitaux|hopital|domicile|salon|exterieur|ville|quai)$/;
/** Activités nommées après « au / à / pendant » (« au téléphone », « à la pause »). */
const NOMS_ACTIVITE = /^(telephone|reunion|entretien|visio|travail|rendez|formation|cours|repas|dejeuner|pause|promenade|balade|livraison|signature|inspection|appel|volant|guichet|comptoir|caisse|sport|jeu)$/;
/** Participe en « -ant » qui n'est pas une action (« dirigeant », « restaurant »…). */
const NON_PARTICIPES = /^(enfant|restaurant|important|avant|devant|pendant|commercant|gerant|etudiant|consultant|participant|habitant|dirigeant|apprenant|independant|fabricant|suivant|courant|instant|garant|elegant|maintenant|cependant|durant|montant|clignotant|volant|ant|cant|tant|quant|savant|vivant|marchand)s?$/;

/** La scène d'une recherche : qui FAIT QUOI (action visible), OÙ. */
export interface Scene {
  /** L'action visible trouvée (« charge », « en réunion »…), ou null. */
  action: string | null;
  /** Un verbe qui ne se filme pas, placé comme action (« sent », « pense »…), ou null. */
  invisible: string | null;
  /** Le lieu trouvé, ou null. */
  lieu: string | null;
}

/** Lit dans une recherche « qui fait quoi, où » (sujet + action visible + lieu). */
export function sceneDe(recherche: string): Scene {
  const w = motsSimples(recherche);
  let action: string | null = null;
  let invisible: string | null = null;
  const qui = w.indexOf("qui");
  if (qui >= 0) {
    let k = qui + 1;
    while (k < w.length && AVANT_VERBE.test(w[k])) k++;
    const verbe = w[k];
    if (verbe && ACTIONS_INVISIBLES.test(verbe)) invisible = verbe;
    else if (verbe) action = verbe;
  }
  if (!action && !invisible) {
    const en = w.findIndex((x, i) => x === "en" && i + 1 < w.length && !estMotOutil(w[i + 1]));
    if (en >= 0) action = `en ${w[en + 1]}`;
  }
  if (!action && !invisible) {
    // « artisan au téléphone », « équipe à la pause » : une activité nommée ; sinon un participe (« client souriant » non).
    const k = w.findIndex((x, i) => i > 0 && /^(au|aux|a|pendant|lors)$/.test(w[i - 1]) && NOMS_ACTIVITE.test(x));
    action = k >= 0 ? `${w[k - 1]} ${w[k]}` : (w.find((x) => x.length > 5 && /ant$/.test(x) && !NON_PARTICIPES.test(x)) ?? null);
  }
  if (!invisible) invisible = w.find((x, i) => i > 0 && ACTIONS_INVISIBLES.test(x) && !action) ?? null;
  const p = w.findIndex((x, i) => PREPOSITIONS_LIEU.test(x) && i + 1 < w.length && w.slice(i + 1).some((y) => y.length >= 3 && !estMotOutil(y)));
  const lieu = w.find((x) => NOMS_LIEU.test(x)) ?? (p >= 0 ? w.slice(p).join(" ") : null);
  return { action, invisible, lieu };
}

/**
 * GRILLES : chaque vignette montre la chose DITE (passe 3 : la grille « Accompagnement IA » n'avait que des fiches
 * grises presque vides). Rend les défauts d'une vignette : légende jamais dite au moment où elle surgit, pictogramme
 * générique (montagne et soleil, écran vide) sans rapport avec la chose dite, fiche sans icône (des lignes grises).
 */
export const LEGENDES_IMAGE = /^(images?|photos?|visuels?|affiches?|pubs?|publicites?|illustrations?|dessins?|logos?|banni\w*|flyers?|posts?|stories|story|carrousels?|miniatures?|portraits?)$/;
export const LEGENDES_ECRAN = /^(ecrans?|logiciels?|sites?|applis?|applications?|maquettes?|tableaux?|outils?|ordinateurs?|plateformes?|crm|erp|interfaces?|dashboards?|mails?|emails?|messageries?|pages?|landing|tableurs?|excel|agendas?|automatisations?|automatis\w*|ia|chatgpt|claude|videos?|visio)$/;
export function defautsVignettes(c: CartePlan, mots: readonly MotTranscrit[]): string[] {
  if (c.contenu.type !== "grille") return [];
  const defauts: string[] = [];
  const cle = (t: string) => motsSimples(t).filter((x) => x.length >= 2 && !estMotOutil(x)).map((x) => x.slice(0, 4));
  c.contenu.vignettes.forEach((vg, k) => {
    const nom = `vignette ${k + 1} « ${vg.legende} »`;
    const legende = motsSimples(vg.legende);
    const dits = new Set(mots.filter((m) => m.a >= vg.a - SEUILS.motCleAvantEntreeSec - EPS && m.a <= vg.a + SEUILS.motCleApresEntreeSec + 0.2 + EPS).flatMap((m) => cle(m.w)));
    if (!cle(vg.legende).some((x) => dits.has(x))) defauts.push(`${nom} surgit à ${sec(vg.a)} sans que sa chose soit dite juste avant (une vignette = UNE chose dite, sur son mot)`);
    const ct = vg.contenu;
    const parle = (re: RegExp) => legende.some((x) => re.test(x)) || motsSimples(c.titre).some((x) => re.test(x));
    if (ct.type === "image" && !parle(LEGENDES_IMAGE)) defauts.push(`${nom} : pictogramme « image » générique (montagne et soleil) qui ne montre pas « ${vg.legende} » ; mettez une fiche avec l'icône de la chose, ou un texte (titre court)`);
    if (ct.type === "ecran" && !parle(LEGENDES_ECRAN)) defauts.push(`${nom} : maquette d'écran générique pour une chose qui n'est pas un écran ni un logiciel ; mettez une fiche avec l'icône de la chose, ou un texte (titre court)`);
    if (ct.type === "fiche" && !ct.icone) defauts.push(`${nom} : fiche sans icône (des lignes grises vides) ; donnez l'icône de la chose dite (« icone » et « iconeA » sur son mot)`);
  });
  return defauts;
}

/**
 * Un mot de la carte (titre ou contenu) est-il dit juste avant son entrée ? Rend le premier mot trouvé, ou null.
 * Comparaison par les 4 premières lettres des mots porteurs (« soirées » ≈ « soir », « IA » compris).
 */
export function motCleAvantEntree(c: CartePlan, mots: readonly MotTranscrit[]): string | null {
  const cles = (t: string) => motsSimples(t).filter((w) => w.length >= 2 && !estMotOutil(w)).map((w) => w.slice(0, 4));
  const o = objetCarte(c, 0);
  const affichees = new Set(o.textes.flatMap((t) => cles(t.texte)));
  const proches = mots.filter((m) => m.a >= c.debut - SEUILS.motCleAvantEntreeSec - EPS && m.a <= c.debut + SEUILS.motCleApresEntreeSec + EPS);
  for (const m of proches) if (cles(m.w).some((k) => affichees.has(k))) return nettoyer(m.w);
  // Énumération numérotée (« Un : … Deux, … ») : la liste ou la frise entre sur le numéro dit.
  if (c.contenu.type === "liste" || c.contenu.type === "frise") {
    const numero = proches.find((m) => ponctuationFinale(m.w) !== null && (/^\d+$/.test(nettoyer(m.w)) || valeurEnLettres(nettoyer(m.w)) !== null));
    if (numero) return nettoyer(numero.w);
  }
  return null;
}

/** Le titre d'une carte est-il une phrase abstraite (virgule, plus de 4 mots, mot de liaison en tête) ? */
export function titreAbstrait(titre: string): boolean {
  const mots = titre.trim().split(/\s+/);
  const tete = simplifier(sansElision(nettoyer(mots[0] ?? "")));
  return /[,;:!?…]/.test(titre) || mots.length > SEUILS.titreMotsMax || TETES_TITRE_ABSTRAIT.includes(tete);
}

/** Une fenêtre est « enchaînée » si elle entre 0 à 0,3 s après la sortie d'une carte, d'une autre fenêtre ou d'une motion. */
export function estEnchainee(plan: Pick<PlanFacecamAnimee, "cartes" | "fenetres"> & { motions?: readonly MotionPlan[] }, f: Pick<FenetrePlan, "debut" | "fin">): boolean {
  return [...plan.cartes, ...plan.fenetres, ...(plan.motions ?? [])].some((o) => o !== f && f.debut - o.fin >= -0.02 && f.debut - o.fin <= SEUILS.fenetres.enchaineeMaxSec + EPS);
}

const mesuresDiversiteVides = (): MesuresDiversite => ({
  apparitions: 0, familles: [], nombreFamilles: 0, famillesNouvelles: 0, partFamilleMax: 0, familleLaPlusUtilisee: null, repetitionMax: 0, memeFamilleDeSuite: 0, famillesMinPar60s: 0, famillesMinPar20s: 0,
  premierObjetSec: null, premiereCouvertureVisageSec: null, premiereCarteSec: null, premierPleinEcranSec: null, partVisageCouvert: 0, partVisageEnPlace: 0, intervalleMoyenSec: 0, plusLongSansEvenementSec: 0, partSonMax: 0, sonLePlusFrequent: null,
});
const mesuresVides = (): MesuresPlan => ({
  ruptures: 0, rupturesParMinute: 0, plusLongTrouSec: 0, grosMouvementsParMinute: 0, trousPrevus: 0, pourcentageBande: 0, typesCartes: [], cartes: 0, fenetres: 0, calques: 0, zooms: 0, mouvements: 0, sousElements: 0,
  fenetresVideo: 0, partFenetresVideo: 0, partSurLeVisage: 0, partFenetresEnchainees: 0, motions: 0, diversite: mesuresDiversiteVides(),
});


/** Mesures du plan (sans contrôle) : ruptures, ruptures/min, plus long trou, % de bande, types, fenêtres, cadrage. */
export function mesurerPlan(plan: PlanFacecamAnimee): MesuresPlan {
  const horizon = Math.min(plan.fin.debut, plan.duree);
  const objets = objetsDuPlan(plan);
  const ruptures = objets.filter((o) => o.debut < horizon).length;
  const r = rythmePrevu(plan);
  const triees = [...plan.cartes].sort((x, y) => x.debut - y.debut);
  const n = plan.fenetres.length;
  const part = (k: number) => (n ? arrondi(k / n, 3) : 0);
  return {
    fenetresVideo: plan.fenetres.filter((f) => f.video).length,
    partFenetresVideo: part(plan.fenetres.filter((f) => f.video).length),
    partSurLeVisage: part(plan.fenetres.filter((f) => cadrageDe(f) === "sur-le-visage").length),
    partFenetresEnchainees: part(plan.fenetres.filter((f) => estEnchainee(plan, f)).length),
    ruptures,
    rupturesParMinute: arrondi((ruptures / Math.max(horizon, EPS)) * 60, 1),
    plusLongTrouSec: r.plusLongTrouSec,
    grosMouvementsParMinute: r.grosParMinute,
    // L'ouverture calme (R1a : sous-titres seuls avant 0,8 s) n'est pas un trou.
    trousPrevus: r.trous.filter(([d, a, z]) => d > SEUILS.trouMaxSec + EPS && !(a < EPS && z <= DIVERSITE.rienAvantSec + 0.15 + EPS)).length,
    pourcentageBande: arrondi((dureeBande(plan) / plan.duree) * 100, 1),
    typesCartes: [...new Set(triees.map((c) => c.contenu.type))],
    cartes: plan.cartes.length,
    fenetres: plan.fenetres.length,
    calques: plan.calques.length,
    zooms: plan.zooms.length,
    mouvements: plan.mouvements?.length ?? 0,
    sousElements: objets.reduce((t, o) => t + o.sous.filter((s) => s.ancre).length, 0),
    motions: plan.motions?.length ?? 0,
    diversite: mesurerDiversite(plan),
  };
}

const arrondi = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

/** Le mot dont le début est le plus proche de `a`. */
function motLePlusProche(mots: readonly MotTranscrit[], a: number): MotTranscrit | null {
  let best: MotTranscrit | null = null;
  for (const m of mots) if (!best || Math.abs(m.a - a) < Math.abs(best.a - a)) best = m;
  return best;
}

function cheminZod(path: readonly PropertyKey[]): string {
  return path.map((p, i) => (typeof p === "number" ? `[${p}]` : `${i ? "." : ""}${String(p)}`)).join("") || "(racine)";
}

/** Vrai si `b` contient la suite `a` (≥ 3 éléments consécutifs identiques). */
function suiteCommune(a: readonly string[], b: readonly string[], n = 3): string[] | null {
  for (let i = 0; i + n <= a.length; i++) {
    const morceau = a.slice(i, i + n);
    for (let j = 0; j + n <= b.length; j++) if (morceau.every((x, k) => b[j + k] === x)) return morceau;
  }
  return null;
}

/** Contrôle complet d'un plan. Ne lève jamais : tout défaut devient un message. */
export function verifierPlan(planBrut: unknown, mots: readonly MotTranscrit[], options: OptionsVerification = {}): ResultatVerification {
  const lu = schemaPlanFacecamAnimee.safeParse(planBrut);
  if (!lu.success) {
    return { erreurs: lu.error.issues.map((i) => `Forme : ${cheminZod(i.path)} — ${i.message}.`), avertissements: [], mesures: mesuresVides(), rendable: false };
  }
  const plan = lu.data;
  // Plan v4 (17/10) : les 26 plaquettes REMPLACENT cartes, fenêtres, calques et motions ; seules les règles v4 (`regles-v4.ts`) le jugent.
  if (plan.elementsV4?.length) {
    const motsV4 = [...mots].sort((x, y) => x.a - y.a);
    const d4 = controlerDiversiteV4(plan, { mots: motsV4, ...(options.interdites?.length ? { interdites: options.interdites } : {}) });
    return { erreurs: d4.erreurs, avertissements: d4.avertissements, mesures: mesuresVides(), rendable: estRendable(d4.erreurs) };
  }
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const objets = objetsDuPlan(plan);
  const horizon = Math.min(plan.fin.debut, plan.duree);
  const dans = (x: number) => x >= -EPS && x <= plan.duree + EPS;
  const motsTries = [...mots].sort((x, y) => x.a - y.a);

  // 1. Instants, ordre, sous-éléments dans leur objet, ancrage, durées.
  for (const o of objets) {
    const Nom = o.nom.charAt(0).toUpperCase() + o.nom.slice(1);
    if (!dans(o.debut) || !dans(o.fin)) erreurs.push(`${Nom} : ${sec(o.debut)} → ${sec(o.fin)} sort de la vidéo (0 à ${sec(plan.duree)}).`);
    if (o.debut >= o.fin) {
      erreurs.push(`${Nom} : le début (${sec(o.debut)}) doit précéder la fin (${sec(o.fin)}).`);
      continue;
    }
    const d = o.fin - o.debut;
    const borne = SEUILS[o.genre];
    if (d < borne.min - EPS || d > borne.max + EPS) erreurs.push(`${Nom} : dure ${sec(d)} ; ${UN_GENRE[o.genre]} dure de ${sec(borne.min)} à ${sec(borne.max)}.`);
    if (o.fin > horizon + 0.05) erreurs.push(`${Nom} : se termine à ${sec(o.fin)}, après le début de l'écran de fin (${sec(horizon)}).`);
    for (const s of o.sous) {
      if (!dans(s.a)) erreurs.push(`${Nom} : ${s.chemin} à ${sec(s.a)} sort de la vidéo.`);
      if (s.a < o.debut - EPS || s.a > o.fin + EPS) erreurs.push(`${Nom} : ${s.chemin} à ${sec(s.a)} tombe hors de l'objet (${sec(o.debut)} → ${sec(o.fin)}).`);
      if (!s.ancre) continue;
      const m = motLePlusProche(motsTries, s.a);
      if (!m || Math.abs(m.a - s.a) > SEUILS.toleranceAncrageSec + EPS) {
        erreurs.push(`${Nom} : ${s.chemin} à ${sec(s.a)} ne tombe sur aucun début de mot${m ? ` (le plus proche : « ${m.w} » à ${sec(m.a)}, écart ${sec(Math.abs(m.a - s.a))})` : ""} ; tolérance ${sec(SEUILS.toleranceAncrageSec)}.`);
      }
    }
  }
  // DÉCISION DE WILL DU 15/10 (« il faut supprimer le zoom car ça bouge trop ») : aucun zoom ni mouvement de cadrage.
  for (const c of coupesDuPlan(plan)) {
    erreurs.push(`${c.nom.charAt(0).toUpperCase() + c.nom.slice(1)} (${sec(c.debut)} → ${sec(c.fin)}) : INTERDIT — Will a décidé le 15/10 de supprimer tout zoom et tout mouvement de cadrage sur sa prise (« ça bouge trop ») ; « zooms » doit rester vide [] et « mouvements » absent. Faites vivre l'image par les animations : un calque (étiquette, tuile, compteur, rangée de logos) sur le mot fort.`);
  }
  if (!dans(plan.fin.debut)) erreurs.push(`Écran de fin : début ${sec(plan.fin.debut)} hors de la vidéo.`);

  // 2. Simultanéités interdites : deux cartes ; une carte et une fenêtre.
  const cartes = objets.filter((o) => o.genre === "carte");
  const fenetres = objets.filter((o) => o.genre === "fenetre");
  const chevauche = (x: ObjetPlan, y: ObjetPlan) => x.debut < y.fin - EPS && y.debut < x.fin - EPS;
  for (let i = 0; i < cartes.length; i++) {
    for (let j = i + 1; j < cartes.length; j++) if (chevauche(cartes[i], cartes[j])) erreurs.push(`${cartes[i].nom} et ${cartes[j].nom} sont à l'écran en même temps (jamais deux cartes à la fois).`);
    for (const f of fenetres) if (chevauche(cartes[i], f)) erreurs.push(`${cartes[i].nom} et ${f.nom} sont à l'écran en même temps (jamais une carte et une fenêtre à la fois).`);
  }
  for (let i = 0; i < fenetres.length; i++) {
    for (let j = i + 1; j < fenetres.length; j++) if (chevauche(fenetres[i], fenetres[j])) erreurs.push(`${fenetres[i].nom} et ${fenetres[j].nom} sont à l'écran en même temps (jamais deux fenêtres à la fois).`);
  }
  // Jamais deux calques à la fois (passe 4, alignement sur le rendu : `sansEtiquettesSuperposees` coupe le premier à
  // l'entrée du second — un compteur coupé n'atteindrait jamais le nombre dit, une étiquette disparaîtrait d'un coup).
  const calquesPlan = [...plan.calques].map((c, i) => ({ c, i })).sort((x, y) => x.c.debut - y.c.debut);
  for (let k = 0; k + 1 < calquesPlan.length; k++) {
    const x = calquesPlan[k], y = calquesPlan[k + 1];
    if (y.c.debut < x.c.fin - EPS) erreurs.push(`Calque ${x.i + 1} (${x.c.type}, ${sec(x.c.debut)} → ${sec(x.c.fin)}) et calque ${y.i + 1} (${y.c.type}, entre à ${sec(y.c.debut)}) sont à l'écran en même temps : jamais deux calques à la fois (le rendu couperait le premier) ; faites sortir le premier avant l'entrée du second.`);
  }
  // Motions (15/10) : une motion est SEULE à l'écran (ni carte, ni fenêtre, ni calque, ni autre motion), sauf le trait
  // dessiné (sur le sous-titre), qui peut accompagner tout objet qui ne couvre pas le visage.
  const motionsObjets = objets.filter((o) => o.genre === "motion");
  const couvre = (o: ObjetPlan) => (o.genre === "fenetre" ? cadrageDe(plan.fenetres[o.index]) === "sur-le-visage" : o.genre === "motion" ? CATALOGUE_FAMILLES[plan.motions![o.index].famille].visage === "couvert" : false);
  const estTrait = (o: ObjetPlan) => o.genre === "motion" && plan.motions![o.index].famille === "trait-dessine";
  for (const m of motionsObjets) {
    for (const o of objets) {
      if (o === m || (o.genre === "motion" && o.index < m.index) || !chevauche(m, o)) continue;
      const toleree = (estTrait(m) && !couvre(o)) || (estTrait(o) && !couvre(m));
      if (!toleree) erreurs.push(`${m.nom.charAt(0).toUpperCase() + m.nom.slice(1)} et ${o.nom} sont à l'écran en même temps : une motion est seule à l'écran (seul le trait dessiné sur le sous-titre peut accompagner un objet qui ne couvre pas le visage).`);
    }
  }

  // 3. Bande. (Un plan v3 REMPLACE cartes, fenêtres, calques et motions : bande, rythme et quotas de l'ancien catalogue ne le concernent pas ;
  // sa cadence est jugée par D11 de `regles-v3.ts`.)
  const v3 = !!plan.elementsV3?.length;
  const mesures = mesurerPlan(plan);
  const b = mesures.pourcentageBande;
  if (!v3 && (b < SEUILS.bande.min - EPS || b > SEUILS.bande.max + EPS)) erreurs.push(`Bande à l'écran ${pct(b)} du temps : il faut entre ${SEUILS.bande.min} et ${SEUILS.bande.max} % (référence 46 %).`);

  // 4. Rythme (énergie).
  const S = SEUILS;
  if (!v3) {
    if (mesures.ruptures * S.secondesParRuptureMax < horizon - EPS) {
      const il = Math.ceil(horizon / S.secondesParRuptureMax - EPS);
      erreurs.push(`Rythme trop lent : ${mesures.ruptures} ruptures fortes (entrées de carte, de fenêtre, de calque) pour ${sec(horizon)} ; il en faut au moins ${il} (une toutes les ${v(S.secondesParRuptureMax)} s en moyenne au pire, visez ${v(S.secondesParRupture)} s ; la référence en a 26 en 80 s).`);
    } else if (mesures.ruptures * S.secondesParRupture < horizon - EPS) {
      const il = Math.ceil(horizon / S.secondesParRupture - EPS);
      avertissements.push(`Rythme un peu lent : ${mesures.ruptures} ruptures fortes pour ${sec(horizon)} ; visez-en ${il} (une toutes les ${v(S.secondesParRupture)} s ; la référence en a 26 en 80 s).`);
    }
    // Rythme compté COMME LA MESURE (revue passe 3) : surface d'écran de chaque événement, pics, gros mouvements, trous.
    const rythme = rythmePrevu(plan);
    for (const [d, a, z] of rythme.trous) {
      if (d <= S.trouMaxSec + EPS) continue;
      // L'ouverture calme est VOULUE (R1a : rien d'autre que les sous-titres avant 0,8 s) : pas un trou.
      if (a < EPS && z <= DIVERSITE.rienAvantSec + 0.15 + EPS) continue;
      const invisibles = [...new Set(rythme.pics.filter((p) => p.t > a + EPS && p.t < z - EPS && p.surface < 1).flatMap((p) => p.quoi).filter((q) => !/sous-titre/.test(q)))];
      erreurs.push(`Trou de ${sec(d)} sans changement VISIBLE entre ${sec(a)} et ${sec(z)} (${sec(S.trouMaxSec)} au plus ; seul ce qui change au moins 1 % de l'image se voit à la mesure)${invisibles.length ? ` : ${invisibles.slice(0, 3).join(", ")} ne se voi${invisibles.length > 1 ? "ent" : "t"} pas` : ""} ; ajoutez sur un mot de ce moment une ENTRÉE ou une SORTIE d'objet (étiquette, tuile, compteur, mini-vidéo) ou un GRAND élément de carte (ligne de liste, étape de frise, case de grille), ou faites sortir l'objet plus tôt.`);
    }
    if (rythme.grosParMinute < S.grosMouvementsParMinuteMin - EPS) {
      erreurs.push(`Énergie trop basse : ${v(rythme.grosParMinute)} gros mouvements par minute prévus (≥ 5 % de l'image, comme la mesure) ; il en faut ${S.grosMouvementsParMinuteMin} au moins (visez ${S.grosMouvementsParMinuteVise} ; référence sans zoom ≈ 84 à 97). Passages les plus calmes : ${passagesCalmes(rythme.pics, plan.duree)}. Ce qui compte : entrée et sortie de carte ou de fenêtre, étiquette au-dessus de la tête SÉPARÉE de l'objet précédent par plus de 0,3 s (la prise descend puis remonte : deux gros mouvements), ligne de liste, étape de frise, case de grille ; une puce, une icône, une coche ou un badge n'en sont pas.`);
    } else if (rythme.grosParMinute < S.grosMouvementsParMinuteVise - EPS) {
      avertissements.push(`Énergie juste : ${v(rythme.grosParMinute)} gros mouvements par minute prévus ; visez ${S.grosMouvementsParMinuteVise} (passages les plus calmes : ${passagesCalmes(rythme.pics, plan.duree)}).`);
    }
    for (const [d, a, z] of silencesDeCalques(plan, horizon)) {
      if (d > S.calqueHorsCartesMaxSec + EPS) erreurs.push(`Aucune apparition (motion, étiquette, compteur…) entre ${sec(a)} et ${sec(z)} (${sec(d)} de visage seul, sans carte ni fenêtre) : une apparition au moins toutes les ${S.calqueHorsCartesMaxSec} s hors cartes et fenêtres (trait dessiné sur le mot fort, horloge, téléphone, bulles, jauge, chiffre qui éclate, étiquette…), d'une autre famille que la précédente.`);
    }
  }

  // 5. Variété et niveaux.
  const triees = [...plan.cartes].map((c, i) => ({ c, i })).sort((x, y) => x.c.debut - y.c.debut);
  for (let k = 1; k < triees.length; k++) {
    const [p, q] = [triees[k - 1], triees[k]];
    if (p.c.contenu.type === q.c.contenu.type) erreurs.push(`Cartes ${p.i + 1} et ${q.i + 1} : même type « ${q.c.contenu.type} » deux fois de suite.`);
    if (p.c.entree === q.c.entree) erreurs.push(`Cartes ${p.i + 1} et ${q.i + 1} : même entrée « ${q.c.entree} » deux fois de suite.`);
  }
  if (plan.duree > 60 && mesures.typesCartes.length < SEUILS.typesMinSiPlusDe60s) {
    erreurs.push(`Seulement ${mesures.typesCartes.length} type${mesures.typesCartes.length > 1 ? "s" : ""} de cartes (${mesures.typesCartes.join(", ") || "aucun"}) : il en faut au moins ${SEUILS.typesMinSiPlusDe60s} pour une vidéo de plus de 60 s.`);
  }
  for (const c of cartes) {
    const Nom = c.nom.charAt(0).toUpperCase() + c.nom.slice(1);
    const instants = c.sous.filter((s) => s.ancre).map((s) => s.a).sort((x, y) => x - y);
    // Jamais de carte vide : le premier sous-élément suit l'entrée de près.
    if (instants.length && instants[0] > c.debut + SEUILS.carteVideMaxSec + EPS) {
      erreurs.push(`${Nom} : reste vide ${sec(instants[0] - c.debut)} après son entrée (${sec(c.debut)}) ; son premier sous-élément doit arriver ${sec(SEUILS.carteVideMaxSec)} au plus après le début.`);
    }
    // Jamais de carte immobile : un sous-élément au moins toutes les 1,5 s.
    for (let k = 1; k < instants.length; k++) {
      const e = instants[k] - instants[k - 1];
      if (e > SEUILS.carteImmobileMaxSec + EPS) erreurs.push(`${Nom} : immobile ${sec(e)} entre deux sous-éléments (${sec(instants[k - 1])} → ${sec(instants[k])}) ; ${sec(SEUILS.carteImmobileMaxSec)} au plus.`);
      else if (e > SEUILS.carteImmobileConseilSec + EPS) avertissements.push(`${Nom} : immobile ${sec(e)} entre deux sous-éléments (${sec(instants[k - 1])} → ${sec(instants[k])}) ; viser ${sec(SEUILS.carteImmobileConseilSec)} au plus.`);
    }
    // Frise : une puce au plus par étape (deux débordent de la carte au rendu).
    const carte = plan.cartes[c.index];
    if (carte.contenu.type === "frise") {
      const parEtape = new Map<number, number>();
      for (const x of carte.contenu.puces ?? []) parEtape.set(x.etape, (parEtape.get(x.etape) ?? 0) + 1);
      for (const [etape, k] of parEtape) if (k > SEUILS.pucesParEtapeMax) erreurs.push(`${Nom} : ${k} puces sur l'étape ${etape + 1} ; ${SEUILS.pucesParEtapeMax} au plus par étape (au-delà, elles débordent de la carte).`);
    }
    const n = c.sous.filter((s) => s.ancre).length;
    if (n < SEUILS.sousElementsMinParCarte) erreurs.push(`${c.nom.charAt(0).toUpperCase() + c.nom.slice(1)} : ${n} sous-élément${n > 1 ? "s" : ""} daté${n > 1 ? "s" : ""} ; il en faut au moins ${SEUILS.sousElementsMinParCarte} (l'énergie vient de ce qui s'ajoute dans la carte).`);
  }
  // 5 bis. LITTÉRALITÉ (Will 14/10 : « chaque animation représente ce que la personne dit »).
  const racinesDites = (a: number, z: number) => new Set(motsTries.filter((m) => m.a >= a - EPS && m.a <= z + EPS).flatMap((m) => racinesDe(m.w)));
  const verifierIllustre = (Nom: string, illustre: string | undefined, debut: number, fin: number) => {
    if (!illustre?.trim()) {
      erreurs.push(`${Nom} : « illustre » manquant ; recopiez les mots EXACTS de la transcription que cet objet montre (ex. « relances à la main »).`);
      return;
    }
    const dits = racinesDites(debut - S.illustreAvantSec, fin + S.illustreApresSec);
    const absents = illustre.split(/\s+/).filter((w) => {
      const r = racine(w);
      return r !== null && !dits.has(r);
    });
    if (absents.length) erreurs.push(`${Nom} : « illustre » (« ${illustre} ») contient ${absents.map((w) => `« ${w} »`).join(", ")}, jamais dit entre ${sec(Math.max(0, debut - S.illustreAvantSec))} et ${sec(fin + S.illustreApresSec)} ; recopiez les mots EXACTS dits pendant l'objet.`);
  };
  triees.forEach(({ c, i }) => {
    const Nom = `Carte ${i + 1} (${c.contenu.type})`;
    verifierIllustre(Nom, c.illustre, c.debut, c.fin);
    // Titre = le nom de l'outil, du lieu ou de la chose, jamais une phrase abstraite.
    if (titreAbstrait(c.titre)) {
      erreurs.push(`${Nom} : titre « ${c.titre} » abstrait ; le titre est le NOM de l'outil, du lieu ou de la chose montrée (« Boîte mail », « Agenda du dirigeant »), ${S.titreMotsMax} mots au plus, sans virgule ni mot de liaison en tête.`);
    }
    // Une carte (quel que soit son type) montre les choses, elle ne réécrit pas la phrase.
    const copie = copieCarte(c, motsTries);
    if (copie && copie.part > S.copieSousTitresMax + EPS) {
      erreurs.push(`${Nom} : recopie ${Math.round(copie.part * 100)} % des mots dits pendant qu'elle est à l'écran (${copie.copies} sur ${copie.dits}, dans des bouts de phrase de ${S.copieMotsParBoutMin} mots ou plus) ; ${Math.round(S.copieSousTitresMax * 100)} % au plus : montrez les choses (un nom de 1 ou 2 mots ou une icône par élément), ne réécrivez pas la phrase des sous-titres.`);
    }
    // La carte arrive sur ce qui est dit : un de ses mots est prononcé juste avant son entrée (pas « Tailles d'entreprise » sur « temps »).
    if (!motCleAvantEntree(c, motsTries)) {
      const proches = motsTries.filter((m) => m.a >= c.debut - S.motCleAvantEntreeSec - EPS && m.a <= c.debut + S.motCleApresEntreeSec + EPS && nettoyer(m.w)).map((m) => `« ${nettoyer(m.w)} »`);
      erreurs.push(`${Nom} : entre à ${sec(c.debut)} sans qu'aucun de ses mots soit dit entre ${sec(Math.max(0, c.debut - S.motCleAvantEntreeSec))} et ${sec(c.debut + S.motCleApresEntreeSec)} (mots dits : ${proches.join(", ") || "aucun"}) ; faites entrer la carte sur le mot qu'elle montre, ou nommez la chose dite.`);
    }
    // Grilles (passe 3) : chaque vignette montre la chose dite, jamais un pictogramme générique ni une fiche vide.
    for (const d of defautsVignettes(c, motsTries)) erreurs.push(`${Nom} : ${d}.`);
  });
  plan.fenetres.forEach((f, i) => {
    const Nom = `Fenêtre ${i + 1}`;
    verifierIllustre(Nom, f.illustre, f.debut, f.fin);
    const porteurs = racinesDe(f.recherche);
    if (porteurs.length < S.rechercheMotsMin) erreurs.push(`${Nom} : recherche « ${f.recherche} » trop vague ; décrivez la scène concrète, sujet + action + lieu (${S.rechercheMotsMin} mots porteurs au moins, ex. « dirigeant qui fait passer un entretien d'embauche »).`);
    // « IA » (2 lettres) n'a pas de racine : on la compte quand même comme un mot repris (« une IA » pour « L'IA ne rapporte… »).
    else if (f.illustre && !porteurs.some((r) => racinesDe(f.illustre!).some((x) => x.slice(0, 4) === r.slice(0, 4))) && !(/(^|[\s'’])ia\b/i.test(f.recherche) && /(^|[\s'’])ia\b/i.test(f.illustre))) {
      erreurs.push(`${Nom} : la recherche « ${f.recherche} » ne reprend aucun mot de ce qu'elle illustre (« ${f.illustre} ») : montrez la chose, le lieu ou l'action NOMMÉS (reprenez au moins un mot dit), jamais une image d'idée.`);
    }
    // Métaphore (horloge, sablier, goutte, ampoule…) : seulement si le mot est dit pendant la fenêtre.
    const ditsAutour = motsTries.filter((m) => m.a >= f.debut - S.illustreAvantSec - EPS && m.a <= f.fin + S.illustreApresSec + EPS).flatMap((m) => motsSimples(m.w));
    const metaphores = metaphoresDe(f.recherche, ditsAutour);
    if (metaphores.length) erreurs.push(`${Nom} : la recherche « ${f.recherche} » montre une MÉTAPHORE (${metaphores.join(", ")}) que Will ne dit pas ; montrez la scène réelle dont il parle (qui fait quoi, où), pas un symbole.`);
    // Personne ou action nommée : la fenêtre la montre.
    if (f.illustre) {
      for (const x of exigencesScene(f.illustre, f.recherche)) {
        if (x.quoi === "personne") erreurs.push(`${Nom} : la phrase parle de « ${x.mot} » ; la recherche « ${f.recherche} » doit montrer une PERSONNE (« ${x.exemple} », des mains au travail…), pas un objet seul.`);
        else erreurs.push(`${Nom} : la phrase dit « ${x.mot} » (action « ${x.quoi} ») ; la recherche « ${f.recherche} » doit montrer CETTE action (ex. « ${x.exemple} »).`);
      }
    }
    // Scène précise (passe 3) : QUI fait QUOI (une action qui se filme), OÙ.
    if (porteurs.length >= S.rechercheMotsMin) {
      const sc = sceneDe(f.recherche);
      if (sc.invisible) erreurs.push(`${Nom} : la recherche « ${f.recherche} » décrit une action qui ne se FILME pas (« ${sc.invisible} ») ; écrivez ce que la personne FAIT à l'image : qui fait quoi, où (ex. « gérant qui saisit des factures au bureau le soir »).`);
      else if (!sc.action) erreurs.push(`${Nom} : la recherche « ${f.recherche} » ne dit pas ce qui SE PASSE à l'image ; écrivez qui fait quoi, où (ex. « artisan qui répond au téléphone dans son atelier »).`);
      if (!sc.lieu) avertissements.push(`${Nom} : la recherche « ${f.recherche} » ne dit pas OÙ (bureau, atelier, chantier, boutique…) ; un lieu rend l'image plus précise.`);
    }
  });

  // 5 ter. MINI-VIDÉOS (Will 14/10 : « des mini-vidéos comme la vidéo initiale »).
  const F = S.fenetres;
  const nF = plan.fenetres.length;
  if (!v3) {
    if (nF * F.secondesParFenetreMax < horizon - EPS) erreurs.push(`Seulement ${nF} fenêtre${nF > 1 ? "s" : ""} pour ${sec(horizon)} : il en faut au moins ${Math.ceil(horizon / F.secondesParFenetreMax - EPS)} (une toutes les ${F.secondesParFenetreMax} s au pire, visez une toutes les ${F.secondesParFenetre} s ; la référence en a 11 en 80 s). Toute phrase avec une action concrète ou un lieu (taper, appeler, signer, livrer, réunion, atelier, bureau le soir, week-end…) donne une fenêtre.`);
    else if (nF * F.secondesParFenetre < horizon - EPS && nF < plafondFamille("fenetre", plan.duree, (options.historique ?? [])[0])) avertissements.push(`${nF} fenêtres pour ${sec(horizon)} : visez-en ${Math.ceil(horizon / F.secondesParFenetre - EPS)} (une toutes les ${F.secondesParFenetre} s).`);
    if (nF) {
      if (mesures.partFenetresVideo < F.partVideoMin - EPS) erreurs.push(`Fenêtres vidéo : ${mesures.fenetresVideo} sur ${nF} (${Math.round(mesures.partFenetresVideo * 100)} %) ; il en faut ${Math.round(F.partVideoMin * 100)} % au moins (« video »: true, une MINI-VIDÉO qui montre l'action dite).`);
      // (« sur-le-visage » : la moitié AU PLUS depuis le 15/10, règle R4d de la diversité.)
      if (mesures.partFenetresEnchainees < F.partEnchaineesMin - EPS) {
        const seules = plan.fenetres.map((f, i) => ({ f, i })).filter(({ f }) => !estEnchainee(plan, f)).map(({ i }) => i + 1);
        erreurs.push(`Fenêtres enchaînées : ${Math.round(mesures.partFenetresEnchainees * 100)} % ; il en faut ${Math.round(F.partEnchaineesMin * 100)} % au moins qui entrent 0 à ${v(F.enchaineeMaxSec)} s après la sortie d'une carte, d'une autre fenêtre ou d'une motion (non enchaînées : ${seules.join(", ")}).`);
      }
    }
  }

  // 5 quater. MOTIONS : littéralité (ce qu'elles montrent est DIT) et règles propres à chaque famille.
  (plan.motions ?? []).forEach((m, i) => {
    const Nom = `Motion ${i + 1} (${m.famille})`;
    verifierIllustre(Nom, m.illustre, m.debut, m.fin);
    const dits = racinesDites(m.debut - S.illustreAvantSec, m.fin + S.illustreApresSec);
    const ditsTous = (t: string) => racinesDe(t).every((r) => dits.has(r));
    const ditUnMot = (t: string) => racinesDe(t).length === 0 || racinesDe(t).some((r) => dits.has(r));
    const c = m.contenu as Record<string, unknown>;
    const textes = (cle: string, champ: string) => ((c[cle] as Record<string, unknown>[] | undefined) ?? []).map((x) => String(x[champ] ?? ""));
    const nonDit = (t: string) => erreurs.push(`${Nom} : « ${t} » n'est pas dit entre ${sec(Math.max(0, m.debut - S.illustreAvantSec))} et ${sec(m.fin + S.illustreApresSec)} ; une motion montre les mots DE Will (recopiez-les), jamais un mot inventé.`);
    if (m.famille === "mot-geant" || m.famille === "ruban") for (const t of textes("mots", "texte")) if (!ditsTous(t)) nonDit(t);
    if (m.famille === "bulles") for (const t of textes("questions", "texte")) if (!ditUnMot(t)) nonDit(t);
    if (m.famille === "telephone") for (const t of textes("lignes", "texte")) if (!ditUnMot(t)) nonDit(t);
    if (m.famille === "pile-notifications") for (const t of textes("notifications", "titre")) if (!ditUnMot(t)) nonDit(t);
    if (m.famille === "ecran-partage") {
      for (const cote of ["gauche", "droite"] as const) {
        const t = String((c[cote] as Record<string, unknown> | undefined)?.titre ?? "");
        if (t && !ditUnMot(t)) nonDit(t);
      }
    }
    if (m.famille === "trait-dessine") {
      for (const t of (c.traits as { mot: string; a: number }[] | undefined) ?? []) {
        const cible = simplifier(sansElision(nettoyer(t.mot)));
        const ok = motsTries.some((x) => Math.abs(x.a - t.a) <= S.toleranceAncrageSec + EPS && simplifier(sansElision(nettoyer(x.w))) === cible);
        if (!ok) erreurs.push(`${Nom} : le trait entoure « ${t.mot} » à ${sec(t.a)}, mais ce mot n'est pas dit à cet instant ; le trait se dessine autour d'un mot DU SOUS-TITRE, sur son début (± ${v(S.toleranceAncrageSec)} s).`);
      }
    }
    if (m.famille === "chiffre-eclate") {
      const val = Number(c.valeur);
      const a = Number(c.a);
      const proches = nombresDits(motsTries.filter((x) => x.a >= a - 1 - EPS && x.a <= a + 0.6 + EPS));
      if (![...proches].some((d) => Math.abs(d - val) < 1e-9)) erreurs.push(`${Nom} : le nombre ${v(val)} doit être prononcé par Will au moment où il éclate (entre ${sec(Math.max(0, a - 1))} et ${sec(a + 0.6)}) ; jamais un nombre qu'il ne dit pas.`);
    }
    if (m.famille === "carte-france") {
      const legende = String(c.legende ?? "");
      const ville = motsSimples(legende).find((w) => VILLES.test(w));
      if (ville) erreurs.push(`${Nom} : la carte de France ne nomme jamais une ville (« ${legende} ») : « partout en France », « à distance ».`);
    }
  });

  // 5 quinquies. VARIÉTÉ d'une vidéo à l'autre (5 dernières vidéos).
  const types = triees.map((x) => x.c.contenu.type as string);
  const entrees = triees.map((x) => x.c.entree as string);
  const historique = (options.historique ?? []).slice(0, 5);
  const premier = premierObjet(plan);
  if (historique[0]?.premier && premier === historique[0].premier) erreurs.push(`Le premier objet (${premier}) est le même que celui de la vidéo précédente : ouvrez autrement (autre type de carte, fenêtre, ou autre calque).`);
  historique.forEach((h, n) => {
    const nom = h.titre ? `« ${h.titre} »` : `n° ${n + 1} de l'historique`;
    if (types.length >= 2 && types.length === h.types.length && types.every((t, k) => t === h.types[k])) avertissements.push(`Même suite de types de cartes que la vidéo ${nom} (${types.join(" → ")}) : variez.`);
    else {
      const commune = suiteCommune(types, h.types);
      if (commune) avertissements.push(`La suite « ${commune.join(" → ")} » reprend celle de la vidéo ${nom} : variez.`);
    }
    if (entrees.length >= 3 && entrees.length === h.entrees.length && entrees.every((t, k) => t === h.entrees[k])) avertissements.push(`Mêmes entrées de cartes que la vidéo ${nom} (${entrees.join(", ")}) : variez.`);
    const dejaVues = new Set((h.recherches ?? []).map((r) => simplifier(r.trim())));
    for (const f of plan.fenetres) if (dejaVues.has(simplifier(f.recherche.trim()))) avertissements.push(`Recherche « ${f.recherche} » déjà utilisée dans la vidéo ${nom} : montrez une autre scène.`);
  });

  // 5 sexies. ÉTIQUETTE ≠ SOUS-TITRE (revue passe 3 : « UNE FUITE », « SON WEEK-END », « LEUR APRÈS-MIDI » doublaient le
  // sous-titre affiché au même instant). L'étiquette montre une idée, un chiffre ou un rôle, jamais la phrase : dans la
  // référence, « OUTIL 1/6 » COMPLÈTE ce qui est dit. Exceptions : étiquette barrée (le trait est le complément : la
  // négation), texte portant un chiffre, étiquette qui glisse (rôle), tuile (nom de l'outil), compteur.
  const groupesAffiches = plan.groupes.length ? plan.groupes : groupesSousTitres(motsTries);
  const verifierDoublon = (Nom: string, texte: string, debut: number, fin: number) => {
    if (/\d/.test(texte) || texte.split(/[\s/]+/).some((w) => estNombreDit(w))) return;
    const double = etiquetteDoubleSousTitre(texte, debut, fin, groupesAffiches);
    if (double) erreurs.push(`${Nom} : l'étiquette « ${texte} » répète mot pour mot le sous-titre affiché au même moment (« ${double} ») ; elle doit COMPLÉTER ce qui est dit, pas le doubler : un chiffre dit, une catégorie ou un numéro (« Outil 1/3 », « Étape 2 »), un résultat, le nom de la chose ou du lieu montré — ou une tuile, une étiquette barrée, un compteur.`);
  };
  plan.calques.forEach((c, i) => {
    if (c.type === "etiquette" && c.barreA === undefined) verifierDoublon(`Calque ${i + 1} (étiquette)`, c.texte, c.debut, c.fin);
  });
  plan.fenetres.forEach((f, i) => {
    if (f.etiquette) verifierDoublon(`Fenêtre ${i + 1}`, f.etiquette.texte, f.etiquette.a, f.fin);
  });

  // 6. Textes affichés, chiffres, icônes.
  const dits = nombresDits(motsTries);
  const estDit = (n: number) => [...dits].some((d) => Math.abs(d - n) < 1e-9);
  // Exception : le numéro d'une carte « n/N » (N = nombre de cartes du plan) n'est pas un chiffre affirmé.
  const sansNumeros = (t: string) => t.replace(/(\d+)\s*\/\s*(\d+)/g, (m, n: string, total: string) => (Number(total) === plan.cartes.length && Number(n) >= 1 && Number(n) <= Number(total) ? " " : m));
  for (const o of objets) {
    const Nom = o.nom.charAt(0).toUpperCase() + o.nom.slice(1);
    for (const t of o.textes) {
      for (const interdit of motsInterditsDans(t.texte)) erreurs.push(`${Nom} : texte interdit « ${interdit} » dans ${t.chemin} (« ${t.texte} »).`);
      for (const n of nombresDansTexte(sansNumeros(t.texte))) if (!estDit(n)) erreurs.push(`${Nom} : le chiffre ${String(n).replace(".", ",")} affiché dans ${t.chemin} (« ${t.texte} ») n'est jamais dit dans la vidéo.`);
    }
    for (const n of o.nombres) if (!estDit(n.valeur)) erreurs.push(`${Nom} : le nombre ${String(n.valeur).replace(".", ",")} affiché (${n.chemin}) n'est jamais dit dans la vidéo.`);
    for (const i of o.icones) if (!iconeAutorisee(i.nom)) erreurs.push(`${Nom} : icône inconnue « ${i.nom} » (${i.chemin}) ; seules les icônes de la liste autorisée existent.`);
  }
  for (const [cle, texte] of [["marque", plan.fin.marque], ["adresse", plan.fin.adresse], ["motCle", plan.fin.motCle], ["appel", plan.fin.appel ?? ""]] as const) {
    for (const interdit of motsInterditsDans(texte)) erreurs.push(`Écran de fin : texte interdit « ${interdit} » dans ${cle} (« ${texte} »).`);
  }
  plan.fin.tuiles.forEach((t, k) => {
    if (!iconeAutorisee(t)) erreurs.push(`Écran de fin : icône inconnue « ${t} » (tuiles[${k}]).`);
  });

  // 7. Fin : jamais sur le dernier mot.
  const dernier = motsTries[motsTries.length - 1];
  if (dernier && plan.fin.debut < dernier.f - SEUILS.finAvantDernierMotSec - EPS) {
    erreurs.push(`Écran de fin à ${sec(plan.fin.debut)} : il coupe le dernier mot « ${dernier.w} » (fini à ${sec(dernier.f)}) ; il doit commencer à ${sec(dernier.f - SEUILS.finAvantDernierMotSec)} au plus tôt.`);
  }

  // 8. DIVERSITÉ (R1 à R7 du directeur artistique, 15/10).
  const d = controlerDiversite(plan, { historique });
  erreurs.push(...d.erreurs);
  avertissements.push(...d.avertissements);

  // 9. DIVERSITÉ « v2 énergie » (D0 à D13, 16/10 : emplacement, forme, mouvement, inclinaison, sortie) — seulement si le plan porte des éléments v2.
  const d2 = controlerDiversiteV2(plan, { historique, mots: motsTries });
  erreurs.push(...d2.erreurs);
  avertissements.push(...d2.avertissements);

  // 10. DÉCISIONS FIXES ET DIVERSITÉ « v3 » (D0, V1 à V7, D2, D11 à D15 : `regles-v3.ts`) — seulement si le plan porte des éléments v3.
  const d3 = controlerDiversiteV3(plan, { historique, mots: motsTries });
  erreurs.push(...d3.erreurs);
  avertissements.push(...d3.avertissements);

  return { erreurs, avertissements, mesures, rendable: estRendable(erreurs) };
}

/* ======================================================================================================================
 * DIVERSITÉ — règles R1 à R7 du directeur artistique (15/10). Retour de Will sur la vidéo 5 : « c'est presque toujours les
 * mêmes choses qui reviennent en animations… le visage est caché trop tôt au début ». La vidéo 5 aurait donné : visage
 * couvert à 0,36 s (R1b, R1c), 16 enchaînements de la même famille sur 41 (R3a), fenêtre à 36 % des apparitions (R4a),
 * 3 familles par minute (R5a), « drop » à 53 % des sons (R6), frise × 4 (R4c).
 * Les seuils valent pour 80 à 95 s et sont ramenés à la durée en dehors (`facteurDuree`).
 * ==================================================================================================================== */

type Intervalle = readonly [number, number];

/** Union d'intervalles, coupée à [a, b]. */
function union(iv: readonly Intervalle[], a: number, b: number): Intervalle[] {
  const t = iv.map(([x, y]) => [Math.max(a, x), Math.min(b, y)] as const).filter(([x, y]) => y > x + EPS).sort((p, q) => p[0] - q[0]);
  const r: [number, number][] = [];
  for (const [x, y] of t) {
    const d = r[r.length - 1];
    if (d && x <= d[1] + EPS) d[1] = Math.max(d[1], y);
    else r.push([x, y]);
  }
  return r;
}
const longueur = (iv: readonly Intervalle[]) => iv.reduce((s, [x, y]) => s + y - x, 0);

/** Fenêtres glissantes de `largeur` s sur [0, horizon] (pas de 0,25 s) : [début, fin] ; une seule si la vidéo est plus courte. */
function fenetresGlissantes(horizon: number, largeur: number): Intervalle[] {
  if (horizon <= largeur + EPS) return [[0, horizon]];
  const r: Intervalle[] = [];
  for (let t = 0; t + largeur <= horizon + EPS; t += 0.25) r.push([t, t + largeur]);
  if (r[r.length - 1][1] < horizon - EPS) r.push([horizon - largeur, horizon]);
  return r;
}

/** Seuil de familles d'une fenêtre glissante, ramené quand la vidéo est plus courte que la fenêtre. */
const seuilFenetre = (seuil: number, largeur: number, horizon: number) => (horizon >= largeur - EPS ? seuil : Math.max(1, Math.ceil((seuil * horizon) / largeur - EPS)));

/** Familles différentes qui ENTRENT dans [a, b[. */
const famillesEntre = (ap: readonly Apparition[], a: number, b: number) => new Set(ap.filter((x) => x.debut >= a - EPS && x.debut < b - EPS).map((x) => x.famille));

/** Temps de visage : intervalles couverts et poussés sur [0, horizon]. */
function tempsDeVisage(ap: readonly Apparition[], horizon: number) {
  const couvert = union(ap.filter((x) => x.couvre).map((x) => [x.debut, x.fin] as const), 0, horizon);
  const occupe = union(ap.filter((x) => x.couvre || x.pousse).map((x) => [x.debut, x.fin] as const), 0, horizon);
  return { couvert, partCouvert: horizon > 0 ? longueur(couvert) / horizon : 0, partEnPlace: horizon > 0 ? (horizon - longueur(occupe)) / horizon : 1 };
}

/** Sons du plan (ceux qu'il porte, sinon ceux que le code poserait). */
const sonsDe = (plan: PlanFacecamAnimee) => (plan.sons.length ? plan.sons : bruitagesDuPlan(plan));

/** Les mesures de diversité d'un plan (sans contrôle). */
export function mesurerDiversite(plan: PlanFacecamAnimee): MesuresDiversite {
  const horizon = Math.min(plan.fin.debut, plan.duree);
  const ap = apparitionsDuPlan(plan).filter((x) => x.debut < horizon);
  if (!ap.length) return { ...mesuresDiversiteVides(), partVisageEnPlace: 1 };
  const comptes = new Map<string, number>();
  for (const x of ap) comptes.set(x.famille, (comptes.get(x.famille) ?? 0) + 1);
  const [top, nTop] = [...comptes].sort((p, q) => q[1] - p[1])[0];
  let run = 1;
  let repetitionMax = 1;
  let memeDeSuite = 0;
  for (let k = 1; k < ap.length; k++) {
    run = ap[k].famille === ap[k - 1].famille ? run + 1 : 1;
    if (run > 1) memeDeSuite++;
    repetitionMax = Math.max(repetitionMax, run);
  }
  const min = (largeur: number) => Math.min(...fenetresGlissantes(horizon, largeur).map(([a, b]) => famillesEntre(ap, a, b).size));
  const premier = (f: (x: Apparition) => boolean) => ap.find(f)?.debut ?? null;
  const v = tempsDeVisage(ap, horizon);
  const debuts = ap.map((x) => x.debut);
  const ecarts = [debuts[0], ...debuts.slice(1).map((t, k) => t - debuts[k]), horizon - debuts[debuts.length - 1]];
  const sons = sonsDe(plan);
  const parSon = new Map<string, number>();
  for (const [, s] of sons) parSon.set(familleDeSon(s), (parSon.get(familleDeSon(s)) ?? 0) + 1);
  const sonTop = [...parSon].sort((p, q) => q[1] - p[1])[0];
  const familles = [...new Set(ap.map((x) => x.famille))];
  return {
    apparitions: ap.length,
    familles,
    nombreFamilles: familles.length,
    famillesNouvelles: familles.filter(estFamilleMotion).length,
    partFamilleMax: arrondi(nTop / ap.length, 3),
    familleLaPlusUtilisee: top,
    repetitionMax,
    memeFamilleDeSuite: memeDeSuite,
    famillesMinPar60s: min(DIVERSITE.fenetre60Sec),
    famillesMinPar20s: min(DIVERSITE.fenetre20Sec),
    premierObjetSec: ap[0].debut,
    premiereCouvertureVisageSec: premier((x) => x.couvre),
    premiereCarteSec: premier((x) => x.famille === "carte"),
    premierPleinEcranSec: premier((x) => x.plein),
    partVisageCouvert: arrondi(v.partCouvert, 3),
    partVisageEnPlace: arrondi(v.partEnPlace, 3),
    intervalleMoyenSec: arrondi(horizon / ap.length, 2),
    plusLongSansEvenementSec: arrondi(Math.max(...ecarts), 2),
    partSonMax: sons.length ? arrondi(sonTop[1] / sons.length, 3) : 0,
    sonLePlusFrequent: sonTop?.[0] ?? null,
  };
}

/** Familles les plus utilisées d'une table de comptes (toutes, en cas d'égalité). */
function plusUtilisees(comptes: Readonly<Record<string, number>>): string[] {
  const max = Math.max(0, ...Object.values(comptes));
  return max ? Object.keys(comptes).filter((f) => comptes[f] === max) : [];
}

/** Couples consécutifs (A → B) d'une suite de familles. */
const couplesDe = (suite: readonly string[]) => suite.slice(1).map((f, k) => `${suite[k]} → ${f}`);

/** Contrôle des règles de diversité R1 à R7 ; chaque message commence par son code. */
export function controlerDiversite(plan: PlanFacecamAnimee, options: OptionsVerification = {}): { erreurs: string[]; avertissements: string[]; mesures: MesuresDiversite } {
  const D = DIVERSITE;
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const horizon = Math.min(plan.fin.debut, plan.duree);
  const ap = apparitionsDuPlan(plan).filter((x) => x.debut < horizon);
  const mesures = mesurerDiversite(plan);
  const f = facteurDuree(plan.duree);
  const historique = (options.historique ?? []).slice(0, 5);
  const N = ap.length;
  // Plan « v2 énergie » : les éléments v2 n'ont pas de famille de l'ancien catalogue ; la variété (R5) et la cadence (R5d) sont
  // alors jugées par D2, D3 et D11 sur la ligne de temps fusionnée (`regles-v2.ts`), pas par les 15 familles.
  const planV2 = !!plan.elementsV2?.length || !!plan.elementsV3?.length;
  if (!N && planV2) return { erreurs, avertissements, mesures };
  if (!N) {
    erreurs.push(`R5d — aucun objet à l'écran : une apparition (étiquette, trait dessiné, horloge, carte, fenêtre…) toutes les ${v(D.intervalleMoyenMin)} à ${v(D.intervalleMoyenMax)} s.`);
    return { erreurs, avertissements, mesures };
  }
  const nom = (x: Apparition) => `${x.nom} à ${sec(x.debut)}`;
  const nomFamille = (fa: string) => CATALOGUE_FAMILLES[fa as Famille]?.nom ?? fa;

  // R1 — Ouverture sur le visage entier (référence : 1er objet sur le visage à 5,0 s, 1re carte à 12,3 s).
  for (const x of ap.filter((y) => y.debut < D.rienAvantSec - EPS)) erreurs.push(`R1a — ${nom(x)} : rien d'autre que les sous-titres de 0 à ${v(D.rienAvantSec)} s ; faites-le entrer à ${v(D.rienAvantSec)} s au plus tôt.`);
  const permises = FAMILLES.filter((fa) => CATALOGUE_FAMILLES[fa].ouverture);
  for (const x of ap.filter((y) => y.debut < D.ouvertureSec - EPS && (y.couvre || !CATALOGUE_FAMILLES[y.famille].ouverture))) {
    erreurs.push(`R1b — ${nom(x)} : de 0 à ${v(D.ouvertureSec)} s, le visage reste ENTIER, sans fenêtre ni carte ; seules ces familles sont permises : ${permises.join(", ")}.`);
  }
  const premierCouvre = ap.find((y) => y.couvre);
  if (premierCouvre && premierCouvre.debut < D.premiereCouvertureSec - EPS) erreurs.push(`R1c — ${nom(premierCouvre)} couvre le visage : le premier objet qui couvre le visage entre à ${v(D.premiereCouvertureSec)} s au plus tôt (la vidéo 5 le couvrait dès 0,36 s).`);
  const premiereCarte = ap.find((y) => y.famille === "carte");
  if (premiereCarte && premiereCarte.debut < D.premiereCarteSec - EPS) erreurs.push(`R1d — ${nom(premiereCarte)} : la première carte entre à ${v(D.premiereCarteSec)} s au plus tôt.`);
  const premierPlein = ap.find((y) => y.plein);
  if (premierPlein && premierPlein.debut < D.premierPleinEcranSec - EPS) erreurs.push(`R1e — ${nom(premierPlein)} : le premier objet plein écran (mot géant, écran partagé, volet) entre à ${v(D.premierPleinEcranSec)} s au plus tôt.`);

  // R2 — Temps de visage.
  const visage = tempsDeVisage(ap, horizon);
  if (visage.partCouvert > D.couvertMax + EPS) erreurs.push(`R2a — visage couvert ${pct(visage.partCouvert * 100)} du temps ; ${Math.round(D.couvertMax * 100)} % au plus (fenêtres « sur-le-visage », mots géants, écrans partagés, volets) : passez des fenêtres « au-dessus » ou remplacez des objets couvrants par des familles qui laissent le visage entier.`);
  if (visage.partEnPlace < D.enPlaceMin - EPS) erreurs.push(`R2a — visage à sa place (ni couvert ni poussé par une carte, une étiquette ou une fenêtre au-dessus) ${pct(visage.partEnPlace * 100)} du temps ; ${Math.round(D.enPlaceMin * 100)} % au moins : préférez les motions qui laissent le visage en place (trait dessiné, horloge, téléphone, bulles, jauge…).`);
  const largeur = D.fenetreCouvertureSec;
  for (const [a, b] of fenetresGlissantes(horizon, largeur)) {
    const c = longueur(union(visage.couvert, a, b));
    if (c > D.couvertDansFenetreMax * (b - a) + EPS) {
      erreurs.push(`R2b — visage couvert ${sec(c)} entre ${sec(a)} et ${sec(b)} ; ${Math.round(D.couvertDansFenetreMax * 100)} % au plus sur toute fenêtre de ${largeur} s : espacez les objets qui couvrent le visage.`);
      break;
    }
  }
  const couvrants = ap.filter((y) => y.couvre);
  for (let k = 1; k < couvrants.length; k++) {
    const ecart = couvrants[k].debut - couvrants[k - 1].fin;
    if (ecart < D.visageEntreCouverturesSec - EPS) erreurs.push(`R2c — ${couvrants[k - 1].nom} puis ${nom(couvrants[k])} : ${sec(Math.max(0, ecart))} de visage entier entre deux objets qui le couvrent ; ${v(D.visageEntreCouverturesSec)} s au moins.`);
  }

  // R3 — Enchaînements.
  for (let k = 1; k < N; k++) {
    if (ap[k].famille === ap[k - 1].famille) erreurs.push(`R3a — ${ap[k - 1].nom} puis ${nom(ap[k])} : même famille « ${ap[k].famille} » deux fois de suite ; changez de famille à chaque apparition.`);
  }
  for (let k = 0; k + D.suiteMemeFamille <= N; k++) {
    const suite = ap.slice(k, k + D.suiteMemeFamille);
    const c = new Map<string, number>();
    for (const x of suite) c.set(x.famille, (c.get(x.famille) ?? 0) + 1);
    const trop = [...c].find(([, n]) => n > D.memeFamilleDansSuiteMax);
    if (trop) erreurs.push(`R3b — « ${trop[0]} » revient ${trop[1]} fois sur les ${D.suiteMemeFamille} apparitions de ${sec(suite[0].debut)} à ${sec(suite[suite.length - 1].debut)} ; ${D.memeFamilleDansSuiteMax} fois au plus.`);
  }
  for (let k = 1; k < N; k++) {
    const couple = `${ap[k - 1].famille} → ${ap[k].famille}`;
    for (let j = k + 1; j < N && j <= k + D.coupleRevientApres; j++) {
      if (`${ap[j - 1].famille} → ${ap[j].famille}` === couple) {
        erreurs.push(`R3c — l'enchaînement « ${couple} » à ${sec(ap[k].debut)} revient à ${sec(ap[j].debut)} ; un même couple de familles ne revient pas dans les ${D.coupleRevientApres} apparitions suivantes.`);
        break;
      }
    }
  }
  for (let k = 1; k < N; k++) {
    if (ap[k].couvre && ap[k - 1].couvre) erreurs.push(`R3d — ${ap[k - 1].nom} puis ${nom(ap[k])} couvrent tous deux le visage : séparez-les par une famille qui le laisse entier.`);
  }

  // R4 — Plafonds.
  const comptes = new Map<Famille, number>();
  for (const x of ap) comptes.set(x.famille, (comptes.get(x.famille) ?? 0) + 1);
  for (const [fa, n] of comptes) {
    if (n > D.partFamilleMax * N + EPS) erreurs.push(`R4a — « ${fa} » fait ${n} apparitions sur ${N} (${pct((n / N) * 100)}) ; une famille fait ${Math.round(D.partFamilleMax * 100)} % des apparitions au plus (${Math.floor(D.partFamilleMax * N + EPS)} ici).`);
    const cap = plafondFamille(fa, plan.duree, historique[0]);
    if (n > cap) erreurs.push(`R4b — « ${fa} » : ${n} apparitions ; ${cap} au plus pour cette vidéo${cap < Math.max(1, Math.round(CATALOGUE_FAMILLES[fa].plafond90 * f)) ? " (plafond atteint dans la vidéo précédente : un de moins)" : ""}.`);
  }
  const tranches = new Map<number, number>();
  for (const x of ap.filter((y) => y.famille === "mot-geant")) tranches.set(Math.floor(x.debut / D.trancheMotGeantSec), (tranches.get(Math.floor(x.debut / D.trancheMotGeantSec)) ?? 0) + 1);
  for (const [t, n] of tranches) if (n > 1) erreurs.push(`R4b — ${n} mots géants entre ${t * D.trancheMotGeantSec} et ${(t + 1) * D.trancheMotGeantSec} s ; un par tranche de ${D.trancheMotGeantSec} s au plus.`);
  const typesCartes = new Map<string, number>();
  for (const c of plan.cartes) typesCartes.set(c.contenu.type, (typesCartes.get(c.contenu.type) ?? 0) + 1);
  for (const [t, n] of typesCartes) if (n > 1) erreurs.push(`R4c — contenu de carte « ${t} » utilisé ${n} fois ; chaque contenu (frise, liste, grille…) une fois par vidéo au plus.`);
  for (let k = 2; k < N; k++) {
    if (ap[k].entree === ap[k - 1].entree && ap[k].entree === ap[k - 2].entree) erreurs.push(`R4c — même entrée « ${ap[k].entree} » 3 fois de suite (jusqu'à ${nom(ap[k])}) ; 2 fois de suite au plus.`);
    if (ap[k].place === ap[k - 1].place && ap[k].place === ap[k - 2].place) erreurs.push(`R4c — même place à l'écran (« ${ap[k].place} ») 3 fois de suite (jusqu'à ${nom(ap[k])}) ; 2 fois de suite au plus.`);
  }
  const nF = plan.fenetres.length;
  if (nF) {
    const surVisage = plan.fenetres.filter((x) => cadrageDe(x) === "sur-le-visage").length;
    const avecEtiquette = plan.fenetres.filter((x) => !!x.etiquette).length;
    if (surVisage > D.partFenetresSurVisageMax * nF + EPS) erreurs.push(`R4d — ${surVisage} fenêtres sur ${nF} posées « sur-le-visage » ; la moitié au plus (les autres « au-dessus »).`);
    if (avecEtiquette > D.partFenetresEtiquetteMax * nF + EPS) erreurs.push(`R4d — ${avecEtiquette} fenêtres sur ${nF} portent une étiquette ; la moitié au plus.`);
  }

  // R5 — Variété (a, b, c : les 15 familles ; non appliquée à un plan v2, voir plus haut).
  if (!planV2) for (const [largeurV, seuil, code] of [[D.fenetre60Sec, D.famillesPar60Min, "R5a"], [D.fenetre20Sec, D.famillesPar20Min, "R5b"]] as const) {
    const s = seuilFenetre(seuil, largeurV, horizon);
    for (const [a, b] of fenetresGlissantes(horizon, largeurV)) {
      const n = famillesEntre(ap, a, b);
      if (n.size < s) {
        erreurs.push(`${code} — ${n.size} famille${n.size > 1 ? "s" : ""} différente${n.size > 1 ? "s" : ""} entre ${sec(a)} et ${sec(b)} (${[...n].join(", ") || "aucune"}) ; il en faut ${s} au moins sur toute fenêtre de ${largeurV} s (la référence en montre 7 à 9 par minute).`);
        break;
      }
    }
  }
  const nFamilles = Math.min(FAMILLES.length, Math.ceil(D.famillesVideoMin * f - EPS));
  const nNouvelles = Math.min(12, Math.ceil(D.famillesNouvellesMin * f - EPS));
  if (!planV2 && mesures.nombreFamilles < nFamilles) erreurs.push(`R5c — ${mesures.nombreFamilles} familles sur 15 dans la vidéo (${mesures.familles.join(", ")}) ; il en faut ${nFamilles} au moins.`);
  if (!planV2 && mesures.famillesNouvelles < nNouvelles) erreurs.push(`R5c — ${mesures.famillesNouvelles} familles « motion » (les 12 nouvelles) ; il en faut ${nNouvelles} au moins : ${FAMILLES.filter((x) => estFamilleMotion(x) && !mesures.familles.includes(x)).join(", ")} sont encore libres.`);
  if (!planV2) {
    const moyen = horizon / N;
    if (moyen < D.intervalleMoyenMin - EPS || moyen > D.intervalleMoyenMax + EPS) erreurs.push(`R5d — un événement visuel toutes les ${v(arrondi(moyen, 2))} s en moyenne (${N} apparitions pour ${sec(horizon)}) ; il en faut un toutes les ${v(D.intervalleMoyenMin)} à ${v(D.intervalleMoyenMax)} s.`);
    const debuts = ap.map((x) => x.debut);
    const points = [0, ...debuts, horizon];
    for (let k = 1; k < points.length; k++) {
      if (points[k] - points[k - 1] > D.sansEvenementMaxSec + EPS) erreurs.push(`R5d — ${sec(points[k] - points[k - 1])} sans nouvel objet entre ${sec(points[k - 1])} et ${sec(points[k])} ; ${v(D.sansEvenementMaxSec)} s au plus.`);
    }
    for (let k = 1; k < debuts.length; k++) {
      if (debuts[k] - debuts[k - 1] < D.debutsEcartMinSec - EPS) erreurs.push(`R5d — ${ap[k - 1].nom} et ${nom(ap[k])} commencent à ${sec(debuts[k] - debuts[k - 1])} d'écart ; ${v(D.debutsEcartMinSec)} s au moins entre deux débuts.`);
    }
  }

  // R6 — Bruitages.
  const sons = sonsDe(plan);
  if (sons.length) {
    const parSon = new Map<string, number>();
    for (const [, s] of sons) parSon.set(familleDeSon(s), (parSon.get(familleDeSon(s)) ?? 0) + 1);
    for (const [s, n] of parSon) if (n > D.partSonMax * sons.length + EPS) erreurs.push(`R6 — le bruitage « ${s} » fait ${pct((n / sons.length) * 100)} des sons (${n} sur ${sons.length}) ; ${Math.round(D.partSonMax * 100)} % au plus.`);
    const traversent = ap.filter((x) => CATALOGUE_FAMILLES[x.famille].traverseCadre).flatMap((x) => [x.debut, x.fin]);
    for (const [t, s] of sons) {
      if (familleDeSon(s) !== "whoosh" || t >= plan.fin.debut - 0.1) continue;
      if (!traversent.some((u) => Math.abs(u - t) <= 0.2)) erreurs.push(`R6 — whoosh à ${sec(t)} : les whoosh sont réservés aux objets qui entrent ou sortent du cadre (carte, fenêtre, écran partagé, volet).`);
    }
    const egares = new Map<string, number[]>();
    for (const [t, s] of sons) {
      const proprio = familleDuSon(s);
      if (!proprio || t >= plan.fin.debut - 0.1) continue;
      if (!ap.some((x) => x.famille === proprio && t >= x.debut - 0.2 && t <= x.fin + 0.2)) egares.set(s, [...(egares.get(s) ?? []), t]);
    }
    for (const [s, ts] of egares) erreurs.push(`R6 — le son « ${s} » (${ts.length} fois, dès ${sec(ts[0])}) appartient à la famille « ${familleDuSon(s)} », absente à ces instants : chaque famille a son bruitage propre.`);
  }

  // R7 — Historique (historique-motion.json : les vidéos précédentes, la plus récente en premier).
  const precedentes = historique.slice(0, D.premiereFamilleVideos).filter((h) => h.familles?.length);
  for (const [k, h] of precedentes.entries()) {
    const nomH = h.titre ? `« ${h.titre} »` : `n° ${k + 1} de l'historique`;
    if (h.familles![0] === ap[0].famille) erreurs.push(`R7a — la vidéo commence par « ${ap[0].famille} » comme la vidéo ${nomH} ; la première famille change d'une vidéo à l'autre (3 dernières vidéos).`);
    const actuels = couplesDe(ap.filter((x) => x.debut < D.couplesDebutSec).map((x) => x.famille));
    const debutsH = h.debutsFamilles ?? [];
    const leurs = new Set(couplesDe(h.familles!.filter((_, i) => (debutsH[i] ?? 0) < D.couplesDebutSec)));
    if (actuels.length) {
      const partages = actuels.filter((c) => leurs.has(c)).length / actuels.length;
      if (partages >= D.couplesPartagesMax - EPS) erreurs.push(`R7b — les ${D.couplesDebutSec} premières secondes reprennent ${Math.round(partages * 100)} % des enchaînements de la vidéo ${nomH} (${actuels.filter((c) => leurs.has(c)).join(", ")}) ; moins de ${Math.round(D.couplesPartagesMax * 100)} %.`);
    }
  }
  const precedente = historique[0];
  if (precedente?.familles?.length) {
    const avant = new Set(precedente.familles);
    const absentes = mesures.familles.filter((x) => !avant.has(x));
    // Au plus autant que la vidéo précédente en a laissé de côté (une vidéo qui a montré les 15 familles n'en laisse aucune).
    const libres = FAMILLES.filter((x) => !avant.has(x)).length;
    const min = Math.min(libres, Math.max(1, Math.ceil(D.absentesDeLaPrecedenteMin * f - EPS)));
    if (min > 0 && absentes.length < min) erreurs.push(`R7c — ${absentes.length} famille${absentes.length > 1 ? "s" : ""} absente${absentes.length > 1 ? "s" : ""} de la vidéo précédente (${absentes.join(", ") || "aucune"}) ; il en faut ${min} au moins : ${FAMILLES.filter((x) => !avant.has(x)).map(nomFamille).join(", ")}.`);
  }
  if (precedente?.comptesFamilles) {
    // La famille la plus utilisée SEULE en tête : à égalité avec une autre, elle n'est plus « la » plus utilisée.
    const avantTop = plusUtilisees(precedente.comptesFamilles);
    const maintenant = plusUtilisees(Object.fromEntries(comptes));
    const commune = maintenant.length === 1 && avantTop.length === 1 && maintenant[0] === avantTop[0] ? maintenant[0] : undefined;
    if (commune) erreurs.push(`R7e — « ${commune} » est la famille la plus utilisée, comme dans la vidéo précédente ; la famille la plus utilisée change d'une vidéo à l'autre.`);
  }
  return { erreurs, avertissements, mesures };
}
