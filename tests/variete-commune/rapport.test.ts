import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EmpreinteVideo } from "@/briques/variete-commune/types";
import { construireRapport } from "../../scripts/variete-commune/rapport";

const AXES = ["habillage", "typo", "palette", "ouverture", "fin"] as const;
const emp = (videoId: string, le: string, formatId: string, valeur: (a: string) => string): EmpreinteVideo => ({
  version: "empreinte/1", videoId, formatId, le, axes: Object.fromEntries(AXES.map((a) => [a, [valeur(a)]])),
});
const pareilles = (id: string, le: string, f = "avocat") => emp(id, le, f, (a) => `${a}-x`);
const autres = (id: string, le: string, f = "tableau") => emp(id, le, f, (a) => `${a}-${id}`);

const cinq = [
  pareilles("v5", "2026-11-05T10:00:00Z"),
  autres("v4", "2026-11-04T10:00:00Z"),
  pareilles("v3", "2026-11-03T10:00:00Z"),
  autres("v2", "2026-11-02T10:00:00Z"),
  autres("v1", "2026-11-01T10:00:00Z"),
];

describe("rapport de variété commune (X2-09)", () => {
  it("5 vidéos simulées → tableau attendu", () => {
    expect(construireRapport([{ reseau: "instagram", videos: cinq }])).toBe(
      [
        "| Date | Réseau | Générateur | Score | Trop proche | Voisine | Axes communs |",
        "| --- | --- | --- | --- | --- | --- | --- |",
        "| 2026-11-05 | instagram | avocat | 100 % | oui | v3 | ouverture, palette, habillage, typo, fin |",
        "| 2026-11-04 | instagram | tableau | 0 % | non | v3 | aucun |",
        "| 2026-11-03 | instagram | avocat | 0 % | non | v2 | aucun |",
        "| 2026-11-02 | instagram | tableau | 0 % | non | v1 | aucun |",
        "| 2026-11-01 | instagram | tableau | — | — | — | aucun score (voisines absentes ou trop peu d'axes) |",
        "",
      ].join("\n"),
    );
  });
  it("réseau vide → « aucune vidéo »", () => {
    expect(construireRapport([{ reseau: "tiktok", videos: [] }])).toContain("| — | tiktok | — | — | — | — | aucune vidéo |");
  });
  it("même entrée = même sortie, entrées intactes", () => {
    const copie = JSON.stringify(cinq);
    const e = [{ reseau: "instagram", videos: [...cinq].reverse() }];
    expect(construireRapport(e)).toBe(construireRapport(e));
    expect(construireRapport(e)).toBe(construireRapport([{ reseau: "instagram", videos: cinq }]));
    expect(JSON.stringify(cinq)).toBe(copie);
  });
  it("30 vidéos au plus par réseau", () => {
    const beaucoup = Array.from({ length: 45 }, (_, i) => autres(`v${i}`, `2026-10-${String(45 - i).padStart(2, "0")}T00:00:00Z`));
    const l = construireRapport([{ reseau: "instagram", videos: beaucoup }]).trim().split("\n");
    expect(l.length).toBe(2 + 30);
  });
  it("garde : lecture seule, ni publications.ts, ni argent", () => {
    const src = readFileSync(resolve(__dirname, "../../scripts/variete-commune/rapport.ts"), "utf8");
    expect(src).not.toMatch(/services\/publications/);
    expect(src).not.toMatch(/credits|couts|depense/i);
    expect(src).not.toMatch(/\.(creer|modifier|supprimer)\(|ecrireParametre|writeFile|varieteCommune/);
  });
});
