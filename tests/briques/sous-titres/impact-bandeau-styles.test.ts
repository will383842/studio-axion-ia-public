/**
 * GV-ST-08a : « Impact » et « Bandeau » sont de vrais styles de base (toute la vidéo dans ce style).
 * Karaoké et Minimal : segments identiques à ceux d'avant le changement (empreintes prises avant la modification).
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { GabaritSousTitres, IntensiteSousTitres } from "@/domaine/types";
import { baseDe, baseRetenue, donneesCalque, fabriquerSousTitres, optionsGroupement } from "@/briques/sous-titres";
import { melanger } from "@/briques/sous-titres/melange";

const TEXTE =
  "Il a gagné 35 heures. Votre patron ne peut jamais lire vos mails personnels. Une personne à temps plein juste pour remplir Excel. " +
  "Il ne voyait qu'une partie du dossier. On a tout supprimé en une semaine. Le juge a condamné l'employeur à payer 2 500 € de dommages. " +
  "Les données sont mises à jour en direct chaque matin. Vous pouvez demander une copie gratuite de votre dossier. Retenez bien cette règle simple.";

const fabriquer = (base: GabaritSousTitres | undefined, intensite: IntensiteSousTitres) =>
  fabriquerSousTitres({ texte: TEXTE, dureeSec: 40, intensite, emphase: ["jamais", "Excel"], coupesSec: [5, 12.5, 20], ...(base ? { base } : {}) });
const empreinte = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);

/** Empreintes relevées AVANT le changement (branche de départ). */
const AVANT: Record<string, string> = {
  "karaoke|sobre": "3af49b14f1ee1f6b",
  "karaoke|equilibre": "4482557a33cc0a8d",
  "karaoke|tres-dynamique": "1bd2994c664c40f2",
  "minimal|sobre": "2efe9cfe8cc73485",
  "minimal|equilibre": "2c6b4e2b258a3b29",
  "minimal|tres-dynamique": "93a46ab735de6a8a",
  "undefined|sobre": "3af49b14f1ee1f6b",
  "undefined|equilibre": "4482557a33cc0a8d",
  "undefined|tres-dynamique": "1bd2994c664c40f2",
};

describe("Karaoké et Minimal : segments inchangés", () => {
  for (const [cle, attendu] of Object.entries(AVANT)) {
    it(`${cle}`, () => {
      const [base, intensite] = cle.split("|");
      expect(empreinte(fabriquer(base === "undefined" ? undefined : (base as GabaritSousTitres), intensite as IntensiteSousTitres))).toBe(attendu);
    });
  }
});

describe("gabarit = base", () => {
  it("baseDe rend le gabarit lui-même", () => {
    for (const g of ["karaoke", "minimal", "impact", "bandeau"] as const) expect(baseDe(g)).toBe(g);
  });
  it("baseRetenue suit le gabarit du style de la Bibliothèque", () => {
    expect(baseRetenue(undefined, { gabarit: "impact" } as never)).toBe("impact");
    expect(baseRetenue(undefined, { gabarit: "bandeau" } as never)).toBe("bandeau");
    expect(baseRetenue("minimal", { gabarit: "impact" } as never)).toBe("minimal");
  });
  it("la taille du style s'applique quand son gabarit est la base", () => {
    const style = { gabarit: "impact", tailleRelative: 0.8 } as never;
    const d = donneesCalque({ segments: fabriquer("impact", "equilibre"), base: "impact", style });
    expect(d.tailleRelative).toBe(0.8);
    expect(optionsGroupement({ style, base: "impact" }).motsMax).toBeGreaterThan(0);
  });
});

describe("style Impact : toute la vidéo en Impact", () => {
  for (const intensite of ["sobre", "equilibre", "tres-dynamique"] as const) {
    it(`100 % des groupes en impact (${intensite}), importance variable, mots importants en accent`, () => {
      const s = fabriquer("impact", intensite);
      expect(s.length).toBeGreaterThan(5);
      expect(s.every((x) => x.style === "impact")).toBe(true);
      expect(new Set(s.map((x) => x.importance)).size).toBeGreaterThan(1);
      expect(s.some((x) => x.mots.some((m) => m.enValeur))).toBe(true);
      // Le texte validé reste mot pour mot.
      expect(s.flatMap((x) => x.mots.map((m) => m.mot)).join(" ")).toBe(TEXTE.split(/\s+/).join(" "));
    });
  }
});

describe("style Bandeau : toute la vidéo en bandeau", () => {
  it("100 % des groupes en bandeau, importance variable, mots en valeur conservés", () => {
    const s = fabriquer("bandeau", "equilibre");
    expect(s.every((x) => x.style === "bandeau")).toBe(true);
    expect(new Set(s.map((x) => x.importance)).size).toBeGreaterThan(1);
    expect(s.some((x) => x.mots.some((m) => m.enValeur))).toBe(true);
  });
});

describe("groupes verrouillés", () => {
  it("un groupe verrouillé n'est jamais réécrit, même en base Impact", () => {
    const s = fabriquer("karaoke", "sobre");
    s[2] = { ...s[2], verrouille: true, style: "bandeau", importance: 2, position: "bas" };
    const m = melanger(s, { intensite: "equilibre", base: "impact" });
    expect(m[2]).toEqual(s[2]);
    expect(m.filter((x, i) => i !== 2).every((x) => x.style === "impact")).toBe(true);
  });
});
