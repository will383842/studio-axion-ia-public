/** C9-42a : filet « aucune ligne `objet.*` ne sort de `prevu` sans pièce livrée ». Test seul, rien n'est allumé. */
import { beforeAll, describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { CAPACITES_OBJET } from "@/briques/motion/petits-objets/contrat";
import { LIGNES_OBJETS } from "@/briques/bibliotheque-video/catalogue/objets";
import type { LigneCatalogue } from "@/briques/bibliotheque-video/catalogue/types";

interface PieceLivree {
  id: string;
  capacite: string;
}

const DOSSIER = join(process.cwd(), "src/briques/motion/petits-objets");

function ressembleADefinition(v: unknown): v is PieceLivree {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" && o.id.startsWith("objet-") &&
    typeof o.capacite === "string" && o.capacite.startsWith("objet.") &&
    typeof o.valider === "function" && typeof o.Rendu === "function"
  );
}

/** Balaye les `*.tsx` de `PO`, garde chaque export qui a la forme d'une définition, dédoublonné par identité. */
async function piecesLivrees(): Promise<PieceLivree[]> {
  const vues = new Set<unknown>();
  for (const f of readdirSync(DOSSIER).filter((n) => n.endsWith(".tsx")).sort()) {
    const mod = (await import(`@/briques/motion/petits-objets/${f.replace(/\.tsx$/, "")}`)) as Record<string, unknown>;
    for (const v of Object.values(mod)) if (ressembleADefinition(v)) vues.add(v);
  }
  return [...vues] as PieceLivree[];
}

/** Lignes `objet.*` ni `prevu` ni `absent` dont aucune pièce ne porte la capacité. */
function lignesSansPiece(lignes: readonly LigneCatalogue[], pieces: readonly PieceLivree[]): LigneCatalogue[] {
  const portees = new Set(pieces.map((p) => p.capacite));
  return lignes.filter(
    (l) => l.id.startsWith("objet.") && (l.etat as string) !== "prevu" && (l.etat as string) !== "absent" && !portees.has(l.id),
  );
}

describe("C9-42a : objets livrés", () => {
  let pieces: PieceLivree[] = [];
  beforeAll(async () => {
    pieces = await piecesLivrees();
  });

  it("aucune ligne objet.* hors prevu/absent sans pièce livrée", () => {
    expect(lignesSansPiece(LIGNES_OBJETS, pieces)).toEqual([]);
  });

  it("le balayage trouve les pièces connues et rien hors CAPACITES_OBJET", () => {
    const ids = pieces.map((p) => p.id);
    expect(pieces.length).toBeGreaterThanOrEqual(4);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of pieces) expect(CAPACITES_OBJET as readonly string[]).toContain(p.capacite);
  });

  it("le balayage voit chacun des 4 fichiers de référence", async () => {
    for (const f of ["anneau-donnees", "appel-action", "gros-chiffre", "cadres"]) {
      const mod = (await import(`@/briques/motion/petits-objets/${f}`)) as Record<string, unknown>;
      const defs = Object.values(mod).filter(ressembleADefinition);
      expect(defs.length, f).toBeGreaterThan(0);
      for (const d of defs) expect(pieces).toContain(d);
    }
  });

  it("la garde mord : objet.emoji eteint est listé, objet.chiffre eteint non", () => {
    // BR-OBJETS-2027-a (amendement n°1) : objet.manuscrit est désormais porté par « objet-croquis » ; objet.emoji (CAPACITES_OBJET) n'est porté par aucune pièce du registre.
    const faux = { id: "objet.emoji", etat: "eteint", chantier: "9" } as unknown as LigneCatalogue;
    const bon = { id: "objet.chiffre", etat: "eteint", chantier: "9" } as unknown as LigneCatalogue;
    expect(lignesSansPiece([faux], pieces)).toEqual([faux]);
    expect(lignesSansPiece([bon], pieces)).toEqual([]);
  });

  it("constat (journal) : capacité → nombre de pièces", () => {
    const table: Record<string, number> = {};
    for (const c of CAPACITES_OBJET) table[c] = pieces.filter((p) => p.capacite === c).length;
    console.log("CAPACITE_PIECES", JSON.stringify(table));
    expect(Object.keys(table).length).toBe(CAPACITES_OBJET.length);
  });
});
