/** Relecture PR #338 (remarque 4) : pastille « Bientôt » de /formats/[id] = format non actif et pas une entrée de menu (Image → vidéo). */
import { describe, expect, it } from "vitest";
import { formatBientot } from "@/components/videos/formatBientot";

describe("formatBientot", () => {
  it("actif : jamais bientôt", () => {
    expect(formatBientot("actif", false)).toBe(false);
    expect(formatBientot("actif", true)).toBe(false);
  });
  it("bientôt sans entrée de menu : pastille, même avec des vidéos", () => {
    expect(formatBientot("bientot", false)).toBe(true);
  });
  it("masqué sans entrée de menu : pastille", () => {
    expect(formatBientot("masque", false)).toBe(true);
  });
  it("entrée de menu (Image → vidéo) : pas de pastille", () => {
    expect(formatBientot("masque", true)).toBe(false);
    expect(formatBientot("bientot", true)).toBe(false);
  });
});

describe("H2 · titre de /formats/[id]", () => {
  it("un format Bientôt prend le nom du format ; un format actif garde « Mes vidéos »", async () => {
    const { titrePageFormat } = await import("@/components/videos/formatBientot");
    expect(titrePageFormat("Podcast", true)).toBe("Podcast");
    expect(titrePageFormat("Avocat", false)).toBe("Mes vidéos");
  });

  it("la page utilise ce titre", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/app/(studio)/formats/[id]/page.tsx", "utf8");
    expect(src).toContain("titrePageFormat(f.nom, bientot)");
    expect(src).not.toContain('<EnTetePage titre="Mes vidéos" />');
  });
});
