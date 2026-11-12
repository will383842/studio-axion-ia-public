/**
 * L1-11 · ADR 0010 à 0013 : présence, numérotation continue, sections, nuances obligatoires,
 * aucun nom du fondateur, aucun montant. Lecture de fichiers seulement, aucun appel réel.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(process.cwd(), "docs", "adr");
const ADR = [
  ["0010", "0010-calendrier-editorial-propre.md"],
  ["0011", "0011-stockage-classement-visuels.md"],
  ["0012", "0012-anti-repetition-et-sonde-publication.md"],
  ["0013", "0013-frontiere-usine-studio.md"],
] as const;
const lire = (f: string) => readFileSync(join(DOSSIER, f), "utf8");

describe("ADR 0010 à 0013", () => {
  it("numérotation continue : 0001 à 0004 existent, 0010 à 0013 sont là, une seule fois chacun", () => {
    const numeros = readdirSync(DOSSIER).map((f) => f.slice(0, 4)).filter((n) => /^\d{4}$/.test(n));
    for (const n of ["0001", "0002", "0003", "0004"]) expect(numeros, n).toContain(n);
    for (const [n] of ADR) expect(numeros.filter((x) => x === n)).toHaveLength(1);
    for (const [n, f] of ADR) expect(existsSync(join(DOSSIER, f)), f).toBe(true);
  });

  it.each(ADR)("%s : en-tête, statut brouillon, sections Contexte / Décision / Conséquences", (n, f) => {
    const t = lire(f);
    expect(t.startsWith(`# ADR-${n} · `)).toBe(true);
    expect(t).toMatch(/- Statut : brouillon/);
    for (const s of ["## Contexte", "## Décision", "## Conséquences"]) expect(t).toContain(s);
  });

  it.each(ADR)("%s : dépôt public, « le fondateur », aucun prénom ni montant", (_n, f) => {
    const t = lire(f);
    expect(t).toMatch(/le fondateur/);
    expect(t).not.toMatch(/\d\s?(€|euros?|\$|USD)/i);
  });

  // Motifs privés : lus dans un fichier fourni à l'exécution (variable INTERDITS_FICHIER), jamais dans le dépôt.
  // Sans ce fichier, le test est SAUTÉ et apparaît comme tel dans le rapport (jamais un faux vert silencieux).
  const fichierInterdits = process.env.INTERDITS_FICHIER;
  it.skipIf(!fichierInterdits || !existsSync(fichierInterdits))(
    "aucun mot interdit (actif seulement si INTERDITS_FICHIER est fourni)",
    () => {
      const motifs = readFileSync(fichierInterdits as string, "utf8").split("\n").filter(Boolean);
      expect(motifs.length).toBeGreaterThan(0);
      for (const [, f] of ADR) {
        for (const motif of motifs) expect(new RegExp(motif, "i").test(lire(f)), `motif interdit dans ${f}`).toBe(false);
      }
    },
  );

  it("0010 : calendrier propre au Studio, date par défaut fixée par l'usine (D-14), le choix du fondateur l'emporte", () => {
    const t = lire(ADR[0][1]);
    expect(t).toMatch(/D-14/);
    expect(t).toMatch(/choix du fondateur l'emporte/);
    for (const l of t.split("\n").filter((x) => /fait foi/i.test(x))) expect(l).toMatch(/posée à la main/);
  });

  it("0013 : garde sortante ; l'usine ne parle jamais à Zernio", () => {
    const t = lire(ADR[3][1]);
    expect(t).toMatch(/garde sortante/i);
    expect(t).toMatch(/l'usine ne parle jamais à Zernio/i);
  });

  it("0012 : sonde de publication sans appel réel dans l'ADR", () => {
    expect(lire(ADR[2][1])).toMatch(/sonde/i);
  });

  it.each([ADR[1], ADR[2]])("%s : précise que le contenu reste à confronter à D8-07 avant validation", (_n, f) => {
    expect(lire(f)).toMatch(/- Source : à confronter à D8-07 avant validation/);
  });

  it("0010 : ne recopie pas les formules de la fiche", () => {
    const t = lire(ADR[0][1]);
    expect(t).not.toMatch(/dès la V1|maintenue|l'emporte toujours/);
  });
});
