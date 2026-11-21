import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PIECES_VALIDEES_SUR_PLANCHE, restreindreAuxPiecesValidees } from "@/briques/plan-scenes-objets/pieces-validees";
import { OBJETS_INSCRITS } from "@/briques/plan-scenes-objets/registre";

const TOUTES = OBJETS_INSCRITS.map((d) => d.id);

describe("pièces validées sur planche (C10-04-a)", () => {
  it("la liste fermée ne contient aujourd'hui que le carton magazine, et elle est gelée", () => {
    expect([...PIECES_VALIDEES_SUR_PLANCHE]).toEqual(["objet-carton-magazine"]);
    expect(Object.isFrozen(PIECES_VALIDEES_SUR_PLANCHE)).toBe(true);
  });

  it("capacité objet.etiquette + toutes les pièces du registre → seul objet-carton-magazine sort", () => {
    expect(TOUTES).toContain("objet-carton-magazine");
    expect(restreindreAuxPiecesValidees(TOUTES, "objet.etiquette")).toEqual(["objet-carton-magazine"]);
  });

  it("une pièce inconnue n'entre jamais (capacité objet.etiquette)", () => {
    expect(restreindreAuxPiecesValidees(["objet-inconnu", "objet-carton-magazine"], "objet.etiquette")).toEqual(["objet-carton-magazine"]);
    expect(restreindreAuxPiecesValidees(["objet-inconnu"], "objet.etiquette")).toEqual([]);
  });

  it("les autres capacités passent inchangées", () => {
    const ids = ["objet-a", "objet-b"];
    expect(restreindreAuxPiecesValidees(ids, "objet.telephone")).toEqual(ids);
  });

  it("entrée vide ou illisible : [] sans exception", () => {
    expect(restreindreAuxPiecesValidees([], "objet.etiquette")).toEqual([]);
    expect(restreindreAuxPiecesValidees(null as never, "objet.etiquette")).toEqual([]);
  });

  it("éteint par absence d'importeur : aucun fichier de src/ hors du module ne l'importe", () => {
    const lit = (d: string): string[] => {
      return readdirSync(d).flatMap((n) => {
        const p = join(d, n);
        return statSync(p).isDirectory() ? lit(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    };
    const citeurs = lit(join(process.cwd(), "src")).filter((f) => !f.endsWith("pieces-validees.ts") && readFileSync(f, "utf8").includes("pieces-validees"));
    expect(citeurs).toEqual([]);
  });
});
