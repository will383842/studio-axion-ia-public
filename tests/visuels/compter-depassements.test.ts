import { describe, expect, it } from "vitest";
import { compterDepassements } from "../../scripts/visuels/compter-depassements";

const carte = (corps: string) => ({ titre: "Un titre", corps });
const spec = (corps: string) => ({
  version: "carrousel/1",
  alt: "Un carrousel de test",
  pages: [{ type: "T01", titre: "Un titre" }, { type: "T02", titre: "Deux cartes", cartes: [carte(corps), carte("Court")] }, { type: "T21" }],
});
const visuel = (id: string, statut: string, corps: string, en: Record<string, unknown> = {}) => ({ id, data: { statut, spec: spec(corps), ...en } });

describe("compter-depassements (lecture seule, sans contenu)", () => {
  it("liste les non rendus dont une carte à 2 cartes dépasse 130 signes (240 avant), sans citer le texte", () => {
    const long = "mot ".repeat(55).trim(); // 219 signes : passait à 240, plus à 130
    const r = compterDepassements([visuel("vis_a", "ecrit", long), visuel("vis_b", "ecrit", "court")]);
    expect(r.map((d) => d.id)).toEqual(["vis_a"]);
    expect(r[0].champs.join(" ")).toContain("130 signes au plus");
    expect(JSON.stringify(r)).not.toContain("mot mot");
  });
  it("ignore les statuts déjà rendus, la corbeille, la démonstration et les specs absents", () => {
    const long = "mot ".repeat(55).trim();
    const r = compterDepassements([
      visuel("vis_valide", "valide", long),
      visuel("vis_a_valider", "a_valider", long),
      visuel("vis_corbeille", "refuse", long, { corbeilleLe: "2026-10-01" }),
      visuel("vis_demo", "ecrit", long, { estDemo: true }),
      { id: "vis_sans_spec", data: { statut: "brouillon" } },
      visuel("vis_refuse", "refuse", long),
      visuel("vis_echec", "echec_rendu", long),
    ]);
    expect(r.map((d) => d.id)).toEqual(["vis_refuse", "vis_echec"]);
  });
  it("le script n'écrit jamais : session en lecture seule, aucune requête d'écriture", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../scripts/visuels/compter-depassements.ts", import.meta.url), "utf8");
    expect(src).toContain("default_transaction_read_only=on");
    expect(src).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\s/);
    expect(src).not.toMatch(/postgres(ql)?:\/\/[^"'\s]+:[^"'\s]+@/);
  });
});
