import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DESSINS, TRACES_DESSINS, dessinValide, trouverDessin } from "../../../src/briques/dessins";
import { DROITS, trouverDroit } from "../../../src/briques/droits";

const RACINE = new URL("../../../", import.meta.url);
const lister = (rel: string) =>
  readdirSync(new URL(rel, RACINE)).filter((f) => f !== "index.ts").map((f) => f.replace(/\.(ts|svg)$/, ""));

const attributsDe = (svg: string, balise: string) =>
  [...svg.matchAll(new RegExp(`<${balise}\\b([^>]*)>`, "g"))].map((m) => m[1]);

describe("banque de dessins", () => {
  it("40 dessins, identifiants uniques, index complet", () => {
    const ids = DESSINS.map((d) => d.id);
    expect(ids).toHaveLength(40);
    expect(new Set(ids).size).toBe(40);
    expect([...ids].sort()).toEqual(lister("src/briques/dessins/registre/").sort());
    expect([...ids].sort()).toEqual(lister("src/briques/dessins/traces/").filter((f) => f !== "traces").sort());
    expect(Object.keys(TRACES_DESSINS).sort()).toEqual([...ids].sort());
  });

  it("chaque dessin a un nom, des mots-clés, un tracé et une entrée au registre des droits", () => {
    for (const d of DESSINS) {
      expect(d.nom.trim()).not.toBe("");
      expect(d.motsCles.length).toBeGreaterThan(0);
      expect(d.version).toBeGreaterThanOrEqual(1);
      expect(d.trace).toBe(`src/briques/dessins/traces/${d.id}.svg`);
      expect(() => readFileSync(new URL(d.trace, RACINE))).not.toThrow();
      expect(trouverDroit(d.droitId), `droit manquant pour « ${d.id} »`).toBeDefined();
      expect(trouverDroit(d.droitId)?.type).toBe("dessin");
    }
  });

  it("aucune entrée de droit « dessin-… » orpheline", () => {
    const droitsDessins = DROITS.filter((x) => x.id.startsWith("dessin-")).map((x) => x.id).sort();
    expect(droitsDessins).toEqual(DESSINS.map((d) => d.droitId).sort());
  });

  it("SVG valide : bonne grille, même trait, contour seulement, currentColor, mêmes chaînes que les données", () => {
    for (const d of DESSINS) {
      const svg = readFileSync(new URL(d.trace, RACINE), "utf8");
      expect(svg, d.id).not.toContain("\r");
      expect(svg.trim().startsWith("<svg ")).toBe(true);
      const [racine] = attributsDe(svg, "svg");
      expect(racine).toContain('viewBox="0 0 24 24"');
      expect(racine).toContain('fill="none"');
      expect(racine).toContain('stroke="currentColor"');
      expect(racine).toContain('stroke-width="2"');
      expect(racine).toContain('stroke-linecap="round"');
      expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(|<image|<text|<script|style=/);
      const balises = [...svg.matchAll(/<([a-z]+)\b/g)].map((m) => m[1]);
      expect(new Set(balises)).toEqual(new Set(["svg", "path"]));
      const chemins = attributsDe(svg, "path").map((a) => /\bd="([^"]+)"/.exec(a)![1]);
      expect(chemins.length).toBeGreaterThan(0);
      for (const a of attributsDe(svg, "path")) expect(a).not.toMatch(/\bfill=|\bstroke=/);
      expect(TRACES_DESSINS[d.id as keyof typeof TRACES_DESSINS].map((n) => n[1].d)).toEqual(chemins);
      // Les chemins ne contiennent que des commandes de tracé et des nombres.
      for (const c of chemins) expect(c).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/);
    }
  });

  it("les 30 dessins de bureau et d'IA en entreprise sont présents, chacun avec son tracé et son droit", () => {
    const attendus = ["calendrier","telephone","ordinateur-portable","dossier","trombone","crayon","gomme","calculatrice","graphique-barres","courbe-monte","fleche-droite","fleche-boucle","croix","cadenas","cle","engrenage","eclair","sablier","chronometre","panier","piece","batiment","maillons","liste-puces","liste-cochee","guillemets","etoile","drapeau","balance","puzzle"];
    for (const id of attendus) {
      expect(trouverDessin(id), id).toBeDefined();
      expect(TRACES_DESSINS[id as keyof typeof TRACES_DESSINS], `tracé manquant : ${id}`).toBeDefined();
      expect(dessinValide(id, "2026-10-11"), id).toBe(true);
    }
    expect(DESSINS).toHaveLength(10 + attendus.length);
  });

  it("dessinValide (règle V11) : existe + droit valide", () => {
    expect(trouverDessin("loupe")?.nom).toBe("Loupe");
    expect(dessinValide("loupe", "2026-10-11")).toBe(true);
    expect(dessinValide("inconnu")).toBe(false);
  });

  it("dessinValide est faux si le droit manque", () => {
    const d = DESSINS[0] as { droitId: string };
    const avant = d.droitId;
    d.droitId = "dessin-fantome";
    try {
      expect(dessinValide(DESSINS[0].id)).toBe(false);
    } finally {
      d.droitId = avant;
    }
  });
});
