/**
 * MOT BRANCHÉ, PAR MOT ET PAR COMPTE (X6, précision de l'Usine du 12/10/2026). PUR.
 *
 * Le mot (« IA », « GUIDE »…) n'est DIT dans une vidéo que pour les sorties destinées à un compte où ce mot est branché,
 * c'est-à-dire où le document est réellement envoyé à qui l'écrit. Le réglage du studio (paramètre
 * `PARAM_MOTS_BRANCHES`) tient, pour un mot et un compte, un état `non_branche` ou `branche` avec sa date. Vide
 * aujourd'hui : rien n'est branché. Seuls Instagram et Facebook peuvent l'être ; TikTok et LinkedIn jamais.
 *
 * La lecture passe par `motBranchePour(mot, reseau, compte?, reglage)` : une liste lue chez l'Usine pourra plus tard
 * remplacer le réglage sans autre changement (même forme de lecteur, `LecteurMotsBranches`).
 *
 * X7 · CONTRAT FIGÉ AVEC L'USINE (12/10/2026) : une ligne `{ mot: "GUIDE", reseau: "instagram" | "facebook",
 * compte?: "williamsjullin", etat: "non_branche" | "branche", le: "AAAA-MM-JJ" }`. `compte` est l'identifiant public du
 * compte sur le réseau, en minuscules (Will a deux comptes Facebook). Une ligne sans `compte` vaut pour tous les comptes
 * du réseau ; une ligne avec `compte` l'emporte, pour ce compte, sur la ligne sans compte. Le réglage accepte ces lignes
 * (un tableau) comme l'ancienne forme (mot → réseau → état, lue comme des lignes sans compte).
 * Tant que le studio ne sait pas à quel compte une sortie est destinée, il lit la ligne sans compte (à défaut : non
 * branché).
 */
import type { ReseauCas } from "./index";

/** Paramètre du studio qui tient le réglage. */
export const PARAM_MOTS_BRANCHES = "casConcret.motsBranches";

/** Les seuls comptes où un mot peut être branché. */
export const RESEAUX_BRANCHABLES = ["instagram", "facebook"] as const;
export type ReseauBranchable = (typeof RESEAUX_BRANCHABLES)[number];

export type EtatBranchement = { etat: "non_branche"; le?: string } | { etat: "branche"; le: string };

/**
 * Pour un mot (forme écrite, en capitales) : l'état par réseau (clé « instagram », tous les comptes) ou par compte
 * (clé « instagram@williamsjullin »).
 */
export type ReglageMotsBranches = Readonly<Record<string, Readonly<Record<string, EtatBranchement>>>>;

/** Une ligne du contrat d'échange avec l'Usine (X7). */
export interface LigneMotBranche {
  mot: string;
  reseau: ReseauBranchable;
  compte?: string;
  etat: "non_branche" | "branche";
  le: string;
}

/** Lecteur : le mot est-il branché sur ce réseau (et ce compte, s'il est connu) ? */
export type LecteurMotsBranches = (mot: string, reseau: ReseauCas, compte?: string) => boolean;

export const REGLAGE_MOTS_VIDE: ReglageMotsBranches = Object.freeze({});

/** Phrase de l'option « Avec le mot » quand le mot n'est branché sur aucun réseau coché. */
export const PHRASE_MOT_INDISPONIBLE = "Disponible quand l'envoi du document sera en place.";
/** Avertissement (jamais un blocage) d'un compte où le mot revient trop souvent. */
export const PHRASE_MOT_TROP_FREQUENT = "Le mot est déjà dans plus d'une vidéo sur trois cette semaine sur ce compte.";
/** Au-delà de cette part des vidéos du format des 7 derniers jours sur un compte, l'avertissement s'affiche. */
export const PART_MAX_VIDEOS_AU_MOT = 1 / 3;
export const JOURS_FENETRE_MOT = 7;

export const motNormalise = (mot: string): string => mot.trim().toUpperCase();

export const estBranchable = (reseau: string): reseau is ReseauBranchable => (RESEAUX_BRANCHABLES as readonly string[]).includes(reseau);

const dateValide = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));
const motPermis = (mot: string) => /^[\p{L}\p{N}]{2,24}$/u.test(mot.trim());

/** Identifiant public d'un compte, en minuscules ; `undefined` s'il est absent ou mal formé. */
export function compteNormalise(compte: unknown): string | undefined {
  if (typeof compte !== "string") return undefined;
  const c = compte.trim().replace(/^@/, "").toLowerCase();
  return /^[a-z0-9._-]{1,64}$/.test(c) ? c : undefined;
}

/** Clé d'un réseau (tous les comptes) ou d'un compte précis du réseau. */
const cleCompte = (reseau: ReseauBranchable, compte?: string) => (compte ? `${reseau}@${compte}` : reseau);

/** Lit une clé du réglage : le réseau et, s'il y en a un, le compte. */
function lireCle(cle: string): { reseau: ReseauBranchable; compte?: string } | null {
  const [reseau, compte, ...reste] = cle.split("@");
  if (reste.length || !estBranchable(reseau)) return null;
  if (compte === undefined) return { reseau };
  const c = compteNormalise(compte);
  return c ? { reseau, compte: c } : null;
}

function lireEtat(e: unknown): EtatBranchement | null {
  if (!e || typeof e !== "object") return null;
  const { etat, le } = e as Record<string, unknown>;
  if (etat === "branche" && dateValide(le)) return { etat, le };
  if (etat === "non_branche") return { etat, ...(dateValide(le) ? { le } : {}) };
  return null;
}

/**
 * Lecture tolérante du paramètre : les lignes du contrat (un tableau), ou la forme mot → réseau (ou réseau@compte) →
 * état. Toute entrée douteuse est ignorée (au moindre doute, non branché).
 */
export function lireReglageMotsBranches(brut: unknown): ReglageMotsBranches {
  if (!brut || typeof brut !== "object") return REGLAGE_MOTS_VIDE;
  const res: Record<string, Record<string, EtatBranchement>> = {};
  const poser = (mot: string, cle: string, etat: EtatBranchement) => {
    (res[motNormalise(mot)] ??= {})[cle] = etat;
  };
  if (Array.isArray(brut)) {
    for (const l of brut) {
      if (!l || typeof l !== "object") continue;
      const { mot, reseau, compte } = l as Record<string, unknown>;
      const etat = lireEtat(l);
      if (typeof mot !== "string" || !motPermis(mot) || typeof reseau !== "string" || !estBranchable(reseau) || !etat) continue;
      if (compte !== undefined && !compteNormalise(compte)) continue;
      poser(mot, cleCompte(reseau, compteNormalise(compte)), etat);
    }
  } else {
    for (const [mot, comptes] of Object.entries(brut as Record<string, unknown>)) {
      if (!motPermis(mot) || !comptes || typeof comptes !== "object") continue;
      for (const [cle, e] of Object.entries(comptes as Record<string, unknown>)) {
        const lue = lireCle(cle);
        const etat = lireEtat(e);
        if (lue && etat) poser(mot, cleCompte(lue.reseau, lue.compte), etat);
      }
    }
  }
  return Object.freeze(res);
}

/** Les lignes du contrat d'échange tirées d'un réglage (forme de l'Usine). */
export function lignesDuReglage(reglage: ReglageMotsBranches): LigneMotBranche[] {
  return Object.entries(reglage).flatMap(([mot, cles]) =>
    Object.entries(cles).flatMap(([cle, e]) => {
      const lue = lireCle(cle);
      return lue ? [{ mot, reseau: lue.reseau, ...(lue.compte ? { compte: lue.compte } : {}), etat: e.etat, le: (e.le ?? "").slice(0, 10) }] : [];
    }),
  );
}

/**
 * Le mot est-il branché sur ce réseau ? Jamais sur TikTok ni LinkedIn. Avec un compte : sa ligne, sinon la ligne sans
 * compte ; sans compte (le studio ne sait pas encore à quel compte une sortie est destinée) : la ligne sans compte.
 */
export function motBranchePour(mot: string, reseau: ReseauCas, compte?: string, reglage?: ReglageMotsBranches): boolean;
export function motBranchePour(mot: string, reseau: ReseauCas, reglage?: ReglageMotsBranches): boolean;
export function motBranchePour(mot: string, reseau: ReseauCas, compteOuReglage?: string | ReglageMotsBranches, reglageSeul?: ReglageMotsBranches): boolean {
  if (!estBranchable(reseau)) return false;
  const compte = typeof compteOuReglage === "string" ? compteNormalise(compteOuReglage) : undefined;
  const reglage = (typeof compteOuReglage === "object" ? compteOuReglage : reglageSeul) ?? REGLAGE_MOTS_VIDE;
  const etats = reglage[motNormalise(mot)];
  if (!etats) return false;
  const ligne = (compte ? etats[cleCompte(reseau, compte)] : undefined) ?? etats[reseau];
  return ligne?.etat === "branche";
}

/** Le lecteur tiré d'un réglage. */
export const lecteurDuReglage =
  (reglage: ReglageMotsBranches): LecteurMotsBranches =>
  (mot, reseau, compte) =>
    motBranchePour(mot, reseau, compte, reglage);

/** Les réseaux cochés où le mot sera dit. */
export function reseauxDuMot(mot: string, reseaux: readonly ReseauCas[], lecteur: LecteurMotsBranches): ReseauCas[] {
  return [...new Set(reseaux)].filter((r) => estBranchable(r) && lecteur(mot, r));
}

/**
 * Réglage changé pour un mot, un réseau et (facultatif) un compte (PUR) : refuse TikTok et LinkedIn, un compte mal
 * formé, et une date absente pour « branché ». Sans compte : la ligne vaut pour tous les comptes du réseau.
 */
export function avecBranchement(reglage: ReglageMotsBranches, mot: string, reseau: ReseauCas, etat: EtatBranchement, compte?: string): ReglageMotsBranches {
  if (!estBranchable(reseau)) throw new Error(`Un mot ne peut pas être branché sur ${reseau}.`);
  if (!motPermis(mot)) throw new Error("Le mot doit compter 2 à 24 lettres ou chiffres, sans espace.");
  if (etat.etat === "branche" && !dateValide(etat.le)) throw new Error("La date du branchement manque.");
  const c = compte === undefined ? undefined : compteNormalise(compte);
  if (compte !== undefined && !c) throw new Error("L'identifiant du compte est mal formé.");
  const m = motNormalise(mot);
  return lireReglageMotsBranches({ ...reglage, [m]: { ...(reglage[m] ?? {}), [cleCompte(reseau, c)]: etat } });
}

/** Une vidéo du format, vue pour l'avertissement : sa date, ses comptes, les comptes où le mot a été dit. */
export interface VideoPourMot {
  le: string;
  reseaux: readonly ReseauCas[];
  motSur: readonly ReseauCas[];
}

/** Comptes où plus d'une vidéo du format sur trois des 7 derniers jours porte déjà un mot (avertissement seul). */
export function comptesChargesEnMot(videos: readonly VideoPourMot[], maintenant: number): ReseauCas[] {
  const depuis = maintenant - JOURS_FENETRE_MOT * 24 * 3600_000;
  const recentes = videos.filter((v) => {
    const t = Date.parse(v.le);
    return !Number.isNaN(t) && t >= depuis && t <= maintenant;
  });
  return RESEAUX_BRANCHABLES.filter((r) => {
    const sur = recentes.filter((v) => v.reseaux.includes(r));
    return sur.length > 0 && sur.filter((v) => v.motSur.includes(r)).length / sur.length > PART_MAX_VIDEOS_AU_MOT;
  });
}

/** Ce que la feuille « Votre vidéo » sait des mots : où chaque mot est branché, et les comptes où il revient trop. */
export interface EtatMotsFeuille {
  /** Mot (capitales) → comptes où il est branché. */
  branches: Readonly<Record<string, readonly ReseauCas[]>>;
  /** Comptes où l'avertissement « une vidéo sur trois » s'affiche. */
  charges: readonly ReseauCas[];
}

/** Mot → réseaux branchés, d'après un réglage : la ligne SANS compte seulement (X7, la feuille ne connaît pas le compte). */
export function branchesDuReglage(reglage: ReglageMotsBranches): Record<string, ReseauCas[]> {
  return Object.fromEntries(
    Object.entries(reglage)
      .map(([mot, comptes]) => [mot, RESEAUX_BRANCHABLES.filter((r) => comptes[r]?.etat === "branche")] as const)
      .filter(([, r]) => r.length > 0),
  );
}
