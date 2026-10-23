/**
 * G0 — FIXTURES SANS DONNÉE CLIENT (plan v5 B.3.7) : anonymisation sur les registres FICTIFS, refus d'écrire s'il reste
 * un nom, un lieu, une valeur de cas client ou une clé ; liste locale non versionnée lue si elle existe.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { anonymiserFixture, preparerFixture, restesSensibles, termesSensibles } from "@/generateur/fixtures";
import { MATIERES_FICTIVES } from "./generateur/matieres-fictives";
import { PREUVES_FICTIVES } from "./generateur/preuves-fictives";
import { CLE_ESSAI_CLAUDE } from "./helpers/g0";

const termes = termesSensibles({ preuves: PREUVES_FICTIVES, matieres: MATIERES_FICTIVES });

describe("G0 · exporter-fixture", () => {
  it("termes tirés des registres : noms sensibles, lieu, valeurs des cas clients (pas celles d'une loi)", () => {
    const t = termes.map((x) => x.terme);
    expect(t).toEqual(expect.arrayContaining(["Société Fictive Alpha", "Jeanne Exemple", "Cabinet Bêta Conseil", "Paul Fictif", "Fictiville", "6 heures", "340 dossiers"]));
    expect(new Set(t).size).toBe(t.length);
  });

  it("anonymise (casse et accents ignorés à la vérification) et laisse le reste intact", () => {
    const brut = JSON.stringify({ texte: "Chez Société Fictive Alpha, à fictiville, 6 heures gagnées ; Paul Fictif a demandé.", cle: CLE_ESSAI_CLAUDE });
    const propre = preparerFixture(brut, termes);
    expect(propre).toContain("Chez [nom], à [lieu], [valeur] gagnées ; [nom] a demandé.");
    expect(propre).not.toMatch(/sk-ant-/);
  });

  it("refuse d'écrire s'il reste un terme (collé à un mot, il échappe au remplacement mais pas à la vérification)", () => {
    const brut = "Voir les Cabinet Bêta Conseils de fictivillois.";
    expect(anonymiserFixture("Cabinet Beta Conseil", termes)).toBe("Cabinet Beta Conseil");
    expect(restesSensibles("cabinet beta conseil", termes)).not.toEqual([]);
    expect(() => preparerFixture(brut, termes)).toThrow(/Fixture refusée/);
  });

  it("liste locale (non versionnée) prise en compte", () => {
    const t = termesSensibles({}, ["Client Secret Local"]);
    expect(preparerFixture("avec Client Secret Local dedans", t)).toBe("avec [terme] dedans");
  });

  it("les fixtures déjà versionnées ne contiennent aucun terme sensible ni clé (et la liste locale, si présente)", () => {
    const dossier = join(process.cwd(), "tests", "generateur", "fixtures");
    const local = join(process.cwd(), ".fixtures-termes-sensibles");
    const tous = termesSensibles({ preuves: PREUVES_FICTIVES, matieres: MATIERES_FICTIVES }, existsSync(local) ? readFileSync(local, "utf8").split(/\r?\n/) : []);
    const fichiers = existsSync(dossier) ? readdirSync(dossier).filter((f) => f.endsWith(".json")) : [];
    for (const f of fichiers) expect(restesSensibles(readFileSync(join(dossier, f), "utf8"), tous), f).toEqual([]);
  });
});
