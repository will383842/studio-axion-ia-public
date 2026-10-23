/**
 * Consigne du découpeur v21 (refus « page lisible » du 23/10/2026, série Automatisations) : le découpeur reçoit le style
 * du tableau de la série et deux règles de FORME (une scène dit 3 phrases au plus ; au tableau-blanc et au paperboard,
 * une page porte UN détail OU un visuel). Ce sont des règles de forme, pas des pixels : Claude ne mesure pas la page.
 * Ce test vérifie le texte envoyé au modèle, pas ce que le modèle en fait (seul un essai réel le dit).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DESSINS } from "@/briques/dessins";
import { debutsDePhrase } from "@/domaine/controles-script/texte";
import { CONSIGNE_DECOUPAGE, partiesDuDecoupage, roleDecoupageTableau, variableDecoupage, type EntreeDecoupage } from "@/moteurs/montage-tableau/decoupage";

const cas = JSON.parse(readFileSync(join(__dirname, "temoins", "decoupage-v-365dd2ae67ee.json"), "utf8"));

function entree(serie: string, habillage = "reference/3"): EntreeDecoupage {
  const b = cas.reponse as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const parties = partiesDuDecoupage(cas.parties);
  return {
    texteScript: cas.texteScript, structure: b.structure, serie: { code: serie, nom: serie }, douleur: b.douleur, gesteMinute: b.gesteMinute,
    preuves: [], dessins: DESSINS.map((d) => ({ id: d.id, motsCles: d.motsCles })),
    videoId: b.videoId, versionId: b.versionId, habillage, stylo: b.stylo, ratio: b.ratio,
    controle: { aujourdhui: "2026-10-18", sourcesChiffres: [], preuves: [], matieres: [] },
    ...(parties ? { parties } : {}),
  } as EntreeDecoupage;
}

const styleDonne = (v: string) => /<style_tableau>\n([^\n]*)\n<\/style_tableau>/.exec(v)?.[1];

describe("variableDecoupage : le style du tableau de la série", () => {
  it.each([
    ["automatisations", "tableau-blanc"],
    ["formation", "ardoise"],
    ["audit", "paperboard"],
    ["coaching", "paperboard"],
  ])("reference/3, série %s → %s", (serie, style) => {
    expect(styleDonne(variableDecoupage(entree(serie)))).toBe(style);
  });

  it("reference/1 et reference/2 : pas de balise style_tableau", () => {
    expect(variableDecoupage(entree("automatisations", "reference/1"))).not.toContain("style_tableau");
    expect(variableDecoupage(entree("automatisations", "reference/2"))).not.toContain("style_tableau");
  });
});

describe("consigne v21", () => {
  it("donne les deux règles de forme", () => {
    expect(CONSIGNE_DECOUPAGE).toContain("3 phrases au plus");
    expect(CONSIGNE_DECOUPAGE).toContain("UN détail OU UN VISUEL, jamais les deux");
  });

  it("version 21", () => {
    expect(roleDecoupageTableau.version).toBe(21);
  });

  it("l'exemple : la page 2 a DEUX scènes (s02, s03), chaque scène d'exemple dit 3 phrases au plus, le texte dit n'a pas changé", () => {
    const scenes = [...CONSIGNE_DECOUPAGE.slice(CONSIGNE_DECOUPAGE.indexOf("EXEMPLE (forme exacte attendue, d'après le témoin v5")).matchAll(/^\{"id":"s\d+".*$/gm)].map((m) => JSON.parse(m[0]) as { id: string; page: number; texteDit: string; gabarit: { role: string } });
    const page2 = scenes.filter((s) => s.page === 2);
    expect(page2.map((s) => s.id)).toEqual(["s02", "s03"]);
    expect(page2.every((s) => s.gabarit.role === "douleur")).toBe(true);
    expect(page2.map((s) => s.texteDit).join(" ")).toBe("Un client appelle. On fouille la boîte mail du collègue. Puis on l'appelle en congé. Le client s'en aperçoit. Chez vous, qui reprendrait ce dossier ?");
    for (const s of scenes) expect(debutsDePhrase(s.texteDit).length + 1, s.id).toBeLessThanOrEqual(3);
  });

  const exemple = () =>
    [...CONSIGNE_DECOUPAGE.slice(CONSIGNE_DECOUPAGE.indexOf("EXEMPLE (forme exacte attendue, d'après le témoin v5")).matchAll(/^\{"id":"s\d+".*$/gm)].map(
      (m) => JSON.parse(m[0]) as { id: string; page: number; gabarit: { role: string; visuel?: unknown }; elements: { bloc?: string; texte?: string; type: string }[] },
    );
  const puce = () => CONSIGNE_DECOUPAGE.split(String.fromCharCode(10)).find((l) => l.startsWith("- PLACE :")) ?? "";

  it("l'exemple est dit « d'après le témoin v5 » (s03 n'existe pas tel quel dans le témoin)", () => {
    expect(CONSIGNE_DECOUPAGE).not.toContain("extraits du témoin v5");
    expect(exemple().length).toBeGreaterThan(5);
  });

  it("aucune page de l'exemple n'a à la fois un détail et un visuel", () => {
    for (const s of exemple()) expect(!!s.gabarit.visuel && s.elements.some((e) => e.bloc === "detail"), s.id).toBe(false);
  });

  it("détail de 5 mots au plus dans l'exemple (sauf l'accroche et la page d'appel), et la règle le dit", () => {
    expect(puce()).toContain("(sauf l'accroche et la page d'appel)");
    for (const s of exemple()) {
      if (s.gabarit.role === "accroche" || s.gabarit.role === "appel") continue;
      for (const e of s.elements.filter((e) => e.bloc === "detail")) expect((e.texte ?? "").split(/\s+/).length, `${s.id} ${e.texte}`).toBeLessThanOrEqual(5);
    }
  });

  it("« 3 phrases au plus » ne vaut que pour tableau-blanc et paperboard ; l'ardoise garde l'ancien comportement ; le dessin n'est pas un visuel", () => {
    const p = puce();
    expect(p.indexOf("3 phrases au plus")).toBeGreaterThan(p.indexOf("tableau-blanc"));
    expect(p).toMatch(/ardoise/);
    expect(p).toContain("le dessin à côté de l'étiquette n'est pas un visuel");
  });
});
