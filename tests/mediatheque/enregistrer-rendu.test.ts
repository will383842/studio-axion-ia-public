import { describe, expect, it } from "vitest";
import type { Fichier } from "@/domaine/types";
import type { RenduVisuel } from "@/domaine/visuels/visuel";
import { enregistrerRendu, type DepotFichiers } from "@/services/mediatheque-rendus";

function depotFaux(): DepotFichiers & { tout: Map<string, Fichier>; ecritures: number } {
  const tout = new Map<string, Fichier>();
  const d = {
    tout,
    ecritures: 0,
    async obtenir(id: string) { return tout.get(id) ?? null; },
    async enregistrer(f: Fichier) { d.ecritures++; tout.set(f.id, f); return f; },
  };
  return d;
}
const rendu = (n: number): RenduVisuel => ({
  empreinte: "e".repeat(64),
  pdfCle: "studio/dev/visuel/vis_a/carrousel.pdf",
  vignetteCle: "studio/dev/visuel/vis_a/page-1@1x.png",
  pages: Array.from({ length: n }, (_, i) => ({ index: i, x1Cle: `studio/dev/visuel/vis_a/page-${i + 1}@1x.png`, x2Cle: `studio/dev/visuel/vis_a/page-${i + 1}@2x.png` })),
  renduLe: "2026-11-11T10:00:00.000Z",
});
const MAINTENANT = () => "2026-11-11T10:05:00.000Z";

describe("enregistrerRendu", () => {
  it("6 pages = 6 Fichier + 1 PDF", async () => {
    const d = depotFaux();
    const r = await enregistrerRendu({ visuelId: "vis_a", rendu: rendu(6), depot: d, maintenant: MAINTENANT });
    expect(r.pages).toHaveLength(6);
    expect(d.tout.size).toBe(7);
    expect(r.pdf.mime).toBe("application/pdf");
    expect(r.pages.every((f) => f.mime === "image/png")).toBe(true);
    for (const f of d.tout.values()) {
      expect(f.statut).toBe("pret");
      expect(f.origine).toBe("fabrication");
      expect(f.cleStockage.split("/")[2]).toBe("visuel");
      expect(f.cleStockage.split("/")[3]).toBe("vis_a");
    }
  });
  it("un rejeu ne crée aucun doublon et n'écrit rien de plus", async () => {
    const d = depotFaux();
    const a = await enregistrerRendu({ visuelId: "vis_a", rendu: rendu(6), depot: d, maintenant: MAINTENANT });
    const ecrits = d.ecritures;
    const b = await enregistrerRendu({ visuelId: "vis_a", rendu: rendu(6), depot: d, maintenant: () => "2027-01-01T00:00:00.000Z" });
    expect(d.tout.size).toBe(7);
    expect(d.ecritures).toBe(ecrits);
    expect(b.pdf.id).toBe(a.pdf.id);
    expect(b.pages.map((f) => f.id)).toEqual(a.pages.map((f) => f.id));
    expect(b.pdf.creeLe).toBe(a.pdf.creeLe);
  });
  it("un rendu plus long n'ajoute que les pages nouvelles", async () => {
    const d = depotFaux();
    await enregistrerRendu({ visuelId: "vis_a", rendu: rendu(6), depot: d, maintenant: MAINTENANT });
    await enregistrerRendu({ visuelId: "vis_a", rendu: rendu(8), depot: d, maintenant: MAINTENANT });
    expect(d.tout.size).toBe(9);
  });
  it("refuse une clé invalide sans rien écrire", async () => {
    const d = depotFaux();
    const mauvais = { ...rendu(2), pdfCle: "../sortie.pdf" };
    await expect(enregistrerRendu({ visuelId: "vis_a", rendu: mauvais, depot: d, maintenant: MAINTENANT })).rejects.toThrow();
    expect(d.tout.size).toBe(0);
  });
});
