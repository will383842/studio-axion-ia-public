/**
 * T-EXT-09 · Maquette 03 « Espace démo · Accueil 24 h » : conformité à la charte (contrôle T-EXT-04), porte de pilotage, provenance.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { controlerMaquette, type NomsNeutres } from "../../../outils/maquettes-tableaux-de-bord/charte/controle";

const RACINE = join(process.cwd(), "outils/maquettes-tableaux-de-bord");
const DOSSIER = join(RACINE, "03-accueil-24h");
const noms = JSON.parse(readFileSync(join(RACINE, "charte/noms-neutres.json"), "utf8")) as NomsNeutres;
const provenance = readFileSync(join(DOSSIER, "PROVENANCE.md"), "utf8");

const fichiers = readdirSync(DOSSIER)
  .filter((f) => /\.(html|js|css)$/.test(f))
  .map((f) => ({ chemin: f, contenu: readFileSync(join(DOSSIER, f), "utf8") }));
const index = fichiers.find((f) => f.chemin === "index.html")!;

function idsDeProvenance(): string[] {
  const bloc = provenance.split(/^## Ids d'étapes.*$/m)[1] ?? "";
  return [...bloc.matchAll(/^- ([a-z]+)\s*$/gm)].map((m) => m[1]);
}

describe("maquette 03 · accueil 24 h", () => {
  it("le dossier contient index.html et passe le contrôle de la charte", () => {
    expect(index).toBeDefined();
    const r = controlerMaquette(fichiers, noms, "03-accueil-24h");
    expect(r.defauts).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("aucun ancien nom interdit, aucune marque de messagerie", () => {
    const texte = fichiers.map((f) => f.contenu.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()).join("\n");
    for (const interdit of noms.interdits) {
      const mot = interdit.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      expect(texte.includes(mot), interdit).toBe(false);
    }
    expect(texte).not.toContain("telegram");
  });

  it("noms neutres affichés et bandeau de démonstration", () => {
    expect(index.contenu).toContain("Espace démo · Accueil 24 h");
    expect(index.contenu).toContain("Entreprise exemple");
    expect(index.contenu).toContain("Démonstration · données fictives");
    expect(index.contenu).toContain('href="../charte/charte.css"');
  });

  it("aucun montant d'argent, graphique étiqueté « exemple », promesse « pleine nuit » tempérée", () => {
    expect(index.contenu).not.toMatch(/€|\beuros?\b|\bEUR\b/i);
    expect(index.contenu).toMatch(/Activité hebdomadaire · <span class="tag">exemple<\/span>/);
    expect(index.contenu).not.toMatch(/même (la nuit|en pleine nuit)/i);
    expect(index.contenu).toContain("y compris hors des heures d’ouverture, avec relecture humaine");
  });

  it("window.demoMaquette déclaré avec les ids de PROVENANCE.md (5 étapes du scénario d'origine)", () => {
    const ids = idsDeProvenance();
    expect(ids).toEqual(["message", "analyse", "alertes", "astreinte", "reprise"]);
    expect(ids.length).toBeLessThanOrEqual(9);
    for (const id of ids) expect(id).toMatch(/^[a-z]+$/);
    expect(index.contenu).toMatch(/window\.demoMaquette\s*=\s*\{\s*aller\(/);
    expect(index.contenu).toMatch(/reinitialiser\(\)/);
    const table = index.contenu.match(/const ETAPES=\{([^}]*)\}/)?.[1] ?? "";
    expect([...table.matchAll(/([a-z]+):(\d)/g)].map((m) => m[1])).toEqual(ids);
  });

  it("aucun émoji en couleur dans la maquette (signes monochromes seulement)", () => {
    const tolere = new Set([..."✦✓➤✈✉☾⚙▦◉▤▥▶●↺→✓"]);
    for (const f of fichiers) {
      expect(f.contenu).not.toMatch(/[\u26A1\u{1F6A8}]/u);
      const trouves = [...f.contenu.matchAll(/\p{Extended_Pictographic}|\p{Emoji_Presentation}/gu)].map((m) => m[0]).filter((c) => !tolere.has(c));
      expect(trouves, f.chemin).toEqual([]);
    }
  });

  it("courriels en @exemple.invalid uniquement", () => {
    const courriels = [...index.contenu.matchAll(/[\w.+-]+@[\w.-]+/g)].map((m) => m[0]);
    expect(courriels.length).toBeGreaterThan(0);
    for (const c of courriels) expect(c).toMatch(/@exemple\.invalid$/);
  });

  it("PROVENANCE.md cite le chemin source et « données fictives »", () => {
    expect(provenance).toContain("90_SOURCES_PROJET_ORIGINAL/CHATBOT_24H_PRET_POUR_CLAUDE_CODE/01_INTERFACE/index.html");
    expect(provenance).toContain("données fictives");
    expect(provenance).toContain("16/11");
  });
});
