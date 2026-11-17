/**
 * Enveloppe « objet → pièce du plan de scènes » (C9-34a). PURE : aucune inscription, aucun composant Remotion, aucun
 * hook. Prend une liste de définitions en paramètre ; n'est importée par rien (C9-34b l'appellera avec le registre).
 * Lu par le rendu : imports relatifs seulement.
 */
import type { JSX } from "react";
import { z, type ZodType } from "zod";
import { verifierDefinition, type DefinitionObjet, type IdPetitObjet } from "../../motion/petits-objets/contrat";
import type { ProprietesBrique } from "./communs";

export interface PieceObjet {
  schema: ZodType;
  toile: { largeur: number; hauteur: number };
  dureeSec: { min: number; max: number };
  Rendu(p: ProprietesBrique<unknown>): JSX.Element;
}

export interface ObjetEcarte {
  id: string;
  refus: string;
}

/** Les définitions conformes deviennent des pièces ; les autres sont écartées avec leur motif. */
export function envelopperObjetsAvecEcartes(
  defs: readonly DefinitionObjet<unknown>[],
  graineDe: (id: string) => number,
): { pieces: Record<IdPetitObjet, PieceObjet>; ecartees: ObjetEcarte[] } {
  const pieces = {} as Record<IdPetitObjet, PieceObjet>;
  const ecartees: ObjetEcarte[] = [];
  for (const def of defs) {
    let verdict: "ok" | { refus: string };
    try {
      verdict = verifierDefinition(def);
    } catch {
      verdict = { refus: "définition illisible" };
    }
    if (verdict !== "ok") {
      ecartees.push({ id: String(def?.id), refus: verdict.refus });
      continue;
    }
    pieces[def.id] = {
      schema: z.unknown().superRefine((v, ctx) => {
        let ok = false;
        try {
          ok = def.valider(v) !== null;
        } catch {
          ok = false;
        }
        if (!ok) ctx.addIssue({ code: "custom", message: `paramètres refusés par ${def.id}` });
      }),
      toile: def.toile,
      dureeSec: def.dureeSec,
      Rendu: (p) =>
        def.Rendu({
          image: p.image,
          fps: p.fps,
          dureeImages: p.dureeImages,
          fond: p.fond,
          accent: p.accent,
          parametres: p.parametres,
          ton: "neutre",
          graine: graineDe(def.id),
        }),
    };
  }
  return { pieces, ecartees };
}

export function envelopperObjets(defs: readonly DefinitionObjet<unknown>[], graineDe: (id: string) => number): Record<IdPetitObjet, PieceObjet> {
  return envelopperObjetsAvecEcartes(defs, graineDe).pieces;
}
