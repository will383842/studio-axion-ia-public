/**
 * Registre des formats, PR 1 de l'harmonisation de la console : adresses de création et de fiche, exception de
 * navigation (format masqué mais montré comme essai), icônes et libellés courts uniques. Test pur.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  adresseCreationFormat,
  adresseFicheVideo,
  formatEnEssai,
  listerFormats,
  listerFormatsNavigation,
  nomCourtFormat,
  statutNavigation,
  trouverFormat,
} from "@/formats";

describe("adresseCreationFormat", () => {
  it.each([
    ["avocat", "/nouvelle/avocat"],
    ["tableau-anime", "/tableau/nouvelle"],
    ["cas-concret", "/cas-concret"],
    ["facecam-animee", "/face-camera-animee"],
    ["image-video", "/image-video"],
    ["x", "/nouvelle/x"],
  ])("%s -> %s", (id, attendu) => {
    expect(adresseCreationFormat({ id })).toBe(attendu);
  });

  it("chaque adresse déclarée a une page", () => {
    const declarees = listerFormats({ inclureMasques: true }).filter((f) => f.adresseCreation);
    expect(declarees.length).toBeGreaterThanOrEqual(4);
    for (const f of declarees) {
      expect(existsSync(join(process.cwd(), "src/app/(studio)" + f.adresseCreation + "/page.tsx")), f.id).toBe(true);
    }
  });
});

describe("adresseFicheVideo", () => {
  it("image-video prête, avocat brouillon, avocat prête", () => {
    expect(adresseFicheVideo({ id: "v1", statut: "prete", format: { id: "image-video" } })).toBe("/image-video/v1");
    expect(adresseFicheVideo({ id: "v1", statut: "brouillon", format: { id: "avocat" } })).toBe("/nouvelle/avocat?brouillon=v1");
    expect(adresseFicheVideo({ id: "v1", statut: "prete", format: { id: "avocat" } })).toBe("/videos/v1");
  });
});

describe("listerFormatsNavigation", () => {
  const liste = listerFormatsNavigation();
  const ids = liste.map((f) => f.id);

  it("contient image-video et facecam-animee, pas selfie", () => {
    expect(ids).toContain("image-video");
    expect(ids).toContain("facecam-animee");
    expect(ids).not.toContain("selfie");
  });

  it("actifs avant bientôt, dans l'ordre du registre", () => {
    const rangs = liste.map((f) => (statutNavigation(f) === "actif" ? 0 : 1));
    expect(rangs).toEqual([...rangs].sort((a, b) => a - b));
    expect(liste.filter((f) => statutNavigation(f) === "actif").map((f) => f.id)).toEqual(["avocat", "facecam", "tableau-anime", "cas-concret", "facecam-animee", "image-video"]);
  });
});

describe("image-video : exception de navigation seulement", () => {
  const f = trouverFormat("image-video")!;
  it("reste masqué partout ailleurs", () => {
    expect(f.statut).toBe("masque");
    expect(listerFormats().some((x) => x.id === "image-video")).toBe(false);
    expect(listerFormats({ inclureReservesAWill: true }).some((x) => x.id === "image-video")).toBe(false);
  });
  it("actif et en essai pour la navigation", () => {
    expect(statutNavigation(f)).toBe("actif");
    expect(formatEnEssai(f)).toBe(true);
  });
});

describe("unicité", () => {
  const tous = listerFormats({ inclureMasques: true });
  it("icônes uniques", () => {
    const icones = tous.map((f) => f.icone);
    expect(new Set(icones).size).toBe(icones.length);
  });
  it("noms courts uniques", () => {
    const noms = tous.map((f) => nomCourtFormat(f));
    expect(new Set(noms).size).toBe(noms.length);
  });
});
