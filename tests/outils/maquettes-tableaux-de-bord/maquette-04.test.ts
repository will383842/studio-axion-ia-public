/**
 * T-EXT-10 · Maquette 04 « Espace démo · Clients » : conformité à la charte, ancien nom absent, porte de pilotage.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { controlerMaquette, type NomsNeutres } from "../../../outils/maquettes-tableaux-de-bord/charte/controle";

const RACINE = join(process.cwd(), "outils/maquettes-tableaux-de-bord");
const DOSSIER = join(RACINE, "04-clients");
const noms = JSON.parse(readFileSync(join(RACINE, "charte/noms-neutres.json"), "utf8")) as NomsNeutres;

const fichiers = readdirSync(DOSSIER)
  .filter((f) => /\.(html|js|css)$/.test(f))
  .map((f) => ({ chemin: f, contenu: readFileSync(join(DOSSIER, f), "utf8") }));
const provenance = readFileSync(join(DOSSIER, "PROVENANCE.md"), "utf8");
const index = fichiers.find((f) => f.chemin === "index.html")!;

describe("maquette 04-clients", () => {
  it("contient au moins index.html", () => {
    expect(index).toBeDefined();
  });

  it("passe le contrôle de la charte (T-EXT-04)", () => {
    const r = controlerMaquette(fichiers, noms, "04-clients");
    expect(r.defauts).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("ne contient aucun ancien nom interdit", () => {
    const tout = fichiers.map((f) => f.contenu.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()).join("\n");
    for (const interdit of noms.interdits) {
      const mot = interdit.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      expect(tout.includes(mot), interdit).toBe(false);
    }
  });

  it("utilise le nom neutre et l'organisation exemple, sans montant", () => {
    expect(index.contenu).toContain("Espace démo · Clients");
    expect(index.contenu).toContain("Entreprise exemple");
    expect(index.contenu).not.toMatch(/€|\bEUR\b|currency/i);
  });

  it("déclare window.demoMaquette avec les ids de PROVENANCE.md", () => {
    const m = provenance.match(/^Ids d'étapes\s*:\s*(.+)$/m);
    expect(m).not.toBeNull();
    const ids = m![1].split(",").map((s) => s.trim());
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThanOrEqual(9);
    for (const id of ids) expect(id).toMatch(/^[a-z]+$/);
    expect(index.contenu).toMatch(/window\.demoMaquette\s*=/);
    expect(index.contenu).toMatch(/\baller\s*\(/);
    expect(index.contenu).toMatch(/\breinitialiser\s*\(/);
    const liste = index.contenu.match(/IDS_ETAPES\s*=\s*\[([^\]]*)\]/);
    expect(liste).not.toBeNull();
    const idsHtml = [...liste![1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect(idsHtml).toEqual(ids);
  });

  it("PROVENANCE.md cite le chemin source et « données fictives »", () => {
    expect(provenance).toContain(
      "usine/generateurs-video/videos-tableaux-de-bord/sources-packs/04_CRM_BLUEFLOW/04_CRM_BLUEFLOW/90_SOURCES_PROJET_ORIGINAL/interface/index.html",
    );
    expect(provenance).toContain("données fictives");
  });
});
