/**
 * T-EXT-07 · Maquette 01 « Espace démo · Courriels » : conforme à la charte (T-EXT-04), noms neutres, porte de pilotage.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { controlerMaquette, type NomsNeutres } from "../../../outils/maquettes-tableaux-de-bord/charte/controle";

const RACINE = join(process.cwd(), "outils/maquettes-tableaux-de-bord");
const DOSSIER = join(RACINE, "01-courriels");
const noms = JSON.parse(readFileSync(join(RACINE, "charte/noms-neutres.json"), "utf8")) as NomsNeutres;
const fichiers = readdirSync(DOSSIER)
  .filter((f) => /\.(html|js|css)$/.test(f))
  .map((f) => ({ chemin: f, contenu: readFileSync(join(DOSSIER, f), "utf8") }));
const provenance = readFileSync(join(DOSSIER, "PROVENANCE.md"), "utf8");
const tout = fichiers.map((f) => f.contenu).join("\n");

const SOURCE = "01_ASSISTANT_EMAIL/01_ASSISTANT_EMAIL/90_SOURCES_PROJET_ORIGINAL/ASSISTANT_MAIL_IA_DOSSIER_COMPLET_A_VALIDER/01_INTERFACE";

function idsDeProvenance(): string[] {
  const m = provenance.match(/## Ids d'étapes de `demoMaquette`[\s\S]*?\n([a-z0-9-]+(?:, [a-z0-9-]+)*)\s*\n/);
  expect(m, "liste d'ids dans PROVENANCE.md").not.toBeNull();
  return m![1].split(", ");
}

describe("maquette 01 · Espace démo · Courriels", () => {
  it("contient les quatre fichiers attendus", () => {
    expect(fichiers.map((f) => f.chemin).sort()).toEqual(["app.js", "demo-data.js", "index.html", "styles.css"]);
  });
  it("passe le contrôle de la charte (controlerMaquette)", () => {
    const r = controlerMaquette(fichiers, noms, "01-courriels");
    expect(r.defauts).toEqual([]);
    expect(r.ok).toBe(true);
  });
  it("n'emploie aucun ancien nom interdit", () => {
    const norm = tout.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    for (const interdit of noms.interdits) {
      const mot = interdit.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u");
      expect(re.test(norm), interdit).toBe(false);
    }
  });
  it("utilise les noms neutres, la charte commune et le bouton de simulation", () => {
    const html = fichiers.find((f) => f.chemin === "index.html")!.contenu;
    expect(html).toContain("Espace démo · Courriels");
    expect(html).toContain("Entreprise exemple");
    expect(html).toContain("../charte/charte.css");
    expect(html).toContain("mention-demo");
    expect(tout).toContain("Valider (simulation, aucun envoi)");
    expect(tout).not.toMatch(/Valider et envoyer/);
  });
  it("n'emploie que des adresses fictives en exemple.invalid", () => {
    const adresses = tout.match(/[\w.+-]+@[\w.-]+\.[a-z]+/gi) ?? [];
    expect(adresses.length).toBeGreaterThan(0);
    for (const a of adresses) expect(a.toLowerCase().endsWith("@exemple.invalid"), a).toBe(true);
  });
  it("déclare window.demoMaquette avec les ids de PROVENANCE.md", () => {
    const ids = idsDeProvenance();
    expect(ids.length).toBeGreaterThanOrEqual(1);
    expect(ids.length).toBeLessThanOrEqual(9);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    const app = fichiers.find((f) => f.chemin === "app.js")!.contenu;
    expect(app).toMatch(/window\.demoMaquette\s*=/);
    expect(app).toMatch(/aller\(id\)/);
    expect(app).toMatch(/reinitialiser\(\)/);
    const declares = app.match(/const ETAPES=\[([^\]]*)\]/);
    expect(declares).not.toBeNull();
    expect([...declares![1].matchAll(/"([^"]+)"/g)].map((m) => m[1])).toEqual(ids);
  });
  it("PROVENANCE.md cite le chemin source et « données fictives »", () => {
    expect(provenance).toContain(SOURCE);
    expect(provenance).toContain("données fictives");
  });
});
