/**
 * Tri d'une vidéo (X4-06a) : gardés, peut-être, ignorés, « rien à retenir ». Fonction pure : aucune date, aucun hasard,
 * entrées jamais modifiées. Déplacé dans `NE/trier.ts` (ré-export) par X4-06b ; rien ne l'appelle encore.
 */
import { noter, SEUILS_PAR_DEFAUT } from "@/briques/note-extraits";
import type { ContexteNote, Moment, NoteMoment, ResultatTri, SeuilsNoteInteret, UsageExtrait } from "@/briques/note-extraits";

export const PEUT_ETRE_MAX = 12;
export const SEUIL_CHEVAUCHEMENT = 0.5;
export const RAISON_CHEVAUCHEMENT = "chevauchement";
export const RAISON_PLAFOND = "plafond";
export const RAISON_PEU_D_INTERET = "peu-d-interet";
const RAISON_EXCLU_DROIT = "exclu-droit";

type Note = Moment & NoteMoment;

export interface OptionsTri {
  etiqueter?: (m: Moment) => UsageExtrait[];
}

const parNoteId = (a: Note, b: Note): number => b.note - a.note || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function communSec(a: Moment, b: Moment): number {
  return Math.max(0, Math.min(a.finSec, b.finSec) - Math.max(a.debutSec, b.debutSec));
}

function chevauche(a: Moment, b: Moment): boolean {
  const court = Math.min(a.finSec - a.debutSec, b.finSec - b.debutSec);
  return communSec(a, b) > SEUIL_CHEVAUCHEMENT * court;
}

/** Raison d'un moment sous le seuil : exclu-droit, sinon le code au plus fort malus, sinon « peu-d-interet ». */
function raisonDIgnore(m: Note): string {
  if (m.raisons.some((r) => r.code === RAISON_EXCLU_DROIT)) return RAISON_EXCLU_DROIT;
  let pire: { code: string; points: number } | null = null;
  for (const r of m.raisons) {
    if (r.points < 0 && (pire === null || r.points < pire.points || (r.points === pire.points && r.code < pire.code))) pire = r;
  }
  return pire ? pire.code : RAISON_PEU_D_INTERET;
}

export function trierVideo(
  moments: readonly Moment[],
  contexte: ContexteNote | ((m: Moment) => ContexteNote),
  seuils: SeuilsNoteInteret = SEUILS_PAR_DEFAUT,
  options?: OptionsTri,
): ResultatTri {
  const notes: Note[] = moments.map((m) => {
    const n = noter(m, typeof contexte === "function" ? contexte(m) : contexte);
    const exclu = n.raisons.some((r) => r.code === RAISON_EXCLU_DROIT);
    const decision: NoteMoment["decision"] = exclu ? "ignore" : n.note >= seuils.garde ? "garde" : n.note >= seuils.peutEtre ? "peut-etre" : "ignore";
    const usages = options?.etiqueter ? [...options.etiqueter(m)] : [...n.usages];
    return { ...m, ...n, raisons: n.raisons.map((r) => ({ ...r })), usages, decision };
  });

  const raisonsIgnores: string[] = [];
  const candidats: Note[] = [];
  for (const n of notes) {
    if (n.decision === "ignore") raisonsIgnores.push(raisonDIgnore(n));
    else candidats.push(n);
  }
  candidats.sort(parNoteId);

  const retenus: Note[] = [];
  for (const c of candidats) {
    if (retenus.some((r) => chevauche(r, c))) raisonsIgnores.push(RAISON_CHEVAUCHEMENT);
    else retenus.push(c);
  }

  const gardes: Note[] = [];
  const peutEtre: Note[] = [];
  for (const r of retenus) {
    if (r.decision === "garde" && gardes.length < seuils.gardesMax) gardes.push({ ...r, decision: "garde" });
    else peutEtre.push({ ...r, decision: "peut-etre" });
  }
  // Le surplus de gardés rejoint les peut-être : on remet l'ensemble dans l'ordre note décroissante puis id.
  peutEtre.sort(parNoteId);
  const surplus = peutEtre.splice(PEUT_ETRE_MAX).length;
  for (let i = 0; i < surplus; i++) raisonsIgnores.push(RAISON_PLAFOND);

  const freq = new Map<string, number>();
  for (const r of raisonsIgnores) freq.set(r, (freq.get(r) ?? 0) + 1);
  let raisonPrincipale: string | null = null;
  let max = 0;
  for (const code of [...freq.keys()].sort()) {
    const f = freq.get(code) as number;
    if (f > max) { max = f; raisonPrincipale = code; }
  }

  return { gardes, peutEtre, ignores: { nombre: raisonsIgnores.length, raisonPrincipale }, rienARetenir: gardes.length === 0 };
}
