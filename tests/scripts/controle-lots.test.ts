import { describe, expect, it } from "vitest";
import {
  PLAFOND_JETONS,
  PLAFOND_SESSIONS,
  controlerLot,
  lireFiche,
  type Fiche,
} from "../../scripts/controle-lots";

function fiche(p: Partial<Fiche> & { id: string }): Fiche {
  return {
    version: "V1",
    dependDe: [],
    fichiers: ["src/a.ts"],
    paralleleAvec: [],
    ...p,
  };
}
const jaugeOk = { jetons: 0, sessions: 0 };

describe("lireFiche", () => {
  it("lit l'en-tête d'une fiche et retire la mention (nouveau)", () => {
    const f = lireFiche(
      [
        "---",
        "id: L0-03",
        "version: V1",
        'depend_de: ["L0-01"]',
        'parallele_avec: ["L0-04"]',
        'fichiers_autorises: ["docs/a.md", "scripts/x.ts (nouveau)"]',
        "---",
        "corps",
      ].join("\n"),
    );
    expect(f).toEqual({
      id: "L0-03",
      version: "V1",
      dependDe: ["L0-01"],
      paralleleAvec: ["L0-04"],
      fichiers: ["docs/a.md", "scripts/x.ts"],
    });
  });
  it("accepte des listes vides et une fiche sans parallele_avec", () => {
    const f = lireFiche('---\nid: A\nversion: V2\ndepend_de: []\nfichiers_autorises: ["a.ts"]\n---\n');
    expect(f.dependDe).toEqual([]);
    expect(f.paralleleAvec).toEqual([]);
  });
});

describe("controlerLot", () => {
  it("accepte un lot sain", () => {
    const r = controlerLot({
      fiches: [fiche({ id: "A" }), fiche({ id: "B", fichiers: ["src/b.ts"] })],
      prOuvertes: [],
      jauge: jaugeOk,
    });
    expect(r.lancer).toBe(true);
    expect(r.refus).toEqual([]);
  });

  it("refuse une fiche qui ne liste qu'un dossier ou un motif", () => {
    for (const f of ["src/dossier/", "src/**", "src/*.ts", "src"]) {
      const r = controlerLot({ fiches: [fiche({ id: "A", fichiers: [f] })], prOuvertes: [], jauge: jaugeOk });
      expect(r.lancer).toBe(false);
      expect(r.refus.some((x) => x.id === "A" && x.regle === "fichiers-exacts")).toBe(true);
    }
  });

  it("refuse une fiche sans aucun fichier", () => {
    const r = controlerLot({ fiches: [fiche({ id: "A", fichiers: [] })], prOuvertes: [], jauge: jaugeOk });
    expect(r.refus[0]?.regle).toBe("fichiers-exacts");
  });

  it("refuse deux fiches qui touchent le même fichier", () => {
    const r = controlerLot({
      fiches: [fiche({ id: "A" }), fiche({ id: "B" })],
      prOuvertes: [],
      jauge: jaugeOk,
    });
    expect(r.lancer).toBe(false);
    expect(r.refus.some((x) => x.regle === "meme-fichier")).toBe(true);
  });

  it("lit parallele_avec dans les deux sens", () => {
    const seul = controlerLot({
      fiches: [
        fiche({ id: "A", paralleleAvec: ["B"] }),
        fiche({ id: "B", fichiers: ["src/b.ts"] }),
      ],
      prOuvertes: [],
      jauge: jaugeOk,
    });
    expect(seul.refus.some((x) => x.regle === "parallele-un-sens")).toBe(true);
    const double = controlerLot({
      fiches: [
        fiche({ id: "A", paralleleAvec: ["B"] }),
        fiche({ id: "B", fichiers: ["src/b.ts"], paralleleAvec: ["A"] }),
      ],
      prOuvertes: [],
      jauge: jaugeOk,
    });
    expect(double.refus).toEqual([]);
  });

  it("refuse une fiche V1 qui dépend d'une V2", () => {
    const r = controlerLot({
      fiches: [
        fiche({ id: "A", dependDe: ["B"] }),
        fiche({ id: "B", version: "V2", fichiers: ["src/b.ts"] }),
      ],
      prOuvertes: [],
      jauge: jaugeOk,
    });
    expect(r.lancer).toBe(false);
    expect(r.refus.some((x) => x.id === "A" && x.regle === "fermeture-versions")).toBe(true);
  });

  it("accepte une V2 qui dépend d'une V1, et une dépendance déjà fusionnée", () => {
    const r = controlerLot({
      fiches: [
        fiche({ id: "B", version: "V2", dependDe: ["A", "Z"], fichiers: ["src/b.ts"] }),
        fiche({ id: "A" }),
      ],
      fusionnees: ["Z"],
      versionsFusionnees: { Z: "V1" },
      prOuvertes: [],
      jauge: jaugeOk,
    });
    expect(r.refus).toEqual([]);
  });

  it("refuse une dépendance inconnue", () => {
    const r = controlerLot({ fiches: [fiche({ id: "A", dependDe: ["Q"] })], prOuvertes: [], jauge: jaugeOk });
    expect(r.refus.some((x) => x.regle === "dependance-inconnue")).toBe(true);
  });

  it("refuse une fiche dont un fichier est touché par une PR ouverte", () => {
    const r = controlerLot({
      fiches: [fiche({ id: "A" })],
      prOuvertes: [{ numero: 240, fichiers: ["src/a.ts"] }],
      jauge: jaugeOk,
    });
    expect(r.lancer).toBe(false);
    expect(r.refus.some((x) => x.id === "A" && x.regle === "pr-ouverte")).toBe(true);
  });

  it("aucune vague si la jauge dépasse le plafond", () => {
    expect(PLAFOND_JETONS).toBe(400_000_000);
    expect(PLAFOND_SESSIONS).toBe(400);
    for (const jauge of [
      { jetons: PLAFOND_JETONS + 1, sessions: 0 },
      { jetons: 0, sessions: PLAFOND_SESSIONS + 1 },
    ]) {
      const r = controlerLot({ fiches: [fiche({ id: "A" })], prOuvertes: [], jauge });
      expect(r.lancer).toBe(false);
      expect(r.refus.some((x) => x.regle === "jauge")).toBe(true);
    }
  });

  it("la jauge pile au plafond arrête la vague (jetons ou sessions)", () => {
    for (const jauge of [
      { jetons: PLAFOND_JETONS, sessions: 0 },
      { jetons: 0, sessions: PLAFOND_SESSIONS },
      { jetons: PLAFOND_JETONS, sessions: PLAFOND_SESSIONS },
    ]) {
      const r = controlerLot({ fiches: [fiche({ id: "A" })], prOuvertes: [], jauge });
      expect(r.lancer).toBe(false);
      expect(r.refus.some((x) => x.regle === "jauge")).toBe(true);
    }
  });

  it("juste sous le plafond, la vague part", () => {
    const r = controlerLot({
      fiches: [fiche({ id: "A" })],
      prOuvertes: [],
      jauge: { jetons: PLAFOND_JETONS - 1, sessions: PLAFOND_SESSIONS - 1 },
    });
    expect(r.lancer).toBe(true);
  });

  it("refuse une V1 qui dépend d'une V2 déjà fusionnée (hors du lot)", () => {
    const r = controlerLot({
      fiches: [fiche({ id: "A", dependDe: ["Z"] })],
      fusionnees: ["Z"],
      versionsFusionnees: { Z: "V2" },
      prOuvertes: [],
      jauge: jaugeOk,
    });
    expect(r.lancer).toBe(false);
    expect(r.refus.some((x) => x.id === "A" && x.regle === "fermeture-versions")).toBe(true);
  });

  it("accepte une V1 qui dépend d'une V1 fusionnée, et une V2 d'une V2 fusionnée", () => {
    const r = controlerLot({
      fiches: [fiche({ id: "A", dependDe: ["Z"] }), fiche({ id: "B", version: "V2", dependDe: ["Y"], fichiers: ["src/b.ts"] })],
      fusionnees: ["Z", "Y"],
      versionsFusionnees: { Z: "V1", Y: "V2" },
      prOuvertes: [],
      jauge: jaugeOk,
    });
    expect(r.refus).toEqual([]);
  });

  it("refuse une dépendance fusionnée dont la version n'est pas connue", () => {
    const r = controlerLot({
      fiches: [fiche({ id: "A", dependDe: ["Z"] })],
      fusionnees: ["Z"],
      prOuvertes: [],
      jauge: jaugeOk,
    });
    expect(r.lancer).toBe(false);
    expect(r.refus.some((x) => x.id === "A" && x.regle === "version-inconnue")).toBe(true);
  });

  it("refuse une version illisible (vide, « v1-a », absente), sans NaN silencieux", () => {
    for (const version of ["", "v1-a", "V", "1"]) {
      const r = controlerLot({
        fiches: [fiche({ id: "A", version, dependDe: ["B"] }), fiche({ id: "B", fichiers: ["src/b.ts"] })],
        prOuvertes: [],
        jauge: jaugeOk,
      });
      expect(r.lancer).toBe(false);
      expect(r.refus.some((x) => x.regle === "version-inconnue")).toBe(true);
    }
    const cible = controlerLot({
      fiches: [fiche({ id: "A", dependDe: ["B"] }), fiche({ id: "B", version: "v1-a", fichiers: ["src/b.ts"] })],
      prOuvertes: [],
      jauge: jaugeOk,
    });
    expect(cible.refus.some((x) => x.regle === "version-inconnue")).toBe(true);
    const absente = lireFiche('---\nid: A\ndepend_de: []\nfichiers_autorises: ["a.ts"]\n---\n');
    expect(absente.version).toBe("");
    expect(
      controlerLot({ fiches: [absente], prOuvertes: [], jauge: jaugeOk }).refus.some((x) => x.regle === "version-inconnue"),
    ).toBe(true);
  });

  it("refuse deux fiches de même identifiant dans le lot", () => {
    const r = controlerLot({ fiches: [fiche({ id: "A" }), fiche({ id: "A" })], prOuvertes: [], jauge: jaugeOk });
    expect(r.lancer).toBe(false);
    expect(r.refus.some((x) => x.id === "A" && x.regle === "id-double")).toBe(true);
  });

  it("documenté : un fichier sans extension (Dockerfile) est refusé comme non exact", () => {
    const r = controlerLot({ fiches: [fiche({ id: "A", fichiers: ["Dockerfile"] })], prOuvertes: [], jauge: jaugeOk });
    expect(r.refus.some((x) => x.regle === "fichiers-exacts")).toBe(true);
  });

  it("refuse un lot vide", () => {
    const r = controlerLot({ fiches: [], prOuvertes: [], jauge: jaugeOk });
    expect(r.lancer).toBe(false);
  });
});

describe("jauge illisible ou négative", () => {
  const cas: Array<[string, { jetons: number; sessions: number }]> = [
    ["jetons NaN", { jetons: Number.NaN, sessions: 0 }],
    ["sessions undefined", { jetons: 0, sessions: undefined as unknown as number }],
    ["les deux illisibles", { jetons: Number.NaN, sessions: undefined as unknown as number }],
    ["jetons infinis", { jetons: Number.POSITIVE_INFINITY, sessions: 0 }],
    ["jetons négatifs", { jetons: -1, sessions: 0 }],
    ["sessions négatives", { jetons: 0, sessions: -5 }],
  ];
  for (const [nom, jauge] of cas) {
    it(`refuse (jauge) : ${nom}`, () => {
      const r = controlerLot({ fiches: [fiche({ id: "A" })], prOuvertes: [], jauge });
      expect(r.lancer).toBe(false);
      expect(r.refus.some((x) => x.regle === "jauge")).toBe(true);
    });
  }
});
