/**
 * FINS PAR RÉSEAU (TB-15) : choix d'une fin pour un réseau. Une fin NON VALIDÉE par Will est refusée avec une phrase
 * claire. `finPour(reseau, appelId)` : sans `appelId`, la première fin validée du groupe du réseau ; avec, cette fin-là
 * (elle doit viser le groupe du réseau). `finPourAvecLecteur` : lit d'abord la bibliothèque « Appels » de l'Usine
 * (interface injectée, non branchée), puis la table provisoire.
 */
import { TABLE_FINS } from "./table";
import { EMPLACEMENT_MOT, MOTS_DIT_MAX, MOTS_ECRAN_MAX, type FinChoisie, type FinTable, type GroupeFin, type LecteurAppels, type ReseauFin } from "./types";

export * from "./types";
export { TABLE_FINS } from "./table";
export { BANQUE_APPELS, OBJECTIFS_APPEL, PUBLICS_APPEL, TABLE_FINS_DIAGNOSTIC, TYPES_CONTENU, appelDeLaBanque, appelsDeLaBanque, phrasesDeLaBanque } from "./banque";
export type { AppelBanque, EtatAppel, FinDiagnostic, ObjectifAppel, PublicAppel, TypeContenu } from "./banque";
export { OBJECTIFS_FIN_LIENS, choisirFinLiens, controlerFinLiens, estCodeFinLiens, estObjectifFinLiens, finsLiensDeLaBanque } from "./fin-liens";
export type { FinLiens, IndicesFiche, ObjectifFinLiens } from "./fin-liens";

export class ErreurFin extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurFin";
  }
}

export const nombreMots = (t: string): number => t.split(/\s+/).filter(Boolean).length;

/** Mots de la plus longue phrase d'un texte dit (coupé sur « . ? ! : ; … »), la ponctuation seule ne comptant pas. */
export const motsDeLaPlusLonguePhrase = (t: string): number =>
  Math.max(0, ...t.split(/[.?!:;…]+/).map((p) => p.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length));

/** Groupe d'un réseau : Instagram/Facebook, TikTok/YouTube (Shorts compris), LinkedIn. */
export function groupeDe(reseau: ReseauFin): GroupeFin {
  switch (reseau) {
    case "instagram":
    case "facebook":
      return "instagram-facebook";
    case "tiktok":
    case "youtube":
    case "youtube-shorts":
      return "tiktok-youtube";
    case "linkedin":
      return "linkedin";
    default:
      throw new ErreurFin(`Réseau « ${String(reseau)} » inconnu : aucune fin possible.`);
  }
}

export interface OptionsFin {
  /** Mot de l'appel « Commentez MOT » (un seul mot, lettres et chiffres). */
  mot?: string;
  /** Forme lue du mot (« I.A. » pour « IA ») : la phrase dite la reçoit, l'écran garde `mot`. */
  motDit?: string;
}

/** Vrai pour un appel à commenter (« Écrivez {MOT} en commentaire », « Commentez… ») ; « le lien est en commentaire » n'en est pas un. */
export function estAppelACommenter(f: Pick<FinTable, "type" | "dit" | "ecran">): boolean {
  return f.type === "commentaire" || f.dit.includes(EMPLACEMENT_MOT) || f.ecran.includes(EMPLACEMENT_MOT) || /(^|[^\p{L}])(écrivez[^.?!]*\bcommentaire|commentez)/iu.test(f.dit);
}

/** Réseaux où aucun appel à commenter n'est dit dans la vidéo (Will, 12/10/2026 ; base 7 : rien n'est dit sur LinkedIn). */
export const RESEAUX_SANS_APPEL_A_COMMENTER: readonly ReseauFin[] = Object.freeze(["linkedin"]);

export const APPEL_A_COMMENTER_LINKEDIN = "Aucun appel à commenter n'est dit dans une vidéo LinkedIn : le mot va en dernière ligne du texte, Williams répond lui-même.";

/** Contrôle une fin (validée, longueurs, groupe) et remplit l'emplacement du mot. Lève `ErreurFin` sinon. */
export function choisir(fin: FinTable, reseau: ReseauFin, options: OptionsFin = {}): FinChoisie {
  if (!fin.validee) throw new ErreurFin(`La fin « ${fin.ecran} » n'est pas encore validée par Will : elle ne peut pas être utilisée.`);
  // Garde-fou, quoi que dise la table : jamais d'appel à commenter dit dans une vidéo LinkedIn.
  if (RESEAUX_SANS_APPEL_A_COMMENTER.includes(reseau) && estAppelACommenter(fin)) throw new ErreurFin(APPEL_A_COMMENTER_LINKEDIN);
  if (fin.groupe !== groupeDe(reseau)) throw new ErreurFin(`La fin « ${fin.ecran} » est prévue pour ${fin.groupe}, pas pour ${reseau}.`);
  if (fin.reseaux && !fin.reseaux.includes(reseau)) throw new ErreurFin(`La fin « ${fin.ecran} » est prévue pour ${fin.reseaux.join(", ")}, pas pour ${reseau}.`);
  let { dit, ecran } = fin;
  if (dit.includes(EMPLACEMENT_MOT) || ecran.includes(EMPLACEMENT_MOT)) {
    const mot = options.mot?.trim() ?? "";
    if (!/^[\p{L}\p{N}]{2,24}$/u.test(mot)) throw new ErreurFin(`La fin « ${fin.ecran} » demande un mot à commenter (un seul mot, lettres et chiffres) ; reçu : « ${options.mot ?? ""} ».`);
    dit = dit.split(EMPLACEMENT_MOT).join((options.motDit?.trim() || mot).toUpperCase());
    ecran = ecran.split(EMPLACEMENT_MOT).join(mot.toUpperCase());
  }
  const motsDits = fin.parPhrase ? motsDeLaPlusLonguePhrase(dit) : nombreMots(dit);
  if (motsDits > MOTS_DIT_MAX) throw new ErreurFin(`La fin « ${fin.ecran} » dit ${motsDits} mots${fin.parPhrase ? " dans une phrase" : ""} (${MOTS_DIT_MAX} au plus).`);
  if (nombreMots(ecran) > MOTS_ECRAN_MAX) throw new ErreurFin(`La fin « ${fin.ecran} » écrit ${nombreMots(ecran)} mots à l'écran (${MOTS_ECRAN_MAX} au plus).`);
  return { id: fin.id, groupe: fin.groupe, type: fin.type, dit, ecran };
}

/** La fin d'un réseau, tirée de la table provisoire. */
export function finPour(reseau: ReseauFin, appelId?: string, options: OptionsFin = {}, table: readonly FinTable[] = TABLE_FINS): FinChoisie {
  const groupe = groupeDe(reseau);
  if (appelId !== undefined) {
    const fin = table.find((f) => f.id === appelId);
    if (!fin) throw new ErreurFin(`Aucune fin « ${appelId} » dans la table provisoire.`);
    return choisir(fin, reseau, options);
  }
  const candidates = table.filter((f) => f.groupe === groupe);
  const fin = candidates.find((f) => f.validee);
  if (!fin) throw new ErreurFin(`Aucune fin validée par Will pour ${reseau} (${groupe}) : validez-en une dans la table des fins.`);
  return choisir(fin, reseau, options);
}

/** Lecture de l'Usine d'abord (si une bibliothèque est injectée), puis la table provisoire. Non branché aujourd'hui. */
export async function finPourAvecLecteur(reseau: ReseauFin, appelId: string, lecteur?: LecteurAppels, options: OptionsFin = {}): Promise<FinChoisie> {
  if (lecteur) {
    const lue = await lecteur.lire(reseau, appelId);
    if (lue) return choisir(lue, reseau, options);
  }
  return finPour(reseau, appelId, options);
}


/** Suite de fins d'un réseau, dans l'ordre demandé, tirée d'une table passée explicitement (aucune table par défaut). Lève `ErreurFin` à la première ligne refusée. */
export function suiteDeFins(reseau: ReseauFin, ids: readonly string[], options: OptionsFin, table: readonly FinTable[]): FinChoisie[] {
  return ids.map((id) => {
    const fin = table.find((f) => f.id === id);
    if (!fin) throw new ErreurFin("Cette fin est absente de la table fournie.");
    return choisir(fin, reseau, options);
  });
}
