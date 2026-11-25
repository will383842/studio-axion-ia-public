/**
 * S-15-b1-v21r : appliquer une liste d'opérations sur les plaquettes du plan v4 (calcul pur, éteint : aucun appelant).
 * Ne lève jamais, ne modifie jamais le plan reçu. Seul `elementsV4` change : prise, coupes, voix et cadrage ne sont pas touchés.
 */
import { z } from "zod";
import { nommerPlaquettes } from "./noms-plaquettes";
import { changerTextePlaquette, decalerPlaquette, retirerPlaquette, type ModificationPlaquette } from "./operations-plaquettes";
import { schemaPlanFacecamAnimee, type ElementV4Plan, type PlanFacecamAnimee } from "./plan";

export type OperationPlaquette =
  | { type: "retirer"; uid: string }
  | { type: "changer-texte"; uid: string; mots: string[] }
  | { type: "decaler"; uid: string; decalageSec: number };

const schemaOperation = z.discriminatedUnion("type", [
  z.object({ type: z.literal("retirer"), uid: z.string().min(1).max(200) }).strict(),
  z.object({ type: z.literal("changer-texte"), uid: z.string().min(1).max(200), mots: z.array(z.string()).max(8) }).strict(),
  z.object({ type: z.literal("decaler"), uid: z.string().min(1).max(200), decalageSec: z.number().finite() }).strict(),
]);
const MAX_OPERATIONS = 12;
const REMARQUE_VARIANTE = "Changer l'animation d'une plaquette n'est pas encore possible.";
const REMARQUE_AUTRE = "Une demande sur les plaquettes n'a pas été comprise.";
const REFUS_PLAN = "Ce changement n'est pas possible pour cette vidéo.";

/** Lecture stricte (liste fermée, 12 opérations au plus) ; ce qui est illisible devient une remarque, jamais une exception. */
export function lireOperationsPlaquettes(brut: unknown): { operations: OperationPlaquette[]; remarques: string[] } {
  const operations: OperationPlaquette[] = [];
  const remarques: string[] = [];
  try {
    if (!Array.isArray(brut)) return { operations, remarques: [REMARQUE_AUTRE] };
    for (const [i, x] of brut.entries()) {
      if (i >= MAX_OPERATIONS) { remarques.push(REMARQUE_AUTRE); break; }
      const r = schemaOperation.safeParse(x);
      if (r.success) operations.push(r.data as OperationPlaquette);
      else remarques.push((x as { type?: unknown } | null)?.type === "choisir-variante" ? REMARQUE_VARIANTE : REMARQUE_AUTRE);
    }
  } catch {
    return { operations: [], remarques: [REMARQUE_AUTRE] };
  }
  return { operations, remarques };
}

/** Les plaquettes du plan avec leur nom, pour que le lecteur du chat n'ait pas à connaître le calcul des noms. */
export function listerPlaquettes(plan: PlanFacecamAnimee): Array<{ uid: string; type: string; debut: number; fin: number; mots?: string[] }> {
  try {
    return nommerPlaquettes(plan?.elementsV4 ?? []).map(({ uid, element: e }) => ({ uid, type: e.id, debut: e.debut, fin: e.fin, ...(e.mots ? { mots: [...e.mots] } : {}) }));
  } catch {
    return [];
  }
}

/** Applique les opérations dans l'ordre ; une refusée donne sa raison et les suivantes continuent (la table suit les noms qui changent). */
export function appliquerOperationsPlaquettes(plan: PlanFacecamAnimee, ops: readonly OperationPlaquette[]): { plan: PlanFacecamAnimee; appliquees: number; refus: string[] } {
  const refus: string[] = [];
  try {
    let elements: ElementV4Plan[] = [...(plan.elementsV4 ?? [])];
    const noms = new Map<string, string>();
    let appliquees = 0;
    for (const op of ops) {
      const uid = noms.get(op.uid) ?? op.uid;
      const r: { ok: true; elements: ElementV4Plan[]; uid?: string } | { ok: false; raison: string } =
        op.type === "retirer" ? retirer(elements, uid)
        : op.type === "changer-texte" ? suivre(changerTextePlaquette(elements, uid, op.mots))
        : suivre(decalerPlaquette(elements, uid, op.decalageSec));
      if (!r.ok) { refus.push(r.raison); continue; }
      elements = r.elements;
      if (r.uid) noms.set(op.uid, r.uid);
      appliquees++;
    }
    if (!appliquees) return { plan, appliquees: 0, refus };
    const neuf = { ...plan, elementsV4: elements };
    if (!schemaPlanFacecamAnimee.safeParse(neuf).success) return { plan, appliquees: 0, refus: [...refus, REFUS_PLAN] };
    return { plan: neuf, appliquees, refus };
  } catch {
    return { plan, appliquees: 0, refus: [...refus, REFUS_PLAN] };
  }
}

function retirer(elements: readonly ElementV4Plan[], uid: string) {
  const r = retirerPlaquette(elements, uid);
  return r.ok ? { ok: true as const, elements: r.elements } : r;
}
function suivre(r: ModificationPlaquette) {
  return r.ok ? { ok: true as const, elements: r.elements, uid: r.uid } : r;
}
