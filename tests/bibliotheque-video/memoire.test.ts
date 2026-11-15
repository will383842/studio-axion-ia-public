import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  choixFigesDesVersions,
  fusionnerMemoires,
  versRecents,
  type VersionPourMemoire,
} from "@/briques/bibliotheque-video/memoire";
import type { UsageMemoire } from "@/briques/bibliotheque-video/types";

const v = (p: Partial<Record<string, unknown>> & { videoId?: string }): VersionPourMemoire =>
  ({
    videoId: "vid1",
    statut: "prete",
    creeLe: "2026-11-01T10:00:00.000Z",
    commande: { entrees: {} },
    ...p,
  }) as unknown as VersionPourMemoire;

const cmd = (choix: unknown) => ({ entrees: { bibliothequeVideo: { choix } } });
const A = { capacite: "texte.style-varie", cle: "a" };
const B = { capacite: "fond.grain", cle: "b" };

describe("choixFigesDesVersions", () => {
  it("lit 2 choix d'une version prête", () => {
    const r = choixFigesDesVersions([v({ commande: cmd([A, B]) })]);
    expect(r).toEqual([
      { ...A, videoId: "vid1", source: "bibliotheque-video", le: "2026-11-01T10:00:00.000Z" },
      { ...B, videoId: "vid1", source: "bibliotheque-video", le: "2026-11-01T10:00:00.000Z" },
    ]);
  });
  it("ignore les autres statuts", () => {
    for (const statut of ["en_fabrication", "echec", "maquette", "annulee"])
      expect(choixFigesDesVersions([v({ statut, commande: cmd([A]) })])).toEqual([]);
  });
  it("lit le projet de montage seul, et dédoublonne", () => {
    const pm = { bibliothequeVideo: { choix: [A] } };
    expect(choixFigesDesVersions([v({ projetMontage: pm })])).toHaveLength(1);
    expect(choixFigesDesVersions([v({ commande: cmd([A]), projetMontage: pm })])).toHaveLength(1);
  });
  it("tolère les formes mal formées sans lever", () => {
    const mauvais = [
      v({ commande: { entrees: {} } }),
      v({ commande: { entrees: { bibliothequeVideo: {} } } }),
      v({ commande: cmd("pas un tableau") }),
      v({ commande: cmd([{ capacite: "texte.x" }, { capacite: "sanspoint", cle: "k" }, { capacite: "a.b", cle: "" }, null, 3]) }),
      v({ commande: null }),
      v({ commande: { entrees: null } }),
      v({ projetMontage: { bibliothequeVideo: "x" } }),
    ];
    expect(choixFigesDesVersions(mauvais)).toEqual([]);
  });
  it("un élément mal formé n'empêche pas les autres", () => {
    expect(choixFigesDesVersions([v({ commande: cmd([{ cle: "z" }, A]) })])).toHaveLength(1);
  });
  it("signature tirée du style (A1-2)", () => {
    const r = choixFigesDesVersions([
      v({ commande: cmd([{ capacite: "texte.style-varie", cle: "sig-1", signature: "s" }]) }),
    ]);
    expect(r[0].capacite).toBe("texte.style-varie");
  });
  it("pureté", () => {
    const e = Object.freeze([v({ commande: cmd([A, B]) })]);
    expect(choixFigesDesVersions(e)).toEqual(choixFigesDesVersions(e));
  });
});

const u = (videoId: string, le: string, cle = "k", source: UsageMemoire["source"] = "avocat-cartes"): UsageMemoire => ({
  capacite: "texte.style-varie", cle, videoId, source, le,
});
const fen = (n: number) => ({ fenetreVideos: n, portee: "format" as const });

describe("fusionnerMemoires", () => {
  const s1 = [u("a", "2026-01-01"), u("b", "2026-01-05"), u("b", "2026-01-05")];
  const s2 = [u("c", "2026-01-03"), u("a", "2026-01-01"), u("d", "2026-01-09", "k", "v4-familles")];
  const s3 = [u("c", "2026-01-03", "k2"), u("b", "2026-01-05")];
  it("garde les 2 vidéos les plus récentes, sans doublon", () => {
    const r = fusionnerMemoires([s1, s2, s3], fen(2));
    expect(new Set(r.map((x) => x.videoId))).toEqual(new Set(["d", "b"]));
    expect(r).toHaveLength(2);
  });
  it("ordre stable quel que soit l'ordre des sources", () => {
    const a = fusionnerMemoires([s1, s2, s3], fen(3));
    expect(fusionnerMemoires([s3, s1, s2], fen(3))).toEqual(a);
    expect(fusionnerMemoires([s2, s3, s1], fen(3))).toEqual(a);
  });
  it("fenêtre 0 et sources vides", () => {
    expect(fusionnerMemoires([s1], fen(0))).toEqual([]);
    expect(fusionnerMemoires([s1], fen(-1))).toEqual([]);
    expect(fusionnerMemoires([], fen(5))).toEqual([]);
    expect(fusionnerMemoires([[], []], fen(5))).toEqual([]);
  });
  it("pureté : entrées gelées", () => {
    const g = Object.freeze([Object.freeze(s1.map((x) => Object.freeze(x)))]);
    expect(fusionnerMemoires(g, fen(2))).toEqual(fusionnerMemoires(g, fen(2)));
  });
});

describe("versRecents", () => {
  it("projette et garde l'ordre", () => {
    expect(versRecents([u("a", "2026-01-01", "x"), u("b", "2026-01-02", "y")])).toEqual([
      { capacite: "texte.style-varie", cle: "x", videoId: "a" },
      { capacite: "texte.style-varie", cle: "y", videoId: "b" },
    ]);
  });
});

describe("garde statique", () => {
  const src = readFileSync(join(__dirname, "..", "..", "src/briques/bibliotheque-video/memoire.ts"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  it("aucun import interdit ni horloge", () => {
    expect(code).not.toMatch(/@\/services\//);
    expect(code).not.toMatch(/studio-rendu/);
    expect(code).not.toMatch(/credits|budget-mensuel|mode-budget|autonomie-usine|couts|cle-depense-usine|depense-claude|generation-claude|image-video/);
    expect(code).not.toMatch(/Date\.now|new Date\(/);
  });
});
