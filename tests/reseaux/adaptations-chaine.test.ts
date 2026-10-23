/**
 * Lot D · relecture Opus : `segmentsFacultatifsRetenus` ne s'applique QU'APRÈS `segmentRetenu` / `assemblerBlocs`,
 * sur une liste déjà filtrée. Réglage coupé = identité de ce que le code actuel retient (pas « tout garder »).
 */
import { describe, expect, it } from "vitest";
import { assemblerBlocs } from "@/domaine/derivations-generateur";
import { segmentsFacultatifsRetenus } from "@/reseaux/adaptations";
import type { BlocScript, ReseauDeclinaison, VarianteReseau } from "@/domaine/types";

const seg = (id: string, facultatif?: ReseauDeclinaison) => ({ id, texte: id, ...(facultatif ? { facultatif } : {}) });
const blocs = [
  { id: "b1", blocRecette: "coeur", segments: [seg("milieu"), seg("fac-li-1", "linkedin"), seg("fac-li-2", "linkedin"), seg("fac-tt", "tiktok")] },
] as unknown as BlocScript[];
const DUREES: Record<string, number> = { "fac-li-1": 6, "fac-li-2": 5, "fac-tt": 4 };

const variante = (reseau: ReseauDeclinaison, retenu: boolean) =>
  ({ reseau, ouverture: [], fin: [], segmentFacultatifRetenu: retenu }) as unknown as Pick<VarianteReseau, "ouverture" | "fin" | "reseau" | "segmentFacultatifRetenu">;

/** La chaîne réelle : assemblage (filtre du code actuel) puis adaptation sur ce qui reste. */
function chaine(actif: boolean, reseau: ReseauDeclinaison, retenu: boolean, dureeSansFacultatifSec: number) {
  const assemble = assemblerBlocs({ blocs }, variante(reseau, retenu));
  const facultatifs = assemble.flatMap((b) => b.segments).filter((s) => s.facultatif).map((s) => ({ id: s.id, dureeSec: DUREES[s.id]! }));
  return { facultatifs: facultatifs.map((f) => f.id), retenus: segmentsFacultatifsRetenus({ actif, origine: "machine", reseau, dureeSansFacultatifSec, facultatifs }) };
}

describe("segmentsFacultatifsRetenus après assemblerBlocs", () => {
  it("réglage coupé : identité exacte de ce qu'assemblerBlocs retient, pas « tout garder »", () => {
    expect(chaine(false, "linkedin", true, 50)).toEqual({ facultatifs: ["fac-li-1", "fac-li-2"], retenus: ["fac-li-1", "fac-li-2"] });
    expect(chaine(false, "linkedin", false, 50)).toEqual({ facultatifs: [], retenus: [] });
    expect(chaine(false, "instagram", true, 50)).toEqual({ facultatifs: [], retenus: [] });
  });
  it("réglage allumé : seul le plafond de durée de LinkedIn coupe, sur la liste déjà filtrée", () => {
    expect(chaine(true, "linkedin", true, 30).retenus).toEqual(["fac-li-1", "fac-li-2"]);
    expect(chaine(true, "linkedin", true, 52).retenus).toEqual(["fac-li-1"]);
    expect(chaine(true, "linkedin", true, 58).retenus).toEqual([]);
  });
  it("réglage allumé : un segment que segmentRetenu a écarté ne revient jamais", () => {
    expect(chaine(true, "linkedin", false, 10).retenus).toEqual([]);
    expect(chaine(true, "facebook", true, 10).retenus).toEqual([]);
  });
});
