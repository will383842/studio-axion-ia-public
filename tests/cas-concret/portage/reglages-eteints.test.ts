/**
 * Portage phase 2 · P0 : les six réglages du cas concret sont ÉTEINTS par défaut, rien ne les allume dans le code, et le
 * document promis ne part jamais tout seul (garde par lecture des sources). Base en mémoire, aucun appel réel.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const reglages = await import("@/services/cas-concret-reglages");

const RACINE = process.cwd();
const IDS = ["casConcret.catalogueEtendu", "casConcret.porteB", "casConcret.retouches", "casConcret.documentPromis", "casConcret.ecranFourni", "casConcret.releves", "casConcret.stockMetiers"];

function fichiers(dossier: string): string[] {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier).flatMap((f) => {
    const p = join(dossier, f);
    return statSync(p).isDirectory() ? fichiers(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

/** Un réglage est désigné par son identifiant littéral ou par la constante `REGLAGES_CAS_CONCRET.x` (`REGLES_…` par erreur de frappe aussi). */
const DESIGNE = `(?:["'\`](?:${IDS.map((i) => i.replace(".", "\\.")).join("|")})["'\`]|REGL(?:AG)?ES_CAS_CONCRET\\.\\w+)`;

/** Allumages repérés dans un texte source : écriture d'un des réglages, ou lecture avec défaut vrai. */
function allumages(t: string): string[] {
  const res: string[] = [];
  for (const m of t.matchAll(new RegExp(`ecrireParametre\\(\\s*(${DESIGNE})`, "g"))) res.push(`écrit ${m[1]}`);
  for (const m of t.matchAll(new RegExp(`lireParametre(?:<[^>]*>)?\\(\\s*(${DESIGNE})\\s*,\\s*true`, "g"))) res.push(`lit ${m[1]} avec défaut vrai`);
  return res;
}

const CHEMIN_ENVOI = /publications?|buffer|notification|envoi|zepto|mail|courriel|messagerie|resend|smtp|telegram/i;
/** Chemins importés d'un texte source, imports statiques ET dynamiques. */
function cheminsImportes(t: string): string[] {
  return [...t.matchAll(/(?:from\s+|import\s*\(\s*)["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
}
/** Imports d'envoi repérés dans un texte source. */
function importsEnvoi(t: string): string[] {
  return cheminsImportes(t).filter((c) => CHEMIN_ENVOI.test(c));
}

describe("P0 · réglages éteints", () => {
  beforeEach(() => reinitialiserDepots());

  it("les six réglages ont les identifiants du plan", () => {
    expect(Object.values(reglages.REGLAGES_CAS_CONCRET).sort()).toEqual([...IDS].sort());
  });

  it("tous éteints sans réglage enregistré", async () => {
    for (const id of IDS) expect(await reglages.reglageAllume(id as never), id).toBe(false);
  });

  it("une valeur autre que `true` reste éteinte (texte, nombre, null)", async () => {
    for (const v of ["true", 1, null, "oui"]) {
      await ecrireParametre(IDS[0], v);
      expect(await reglages.reglageAllume(IDS[0] as never), String(v)).toBe(false);
    }
  });

  it("allumé seulement par `true`, et chaque réglage est indépendant", async () => {
    await ecrireParametre("casConcret.porteB", true);
    expect(await reglages.reglageAllume("casConcret.porteB")).toBe(true);
    for (const id of IDS.filter((i) => i !== "casConcret.porteB")) expect(await reglages.reglageAllume(id as never), id).toBe(false);
  });

  it("aucune ligne du code ne les allume (ni `ecrireParametre`, ni valeur par défaut vraie)", () => {
    const fautifs: string[] = [];
    for (const f of [...fichiers(join(RACINE, "src")), ...fichiers(join(RACINE, "studio-rendu"))]) {
      for (const a of allumages(readFileSync(f, "utf8"))) fautifs.push(`${f} ${a}`);
    }
    expect(fautifs).toEqual([]);
  });
});

describe("P0 · le document promis ne part jamais tout seul", () => {
  const DOCUMENT = [
    join(RACINE, "src/services/cas-concret-document.ts"),
    join(RACINE, "src/formats/cas-concret/document.ts"),
    ...fichiers(join(RACINE, "src/components/formats/cas-concret/document")),
  ];
  it("aucun fichier du document n'importe un module d'envoi", () => {
    for (const f of DOCUMENT.filter(existsSync)) expect(importsEnvoi(readFileSync(f, "utf8")), f).toEqual([]);
  });

  it("aucun bouton « Envoyer » dans les écrans du document", () => {
    for (const f of DOCUMENT.filter(existsSync)) expect(readFileSync(f, "utf8"), f).not.toMatch(/>\s*Envoyer\b|Envoyer le document|Envoyer au client/);
  });
});

describe("P0 · les gardes voient ce qu'elles doivent voir (faux fichiers)", () => {
  it("import d'envoi : statique, dynamique et modules d'envoi du studio", () => {
    for (const chemin of [
      "@/services/envois",
      "@/services/envoi-facecam",
      "@/services/C-videos-publication-complements",
      "@/fournisseurs/publication/requetes",
      "@/fournisseurs/publication/inscription",
      "./envois",
    ]) {
      expect(importsEnvoi(`import { x } from "${chemin}";`), `statique ${chemin}`).not.toEqual([]);
      expect(importsEnvoi(`const m = await import("${chemin}");`), `dynamique ${chemin}`).not.toEqual([]);
    }
  });

  it("import sans rapport avec l'envoi : accepté", () => {
    expect(importsEnvoi('import { a } from "./mise-en-page";\nconst b = await import("@/services/_commun");')).toEqual([]);
  });

  it("allumage : le réglage passé par la constante est vu aussi", () => {
    expect(allumages("await ecrireParametre(REGLAGES_CAS_CONCRET.porteB, true);"), "REGLAGES").not.toEqual([]);
    expect(allumages("await ecrireParametre(REGLES_CAS_CONCRET.porteB, true);"), "REGLES").not.toEqual([]);
    expect(allumages("await lireParametre<boolean>(REGLAGES_CAS_CONCRET.retouches, true);"), "lecture").not.toEqual([]);
    expect(allumages("await lireParametre(REGLAGES_CAS_CONCRET.retouches, false);"), "défaut faux").toEqual([]);
  });
});
