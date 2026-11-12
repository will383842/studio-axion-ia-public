/**
 * CAL-11a · ADR 0014 : choix écrit entre une bibliothèque de glisser-déposer et les événements pointer.
 * Lecture de fichiers seulement, aucun appel réel.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FICHIER = join(process.cwd(), "docs", "adr", "0014-reprogrammation-glisser-deposer.md");
const lire = () => readFileSync(FICHIER, "utf8");

describe("ADR 0014 · reprogrammation par glisser-déposer", () => {
  it("le fichier existe, en-tête et sections attendues", () => {
    expect(existsSync(FICHIER)).toBe(true);
    const t = lire();
    expect(t.startsWith("# ADR-0014 · ")).toBe(true);
    expect(t).toMatch(/- Statut : /);
    for (const s of ["## Contexte", "## Options comparées", "## Décision", "## Conséquences"]) expect(t).toContain(s);
  });

  it("compare les deux options sur le poids, le clavier et le téléphone", () => {
    const t = lire().toLowerCase();
    for (const mot of ["bibliothèque", "pointer", "poids", "clavier", "téléphone"]) expect(t, mot).toContain(mot);
  });

  it("tranche explicitement, sans nouvelle dépendance ajoutée par cette fiche", () => {
    const t = lire();
    expect(t).toMatch(/Décision\s*\n+[\s\S]*(retenu|retenue|on retient|nous retenons)/i);
    expect(t).toMatch(/package\.json/);
  });

  it("garde les règles de la maison : bandeau « Annuler » de 10 secondes, vouvoiement, aucun montant", () => {
    const t = lire();
    expect(t).toMatch(/10 secondes/);
    expect(t).not.toMatch(/\d\s?(€|euros?|\$|USD)/i);
  });
});
