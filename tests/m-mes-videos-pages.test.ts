/** Lot M (08/11, Williams) : câblage des pages, filtres dans l'adresse, anciens liens conservés. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const R = join(__dirname, "..");
const lire = (p: string) => readFileSync(join(R, p), "utf8");
const videos = lire("src/app/(studio)/videos/page.tsx");
const format = lire("src/app/(studio)/formats/[id]/page.tsx");
const galerie = lire("src/components/videos/GalerieVideos.tsx");
const presentation = lire("src/services/presentation.ts");

describe("pages", () => {
  it("Mes vidéos filtre côté serveur et garde filtresInitiaux", () => {
    expect(videos).toContain("FiltresMesVideos");
    expect(videos).toContain("filtrerCartes");
    expect(videos).toContain("filtresInitiaux={etape ? { etape } : undefined}");
    expect(videos).toMatch(/key=\{`[^`]*reseau/);
  });
  it("la page d'un format montre les mêmes rangées", () => {
    expect(format).toContain("FiltresMesVideos");
    expect(format).toContain("searchParams");
    expect(format).toContain("filtrerCartes");
  });
  it("le téléchargement passe par la route du socle, sans adresse de fichier", () => {
    expect(galerie).toContain("/api/telechargements/video?video=");
    expect(galerie).not.toContain("a.href = v.video!");
  });
  it("la carte reçoit ses réseaux", () => {
    expect(presentation).toContain("reseauxDeLaVideo");
  });
});
