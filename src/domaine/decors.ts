/**
 * DÉCORS (lot M3 ; `decors/CATALOGUE-DECORS.md`, plan B.3). PUR, importable côté client, testé.
 * - ordre de proposition : les décors validés par Will d'abord, puis les décors réalistes, la réserve à part ;
 * - décor par défaut de l'avocat : N1 Halo orange ;
 * - fond CLAIR : l'ombre des sous-titres crème est renforcée, contraste vérifié, sinon style Bandeau.
 */
import { contientInterdit } from "./illustrations";
import type { AngleVisage, ElementBibliotheque, MethodeDecor, ValeurDecor } from "./types";

/** Décor par défaut du format avocat : N1 Halo orange (décision de Will du 01/10 soir). */
export const DECOR_DEFAUT_AVOCAT = "decor-n1-halo-orange";


type ElementDecor = Pick<ElementBibliotheque, "id" | "type" | "nom" | "valeur"> & { archiveLe?: string };

function valeurDecor(e: Pick<ElementBibliotheque, "valeur">): ValeurDecor | null {
  return e.valeur.type === "decor" ? e.valeur : null;
}

export function methodeDecor(v: ValeurDecor | null | undefined): MethodeDecor {
  return v?.methode ?? "neutre-incruste";
}

/** Un décor réaliste (Look) pas encore validé par Will : il ne part jamais sans son accord. */
export function decorAVerifier(v: ValeurDecor | null | undefined): boolean {
  return v?.statut === "a_verifier";
}

/**
 * Décors proposés dans le bloc Plateau : les validés (mis en avant) dans l'ordre du catalogue, puis les réalistes,
 * puis les autres décors de la Bibliothèque. La RÉSERVE (N2, N4, N6) est rendue à part, jamais en premier.
 */
export function ordonnerDecors<E extends ElementDecor>(elements: E[]): { proposes: E[]; reserve: E[] } {
  const decors = elements.filter((e) => e.type === "decor" && !e.archiveLe && valeurDecor(e));
  const rang = (e: E) => {
    const c = valeurDecor(e)?.catalogue;
    if (!c) return 1000;
    return (c.misEnAvant ? 0 : 100) + c.ordre;
  };
  const tries = [...decors].sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, "fr"));
  return { proposes: tries.filter((e) => !valeurDecor(e)?.catalogue?.reserve), reserve: tries.filter((e) => !!valeurDecor(e)?.catalogue?.reserve) };
}

/**
 * Décor par défaut d'une vidéo : le choix de la vidéo, sinon (avocat) N1 Halo orange s'il est dans la Bibliothèque,
 * sinon le défaut du format. Mémorisé par format et par modèle (le modèle porte `stylesChoisis.decorId`).
 */
export function decorParDefaut(formatId: string, elements: Pick<ElementBibliotheque, "id" | "archiveLe">[], defautFormat?: string): string | undefined {
  if (formatId === "avocat" && elements.some((e) => e.id === DECOR_DEFAUT_AVOCAT && !e.archiveLe)) return DECOR_DEFAUT_AVOCAT;
  return defautFormat;
}

/* ------------------------------------------------------------------ */
/* Contraste des sous-titres sur le décor                             */
/* ------------------------------------------------------------------ */

/** Crème des sous-titres (jeton `--texte`). */
export const CREME_SOUS_TITRES = "#F3EDE4";
const NOIR_CONTOUR = "#000000";

function canal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Luminance relative WCAG d'une couleur `#RRGGBB` (0 noir → 1 blanc). Couleur illisible : 0. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
}

/** Un décor est clair s'il est déclaré tel, ou si sa teinte dominante l'est. */
export function decorClair(v: ValeurDecor | null | undefined): boolean {
  if (!v) return false;
  if (v.clair !== undefined) return v.clair;
  return !!v.teinte && luminance(v.teinte) > 0.4;
}

export type ModeSousTitresDecor = "normal" | "ombre-renforcee" | "bandeau";

export interface SousTitresSurDecor {
  mode: ModeSousTitresDecor;
  /** Contraste crème / teinte du décor. */
  contrasteTexte: number;
  /** Contraste contour noir / teinte du décor. */
  contrasteContour: number;
  /** Multiplicateur de l'ombre (1 = style d'origine). */
  facteurOmbre: number;
}

/**
 * Règle des sous-titres crème sur le décor (`CATALOGUE-DECORS.md`) : sur un fond sombre, rien ne change ; sur un fond
 * CLAIR, le crème seul ne se lit plus (contraste < 4,5) : l'ombre est renforcée si le contour noir se détache nettement
 * du fond (contraste ≥ 7), sinon le style passe en Bandeau.
 */
export function sousTitresSurDecor(v: ValeurDecor | null | undefined): SousTitresSurDecor {
  const teinte = v?.teinte ?? "#110A05";
  const contrasteTexte = contraste(CREME_SOUS_TITRES, teinte);
  const contrasteContour = contraste(NOIR_CONTOUR, teinte);
  if (contrasteTexte >= 4.5 && !decorClair(v)) return { mode: "normal", contrasteTexte, contrasteContour, facteurOmbre: 1 };
  if (contrasteContour >= 7) return { mode: "ombre-renforcee", contrasteTexte, contrasteContour, facteurOmbre: 2 };
  return { mode: "bandeau", contrasteTexte, contrasteContour, facteurOmbre: 1 };
}

/** LUT conseillées sur ce décor, parmi celles de la Bibliothèque (fond clair : Doux ou Naturel). */
export function lutsConseilleesPour<E extends Pick<ElementBibliotheque, "id" | "nom" | "type">>(v: ValeurDecor | null | undefined, luts: E[]): E[] {
  const noms = v?.lutsConseillees ?? (decorClair(v) ? ["Doux", "Naturel"] : []);
  if (!noms.length) return [];
  return luts.filter((l) => l.type === "lut" && noms.some((n) => l.id === n || l.nom.toLowerCase().includes(n.toLowerCase())));
}

/* ------------------------------------------------------------------ */
/* Lot B1 — décors réalistes (`decors/CATALOGUE-DECORS.md`, B.3)       */
/* ------------------------------------------------------------------ */

/**
 * Décors RÉCURRENTS : une chaîne se reconnaît à 3 à 5 décors en rotation (meilleure pratique 2026, catalogue). Au-delà
 * de 5, un nouveau décor ne peut plus être mis en avant sans en retirer un ; un décor à vérifier ne l'est jamais.
 */
export const RECURRENTS_MIN = 3;
export const RECURRENTS_MAX = 5;

/** Les décors mis en avant (non rangés), dans l'ordre du catalogue. */
export function decorsRecurrents<E extends ElementDecor>(elements: E[]): E[] {
  return ordonnerDecors(elements).proposes.filter((e) => !!valeurDecor(e)?.catalogue?.misEnAvant);
}

/** Peut-on mettre ce décor en avant ? (validé, non rangé, et moins de 5 récurrents) */
export function peutMettreEnAvant<E extends ElementDecor>(elements: E[], id: string): { ok: true } | { ok: false; raison: string } {
  const e = elements.find((x) => x.id === id);
  const v = e ? valeurDecor(e) : null;
  if (!e || !v) return { ok: false, raison: "Ce décor n'existe plus." };
  if (e.archiveLe) return { ok: false, raison: "Ce décor est rangé : remettez-le d'abord." };
  if (v.statut === "a_verifier") return { ok: false, raison: "Validez d'abord ce décor sur une capture." };
  if (v.catalogue?.misEnAvant) return { ok: true };
  if (decorsRecurrents(elements).length >= RECURRENTS_MAX) return { ok: false, raison: `${RECURRENTS_MAX} décors sont déjà mis en avant : retirez-en un d'abord.` };
  return { ok: true };
}

/** Où en est un décor, pour l'écran « Mes décors ». */
export type EtatDecor =
  /** Fond neutre Axion posé par le studio : prêt, gratuit. */
  | "fond-neutre"
  /** Photo réelle floutée posée par le studio (proposition retenue, ou repli) : prête. */
  | "photo"
  /** Proposition d'une demande, pas encore choisie. */
  | "proposition"
  /** Décor réaliste : le Look n'existe pas encore, il sera fabriqué au premier usage (coût affiché, confirmation). */
  | "look-a-creer"
  /** Look fabriqué (ou en cours), à vérifier sur une capture avant toute publication. */
  | "look-a-verifier"
  /** Look validé par Will : réutilisé gratuitement. */
  | "look-pret";

export function etatDecor(v: ValeurDecor | null | undefined): EtatDecor {
  const m = methodeDecor(v);
  if (m === "neutre-incruste") return "fond-neutre";
  if (m === "photo-incrustee") return v?.demande && !v.demande.retenu && v.statut === "a_verifier" ? "proposition" : "photo";
  const looks = Object.values(v?.lookIdParAngle ?? {}).filter(Boolean);
  if (!looks.length) return "look-a-creer";
  return v?.statut === "valide" ? "look-pret" : "look-a-verifier";
}

export const LIBELLES_ETAT_DECOR: Record<EtatDecor, { libelle: string; ton: "orange" | "sauge" | "ambre" | "brique" | "neutre" }> = {
  "fond-neutre": { libelle: "Prêt", ton: "sauge" },
  photo: { libelle: "Photo floutée", ton: "sauge" },
  proposition: { libelle: "Proposition", ton: "orange" },
  "look-a-creer": { libelle: "À créer", ton: "neutre" },
  "look-a-verifier": { libelle: "À vérifier", ton: "ambre" },
  "look-pret": { libelle: "Prêt", ton: "sauge" },
};

/* --- Looks HeyGen ------------------------------------------------- */

/**
 * Coût d'un Look HeyGen : 1 crédit API par look généré (documentation `POST /v3/avatars/looks` : « an API key is
 * charged 1 API credit per look generated »), soit 0,99 $ au palier Pro (0,50 $ au palier Scale). On affiche le prix
 * le plus haut, arrondi : 1 $ par angle. À relever sur le portefeuille HeyGen au premier look réel.
 */
export const CENTIMES_USD_PAR_LOOK = 100;
/**
 * Correcteur réel 2 (F5) : le prix d'un look créé par `POST /v3/avatars` (type prompt) n'est PAS documenté par HeyGen.
 * Le montant ci-dessus est une estimation PROVISOIRE (1 crédit API, comme `POST /v3/avatars/looks`) : il est toujours
 * montré avec cette phrase et exige l'accord de Will. À régler ICI après le premier essai réel (portefeuille HeyGen).
 */
export const PRIX_LOOK_A_CONFIRMER = true;
export const MESSAGE_PRIX_LOOK_A_CONFIRMER = "Prix annoncé par HeyGen : à confirmer sur le premier essai.";

/** Angles du double à fabriquer pour ce décor (ceux qui n'ont pas encore de Look). */
export function anglesSansLook(v: ValeurDecor | null | undefined, angles: AngleVisage[]): AngleVisage[] {
  return angles.filter((a) => !v?.lookIdParAngle?.[a]);
}

/** Estimation AVANT confirmation : 0 € si les Looks existent déjà (réutilisés gratuitement). */
export function estimationLook(v: ValeurDecor | null | undefined, angles: AngleVisage[]): { angles: AngleVisage[]; centimesUsd: number; reutilise: boolean } {
  const manquants = anglesSansLook(v, angles);
  return { angles: manquants, centimesUsd: manquants.length * CENTIMES_USD_PAR_LOOK, reutilise: manquants.length === 0 };
}

/**
 * Correcteur réel 2 (04/10) : look HeyGen RELIÉ au décor pour cet angle (fait par Will dans l'application HeyGen),
 * seulement pour un décor réaliste. Le double est alors rendu SUR ce look, avec son fond.
 */
export function lookDuDecor(v: ValeurDecor | null | undefined, angle: AngleVisage): string | undefined {
  return methodeDecor(v) === "look-heygen" ? v?.lookIdParAngle?.[angle]?.trim() || undefined : undefined;
}

/** Le décor est-il un Look RÉEL pour cet angle, donc DANS la vidéo du double (ni décor ni liseré posés) ? */
export function lookReelPourAngle(v: ValeurDecor | null | undefined, angle: AngleVisage, pisteDepuisLook: boolean): boolean {
  return methodeDecor(v) === "look-heygen" && pisteDepuisLook && !!v?.lookIdParAngle?.[angle];
}

/** Traductions des mots de décor (table locale, sans Claude) ; un mot inconnu passe tel quel. */
const MOTS_DECOR_EN: Record<string, string> = {
  bureau: "office desk",
  bois: "wood",
  sombre: "dark",
  lampe: "desk lamp",
  carnet: "notebook",
  bibliotheque: "bookshelves",
  livres: "books",
  livre: "books",
  rayonnages: "shelves",
  direction: "executive office",
  baie: "large window",
  vitree: "glass",
  ville: "city skyline",
  coucher: "sunset",
  soleil: "sun",
  reunion: "meeting room",
  table: "table",
  chaises: "chairs",
  ecran: "screen",
  eteint: "switched off",
  atelier: "workshop",
  entrepot: "warehouse",
  usine: "factory",
  podcast: "podcast studio",
  micro: "microphone",
  panneaux: "panels",
  acoustiques: "acoustic",
  salon: "lounge",
  cafe: "cafe",
  fauteuil: "armchair",
  cuir: "leather",
  plante: "plant",
  plantes: "plants",
  espace: "space",
  travail: "work",
  moderne: "modern",
  cuisine: "kitchen",
  jardin: "garden",
  terrasse: "terrace",
  cabinet: "law office",
  tribunal: "courtroom",
  boutique: "shop",
  magasin: "store",
  restaurant: "restaurant",
  hotel: "hotel lobby",
  vigne: "vineyard",
  chalet: "mountain chalet",
  montagne: "mountain",
  mer: "sea view",
  plage: "beach",
  verriere: "glass roof",
  brique: "brick wall",
  briques: "brick wall",
  beton: "concrete",
  loft: "loft",
  cheminee: "fireplace",
  etageres: "shelves",
  chaleureux: "warm",
  chaude: "warm",
  chaud: "warm",
  doree: "golden",
  dore: "golden",
  lumiere: "light",
  tamisee: "dim",
  clair: "bright",
  claire: "bright",
  flou: "blurred",
  floue: "blurred",
  // Correcteur réel 2 (F2) : tenue et posture décrites dans « Décrivez » (le look porte aussi la tenue).
  costume: "suit",
  chemise: "shirt",
  veste: "jacket",
  cravate: "tie",
  pull: "sweater",
  polo: "polo shirt",
  blazer: "blazer",
  tailleur: "tailored suit",
  bleu: "blue",
  marine: "navy",
  noir: "black",
  noire: "black",
  blanc: "white",
  blanche: "white",
  gris: "grey",
  grise: "grey",
  beige: "beige",
  debout: "standing",
  assis: "seated",
};

/** ESSAI RÉEL n° 2 (05/10) : mots de tenue dans la phrase FRANÇAISE de Will. */
const MOTS_TENUE_FR = /\b(veste|chemise|costume|pull|t-shirt|tee-shirt|cravate|blazer|polo|gilet|tailleur|robe|jean|pantalon)\b/i;

/** Mots de tenue (la consigne ne garde alors plus « same outfit »). */
const MOTS_TENUE = /\b(suit|shirt|jacket|tie|sweater|polo shirt|blazer|tailored suit)\b/;

const VIDES_DECOR = new Set(
  "un une des les le la de du au aux et ou en dans sur avec sans pour par qui que je voudrais veux aimerais avoir mettre fond decor style genre type comme tres plus moins peu".split(" "),
);

function sansAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Sujet anglais d'une demande en une phrase (« un bureau avec une bibliothèque » → « office desk, bookshelves »).
 * Les personnes, logos et uniformes sont RETIRÉS (jamais de personne générée dans un décor).
 */
export function sujetDecorEn(phrase: string): string {
  const mots = sansAccents(phrase)
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/[\s']+/)
    .filter((m) => m.length > 1 && !VIDES_DECOR.has(m));
  const en: string[] = [];
  for (const m of mots) {
    const t = Object.hasOwn(MOTS_DECOR_EN, m) ? MOTS_DECOR_EN[m] : m;
    if (contientInterdit(t) || contientInterdit(m)) continue;
    if (!en.includes(t)) en.push(t);
  }
  return en.slice(0, 8).join(", ");
}

/** Trois ambiances, une par proposition (même famille que les visuels Buffer : bois, lumière dorée, clair-obscur). */
export const AMBIANCES_PROPOSITIONS = [
  { code: "doree", libelle: "Lumière dorée", en: "warm golden raking light from the side, wood tones, chiaroscuro" },
  { code: "jour", libelle: "Lumière du jour", en: "soft daylight from a window, calm, bright and natural" },
  { code: "soir", libelle: "Ambiance du soir", en: "evening ambience, warm practical lamps, deep soft shadows" },
] as const;
export type AmbianceProposition = (typeof AMBIANCES_PROPOSITIONS)[number];

export const PROPOSITIONS_PAR_DEMANDE = AMBIANCES_PROPOSITIONS.length;

/** Ce qui est toujours exclu d'une photo de décor (aucune personne, aucun texte, aucun logo). */
export const EXCLUSIONS_DECOR = "empty room, no people, no hands, no faces, no text, no logo, no uniform";

/**
 * Requête de la photo de décor SANS personne (repli « photo floutée », et propositions tant que les Looks sont
 * éteints). Le double sera posé devant : centre dégagé, cadrage à hauteur d'yeux assis, arrière-plan déjà flou.
 * `null` : la phrase ne décrit aucun lieu (rien n'est fabriqué).
 */
export function requetePhotoDecor(phrase: string, ambiance: AmbianceProposition): string | null {
  const sujet = sujetDecorEn(phrase);
  if (!sujet) return null;
  return `Interior photograph of ${sujet}. ${ambiance.en}. Realistic photo, vertical 9:16, camera at seated eye level, shallow depth of field with a softly blurred background, uncluttered, open space in the center foreground, ${EXCLUSIONS_DECOR}`;
}

/** Les 3 requêtes d'une demande (une par ambiance). Vide : la phrase ne décrit aucun lieu. */
export function requetesPropositions(phrase: string): { ambiance: AmbianceProposition; requete: string }[] {
  return AMBIANCES_PROPOSITIONS.flatMap((ambiance) => {
    const requete = requetePhotoDecor(phrase, ambiance);
    return requete ? [{ ambiance, requete }] : [];
  });
}

/** Nom court d'un décor demandé (« Un bureau avec une bibliothèque » → « Bureau avec une bibliothèque · Lumière dorée »). */
export function nomDecorDemande(phrase: string, ambiance?: string): string {
  const propre = phrase
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^(je voudrais|j'aimerais|je veux)\s+/i, "")
    .replace(/^(un|une|des|le|la|les)\s+/i, "");
  const base = (propre.charAt(0).toUpperCase() + propre.slice(1)).slice(0, 48);
  return ambiance ? `${base} · ${ambiance}` : base;
}

/**
 * Consigne d'un Look HeyGen (`POST /v3/avatars` type `prompt`, 1 000 caractères au plus) : Will généré DANS la pièce,
 * à partir du MÊME look de base (identité, tenue), regard hors caméra comme ses prises filmées.
 */
export function consigneLook(descriptionEn: string, angle: AngleVisage, descriptionFr?: string): string {
  // Correcteur réel 2 (F2, F3) : la description peut porter la tenue et la posture ; cadrage tête-taille, vertical 9:16.
  // Trois quarts : même pièce, caméra à 30° sur le côté, regard vers un interlocuteur hors champ (second angle à la manière de l'avocat de référence).
  const regard = angle === "face" ? "facing the camera, eyes on the lens" : "same room, camera placed about 30 degrees to the side, three-quarter view, eyes on an interlocutor off-camera to his right";
  // ESSAI RÉEL n° 2 (05/10) : la traduction mot à mot perdait la tenue et la posture (« veste », « assis ») : le premier
  // décor D2 est sorti en t-shirt, debout. La phrase française de Will est donc lue aussi, et jointe telle quelle.
  const fr = (descriptionFr ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  const tenueDecrite = MOTS_TENUE.test(descriptionEn) || MOTS_TENUE_FR.test(fr);
  const tenue = tenueDecrite ? "same face, same hair, NEW outfit exactly as described below (do not keep the reference outfit)" : "same face, same hair, same outfit";
  const posture = /\bstanding\b/.test(descriptionEn) || /\bdebout\b/i.test(fr) ? "Standing" : /\bseated\b/.test(descriptionEn) || /\bassise?\b/i.test(fr) ? "Seated in a chair" : "Same posture as the reference look";
  const original = fr ? ` Original description in French, follow it exactly: « ${fr} ».` : "";
  const texte = `Same man as the reference look: ${tenue}. ${posture}, framed from head to waist, ${regard}, calm and confident. Outfit and setting: ${descriptionEn}.${original} Soft natural light consistent on the face and the room, shallow depth of field with a softly blurred background, realistic photo, vertical 9:16, no text, no logo.`;
  return texte.slice(0, 1000);
}
