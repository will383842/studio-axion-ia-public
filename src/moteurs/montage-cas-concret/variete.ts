/**
 * VARIÉTÉ DU MOTION DU CAS CONCRET (lot L2, plan `PLAN-ARCHITECTE.md` du 15/10/2026, sections C et G). Module PUR : aucune
 * entrée-sortie, aucune horloge, aucun hasard non semé.
 *
 * - GRAINE : empreinte stable de `videoId` (FNV-1a 32 bits) ; un « autre tirage » demandé par Will change le SEL (1, 2…).
 * - TIRAGE : une valeur par dimension prévue par le plan (ouverture, structure, jeu d'animation, mises en page, entrées,
 *   sorties, mot par mot, transitions, caméra, 3ᵉ fond terracotta, particules, sous-titres, bruitages, fin). Pour CHAQUE
 *   dimension, la variante n° 0 est la v4 exacte (`TIRAGE_V4`).
 * - MISE : le tirage, plus sa déclinaison écran par écran (`miseDesEcrans`), écrite dans la fiche (champ `mise`).
 * - ANTI-RÉPÉTITION (historique des 42 derniers tirages, réglage `casConcret.historiqueTirages`) : jamais la même ouverture
 *   deux fois de suite sur un même canal ; jamais la même combinaison (ouverture + structure + jeu d'animation + fond fort)
 *   sur 42 vidéos ; au moins 4 dimensions sur 7 différentes avec la vidéo précédente ; sur toute fenêtre de 4 vidéos
 *   (tous canaux), l'ouverture « affiche-v4 » et la structure v4 au plus 1 fois chacune (`FENETRE_V4`, règle gardée à
 *   TOUS les niveaux de relâche). Contraintes impossibles : relâchées
 *   dans un ordre FIXE et documenté (`NIVEAUX_DE_RELACHE`), en un nombre borné d'essais (jamais de boucle sans fin).
 * - RENDU : seules les dimensions de `DIMENSIONS_ACTIVES` passent dans les propriétés des écrans (`jeuDeLEcran`). Elle était
 *   VIDE en L2 (le tirage écrit, le rendu v4). L3c y branche le 3ᵉ fond terracotta (`fondFort`), les particules
 *   (`groupeParticules`, `densiteParticules`, qui choisissent aussi la variante de lueur du fond) et les barres
 *   proportionnelles du résultat (`barres`). L7 y ajoute l'animation des objets d'étape (`animObjet`). Chaque lot suivant ajoute sa dimension quand les compositions savent la lire.
 */
import { z } from "zod";
import { CODES_L6, MISES_EN_PAGE_L6, misesEnPageEligibles, APLATS_ORANGE, finitSurUneCoche, NAIT_D_UNE_COCHE, ON_ENTRE_DANS, type ContenuMisEnPage } from "@/briques/ecrans-motion/mises-en-page";
import type { TypeEcran } from "./fiche";

export const VERSION_VARIETE = "variete/1";
/** Taille de l'historique gardé (et fenêtre de la combinaison jamais répétée). */
export const TAILLE_HISTORIQUE = 42;
/** Nombre minimal de dimensions comparées (sur 7) qui changent d'une vidéo à la suivante. */
export const DIFFERENCES_MIN = 4;
/** Fenêtre de la règle « la v4 au plus 1 fois sur 4 » : cette vidéo et les 3 précédentes (tous canaux). */
export const FENETRE_V4 = 4;

/* ------------------------------------------------------------------ */
/* Les dimensions et leurs variantes (n° 0 = v4)                         */
/* ------------------------------------------------------------------ */

/** 1. Ouvertures (8). */
export const OUVERTURES = ["affiche-v4", "chiffre-choc", "question-plein-cadre", "avant-apres-eclair", "objet-zoom-arriere", "titre-geant-gauche", "phrase-deux-temps", "compteur-emballe"] as const;
/** 2. Structures (4) ; la v4 reste sous 40 % des vidéos (poids). */
export const STRUCTURES = ["v4-avant-etapes-resultat", "resultat-d-abord", "probleme-solution", "une-journee"] as const;
/** 4. Jeu d'animation : l'entrée dominante de la vidéo (5 entrées ; v4 = fondu-recul). */
export const ENTREES = ["fondu-recul-v4", "glissement", "volet-masque", "zoom-avant", "rideau"] as const;
export const JEUX_ANIMATION = ["v4", "glissement", "volet", "zoom", "rideau"] as const;
/** Entrée dominante de chaque jeu d'animation. */
export const ENTREE_DU_JEU: Readonly<Record<JeuAnimation, Entree>> = Object.freeze({ v4: "fondu-recul-v4", glissement: "glissement", volet: "volet-masque", zoom: "zoom-avant", rideau: "rideau" });
/** Sorties (3 ; v4 = aucune). */
export const SORTIES = ["aucune-v4", "poussee", "flou"] as const;
/** Titres mot par mot : la v4 majoritaire, plus 2 variantes proches. */
export const MOTS_PAR_MOT = ["v4", "cascade", "souffle"] as const;
/** 3. Mises en page (3 par type d'écran) : v4 centrée ; texte à gauche (objet à droite) ; plein cadre. */
export const MISES_EN_PAGE = ["v4-centree", "gauche", "plein-cadre"] as const;
/* L6 · mises en page branchées ---------------------------------------------------------------------------------- */
/** L6 · valeurs de la mise en page d'UN écran : celles de L2 (jamais rendues : la v4) et les codes L6 (`mises-en-page.ts`). */
export const MISES_EN_PAGE_ECRAN = [...MISES_EN_PAGE, ...CODES_L6] as const;
/** L6 · raccord d'entrée d'un écran : « objet » (la coche de l'écran précédent), « dedans-<fond> » (né dans une carte posée sur le fond de l'écran précédent). */
export const RACCORDS_ENTREE = ["objet", "dedans-sombre", "dedans-ivoire"] as const;
/* Fin du bloc L6 ------------------------------------------------------------------------------------------------- */
/** Types du corps qui reçoivent une mise en page tirée. */
export const TYPES_MIS_EN_PAGE = ["accroche", "titre", "question", "chiffre", "resultat", "etape", "objet", "liste-avant", "preuve"] as const satisfies readonly TypeEcran[];
/** 5. Transitions (4 types ; v4 = coupe franche partout), posées aux moments clés seulement. */
export const TRANSITIONS = ["volet-terracotta", "poussee", "raccord-objet", "eclair"] as const;
export const MOMENTS_CLES = ["bascule", "premiere-etape", "resultat", "fin"] as const;
/** 6. Caméra : un style par vidéo (v4 = aucune) ; mouvements dessinés dans l'écran. */
export const STYLES_CAMERA = ["aucune-v4", "douce", "rythmee", "revelation"] as const;
export const MOUVEMENTS_CAMERA = ["aucun", "zoom-lent", "derive-laterale", "punch-in", "zoom-arriere"] as const;
const MOUVEMENTS_DU_STYLE: Readonly<Record<StyleCamera, readonly MouvementCamera[]>> = Object.freeze({
  "aucune-v4": ["aucun"],
  douce: ["zoom-lent", "derive-laterale"],
  rythmee: ["punch-in", "zoom-lent"],
  revelation: ["zoom-arriere", "zoom-lent"],
});
/** Part des écrans qui bougent quand la caméra est permise (plan : 30 à 60 %). */
export const PART_CAMERA = { min: 0.3, max: 0.6 } as const;
/** Types d'écran qui ne bougent jamais (pas de mouvement pendant le cochage). */
const SANS_CAMERA: readonly TypeEcran[] = ["liste-avant"];
/** 10. 3ᵉ fond terracotta plein : 0 (v4), 1 ou 2 écrans au plus, sur un moment fort. */
export const FONDS_FORTS = [0, 1, 2] as const;
const TYPES_FOND_FORT: readonly TypeEcran[] = ["resultat", "chiffre", "titre", "preuve"];
/** 11. Particules : 6 groupes de positions, 3 densités (n° 0 = v4). */
export const GROUPES_PARTICULES = 6;
export const DENSITES_PARTICULES = ["v4", "legere", "dense"] as const;
/** 12. Sous-titres. */
export const INCLINAISONS = ["v4", "inverse"] as const;
export const INTENSITES = ["v4", "calme", "vif"] as const;
export const ACCENTS = ["v4", "surlignage"] as const;
export const HAUTEURS_SOUS_TITRES = ["v4", "haute"] as const;
/** 13. Bruitages : départ de la rotation des variantes (`choisirVariante`, graine ; 0 = v4). */
export const DEPARTS_BRUITAGES = 6;
/** 14. Fins : rang dans la rotation des phrases VALIDÉES, 2 compositions, 2 animations de l'écran final (0 = v4). */
export const PHRASES_FIN = 4;

/* L7 · animations des objets d'étape ------------------------------------------------------------------------------ */
/**
 * L7 · animations d'un objet d'étape (écrans `etape` et `objet`) : n° 0 = l'animation de la v4, 1 et 2 = deux variations
 * sobres propres à chaque objet (`studio-rendu/compositions/cas-concret/plans/anim-objets.ts`). Tirée écran par écran par
 * la graine, sur un hasard À PART (aucun tirage existant ne bouge) ; jamais posée sur un tirage v4.
 */
export const ANIMS_OBJET = 3;
/** L7 · types d'écran dont le visuel est un objet animé. */
export const TYPES_ANIM_OBJET: readonly TypeEcran[] = ["etape", "objet"];
/* Fin du bloc L7 ------------------------------------------------------------------------------------------------- */

export type Ouverture = (typeof OUVERTURES)[number];
export type Structure = (typeof STRUCTURES)[number];
export type Entree = (typeof ENTREES)[number];
export type JeuAnimation = (typeof JEUX_ANIMATION)[number];
export type Sortie = (typeof SORTIES)[number];
export type MotParMot = (typeof MOTS_PAR_MOT)[number];
export type MiseEnPage = (typeof MISES_EN_PAGE)[number];
export type TypeMisEnPage = (typeof TYPES_MIS_EN_PAGE)[number];
export type Transition = (typeof TRANSITIONS)[number];
export type MomentCle = (typeof MOMENTS_CLES)[number];
export type StyleCamera = (typeof STYLES_CAMERA)[number];
export type MouvementCamera = (typeof MOUVEMENTS_CAMERA)[number];

/* ------------------------------------------------------------------ */
/* Schémas (le tirage est écrit dans la fiche, champ facultatif `mise`)   */
/* ------------------------------------------------------------------ */

const entier = (min: number, max: number) => z.number().int().min(min).max(max);

export const schemaTirage = z.strictObject({
  version: z.literal(VERSION_VARIETE),
  /** Graine de la vidéo (FNV-1a 32 bits de `videoId`). */
  graine: z.number().int().nonnegative(),
  /** 0 : premier tirage ; 1, 2… : « autre tirage » demandé par Will. */
  sel: z.number().int().nonnegative(),
  ouverture: z.enum(OUVERTURES),
  structure: z.enum(STRUCTURES),
  jeuAnimation: z.enum(JEUX_ANIMATION),
  sortie: z.enum(SORTIES),
  motParMot: z.enum(MOTS_PAR_MOT),
  miseEnPage: z.strictObject(Object.fromEntries(TYPES_MIS_EN_PAGE.map((t) => [t, z.enum(MISES_EN_PAGE)])) as Record<TypeMisEnPage, z.ZodEnum<{ [K in MiseEnPage]: K }>>),
  /** Transitions aux moments clés (2 à 4) ; vide : coupe franche partout (v4). */
  transitions: z.array(z.strictObject({ moment: z.enum(MOMENTS_CLES), type: z.enum(TRANSITIONS) })).max(MOMENTS_CLES.length),
  camera: z.strictObject({ style: z.enum(STYLES_CAMERA), part: z.number().min(0).max(1) }),
  fondFort: entier(0, 2),
  particules: z.strictObject({ groupe: entier(0, GROUPES_PARTICULES - 1), densite: z.enum(DENSITES_PARTICULES) }),
  sousTitres: z.strictObject({ inclinaison: z.enum(INCLINAISONS), intensite: z.enum(INTENSITES), accent: z.enum(ACCENTS), hauteur: z.enum(HAUTEURS_SOUS_TITRES) }),
  bruitages: z.strictObject({ depart: entier(0, DEPARTS_BRUITAGES - 1) }),
  fin: z.strictObject({ phrase: entier(0, PHRASES_FIN - 1), composition: entier(0, 1), animation: entier(0, 1) }),
  /** Niveau de relâche des contraintes atteint pour ce tirage (`NIVEAUX_DE_RELACHE`) ; 0 : toutes tenues. */
  relache: entier(0, 3),
  /** L6 · combinaison des mises en page et raccords posés (`misesEnPageL6`), gardée dans l'historique ; absente : aucune. */
  misesEnPage: z.string().max(2000).optional(),
});
export type Tirage = z.infer<typeof schemaTirage>;

/** Déclinaison d'un écran du corps (lue par les compositions quand sa dimension est active). */
export const schemaTirageEcran = z.strictObject({
  /** L2 : une des 3 valeurs du tirage (jamais rendue) ; L6 : un code de `mises-en-page.ts`, rendu. */
  miseEnPage: z.enum(MISES_EN_PAGE_ECRAN),
  entree: z.enum(ENTREES),
  sortie: z.enum(SORTIES),
  motParMot: z.enum(MOTS_PAR_MOT),
  camera: z.enum(MOUVEMENTS_CAMERA),
  /** Transition dessinée au début de cet écran (fin de l'écran précédent comprise) ; absente : coupe franche. */
  transition: z.enum(TRANSITIONS).optional(),
  /** 3ᵉ fond terracotta plein sur cet écran ; absent : le fond de la fiche. */
  fondFort: z.literal(true).optional(),
  /** L3c · groupe de positions des particules (et variante de lueur du fond) ; absent : groupe 0 (v4). */
  groupeParticules: entier(1, GROUPES_PARTICULES - 1).optional(),
  /** L3c · densité des particules ; absente : la v4 (16). */
  densiteParticules: z.enum(["legere", "dense"]).optional(),
  /** L3c · barres du résultat proportionnelles aux nombres écrits (avant / maintenant) ; absent : la v4 (520 / 900). */
  barres: z.literal("proportionnelles").optional(),
  /** L6 · fond posé à la place de celui de la fiche (jamais 3 fois le même fond de suite) ; absent : celui de la fiche. */
  fondAlterne: z.enum(["sombre", "ivoire"]).optional(),
  /** L6 · raccord moderne à l'entrée de l'écran ; absent : coupe franche (v4). */
  raccordEntree: z.enum(RACCORDS_ENTREE).optional(),
  /** L6 · raccord d'objet à la sortie de l'écran (sa coche devient l'écran suivant) ; absent : coupe franche. */
  raccordSortie: z.literal("objet").optional(),
  /** L7 · animation de l'objet du visuel (1 ou 2) ; absente : l'animation de la v4. */
  animObjet: entier(1, ANIMS_OBJET - 1).optional(),
});
export type TirageEcran = z.infer<typeof schemaTirageEcran>;
export type DimensionEcran = keyof TirageEcran;

export const schemaMise = z.strictObject({
  version: z.literal(VERSION_VARIETE),
  tirage: schemaTirage,
  /** Par identifiant d'écran du corps (« e01 »…). */
  ecrans: z.record(z.string().regex(/^e\d{2}$/), schemaTirageEcran),
});
export type Mise = z.infer<typeof schemaMise>;

/** Mise lue sans exception (une valeur illisible : `null`). */
export function lireMise(brut: unknown): Mise | null {
  const r = schemaMise.safeParse(brut);
  return r.success ? r.data : null;
}

/* ------------------------------------------------------------------ */
/* Ce qui passe au rendu                                                 */
/* ------------------------------------------------------------------ */

/**
 * Dimensions par écran DÉJÀ lues par les compositions (vide en L2). Un lot qui branche une dimension l'ajoute ici, dans
 * la même PR que sa lecture. Une valeur v4 n'est jamais posée sur l'écran : un écran sans aucune valeur ≠ v4 n'a pas de
 * `jeu` (propriétés et empreinte de rendu de la v4).
 */
export const DIMENSIONS_ACTIVES: readonly DimensionEcran[] = Object.freeze(["fondFort", "groupeParticules", "densiteParticules", "barres", "miseEnPage", "fondAlterne", "raccordEntree", "raccordSortie", "animObjet"]);

/** Réglages transmis aux propriétés d'un écran (`jeu`) : les seules dimensions actives ; `undefined` si aucune. */
export function jeuDeLEcran(mise: Pick<Mise, "ecrans"> | null | undefined, ecranId: string, actives: readonly DimensionEcran[] = DIMENSIONS_ACTIVES): Record<string, string | number | boolean> | undefined {
  const t = mise?.ecrans[ecranId];
  if (!t || !actives.length) return undefined;
  const jeu: Record<string, string | number | boolean> = {};
  // L6 : une mise en page de L2 (« v4-centree », « gauche », « plein-cadre ») n'a jamais été rendue : elle n'est pas posée.
  for (const d of actives) if (t[d] !== undefined && !(d === "miseEnPage" && (MISES_EN_PAGE as readonly string[]).includes(t[d] as string))) jeu[d] = t[d]!;
  return Object.keys(jeu).length ? jeu : undefined;
}

/* ------------------------------------------------------------------ */
/* Graine et hasard semé                                                 */
/* ------------------------------------------------------------------ */

/** FNV-1a 32 bits d'un texte (entier non signé). */
export function hacher32(t: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}

/** Graine stable d'une vidéo. */
export function graineDe(videoId: string): number {
  return hacher32(`cas-concret:${videoId}`);
}

/** Générateur semé (mulberry32) : même graine, même suite de nombres dans [0, 1). */
export function hasardSeme(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dans = <T>(r: () => number, l: readonly T[]): T => l[Math.floor(r() * l.length)]!;
const entierDans = (r: () => number, n: number) => Math.floor(r() * n);
/** Choix pondéré (poids dans l'ordre de la liste). */
function pondere<T>(r: () => number, l: readonly T[], poids: readonly number[]): T {
  const total = poids.reduce((s, p) => s + p, 0);
  let x = r() * total;
  for (let i = 0; i < l.length; i++) {
    x -= poids[i]!;
    if (x < 0) return l[i]!;
  }
  return l[l.length - 1]!;
}
/** Mélange semé (Fisher-Yates). */
function melange<T>(r: () => number, l: readonly T[]): T[] {
  const c = [...l];
  for (let i = c.length - 1; i > 0; i--) {
    const j = entierDans(r, i + 1);
    [c[i], c[j]] = [c[j]!, c[i]!];
  }
  return c;
}

/* ------------------------------------------------------------------ */
/* Le tirage                                                             */
/* ------------------------------------------------------------------ */

/** Le tirage « v4 exacte » : la variante n° 0 de chaque dimension. */
export const TIRAGE_V4: Tirage = Object.freeze({
  version: VERSION_VARIETE,
  graine: 0,
  sel: 0,
  ouverture: OUVERTURES[0],
  structure: STRUCTURES[0],
  jeuAnimation: JEUX_ANIMATION[0],
  sortie: SORTIES[0],
  motParMot: MOTS_PAR_MOT[0],
  miseEnPage: Object.fromEntries(TYPES_MIS_EN_PAGE.map((t) => [t, MISES_EN_PAGE[0]])) as Tirage["miseEnPage"],
  transitions: [],
  camera: { style: STYLES_CAMERA[0], part: 0 },
  fondFort: 0,
  particules: { groupe: 0, densite: DENSITES_PARTICULES[0] },
  sousTitres: { inclinaison: INCLINAISONS[0], intensite: INTENSITES[0], accent: ACCENTS[0], hauteur: HAUTEURS_SOUS_TITRES[0] },
  bruitages: { depart: 0 },
  fin: { phrase: 0, composition: 0, animation: 0 },
  relache: 0,
}) as Tirage;

/** Dimensions du tirage qui ne sont pas des réglages (identité et compte rendu) : ignorées par `estV4`. */
const HORS_DIMENSIONS = ["graine", "sel", "relache", "misesEnPage"] as const;

/**
 * Vrai si le tirage est la v4 exacte : chaque dimension vaut sa variante n° 0 (`TIRAGE_V4`), quels que soient la graine,
 * le sel et le niveau de relâche. Un tirage v4 ne pose aucune barre proportionnelle.
 */
export function estV4(t: Tirage): boolean {
  // Texte canonique (clés triées à toute profondeur) : l'ordre des clés d'une fiche relue ne compte pas.
  const canon = (v: unknown): string =>
    Array.isArray(v) ? `[${v.map(canon).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(v);
  const sans = (x: Tirage) => canon(Object.fromEntries(Object.entries(x).filter(([k]) => !(HORS_DIMENSIONS as readonly string[]).includes(k))));
  return sans(t) === sans(TIRAGE_V4);
}

/** Un candidat tiré au hasard semé (sans contrainte). */
function candidat(r: () => number, graine: number, sel: number): Tirage {
  const v4Majoritaire = [0.6, 0.2, 0.2];
  const camera = pondere(r, STYLES_CAMERA, [0.25, 0.25, 0.25, 0.25]);
  const nbTransitions = pondere(r, [0, 2, 3, 4], [0.2, 0.35, 0.3, 0.15]);
  return {
    version: VERSION_VARIETE,
    graine,
    sel,
    ouverture: dans(r, OUVERTURES),
    structure: pondere(r, STRUCTURES, [0.35, 0.25, 0.2, 0.2]),
    jeuAnimation: dans(r, JEUX_ANIMATION),
    sortie: pondere(r, SORTIES, [0.4, 0.3, 0.3]),
    motParMot: pondere(r, MOTS_PAR_MOT, v4Majoritaire),
    miseEnPage: Object.fromEntries(TYPES_MIS_EN_PAGE.map((t) => [t, pondere(r, MISES_EN_PAGE, [0.4, 0.3, 0.3])])) as Tirage["miseEnPage"],
    transitions: melange(r, MOMENTS_CLES)
      .slice(0, nbTransitions)
      .sort((a, b) => MOMENTS_CLES.indexOf(a) - MOMENTS_CLES.indexOf(b))
      .map((moment) => ({ moment, type: dans(r, TRANSITIONS) })),
    camera: { style: camera, part: camera === "aucune-v4" ? 0 : +(PART_CAMERA.min + r() * (PART_CAMERA.max - PART_CAMERA.min)).toFixed(2) },
    fondFort: pondere(r, FONDS_FORTS, [0.4, 0.4, 0.2]),
    particules: { groupe: entierDans(r, GROUPES_PARTICULES), densite: dans(r, DENSITES_PARTICULES) },
    sousTitres: { inclinaison: dans(r, INCLINAISONS), intensite: pondere(r, INTENSITES, v4Majoritaire), accent: dans(r, ACCENTS), hauteur: dans(r, HAUTEURS_SOUS_TITRES) },
    bruitages: { depart: entierDans(r, DEPARTS_BRUITAGES) },
    fin: { phrase: entierDans(r, PHRASES_FIN), composition: entierDans(r, 2), animation: entierDans(r, 2) },
    relache: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Historique et anti-répétition                                         */
/* ------------------------------------------------------------------ */

/** Une ligne de l'historique (réglage `casConcret.historiqueTirages`, du plus ancien au plus récent). */
export const schemaEntreeHistorique = z.strictObject({
  videoId: z.string().min(1),
  /** Date ISO du tirage (posée par l'appelant : le module n'a pas d'horloge). */
  le: z.string(),
  /** Canaux (réseaux) de la vidéo. */
  canaux: z.array(z.string()),
  tirage: schemaTirage,
});
export type EntreeHistorique = z.infer<typeof schemaEntreeHistorique>;

/** Historique lu sans exception : les lignes illisibles sont ignorées, les 42 dernières gardées. */
export function lireHistorique(brut: unknown): EntreeHistorique[] {
  if (!Array.isArray(brut)) return [];
  return brut.flatMap((x) => {
    const r = schemaEntreeHistorique.safeParse(x);
    return r.success ? [r.data] : [];
  }).slice(-TAILLE_HISTORIQUE);
}

/** Ajoute une ligne : la ligne précédente de la même vidéo est remplacée ; 42 lignes au plus (les plus récentes). */
export function ajouterAHistorique(historique: readonly EntreeHistorique[], entree: EntreeHistorique, max = TAILLE_HISTORIQUE): EntreeHistorique[] {
  return [...historique.filter((e) => e.videoId !== entree.videoId), entree].slice(-max);
}

/** Les 7 dimensions comparées d'une vidéo à la suivante (« ≥ 4 sur 7 différentes »). */
export const DIMENSIONS_COMPAREES = ["ouverture", "structure", "jeuAnimation", "miseEnPage", "transitions", "camera", "fondFort"] as const;
export type DimensionComparee = (typeof DIMENSIONS_COMPAREES)[number];

/** Valeur comparable d'une dimension (texte stable). */
export function valeurDimension(t: Tirage, d: DimensionComparee): string {
  switch (d) {
    case "miseEnPage":
      return TYPES_MIS_EN_PAGE.map((x) => t.miseEnPage[x]).join(",");
    case "transitions":
      return t.transitions.map((x) => `${x.moment}:${x.type}`).join(",");
    case "camera":
      return t.camera.style;
    default:
      return String(t[d]);
  }
}

/** Nombre de dimensions comparées qui diffèrent entre deux tirages. */
export function differences(a: Tirage, b: Tirage): number {
  return DIMENSIONS_COMPAREES.filter((d) => valeurDimension(a, d) !== valeurDimension(b, d)).length;
}

/** Combinaison jamais répétée sur 42 vidéos : ouverture + structure + jeu d'animation + fond fort. */
export function combinaison(t: Tirage): string {
  return `${t.ouverture}|${t.structure}|${t.jeuAnimation}|${t.fondFort}`;
}

/**
 * Ordre FIXE de relâche quand les contraintes ne peuvent pas être tenues (au plus `ESSAIS_PAR_NIVEAU` candidats par
 * niveau, donc au plus 4 × 64 tirages au total) :
 *   0 · toutes les contraintes ;
 *   1 · au moins 3 dimensions sur 7 différentes (au lieu de 4) ;
 *   2 · la combinaison peut avoir déjà servi sur 42 (l'ouverture reste différente sur chaque canal) ;
 *   3 · seule la règle « v4 au plus 1 fois sur 4 » reste : le premier candidat qui la tient (sinon le repli de `tirer`
 *       prend une ouverture et une structure qui ne sont pas la v4).
 */
export const NIVEAUX_DE_RELACHE = [
  { differencesMin: DIFFERENCES_MIN, combinaisonUnique: true, ouvertureParCanal: true, v4UnSurQuatre: true },
  { differencesMin: 3, combinaisonUnique: true, ouvertureParCanal: true, v4UnSurQuatre: true },
  { differencesMin: 3, combinaisonUnique: false, ouvertureParCanal: true, v4UnSurQuatre: true },
  { differencesMin: 0, combinaisonUnique: false, ouvertureParCanal: false, v4UnSurQuatre: true },
] as const;
export const ESSAIS_PAR_NIVEAU = 64;

/** Raisons pour lesquelles un tirage ne tient pas les contraintes du niveau donné (vide : il les tient). */
export function contraintesNonTenues(t: Tirage, contexte: { videoId: string; canaux: readonly string[]; historique: readonly EntreeHistorique[]; structureImposee?: Structure; structuresExclues?: readonly Structure[] }, niveau = 0): string[] {
  const regles = NIVEAUX_DE_RELACHE[niveau]!;
  // Le tirage gardé de CETTE vidéo avec ce même sel n'est pas « une autre vidéo » : il ne compte pas (même vidéo, même
  // tirage). Un tirage de la même vidéo avec un autre sel compte pour la combinaison (« autre tirage » ≠ l'ancien).
  const autres = contexte.historique.filter((e) => !(e.videoId === contexte.videoId && e.tirage.sel === t.sel)).slice(-TAILLE_HISTORIQUE);
  const autresVideos = autres.filter((e) => e.videoId !== contexte.videoId);
  const raisons: string[] = [];
  // Lot F : structures écartées (« Nouveau script ») ; jamais relâchée, toutes les autres règles restent.
  if (contexte.structuresExclues?.includes(t.structure)) raisons.push(`structure écartée : ${t.structure}`);
  if (regles.ouvertureParCanal) {
    for (const canal of contexte.canaux) {
      const derniere = [...autresVideos].reverse().find((e) => e.canaux.includes(canal));
      if (derniere && derniere.tirage.ouverture === t.ouverture) raisons.push(`même ouverture que la vidéo précédente sur ${canal}`);
    }
  }
  if (regles.combinaisonUnique && autres.some((e) => combinaison(e.tirage) === combinaison(t))) raisons.push("combinaison déjà vue sur les 42 dernières vidéos");
  if (regles.v4UnSurQuatre) {
    const fenetre = [...autresVideos.slice(-(FENETRE_V4 - 1)).map((e) => e.tirage), t];
    if (fenetre.filter((x) => x.ouverture === OUVERTURES[0]).length > 1) raisons.push(`affiche-v4 plus d'1 fois sur ${FENETRE_V4}`);
    // D2 : une structure imposée (script déjà écrit ou validé) ne se tire pas : cette règle ne la juge pas.
    if (!contexte.structureImposee && fenetre.filter((x) => x.structure === STRUCTURES[0]).length > 1) raisons.push(`structure v4 plus d'1 fois sur ${FENETRE_V4}`);
  }
  const precedente = autresVideos.at(-1);
  if (precedente && differences(precedente.tirage, t) < regles.differencesMin) raisons.push(`moins de ${regles.differencesMin} dimensions sur 7 changent`);
  return raisons;
}

export interface DemandeTirage {
  videoId: string;
  /** Canaux (réseaux) de la vidéo. */
  canaux: readonly string[];
  historique: readonly EntreeHistorique[];
  /** « Autre tirage » : 0 (défaut) le premier ; 1, 2… les suivants. */
  sel?: number;
  /** Candidats essayés par niveau de relâche (défaut `ESSAIS_PAR_NIVEAU` ; essais : moins, pour forcer la relâche). */
  essaisParNiveau?: number;
  /**
   * D2 · structure imposée (écriture déjà commencée, script validé) : posée sur le tirage APRÈS le hasard, qui n'avance
   * pas de plus ; la règle « structure v4 au plus 1 fois sur 4 » ne la juge pas. Absente : le tirage de toujours.
   */
  structureImposee?: Structure;
  /** Lot F · structures que le tirage ne peut pas prendre (toutes les autres règles restent tenues). Absente : le tirage de toujours. */
  structuresExclues?: readonly Structure[];
}

/**
 * Tire les valeurs de toutes les dimensions pour une vidéo. Déterministe : même vidéo, même sel, même historique → même
 * tirage. Contraintes impossibles : relâchées dans l'ordre de `NIVEAUX_DE_RELACHE` (le niveau atteint est noté dans
 * `relache`), en un nombre borné d'essais.
 */
export function tirer(d: DemandeTirage): Tirage {
  const sel = Math.max(0, Math.floor(d.sel ?? 0));
  const graine = graineDe(d.videoId);
  const r = hasardSeme(sel ? hacher32(`${graine}#${sel}`) : graine);
  const contexte = { videoId: d.videoId, canaux: d.canaux, historique: d.historique, ...(d.structureImposee ? { structureImposee: d.structureImposee } : {}), ...(d.structuresExclues?.length ? { structuresExclues: d.structuresExclues } : {}) };
  const imposer = (t: Tirage): Tirage => (d.structureImposee ? { ...t, structure: d.structureImposee } : t);
  for (let niveau = 0; niveau < NIVEAUX_DE_RELACHE.length; niveau++) {
    for (let essai = 0; essai < Math.max(1, d.essaisParNiveau ?? ESSAIS_PAR_NIVEAU); essai++) {
      const t = imposer(candidat(r, graine, sel));
      if (!contraintesNonTenues(t, contexte, niveau).length) return { ...t, relache: niveau };
    }
  }
  // Repli (64 candidats refusés au dernier niveau) : ni l'ouverture ni la structure ne sont la v4, donc la règle « v4 au plus
  // 1 fois sur 4 » est tenue quoi qu'il y ait dans l'historique ; le hasard n'avance pas de plus (graine seule).
  return { ...candidat(r, graine, sel), ouverture: OUVERTURES[1 + (graine % (OUVERTURES.length - 1))]!, structure: d.structureImposee ?? (STRUCTURES.slice(1).filter((s) => !d.structuresExclues?.includes(s)).at(graine % Math.max(1, STRUCTURES.slice(1).filter((s) => !d.structuresExclues?.includes(s)).length)) ?? STRUCTURES[1 + (graine % (STRUCTURES.length - 1))]!), relache: NIVEAUX_DE_RELACHE.length - 1 };
}

/* ------------------------------------------------------------------ */
/* Déclinaison écran par écran                                           */
/* ------------------------------------------------------------------ */

/** Ce que la déclinaison lit d'un écran du corps (L6 : son fond et son contenu calé, s'ils sont donnés). */
export type EcranAMettre = { id: string; type: TypeEcran; fond?: "sombre" | "ivoire"; contenu?: ContenuMisEnPage };

/** Écran du moment clé, s'il existe (bascule : premier titre après la liste « avant » ; fin : dernier écran du corps). */
function ecranDuMoment(ecrans: readonly EcranAMettre[], moment: MomentCle): number {
  switch (moment) {
    case "bascule": {
      const liste = ecrans.findIndex((e) => e.type === "liste-avant");
      return ecrans.findIndex((e, i) => i > liste && liste >= 0 && e.type === "titre");
    }
    case "premiere-etape":
      return ecrans.findIndex((e) => e.type === "etape");
    case "resultat":
      return ecrans.findIndex((e) => e.type === "resultat");
    case "fin":
      return ecrans.length > 1 ? ecrans.length - 1 : -1;
  }
}

/**
 * Déclinaison du tirage écran par écran (déterministe : même tirage, mêmes écrans → même déclinaison). Le premier écran
 * n'a jamais de transition d'entrée ; la caméra ne touche jamais une liste qui se coche ; le fond fort va sur 1 ou 2
 * moments forts (résultat, chiffre, titre, preuve), jamais sur le premier écran.
 */
export function miseDesEcrans(t: Tirage, ecrans: readonly EcranAMettre[]): Mise["ecrans"] {
  const r = hasardSeme(hacher32(`${t.graine}#${t.sel}#ecrans`));
  const transitions = new Map<number, Transition>();
  for (const x of t.transitions) {
    const i = ecranDuMoment(ecrans, x.moment);
    if (i > 0 && !transitions.has(i)) transitions.set(i, x.type);
  }
  const mobiles = ecrans.map((e, i) => ({ e, i })).filter(({ e }) => !SANS_CAMERA.includes(e.type));
  const nbCamera = t.camera.style === "aucune-v4" ? 0 : Math.round(mobiles.length * t.camera.part);
  const camera = new Set(melange(r, mobiles.map((m) => m.i)).slice(0, nbCamera));
  const forts = new Set(melange(r, ecrans.map((e, i) => ({ e, i })).filter(({ e, i }) => i > 0 && TYPES_FOND_FORT.includes(e.type)).map((x) => x.i)).slice(0, Math.min(2, t.fondFort)));
  const dominante = ENTREE_DU_JEU[t.jeuAnimation];
  const v4 = estV4(t);
  return Object.fromEntries(
    ecrans.map((e, i) => {
      // Entrée : la dominante du jeu pour 2 écrans sur 3 environ, sinon une autre (v4 : toujours le fondu-recul).
      const entree = t.jeuAnimation === "v4" ? dominante : r() < 0.66 ? dominante : dans(r, ENTREES);
      const mouvements = MOUVEMENTS_DU_STYLE[t.camera.style];
      const te: TirageEcran = {
        miseEnPage: (TYPES_MIS_EN_PAGE as readonly string[]).includes(e.type) ? t.miseEnPage[e.type as TypeMisEnPage] : MISES_EN_PAGE[0],
        entree,
        sortie: t.sortie,
        motParMot: t.motParMot,
        camera: camera.has(i) ? dans(r, mouvements) : "aucun",
        ...(transitions.has(i) ? { transition: transitions.get(i)! } : {}),
        ...(forts.has(i) ? { fondFort: true as const } : {}),
        // L3c : recopiés du tirage (aucun hasard de plus) et posés seulement hors de la v4.
        ...(t.particules.groupe ? { groupeParticules: t.particules.groupe } : {}),
        ...(t.particules.densite !== "v4" ? { densiteParticules: t.particules.densite } : {}),
        ...(e.type === "resultat" && !v4 ? { barres: "proportionnelles" as const } : {}),
        // L7 : hasard à part (`animObjetDe`), hors v4.
        ...(v4 ? {} : animObjetDe(t, e)),
      };
      return [e.id, te];
    }),
  );
}

/* L7 · animations des objets d'étape ------------------------------------------------------------------------------ */
/**
 * L7 · animation de l'objet d'un écran `etape` ou `objet` : tirée sur un hasard propre à la vidéo, au sel et à l'écran
 * (le générateur de `miseDesEcrans` n'est pas touché : toutes les autres valeurs restent celles d'avant L7). N° 0 (la
 * v4) : rien n'est posé.
 */
export function animObjetDe(t: Pick<Tirage, "graine" | "sel">, e: EcranAMettre): { animObjet?: number } {
  if (!TYPES_ANIM_OBJET.includes(e.type)) return {};
  const n = hacher32(`${t.graine}#${t.sel}#anim-objet#${e.id}`) % ANIMS_OBJET;
  return n ? { animObjet: n } : {};
}
/* Fin du bloc L7 ------------------------------------------------------------------------------------------------- */

/**
 * La mise complète d'une vidéo : le tirage et sa déclinaison sur les écrans du corps. L6 : les mises en page, fonds et
 * raccords (`misesEnPageL6`) sont posés sur la déclinaison, et leur combinaison est notée dans le tirage.
 */
export function mettre(t: Tirage, ecrans: readonly EcranAMettre[], historique: readonly EntreeHistorique[] = [], canaux: readonly string[] = []): Mise {
  const { misesEnPage: _ancienne, ...tirage } = t;
  void _ancienne;
  const l6 = misesEnPageL6(tirage, ecrans, miseDesEcrans(tirage, ecrans), historique, canaux);
  return { version: VERSION_VARIETE, tirage: l6.combinaison ? { ...tirage, misesEnPage: l6.combinaison } : tirage, ecrans: l6.ecrans };
}

/** Ligne d'historique d'une mise. */
export function entreeHistorique(videoId: string, canaux: readonly string[], t: Tirage, le: string): EntreeHistorique {
  return { videoId, le, canaux: [...canaux], tirage: t };
}

/* ------------------------------------------------------------------ */
/* L6 · mises en page, fonds alternés et raccords modernes               */
/* ------------------------------------------------------------------ */

/** L6 · essais de combinaison (une combinaison déjà vue sur les 42 dernières vidéos est tirée de nouveau). */
export const ESSAIS_MISES_EN_PAGE = 24;
/** L6 · aplats orange pleins par vidéo, fond fort compris. */
export const APLATS_MAX = 2;
/** L6 · raccords modernes par vidéo (0 à 2). */
export const RACCORDS_MAX = 2;
/** L6 · poids du tirage : la v4 reste une option, beaucoup moins souvent (lot B : 0,25 contre 2). */
const POIDS_V4 = 0.25;
const POIDS_L6 = 2;

/** Identité d'une mise en page (deux types ont chacun leur v4). */
const identite = (type: string, code: string) => `${type}:${code}`;

/**
 * L6 · fonds effectifs : le fond de la fiche, ou « orange » (fond fort, aplat). Une suite de 3 fonds identiques est
 * cassée en retournant l'écran du milieu (de gauche à droite : aucune nouvelle suite de 3 n'apparaît).
 */
export function fondsAlternes(fonds: readonly ("sombre" | "ivoire" | "orange")[]): ("sombre" | "ivoire" | "orange")[] {
  const f = [...fonds];
  for (let i = 2; i < f.length; i++) {
    if (f[i] !== "orange" && f[i] === f[i - 1] && f[i] === f[i - 2]) f[i - 1] = f[i] === "sombre" ? "ivoire" : "sombre";
  }
  return f;
}

/** Type d'écran de chaque code L6 (un code n'appartient qu'à un seul type). */
const TYPE_DU_CODE: ReadonlyMap<string, string> = new Map(Object.entries(MISES_EN_PAGE_L6).flatMap(([type, codes]) => (codes as readonly string[]).map((c): [string, string] => [c, type])));

/**
 * L6 · maquettes de la vidéo PRÉCÉDENTE de chaque canal (dernière ligne d'une autre vidéo, qui a ce canal et une
 * combinaison L6 notée), retrouvées sans changer le schéma de l'historique : on lit `tirage.misesEnPage`
 * (« code[+raccord] » séparés par des virgules), on ne garde que les codes L6, et le type vient du code. Résultat : par
 * type d'écran, à chaque rang k (le k-ième code L6 de ce type dans la vidéo précédente), les codes à ne pas reposer sur
 * le k-ième écran de ce type. Union sur les canaux. Sans canal ou sans historique : rien d'interdit.
 */
export function maquettesPrecedentes(t: Pick<Tirage, "graine">, historique: readonly EntreeHistorique[], canaux: readonly string[]): Record<string, Set<string>[]> {
  const sortie: Record<string, Set<string>[]> = {};
  for (const canal of canaux) {
    const derniere = [...historique].reverse().find((e) => e.tirage.graine !== t.graine && e.canaux.includes(canal) && e.tirage.misesEnPage !== undefined);
    if (!derniere) continue;
    const rangs = new Map<string, number>();
    for (const morceau of derniere.tirage.misesEnPage!.split(",")) {
      const code = morceau.split("+")[0]!.trim();
      const type = TYPE_DU_CODE.get(code);
      if (!type) continue;
      const k = rangs.get(type) ?? 0;
      rangs.set(type, k + 1);
      ((sortie[type] ??= [])[k] ??= new Set()).add(code);
    }
  }
  return sortie;
}

/** Combinaisons L6 des 42 dernières vidéos (autres que ce tirage de cette vidéo). */
function combinaisonsVues(t: Tirage, historique: readonly EntreeHistorique[]): Set<string> {
  return new Set(historique.filter((e) => !(e.tirage.graine === t.graine && e.tirage.sel === t.sel)).slice(-TAILLE_HISTORIQUE).flatMap((e) => (e.tirage.misesEnPage ? [e.tirage.misesEnPage] : [])));
}

/**
 * L6 · mise en page de chaque écran du corps, fonds alternés et raccords, sur un hasard À PART (graine, sel, « l6 ») :
 * aucune autre valeur de la déclinaison ne bouge. Règles :
 *  - une mise en page n'est tirable que si le contenu de l'écran a ses données (`misesEnPageEligibles`) ; sans contenu,
 *    ou sur un écran au fond fort, l'écran garde la v4 ;
 *  - jamais deux écrans de suite avec la même mise en page (relâché seulement si l'écran n'a plus aucun autre choix) ;
 *    une L6 déjà posée dans la vidéo pèse 2 fois moins à chaque reprise, la v4 (déjà de poids 0,25) 4 fois moins ;
 *  - aplat orange (fond fort compris) sur 2 écrans au plus ;
 *  - jamais 3 fois le même fond de suite (`fondsAlternes`) ;
 *  - raccords « objet » et « dedans » seulement entre deux écrans compatibles, 2 au plus, jamais deux sur un écran ;
 *  - combinaison déjà vue sur les 42 dernières vidéos : tirée de nouveau (au plus `ESSAIS_MISES_EN_PAGE` fois) ;
 *  - jamais la même maquette que la vidéo précédente sur un même canal, écran de même type et de même rang (levée pour l'écran si
 *    elle ne laisserait que la v4) ; sans `canaux`, aucune interdiction (`maquettesPrecedentes`) ;
 *  - l'écran d'accroche n'est jamais en v4 tant qu'une maquette L6 est possible (c'est l'ouverture visible de la vidéo) ;
 *  - tirage v4 : rien n'est posé (la v4 exacte).
 */
export function misesEnPageL6(t: Tirage, ecrans: readonly EcranAMettre[], declinaison: Mise["ecrans"], historique: readonly EntreeHistorique[] = [], canaux: readonly string[] = []): { ecrans: Mise["ecrans"]; combinaison?: string } {
  // Sans aucun contenu d'écran (déclinaison seule), rien n'est posé : la déclinaison reste celle d'avant L6.
  if (estV4(t) || !ecrans.some((e) => e.contenu)) return { ecrans: declinaison };
  const r = hasardSeme(hacher32(`${t.graine}#${t.sel}#l6`));
  const vues = combinaisonsVues(t, historique);
  const precedentes = maquettesPrecedentes(t, historique, canaux);
  const forts = ecrans.map((e) => declinaison[e.id]?.fondFort === true);
  const tirerUne = () => {
    let aplats = forts.filter(Boolean).length;
    const codes: string[] = [];
    ecrans.forEach((e, i) => {
      if (!e.contenu || forts[i]) return void codes.push(MISES_EN_PAGE[0]);
      // Même rang que `maquettesPrecedentes` : k-ième maquette L6 de ce type déjà posée (v4 et fonds forts sautés).
      const rang = codes.filter((x, j) => ecrans[j]!.type === e.type && TYPE_DU_CODE.has(x)).length;
      const interdites = precedentes[e.type]?.[rang];
      const eligibles = misesEnPageEligibles(e.contenu).filter((c) => !(APLATS_ORANGE as readonly string[]).includes(c) || aplats < APLATS_MAX);
      const horsCanal = eligibles.filter((c) => !interdites?.has(c));
      // Si l'interdiction retirait toute maquette autre que la v4, elle est levée pour cet écran (la v4 n'est jamais un repli).
      const toutes = horsCanal.some((c) => c !== MISES_EN_PAGE[0]) ? horsCanal : eligibles;
      const precedente = i > 0 ? identite(ecrans[i - 1]!.type, codes[i - 1]!) : "";
      const permises = toutes.filter((c) => identite(e.type, c) !== precedente);
      const choix = permises.length ? permises : toutes;
      // Une L6 déjà posée pèse 2 fois moins à chaque reprise, la v4 4 fois moins (diversité dans la vidéo elle-même).
      const deja = (c: string) => codes.filter((x, j) => ecrans[j]!.type === e.type && x === c).length;
      // Accroche : la v4 ne sort que s'il n'y a aucune autre maquette (l'ouverture visible de la vidéo est cet écran).
      const sansV4 = e.type === "accroche" && choix.some((c) => c !== MISES_EN_PAGE[0]);
      const code = pondere(r, choix, choix.map((c) => (c === MISES_EN_PAGE[0] ? (sansV4 ? 0 : POIDS_V4) / Math.pow(4, deja(c)) : POIDS_L6 / Math.pow(2, deja(c)))));
      if ((APLATS_ORANGE as readonly string[]).includes(code)) aplats++;
      codes.push(code);
    });
    // Fonds effectifs, puis les raccords entre écrans compatibles.
    const fonds = fondsAlternes(ecrans.map((e, i) => (forts[i] || (APLATS_ORANGE as readonly string[]).includes(codes[i]!) ? "orange" : (e.fond ?? "sombre"))));
    const nb = pondere(r, [0, 1, 2], [0.3, 0.4, 0.3]);
    const candidats = melange(
      r,
      ecrans.flatMap((e, i) => {
        if (i === 0 || !e.contenu) return [];
        const p = ecrans[i - 1]!;
        const out: { i: number; type: "objet" | "dedans" }[] = [];
        if (p.contenu && finitSurUneCoche(p.contenu) && (NAIT_D_UNE_COCHE as readonly string[]).includes(e.type) && fonds[i] !== "orange") out.push({ i, type: "objet" });
        if ((ON_ENTRE_DANS as readonly string[]).includes(e.type) && fonds[i] !== "orange" && fonds[i - 1] !== "orange" && fonds[i] !== fonds[i - 1]) out.push({ i, type: "dedans" });
        return out;
      }),
    );
    const raccords = new Map<number, "objet" | "dedans">();
    for (const c of candidats) {
      if (raccords.size >= Math.min(RACCORDS_MAX, nb)) break;
      // Jamais deux raccords sur un écran (ni entrée et sortie à la fois).
      if (raccords.has(c.i) || raccords.has(c.i - 1) || raccords.has(c.i + 1)) continue;
      raccords.set(c.i, c.type);
    }
    const combinaison = ecrans.map((e, i) => `${codes[i]}${raccords.has(i) ? `+${raccords.get(i)}` : ""}`).join(",");
    return { codes, fonds, raccords, combinaison };
  };
  let choix = tirerUne();
  for (let essai = 1; essai < ESSAIS_MISES_EN_PAGE && vues.has(choix.combinaison); essai++) choix = tirerUne();
  const sortie: Mise["ecrans"] = {};
  ecrans.forEach((e, i) => {
    const te = declinaison[e.id];
    if (!te) return;
    const f = choix.fonds[i]!;
    const raccord = choix.raccords.get(i);
    const suivant = choix.raccords.get(i + 1);
    sortie[e.id] = {
      ...te,
      // Un écran sans contenu garde sa valeur de L2 (jamais rendue).
      ...(e.contenu ? { miseEnPage: choix.codes[i] as TirageEcran["miseEnPage"] } : {}),
      ...(f !== "orange" && e.fond && f !== e.fond ? { fondAlterne: f } : {}),
      ...(raccord === "objet" ? { raccordEntree: "objet" as const } : raccord === "dedans" ? { raccordEntree: `dedans-${choix.fonds[i - 1] as "sombre" | "ivoire"}` as const } : {}),
      ...(suivant === "objet" ? { raccordSortie: "objet" as const } : {}),
    };
  });
  for (const [k, v] of Object.entries(declinaison)) if (!sortie[k]) sortie[k] = v;
  return { ecrans: sortie, combinaison: choix.combinaison };
}
/* Fin du bloc L6 ------------------------------------------------------------------------------------------------- */
