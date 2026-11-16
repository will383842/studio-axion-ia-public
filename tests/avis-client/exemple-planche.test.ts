/** C8-A05 : garde de l'outil local « planche d'avis d'exemple ». Aucun faux avis hors `outils/` et des tests. */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import * as exemples from "../../outils/avis-client/exemple";
import { figerAvisPourLaCommande } from "../../src/domaine/avis-client/gel";

const RACINE = resolve(__dirname, "..", "..");
const avis = Object.values(exemples).flat() as Array<{ id: string; exemple?: boolean; statut: string }>;

function sources(dossier: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dossier)) {
    if (nom === "node_modules" || nom.startsWith(".")) continue;
    const p = join(dossier, nom);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.(tsx?|mts|js|mjs|json)$/.test(nom)) out.push(p);
  }
  return out;
}

describe("avis d'exemple (outil local)", () => {
  it("expose au moins trois variantes (note 5, note 3, texte long)", () => expect(avis.length).toBeGreaterThanOrEqual(3));
  it("chaque avis est un exemple, jamais publié", () => {
    for (const a of avis) {
      expect(a.exemple).toBe(true);
      expect(a.statut).not.toBe("published");
    }
  });
  it("figerAvisPourLaCommande les refuse", () => {
    for (const a of avis) expect(() => figerAvisPourLaCommande(avis as never, a.id, "2026-11-16")).toThrow();
  });
  it("aucun fichier de src/ ni studio-rendu/ ne référence l'outil ou AVIS_EXEMPLE", () => {
    for (const d of ["src", "studio-rendu"]) {
      for (const f of sources(join(RACINE, d))) {
        const t = readFileSync(f, "utf8");
        expect(t.includes("outils/avis-client"), f).toBe(false);
        expect(t.includes("AVIS_EXEMPLE"), f).toBe(false);
      }
    }
  });
  it("planche.mts mentionne exemple et pas Racine", () => {
    const t = readFileSync(join(RACINE, "outils/avis-client/planche.mts"), "utf8");
    expect(t).toContain("exemple");
    expect(t).not.toContain("Racine");
  });
});
