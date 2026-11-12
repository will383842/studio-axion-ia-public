/**
 * FIN DE TIKTOK ET SHORTS (décision de Will du 14/10/2026, « selon les meilleures pratiques ») : UNE SEULE demande
 * courte par vidéo, choisie selon le type de vidéo, JAMAIS de promesse d'envoi (rien n'est envoyé depuis TikTok ni
 * Shorts), jamais « likez », jamais « abonnez-vous » ; au plus 12 mots dits et 8 mots à l'écran.
 *
 * Les phrases viennent UNIQUEMENT de la banque commune (`banque.ts`, base 7 de l'Usine) : aucune phrase n'est écrite
 * ici. Codes permis : les lignes validées de la base 7 pour TikTok ET Shorts, vidéo, dont l'objectif est l'un des quatre
 * de la règle de tirage de la base 7 (« une question, enregistrez, envoyez-la à…, le lien est dans mon profil »).
 *
 * Règle de choix (pure) :
 *  1. réglage de la fiche (`force`) : l'objectif demandé, s'il a une phrase pour ce public ;
 *  2. méthode en étapes (le texte dit numérote « Un. Deux. … ») → ENREGISTRER ;
 *  3. problème ou question → QUESTION si une phrase de question validée existe, sinon ENREGISTRER ;
 *  4. guide ou mot proposé (mot à commenter présent) → LIEN_PROFIL (« Le lien est dans mon profil. ») ;
 *  5. sinon → ENREGISTRER.
 * L'ordre suit la consigne de Will : presque toute fiche finit par le mot (fin des Reels), la question passe avant lui.
 * Jamais plus d'une demande : une seule fin est rendue.
 *
 * PUR, sans alias « @/ ».
 */
import { BANQUE_APPELS, PREFIXE_FINS_IMAGE_VIDEO, type AppelBanque, type ObjectifAppel, type PublicAppel } from "./banque";
import { EMPLACEMENT_MOT, MOTS_DIT_MAX, MOTS_ECRAN_MAX, type TypeFin } from "./types";

/** Objectifs permis sur TikTok et Shorts (base 7, règles de tirage). */
export const OBJECTIFS_FIN_LIENS = ["ENREGISTRER", "PARTAGER", "QUESTION", "LIEN_PROFIL"] as const satisfies readonly ObjectifAppel[];
export type ObjectifFinLiens = (typeof OBJECTIFS_FIN_LIENS)[number];

export const estObjectifFinLiens = (x: unknown): x is ObjectifFinLiens => typeof x === "string" && (OBJECTIFS_FIN_LIENS as readonly string[]).includes(x);

/** Ce que la fiche laisse voir de son type (lu par le format : `variantes-fin.ts` pour le tableau animé). */
export interface IndicesFiche {
  /** Le texte dit numérote des étapes (« Un. », « Deux. »…). */
  etapes: boolean;
  /** Un guide ou un mot à commenter est proposé. */
  mot: boolean;
  /** La vidéo part d'une question. */
  question: boolean;
  /** La vidéo part d'un problème (erreur corrigée). */
  probleme: boolean;
}

/** La fin choisie : code et objectif de la base 7 (tracés), phrases telles quelles, et la raison du choix. */
export interface FinLiens {
  code: string;
  objectif: ObjectifFinLiens;
  type: TypeFin;
  dit: string;
  ecran: string;
  raison: string;
}

const nombreMots = (t: string) => t.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
const simple = (t: string) =>
  ` ${t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9?]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;

/** Promesse d'envoi (« Je vous l'envoie », « On vous envoie… », « vous recevez… ») : interdite sur TikTok et Shorts. */
const PROMESSE_ENVOI = / (je|on) vous (l |les |la )?envoie| vous recevez | recevoir /;
/** Ce qui fait une demande : un verbe d'action adressé au spectateur, l'annonce d'un lien, ou une question. */
const DEMANDES = [/ enregistrez /, / envoyez /, / partagez /, / abonnez /, / likez /, / aimez /, / commentez /, / ecrivez /, / reservez /, / candidatez /, / le lien /, /\?/];

/** Contrôles d'une fin de TikTok et Shorts : liste des manquements, en français (vide : la fin est permise). */
export function controlerFinLiens(f: Pick<FinLiens, "dit" | "ecran"> & { objectif?: string; mot?: string }): string[] {
  const problemes: string[] = [];
  const dit = simple(f.dit);
  if (!f.dit.trim()) problemes.push("La fin ne dit rien.");
  if (f.objectif !== undefined && !estObjectifFinLiens(f.objectif)) problemes.push(`Objectif « ${f.objectif} » non permis sur TikTok et Shorts (${OBJECTIFS_FIN_LIENS.join(", ")}).`);
  if (nombreMots(f.dit) > MOTS_DIT_MAX) problemes.push(`La fin dit ${nombreMots(f.dit)} mots (${MOTS_DIT_MAX} au plus).`);
  if (nombreMots(f.ecran) > MOTS_ECRAN_MAX) problemes.push(`La fin écrit ${nombreMots(f.ecran)} mots à l'écran (${MOTS_ECRAN_MAX} au plus).`);
  if (PROMESSE_ENVOI.test(dit) || PROMESSE_ENVOI.test(simple(f.ecran))) problemes.push("La fin promet un envoi : rien n'est envoyé depuis TikTok ni Shorts.");
  if (f.mot?.trim() || f.dit.includes(EMPLACEMENT_MOT) || f.ecran.includes(EMPLACEMENT_MOT)) problemes.push("La fin demande un mot à commenter : jamais sur TikTok ni Shorts.");
  if (/ (likez|aimez|abonnez)/.test(dit)) problemes.push("La fin dit « likez » ou « abonnez-vous » : jamais sur TikTok ni Shorts.");
  const demandes = DEMANDES.filter((d) => d.test(dit)).length;
  if (demandes > 1) problemes.push(`La fin fait ${demandes} demandes (une seule).`);
  return problemes;
}

/** Les fins permises sur TikTok et Shorts pour un public, dans l'ordre de la base 7. */
export function finsLiensDeLaBanque(publicCible: PublicAppel = "public.clients"): AppelBanque[] {
  return BANQUE_APPELS.filter(
    (a) =>
      a.etat === "valide" &&
      !a.code.startsWith(PREFIXE_FINS_IMAGE_VIDEO) &&
      a.typeContenu === "video" &&
      a.public === publicCible &&
      a.reseaux.includes("tiktok") &&
      a.reseaux.includes("youtube-shorts") &&
      estObjectifFinLiens(a.objectif) &&
      controlerFinLiens(a).length === 0,
  );
}

/** Vrai pour un code de fin permis sur TikTok et Shorts (tous publics). */
export function estCodeFinLiens(code: string): boolean {
  return BANQUE_APPELS.some((a) => a.code === code) && (["public.clients", "public.apporteurs", "public.formateurs"] as const).some((p) => finsLiensDeLaBanque(p).some((a) => a.code === code));
}

const RAISONS: Readonly<Record<"force" | "etapes" | "mot" | "question" | "probleme" | "defaut", string>> = {
  force: "réglage de la fiche",
  etapes: "méthode en étapes",
  mot: "guide ou mot proposé",
  question: "vidéo qui part d'une question",
  probleme: "vidéo qui part d'un problème",
  defaut: "fin par défaut",
};

/**
 * La fin de TikTok et Shorts d'une vidéo, d'après le type de sa fiche (règle ci-dessus). `null` : aucune phrase permise
 * pour ce public (la vidéo se termine alors sur l'adresse du site, comme avant).
 */
export function choisirFinLiens(indices: IndicesFiche, options: { public?: PublicAppel; force?: ObjectifFinLiens } = {}): FinLiens | null {
  const fins = finsLiensDeLaBanque(options.public);
  const de = (objectif: ObjectifFinLiens) => fins.find((a) => a.objectif === objectif);
  const rendre = (a: AppelBanque | undefined, raison: keyof typeof RAISONS): FinLiens | null =>
    a ? { code: a.code, objectif: a.objectif as ObjectifFinLiens, type: a.type, dit: a.dit, ecran: a.ecran, raison: RAISONS[raison] } : null;
  if (options.force && de(options.force)) return rendre(de(options.force), "force");
  if (indices.etapes && de("ENREGISTRER")) return rendre(de("ENREGISTRER"), "etapes");
  if (indices.question || indices.probleme) {
    const raison = indices.question ? "question" : "probleme";
    return rendre(de("QUESTION"), raison) ?? rendre(de("ENREGISTRER"), raison);
  }
  if (indices.mot && de("LIEN_PROFIL")) return rendre(de("LIEN_PROFIL"), "mot");
  return rendre(de("ENREGISTRER"), "defaut") ?? rendre(fins[0], "defaut");
}
