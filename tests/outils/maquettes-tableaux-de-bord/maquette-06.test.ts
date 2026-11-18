/**
 * T-EXT-11 · Maquette 06 « Espace démo · Équipe » : conformité à la charte, porte de pilotage, provenance.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { controlerMaquette, type NomsNeutres } from "../../../outils/maquettes-tableaux-de-bord/charte/controle";

const RACINE = join(process.cwd(), "outils/maquettes-tableaux-de-bord");
const DOSSIER = join(RACINE, "06-equipe");
const noms = JSON.parse(readFileSync(join(RACINE, "charte/noms-neutres.json"), "utf8")) as NomsNeutres;
const fichiers = readdirSync(DOSSIER)
  .filter((f) => /\.(html|js|css)$/.test(f))
  .map((f) => ({ chemin: f, contenu: readFileSync(join(DOSSIER, f), "utf8") }));
const html = fichiers.find((f) => f.chemin === "index.html")!.contenu;
const provenance = readFileSync(join(DOSSIER, "PROVENANCE.md"), "utf8");

const SOURCE = "usine/generateurs-video/videos-tableaux-de-bord/sources-packs/06_RH/06_RH/90_SOURCES_PROJET_ORIGINAL/FEUILLE_RH_VIDEO_EN_REVISION/APPLICATION/index.html";

function idsProvenance(): string[] {
  const section = provenance.split(/^## Ids d'étapes.*$/m)[1] ?? "";
  const ligne = section.split("\n").find((l) => l.startsWith("`")) ?? "";
  return [...ligne.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

describe("maquette 06-equipe", () => {
  it("contient un index.html", () => {
    expect(fichiers.map((f) => f.chemin)).toContain("index.html");
  });
  it("passe le contrôle de la charte", () => {
    expect(controlerMaquette(fichiers, noms, "06-equipe")).toEqual({ ok: true, defauts: [] });
  });
  it("aucun ancien nom interdit, nom neutre présent, charte liée", () => {
    const texte = html.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    for (const interdit of noms.interdits) expect(texte, interdit).not.toContain(interdit);
    expect(html).toContain("Espace démo · Équipe");
    expect(html).toContain("Entreprise exemple");
    expect(html).toContain('href="../charte/charte.css"');
    expect(html).toContain("mention-demo");
  });
  it("aucune police ni bloc d'ombre hors charte", () => {
    expect(html).not.toMatch(/Georgia|Inter\b|gradient|box-shadow|text-shadow/);
  });
  it("déclare window.demoMaquette avec les ids de PROVENANCE.md", () => {
    const ids = idsProvenance();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThanOrEqual(9);
    for (const id of ids) expect(id).toMatch(/^[a-z]+$/);
    expect(html).toMatch(/window\.demoMaquette\s*=\s*\{[^}]*aller[^}]*reinitialiser/);
    const m = html.match(/const ETAPES=\[([^\]]*)\]/);
    expect(m).not.toBeNull();
    const dansHtml = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect(dansHtml).toEqual(ids);
  });
  it("reinitialiser repart des données d'origine, sans confirmation", () => {
    expect(html).toMatch(/function resetAll\(\)\{state=base\(\)/);
    expect(html).not.toContain("confirm(");
  });
  it("allerEtape efface le toast : le résultat ne dépend pas de l'étape précédente", () => {
    const corps = html.slice(html.indexOf("function allerEtape("), html.indexOf("window.demoMaquette="));
    expect(corps).toContain("clearTimeout(window.toastTimer)");
    expect(corps).toMatch(/getElementById\('toast'\)\.classList\.remove\('show'\)/);
  });
  it("aucun émoji en couleur dans la maquette (signes monochromes seulement)", () => {
    const emoji = /[\u{1F000}-\u{1FAFF}\u{FE0F}\u{200D}\u{20E3}\u{2705}\u{274C}\u{2728}\u{26A1}\u{2B50}\u{2B55}\u{231A}\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{2614}\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26AA}\u{26AB}\u{26BD}\u{26BE}\u{26C4}\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2753}-\u{2755}\u{2757}\u{2795}-\u{2797}\u{27B0}\u{27BF}\u{2B1B}\u{2B1C}]/u;
    for (const f of fichiers) expect(f.contenu.match(emoji)?.[0] ?? null, f.chemin).toBeNull();
  });
  it("PROVENANCE.md cite la source et « données fictives »", () => {
    expect(provenance).toContain(SOURCE);
    expect(provenance).toContain("données fictives");
    expect(provenance).toContain("16/11");
  });
});
