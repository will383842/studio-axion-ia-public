import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile as ecrire } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDocumentProxy, getMeta } from "unpdf";
import { creerAssemblagePdf, pagesDemandees } from "../../studio-rendu/src/operations/assemblage-pdf";
import { dimensionsJpeg, ecrirePdf } from "../../studio-rendu/src/pdf/ecrire-pdf";

const JPEG_A = readFileSync("studio-rendu/essais-visuels/t01-couverture-a.jpg");
const JPEG_B = readFileSync("studio-rendu/essais-visuels/t02-page-dense.jpg");
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/** Petit parseur de test : les flux des objets image, lus avec leur `/Length`, dans l'ordre du fichier. */
function fluxImages(pdf: Buffer): Buffer[] {
  const texte = pdf.toString("latin1");
  const sorties: Buffer[] = [];
  const re = /\/Subtype \/Image[^>]*?\/Length (\d+)[^>]*>>\s*stream\r?\n/g;
  for (let m = re.exec(texte); m; m = re.exec(texte)) {
    const debut = m.index + m[0].length;
    sorties.push(pdf.subarray(debut, debut + Number(m[1])));
  }
  return sorties;
}

describe("M2-02 · écrivain PDF maison", () => {
  const pages = [JPEG_A, JPEG_B, JPEG_A, JPEG_B, JPEG_B, JPEG_A, JPEG_A, JPEG_B, JPEG_A];
  const pdf = ecrirePdf({ titre: "Six tâches d'un bureau — essai", pages });

  it("lit les dimensions d'un JPEG (marqueur SOF)", () => {
    expect(dimensionsJpeg(JPEG_A)).toMatchObject({ largeur: 1080, hauteur: 1350 });
    expect(() => dimensionsJpeg(Buffer.from("pas un jpeg"))).toThrow(/JPEG/);
  });
  it("produit un PDF de N pages de 810 × 1012,5 pt (± 0,5)", async () => {
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    expect(doc.numPages).toBe(9);
    for (let i = 1; i <= doc.numPages; i++) {
      const [, , l, h] = (await doc.getPage(i)).view;
      expect(Math.abs(l - 810)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(h - 1012.5)).toBeLessThanOrEqual(0.5);
    }
  });
  it("métadonnées exactes : titre, auteur « Axion-IA », langue fr, rien d'autre", async () => {
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    const { info } = await getMeta(doc);
    const i = info as Record<string, unknown>;
    expect(i.Title).toBe("Six tâches d'un bureau — essai");
    expect(i.Author).toBe("Axion-IA");
    for (const cle of ["Creator", "Producer", "CreationDate", "ModDate", "Subject", "Keywords"]) expect(i[cle], cle).toBeUndefined();
    const texte = pdf.toString("latin1");
    expect(texte).toMatch(/\/Lang \(fr\)/);
    expect(texte).not.toMatch(/\/(Producer|Creator|CreationDate|ModDate|Subject|Keywords)\b|<x:xmpmeta|\/Metadata/);
  });
  it("embarque les JPEG tels quels (DCTDecode) : empreintes identiques à l'entrée", () => {
    const flux = fluxImages(pdf);
    expect(flux).toHaveLength(9);
    expect(flux.map(sha)).toEqual(pages.map(sha));
    expect(pdf.toString("latin1")).toMatch(/\/Filter \/DCTDecode/);
  });
  it("refuse zéro page, plus de 20 pages, un fichier qui n'est pas un JPEG, un titre vide", () => {
    expect(() => ecrirePdf({ titre: "t", pages: [] })).toThrow();
    expect(() => ecrirePdf({ titre: "t", pages: Array(21).fill(JPEG_A) })).toThrow();
    expect(() => ecrirePdf({ titre: "t", pages: [Buffer.from("x")] })).toThrow(/JPEG/);
    expect(() => ecrirePdf({ titre: " ", pages: [JPEG_A] })).toThrow();
  });
});

describe("M2-02 · opération assemblage-pdf", () => {
  it("ordonne les entrées page-1…page-N et refuse trou, nom inconnu, plus de 20 pages", () => {
    expect(pagesDemandees({ "page-2": "x", "page-1": "y", "page-10": "z", ...Object.fromEntries([3, 4, 5, 6, 7, 8, 9].map((n) => [`page-${n}`, "u"])) })).toEqual(
      Array.from({ length: 10 }, (_, k) => `page-${k + 1}`),
    );
    expect(() => pagesDemandees({ "page-1": "a", "page-3": "b" })).toThrow(/trou/);
    expect(() => pagesDemandees({ photo: "a" })).toThrow(/page-1/);
    expect(() => pagesDemandees({})).toThrow();
  });
  it("télécharge, assemble et dépose un PDF dont les images sont celles des entrées", async () => {
    const dossier = await mkdtemp(join(tmpdir(), "pdf-"));
    try {
      const sources: Record<string, Buffer> = { "http://127.0.0.1/a": JPEG_A, "http://127.0.0.1/b": JPEG_B };
      let depose: Buffer | null = null;
      const op = creerAssemblagePdf({
        telecharger: async (url, chemin) => void (await ecrire(chemin, sources[url])),
        deposer: async (_u, chemin, mime) => {
          expect(mime).toBe("application/pdf");
          depose = readFileSync(chemin);
        },
      });
      const r = await op(
        { idRendu: "pdf-1", operation: "assemblage-pdf", file: "courte", entrees: { "page-2": "http://127.0.0.1/b", "page-1": "http://127.0.0.1/a" }, sortie: { urlDepot: "x", cle: "k" }, parametres: { titre: "Essai" } },
        { progression: () => {}, dossier, signal: new AbortController().signal },
      );
      expect(r.mesures).toMatchObject({ pages: 2 });
      expect(fluxImages(depose!).map(sha)).toEqual([sha(JPEG_A), sha(JPEG_B)]);
    } finally {
      await rm(dossier, { recursive: true, force: true });
    }
  });
});
