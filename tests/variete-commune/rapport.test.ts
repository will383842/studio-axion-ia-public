import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EmpreinteVideo } from "@/briques/variete-commune/types";
import { construireRapport, principal } from "../../scripts/variete-commune/rapport";

type Ligne = Record<string, unknown>;
const espion = vi.hoisted(() => ({
  ecritures: vi.fn(),
  publications: [] as Ligne[], versions: [] as Ligne[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/services/_commun", () => {
  const depot = (nom: "publications" | "versions" | "videos" | "travaux") => ({
    lister: async (f?: (x: Ligne) => boolean) => ((nom === "publications" ? espion.publications : nom === "versions" ? espion.versions : []) as Ligne[]).filter((x) => (f ? f(x) : true)),
    creer: espion.ecritures, modifier: espion.ecritures, supprimer: espion.ecritures,
  });
  return {
    depots: () => ({ publications: depot("publications"), versions: depot("versions"), videos: depot("videos"), travaux: depot("travaux") }),
    lireParametre: async (_cle: string, defaut: unknown) => defaut,
    ecrireParametre: espion.ecritures,
  };
});

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
    const beaucoup = Array.from({ length: 45 }, (_, i) => autres(`v${i}`, new Date(Date.UTC(2026, 9, 1) + (45 - i) * 86400000).toISOString()));
    const l = construireRapport([{ reseau: "instagram", videos: beaucoup }]).trim().split("\n");
    expect(l.length).toBe(2 + 30);
  });
  it("point d'entrée : 0 écriture sur les dépôts, tableau écrit sur la sortie standard", async () => {
    espion.ecritures.mockClear();
    espion.publications = ["a", "b", "c"].map((id, i) => ({ id: `p-${id}`, videoId: id, reseau: "instagram", statut: "publiee", via: "buffer", date: `2026-11-0${i + 1}` }));
    espion.versions = ["a", "b", "c"].map((id) => ({ id: `ver-${id}`, videoId: id, statut: "prete", numero: 1, creeLe: "2026-11-10T00:00:00Z", commande: { moteurId: "montage-avocat", formatId: "montage-avocat" }, projetMontage: { motionCommune: { cartes: [{ modele: "x", debutSec: 1, statut: "ok" }] } } }));
    const sortie: string[] = [];
    const ecrit = vi.spyOn(process.stdout, "write").mockImplementation((c: string | Uint8Array) => (sortie.push(String(c)), true));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await principal();
    } finally {
      ecrit.mockRestore();
    }
    expect(espion.ecritures).not.toHaveBeenCalled();
    expect(sortie.join("")).toContain("| Date | Réseau | Générateur | Score | Trop proche | Voisine | Axes communs |");
  });
  it("garde : lecture seule, ni publications.ts, ni argent", () => {
    const src = readFileSync(resolve(__dirname, "../../scripts/variete-commune/rapport.ts"), "utf8");
    expect(src).not.toMatch(/services\/publications/);
    expect(src).not.toMatch(/credits|couts|depense/i);
    expect(src).not.toMatch(/\.(creer|modifier|supprimer)\(|ecrireParametre|writeFile|varieteCommune/);
  });
});
