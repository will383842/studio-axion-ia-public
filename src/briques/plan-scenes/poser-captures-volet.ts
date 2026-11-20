import type { PlanValide } from "./schema";

/** Pièce du volet avant/après (comparée en chaîne). */
export const ID_VOLET = "objet-volet-avant-apres";

type Captures = { avant: string; apres: string };
type Obj = Record<string, unknown>;

const estObjet = (x: unknown): x is Obj => typeof x === "object" && x !== null;
const estVolet = (x: unknown): boolean => estObjet(x) && String(x.piece) === ID_VOLET;
const lisible = (c: unknown): c is Captures =>
  estObjet(c) && typeof c.avant === "string" && typeof c.apres === "string" && c.avant !== "" && c.apres !== "" && c.avant !== c.apres;

const contientVolet = (plan: unknown): boolean =>
  estObjet(plan) && Array.isArray(plan.scenes) && plan.scenes.some((s) => estVolet(s) || (estObjet(s) && Array.isArray(s.calques) && s.calques.some(estVolet)));

/** Copie de rendu : pose les deux adresses sur le volet, ou le retire (jamais un cadre vide, jamais un exemple). Pure, ne lève pas. */
export function poserCapturesVolet(plan: PlanValide, captures: Captures | null): PlanValide {
  try {
    if (!contientVolet(plan)) return plan;
    const copie = structuredClone(plan) as unknown as { scenes: Obj[] };
    const ok = lisible(captures) ? captures : null;
    const poser = (o: Obj) => {
      o.parametres = { ...(estObjet(o.parametres) ? o.parametres : {}), avant: ok!.avant, apres: ok!.apres };
    };
    const scenes: Obj[] = [];
    for (const s of copie.scenes) {
      if (estVolet(s)) {
        if (ok) { poser(s); scenes.push(s); }
        continue;
      }
      if (estObjet(s) && Array.isArray(s.calques)) {
        const calques: Obj[] = [];
        for (const c of s.calques as Obj[]) {
          if (!estVolet(c)) calques.push(c);
          else if (ok) { poser(c); calques.push(c); }
        }
        s.calques = calques;
      }
      scenes.push(s);
    }
    copie.scenes = scenes;
    return copie as unknown as PlanValide;
  } catch {
    try {
      const copie = structuredClone(plan) as unknown as { scenes: unknown[] };
      copie.scenes = (copie.scenes ?? []).filter((s) => !estVolet(s));
      return copie as unknown as PlanValide;
    } catch {
      return plan;
    }
  }
}
