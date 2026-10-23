import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adresseNouvelleVideoCasConcret } from "@/components/formats/cas-concret/aiguillage";
import { formatCasConcret } from "@/formats/cas-concret";
import { FORMAT_TABLEAU_ANIME } from "@/components/formats/tableau-anime/aiguillage";

describe("« Nouvelle vidéo » : la carte du cas concret mène à son écran", () => {
  it("le cas concret actif va vers /cas-concret, jamais vers l'assistant générique", () => {
    expect(formatCasConcret.statut).toBe("actif");
    expect(adresseNouvelleVideoCasConcret(formatCasConcret)).toBe("/cas-concret");
  });

  it("aucun autre format n'est aiguillé, et un cas concret masqué non plus", () => {
    expect(adresseNouvelleVideoCasConcret({ id: FORMAT_TABLEAU_ANIME, statut: "actif" })).toBeNull();
    expect(adresseNouvelleVideoCasConcret({ id: "cas-concret", statut: "masque" })).toBeNull();
    expect(adresseNouvelleVideoCasConcret(undefined)).toBeNull();
  });

  it("la page /nouvelle/[format] applique cet aiguillage avant l'assistant", () => {
    const src = readFileSync("src/app/(studio)/nouvelle/[format]/page.tsx", "utf8");
    expect(src).toContain("adresseNouvelleVideoCasConcret(format)");
    expect(src.indexOf("adresseNouvelleVideoCasConcret(format)")).toBeLessThan(src.indexOf("listerPersonnages()"));
  });
});
