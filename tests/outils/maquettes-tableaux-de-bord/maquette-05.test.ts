/**
 * T-EXT-05 · Maquette 05 Stocks : conformité à la charte (T-EXT-04), aucun argent, porte de pilotage.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { controlerMaquette, type NomsNeutres } from "../../../outils/maquettes-tableaux-de-bord/charte/controle";

const RACINE = join(process.cwd(), "outils/maquettes-tableaux-de-bord");
const DOSSIER = join(RACINE, "05-stocks");
const noms = JSON.parse(readFileSync(join(RACINE, "charte/noms-neutres.json"), "utf8")) as NomsNeutres;
const lire = (n: string) => readFileSync(join(DOSSIER, n), "utf8");
const fichiers = readdirSync(DOSSIER)
  .filter((n) => /\.(html|js|css)$/.test(n))
  .map((n) => ({ chemin: n, contenu: lire(n) }));

describe("maquette 05 Stocks", () => {
  it("contient les 4 fichiers de la maquette et la provenance", () => {
    expect(fichiers.map((f) => f.chemin).sort()).toEqual(["app.js", "demo-data.js", "index.html", "styles.css"]);
    expect(readdirSync(DOSSIER)).toContain("PROVENANCE.md");
  });

  it("passe controlerMaquette sans défaut", () => {
    const r = controlerMaquette(fichiers, noms, "05-stocks");
    expect(r.defauts).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("n'affiche aucun argent ni prix", () => {
    for (const f of fichiers) {
      expect(f.contenu, f.chemin).not.toMatch(/\bprice\b|currency|€/i);
    }
  });

  it("ne promet ni scan de codes-barres ni réapprovisionnement automatique", () => {
    const tout = fichiers.map((f) => f.contenu).join("\n").toLowerCase();
    expect(tout).not.toMatch(/code.?barre|scan(ner|\b)|barcode|réapprovisionnement automatique/);
  });

  it("déclare les 6 étapes de la porte window.demoMaquette", () => {
    const app = lire("app.js");
    expect(app).toMatch(/window\.demoMaquette\s*=/);
    expect(app).toMatch(/aller\s*\(/);
    expect(app).toMatch(/reinitialiser\s*\(/);
    for (const id of ["alerte", "seuil", "analyse", "proposition", "validation", "fin"]) {
      expect(app, id).toMatch(new RegExp(`\\b${id}\\s*:`));
    }
    expect(app).not.toMatch(/ordivaTest/);
  });

  it("PROVENANCE.md cite le chemin source et « données fictives »", () => {
    const p = lire("PROVENANCE.md");
    expect(p).toContain("sources-packs/05_GESTION_STOCKS/05_GESTION_STOCKS/90_SOURCES_PROJET_ORIGINAL/GESTION_STOCKS_PACK_REVISION/01_INTERFACE");
    expect(p).toContain("données fictives");
  });

  it("le bandeau mention-demo est dans index.html et la maquette est neutre", () => {
    const html = lire("index.html");
    expect(html).toContain("mention-demo");
    expect(html).toContain("Espace démo · Stocks");
    expect(html).toContain("Entreprise exemple");
  });
  it("n'utilise aucun émoji en couleur (signes monochromes seulement)", () => {
    for (const f of fichiers) {
      expect(f.contenu, f.chemin).not.toMatch(/\p{Emoji_Presentation}|[\uFE0F\u{1F000}-\u{1FAFF}]/u);
    }
  });

  it("n'expose aucun fournisseur de marque ni courriel hors exemple.invalid", () => {
    const d = lire("demo-data.js");
    expect(d).not.toMatch(/nordex|cartem|fabrilys|linéa/i);
    for (const m of d.match(/[\w.-]+@[\w.-]+/g) ?? []) expect(m).toMatch(/@exemple\.invalid$/);
  });

  it("reinitialiser() efface le message affiché (capture déterministe)", () => {
    const app = lire("app.js");
    expect(app).toMatch(/function reset\(silent\)\{[^}]*clearTimeout\(toastTimer\)[^]*?textContent=''/);
  });

});
