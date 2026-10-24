/**
 * SCRIPT VALIDÉ PAR CAS (tâche V4-3). Un cas peut porter un script validé par Will : la fiche d'écrans du CORPS, complète
 * (textes dits et affichés, types, fonds, ordre, repères d'animation), rejouée MOT POUR MOT à chaque fabrication.
 *
 * Quand il existe, la fabrication ne fait AUCUN appel d'écriture : l'étape « L'écriture » prend ce script, puis « La
 * relecture » le passe par les mêmes contrôles que l'écriture (schéma, R02 à R23, faits, durées), puis la chaîne
 * habituelle (vrais écrans, voix, calage, écrans, finitions). S'il ne passe pas les contrôles, la fabrication s'arrête
 * avec une phrase claire : il n'est JAMAIS réparé en silence. La fin n'en fait jamais partie : elle vient de la banque des
 * fins, par réseau ; le script finit sur la question au public.
 *
 * Sources : les scripts du catalogue (code, ci-dessous) et ceux que Will valide depuis le studio (réglage
 * `casConcret.scriptsValides`, lu par les services : un script écrit par Claude, montré, puis validé). PUR.
 */
import { ecritsDe, ecritsModifiables } from "./modifier-script";
import { MARQUE, textesEcrits } from "./regles";
import { ficheFixe, type FicheFixe } from "./champs-du-cas";
import { idEcranAttendu, type Ecran, type EcranCorps, type FicheEcrans } from "./fiche";
import type { CasConcret } from "@/formats/cas-concret/cas";
import { SCRIPT_V4_RECRUTEMENT } from "./scripts-valides/recrutement-apporteurs";
import { STRUCTURES, type Structure } from "./variete";

/** Un écran du script : celui de la fiche, sans ce que le studio pose (identifiant, marque, heures du calage). */
export type EcranScript = EcranCorps extends infer E ? (E extends unknown ? Omit<E, "id" | "marque" | "debutMs" | "finMs"> : never) : never;

export interface ScriptValide {
  casId: string;
  /** Version du cas (`cas.version`) pour laquelle Will a validé ce script : un cas changé demande une nouvelle validation. */
  versionCas: number;
  /** Jour de la validation (AAAA-MM-JJ). */
  valideLe: string;
  /** D'où vient le script (vidéo de référence, vidéo du studio dont Will a validé le texte). */
  source: string;
  /** Le corps, accroche → question, dans l'ordre. Jamais la fin. */
  ecrans: EcranScript[];
  /**
   * Brique 3 (relire le script) : numéro de la version validée (absent : 1, le script du catalogue ou une validation
   * d'avant l'historique). Une modification crée TOUJOURS une nouvelle version ; l'ancienne reste dans l'historique.
   */
  numero?: number;
  /** Numéro de la version que celle-ci remplace. */
  remplace?: number;
  /**
   * LOT F · la vidéo dont Will a validé le script écrit (« Valider ce script »). Absent : script du catalogue ou modifié
   * depuis la relecture. Une vidéo « Nouveau script » ne rejoue un script plus récent que le sien que s'il vient d'elle
   * (ou s'il n'a pas de vidéo d'origine) : le script validé d'une AUTRE vidéo ne la remplace jamais en silence.
   */
  videoId?: string;
  /**
   * D2 · structure dans laquelle ce script a été écrit. Absent : la v4 (tous les scripts d'avant, dont celui du catalogue) ;
   * jamais posé pour la v4. Une nouvelle vidéo du cas reprend ce script mot pour mot, donc cette structure.
   */
  structure?: Structure;
  /**
   * Script FOURNI par Will (tapé ou collé dans le studio) : l'IA n'a rien écrit. `texteFourni` est le texte brut de Will, gardé
   * pour le lui rendre tel quel dans « Mon script » (4000 caractères au plus).
   */
  fourni?: true;
  texteFourni?: string;
}

/** Phrase de l'arrêt quand le script validé ne passe pas les contrôles (suivie des refus exacts). */
export const PHRASE_SCRIPT_VALIDE_REFUSE = "Le script validé de ce cas ne passe pas les contrôles : la fabrication s'arrête, il n'est jamais corrigé en silence. Faites-le corriger, puis validez-le de nouveau.";

/** V4-3 · un script écrit par Claude attend la validation de Will : la fabrication s'arrête après la relecture. */
export const PHRASE_SCRIPT_A_VALIDER = "Le script est écrit et relu : relisez son texte et l'ordre des écrans, puis validez-le. La voix ne sera payée qu'après votre validation.";
export const CODE_SCRIPT_A_VALIDER = "CAS_CONCRET_SCRIPT_A_VALIDER";

/** Scripts validés du catalogue, par cas. */
export const SCRIPTS_VALIDES_CATALOGUE: Readonly<Record<string, ScriptValide>> = Object.freeze({
  "recrutement-apporteurs": SCRIPT_V4_RECRUTEMENT,
});

export function scriptValideDuCatalogue(casId: string): ScriptValide | undefined {
  return SCRIPTS_VALIDES_CATALOGUE[casId];
}

/** Ce qui empêche ce script de servir pour ce cas (autre cas, autre version du cas) ; vide : il peut être relu. */
export function problemesScriptValide(script: ScriptValide, cas: Pick<CasConcret, "id" | "version">): string[] {
  if (script.casId !== cas.id) return [`Le script validé est celui du cas « ${script.casId} », pas de « ${cas.id} ».`];
  if (script.versionCas !== cas.version) return [`Le script a été validé pour la version ${script.versionCas} du cas ; le cas est en version ${cas.version} : faites revalider le script.`];
  return [];
}

/** La fiche brute du script : en-tête posé par le studio, identifiants et marque ; rien d'autre n'est touché. */
export function ficheDuScriptValide(script: ScriptValide, fixe: FicheFixe, cas: CasConcret): FicheEcrans {
  return {
    ...ficheFixe(fixe, cas),
    ecrans: script.ecrans.map((e, i) => ({ ...structuredClone(e), id: idEcranAttendu(i), marque: MARQUE }) as EcranCorps),
    ...(script.structure && script.structure !== STRUCTURES[0] ? { structure: script.structure } : {}),
  };
}

/** Le script d'une fiche relue (V4-3, point 5) : ses écrans sans identifiant, marque ni heures. */
export function scriptDeFiche(fiche: Pick<FicheEcrans, "casId" | "ecrans" | "structure">, meta: { versionCas: number; valideLe: string; source: string; videoId?: string; fourni?: true; texteFourni?: string }): ScriptValide {
  return {
    casId: fiche.casId,
    ...meta,
    ...(fiche.structure && fiche.structure !== STRUCTURES[0] ? { structure: fiche.structure } : {}),
    ecrans: fiche.ecrans.map((e) => {
      const copie: Partial<EcranCorps> = structuredClone(e);
      delete copie.id;
      delete copie.marque;
      delete copie.debutMs;
      delete copie.finMs;
      return copie as EcranScript;
    }),
  };
}

/** Lecture tolérante d'un script gardé (réglage) ; `null` au moindre doute (la relecture contrôle ensuite les écrans). */
export function lireScriptValide(brut: unknown): ScriptValide | null {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
  const s = brut as Record<string, unknown>;
  if (typeof s.casId !== "string" || typeof s.versionCas !== "number" || typeof s.valideLe !== "string" || typeof s.source !== "string") return null;
  if (!Array.isArray(s.ecrans) || !s.ecrans.length || !s.ecrans.every((e) => e && typeof e === "object" && typeof (e as { texteDit?: unknown }).texteDit === "string")) return null;
  const numero = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : undefined);
  const n = numero(s.numero);
  const r = numero(s.remplace);
  const structure = (STRUCTURES as readonly unknown[]).includes(s.structure) && s.structure !== STRUCTURES[0] ? (s.structure as Structure) : undefined;
  return { casId: s.casId, versionCas: s.versionCas, valideLe: s.valideLe, source: s.source, ecrans: s.ecrans as EcranScript[], ...(n ? { numero: n } : {}), ...(r ? { remplace: r } : {}), ...(typeof s.videoId === "string" && s.videoId ? { videoId: s.videoId } : {}), ...(structure ? { structure } : {}), ...(s.fourni === true ? { fourni: true as const } : {}), ...(typeof s.texteFourni === "string" && s.texteFourni.length <= 4000 ? { texteFourni: s.texteFourni } : {}) };
}

/* ------------------------------------------------------------------ */
/* L0a (15/10) : le script de la VIDÉO (fiche du studio) = le texte dit */
/* ------------------------------------------------------------------ */

/** Bloc de la recette du format pour un type d'écran du corps (les autres types sont des « étapes »). */
const BLOC_RECETTE_ECRAN: Readonly<Record<string, string>> = { accroche: "accroche", resultat: "resultat", question: "question" };

/** Identifiant du segment du script de la vidéo pour l'écran de rang `i` (0, 1…) : le même que celui des plans du moteur. */
export const idSegmentEcran = (videoId: string, i: number): string => `${videoId}-s${i + 1}`;

/**
 * Les blocs du script de la vidéo tirés des écrans (script validé ou fiche relue) : un bloc par écran, un segment = son
 * texte dit, mot pour mot. Ce que la fiche du studio montre (onglet Script) est alors ce que la voix dit. PUR.
 */
export function blocsScriptDesEcrans(ecrans: readonly Pick<EcranCorps, "type" | "texteDit">[], videoId: string): { id: string; blocRecette: string; segments: { id: string; texte: string }[] }[] {
  return ecrans.map((e, i) => ({ id: `${videoId}-b${i + 1}`, blocRecette: BLOC_RECETTE_ECRAN[e.type] ?? "etape", segments: [{ id: idSegmentEcran(videoId, i), texte: e.texteDit.trim() }] }));
}

/* ------------------------------------------------------------------ */
/* Aperçu (V4-3, point 6) : le texte dit et l'ordre des écrans          */
/* ------------------------------------------------------------------ */

/** Nom en clair de chaque type d'écran du corps. */
export const NOMS_ECRANS: Readonly<Record<string, string>> = {
  accroche: "Accroche",
  chiffre: "Chiffre",
  "liste-avant": "Avant",
  titre: "Titre",
  etape: "Étape",
  objet: "Objet",
  preuve: "Preuve",
  resultat: "Résultat",
  question: "Question",
};

export interface EcranApercu {
  /** 1, 2… : l'ordre des écrans. */
  rang: number;
  type: string;
  nom: string;
  texteDit: string;
  /** Textes affichés à l'écran (sans la marque), balises d'accent retirées. */
  affiches: string[];
  /** Les mêmes, bruts (`*mot*` = mot en orange), pour la modification ; et lesquels se modifient (pas le chiffre). */
  ecrits?: string[];
  modifiables?: boolean[];
}

/** Les écrans d'un script, dans l'ordre, pour les montrer à Will avant la voix. */
export function apercuDesEcrans(ecrans: readonly (EcranScript | EcranCorps)[]): EcranApercu[] {
  return ecrans.map((e, i) => {
    let affiches: string[] = [];
    try {
      affiches = textesEcrits(e as Ecran).map((t) => t.replace(/\*/g, ""));
    } catch {
      affiches = [];
    }
    let ecrits: string[] | undefined;
    let modifiables: boolean[] | undefined;
    try {
      ecrits = ecritsDe(e as Ecran);
      modifiables = ecritsModifiables(e as Ecran);
    } catch {
      ecrits = undefined;
    }
    return { rang: i + 1, type: e.type, nom: NOMS_ECRANS[e.type] ?? e.type, texteDit: e.texteDit, affiches, ...(ecrits && modifiables ? { ecrits, modifiables } : {}) };
  });
}
