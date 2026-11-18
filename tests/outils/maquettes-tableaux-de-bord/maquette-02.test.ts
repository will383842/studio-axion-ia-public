/**
 * T-EXT-08 · Maquette 02 « Espace démo · Projets » : conformité à la charte (T-EXT-04), porte de pilotage, provenance.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { controlerMaquette, type NomsNeutres } from "../../../outils/maquettes-tableaux-de-bord/charte/controle";

const RACINE = join(process.cwd(), "outils/maquettes-tableaux-de-bord");
const DOSSIER = join(RACINE, "02-projets");
const noms = JSON.parse(readFileSync(join(RACINE, "charte/noms-neutres.json"), "utf8")) as NomsNeutres;
const fichiers = readdirSync(DOSSIER)
  .filter((f) => /\.(html|js|css)$/.test(f))
  .map((f) => ({ chemin: f, contenu: readFileSync(join(DOSSIER, f), "utf8") }));
const provenance = readFileSync(join(DOSSIER, "PROVENANCE.md"), "utf8");

describe("maquette 02 · Espace démo · Projets", () => {
  it("contient index.html, app.js, demo-data.js et styles.css", () => {
    expect(fichiers.map((f) => f.chemin).sort()).toEqual(["app.js", "demo-data.js", "index.html", "styles.css"]);
  });

  it("passe le contrôle de la charte", () => {
    const r = controlerMaquette(fichiers, noms, "02-projets");
    expect(r.defauts).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("ne contient aucun ancien nom interdit", () => {
    const texte = fichiers.map((f) => f.contenu.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()).join("\n");
    for (const interdit of noms.interdits) expect(texte).not.toMatch(new RegExp(`(?<![a-z0-9])${interdit.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`));
    expect(texte).not.toContain("product-blur");
    expect(texte).not.toContain("sylvaqa");
  });

  it("reprend le nom neutre et l'organisation « Entreprise exemple »", () => {
    const tout = fichiers.map((f) => f.contenu).join("\n");
    expect(tout).toContain("Espace démo · Projets");
    expect(tout).toContain("Entreprise exemple");
    expect(tout).not.toMatch(/"budget"/);
  });

  it("déclare window.demoMaquette avec les ids de PROVENANCE.md", () => {
    const section = provenance.split("## Étapes de `demoMaquette`")[1] ?? "";
    const ids = [...section.matchAll(/^- ([a-z0-9-]+)\s*$/gm)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThanOrEqual(9);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    const app = fichiers.find((f) => f.chemin === "app.js")!.contenu;
    expect(app).toMatch(/window\.demoMaquette\s*=\s*\{\s*aller\(/);
    expect(app).toContain("reinitialiser()");
    const declares = JSON.parse(app.match(/const ETAPES=(\[[^\]]*\])/)![1]) as string[];
    expect(declares).toEqual(ids);
  });

  it("n'utilise aucun émoji en couleur (signes monochromes seulement)", () => {
    const couleur = /[\p{Emoji_Presentation}\uFE0F\u26A1\u{1F6A8}]/u;
    for (const f of fichiers) {
      const trouves = [...f.contenu].filter((c) => couleur.test(c));
      expect({ fichier: f.chemin, trouves }).toEqual({ fichier: f.chemin, trouves: [] });
    }
  });

  it("n'emploie pas l'orange en texte sur fond clair et garde un en-tête opaque", () => {
    const css = fichiers.find((f) => f.chemin === "styles.css")!.contenu;
    expect(css).not.toMatch(/[;{]color:(#D97757|var\(--orange\)|var\(--warning\))/i);
    expect(css).toMatch(/\.topbar\{[^}]*background:var\(--ivoire\)/);
    expect(css).not.toMatch(/font-size:(9|10)px/);
  });

  it("reinitialiser() repart sans message", () => {
    const app = fichiers.find((f) => f.chemin === "app.js")!.contenu;
    expect(app).toMatch(/reinitialiser\(\)\{reset\(true\)\}/);
    expect(app).toMatch(/if\(!silent\)notify\('Démo réinitialisée/);
    expect(app).toMatch(/if\(video\)stopVideo\(silent\)/);
    expect(app).toMatch(/function stopVideo\(silent\)\{[^}]*if\(!silent\)notify\('Mode vidéo arrêté'\)/);
  });

  it("aller() efface le toast avant d'afficher l'étape", () => {
    const app = fichiers.find((f) => f.chemin === "app.js")!.contenu;
    expect(app).toMatch(/aller\(id\)\{[^}]*clearTimeout\(toastTimer\);\$\('#toast'\)\.classList\.remove\('show'\)/);
  });

  it("PROVENANCE.md cite le chemin source et « données fictives »", () => {
    expect(provenance).toContain("sources-packs/02_GESTION_PROJETS/02_GESTION_PROJETS/90_SOURCES_PROJET_ORIGINAL/01_INTERFACE");
    expect(provenance).toContain("données fictives");
  });
});
