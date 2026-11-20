import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COTE_MAX_CAPTURE, CONSIGNE_LECTURE_CAPTURE, MAX_JETONS_LECTURE_CAPTURE, lireLectureCapture, requeteLectureCapture } from "@/briques/donnees-video/lecture-capture";
import { chiffresARelire } from "@/briques/donnees-video/relecture-chiffres";
import { COTE_MAX_CLAUDE } from "@/moteurs/montage-image-video/lecture/preparation";

const image = (largeur: number, hauteur: number) => ({ base64: "AAAA", type: "image/png" as const, largeur, hauteur });

const donnee = {
  version: "tableau-de-bord.v1",
  titre: "Tableau de bord",
  periode: { debut: "2026-10-01", fin: "2026-10-31", libelle: "Octobre" },
  source: "Capture",
  indicateurs: [
    { id: "visites", libelle: "Visites", valeur: 120, unite: "visites", precision: 0, sens: "hausse-bonne" },
    { id: "rebond", libelle: "Rebond", valeur: 40.5, unite: "%", precision: 1, sens: "baisse-bonne" },
  ],
  series: [{ id: "jour", libelle: "Par jour", unite: "visites", points: [{ x: "1", valeur: 10 }, { x: "2", valeur: 12 }] }],
  comparaisons: [{ avant: "visites", apres: "rebond" }],
  alertes: [],
  calculs: [{ id: "somme", formule: "visites + rebond", resultat: 160.5 }],
};

describe("requête de lecture d'une capture", () => {
  it("1 image, 1 message, 8 000 jetons, effort medium, consigne courte", () => {
    const r = requeteLectureCapture(image(882, 1568), "modele-x");
    if ("refus" in r) throw new Error(r.refus);
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].images).toHaveLength(1);
    expect(r.maxTokens).toBe(MAX_JETONS_LECTURE_CAPTURE);
    expect(r.maxTokens).toBe(8000);
    expect(r.effort).toBe("medium");
    expect(r.modele).toBe("modele-x");
    expect(CONSIGNE_LECTURE_CAPTURE.length).toBeLessThanOrEqual(3400);
    expect(CONSIGNE_LECTURE_CAPTURE).toContain("tableau-de-bord.v1");
  });
  it("refuse sans lever une image dont le côté long dépasse 1 568 px", () => {
    const r = requeteLectureCapture(image(1080, 1920), "m");
    expect(r).toHaveProperty("refus");
    expect(requeteLectureCapture(image(1920, 1080), "m")).toHaveProperty("refus");
    expect(requeteLectureCapture(image(0, 100), "m")).toHaveProperty("refus");
    expect(requeteLectureCapture(image(1568, 1568), "m")).not.toHaveProperty("refus");
  });
  it("la limite recopiée égale celle du voisin", () => {
    expect(COTE_MAX_CAPTURE).toBe(COTE_MAX_CLAUDE);
  });
});

describe("lecture de la réponse en brouillon", () => {
  it("réponse au schéma : ok, tous les chiffres sont à relire", () => {
    const r = lireLectureCapture(JSON.stringify(donnee));
    if (!r.ok) throw new Error(r.raisons.join(" | "));
    expect(r.aRelire).toEqual(chiffresARelire(r.brouillon));
    expect(r.aRelire).toHaveLength(5);
  });
  it("accepte une clôture Markdown entière", () => {
    expect(lireLectureCapture("```json\n" + JSON.stringify(donnee) + "\n```").ok).toBe(true);
  });
  it("schéma faux ou JSON cassé : ok false, jamais d'exception", () => {
    for (const t of ["", "pas du json", "{", "null", "[]", JSON.stringify({ ...donnee, version: "autre" }), JSON.stringify({ ...donnee, extra: 1 })]) {
      const r = lireLectureCapture(t);
      expect(r.ok, t).toBe(false);
      if (!r.ok) expect(r.raisons.length).toBeGreaterThan(0);
    }
    expect(lireLectureCapture(undefined as unknown as string).ok).toBe(false);
  });
});

describe("éteint = identique (gardes statiques)", () => {
  const racine = join(__dirname, "..", "..");
  const fichier = join(racine, "src", "briques", "donnees-video", "lecture-capture.ts");
  const source = readFileSync(fichier, "utf8");

  it("aucun fichier de src/ n'importe lecture-capture hors lecture-capture-claude.ts et tableau-de-bord-relecture.ts", () => {
    const trouves: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(ts|tsx|mjs|js)$/.test(n) && p !== fichier && /lecture-capture/.test(readFileSync(p, "utf8"))) trouves.push(p);
      }
    };
    parcourir(join(racine, "src"));
    // G4-08-b1-v20j : + le service de relecture du tableau de bord (premier appelant de la lecture), liste blanche +1 exacte.
    expect(trouves.sort()).toEqual([join(racine, "src", "services", "lecture-capture-claude.ts"), join(racine, "src", "services", "tableau-de-bord-relecture.ts")]);
  });
  it("seuls des import type depuis @/fournisseurs/", () => {
    const imports = source.split("\n").filter((l) => /^\s*import\b/.test(l) && l.includes("@/fournisseurs/"));
    expect(imports.length).toBeGreaterThan(0);
    for (const l of imports) expect(l).toMatch(/^import type /);
    expect(source).not.toMatch(/\bexport\s+\*\s+from|require\(|import\(/);
  });
  it("aucun client, appel, plafond, réservation ni clé de réglage", () => {
    expect(source).not.toMatch(/AppelClaude|fetch\(|plafond|reservation|réservation|reglage|réglage|process\.env|server-only|tbnar|tblec/i);
  });
});
