/**
 * EXPORT PARTIEL (lot R4) — PUR. Un « export » est une sortie du plan (un format d'image, ou la version d'un réseau).
 * Son empreinte réunit : son format, les empreintes des SEULES scènes qu'il contient, l'habillage et l'empreinte de la
 * voix. Après une retouche, seuls les exports dont l'empreinte change sont refaits ; les autres sont gardés tels quels.
 * Aucun prix, aucun refus : une phrase en mots simples.
 */
import { fnv1a64, jsonCanonique } from "@/briques/plan-scenes/empreinte";
import type { PlanValide } from "@/briques/plan-scenes/schema";

export interface CibleExport {
  id: string;
  /** Format d'image (« 4:5 », « 9:16 », « 1:1 »). */
  format: string;
  /** Scènes contenues dans cet export ; absent : toutes. */
  scenes?: string[];
}

export interface OptionsExport {
  /** Empreinte de la voix (change seulement après « modifie le script »). */
  voix?: string;
}

export function empreinteExport(plan: PlanValide, cible: CibleExport, voix = ""): string {
  const retenues = cible.scenes ? new Set(cible.scenes) : null;
  const scenes = plan.scenes.filter((s) => !retenues || retenues.has(s.id)).map((s) => [s.id, s.empreinte]);
  return fnv1a64(jsonCanonique({ id: cible.id, format: cible.format, habillage: plan.habillage, scenes, voix }));
}

export interface ExportsARefaire {
  aRefaire: string[];
  gardes: string[];
  phrase: string;
}

export function exportsARefaire(ancien: PlanValide, nouveau: PlanValide, cibles: readonly CibleExport[], options: { voix?: string; voixAvant?: string } = {}): ExportsARefaire {
  const aRefaire: string[] = [];
  const gardes: string[] = [];
  for (const c of cibles) {
    const change = empreinteExport(ancien, c, options.voixAvant ?? "") !== empreinteExport(nouveau, c, options.voix ?? "");
    (change ? aRefaire : gardes).push(c.id);
  }
  const n = aRefaire.length;
  const phrase =
    n === 0
      ? "Aucun format n'est à refaire."
      : n === cibles.length
        ? `${n === 1 ? "Le format sera refait" : "Les " + n + " formats seront refaits"}.`
        : `${n} format${n > 1 ? "s" : ""} sur ${cibles.length} ${n > 1 ? "seront refaits" : "sera refait"}, les autres restent tels quels.`;
  return { aRefaire, gardes, phrase };
}
