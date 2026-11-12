/**
 * IMAGE → VIDÉO · RÉSERVE de scripts et d'idées. PUR : aucun accès base, aucun réseau, aucune horloge (la date est
 * passée en argument). Will y range des scripts (dits tels quels) et des idées (décrites avec ses mots) ; chaque clic
 * « Fabriquer » en prend UN, le premier à faire par rang. Rien ne se lance seul.
 *
 * États : à faire → en cours → fait. Un élément retiré passe à « retiré » : il est CONSERVÉ, jamais supprimé, et les
 * faits ne sont jamais purgés. Le plafond de 300 compte ce qui reste à fabriquer (à faire + en cours).
 */
import { CARACTERES_MAX, refusTexte } from "@/moteurs/montage-image-video/texte/conception";
import { refusScriptColle } from "@/moteurs/montage-image-video/texte/script-limites";

export const RESERVE_MAX_IV = 300;
/** Un élément « en cours » sans vidéo liée au-delà de ce délai est un orphelin (lancement interrompu). */
export const ORPHELIN_APRES_MS_IV = 15 * 60 * 1000;
export const NOTE_A_RELIRE_IV = "à relire";

export type NatureReserveIV = "script" | "idee";
export type EtatReserveIV = "a-faire" | "en-cours" | "fait" | "retire";

export interface ElementReserveIV {
  id: string;
  nature: NatureReserveIV;
  texte: string;
  reseaux: string[];
  etat: EtatReserveIV;
  /** Ordre de fabrication (croissant). Un retour en « à faire » passe en fin de file : nouveau rang. */
  rang: number;
  ajouteLe: string;
  /** ISO, posé AVANT l'appel de lancement. */
  lanceeLe?: string;
  videoId?: string;
  /** Lancements tentés (un par retour en « à faire »). */
  essais: number;
  note?: string;
  /** Un script refusé comme script mais accepté comme texte est devenu une idée. */
  resserre?: boolean;
}

export interface ReserveIV {
  version: "reserve-iv/1";
  elements: ElementReserveIV[];
}

export const reserveVideIV = (): ReserveIV => ({ version: "reserve-iv/1", elements: [] });

export const PHRASES_RESERVE_IV = Object.freeze({
  pleine: `La réserve est pleine (${RESERVE_MAX_IV} éléments à fabriquer) : fabriquez-en ou retirez-en avant d'en ajouter.`,
  videVide: "Écrivez d'abord le script ou l'idée.",
  panne: "Un souci est survenu pendant le lancement : l'élément est remis à faire, à relire.",
});

export type IssueAjoutIV = { ok: true; reserve: ReserveIV; element: ElementReserveIV } | { ok: false; phrase: string };

/** Coupe à `max` unités sans couper un emoji (ou toute paire de substitution) en deux. */
function couper(t: string, max: number): string {
  let sortie = "";
  for (const c of Array.from(t)) {
    if (sortie.length + c.length > max) break;
    sortie += c;
  }
  return sortie;
}

const net = (t: string) => t.normalize("NFC").trim();
const rangSuivant = (r: ReserveIV) => r.elements.reduce((m, e) => Math.max(m, e.rang), 0) + 1;
const nbAFabriquer = (r: ReserveIV) => r.elements.filter((e) => e.etat === "a-faire" || e.etat === "en-cours").length;

function changer(r: ReserveIV, id: string, f: (e: ElementReserveIV) => ElementReserveIV | null): ReserveIV {
  const i = r.elements.findIndex((e) => e.id === id);
  if (i < 0) return r;
  const suivant = f(r.elements[i]);
  if (!suivant) return r;
  const elements = [...r.elements];
  elements[i] = suivant;
  return { ...r, elements };
}

/**
 * Ajoute un script ou une idée à la fin de la file. Un script que les bornes du script refusent mais que les bornes du
 * texte acceptent devient une idée (`resserre`) ; un texte de plus de CARACTERES_MAX est coupé (un script devient alors une idée) ; seul un texte vide est refusé. `id` et `ajouteLe` viennent de l'appelant.
 */
export function ajouterIV(r: ReserveIV, e: { nature: NatureReserveIV; texte: string; reseaux: readonly string[] }, id: string, ajouteLe: string): IssueAjoutIV {
  let texte = net(typeof e.texte === "string" ? e.texte : "");
  if (!texte) return { ok: false, phrase: PHRASES_RESERVE_IV.videVide };
  if (nbAFabriquer(r) >= RESERVE_MAX_IV) return { ok: false, phrase: PHRASES_RESERVE_IV.pleine };
  let nature = e.nature;
  let resserre = false;
  // Au-delà de la borne du texte, rien ne partirait : on coupe, et un script devient une idée resserrée.
  if (texte.length > CARACTERES_MAX) {
    texte = net(couper(texte, CARACTERES_MAX));
    if (nature === "script") {
      nature = "idee";
      resserre = true;
    }
  }
  if (nature === "script" && refusScriptColle(texte) && !refusTexte(texte)) {
    nature = "idee";
    resserre = true;
  }
  const element: ElementReserveIV = { id, nature, texte, reseaux: [...e.reseaux], etat: "a-faire", rang: rangSuivant(r), ajouteLe, essais: 0, ...(resserre ? { resserre: true } : {}) };
  return { ok: true, reserve: { ...r, elements: [...r.elements, element] }, element };
}

/** Le premier élément à faire, par rang. */
export function prochainIV(r: ReserveIV): ElementReserveIV | null {
  return [...r.elements].filter((e) => e.etat === "a-faire").sort((a, b) => a.rang - b.rang)[0] ?? null;
}

/** Pose « en cours » et `lanceeLe` AVANT l'appel de lancement (un redémarrage retrouve alors l'orphelin). */
export function marquerLancementIV(r: ReserveIV, id: string, lanceeLe: string): ReserveIV {
  return changer(r, id, (e) => {
    if (e.etat !== "a-faire" && e.etat !== "en-cours") return null;
    const { videoId: _v, ...reste } = e;
    return { ...reste, etat: "en-cours", lanceeLe };
  });
}

export function lierVideoIV(r: ReserveIV, id: string, videoId: string): ReserveIV {
  return changer(r, id, (e) => (e.etat === "en-cours" ? { ...e, videoId } : null));
}

/** Retour en « à faire », en fin de file, avec un essai de plus. */
export function remettreAFaireIV(r: ReserveIV, id: string, note?: string): ReserveIV {
  const rang = rangSuivant(r);
  return changer(r, id, (e) => {
    if (e.etat !== "en-cours") return null;
    const { videoId: _v, lanceeLe: _l, note: _n, ...reste } = e;
    return { ...reste, etat: "a-faire", rang, essais: e.essais + 1, ...(note ? { note } : {}) };
  });
}

/** Ce que le travail (ou l'absence de vidéo) dit d'un élément en cours. */
export type IssueReserveIV = "en-fabrication" | "faite" | "mise-de-cote" | "arret" | "annulee" | "supprimee";

/**
 * Applique l'issue de la vidéo liée. Idempotent : le retour en « à faire » efface le `videoId`, donc relire la même issue
 * ne compte pas un second essai ; un fait reste fait.
 */
export function appliquerIssueReserveIV(r: ReserveIV, id: string, issue: IssueReserveIV): ReserveIV {
  const e = r.elements.find((x) => x.id === id);
  if (!e || e.etat !== "en-cours" || !e.videoId) return r;
  if (issue === "faite") return changer(r, id, (x) => ({ ...x, etat: "fait" }));
  if (issue === "mise-de-cote") return e.note === NOTE_A_RELIRE_IV ? r : changer(r, id, (x) => ({ ...x, note: NOTE_A_RELIRE_IV }));
  if (issue === "arret" || issue === "annulee" || issue === "supprimee") return remettreAFaireIV(r, id);
  return r;
}

/** Retire un élément à faire (conservé, état « retiré »). Les autres états ne se retirent pas. */
export function retirerIV(r: ReserveIV, id: string): ReserveIV {
  return changer(r, id, (e) => (e.etat === "a-faire" ? { ...e, etat: "retire" } : null));
}

/** Un élément en cours, sans vidéo, lancé depuis plus de 15 minutes : le lancement a été interrompu. */
export function orphelinIV(r: ReserveIV, maintenant: string): ElementReserveIV | null {
  const t = Date.parse(maintenant);
  return (
    r.elements.find((e) => {
      if (e.etat !== "en-cours" || e.videoId || !e.lanceeLe) return false;
      const l = Date.parse(e.lanceeLe);
      return Number.isFinite(l) && Number.isFinite(t) && t - l > ORPHELIN_APRES_MS_IV;
    }) ?? null
  );
}
